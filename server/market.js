import { categories, conditions, schools, sampleListings, sampleSellers, sampleReviews } from '../public/data.js';
import { inferredTags, tagsFor } from '../public/tags.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const need = (condition,status,message) => { if (!condition) throw new HttpError(status,message); };
export const identity = request => request.headers.get('oai-authenticated-user-id') || '';
export const sql = (db, query, ...values) => db.prepare(query).bind(...values);
export const first = (db, query, ...values) => sql(db,query,...values).first();
export const rows = async (db,query,...values) => (await sql(db,query,...values).all()).results;
export const run = (db,query,...values) => sql(db,query,...values).run();
export const uid = () => crypto.randomUUID();
export const getProfile = (db,id) => id ? first(db,'SELECT * FROM profiles WHERE id=?',id) : null;
export function requireUser(id) { need(id,401,'Hãy đăng nhập để tiếp tục.'); }
export function requireProfile(profile,verified=false) {
  need(profile,403,'Hãy tạo hồ sơ học sinh trước khi tiếp tục.');
  if (verified) need(profile.verified,403,'Bạn cần xác minh tư cách học sinh để tiếp tục.');
}
export const requireModerator = profile => need(profile?.moderator,403,'Chức năng dành cho người kiểm duyệt.');
export function textField(value, label, min, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  need(text.length>=min&&text.length<=max,400,label+' cần từ '+min+' đến '+max+' ký tự.');
  return text;
}
export const jsonBody = async request => {
  let data;
  try { data=await request.json(); } catch { throw new HttpError(400,'Dữ liệu gửi lên không hợp lệ.'); }
  need(data && typeof data === 'object' && !Array.isArray(data),400,'Dữ liệu gửi lên không hợp lệ.');
  return data;
};
export async function digest(value) {
  const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte=>byte.toString(16).padStart(2,'0')).join('');
}
const photoUrl = (id,key) => '/photos/'+id+'/'+key;
export const listingFields = 'l.*, p.name AS seller, p.school, p.verified';
const listingQuery = 'SELECT '+listingFields+' FROM listings l JOIN profiles p ON p.id=l.seller_id';
export const dbListing = (db,id) => first(db,listingQuery+' WHERE l.id=?',id);
function listingTags(row) {
  const tags=JSON.parse(row.tags||'[]');
  return tags.length ? tags : inferredTags(row.category,row.title,row.description);
}
export const publicListing = row => ({
  id:row.id,sellerId:row.seller_id,seller:row.seller,school:row.school,verified:!!row.verified,
  title:row.title,category:row.category,condition:row.condition,price:row.price,negotiable:!!row.negotiable,
  description:row.description,delivery:row.delivery,images:JSON.parse(row.images).map(key=>photoUrl(row.id,key)),
  status:row.status,created:row.created,tags:listingTags(row)
});
const publicProfile = row => ({id:row.id,name:row.name,school:row.school,shop:row.shop,bio:row.bio,verified:!!row.verified});
export const ownProfile = row => row ? {...publicProfile(row),moderator:!!row.moderator} : null;

export const catalog = async db => {
  const active = await rows(db,listingQuery+" WHERE l.status='active' ORDER BY l.created DESC,l.id");
  return [...active.map(publicListing),...sampleListings];
};
export async function getListing(db,id,profile) {
  const sample = sampleListings.find(item=>item.id===id);
  if (sample) return sample;
  const row = await dbListing(db,id);
  if (!row) return null;
  return ['active','sold'].includes(row.status)||row.seller_id===profile?.id||profile?.moderator ? publicListing(row) : null;
}
export async function sellerDetails(db,id) {
  const sample = sampleSellers.find(person=>person.id===id);
  if (sample) return {...sample,
    listings:sampleListings.filter(item=>item.sellerId===id),
    reviews:sampleReviews.filter(review=>review.seller===id),rating:5};
  const profile = await getProfile(db,id);
  if (!profile?.verified) return null;
  const listings = await rows(db,listingQuery+" WHERE l.seller_id=? AND l.status='active' ORDER BY l.created DESC",id);
  const reviews = await rows(db,'SELECT r.id,r.rating,r.text,p.name AS author FROM reviews r JOIN profiles p ON p.id=r.author_id WHERE r.seller_id=? AND r.hidden=0 ORDER BY r.created DESC,r.id',id);
  const completed = await first(db,"SELECT count(*) AS total FROM trades WHERE seller_id=? AND status='completed'",id);
  return {...publicProfile(profile),listings:listings.map(publicListing),reviews,completed:completed.total,
    rating:reviews.length?reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length:null};
}

