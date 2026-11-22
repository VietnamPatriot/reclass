import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { once } from 'node:events';
import { timingSafeEqual } from 'node:crypto';
import { connectFirebase, digest, HttpError, need, safeId } from './firebase.js';
import { claimModerator, editProfile, generateInvite, getSession, ownProfile, register, requireModerator, requireProfile,
  resetPassword, sessionCookie, signIn, signOut, verifyStudent } from './accounts.js';
import { activeListings, catalog, changeSaved, dashboardListings, getListing, getPhoto, getSaved, listingAction,
  moderationData, saveListing, sellerDetails } from './market.js';
import { checkedTrade, listTrades, makeReport, resolveReport, startTrade, tradeDetails, tradesFor, updateTrade } from './trades.js';

const publicDir = await realpath(fileURLToPath(new URL('../public/', import.meta.url)));
const pages = /^(?:\/|\/(?:kham-pha|da-luu|dang-nhap|dang-ky|gio-hang)|\/tai-khoan(?:\/(?:don-mua|don-ban|tin-dang|ho-so|danh-gia))?|\/(?:san-pham|gian-hang)\/[^/]+)$/;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });
const missing = () => new HttpError(404, 'Không tìm thấy chức năng.');
const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com"
};

function catalogFeed(db) {
  const clients = new Set();
  let version, unsubscribe;
  return (emit, close, last) => {
    const client = { emit, close, last };
    clients.add(client);
    if (version && version !== last) emit('change', version);
    unsubscribe ||= activeListings(db).onSnapshot(snapshot => {
      const current = digest(snapshot.docs.map(doc => `${doc.id}:${doc.get('updated')}`).sort().join('\n'));
      if (current === version) return;
      version = current;
      for (const client of clients) if (client.last !== current) client.emit('change', current);
    }, () => { for (const client of clients) client.close(); });
    return () => {
      clients.delete(client);
      if (!clients.size) { unsubscribe(); unsubscribe = undefined; version = undefined; }
    };
  };
}

