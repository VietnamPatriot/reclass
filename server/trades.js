import { need, sql, first, rows, run, uid, jsonBody, textField, dbListing, requireProfile, requireModerator } from './market.js';

const tradeQuery = "SELECT t.*, l.title, buyer.name AS buyer, seller.name AS seller, r.id AS review_id FROM trades t JOIN listings l ON t.listing_id=l.id JOIN profiles buyer ON t.buyer_id=buyer.id JOIN profiles seller ON t.seller_id=seller.id LEFT JOIN reviews r ON r.trade_id=t.id";
export const listTrades = (db,id) => rows(db,tradeQuery+' WHERE t.buyer_id=? OR t.seller_id=? ORDER BY t.created DESC,t.id',id,id);
const findTrade = (db,id) => first(db,tradeQuery+' WHERE t.id=?',id);
const participant = (trade, profile) => trade&&(trade.seller_id===profile?.id||trade.buyer_id===profile?.id);

export async function startTrade(db,profile,request) {
  requireProfile(profile,true);
  const body=await jsonBody(request);
  const listing=await dbListing(db,body.listingId||'');
  need(listing?.status==='active',409,'Tin này hiện không nhận yêu cầu trao đổi.');
  need(listing.seller_id!==profile.id,400,'Đây là tin của bạn.');
  const id=uid();
  await run(db,"INSERT OR IGNORE INTO trades(id,listing_id,buyer_id,seller_id) SELECT ?,id,?,seller_id FROM listings WHERE id=? AND status='active'",id,profile.id,listing.id);
  const trade=await first(db,"SELECT id FROM trades WHERE listing_id=? AND buyer_id=? AND status='open'",listing.id,profile.id);
  need(trade,409,'Tin này hiện không nhận yêu cầu trao đổi.');
  return trade;
}

export async function tradeDetails(db,profile,id) {
  const trade=await findTrade(db,id);
  need(participant(trade,profile),404,'Không tìm thấy giao dịch.');
  const messages=await rows(db,'SELECT m.id,m.sender_id,m.body,m.created,p.name FROM messages m JOIN profiles p ON p.id=m.sender_id WHERE m.trade_id=? ORDER BY m.rowid DESC LIMIT 100',id);
  return {trade,messages:messages.reverse()};
}

export async function updateTrade(db,profile,id,request) {
  requireProfile(profile,true);
  const trade=await findTrade(db,id);
  need(participant(trade,profile),404,'Không tìm thấy giao dịch.');
  const body=await jsonBody(request);
  if (body.action==='review') {
    const rating=Number(body.rating);
    need(trade.status==='completed'&&trade.buyer_id===profile.id,403,'Người mua có thể đánh giá sau khi hai bên xác nhận.');
    need(Number.isInteger(rating)&&rating>=1&&rating<=5,400,'Điểm đánh giá cần từ 1 đến 5.');
    const text=textField(body.text,'Nội dung đánh giá',5,700);
    const result=await run(db,'INSERT OR IGNORE INTO reviews (id,trade_id,seller_id,author_id,rating,text) VALUES (?,?,?,?,?,?)',uid(),id,trade.seller_id,profile.id,rating,text);
    need(result.meta.changes===1,409,'Giao dịch này đã được đánh giá.');
  } else {
    need(trade.status==='open',409,'Giao dịch này đã kết thúc.');
    if (body.action==='message') {
      const text=textField(body.text,'Tin nhắn',1,1000);
      const result=await run(db,"INSERT INTO messages (id,trade_id,sender_id,body) SELECT ?,id,?,? FROM trades WHERE id=? AND status='open'",uid(),profile.id,text,id);
      need(result.meta.changes===1,409,'Giao dịch này đã kết thúc.');
    } else if (body.action==='cancel') {
      const result=await run(db,"UPDATE trades SET status='cancelled' WHERE id=? AND status='open'",id);
      need(result.meta.changes===1,409,'Giao dịch này đã kết thúc.');
    } else {
      need(body.action==='confirm',400,'Thao tác giao dịch không hợp lệ.');
      const column=trade.buyer_id===profile.id?'buyer_done':'seller_done';
      const results=await db.batch([
        sql(db,"UPDATE trades SET "+column+"=1 WHERE id=? AND status='open'",id),
        sql(db,"UPDATE trades SET status='completed' WHERE id=? AND status='open' AND buyer_done=1 AND seller_done=1 AND NOT EXISTS (SELECT 1 FROM trades WHERE listing_id=? AND status='completed')",id,trade.listing_id),
        sql(db,"UPDATE listings SET status='sold',updated=? WHERE id=? AND EXISTS (SELECT 1 FROM trades WHERE id=? AND status='completed')",uid(),trade.listing_id,id),
        sql(db,"UPDATE trades SET status='cancelled' WHERE listing_id=? AND id<>? AND status='open' AND EXISTS (SELECT 1 FROM trades WHERE id=? AND status='completed')",trade.listing_id,id,id)
      ]);
      need(results[0].meta.changes===1,409,'Giao dịch này đã kết thúc.');
    }
  }
  return tradeDetails(db,profile,id);
}

export async function makeReport(db,profile,request) {
  requireProfile(profile);
  const data=await jsonBody(request);
  const kind=data.kind;
  need(['site','listing','review','trade','appeal'].includes(kind),400,'Loại báo cáo không hợp lệ.');
  const target=kind==='site'?'':textField(data.target,'Mã tham chiếu',1,80);
  const body=textField(data.body,'Nội dung',8,1000);
  if (kind==='listing'||kind==='appeal') {
    const listing=await dbListing(db,target);
    need(listing&&(kind==='appeal' ? listing.seller_id===profile.id&&listing.status==='rejected' : ['active','sold'].includes(listing.status)),400,'Tin minh họa hoặc tin đã ẩn không nhận báo cáo.');
  }
  if (kind==='review') need(await first(db,'SELECT id FROM reviews WHERE id=? AND hidden=0',target),404,'Không tìm thấy đánh giá.');
  if (kind==='trade') need(participant(await findTrade(db,target),profile),404,'Không tìm thấy giao dịch.');
  await run(db,'INSERT INTO reports (id,reporter_id,kind,target,body) VALUES (?,?,?,?,?)',uid(),profile.id,kind,target,body);
  return {ok:true};
}
export async function resolveReport(db,profile,id,request) {
  requireModerator(profile);
  const report=await first(db,"SELECT * FROM reports WHERE id=? AND status='open'",id);
  need(report,404,'Báo cáo đã được xử lý hoặc không tồn tại.');
  const body=await jsonBody(request);
  need(['resolve','hide-review','requeue'].includes(body.action),400,'Thao tác không hợp lệ.');
  const commands=[];
  if (body.action==='hide-review') {
    need(report.kind==='review',400,'Báo cáo không liên quan đến đánh giá.');
    commands.push(sql(db,'UPDATE reviews SET hidden=1 WHERE id=?',report.target));
  }
  if (body.action==='requeue') {
    need(report.kind==='appeal',400,'Báo cáo không phải kháng nghị.');
    commands.push(sql(db,"UPDATE listings SET status='pending',reason='',updated=? WHERE id=? AND status='rejected'",uid(),report.target));
  }
  commands.push(sql(db,"UPDATE reports SET status='resolved' WHERE id=?",id));
  await db.batch(commands);
  return {ok:true};
}
