import { Readable } from 'node:stream';
import { categories, conditions, sampleListings, sampleSellers, sampleReviews, reviewSummary } from '../public/catalog/data.js';
import { inferredTags, tagsFor } from '../public/catalog/tags.js';
import { getProfile, publicProfile, rateLimit, requireModerator, requireProfile } from './accounts.js';
import { cleanPhoto, deletePhoto, docData, formBody, get, jsonBody, need, now, putPhoto, records, textField, uid } from './firebase.js';

export const listingRef = (db, id) => db.collection('listings').doc(id);
export const activeListings = db => db.collection('listings').where('status', '==', 'active');
export const newest = (a, b) => b.created.localeCompare(a.created) || a.id.localeCompare(b.id);
const photoPath = (id, key) => `listings/${id}/${key}`;
const canRead = (listing, profile) => ['active', 'sold'].includes(listing.status) || listing.seller_id === profile?.id || profile?.moderator;
const visibleReviews = (db, id) => db.collection('reviews').where('seller_id', '==', id).where('hidden', '==', false);

function publicListing(row, seller, ratings = { rating: null, ratingCount: 0 }) {
  return {
    id: row.id, sellerId: row.seller_id, seller: seller.name, school: seller.school, verified: !!seller.verified,
    title: row.title, category: row.category, condition: row.condition, price: row.price, negotiable: !!row.negotiable,
    description: row.description, delivery: row.delivery, images: row.images.map(key => `/photos/${row.id}/${key}`),
    status: row.status, created: row.created, tags: row.tags?.length ? row.tags : inferredTags(row.category, row.title, row.description),
    ...ratings
  };
}

async function listingCards(db, listings, showRatings = false) {
  const ids = [...new Set(listings.map(row => row.seller_id))];
  if (!ids.length) return [];
  const refs = ids.map(id => db.collection('profiles').doc(id));
  const sellers = new Map((await db.getAll(...refs)).filter(snap => snap.exists).map(snap => [snap.id, snap.data()]));
  const ratings = showRatings ? new Map(await Promise.all([...sellers.keys()].map(async id => {
    const reviews = await visibleReviews(db, id).select('rating').get();
    return [id, reviewSummary(records(reviews))];
  }))) : new Map();
  return listings.filter(row => sellers.has(row.seller_id))
    .map(row => publicListing(row, sellers.get(row.seller_id), ratings.get(row.seller_id)));
}

export async function catalog(db) {
  return [...await listingCards(db, records(await activeListings(db).get()).sort(newest), true), ...sampleListings];
}

export async function getListing(db, id, profile) {
  const sample = sampleListings.find(item => item.id === id);
  if (sample) return sample;
  const listing = await get(listingRef(db, id));
  if (!listing || !canRead(listing, profile)) return null;
  const seller = await getProfile(db, listing.seller_id);
  return seller && publicListing(listing, seller);
}

export async function sellerDetails(db, id) {
  const sample = sampleSellers.find(person => person.id === id);
  if (sample) {
    const reviews = sampleReviews.filter(review => review.seller === id);
    return { ...sample, listings: sampleListings.filter(item => item.sellerId === id), soldListings: [], reviews, ...reviewSummary(reviews) };
  }
  const profile = await getProfile(db, id);
  if (!profile?.verified) return null;
  const owned = db.collection('listings').where('seller_id', '==', id);
  const [listings, sold, reviewDocs, completed] = await Promise.all([
    owned.where('status', '==', 'active').get(),
    owned.where('status', '==', 'sold').get(),
    visibleReviews(db, id).get(),
    db.collection('trades').where('seller_id', '==', id).where('status', '==', 'completed').count().get()
  ]);
  const reviewRows = records(reviewDocs).sort(newest);
  const authors = [...new Set(reviewRows.map(row => row.author_id))];
  const names = new Map(await Promise.all(authors.map(async uid => [uid, (await getProfile(db, uid))?.name ?? 'Học sinh'])));
  const reviews = reviewRows.map(row => ({ id: row.id, rating: row.rating, text: row.text, author: names.get(row.author_id) }));
  const ratings = reviewSummary(reviews);
  return { ...publicProfile(profile), listings: records(listings).sort(newest).map(row => publicListing(row, profile, ratings)),
    soldListings: records(sold).sort(newest).map(row => publicListing(row, profile, ratings)), reviews,
    completed: completed.data().count, ...ratings };
}

export async function dashboardListings(db, profile) {
  const snapshot = await db.collection('listings').where('seller_id', '==', profile.id).get();
  return records(snapshot).sort(newest).map(row => ({ ...publicListing(row, profile), reason: row.reason }));
}

export async function moderationData(db) {
  const [listings, reports] = await Promise.all([
    db.collection('listings').where('status', '==', 'pending').get(), db.collection('reports').where('status', '==', 'open').get()
  ]);
  return { listings: await listingCards(db, records(listings).sort(newest).reverse()),
    reports: records(reports).sort(newest).reverse().map(({ id, kind, target, body, created }) => ({ id, kind, target, body, created })) };
}

