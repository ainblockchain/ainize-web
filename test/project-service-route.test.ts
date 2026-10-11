import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/svc/[...path]/route';
import { NODE_URL } from '../src/lib/node-url';

test('project service routes relay health and caller-authenticated searches instead of the SPA', async (t) => {
  const calls: { url: string; method?: string; headers: Headers; body: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method, headers: new Headers(init.headers), body: init.body ? Buffer.from(init.body as ArrayBuffer).toString() : '' });
    return Response.json(init.method === 'POST' ? { results: [{ id: 'a1', score: 0.9 }] } : { status: 'ready' });
  });
  const health = await GET(new Request('https://ainize.ai/svc/prj_test/health'), { params: Promise.resolve({ path: ['prj_test', 'health'] }) });
  assert.deepEqual(await health.json(), { status: 'ready' });
  assert.equal(calls[0].url, `${NODE_URL}/svc/prj_test/health`);
  const body = JSON.stringify({ desc: 'harbour at sunset', model: 'clef-flash' });
  const search = await POST(new Request('https://ainize.ai/svc/prj_test/search?format=json', {
    method: 'POST', headers: { authorization: 'Bearer caller-test-key', 'content-type': 'application/json' }, body,
  }), { params: Promise.resolve({ path: ['prj_test', 'search'] }) });
  assert.equal(search.headers.get('content-type'), 'application/json');
  assert.deepEqual(await search.json(), { results: [{ id: 'a1', score: 0.9 }] });
  assert.equal(calls[1].url, `${NODE_URL}/svc/prj_test/search?format=json`);
  assert.equal(calls[1].headers.get('authorization'), 'Bearer caller-test-key');
  assert.equal(calls[1].body, body);
});
