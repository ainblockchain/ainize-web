import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../app/svc/[...path]/route';
import { GET as API_GET } from '../app/api/[...path]/route';
import { NODE_URL } from '../src/lib/node-url';

test('project service routes relay health and searches to the node instead of the SPA', async (t) => {
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
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  }), { params: Promise.resolve({ path: ['prj_test', 'search'] }) });
  assert.equal(search.headers.get('content-type'), 'application/json');
  assert.deepEqual(await search.json(), { results: [{ id: 'a1', score: 0.9 }] });
  assert.equal(calls[1].url, `${NODE_URL}/svc/prj_test/search?format=json`);
  assert.equal(calls[1].body, body);
});

test('a user\'s app on ainize.ai gets none of the visitor\'s credentials and cannot set a cookie here', async (t) => {
  const calls: Headers[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls.push(new Headers(init.headers));
    const headers = new Headers({ 'content-type': 'text/html' });
    headers.append('set-cookie', 'ainize_session=planted; Path=/');
    headers.append('set-cookie', 'app=1; Path=/');
    return new Response('<p>app</p>', { headers });
  });
  const res = await GET(new Request('https://ainize.ai/svc/prj_test/', {
    headers: {
      cookie: 'ainize_google=GOOGLE-SECRET; ainize_session=NODE-SESSION; ain_sso_state=STATE-SECRET',
      authorization: 'Bearer ainize-sk-SECRET', 'x-ainize-site-subject': 'google:1.2.3', 'x-ainize-site-call': 'forged', 'x-ain-actor': 'acc_x', 'x-app': 'kept',
    },
  }), { params: Promise.resolve({ path: ['prj_test', ''] }) });
  const sent = calls[0];
  // Only the node's own session goes on — the node gates an org-private project with it and strips it before the container.
  assert.equal(sent.get('cookie'), 'ainize_session=NODE-SESSION');
  for (const h of ['authorization', 'x-ainize-site-subject', 'x-ainize-site-call', 'x-ain-actor']) assert.equal(sent.get(h), null, `${h} is not relayed`);
  assert.equal(sent.get('x-app'), 'kept');
  assert.doesNotMatch(JSON.stringify([...sent]), /GOOGLE-SECRET|STATE-SECRET|ainize-sk-SECRET/);
  assert.equal(res.headers.get('set-cookie'), null, 'the app cannot plant or shadow a cookie of ainize.ai');
  assert.equal(await res.text(), '<p>app</p>');
  // An anonymous visitor carries no cookie at all.
  await GET(new Request('https://ainize.ai/svc/prj_test/', { headers: { cookie: 'theme=dark' } }), { params: Promise.resolve({ path: ['prj_test', ''] }) });
  assert.equal(calls[1].get('cookie'), null);
});

test('the rest of the API still relays the visitor\'s session and the node\'s cookies, as before', async (t) => {
  const calls: Headers[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    calls.push(new Headers(init.headers));
    return new Response('{}', { headers: { 'content-type': 'application/json', 'set-cookie': 'ainize_session=x; Path=/' } });
  });
  const res = await API_GET(new Request('https://ainize.ai/api/projects/prj_test', { headers: { cookie: 'ainize_session=NODE-SESSION; other=1', authorization: 'Bearer k' } }), { params: Promise.resolve({ path: ['projects', 'prj_test'] }) });
  assert.equal(calls[0].get('cookie'), 'ainize_session=NODE-SESSION; other=1');
  assert.equal(calls[0].get('authorization'), 'Bearer k');
  assert.equal(res.headers.get('set-cookie'), 'ainize_session=x; Path=/');
});