const encode = new TextEncoder();
function stream(request, subscribe, session) {
  let close;
  const body = new ReadableStream({
    start(controller) {
      let closed = false;
      const cleanups = [];
      close = () => {
        if (closed) return;
        closed = true;
        for (const cleanup of cleanups) cleanup();
        controller.close();
      };
      const write = value => {
        if (closed) return;
        if (controller.desiredSize <= 0) { close(); return; }
        controller.enqueue(encode.encode(value));
      };
      const emit = (event, id) => write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: {}\n\n`);
      const disconnect = setTimeout(close, Math.min(50_000, (session?.expiresAt ?? Infinity) - Date.now()));
      const heartbeat = setInterval(() => write(': ping\n\n'), 15_000);
      const last = request.headers.get('Last-Event-ID');
      cleanups.push(() => clearTimeout(disconnect), () => clearInterval(heartbeat));
      const signal = request.signal;
      if (signal.aborted) { close(); return; }
      signal.addEventListener('abort', close, { once: true });
      cleanups.push(() => signal.removeEventListener('abort', close));
      write('retry: 1500\n\n');
      try {
        if (session) cleanups.push(session.ref.onSnapshot(doc => { if (!doc.exists) close(); }, close));
        cleanups.push(subscribe(emit, close, last));
      } catch { close(); }
    },
    cancel() { close(); }
  }, { highWaterMark: 8 });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'private, no-store, no-transform', 'X-Accel-Buffering': 'no' } });
}

async function staticFile(path, method) {
  const file = resolve(publicDir, '.' + (pages.test(path) ? '/index.html' : path));
  const type = types[extname(file)];
  need(type && file.startsWith(publicDir + sep), 404, 'Không tìm thấy trang.');
  const asset = await realpath(file).catch(() => null);
  need(asset?.startsWith(publicDir + sep), 404, 'Không tìm thấy trang.');
  const info = await stat(asset).catch(() => null);
  need(info?.isFile(), 404, 'Không tìm thấy trang.');
  return new Response(method === 'HEAD' ? null : Readable.toWeb(createReadStream(asset)), { headers: {
    'Content-Type': type, 'Content-Length': info.size, 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache'
  } });
}

function makeHandler(env) {
  const { db } = env;
  const watchCatalog = catalogFeed(db);
  return async (request, path, origin) => {
    const { method } = request;
    if (!/^\/(?:api|photos)(?:\/|$)/.test(path)) {
      need(['GET', 'HEAD'].includes(method), 405, 'Phương thức không hợp lệ.');
      return staticFile(path, method);
    }
    const [, root, resource, key, action] = path.split('/');
    need(path.split('/').length <= 5 && [resource, key, action].every(part => part === undefined || (safeId(part) || (root === 'photos' && /^[\w-]+\.jpg$/.test(part)))), 404, 'Không tìm thấy chức năng.');
    if (method === 'POST' && !key && root === 'api') {
      if (resource === 'register') return json(await register(env, request, origin), 201);
      if (resource === 'reset-password') return json(await resetPassword(env, request, origin));
      if (resource === 'login') {
        const { token, ...result } = await signIn(env, request, origin);
        return json(result, 200, token ? { 'Set-Cookie': sessionCookie(origin, token) } : {});
      }
      if (resource === 'logout') {
        await signOut(env, request, origin);
        return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(origin) });
      }
    }
    if (method === 'GET' && root === 'api') {
      if (resource === 'listings' && !key) return json(await catalog(db));
      if (resource === 'listings' && key === 'events' && !action) return stream(request, watchCatalog);
      if (resource === 'sellers' && key && !action) {
        const seller = await sellerDetails(db, key);
        need(seller, 404, 'Không tìm thấy gian hàng.');
        return json(seller);
      }
    }
    const session = await getSession(env, request, origin);
    const profile = session?.profile;
    if (root === 'photos') {
      if (method === 'GET' && resource && key && !action) return getPhoto(env, profile, resource, key);
      throw missing();
    }
    if (method === 'GET') {
      if (resource === 'session' && !key) return json({ signed: !!profile, profile: ownProfile(profile) });
      if (resource === 'listings' && key && !action) {
        const item = await getListing(db, key, profile);
        need(item, 404, 'Không tìm thấy tin đăng.');
        const seller = await sellerDetails(db, item.sellerId);
        need(seller, 404, 'Không tìm thấy gian hàng.');
        return json({ item, seller });
      }
    }
    requireProfile(profile);
    if (resource === 'trades' && method === 'GET' && key && action === 'events') {
      const { ref } = await checkedTrade(db, profile, key);
      return stream(request, (emit, close, previous) => ref.onSnapshot(doc => {
        if (!doc.exists) { close(); return; }
        const version = `${doc.updateTime.seconds}-${doc.updateTime.nanoseconds}`;
        if (version !== previous) emit('change', version);
      }, close), session);
    }
    if (resource === 'inbox' && !action && method === 'GET') {
      if (!key) return json(await listTrades(db, profile.id));
      if (key === 'events') return stream(request, (emit, close, previous) => tradesFor(db, profile.id).onSnapshot(snapshot => {
        const version = digest(snapshot.docs.map(doc => `${doc.id}:${doc.updateTime.seconds}:${doc.updateTime.nanoseconds}`).sort().join('\n'));
        if (version !== previous) emit('change', version);
      }, close), session);
    }
    if (resource === 'saved' && !action) {
      if (method === 'GET' && !key) return json(await getSaved(db, profile));
      if (method === 'POST' && key) return json(await changeSaved(db, profile, key, request));
    }
    if (method === 'POST') {
      if (resource === 'profile' && !key) return json(await editProfile(db, profile, request));
      if (resource === 'verify' && !key) return json(await verifyStudent(db, profile, request));
      if (resource === 'listings' && !action) return json(await saveListing(env, profile, request, key));
      if (resource === 'listings' && key && action === 'status') return json(await listingAction(db, profile, key, request));
      if (resource === 'trades' && !action) return json(key ? await updateTrade(db, profile, key, request) : await startTrade(db, profile, request));
      if (resource === 'reports' && !key) return json(await makeReport(db, profile, request));
    }
    if (resource === 'trades' && method === 'GET' && key && !action) return json(await tradeDetails(db, profile, key));
    if (resource === 'dashboard' && method === 'GET' && !key) {
      const [listings, trades] = await Promise.all([dashboardListings(db, profile), listTrades(db, profile.id)]);
      return json({ listings, trades });
    }
    if (resource === 'moderation') {
      if (key === 'claim' && !action && method === 'POST') return json(await claimModerator(env, profile, request));
      requireModerator(profile);
      if (!key && method === 'GET') return json(await moderationData(db));
      if (key === 'invite' && !action && method === 'POST') return json(await generateInvite(db, profile, request));
      if (key === 'listings' && action && method === 'POST') return json(await listingAction(db, profile, action, request, true));
      if (key === 'reports' && action && method === 'POST') return json(await resolveReport(db, profile, action, request));
    }
    throw missing();
  };
}

async function readBody(req, maxBytes) {
  need(Number(req.headers['content-length'] || 0) <= maxBytes, 413, 'Dữ liệu gửi lên quá lớn.');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    need(bytes <= maxBytes, 413, 'Dữ liệu gửi lên quá lớn.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

export function createApp(env, origins) {
  const handle = makeHandler(env);
  const proxySecret = env.proxySecret && Buffer.from(digest(env.proxySecret));
  return createServer({ requestTimeout: 25_000, headersTimeout: 15_000 }, async (req, res) => {
    const connection = new AbortController();
    res.once('close', () => connection.abort());
    let response;
    try {
      if (proxySecret) need(timingSafeEqual(proxySecret, Buffer.from(digest(String(req.headers['x-reclass-proxy'] || '')))), 404, 'Không tìm thấy trang.');
      need(req.url.startsWith('/') && !req.url.startsWith('//'), 400, 'Đường dẫn không hợp lệ.');
      const url = new URL(req.url, origins[0]);
      let path;
      try { path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'; }
      catch { throw new HttpError(400, 'Đường dẫn không hợp lệ.'); }
      need(!/%2f|%5c/i.test(url.pathname) && !path.includes('\\') && !path.includes('\0') && !path.split('/').some(part => part === '..' || part === '.'), 400, 'Đường dẫn không hợp lệ.');
      const isApi = /^\/(?:api|photos)(?:\/|$)/.test(path);
      if (isApi) need(!['cross-site', 'same-site'].includes(req.headers['sec-fetch-site']), 403, 'Chỉ có thể gửi yêu cầu từ RE:CLASS.');
      const method = req.method;
      need(['GET', 'HEAD', 'POST'].includes(method), 405, 'Phương thức không hợp lệ.');
      let origin = origins[0];
      let body;
      if (method === 'POST') {
        need(isApi && origins.includes(req.headers.origin), 403, 'Chỉ có thể gửi yêu cầu từ RE:CLASS.');
        origin = req.headers.origin;
        const mediaType = req.headers['content-type']?.split(';')[0];
        need(['multipart/form-data', 'application/json'].includes(mediaType), 415, 'Định dạng yêu cầu không hợp lệ.');
        body = await readBody(req, mediaType === 'multipart/form-data' ? 4_700_000 : 32_000);
      }
      const request = new Request(url, { method, headers: req.headers, signal: connection.signal, ...(body && { body }) });
      response = await handle(request, path, origin);
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('RE:CLASS request failed', { type: error.name, code: error.code });
      if (!req.complete) { res.setHeader('Connection', 'close'); req.resume(); }
      response = json({ error: error instanceof HttpError ? error.message : 'Có lỗi xảy ra. Hãy thử lại.' }, error instanceof HttpError ? error.status : 500);
    }
    if (res.destroyed) { await response.body?.cancel(); return; }
    for (const [key, value] of Object.entries(security)) res.setHeader(key, value);
    if (origins[0].startsWith('https:')) res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    for (const [key, value] of response.headers) res.setHeader(key, value);
    res.statusCode = response.status;
    if (response.body && req.method !== 'HEAD') {
      res.flushHeaders();
      try { await pipeline(Readable.fromWeb(response.body), res); }
      catch (error) { if (!res.destroyed) res.destroy(error); }
    } else { await response.body?.cancel(); res.end(); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || process.env.RECLASS_PORT || 4173);
  const origins = (process.env.RECLASS_ORIGINS || `http://127.0.0.1:${port}`).split(',').map(value => value.trim());
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && origins.length === 1 && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && process.env.NODE_ENV !== 'production'))) {
      throw new Error('RECLASS_ORIGINS must contain exact HTTPS origins. Local development may use one HTTP loopback origin.');
    }
  }
  const env = connectFirebase(process.env);
  env.proxySecret = process.env.RECLASS_PROXY_SECRET;
  if (env.proxySecret && env.proxySecret.length < 32) throw new Error('RECLASS_PROXY_SECRET must contain at least 32 characters.');
  const server = createApp(env, origins).listen(port, process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'));
  await once(server, 'listening');
  console.log(`RE:CLASS listening on port ${port} (${origins[0]})`);
}