export async function getPhoto(env, profile, id, key) {
  const listing = await get(listingRef(env.db, id));
  need(listing && canRead(listing, profile) && listing.images.includes(key), 404, 'Không tìm thấy ảnh.');
  const object = env.bucket.file(photoPath(id, key));
  need((await object.exists())[0], 404, 'Không tìm thấy ảnh.');
  return new Response(Readable.toWeb(object.createReadStream()), { headers: { 'Content-Type': 'image/jpeg' } });
}

export async function saveListing(env, profile, request, id) {
  requireProfile(profile, true);
  const { db, bucket } = env;
  const ref = listingRef(db, id || uid());
  const previous = id ? await get(ref) : null;
  if (id) {
    need(previous?.seller_id === profile.id, 404, 'Không tìm thấy tin đăng.');
    need(previous.status !== 'sold', 409, 'Tin đã giao dịch thành công.');
  }
  const form = await formBody(request);
  const title = textField(form.get('title'), 'Tiêu đề', 4, 100);
  const category = form.get('category');
  need(categories.some(cat => cat.id === category), 400, 'Danh mục không được hỗ trợ.');
  const condition = form.get('condition');
  need(conditions.includes(condition), 400, 'Hãy chọn tình trạng thực tế.');
  const price = Number(form.get('price'));
  need(typeof form.get('price') === 'string' && form.get('price').trim() && Number.isSafeInteger(price) && price >= 0 && price <= 20_000_000, 400, 'Giá phải từ 0 đến 20.000.000đ.');
  const description = textField(form.get('description'), 'Mô tả', 15, 1500);
  const delivery = textField(form.get('delivery'), 'Giao nhận', 8, 350);
  const selectedTags = [...new Set(form.getAll('tags'))];
  const validTags = new Set(tagsFor(category).map(item => item.id));
  need(selectedTags.length <= 3 && selectedTags.every(tag => validTags.has(tag)), 400, 'Chọn tối đa 3 thẻ trong đúng danh mục.');
  const tags = selectedTags.length ? selectedTags : inferredTags(category, title, description);
  const photos = form.getAll('photos').filter(file => !(file instanceof File && !file.size && !file.name));
  need((previous || photos.length) && photos.length <= 3, 400, 'Hãy thêm từ 1 đến 3 ảnh thật.');
  await rateLimit(db, 'listing', profile.id, 20, 3600);
  const clean = [];
  for (const file of photos) clean.push(await cleanPhoto(file, 1_500_000));
  const keys = clean.map(() => uid() + '.jpg');
  const updates = { title, category, condition, price, negotiable: form.get('negotiable') === 'on', description, delivery, tags,
    images: keys.length ? keys : previous.images, status: 'pending', reason: '', updated: uid() };
  try {
    for (const [index, bytes] of clean.entries()) await putPhoto(bucket, photoPath(ref.id, keys[index]), bytes);
    if (previous) {
      await db.runTransaction(async tx => {
        const listing = (await tx.get(ref)).data();
        need(listing?.updated === previous.updated && listing.status !== 'sold', 409, 'Tin đăng đã thay đổi. Hãy tải lại và thử lại.');
        tx.update(ref, updates);
      });
    } else {
      await ref.create({ ...updates, seller_id: profile.id, created: now(), openTrades: [] });
    }
  } catch (error) {
    const current = (await ref.get()).data();
    if (current?.updated !== updates.updated && !keys.some(key => current?.images.includes(key))) {
      await Promise.allSettled(keys.map(key => deletePhoto(bucket, photoPath(ref.id, key))));
      throw error;
    }
  }
  if (keys.length && previous) await Promise.allSettled(previous.images.map(key => deletePhoto(bucket, photoPath(ref.id, key))));
  return { id: ref.id };
}

export async function listingAction(db, profile, id, request, moderating = false) {
  requireProfile(profile, !moderating);
  if (moderating) requireModerator(profile);
  const body = await jsonBody(request);
  const actions = moderating ? { approve: ['active', ['pending']], reject: ['rejected', ['pending']], remove: ['rejected', ['active']] } :
    { hide: ['hidden', ['active', 'pending']], submit: ['pending', ['hidden']] };
  const change = Object.hasOwn(actions, body.action) ? actions[body.action] : null;
  const ref = listingRef(db, id);
  return db.runTransaction(async tx => {
    const listing = docData(await tx.get(ref));
    need(listing && (moderating || listing.seller_id === profile.id), 404, 'Không tìm thấy tin đăng.');
    need(change?.[1].includes(listing.status), 409, 'Không thể chuyển tin đăng sang trạng thái này.');
    const [status] = change;
    const reason = status === 'rejected' ? textField(body.reason, 'Lý do kiểm duyệt', 5, 400) : '';
    tx.update(ref, { status, reason, updated: uid() });
    return { status };
  });
}

const savedListings = (db, id) => db.collection('profiles').doc(id).collection('saved');
export async function getSaved(db, profile) { return (await savedListings(db, profile.id).get()).docs.map(doc => doc.id); }
export async function changeSaved(db, profile, id, request) {
  const body = await jsonBody(request);
  need(typeof body.saved === 'boolean', 400, 'Thao tác lưu tin không hợp lệ.');
  const ref = savedListings(db, profile.id).doc(id);
  if (body.saved) {
    need(await getListing(db, id, null), 404, 'Không tìm thấy tin đăng.');
    await ref.set({ created: now() });
  } else await ref.delete();
  return { saved: body.saved };
}
