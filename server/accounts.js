import { randomBytes, timingSafeEqual } from 'node:crypto';
import { deletePhoto, digest, formBody, get, HttpError, jsonBody, need, now, putPhoto, cleanPhoto, safeId, textField, uid } from './firebase.js';
import { schools } from '../public/catalog/data.js';

const sessionSeconds = 7 * 24 * 3600;
const invalidLogin = 'Email hoặc mật khẩu không đúng.';
export const profileRef = (db, id) => db.collection('profiles').doc(id);
export const getProfile = (db, id) => get(profileRef(db, id));
export const publicProfile = row => ({ id: row.id, name: row.name, school: row.school, shop: row.shop, bio: row.bio, verified: !!row.verified });
export const ownProfile = row => row ? { ...publicProfile(row), moderator: !!row.moderator } : null;
export function requireProfile(profile, verified = false) {
  need(profile, 401, 'Hãy đăng nhập để tiếp tục.');
  if (verified) need(profile.verified, 403, 'Bạn cần xác minh tư cách học sinh để tiếp tục.');
}
export const requireModerator = profile => need(profile?.moderator, 403, 'Chức năng dành cho người kiểm duyệt.');

export async function rateLimit(db, scope, key, max, seconds) {
  const ref = db.collection('rateLimits').doc(digest(`${scope}\n${key}`));
  await db.runTransaction(async tx => {
    const limit = (await tx.get(ref)).data();
    const current = Date.now();
    const expiresAt = limit?.expiresAt.toMillis() > current ? limit.expiresAt.toDate() : new Date(current + seconds * 1000);
    const count = limit?.expiresAt.toMillis() > current ? limit.count : 0;
    need(count < max, 429, 'Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau.');
    tx.set(ref, { count: count + 1, expiresAt });
  });
}

function emailField(data) {
  const email = textField(data.email, 'Email', 3, 254).toLowerCase();
  need(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 400, 'Hãy nhập email hợp lệ.');
  return email;
}

