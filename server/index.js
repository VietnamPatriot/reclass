import { assets } from 'reclass:assets';
import { HttpError, need, identity, getProfile, ownProfile, requireUser, requireModerator, rows, publicListing, catalog, getListing, sellerDetails, editProfile, verifyStudent, generateInvite, claimModerator, getPhoto, saveListing, listingAction } from './market.js';
import { listTrades, startTrade, tradeDetails, updateTrade, makeReport, resolveReport } from './trades.js';

const fallbacks = new Set(['/', '/kham-pha','/da-luu']);
const isAppPath = path => fallbacks.has(path) || /^\/(?:san-pham|gian-hang)\/[^/]+$/.test(path);
const contentTypes = {'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','jpg':'image/jpeg','svg':'image/svg+xml','woff2':'font/woff2'};

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function staticAsset(path, request){
  const file=assets[isAppPath(path)?'/index.html':path];
  if (!Object.hasOwn(assets, isAppPath(path)?'/index.html':path)) return new Response('Không tìm thấy trang.',{status:404});
  const type=contentTypes[(isAppPath(path)?'html':path.split('.').at(-1))]||'application/octet-stream';
  return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(file), char=>char.charCodeAt(0)),{headers:{'Content-Type':type,'Cache-Control':path.startsWith('/assets/')?'public, max-age=86400':'no-cache'}});
}
async function handle(request,env) {
  const url=new URL(request.url);
  const method=request.method;
  const path=url.pathname.replace(/\/+$/,'')||'/';
  let parts;
  try { parts=path.split('/').slice(1).map(decodeURIComponent); }
  catch { throw new HttpError(400,'Đường dẫn không hợp lệ.'); }
  if (parts[0]!=='api'&&parts[0]!=='photos') return ['GET','HEAD'].includes(method)?staticAsset(path,request):json({error:'Phương thức không hợp lệ.'},405);
  const db=env.DB;
  if (!['GET','HEAD'].includes(method)) {
    const origin=request.headers.get('Origin');
    need(origin===url.origin,403,'Chỉ có thể gửi yêu cầu từ RE:CLASS.');
    const bytes=Number(request.headers.get('Content-Length')||0);
    need(bytes<=4800000,413,'Dữ liệu gửi lên quá lớn.');
  }
  const id=identity(request);
  const profile=await getProfile(db,id);
  if (parts[0]==='photos'&&parts.length===3&&method==='GET') return getPhoto(env,profile,parts[1],parts[2]);
  const [,resource,key,action]=parts;
  if (method==='GET') {
    if (resource==='listings'&&!key) return json(await catalog(db));
    if (resource==='listings'&&key) {
      const item=await getListing(db,key,profile);
      need(item,404,'Không tìm thấy tin đăng.');
      const seller=await sellerDetails(db,item.sellerId);
      need(seller,404,'Không tìm thấy gian hàng.');
      return json({item,seller});
    }
    if (resource==='sellers'&&key) {
      const seller=await sellerDetails(db,key);
      need(seller,404,'Không tìm thấy gian hàng.');
      return json(seller);
    }
    if (resource==='session') {
      return json({signed:!!id,profile:ownProfile(profile),local:!!env.LOCAL,
        ...(env.LOCAL&&{activeDemo:id,demoAccounts:['seller','buyer','moderator']})});
    }
  }
  requireUser(id);
  if (resource==='profile'&&method==='POST') return json(await editProfile(db,id,profile,request));
  if (resource==='verify'&&method==='POST') return json(await verifyStudent(db,profile,request));
  if (resource==='listings'&&method==='POST') return json(action==='status'?await listingAction(db,profile,key,request):await saveListing(env,profile,request,key));
  if (resource==='trades') {
    if (method==='GET'&&key) return json(await tradeDetails(db,profile,key));
    if (method==='POST') return json(key?await updateTrade(db,profile,key,request):await startTrade(db,profile,request));
  }
  if (resource==='reports'&&method==='POST') return json(await makeReport(db,profile,request));
  if (resource==='dashboard'&&method==='GET') {
    const [listings,trades]=await Promise.all([
      rows(db,'SELECT l.*,p.name AS seller,p.school,p.verified FROM listings l JOIN profiles p ON p.id=l.seller_id WHERE l.seller_id=? ORDER BY l.created DESC',id),
      listTrades(db,id)
    ]);
    return json({listings:listings.map(row=>({...publicListing(row),reason:row.reason})),trades});
  }
  if (resource==='moderation') {
    if (key==='claim'&&method==='POST') return json(await claimModerator(env,profile,request));
    requireModerator(profile);
    if (!key&&method==='GET') {
      const [listings,reports]=await Promise.all([
        rows(db,"SELECT l.*,p.name AS seller,p.school,p.verified FROM listings l JOIN profiles p ON p.id=l.seller_id WHERE l.status='pending' ORDER BY l.created,l.id"),
        rows(db,"SELECT id,kind,target,body,created FROM reports WHERE status='open' ORDER BY created,id")
      ]);
      return json({listings:listings.map(publicListing),reports});
    }
    if (key==='invite'&&method==='POST') return json(await generateInvite(db,profile,request));
    if (key==='listings'&&method==='POST') return json(await listingAction(db,profile,action,request,true));
    if (key==='reports'&&method==='POST') return json(await resolveReport(db,profile,action,request));
  }
  return json({error:'Không tìm thấy chức năng.'},404);
}
export default {
  async fetch(request,env) {
    let response;
    try { response=await handle(request,env); }
    catch(error) {
      if (!(error instanceof HttpError)) console.error(error);
      response=json({error:error instanceof HttpError?error.message:'Có lỗi xảy ra. Hãy thử lại.'},error.status||500);
    }
    const headers=new Headers(response.headers);
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','same-origin');
    headers.set('Content-Security-Policy',"default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; form-action 'self'");
    return new Response(response.body,{status:response.status,headers});
  }
};
