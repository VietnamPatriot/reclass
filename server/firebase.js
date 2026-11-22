import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function need(condition, status, message) {
  if (!condition) throw new HttpError(status, message);
}
export const uid = randomUUID;
export const digest = value => createHash('sha256').update(value).digest('hex');
export const now = () => new Date().toISOString();
export const safeId = value => typeof value === 'string' && /^[\w-]{1,128}$/.test(value) && !value.startsWith('__');
export const docData = snapshot => snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
export const records = snapshot => snapshot.docs.map(docData);
export const get = async ref => docData(await ref.get());

export function textField(value, label, min, max) {
  const text = typeof value === 'string' ? value.trim() : '';
  need(text.length >= min && text.length <= max, 400, `${label} cần từ ${min} đến ${max} ký tự.`);
  return text;
}
export async function jsonBody(request) {
  let data;
  try { data = await request.json(); } catch { throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ.'); }
  need(data && typeof data === 'object' && !Array.isArray(data), 400, 'Dữ liệu gửi lên không hợp lệ.');
  return data;
}
export async function formBody(request) {
  need(request.headers.get('content-type')?.startsWith('multipart/form-data;'), 415, 'Yêu cầu phải có biểu mẫu tải ảnh.');
  try { return await request.formData(); } catch { throw new HttpError(400, 'Biểu mẫu tải ảnh không hợp lệ.'); }
}

export function connectFirebase(env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const storageBucket = env.FIREBASE_STORAGE_BUCKET;
  const emulators = [env.FIREBASE_AUTH_EMULATOR_HOST, env.FIRESTORE_EMULATOR_HOST, env.FIREBASE_STORAGE_EMULATOR_HOST];
  const local = emulators.every(Boolean);
  if (!projectId || !storageBucket || !env.FIREBASE_WEB_API_KEY) throw new Error('Configure FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET and FIREBASE_WEB_API_KEY.');
  if ((emulators.some(Boolean) || env.STORAGE_EMULATOR_HOST) && (!local || !projectId.startsWith('demo-') || env.NODE_ENV === 'production')) {
    throw new Error('Use all three emulators with a demo- project outside production.');
  }
  if (local) {
    process.env.GCLOUD_PROJECT ||= projectId;
    process.env.METADATA_SERVER_DETECTION ||= 'none';
  }
  const app = initializeApp({ projectId, storageBucket, ...(local ? {} : { credential: applicationDefault() }) });
  return {
    db: getFirestore(app), auth: getAuth(app), bucket: getStorage(app).bucket(),
    authUrl: local ? `http://${env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/` : 'https://identitytoolkit.googleapis.com/v1/',
    apiKey: env.FIREBASE_WEB_API_KEY, moderatorCode: env.MODERATOR_CODE
  };
}

export async function cleanPhoto(file, maxBytes) {
  need(file instanceof File && file.size > 0 && file.size <= maxBytes, 400, 'Hãy chọn ảnh có dung lượng hợp lệ.');
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000, failOn: 'error' });
    const { format, pages } = await input.metadata();
    need(['jpeg', 'png', 'webp'].includes(format) && (pages ?? 1) === 1, 400, 'Hãy chọn ảnh JPEG, PNG hoặc WebP tĩnh.');
    return await input.rotate().resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Tệp ảnh không hợp lệ hoặc kích thước ảnh quá lớn.');
  }
}

export function putPhoto(bucket, path, bytes) {
  return bucket.file(path).save(bytes, {
    resumable: false,
    preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' }
  });
}
export const deletePhoto = (bucket, path) => bucket.file(path).delete({ ignoreNotFound: true });
