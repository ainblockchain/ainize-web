/**
 * Sign-in with AIN SSO (src/lib/ainSso.ts and app/api/auth/sso/*), and what it changes about the legacy Google
 * sign-in (src/lib/legacyLogin.ts). Driven end to end through the route handlers against a small OpenID provider
 * and a stand-in node (test/ain-sso-fixtures.ts); nothing here reaches the real network or the real node.
 *
 *   node --test --import tsx test/ain-sso.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { startFakeNode, startIssuer } from './ain-sso-fixtures';
import { GOOGLE_SESSION_COOKIE, mintGoogleSessionCookie } from '../src/lib/googleOAuth';
import { readAinSsoConfig, seal, unseal } from '../src/lib/ainSso';
import { legacyGoogleVerdict, legacyLoginMode } from '../src/lib/legacyLogin';
import { signSiteCall } from '../src/lib/nodeCall';

const CLIENT = 'app_ainize';
const SECRET = 'client-secret-for-tests';
const SITE = 's'.repeat(40);
const SUB = 'acc_0123456789abcdefghijklmnop';
const google = { clientId: 'g-client', clientSecret: 'g-secret', sessionSecret: 'k'.repeat(32), redirectUri: null };

let I: Awaited<ReturnType<typeof startIssuer>>;
let N: Awaited<ReturnType<typeof startFakeNode>>;
const saved = { ...process.env };

before(async () => {
  I = await startIssuer(CLIENT, SECRET);
  N = await startFakeNode(SITE);
});
after(async () => { await I.stop(); await N.stop(); });
beforeEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, {
    AIN_SSO_ISSUER: I.issuer, AIN_SSO_CLIENT_ID: CLIENT, AIN_SSO_CLIENT_SECRET: SECRET, AINIZE_SITE_ASSERTION_SECRET: SITE, AINIZE_NODE_URL: N.url,
    GOOGLE_CLIENT_ID: google.clientId, GOOGLE_CLIENT_SECRET: google.clientSecret, AINIZE_WEB_SESSION_SECRET: google.sessionSecret,
  });
  delete process.env.LEGACY_LOGIN;
  N.calls.length = 0;
  I.appProofs.length = 0;
  I.state.spoil = null;
  I.state.signWithForeign = false;
  N.replies.set('/api/auth/sso/session', (body) => ({ status: 200, body: { status: 'ok', token: `node-token-for-${String(body.sub)}`, principal: `sso:${String(body.sub)}`, expiresAt: Date.now() + 1000, created: true, linked: (body.link as { principal?: string } | null)?.principal ?? null } }));
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: false, blocked: false, notBefore: null } }));
});

const headers = (cookie = '') => ({ host: 'ainize.ai', 'x-forwarded-proto': 'https', ...(cookie ? { cookie } : {}) });
const get = (path: string, cookie = '') => new NextRequest(`https://ainize.ai${path}`, { headers: headers(cookie) });
const cookieOf = (res: Response, name: string): { value: string; maxAge?: number } | undefined => {
  for (const line of res.headers.getSetCookie()) {
    const [pair, ...attrs] = line.split(';').map((s) => s.trim());
    const i = pair!.indexOf('=');
    if (pair!.slice(0, i) !== name) continue;
    const maxAge = attrs.find((a) => /^max-age=/i.test(a));
    return { value: decodeURIComponent(pair!.slice(i + 1)), maxAge: maxAge ? Number(maxAge.split('=')[1]) : undefined };
  }
  return undefined;
};
const location = (res: Response) => new URL(res.headers.get('location')!);

async function start(next = '/models') {
  const { GET } = await import('../app/api/auth/sso/start/route');
  const res = await GET(get(`/api/auth/sso/start?next=${encodeURIComponent(next)}`));
  assert.equal(res.status, 302);
  return { authorizeUrl: res.headers.get('location')!, flow: cookieOf(res, 'ainize_sso_flow')!.value };
}
async function callback(callbackUrl: string, cookie: string) {
  const { GET } = await import('../app/api/auth/sso/callback/route');
  const u = new URL(callbackUrl);
  return GET(get(`${u.pathname}${u.search}`, cookie));
}
const ORGS = [{ id: 'org_comcom', slug: 'comcom', name: 'ComCom', role: 'member', groups: [] }];
const fullSignIn = async (claims: Record<string, unknown> = {}, extraCookie = '') => {
  const { authorizeUrl, flow } = await start();
  const back = I.authorize(authorizeUrl, SUB, { sid: 'sid_1', name: 'Kim', email: 'kim@comcom.ai', email_verified: true, orgs: ORGS, active_org: 'org_comcom', ...claims });
  return callback(back, `ainize_sso_flow=${encodeURIComponent(flow)}${extraCookie ? `; ${extraCookie}` : ''}`);
};

// ------------------------------------------------------------------------------------------------ configuration

test('AIN sign-in is off unless issuer, client, secret and the node channel are all configured', () => {
  const env = { AIN_SSO_ISSUER: 'https://auth.comcom.ai', AIN_SSO_CLIENT_ID: CLIENT, AIN_SSO_CLIENT_SECRET: SECRET, AINIZE_SITE_ASSERTION_SECRET: SITE };
  assert.ok(readAinSsoConfig(env));
  for (const k of Object.keys(env)) assert.equal(readAinSsoConfig({ ...env, [k]: '' }), null, `without ${k}`);
  assert.equal(readAinSsoConfig({ ...env, AIN_SSO_ISSUER: 'http://auth.comcom.ai' }), null, 'plain http only on loopback');
  assert.equal(readAinSsoConfig({}), null);
});

test('with nothing configured the routes do nothing and the page offers no AIN button', async () => {
  for (const k of ['AIN_SSO_ISSUER', 'AIN_SSO_CLIENT_ID', 'AIN_SSO_CLIENT_SECRET']) delete process.env[k];
  const { GET: startGET } = await import('../app/api/auth/sso/start/route');
  assert.equal((await startGET(get('/api/auth/sso/start'))).status, 503);
  const { GET: cbGET } = await import('../app/api/auth/sso/callback/route');
  assert.equal((await cbGET(get('/api/auth/sso/callback?code=x&state=y'))).status, 503);
  const { GET: statusGET } = await import('../app/api/auth/sso/status/route');
  const status = await (await statusGET(get('/api/auth/sso/status'))).json() as { configured: boolean; legacyLogin: string };
  assert.equal(status.configured, false);
  assert.equal(status.legacyLogin, 'true');
  assert.equal(N.calls.length, 0, 'and nothing asked the node');
});

// ------------------------------------------------------------------------------------------------ the flow

test('start: code flow with PKCE S256, state, nonce and the org scope; the pending values are sealed, not readable', async () => {
  const { authorizeUrl, flow } = await start('/teach');
  const u = new URL(authorizeUrl);
  assert.equal(u.origin + u.pathname, `${I.issuer}/oidc/auth`);
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('client_id'), CLIENT);
  assert.equal(u.searchParams.get('scope'), 'openid profile email org');
  assert.equal(u.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(u.searchParams.get('redirect_uri'), 'https://ainize.ai/api/auth/sso/callback');
  assert.ok(u.searchParams.get('state') && u.searchParams.get('nonce') && u.searchParams.get('code_challenge'));
  const decoded = Buffer.from(flow, 'base64url').toString('latin1');
  assert.ok(!decoded.includes(u.searchParams.get('state')!) && !decoded.includes('/teach'), 'the flow cookie is encrypted');
});

test('callback: a verified ID token becomes the node\'s session, keyed by sid, and lands on next', async () => {
  const res = await fullSignIn();
  assert.equal(res.status, 302);
  assert.equal(location(res).pathname, '/models');
  assert.equal(cookieOf(res, 'ainize_session')?.value, `node-token-for-${SUB}`, 'the browser holds the node\'s session');
  assert.equal(cookieOf(res, 'ainize_sso_flow')?.maxAge, 0, 'the flow cookie is spent');
  const call = N.calls.find((c) => c.path === '/api/auth/sso/session')!;
  assert.ok(call.signed, 'the node was asked by this app, signed');
  assert.deepEqual({ ...call.body }, {
    iss: I.issuer, sub: SUB, sid: 'sid_1', name: 'Kim', email: 'kim@comcom.ai',
    orgs: [{ id: 'org_comcom', slug: 'comcom', name: 'ComCom' }], activeOrg: 'org_comcom', link: null, allowConnect: true, replaces: null,
  });
  const tokenReq = I.tokenRequests.at(-1)!;
  assert.ok(tokenReq.get('code_verifier'), 'the PKCE verifier went to the token endpoint');
});

test('an unverified email is not passed on, and nothing links by email anyway', async () => {
  await fullSignIn({ email: 'boss@comcom.ai', email_verified: false });
  const call = N.calls.find((c) => c.path === '/api/auth/sso/session')!;
  assert.equal(call.body.email, null);
  assert.equal(call.body.sub, SUB, 'the subject is the only key the node is given');
});

test('every ID token that is not exactly ours is refused before the node hears of it', async () => {
  const now = Math.floor(Date.now() / 1000);
  const spoilers: [string, (c: Record<string, unknown>) => Record<string, unknown>][] = [
    ['audience', (c) => ({ ...c, aud: 'app_someone_else' })],
    ['issuer', (c) => ({ ...c, iss: 'https://evil.example' })],
    ['nonce', (c) => ({ ...c, nonce: 'replayed' })],
    ['expiry', (c) => ({ ...c, iat: now - 7200, exp: now - 3600 })],
  ];
  for (const [what, spoil] of spoilers) {
    I.state.spoil = spoil;
    const res = await fullSignIn();
    assert.equal(location(res).pathname, '/signing', what);
    assert.ok(location(res).searchParams.get('sso_error'), what);
    assert.equal(cookieOf(res, 'ainize_session'), undefined, what);
  }
  I.state.spoil = null;
  I.state.signWithForeign = true;
  const forged = await fullSignIn();
  assert.ok(location(forged).searchParams.get('sso_error'), 'a signature from a key not in the JWKS');
  assert.equal(N.calls.filter((c) => c.path === '/api/auth/sso/session').length, 0);
});

test('a callback not started in this browser, or with another state, is refused before the token endpoint is asked', async () => {
  const before = I.tokenRequests.length;
  const { authorizeUrl, flow } = await start();
  const back = new URL(I.authorize(authorizeUrl, SUB));
  const noCookie = await callback(back.href, '');
  assert.ok(location(noCookie).searchParams.get('sso_error'));
  back.searchParams.set('state', 'somebody-elses');
  const swapped = await callback(back.href, `ainize_sso_flow=${encodeURIComponent(flow)}`);
  assert.match(location(swapped).searchParams.get('sso_error')!, /state/);
  const tampered = await callback(I.authorize(authorizeUrl, SUB), `ainize_sso_flow=${encodeURIComponent(flow.slice(0, -2) + 'AA')}`);
  assert.ok(location(tampered).searchParams.get('sso_error'), 'a tampered sealed cookie is no flow');
  assert.equal(I.tokenRequests.length, before);
});

test('AIN SSO saying no (unassigned) lands on the sign-in page with the reason', async () => {
  const { flow } = await start();
  const res = await callback('https://ainize.ai/api/auth/sso/callback?error=access_denied&state=x', `ainize_sso_flow=${encodeURIComponent(flow)}`);
  assert.match(location(res).searchParams.get('sso_error')!, /access/);
});

test('a suspended account is refused by the node, and the page says why', async () => {
  N.replies.set('/api/auth/sso/session', () => ({ status: 403, body: { error: 'account_suspended' } }));
  const res = await fullSignIn();
  assert.match(location(res).searchParams.get('sso_error')!, /suspended/);
  assert.equal(cookieOf(res, 'ainize_session'), undefined);
});

// ------------------------------------------------------------------------------------------------ connect

async function toConnect() {
  N.replies.set('/api/auth/sso/session', (body) => (body.link === null && body.allowConnect
    ? { status: 200, body: { status: 'needs_link' } }
    : { status: 200, body: { status: 'ok', token: 'node-token-linked', principal: (body.link as { principal?: string } | null)?.principal ?? `sso:${SUB}`, expiresAt: 0, created: true, linked: (body.link as { principal?: string } | null)?.principal ?? null } }));
  const res = await fullSignIn();
  assert.equal(location(res).pathname, '/signing');
  assert.equal(location(res).searchParams.get('sso'), 'connect');
  assert.equal(cookieOf(res, 'ainize_session'), undefined, 'no session until they choose');
  return cookieOf(res, 'ainize_sso_pending')!.value;
}
const connect = async (choice: string, cookie: string, origin = 'https://ainize.ai') => {
  const { POST } = await import('../app/api/auth/sso/connect/route');
  return POST(new NextRequest('https://ainize.ai/api/auth/sso/connect', { method: 'POST', headers: { ...headers(cookie), origin, 'content-type': 'application/json' }, body: JSON.stringify({ choice }) }));
};

test('no link yet: the person may connect the ainize.ai Google account signed in in this browser, and AIN SSO is told', async () => {
  const pending = await toConnect();
  const { GET } = await import('../app/api/auth/sso/status/route');
  const gcookie = mintGoogleSessionCookie({ sub: '1098765', email: 'kim@gmail.com', name: null, picture: null }, google);
  const cookies = `ainize_sso_pending=${encodeURIComponent(pending)}; ${GOOGLE_SESSION_COOKIE}=${encodeURIComponent(gcookie)}`;
  const status = await (await GET(get('/api/auth/sso/status', cookies))).json() as { pending: { email: string }; legacyGoogle: { email: string } };
  assert.equal(status.pending.email, 'kim@comcom.ai');
  assert.equal(status.legacyGoogle.email, 'kim@gmail.com');

  const res = await connect('legacy', cookies);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, next: '/models', linked: 'google:1098765' });
  assert.equal(cookieOf(res, 'ainize_session')?.value, 'node-token-linked');
  assert.equal(cookieOf(res, 'ainize_sso_pending')?.maxAge, 0);
  const call = N.calls.filter((c) => c.path === '/api/auth/sso/session').at(-1)!;
  assert.deepEqual(call.body.link, { principal: 'google:1098765', method: 'legacy_session' });
  assert.equal(I.appProofs.length, 1, 'reported to AIN SSO');
  assert.deepEqual(I.appProofs[0]!.body, { sub: SUB, legacyUserId: 'google:1098765', method: 'legacy_session' });
  assert.equal(I.appProofs[0]!.authorization, `Basic ${Buffer.from(`${CLIENT}:${SECRET}`).toString('base64')}`, 'client_secret_basic');
});

test('connecting needs the legacy session itself, from this origin; "continue" makes a new account', async () => {
  const pending = await toConnect();
  const noGoogle = await connect('legacy', `ainize_sso_pending=${encodeURIComponent(pending)}`);
  assert.equal(noGoogle.status, 400, 'no Google session in this browser, no proof');
  const cross = await connect('new', `ainize_sso_pending=${encodeURIComponent(pending)}`, 'https://evil.example');
  assert.equal(cross.status, 403);
  const fresh = await connect('new', `ainize_sso_pending=${encodeURIComponent(pending)}`);
  assert.equal(fresh.status, 200);
  assert.equal((await fresh.json() as { linked: unknown }).linked, null);
  assert.equal(I.appProofs.length, 0, 'nothing to report');
  assert.equal((await connect('new', '')).status, 400, 'no pending sign-in, nothing to finish');
});

test('with LEGACY_LOGIN=false nobody is asked to connect: a new sign-in goes straight to a fresh account', async () => {
  process.env.LEGACY_LOGIN = 'false';
  await fullSignIn();
  const call = N.calls.find((c) => c.path === '/api/auth/sso/session')!;
  assert.equal(call.body.allowConnect, false);
});

// ------------------------------------------------------------------------------------------------ legacy Google

const gsession = (iat = Math.floor(Date.now() / 1000)) => ({ identity: { sub: '42' }, iat });

test('LEGACY_LOGIN: unset is true; unknown values fail closed', () => {
  assert.equal(legacyLoginMode({}), 'true');
  assert.equal(legacyLoginMode({ LEGACY_LOGIN: 'unlinked_only' }), 'unlinked_only');
  assert.equal(legacyLoginMode({ LEGACY_LOGIN: 'FALSE' }), 'false');
  assert.equal(legacyLoginMode({ LEGACY_LOGIN: 'flase' }), 'false');
});

test('a legacy Google session is refused when off, suspended, signed out everywhere, or linked under unlinked_only', async () => {
  const env = { ...process.env };
  assert.deepEqual(await legacyGoogleVerdict(gsession(), { ...env, LEGACY_LOGIN: 'false' }), { ok: false, reason: 'legacy_login_off' });
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: true, blocked: true, notBefore: null } }));
  assert.deepEqual(await legacyGoogleVerdict(gsession(), env), { ok: false, reason: 'suspended' });
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: true, blocked: false, notBefore: Date.now() } }));
  assert.deepEqual(await legacyGoogleVerdict(gsession(Math.floor(Date.now() / 1000) - 60), env), { ok: false, reason: 'signed_out' });
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: true, blocked: false, notBefore: null } }));
  assert.deepEqual(await legacyGoogleVerdict(gsession(), env), { ok: true }, 'linked is fine while LEGACY_LOGIN=true');
  assert.deepEqual(await legacyGoogleVerdict(gsession(), { ...env, LEGACY_LOGIN: 'unlinked_only' }), { ok: false, reason: 'linked_use_ain' });
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: false, blocked: false, notBefore: null } }));
  assert.deepEqual(await legacyGoogleVerdict(gsession(), { ...env, LEGACY_LOGIN: 'unlinked_only' }), { ok: true });
  assert.equal(N.calls.at(-1)?.body.principal, 'google:42');
});

test('the suspension holds even with AIN SSO switched off on this app (a rollback)', async () => {
  const env = { ...process.env, AIN_SSO_ISSUER: '', AIN_SSO_CLIENT_ID: '', AIN_SSO_CLIENT_SECRET: '' };
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: true, blocked: true, notBefore: null } }));
  assert.deepEqual(await legacyGoogleVerdict(gsession(), env), { ok: false, reason: 'suspended' });
});

test('with everything at its defaults the Google sign-in works as before, even if the node cannot be asked', async () => {
  const defaults = { GOOGLE_CLIENT_ID: 'g', GOOGLE_CLIENT_SECRET: 'g', AINIZE_WEB_SESSION_SECRET: 'k'.repeat(32) } as NodeJS.ProcessEnv;
  const neverCalled = (async () => { throw new Error('must not be called'); }) as unknown as typeof fetch;
  assert.deepEqual(await legacyGoogleVerdict(gsession(), defaults, neverCalled), { ok: true }, 'no channel to the node: no call at all');
  const old = { ...defaults, AINIZE_SITE_ASSERTION_SECRET: SITE, AINIZE_NODE_URL: 'http://127.0.0.1:9' };
  assert.deepEqual(await legacyGoogleVerdict(gsession(), old), { ok: true }, 'a node that cannot answer changes nothing by default');
  const fromBefore = (async () => Response.json({ error: 'not found' }, { status: 404 })) as unknown as typeof fetch;
  assert.deepEqual(await legacyGoogleVerdict(gsession(), old, fromBefore), { ok: true }, 'nor does a node from before AIN SSO');
  assert.deepEqual(await legacyGoogleVerdict(gsession(), { ...old, AIN_SSO_ISSUER: 'x', AIN_SSO_CLIENT_ID: 'x', AIN_SSO_CLIENT_SECRET: 'x' }), { ok: false, reason: 'node_unavailable' },
    'but once AIN SSO is on, not knowing is a no');
});

test('the Google routes follow LEGACY_LOGIN and the node\'s answer', async () => {
  const { GET: sessionGET } = await import('../app/api/auth/google/session/route');
  const gcookie = mintGoogleSessionCookie({ sub: '42', email: 'a@b.c', name: null, picture: null }, google);
  const withCookie = `${GOOGLE_SESSION_COOKIE}=${encodeURIComponent(gcookie)}`;
  const ok = await (await sessionGET(get('/api/auth/google/session', withCookie))).json() as { configured: boolean; identity: { sub: string } | null };
  assert.equal(ok.configured, true);
  assert.equal(ok.identity?.sub, '42');

  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: true, blocked: true, notBefore: null } }));
  const blocked = await sessionGET(get('/api/auth/google/session', withCookie));
  assert.equal((await blocked.json() as { identity: unknown }).identity, null, 'a suspended account\'s Google session is over');
  assert.equal(cookieOf(blocked, GOOGLE_SESSION_COOKIE)?.maxAge, 0, 'and its cookie is cleared');

  process.env.LEGACY_LOGIN = 'false';
  const off = await (await sessionGET(get('/api/auth/google/session', withCookie))).json() as { configured: boolean; identity: unknown };
  assert.deepEqual(off, { configured: false, identity: null });
  const { GET: startGET } = await import('../app/api/auth/google/start/route');
  const start = await startGET(get('/api/auth/google/start'));
  assert.equal(location(start).pathname, '/signing');
  assert.ok(location(start).searchParams.get('google_error'));
});

test('vouching on /api/keys stops for a suspended Google account', async () => {
  const { siteSubjectFor } = await import('../src/lib/siteAssertion');
  const gcookie = mintGoogleSessionCookie({ sub: '42', email: 'a@b.c', name: null, picture: null }, google);
  const req = new Request('https://ainize.ai/api/keys', { headers: { cookie: `${GOOGLE_SESSION_COOKIE}=${encodeURIComponent(gcookie)}` } });
  assert.match(String(await siteSubjectFor(req)), /^google:42\./);
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: true, blocked: true, notBefore: null } }));
  assert.equal(await siteSubjectFor(req), null);
});

// ------------------------------------------------------------------------------------------------ plumbing

test('the relay never passes on a visitor\'s own x-ainize-site-call', async () => {
  let seen: Headers | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => { seen = new Headers(init.headers); return new Response('{}', { headers: { 'content-type': 'application/json' } }); }) as typeof fetch;
  try {
    const { relayToNode } = await import('../src/lib/proxy');
    await relayToNode(new Request('https://ainize.ai/api/auth/sso/session', { method: 'POST', headers: { 'x-ainize-site-call': '1.2.3', 'x-ainize-site-subject': 'google:1.2.3' }, body: '{}' }), '/api/auth/sso/session');
  } finally { globalThis.fetch = realFetch; }
  assert.equal(seen!.get('x-ainize-site-call'), null);
  assert.equal(seen!.get('x-ainize-site-subject'), null);
});

test('sealed cookies: tampering, another purpose or expiry is no cookie at all', () => {
  const cfg = readAinSsoConfig()!;
  const sealed = seal({ a: 1, exp: Math.floor(Date.now() / 1000) + 60 }, cfg, 'pending');
  assert.deepEqual(unseal(sealed, cfg, 'pending'), { a: 1, exp: JSON.parse(JSON.stringify(unseal(sealed, cfg, 'pending'))).exp });
  assert.equal(unseal(sealed, cfg, 'flow'), null, 'a pending cookie cannot pass as a flow cookie');
  assert.equal(unseal(`${sealed.slice(0, 10)}${sealed[10] === 'A' ? 'B' : 'A'}${sealed.slice(11)}`, cfg, 'pending'), null);
  assert.equal(unseal(sealed, { ...cfg, clientSecret: 'rotated' }, 'pending'), null);
  assert.equal(unseal(sealed, cfg, 'pending', Date.now() + 120_000), null);
});

test('the site-call format matches the node (the same vector is pinned in ainize-node)', () => {
  assert.equal(signSiteCall('s'.repeat(32), 'POST', '/api/auth/sso/principal', 1790000000, '{"principal":"google:1"}', '0'.repeat(32)),
    '1790000000.00000000000000000000000000000000.88f0afe043c4386d1bc4c3b8cf64bbf6b14c689b2f4a0aa17a769c34bc8c237f');
});

test('the AIN SSO modules are server-only', async () => {
  const { readFileSync, readdirSync, statSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const f = join(dir, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
  const offenders = walk(join(root, 'src'))
    .filter((f) => /\.tsx$/.test(f) && /from '[^']*lib\/(ainSso|nodeCall|legacyLogin|siteSecret)'/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders, [], 'no component imports them');
});