export async function editProfile(db,id,profile,request) {
  const body = await jsonBody(request);
  const name = textField(body.name,'Tên hiển thị',2,45);
  const shop = textField(body.shop,'Tên gian hàng',2,65);
  const bio = textField(body.bio,'Giới thiệu',0,350);
  const school = profile?.verified ? profile.school : body.school;
  need(schools.includes(school),400,'Hãy chọn trường THPT tham gia thử nghiệm.');
  await run(db,'INSERT INTO profiles (id,name,shop,school,bio) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,shop=excluded.shop,bio=excluded.bio,school=CASE WHEN profiles.verified=1 THEN profiles.school ELSE excluded.school END',id,name,shop,school,bio);
  return ownProfile(await getProfile(db,id));
}
export async function verifyStudent(db,profile,request) {
  requireProfile(profile);
  need(!profile.verified,409,'Hồ sơ đã được xác minh.');
  const body = await jsonBody(request);
  const hash = await digest(textField(body.code,'Mã xác minh',8,50).toUpperCase());
  const results = await db.batch([
    sql(db,"UPDATE invites SET used_by=? WHERE hash=? AND school=? AND used_by IS NULL AND expires>datetime('now') AND EXISTS (SELECT 1 FROM profiles WHERE id=? AND school=? AND verified=0)",profile.id,hash,profile.school,profile.id,profile.school),
    sql(db,'UPDATE profiles SET verified=1 WHERE id=? AND school=? AND EXISTS (SELECT 1 FROM invites WHERE hash=? AND used_by=?)',profile.id,profile.school,hash,profile.id)
  ]);
  need(results[0].meta.changes===1,400,'Mã không hợp lệ, đã dùng, đã hết hạn hoặc khác trường.');
  return ownProfile(await getProfile(db,profile.id));
}
export async function generateInvite(db,profile,request) {
  requireModerator(profile);
  const body = await jsonBody(request);
  need(schools.includes(body.school),400,'Hãy chọn một trường.');
  const code = 'RC-'+uid().replaceAll('-','').slice(0,24).toUpperCase();
  await run(db,"INSERT INTO invites (hash,school,expires) VALUES (?,?,datetime('now','+7 days'))",await digest(code),body.school);
  return {code,school:body.school};
}
export async function claimModerator(env,profile,request) {
  requireProfile(profile);
  need(env.MODERATOR_CODE,503,'Chưa cấu hình quyền kiểm duyệt.');
  const body = await jsonBody(request);
  const supplied = await digest(textField(body.code,'Mã quản trị',8,100));
  const expected = await digest(env.MODERATOR_CODE);
  let difference = 0;
  for (let index=0;index<expected.length;index++) difference |= supplied.charCodeAt(index)^expected.charCodeAt(index);
  need(!difference,403,'Mã quản trị không đúng.');
  await run(env.DB,'UPDATE profiles SET moderator=1 WHERE id=?',profile.id);
  return ownProfile(await getProfile(env.DB,profile.id));
}
export async function getPhoto(env,profile,id,key){
  const listing = await dbListing(env.DB,id);
  need(listing&&(['active','sold'].includes(listing.status)||listing.seller_id===profile?.id||profile?.moderator),404,'Không tìm thấy ảnh.');
  need(JSON.parse(listing.images).includes(key),404,'Không tìm thấy ảnh.');
  const object = await env.BUCKET.get(id+'/'+key);
  need(object,404,'Không tìm thấy ảnh.');
  return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-cache'}});
}
export async function saveListing(env,profile,request,id) {
  requireProfile(profile,true);
  const db=env.DB;
  const previous = id ? await dbListing(db,id) : null;
  if (id) {
    need(previous?.seller_id===profile.id,404,'Không tìm thấy tin đăng.');
    need(previous.status!=='sold',409,'Tin đã giao dịch thành công.');
  }
  const form=await request.formData();
  const title=textField(form.get('title'),'Tiêu đề',4,100);
  const category=form.get('category');
  need(categories.some(cat=>cat.id===category),400,'Danh mục không được hỗ trợ.');
  const condition=form.get('condition');
  need(conditions.includes(condition),400,'Hãy chọn tình trạng thực tế.');
  const price=Number(form.get('price'));
  need(form.get('price')!==''&&form.get('price')!==null&&Number.isSafeInteger(price)&&price>=0&&price<=20000000,400,'Giá phải từ 0 đến 20.000.000đ.');
  const description=textField(form.get('description'),'Mô tả',15,1500);
  const delivery=textField(form.get('delivery'),'Giao nhận',8,350);
  const selectedTags=[...new Set(form.getAll('tags'))];
  const validTags=new Set(tagsFor(category).map(item=>item.id));
  need(selectedTags.length<=3&&selectedTags.every(id=>validTags.has(id)),400,'Chọn tối đa 3 thẻ trong đúng danh mục.');
  const tags=JSON.stringify(selectedTags.length?selectedTags:inferredTags(category,title,description));
  const negotiable=Number(form.get('negotiable')==='on');
  const photos=form.getAll('photos').filter(file=>typeof file==='object'&&file.size);
  need((previous||photos.length)&&photos.length<=3,400,'Hãy thêm từ 1 đến 3 ảnh thật.');
  const validatedPhotos = [];
  for (const photo of photos) {
    need(photo.type==='image/jpeg'&&photo.size<=1500000,400,'Ảnh cần là JPEG và dưới 1,5 MB.');
    const bytes=new Uint8Array(await photo.arrayBuffer());
    need(bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217,400,'Tệp ảnh không hợp lệ.');
    validatedPhotos.push(bytes);
  }
  const listingId=id||uid();
  const oldKeys=previous?JSON.parse(previous.images):[];
  const newKeys=[];
  const updated=uid();
  try {
    for (const bytes of validatedPhotos) {
      const key=uid()+'.jpg';
      await env.BUCKET.put(listingId+'/'+key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
      newKeys.push(key);
    }
    const images=JSON.stringify(newKeys.length?newKeys:oldKeys);
    if (previous) {
      const saved=await run(db,"UPDATE listings SET title=?,category=?,condition=?,price=?,negotiable=?,description=?,delivery=?,images=?,tags=?,status='pending',reason='',updated=? WHERE id=? AND updated=? AND status<>'sold'",title,category,condition,price,negotiable,description,delivery,images,tags,updated,id,previous.updated);
      need(saved.meta.changes===1,409,'Tin đăng đã thay đổi. Hãy tải lại và thử lại.');
    } else {
      await run(db,'INSERT INTO listings (id,seller_id,title,category,condition,price,negotiable,description,delivery,images,tags,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',listingId,profile.id,title,category,condition,price,negotiable,description,delivery,images,tags,updated);
    }
  } catch (error) {
    await Promise.allSettled(newKeys.map(key=>env.BUCKET.delete(listingId+'/'+key)));
    throw error;
  }
  if (newKeys.length) await Promise.allSettled(oldKeys.map(key=>env.BUCKET.delete(listingId+'/'+key)));
  return {id:listingId};
}
export async function listingAction(db,profile,id,request,moderating=false) {
  requireProfile(profile, !moderating);
  if (moderating) requireModerator(profile);
  const listing=await dbListing(db,id);
  need(listing&&(moderating||listing.seller_id===profile.id),404,'Không tìm thấy tin đăng.');
  const body=await jsonBody(request);
  const actions = moderating ? {approve:['active',['pending']],reject:['rejected',['pending']],remove:['rejected',['active']]} :
    {hide:['hidden',['active','pending']],submit:['pending',['hidden']]};
  const change=Object.hasOwn(actions,body.action)?actions[body.action]:null;
  need(change?.[1].includes(listing.status),409,'Không thể chuyển tin đăng sang trạng thái này.');
  const [status]=change;
  const reason=status==='rejected'?textField(body.reason,'Lý do kiểm duyệt',5,400):'';
  const result=await run(db,'UPDATE listings SET status=?,reason=?,updated=? WHERE id=? AND updated=?',status,reason,uid(),id,listing.updated);
  need(result.meta.changes===1,409,'Tin đăng đã thay đổi. Hãy tải lại và thử lại.');
  return {status};
}
