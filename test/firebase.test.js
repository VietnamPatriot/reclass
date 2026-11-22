import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import sharp from 'sharp';
import { connectFirebase } from '../server/firebase.js';
import { createApp } from '../server/index.js';
import { schools } from '../public/catalog/data.js';
import { catalogTagFilters, moreTags } from '../public/views.js';
import worker from '../server/sites.js';

test('tag popups retain all options and add another + Thêm at 30 tags', () => {
  const entries = Array.from({ length: 75 }, (_, index) => `tag-${index}`);
  const markup = moreTags(entries, tag => `<b>${tag}</b>`);
  assert.equal(markup.match(/<summary/g).length, 3);
  assert.equal(moreTags(entries.slice(0, 30), String).match(/<summary/g).length, 2);
  assert.deepEqual([...markup.matchAll(/<b>(tag-\d+)<\/b>/g)].map(match => match[1]), entries);
  assert.match(catalogTagFilters('', ''), /<summary/);
});

test('the Sites Worker forwards the Reclass cookie and strips platform credentials', async t => {
  const session = '__Host-reclass-session=' + 'a'.repeat(43);
  const env = { RECLASS_BACKEND_URL: 'https://backend.example', RECLASS_PROXY_SECRET: 'a synthetic test secret' };
  const fetch = t.mock.method(globalThis, 'fetch', async (target, options) => {
    assert.equal(target.href, 'https://backend.example/api/trades/example/events');
    assert.equal(options.headers.get('Cookie'), session);
    assert.equal(options.headers.get('Authorization'), null);
    assert.equal(options.headers.get('oai-authenticated-user-id'), null);
    assert.equal(options.headers.get('X-Reclass-Proxy'), env.RECLASS_PROXY_SECRET);
    assert.equal(options.headers.get('Last-Event-ID'), '2');
    assert.equal(options.redirect, 'manual');
    return new Response('event: change\ndata: {}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  });
  const request = new Request('https://site.example/api/trades/example/events', { headers: {
    Cookie: 'platform=session; ' + session, Authorization: 'Bearer synthetic', 'oai-authenticated-user-id': 'synthetic', 'Last-Event-ID': '2'
  } });
  assert.equal((await worker.fetch(request, {})).status, 503);
  assert.equal((await worker.fetch(request, env)).headers.get('Content-Type'), 'text/event-stream');
  assert.equal(fetch.mock.callCount(), 1);
});

Object.assign(process.env, {
  FIREBASE_PROJECT_ID: 'demo-reclass', FIREBASE_STORAGE_BUCKET: 'demo-reclass.appspot.com', FIREBASE_WEB_API_KEY: 'demo-key',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199'
});

async function eventReader(url, cookie) {
  const abort = new AbortController();
  const response = await fetch(url, { headers: cookie ? { Cookie: cookie } : {}, signal: abort.signal });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/event-stream/);
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  return {
    close: () => abort.abort(),
    async change() {
      const timeout = setTimeout(() => abort.abort(), 10_000);
      try {
        for (;;) {
          const end = buffer.indexOf('\n\n');
          if (end >= 0) {
            const event = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            if (event.includes('event: change')) return;
            continue;
          }
          const part = await reader.read();
          assert.ok(!part.done, 'live feed closed before next change');
          buffer += part.value;
        }
      } finally { clearTimeout(timeout); }
    }
  };
}

test('Firebase accounts, marketplace, saved listings and chat enforce server access across sessions', { timeout: 75_000 }, async t => {
  const env = connectFirebase(process.env);
  const origins = [];
  const server = createApp(env, origins).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  origins.push(origin);
  const streams = [];
  const streamConnections = new Set();
  server.on('request', (request, response) => {
    if (!request.url.endsWith('/events')) return;
    const closed = once(response, 'close');
    streamConnections.add(closed);
    closed.then(() => streamConnections.delete(closed));
  });
  t.after(async () => {
    streams.forEach(stream => stream.close());
    await Promise.all(streamConnections);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await env.db.terminate();
  });

  const request = (path, { data, cookie, headers = {} } = {}) => fetch(origin + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(data !== undefined && { Origin: origin, ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }),
      ...headers
    },
    body: data === undefined || data instanceof FormData ? data : JSON.stringify(data)
  });
  const json = async (path, options, status = 200) => {
    const response = await request(path, options);
    const result = await response.json();
    assert.equal(response.status, status, `${path}: ${JSON.stringify(result)}`);
    return result;
  };
  const authBase = 'http://127.0.0.1:9099';
  const identityApi = async (op, data) => {
    const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:${op}?key=demo-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    assert.equal(response.status, 200, op);
    return response.json();
  };
  const oobCodes = async () => (await (await fetch(`${authBase}/emulator/v1/projects/demo-reclass/oobCodes`)).json()).oobCodes;
  const password = 'Only a synthetic test password 5412!';
  const jpeg = await sharp({ create: { width: 30, height: 40, channels: 3, background: 'white' } }).jpeg().toBuffer();
  const samplePhoto = new File([jpeg], 'sample.jpg', { type: 'image/jpeg' });
  function registration(email, name) {
    const form = new FormData();
    for (const [key, value] of Object.entries({ email, name, password, school: schools[0], fullName: 'Private Test Name', birthDate: '2008-06-15', phone: '0900000000', studentNumber: 'TEST-0000', identityPhoto: samplePhoto })) form.append(key, value);
    return form;
  }
  const login = async email => {
    const response = await request('/api/login', { data: { email, password } });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    const header = response.headers.get('set-cookie');
    assert.match(header, /; HttpOnly; SameSite=Lax; Max-Age=604800/);
    assert.doesNotMatch(JSON.stringify(result), /Private Test Name|TEST-0000|password|token|photoPath/);
    return { cookie: header.split(';')[0], id: result.profile.id, email };
  };
  const suffix = Date.now();
  const newUser = async name => {
    const email = `${name.toLowerCase()}-${suffix}@example.test`;
    const response = await json('/api/register', { data: registration(email, name) }, 201);
    assert.deepEqual(response, { ok: true });
    await json('/api/login', { data: { email, password } }, 403);
    const code = (await oobCodes()).find(item => item.email === email && item.requestType === 'VERIFY_EMAIL');
    assert.ok(code?.oobCode, 'registration sends an email verification link');
    await identityApi('update', { oobCode: code.oobCode });
    return login(email);
  };

  assert.equal((await request('/')).status, 200);
  assert.equal((await request('/.env')).status, 404);
  assert.deepEqual(await json('/api/session', { headers: { 'oai-authenticated-user-id': 'moderator' } }), { signed: false, profile: null });
  await json('/api/logout', { data: {}, headers: { Origin: 'https://untrusted.example' } }, 403);
  await json('/api/logout', { data: {}, headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403);
  await json('/api/login', { data: { password: 'x'.repeat(34_000) } }, 413);
  await json('/api/reset-password', { data: { email: `missing-${suffix}@example.test` } });
  for (const key of ['fullName', 'birthDate', 'phone', 'studentNumber', 'identityPhoto']) {
    const form = registration(`invalid-${suffix}@example.test`, 'Invalid');
    form.delete(key);
    await json('/api/register', { data: form }, 400);
  }
  const badPhoto = registration(`bad-photo-${suffix}@example.test`, 'Invalid');
  badPhoto.set('identityPhoto', new File(['<svg onload="alert(1)"/>'], 'fake.jpg', { type: 'image/jpeg' }));
  await json('/api/register', { data: badPhoto }, 400);

  const seller = await newUser('Seller');
  const buyer = await newUser('Buyer');
  const outsider = await newUser('Outsider');
  const device = await login(buyer.email);
  assert.equal(device.id, buyer.id);
  assert.notEqual(device.cookie, buyer.cookie);
  const privateData = (await env.db.collection('privateAccounts').doc(seller.id).get()).data();
  assert.equal(privateData.fullName, 'Private Test Name');
  assert.equal(privateData.birthDate, '2008-06-15');
  assert.equal(privateData.phone, '0900000000');
  assert.equal(privateData.studentNumber, 'TEST-0000');
  assert.ok((await env.bucket.file(privateData.photoPath).exists())[0]);
  const { idToken } = await identityApi('signInWithPassword', { email: seller.email, password, returnSecureToken: true });
  const authHeaders = { Authorization: `Bearer ${idToken}` };
  for (const doc of [`profiles/${seller.id}`, `privateAccounts/${seller.id}`]) {
    const url = `http://127.0.0.1:8080/v1/projects/demo-reclass/databases/(default)/documents/${doc}`;
    assert.equal((await fetch(url, { headers: authHeaders })).status, 403);
    assert.equal((await fetch(url, { headers: authHeaders, method: 'PATCH', body: '{"fields":{}}' })).status, 403);
  }
  const storage = `http://127.0.0.1:9199/v0/b/demo-reclass.appspot.com/o/${encodeURIComponent(privateData.photoPath)}?alt=media`;
  assert.equal((await fetch(storage, { headers: authHeaders })).status, 403);
  assert.equal((await request(`/photos/${seller.id}/${privateData.photoPath.split('/').at(-1)}`, { cookie: seller.cookie })).status, 404);
  await json('/api/moderation', { cookie: outsider.cookie }, 403);
  await json('/api/profile', { cookie: outsider.cookie, data: { name: 'Outsider', shop: 'Test Shop', bio: '', verified: true, moderator: true } });
  await json('/api/moderation', { cookie: outsider.cookie }, 403);
  await env.db.collection('profiles').doc(outsider.id).update({ moderator: true });
  for (const member of [seller, buyer, outsider]) {
    const invite = await json('/api/moderation/invite', { cookie: outsider.cookie, data: { school: schools[0] } });
    assert.equal((await json('/api/verify', { cookie: member.cookie, data: { code: invite.code } })).verified, true);
  }

  const catalogFeed = await eventReader(origin + '/api/listings/events');
  streams.push(catalogFeed);
  await catalogFeed.change();
  const listing = new FormData();
  for (const [key, value] of Object.entries({ title: 'Synthetic test textbook', category: 'sach', condition: 'Còn tốt', price: '12000', description: 'A synthetic book in good condition.', delivery: 'Meet near the school library.', tags: 'toan', photos: samplePhoto })) listing.append(key, value);
  const { id } = await json('/api/listings', { cookie: seller.cookie, data: listing });
  await json('/api/listings/' + id, { cookie: buyer.cookie }, 404);
  const pending = await json('/api/listings/' + id, { cookie: seller.cookie });
  assert.deepEqual(pending.item.tags, ['toan']);
  assert.equal((await request(pending.item.images[0])).status, 404);
  await json('/api/moderation/listings/' + id, { cookie: outsider.cookie, data: { action: 'approve' } });
  await catalogFeed.change();
  assert.ok((await json('/api/listings')).some(item => item.id === id && item.tags.includes('toan')));
  assert.equal((await request(pending.item.images[0])).status, 200);
  await json('/api/saved/' + id, { cookie: buyer.cookie, data: { saved: true } });
  assert.deepEqual(await json('/api/saved', { cookie: device.cookie }), [id]);

  const inbox = await eventReader(origin + '/api/inbox/events', seller.cookie);
  streams.push(inbox);
  await inbox.change();
  const started = await Promise.all([buyer, device].map(member => json('/api/trades', { cookie: member.cookie, data: { listingId: id } })));
  const tradeId = started[0].id;
  assert.equal(started[1].id, tradeId);
  await inbox.change();
  assert.equal((await json('/api/inbox', { cookie: seller.cookie }))[0].id, tradeId);
  const tradePath = '/api/trades/' + tradeId;
  await json(tradePath, { cookie: outsider.cookie }, 404);
  await json(tradePath + '/events', { cookie: outsider.cookie }, 404);
  await json(tradePath, { cookie: outsider.cookie, data: { action: 'message', text: 'Access denied' } }, 404);
  const chat = await eventReader(origin + tradePath + '/events', seller.cookie);
  streams.push(chat);
  await chat.change();
  const data = { action: 'message', text: '<b>Synthetic chat</b>', messageId: 'same-request' };
  await json(tradePath, { cookie: device.cookie, data });
  await chat.change();
  await json(tradePath, { cookie: buyer.cookie, data });
  const seen = await json(tradePath, { cookie: seller.cookie });
  assert.equal(seen.messages.length, 1);
  assert.equal(seen.messages[0].body, data.text);
  await Promise.all([seller, buyer].map(member => json(tradePath, { cookie: member.cookie, data: { action: 'confirm' } })));
  assert.equal((await json(tradePath, { cookie: device.cookie })).trade.status, 'completed');
  await catalogFeed.change();
  assert.ok(!(await json('/api/listings')).some(item => item.id === id));
  await json('/api/logout', { data: {}, cookie: buyer.cookie });
  assert.deepEqual(await json('/api/session', { cookie: buyer.cookie }), { signed: false, profile: null });
  assert.equal((await json('/api/session', { cookie: device.cookie })).profile.id, buyer.id);
  const productionOrigin = 'https://reclass.example';
  origins.unshift(productionOrigin);
  const secureLogin = await request('/api/login', { data: { email: buyer.email, password }, headers: { Origin: productionOrigin } });
  assert.equal(secureLogin.status, 200);
  assert.match(secureLogin.headers.get('set-cookie'), /^__Host-reclass-session=.+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=604800; Secure$/);
  assert.equal(secureLogin.headers.get('strict-transport-security'), 'max-age=31536000');
});
