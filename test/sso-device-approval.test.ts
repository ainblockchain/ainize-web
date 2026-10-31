import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approveSsoDevice } from '../src/lib/ssoDeviceApproval';
import { signSiteCall } from '../src/lib/nodeCall';
const origin = 'https://ainize.ai';
const env = { AINIZE_NODE_URL: 'http://node.test', AINIZE_SITE_ASSERTION_SECRET: 's'.repeat(40) };
const request = (body: unknown = { code: 'request-code' }, from = origin, cookie = 'ainize_session=browser-session') => new Request(origin + '/api/auth/sso/device-approve', {
  method: 'POST', headers: { origin: from, cookie, 'content-type': 'application/json', authorization: 'attacker', 'x-ainize-site-call': 'forged' }, body: JSON.stringify(body),
});
test('account approval forwards only the HttpOnly session and code in a fresh signed server call', async () => {
  const fetchImpl: typeof fetch = async (url, init) => {
    assert.equal(String(url), 'http://node.test/api/auth/sso/device-approve');
    assert.deepEqual(JSON.parse(String(init?.body)), { code: 'request-code', sessionToken: 'browser-session' });
    const headers = new Headers(init?.headers), signed = headers.get('x-ainize-site-call')!;
    const [time, nonce] = signed.split('.');
    assert.equal(signed, signSiteCall(env.AINIZE_SITE_ASSERTION_SECRET, 'POST', '/api/auth/sso/device-approve', Number(time), String(init?.body), nonce));
    assert.equal(headers.get('authorization'), null); assert.equal(headers.get('cookie'), null);
    return Response.json({ ok: true });
  };
  assert.equal((await approveSsoDevice(request(), origin, env, fetchImpl)).status, 200);
});
test('cross-origin, selected identities and missing or ambiguous cookies fail before forwarding', async () => {
  const never: typeof fetch = async () => assert.fail('must not call node');
  for (const from of ['https://other.test', 'null', '']) assert.equal((await approveSsoDevice(request(undefined, from), origin, env, never)).status, 403);
  for (const body of [{ code: 'x', sessionToken: 'chosen' }, { code: 'x', principal: 'chosen' }, {}, [], { code: '' }, { code: 'x'.repeat(101) }]) {
    assert.equal((await approveSsoDevice(request(body), origin, env, never)).status, 400);
  }
  for (const cookie of ['', 'ainize_session=', 'ainize_session=one; ainize_session=two']) assert.equal((await approveSsoDevice(request(undefined, origin, cookie), origin, env, never)).status, 401);
});
test('refusals and outages cannot become successful approvals', async () => {
  for (const status of [401, 403, 404, 409, 410, 500]) {
    const result = await approveSsoDevice(request(), origin, env, async () => Response.json({ error: 'refused' }, { status }));
    assert.equal(result.status, status === 500 ? 502 : status);
  }
  assert.equal((await approveSsoDevice(request(), origin, env, async () => { throw new Error('offline'); })).status, 502);
});