async function authRequest(env, action, data) {
  const url = new URL(`./accounts:${action}`, env.authUrl);
  url.searchParams.set('key', env.apiKey);
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Firebase-Locale': 'vi' },
    body: JSON.stringify(data), signal: AbortSignal.timeout(12_000)
  });
  const payload = await response.json();
  if (!response.ok) {
    const code = payload.error?.message;
    if (['INVALID_LOGIN_CREDENTIALS', 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD', 'USER_DISABLED'].includes(code)) throw new HttpError(401, invalidLogin);
    if (response.status === 429 || code === 'TOO_MANY_ATTEMPTS_TRY_LATER') throw new HttpError(429, 'Bạn đã gửi quá nhiều yêu cầu. Hãy thử lại sau.');
    throw new HttpError(503, 'Dịch vụ xác thực chưa phản hồi. Hãy thử lại sau.');
  }
  return payload;
}

function cookieName(origin) { return origin.startsWith('https:') ? '__Host-reclass-session' : 'reclass-session'; }
export function sessionCookie(origin, token = '') {
  const secure = origin.startsWith('https:');
  return `${cookieName(origin)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? sessionSeconds : 0}${secure ? '; Secure' : ''}`;
}

function sessionRef(db, request, origin) {
  const name = cookieName(origin) + '=';
  const cookie = request.headers.get('Cookie')?.split(';').map(value => value.trim()).find(value => value.startsWith(name));
  const token = cookie?.slice(name.length);
  return token && /^[\w-]{43}$/.test(token) ? db.collection('sessions').doc(digest(token)) : null;
}
export async function getSession(env, request, origin) {
  const ref = sessionRef(env.db, request, origin);
  if (!ref) return null;
  const stored = (await ref.get()).data();
  if (!stored || stored.expiresAt.toMillis() <= Date.now()) return null;
  let user;
  try { user = await env.auth.getUser(stored.uid); }
  catch (error) { if (error.code === 'auth/user-not-found') return null; throw error; }
  if (user.disabled || !user.emailVerified || Date.parse(user.tokensValidAfterTime) > stored.authTime * 1000) return null;
  const profile = await getProfile(env.db, stored.uid);
  return profile ? { profile, ref, expiresAt: stored.expiresAt.toMillis() } : null;
}

export async function signOut(env, request, origin) {
  await sessionRef(env.db, request, origin)?.delete();
}

export async function signIn(env, request, origin) {
  const data = await jsonBody(request);
  const email = emailField(data);
  const password = typeof data.password === 'string' ? data.password : '';
  need(password && password.length <= 128, 401, invalidLogin);
  const resend = data.resend === true;
  await rateLimit(env.db, resend ? 'resend' : 'login', email, resend ? 3 : 12, 900);
  const { idToken } = await authRequest(env, 'signInWithPassword', { email, password, returnSecureToken: true });
  const claims = await env.auth.verifyIdToken(idToken, true);
  const profile = safeId(claims.uid) && await getProfile(env.db, claims.uid);
  need(profile, 401, invalidLogin);
  if (resend) {
    if (!claims.email_verified) await sendVerification(env, idToken, origin);
    return { verificationSent: true };
  }
  need(claims.email_verified, 403, 'Hãy xác nhận email bằng liên kết đã gửi trước khi đăng nhập.');
  const token = randomBytes(32).toString('base64url');
  const batch = env.db.batch();
  const previous = sessionRef(env.db, request, origin);
  if (previous) batch.delete(previous);
  batch.create(env.db.collection('sessions').doc(digest(token)), {
    uid: claims.uid, authTime: claims.auth_time, expiresAt: new Date(Date.now() + sessionSeconds * 1000)
  });
  await batch.commit();
  return { token, profile: ownProfile(profile) };
}

function sendVerification(env, idToken, origin) {
  return authRequest(env, 'sendOobCode', { requestType: 'VERIFY_EMAIL', idToken, continueUrl: `${origin}/` });
}

export async function resetPassword(env, request, origin) {
  const email = emailField(await jsonBody(request));
  await rateLimit(env.db, 'reset', email, 3, 900);
  try { await authRequest(env, 'sendOobCode', { requestType: 'PASSWORD_RESET', email, continueUrl: `${origin}/` }); }
  catch (error) { if (!(error instanceof HttpError) || error.status !== 401) throw error; }
  return { ok: true };
}

export async function register(env, request, origin) {
  const form = await formBody(request);
  const value = name => form.get(name);
  const email = emailField({ email: value('email') });
  const password = value('password');
  need(typeof password === 'string' && password.length >= 12 && password.length <= 128, 400, 'Mật khẩu cần từ 12 đến 128 ký tự.');
  const fullName = textField(value('fullName'), 'Họ và tên', 2, 100);
  const name = textField(value('name'), 'Tên hiển thị', 2, 45);
  const school = value('school');
  need(schools.includes(school), 400, 'Hãy chọn trường THPT tham gia thử nghiệm.');
  const birthDate = value('birthDate');
  const date = new Date(typeof birthDate === 'string' ? birthDate + 'T00:00:00Z' : NaN);
  need(/^\d{4}-\d{2}-\d{2}$/.test(birthDate) && Number.isFinite(+date) && date.toISOString().slice(0, 10) === birthDate && birthDate >= '1900-01-01' && birthDate <= now().slice(0, 10), 400, 'Hãy nhập ngày tháng năm sinh hợp lệ.');
  const phone = textField(value('phone'), 'Số điện thoại', 8, 25).replace(/[\s.()-]/g, '');
  need(/^\+?\d{8,15}$/.test(phone), 400, 'Hãy nhập số điện thoại hợp lệ.');
  const studentNumber = textField(value('studentNumber'), 'Mã số học sinh', 1, 50);
  need(/^[\p{L}\p{N}][\p{L}\p{N} ._/-]*$/u.test(studentNumber), 400, 'Hãy nhập mã số học sinh hợp lệ.');
  need(form.getAll('identityPhoto').length === 1, 400, 'Hãy chọn một ảnh giấy tờ tùy thân.');
  await rateLimit(env.db, 'register', email, 5, 3600);
  const photo = await cleanPhoto(value('identityPhoto'), 4_000_000);
  const id = uid();
  const photoPath = `identity/${id}/${uid()}.jpg`;
  try { await env.auth.createUser({ uid: id, email, password }); }
  catch (error) {
    // Keep the registration response the same for an email that already exists.
    if (error.code === 'auth/email-already-exists') return { ok: true };
    if (error.code === 'auth/invalid-email') throw new HttpError(400, 'Hãy nhập email hợp lệ.');
    throw error;
  }
  const profile = profileRef(env.db, id);
  try {
    await putPhoto(env.bucket, photoPath, photo);
    const batch = env.db.batch();
    batch.create(profile, { name, school, shop: `Gian hàng ${name}`, bio: '', verified: false, moderator: false });
    batch.create(env.db.collection('privateAccounts').doc(id), { fullName, birthDate, phone, studentNumber, photoPath, created: now() });
    await batch.commit();
  } catch (error) {
    // A failed response can follow a successful commit. Confirm before deleting its dependencies.
    if (!(await profile.get()).exists) {
      await Promise.allSettled([deletePhoto(env.bucket, photoPath), env.auth.deleteUser(id)]);
      throw error;
    }
  }
  try {
    const { idToken } = await authRequest(env, 'signInWithPassword', { email, password, returnSecureToken: true });
    await sendVerification(env, idToken, origin);
  } catch {
    // The sign-in form can resend the link without repeating the identity upload.
  }
  return { ok: true };
}

export async function editProfile(db, profile, request) {
  const body = await jsonBody(request);
  const updates = {
    name: textField(body.name, 'Tên hiển thị', 2, 45),
    shop: textField(body.shop, 'Tên gian hàng', 2, 65),
    bio: textField(body.bio, 'Giới thiệu', 0, 350)
  };
  const ref = profileRef(db, profile.id);
  return db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    const changes = { ...updates };
    if (!current.verified && body.school !== undefined) {
      need(schools.includes(body.school), 400, 'Hãy chọn trường THPT tham gia thử nghiệm.');
      changes.school = body.school;
    }
    tx.update(ref, changes);
    return ownProfile({ ...current, ...changes, id: profile.id });
  });
}

