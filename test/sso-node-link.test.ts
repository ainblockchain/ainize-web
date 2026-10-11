import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linkSsoNode } from '../src/lib/ssoNodeLink';
import { signSiteCall } from '../src/lib/nodeCall';

const origin = 'https://ainize.ai';
const env = { AINIZE_NODE_URL: 'http://node.test', AINIZE_SITE_ASSERTION_SECRET: 's'.repeat(40) };
function request(body: unknown = { code: 'node-code' }, from = origin) {
  return new Request(`${origin}/api/auth/sso/node-link`, { method: 'POST', headers: {
    origin: from, cookie: 'ainize_session=existing', 'content-type': 'application/json',
    'x-ainize-site-call': 'visitor-forgery', authorization: 'visitor-token',
  }, body: JSON.stringify(body) });
}

test('uses the authenticated AIN principal and fresh signed call without forwarding visitor authority', async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push(String(url));
    const headers = new Headers(init?.headers);
    if (String(url).endsWith('/me')) {
      assert.equal(headers.get('cookie'), 'ainize_session=existing');
      assert.equal(headers.get('authorization'), null);
      assert.equal(headers.get('x-ainize-site-call'), null);
      return Response.json({ sso: { principal: 'ain:real-owner' } });
    }
    assert.deepEqual(JSON.parse(String(init?.body)), { principal: 'ain:real-owner', code: 'node-code' });
    assert.equal(headers.get('cookie'), null);
    assert.equal(headers.get('authorization'), null);
    const signed = headers.get('x-ainize-site-call')!;
    const [time, nonce] = signed.split('.');
    assert.equal(signed, signSiteCall(env.AINIZE_SITE_ASSERTION_SECRET, 'POST', '/api/auth/sso/node-link', Number(time), String(init?.body), nonce));
    return Response.json({ ok: true });
  };
  assert.equal((await linkSsoNode(request(), origin, env, fetchImpl)).status, 200);
  assert.equal(calls.length, 2);
});

test('refuses cross-origin and client-selected principals before any node request', async () => {
  const never: typeof fetch = async () => { throw new Error('must not call'); };
  assert.equal((await linkSsoNode(request(undefined, 'https://other.test'), origin, env, never)).status, 403);
  for (const body of [{ code: 'x', principal: 'another-owner' }, {}, { code: '' }, { code: 4 }, { code: 'x'.repeat(101) }, []]) {
    assert.equal((await linkSsoNode(request(body), origin, env, never)).status, 400);
  }
});

test('wallet-only, expired, and missing SSO sessions cannot link a node', async () => {
  for (const body of [{ address: 'wallet' }, { sso: null }, { sso: {} }]) {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => { calls++; return Response.json(body); };
    assert.equal((await linkSsoNode(request(), origin, env, fetchImpl)).status, 401);
    assert.equal(calls, 1);
  }
});

test('preserves node refusals and never treats transport errors as success', async () => {
  for (const status of [403, 404, 409, 410]) {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => ++calls === 1 ? Response.json({ sso: { principal: 'ain:owner' } }) : Response.json({ error: 'refused' }, { status });
    assert.equal((await linkSsoNode(request(), origin, env, fetchImpl)).status, status);
  }
  const failed: typeof fetch = async () => { throw new Error('offline'); };
  assert.equal((await linkSsoNode(request(), origin, env, failed)).status, 502);
});
