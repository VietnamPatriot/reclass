// Keep the existing Sites audience and forward application traffic to the Node server.
export default {
  async fetch(request, env) {
    let target;
    try { target = new URL(env.RECLASS_BACKEND_URL); } catch {}
    if (!target || target.protocol !== 'https:' || target.href !== target.origin + '/' || !env.RECLASS_PROXY_SECRET) {
      return new Response('RE:CLASS chưa kết nối máy chủ.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    const url = new URL(request.url);
    target.pathname = url.pathname;
    target.search = url.search;
    const headers = new Headers({ 'X-Reclass-Proxy': env.RECLASS_PROXY_SECRET });
    for (const name of ['Accept', 'Content-Type', 'Origin', 'Sec-Fetch-Site', 'Last-Event-ID']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const session = request.headers.get('Cookie')?.match(/(?:^|;\s*)(__Host-reclass-session=[\w-]{43})(?:;|$)/)?.[1];
    if (session) headers.set('Cookie', session);
    return fetch(target, { method: request.method, headers, body: request.body, redirect: 'manual' });
  }
};
