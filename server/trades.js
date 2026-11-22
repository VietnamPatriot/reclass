import { getProfile, rateLimit, requireModerator, requireProfile } from './accounts.js';
import { digest, docData, get, jsonBody, need, now, records, safeId, textField, uid } from './firebase.js';
import { listingRef, newest } from './market.js';

export const tradesFor = (db, id) => db.collection('trades').where('members', 'array-contains', id);
export const tradeRef = (db, id) => db.collection('trades').doc(id);
export const recentMessages = ref => ref.collection('messages').orderBy('created', 'desc').limit(100);
export const participant = (trade, profile) => trade && (trade.buyer_id === profile.id || trade.seller_id === profile.id);

async function tradeDetailsFor(db, trade) {
  const { id, listing_id, buyer_id, seller_id, buyer_done, seller_done, status, created, review_id, updated } = trade;
  const [listing, buyer, seller] = await Promise.all([get(listingRef(db, listing_id)), getProfile(db, buyer_id), getProfile(db, seller_id)]);
  return { id, listing_id, buyer_id, seller_id, buyer_done, seller_done, status, created, review_id: review_id || null,
    title: listing?.title ?? 'Tin đăng', buyer: buyer?.name ?? 'Học sinh', seller: seller?.name ?? 'Học sinh', updated: updated || created };
}

export async function listTrades(db, id) {
  const list = records(await tradesFor(db, id).get());
  list.sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created) || newest(a, b));
  return Promise.all(list.map(trade => tradeDetailsFor(db, trade)));
}

export async function startTrade(db, profile, request) {
  requireProfile(profile, true);
  const { listingId } = await jsonBody(request);
  need(safeId(listingId), 400, 'Mã tin đăng không hợp lệ.');
  const item = listingRef(db, listingId);
  const slot = db.collection('tradeSlots').doc(digest(`${listingId}/${profile.id}`));
  return db.runTransaction(async tx => {
    const [listing, existing] = (await tx.getAll(item, slot)).map(docData);
    need(listing && listing.seller_id !== profile.id, 409, 'Tin này hiện không nhận yêu cầu trao đổi.');
    if (existing) return { id: existing.tradeId };
    need(listing.status === 'active', 409, 'Tin này hiện không nhận yêu cầu trao đổi.');
    const openTrades = listing.openTrades || [];
    need(openTrades.length < 100, 409, 'Tin này đã có quá nhiều yêu cầu đang mở.');
    const ref = tradeRef(db, uid());
    const timestamp = now();
    tx.create(ref, { listing_id: listingId, buyer_id: profile.id, seller_id: listing.seller_id, buyer_done: false, seller_done: false,
      members: [profile.id, listing.seller_id], status: 'open', created: timestamp, updated: timestamp });
    tx.create(slot, { tradeId: ref.id });
    tx.update(item, { openTrades: [...openTrades, ref.id] });
    return { id: ref.id };
  });
}

export async function checkedTrade(db, profile, id) {
  const ref = tradeRef(db, id);
  const trade = await get(ref);
  need(participant(trade, profile), 404, 'Không tìm thấy giao dịch.');
  return { ref, trade };
}

export async function tradeDetails(db, profile, id) {
  const { ref, trade } = await checkedTrade(db, profile, id);
  const [summary, messages] = await Promise.all([tradeDetailsFor(db, trade), recentMessages(ref).get()]);
  return { trade: summary, messages: records(messages).reverse().map(({ id, sender_id, body, created }) => ({
    id, sender_id, body, created, name: sender_id === summary.buyer_id ? summary.buyer : summary.seller
  })) };
}

