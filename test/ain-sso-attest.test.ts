/**
 * What the legacy Google sign-in tells AIN SSO (`app-attest`, src/lib/ainSso.ts). Against the in-test OpenID provider
 * and stand-in node (test/ain-sso-fixtures.ts); Google's token endpoint is answered in-process.
 *
 *   node --test --import tsx test/ain-sso-attest.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { startFakeNode, startIssuer } from './ain-sso-fixtures';
import { attestLegacyGoogleLogin, readAinSsoConfig } from '../src/lib/ainSso';

const CLIENT = 'app_ainize';
const SECRET = 'client secret:with/odd+chars';
const SITE = 's'.repeat(40);
const GOOGLE_SUB = '112233445566778899000';

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
    GOOGLE_CLIENT_ID: 'g-client', GOOGLE_CLIENT_SECRET: 'g-secret', AINIZE_WEB_SESSION_SECRET: 'k'.repeat(32),
  });
  delete process.env.LEGACY_LOGIN;
  N.calls.length = 0;
  I.appAttests.length = 0;
  I.attestReply.status = 201;
  I.attestReply.body = { status: 'pending', mappingId: 'lgm_1', expiresAt: '2026-10-27T00:00:00.000Z' };
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: false, blocked: false, notBefore: null } }));
});

const get = (path: string, cookie = '') => new NextRequest(`https://ainize.ai${path}`, { headers: { host: 'ainize.ai', 'x-forwarded-proto': 'https', ...(cookie ? { cookie } : {}) } });
const cookieOf = (res: Response, name: string) => {
  for (const line of res.headers.getSetCookie()) {
    const pair = line.split(';')[0]!;
    if (pair.slice(0, pair.indexOf('=')) === name) return decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
  }
  return undefined;
};
const until = async (cond: () => boolean, ms = 2_000) => { const end = Date.now() + ms; while (!cond() && Date.now() < end) await new Promise((r) => setTimeout(r, 10)); };

// ------------------------------------------------------------------------------------------------ the call

test('app-attest: shape B exactly — legacyUserId google:<sub>, googleSub, a fresh legacyLoginAt; client_secret_basic, no cookie', async () => {
  const at = new Date();
  assert.equal(await attestLegacyGoogleLogin(readAinSsoConfig()!, GOOGLE_SUB, at), 'pending');
  assert.equal(I.appAttests.length, 1);
  const [call] = I.appAttests;
  assert.deepEqual(call!.body, { legacyUserId: `google:${GOOGLE_SUB}`, googleSub: GOOGLE_SUB, legacyLoginAt: at.toISOString() });
  assert.equal(call!.authorization, `Basic ${Buffer.from(`${encodeURIComponent(CLIENT)}:${encodeURIComponent(SECRET)}`).toString('base64')}`);
  assert.equal(call!.cookie, undefined);
  assert.ok(!('email' in call!.body), 'nothing email-based: a Google subject is never reassigned');
});

test('app-attest answers: linked, pending, the normal refusals, and failures — none of them thrown', async () => {
  const cfg = readAinSsoConfig()!;
  I.attestReply.status = 200; I.attestReply.body = { status: 'linked', mappingId: 'lgm_1', expiresAt: null };
  assert.equal(await attestLegacyGoogleLogin(cfg, GOOGLE_SUB), 'linked');
  for (const [status, error] of [[409, 'legacy_user_already_linked'], [403, 'client_not_allowed'], [422, 'stale_legacy_login']] as const) {
    I.attestReply.status = status; I.attestReply.body = { error, message: 'x' };
    assert.equal(await attestLegacyGoogleLogin(cfg, GOOGLE_SUB), 'refused', String(status));
  }
  I.attestReply.status = 500; I.attestReply.body = { error: 'server_error' };
  assert.equal(await attestLegacyGoogleLogin(cfg, GOOGLE_SUB), 'failed');
  const unreachable = { ...cfg, issuer: 'http://127.0.0.1:9' };
  assert.equal(await attestLegacyGoogleLogin(unreachable, GOOGLE_SUB), 'failed');
  const before = I.appAttests.length;
  assert.equal(await attestLegacyGoogleLogin(cfg, 'not a google sub!'), 'skipped');
  assert.equal(I.appAttests.length, before, 'nothing sent for a subject the node could never link');
});

// ------------------------------------------------------------------------------------------------ after the Google sign-in

/** A full Google sign-in through the routes, with Google's token endpoint answered here. */
async function googleSignIn() {
  const { GET: start } = await import('../app/api/auth/google/start/route');
  const s = await start(get('/api/auth/google/start?next=%2Fmodels'));
  const authorize = new URL(s.headers.get('location')!);
  const flow = cookieOf(s, 'ainize_google_flow')!;
  const now = Math.floor(Date.now() / 1000);
  const claims = { iss: 'https://accounts.google.com', aud: 'g-client', sub: GOOGLE_SUB, email: 'kim@gmail.com', email_verified: true, nonce: authorize.searchParams.get('nonce'), exp: now + 600 };
  const idToken = `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => (String(url) === 'https://oauth2.googleapis.com/token'
    ? Response.json({ id_token: idToken, access_token: 'a', token_type: 'Bearer' })
    : realFetch(url, init))) as typeof fetch;
  try {
    const { GET: callback } = await import('../app/api/auth/google/callback/route');
    return await callback(get(`/api/auth/google/callback?code=c&state=${authorize.searchParams.get('state')}`, `ainize_google_flow=${encodeURIComponent(flow)}`));
  } finally { globalThis.fetch = realFetch; }
}

test('a Google sign-in here is attested to AIN SSO once, without waiting for it', async () => {
  I.attestReply.status = 500;   // even a failing AIN SSO changes nothing about the sign-in
  const res = await googleSignIn();
  assert.equal(new URL(res.headers.get('location')!).pathname, '/models');
  assert.ok(cookieOf(res, 'ainize_google_session'), 'signed in with Google as before');
  await until(() => I.appAttests.length > 0);
  assert.equal(I.appAttests.length, 1);
  assert.equal(I.appAttests[0]!.body.legacyUserId, `google:${GOOGLE_SUB}`, 'the principal the node\'s adapter links');
  assert.equal(I.appAttests[0]!.body.googleSub, GOOGLE_SUB);
  assert.ok(Math.abs(Date.parse(String(I.appAttests[0]!.body.legacyLoginAt)) - Date.now()) < 60_000);
});

test('no attestation without AIN SSO, or for a sign-in that was refused', async () => {
  for (const k of ['AIN_SSO_ISSUER', 'AIN_SSO_CLIENT_ID', 'AIN_SSO_CLIENT_SECRET']) delete process.env[k];
  const plain = await googleSignIn();
  assert.ok(cookieOf(plain, 'ainize_google_session'), 'Google sign-in works exactly as before');
  Object.assign(process.env, { AIN_SSO_ISSUER: I.issuer, AIN_SSO_CLIENT_ID: CLIENT, AIN_SSO_CLIENT_SECRET: SECRET });
  N.replies.set('/api/auth/sso/principal', () => ({ status: 200, body: { linked: true, blocked: true, notBefore: null } }));
  const refused = await googleSignIn();
  assert.ok(new URL(refused.headers.get('location')!).searchParams.get('google_error'), 'a suspended account is refused');
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(I.appAttests.length, 0);
});