export async function verifyStudent(db, profile, request) {
  await rateLimit(db, 'verify', profile.id, 12, 900);
  const body = await jsonBody(request);
  const ref = profileRef(db, profile.id);
  const invite = db.collection('invites').doc(digest(textField(body.code, 'Mã xác minh', 8, 50).toUpperCase()));
  return db.runTransaction(async tx => {
    const [user, code] = (await tx.getAll(ref, invite)).map(snapshot => snapshot.data());
    need(!user.verified, 409, 'Hồ sơ đã được xác minh.');
    need(code && !code.usedBy && code.school === user.school && code.expiresAt.toMillis() > Date.now(), 400, 'Mã không hợp lệ, đã dùng, đã hết hạn hoặc khác trường.');
    tx.update(invite, { usedBy: profile.id });
    tx.update(ref, { verified: true });
    return ownProfile({ ...user, id: profile.id, verified: true });
  });
}

export async function generateInvite(db, profile, request) {
  requireModerator(profile);
  const { school } = await jsonBody(request);
  need(schools.includes(school), 400, 'Hãy chọn một trường.');
  const code = 'RC-' + randomBytes(12).toString('hex').toUpperCase();
  await db.collection('invites').doc(digest(code)).create({ school, expiresAt: new Date(Date.now() + sessionSeconds * 1000) });
  return { code, school };
}

export async function claimModerator(env, profile, request) {
  need(env.moderatorCode?.length >= 32, 503, 'Chưa cấu hình quyền kiểm duyệt.');
  await rateLimit(env.db, 'moderator', profile.id, 5, 3600);
  const { code } = await jsonBody(request);
  const supplied = digest(textField(code, 'Mã quản trị', 8, 100));
  need(timingSafeEqual(Buffer.from(supplied), Buffer.from(digest(env.moderatorCode))), 403, 'Mã quản trị không đúng.');
  await profileRef(env.db, profile.id).update({ moderator: true });
  return ownProfile(await getProfile(env.db, profile.id));
}