export async function updateTrade(db, profile, id, request) {
  requireProfile(profile, true);
  await checkedTrade(db, profile, id);
  const body = await jsonBody(request);
  const ref = tradeRef(db, id);
  const madeAt = now();
  await db.runTransaction(async tx => {
    const trade = docData(await tx.get(ref));
    need(participant(trade, profile), 404, 'Không tìm thấy giao dịch.');
    if (body.action === 'review') {
      const rating = Number(body.rating);
      need(trade.status === 'completed' && trade.buyer_id === profile.id, 403, 'Người mua có thể đánh giá sau khi hai bên xác nhận.');
      need(!trade.review_id, 409, 'Giao dịch này đã được đánh giá.');
      need(Number.isInteger(rating) && rating >= 1 && rating <= 5, 400, 'Điểm đánh giá cần từ 1 đến 5.');
      const text = textField(body.text, 'Nội dung đánh giá', 5, 700);
      tx.create(db.collection('reviews').doc(id), { seller_id: trade.seller_id, author_id: profile.id, rating, text, hidden: false, created: madeAt });
      tx.update(ref, { review_id: id, updated: madeAt });
      return;
    }
    if (body.action === 'message') {
      const text = textField(body.text, 'Tin nhắn', 1, 1000);
      need(body.messageId === undefined || safeId(body.messageId), 400, 'Mã tin nhắn không hợp lệ.');
      const message = ref.collection('messages').doc(digest(`${profile.id}/${body.messageId ?? uid()}`));
      const existing = (await tx.get(message)).data();
      if (existing) {
        need(existing.body === text, 409, 'Mã tin nhắn đã được sử dụng.');
        return;
      }
      need(trade.status === 'open', 409, 'Giao dịch này đã kết thúc.');
      const times = trade.lastMessage || {};
      need(Date.now() - (times[profile.id] || 0) >= 750, 429, 'Hãy đợi một chút trước khi gửi thêm tin nhắn.');
      tx.create(message, { sender_id: profile.id, body: text, created: madeAt });
      tx.update(ref, { updated: madeAt, lastMessage: { ...times, [profile.id]: Date.now() } });
      return;
    }
    need(['confirm', 'cancel'].includes(body.action), 400, 'Thao tác giao dịch không hợp lệ.');
    need(trade.status === 'open', 409, 'Giao dịch này đã kết thúc.');
    const field = trade.buyer_id === profile.id ? 'buyer_done' : 'seller_done';
    const otherConfirmed = field === 'buyer_done' ? trade.seller_done : trade.buyer_done;
    if (body.action === 'confirm' && !otherConfirmed) {
      tx.update(ref, { [field]: true, updated: madeAt });
      return;
    }
    const item = listingRef(db, trade.listing_id);
    const listing = docData(await tx.get(item));
    need(listing, 409, 'Tin đăng không còn tồn tại.');
    const others = (listing.openTrades || []).filter(other => other !== id);
    const clearSlot = row => tx.delete(db.collection('tradeSlots').doc(digest(`${row.listing_id}/${row.buyer_id}`)));
    if (body.action === 'cancel') {
      tx.update(item, { openTrades: others });
      tx.update(ref, { status: 'cancelled', updated: madeAt });
    } else {
      need(listing.status !== 'sold', 409, 'Tin đã giao dịch thành công.');
      const related = others.length ? (await tx.getAll(...others.map(other => tradeRef(db, other)))).map(docData) : [];
      for (const row of related.filter(row => row?.status === 'open')) {
        tx.update(tradeRef(db, row.id), { status: 'cancelled', updated: madeAt });
        clearSlot(row);
      }
      tx.update(item, { openTrades: [], status: 'sold', updated: uid() });
      tx.update(ref, { [field]: true, status: 'completed', updated: madeAt });
    }
    clearSlot(trade);
  });
  return tradeDetails(db, profile, id);
}

export async function makeReport(db, profile, request) {
  const { kind, target: supplied, body: text } = await jsonBody(request);
  need(['site', 'listing', 'review', 'trade', 'appeal'].includes(kind), 400, 'Loại báo cáo không hợp lệ.');
  const target = kind === 'site' ? '' : supplied;
  need(kind === 'site' || safeId(target), 400, 'Mã tham chiếu không hợp lệ.');
  const body = textField(text, 'Nội dung', 8, 1000);
  await rateLimit(db, 'report', profile.id, 12, 3600);
  if (kind === 'listing' || kind === 'appeal') {
    const listing = await get(listingRef(db, target));
    need(listing && (kind === 'appeal' ? listing.seller_id === profile.id && listing.status === 'rejected' : ['active', 'sold'].includes(listing.status)), 400, 'Tin minh họa hoặc tin đã ẩn không nhận báo cáo.');
  }
  if (kind === 'review') {
    const review = await get(db.collection('reviews').doc(target));
    need(review && !review.hidden, 404, 'Không tìm thấy đánh giá.');
  }
  if (kind === 'trade') await checkedTrade(db, profile, target);
  await db.collection('reports').add({ reporter_id: profile.id, kind, target, body, status: 'open', created: now() });
  return { ok: true };
}

export async function resolveReport(db, profile, id, request) {
  requireModerator(profile);
  const { action } = await jsonBody(request);
  need(['resolve', 'hide-review', 'requeue'].includes(action), 400, 'Thao tác không hợp lệ.');
  const ref = db.collection('reports').doc(id);
  await db.runTransaction(async tx => {
    const report = (await tx.get(ref)).data();
    need(report?.status === 'open', 404, 'Báo cáo đã được xử lý hoặc không tồn tại.');
    if (action === 'hide-review') {
      need(report.kind === 'review', 400, 'Báo cáo không liên quan đến đánh giá.');
      tx.update(db.collection('reviews').doc(report.target), { hidden: true });
    }
    if (action === 'requeue') {
      need(report.kind === 'appeal', 400, 'Báo cáo không phải kháng nghị.');
      const item = listingRef(db, report.target);
      if ((await tx.get(item)).data()?.status === 'rejected') tx.update(item, { status: 'pending', reason: '', updated: uid() });
    }
    tx.update(ref, { status: 'resolved' });
  });
  return { ok: true };
}
