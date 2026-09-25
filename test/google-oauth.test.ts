/**
 * Google sign-in (src/lib/googleOAuth.ts): the checks that make a Google session mean what it says.
 *
 * Every one of these fails open if it is wrong — a forged cookie, a code replayed into another browser, a token
 * meant for another app, a `next` that lands somewhere else — and a sign-in that works in a browser proves none of
 * them, which is why they are tested here rather than clicked through.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  GoogleOAuthError, checkGoogleIdToken, finishGoogleFlow, googleRedirectUri, mintGoogleSessionCookie, readGoogleOAuthConfig,
  readGoogleSession, safeGoogleNext, startGoogleFlow, type GoogleOAuthConfig,
} from '../src/lib/googleOAuth';

const config: GoogleOAuthConfig = { clientId: 'client-123.apps.googleusercontent.com', clientSecret: 'shh', sessionSecret: 'k'.repeat(32), redirectUri: null };
const NOW = Date.UTC(2026, 8, 25);
const who = { sub: '1098765', email: 'a@example.com', name: 'A', picture: null };

const idToken = (claims: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const goodClaims = (nonce: string) => ({
  iss: 'https://accounts.google.com', aud: config.clientId, exp: NOW / 1000 + 600, nonce,
  sub: who.sub, email: who.email, email_verified: true, name: who.name,
});
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

test('config is all-or-nothing — a server missing one secret offers no Google button rather than a broken one', () => {
  assert.equal(readGoogleOAuthConfig({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y' }), null);
  assert.ok(readGoogleOAuthConfig({ GOOGLE_CLIENT_ID: 'x', GOOGLE_CLIENT_SECRET: 'y', AINIZE_WEB_SESSION_SECRET: 'z' }));
});

test('next is a path on this site and nothing else — otherwise sign-in is an open redirect', () => {
  assert.equal(safeGoogleNext('/teach?x=1'), '/teach?x=1');
  for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined]) assert.equal(safeGoogleNext(bad), '/');
});

test('the callback URL follows the public origin behind a proxy, and an explicit one wins', () => {
  const behind = req('http://127.0.0.1:3000/api/auth/google/start', { host: 'ainize.ai', 'x-forwarded-proto': 'https' });
  assert.equal(googleRedirectUri(behind, config), 'https://ainize.ai/api/auth/google/callback');
  assert.equal(googleRedirectUri(behind, { ...config, redirectUri: 'https://x.test/cb' }), 'https://x.test/cb');
});

test('a session cookie survives a round trip, and not tampering or expiry', () => {
  const cookie = mintGoogleSessionCookie(who, config, NOW);
  assert.deepEqual(readGoogleSession(cookie, config, NOW), who);
  const [body, sig] = cookie.split('.');
  const forged = Buffer.from(JSON.stringify({ ...who, email: 'boss@example.com', exp: NOW / 1000 + 999 })).toString('base64url');
  assert.equal(readGoogleSession(`${forged}.${sig}`, config, NOW), null, 'a changed payload under the old signature');
  assert.equal(readGoogleSession(`${body}.${sig}`, { ...config, sessionSecret: 'other'.repeat(8) }, NOW), null, 'a rotated secret');
  assert.equal(readGoogleSession(cookie, config, NOW + 31 * 24 * 3600 * 1000), null, 'after 30 days');
  assert.equal(readGoogleSession('garbage', config, NOW), null);
});

test('the ID token is refused for every claim that is not ours', () => {
  const nonce = 'n1';
  assert.deepEqual(checkGoogleIdToken(idToken(goodClaims(nonce)), config, nonce, NOW), who);
  const bad: [string, Record<string, unknown>][] = [
    ['issuer', { iss: 'https://evil.example' }],
    ['audience', { aud: 'someone-else' }],
    ['expiry', { exp: NOW / 1000 - 1 }],
    ['nonce', { nonce: 'replayed' }],
    ['unverified email', { email_verified: false }],
  ];
  for (const [what, patch] of bad) {
    assert.throws(() => checkGoogleIdToken(idToken({ ...goodClaims(nonce), ...patch }), config, nonce, NOW), GoogleOAuthError, what);
  }
});

test('start → callback: state and PKCE carried through, session minted, next kept', async () => {
  const start = startGoogleFlow(req('https://ainize.ai/api/auth/google/start'), config, '/teach', NOW);
  const auth = new URL(start.authorizeUrl);
  assert.equal(auth.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(auth.searchParams.get('redirect_uri'), 'https://ainize.ai/api/auth/google/callback');
  const state = auth.searchParams.get('state')!;
  const nonce = auth.searchParams.get('nonce')!;

  let sent: URLSearchParams | null = null;
  const fakeFetch = (async (_url: string, init: RequestInit) => {
    sent = init.body as URLSearchParams;
    return Response.json({ id_token: idToken(goodClaims(nonce)) });
  }) as unknown as typeof fetch;
  const cb = req(`https://ainize.ai/api/auth/google/callback?state=${state}&code=abc`);
  const done = await finishGoogleFlow(cb, config, start.flowCookie, fakeFetch, NOW);
  assert.equal(done.next, '/teach');
  assert.deepEqual(readGoogleSession(done.sessionCookie, config, NOW), who);
  assert.ok(sent!.get('code_verifier'), 'the PKCE verifier went to Google');
  assert.equal(sent!.get('code'), 'abc');
});

test('a callback that did not start in this browser, or with a swapped state, is refused before Google is asked', async () => {
  const start = startGoogleFlow(req('https://ainize.ai/api/auth/google/start'), config, '/', NOW);
  const state = new URL(start.authorizeUrl).searchParams.get('state')!;
  const neverCalled = (async () => { throw new Error('token endpoint must not be reached'); }) as unknown as typeof fetch;
  await assert.rejects(finishGoogleFlow(req(`https://ainize.ai/cb?state=${state}&code=c`), config, undefined, neverCalled, NOW), GoogleOAuthError);
  await assert.rejects(finishGoogleFlow(req('https://ainize.ai/cb?state=other&code=c'), config, start.flowCookie, neverCalled, NOW), GoogleOAuthError);
  await assert.rejects(finishGoogleFlow(req(`https://ainize.ai/cb?state=${state}&code=c`), config, start.flowCookie, neverCalled, NOW + 11 * 60_000), GoogleOAuthError, 'flow older than 10 minutes');
});

test('the Google module is server-only — imported by a component it would ship the client secret handling to every visitor', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const walk = (dir: string): string[] => (!existsSync(dir) ? [] : readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : [f];
  }));
  const offenders = walk(join(root, 'src'))
    .filter((f) => /\.tsx?$/.test(f) && /from '[^']*lib\/googleOAuth'/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(root.length + 1));
  assert.deepEqual(offenders, []);
});
