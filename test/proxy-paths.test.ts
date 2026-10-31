import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeRoutes } from '../src/lib/proxy';

test('relay preserves decoded route segments as exact upstream identifiers, not extra routes or query parameters', async () => {
  const nativeFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    requests.push(url); assert.equal(init?.method, 'GET');
    return Response.json({ ok: true });
  };
  try {
    for (const [prefix, parts, encoded] of [
      ['/api', ['benchmarks', 'qa/prefix'], '/api/benchmarks/qa%2Fprefix'],
      ['/api', ['patches', 'id?filter=other#part'], '/api/patches/id%3Ffilter%3Dother%23part'],
      ['/api', ['patches', 'literal%2Fvalue'], '/api/patches/literal%252Fvalue'],
      ['/agents', ['space 한글', 'card'], '/agents/space%20%ED%95%9C%EA%B8%80/card'],
      ['/git', ['repo.git', 'info', 'refs'], '/git/repo.git/info/refs'],
      ['/svc', ['project', 'assets', 'file name.js'], '/svc/project/assets/file%20name.js'],
    ] as const) {
      const reply = await nodeRoutes(prefix).GET(new Request(`https://ainize.test${encoded}?limit=20&name=a%2Fb`), { params: Promise.resolve({ path: [...parts] }) });
      assert.equal(reply.status, 200);
      const target = new URL(requests.at(-1)!);
      assert.equal(target.pathname, encoded); assert.equal(target.search, '?limit=20&name=a%2Fb'); assert.equal(target.hash, '');
    }
  } finally { globalThis.fetch = nativeFetch; }
});

test('relay retains a literal percent and a root route without double decoding them', async () => {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const target = new URL(String(input));
    assert.ok(['/api/', '/api/patches/100%25'].includes(target.pathname));
    return new Response('upstream unavailable', { status: 503 });
  };
  try {
    assert.equal((await nodeRoutes('/api').GET(new Request('https://ainize.test/api/'), { params: Promise.resolve({}) })).status, 503);
    assert.equal((await nodeRoutes('/api').GET(new Request('https://ainize.test/api/patches/100%25'), { params: Promise.resolve({ path: ['patches', '100%'] }) })).status, 503);
  } finally { globalThis.fetch = nativeFetch; }
});
