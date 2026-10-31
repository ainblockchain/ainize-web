import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { readAinSsoConfig, sealPending } from '../src/lib/ainSso';
import { mintGoogleSessionCookie } from '../src/lib/googleOAuth';
import { GET as status } from '../app/api/auth/sso/status/route';
import { POST as connect } from '../app/api/auth/sso/connect/route';
const vars = { AIN_SSO_ISSUER: 'https://issuer.test', AIN_SSO_CLIENT_ID: 'fixture-client', AIN_SSO_CLIENT_SECRET: 'fixture-secret', AINIZE_SITE_ASSERTION_SECRET: 's'.repeat(40), AINIZE_NODE_URL: 'https://node.test', GOOGLE_CLIENT_ID: 'fixture-google', GOOGLE_CLIENT_SECRET: 'fixture-secret', AINIZE_WEB_SESSION_SECRET: 'k'.repeat(32), LEGACY_LOGIN: 'true' };
const saved = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]));
const nativeFetch = globalThis.fetch;
beforeEach(() => { Object.assign(process.env, vars); globalThis.fetch = async () => assert.fail('unexpected external call'); });
afterEach(() => { for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } globalThis.fetch = nativeFetch; });
const identity = (sub = 'fixture-sub') => ({ iss: vars.AIN_SSO_ISSUER, sub, sid: 'fixture-sid', name: 'Fixture', email: 'ain@example.test', orgs: [], activeOrg: null });
const pending = (sub?: string, now = Date.now()) => sealPending(identity(sub), '/apps?q=chosen#list', readAinSsoConfig()!, now);
const google = (sub = '123') => mintGoogleSessionCookie({ sub, email: sub + '@example.test', name: 'Legacy', picture: null }, { clientId: vars.GOOGLE_CLIENT_ID, clientSecret: vars.GOOGLE_CLIENT_SECRET, sessionSecret: vars.AINIZE_WEB_SESSION_SECRET, redirectUri: null });
const cookies = (p: string, g = google(), node = 'old-session') => `ainize_sso_pending=${encodeURIComponent(p)}; ainize_google_session=${encodeURIComponent(g)}; ainize_session=${node}`;
const get = (cookie: string) => new NextRequest('https://ainize.ai/api/auth/sso/status', { headers: { cookie } });
const post = (cookie: string, body: unknown, origin = 'https://ainize.ai') => new NextRequest('https://ainize.ai/api/auth/sso/connect', { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const review = async (cookie: string) => (await status(get(cookie)).json()).connectionReview;
const successfulFetch: typeof fetch = async (url, init) => {
  assert.equal(String(url), 'https://node.test/api/auth/sso/session');
  const input = JSON.parse(String(init?.body));
  return Response.json({ status: 'ok', token: 'fixture-node-session', principal: input.link?.principal ?? 'sso:' + input.sub, expiresAt: Date.now() + 60000, created: true, linked: input.link?.principal ?? null });
};

test('status derives a stable review from cookies and successful connection forwards only proven identities', async () => {
  const cookie = cookies(pending()), expected = await review(cookie);
  assert.equal(expected.legacy.principal, 'google:123'); assert.equal(expected.email, 'ain@example.test');
  assert.deepEqual(await review(cookie), expected); assert.equal(status(get(cookie)).headers.get('cache-control'), 'no-store');
  let calls = 0;
  globalThis.fetch = async (url, init) => { calls++; const input = JSON.parse(String(init?.body));
    assert.equal(input.sub, expected.subject); assert.deepEqual(input.link, { principal: 'google:123', method: 'legacy_session' });
    assert.equal(input.replaces, 'old-session'); assert.equal(input.expected, undefined);
    return successfulFetch(url, init);
  };
  const res = await connect(post(cookie, { choice: 'legacy', expected }));
  assert.equal(res.status, 200); assert.equal(calls, 1);
  assert.deepEqual(await res.json(), { ok: true, next: expected.next, linked: 'google:123', request: expected.request, subject: expected.subject, principal: 'google:123' });
  assert.match(res.headers.get('set-cookie')!, /ainize_session=fixture-node-session/);
});

test('swapped pending, Google or existing node session cookies are refused before a node call', async () => {
  const p = pending(), original = cookies(p), expected = await review(original);
  for (const cookie of [cookies(pending('other-account')), cookies(p, google('456')), cookies(p, google(), 'different-node-session')]) {
    assert.equal((await connect(post(cookie, { choice: 'legacy', expected }))).status, 409);
  }
  for (const field of ['email', 'next', 'subject']) assert.equal((await connect(post(original, { choice: 'legacy', expected: { ...expected, [field]: field === 'next' ? '/models' : 'changed' } }))).status, 409);
});

test('unreviewed bodies, cross-origin posts, expired and duplicate cookies cannot connect', async () => {
  const p = pending(), cookie = cookies(p), expected = await review(cookie);
  for (const body of [{ choice: 'new' }, { choice: 'legacy', expected, principal: 'chosen' }, { choice: 'bad', expected }]) assert.equal((await connect(post(cookie, body))).status, 400);
  assert.equal((await connect(post(cookie, { choice: 'new', expected }, 'https://elsewhere.test'))).status, 403);
  for (const invalid of [cookies(pending(undefined, Date.now() - 900000)), cookie + '; ainize_sso_pending=duplicate', cookie + '; ainize_google_session=duplicate', cookie + '; ainize_session=duplicate']) {
    assert.equal(await review(invalid), null);
    assert.equal((await connect(post(invalid, { choice: 'new', expected }))).status, 400);
  }
});

test('malformed or mismatched node receipts never install cookies or acknowledge a connection', async () => {
  const cookie = cookies(pending()), expected = await review(cookie);
  for (const body of [null, [], {}, { status: 'unexpected' }]) {
    globalThis.fetch = async () => Response.json(body);
    const res = await connect(post(cookie, { choice: 'legacy', expected }));
    assert.equal(res.status, 502); assert.equal(res.headers.get('set-cookie'), null);
  }
  for (const patch of [{ token: '' }, { expiresAt: 0 }, { principal: 'google:other' }, { linked: 'google:other' }, { status: 'needs_link' }]) {
    globalThis.fetch = async () => Response.json({ status: 'ok', token: 'fixture-session', principal: 'google:123', linked: 'google:123', expiresAt: Date.now() + 60000, ...patch });
    const res = await connect(post(cookie, { choice: 'legacy', expected }));
    assert.equal(res.status, patch.status ? 409 : 502); assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('continue without connecting uses no legacy link and refuses a reply claiming a new link', async () => {
  const cookie = cookies(pending()), expected = await review(cookie);
  globalThis.fetch = async (url, init) => { assert.equal(JSON.parse(String(init?.body)).link, null); return successfulFetch(url, init); };
  assert.equal((await connect(post(cookie, { choice: 'new', expected }))).status, 200);
  globalThis.fetch = async () => Response.json({ status: 'ok', token: 'fixture-session', principal: 'google:123', linked: 'google:123', expiresAt: Date.now() + 60000 });
  assert.equal((await connect(post(cookie, { choice: 'new', expected }))).status, 502);
});
