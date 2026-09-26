/**
 * This app vouches to the node for a Google account it signed in, on /api/keys only (src/lib/siteAssertion.ts).
 *
 *   node --test --import tsx test/site-assertion.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_SESSION_COOKIE, mintGoogleSessionCookie } from '../src/lib/googleOAuth';
import { signSiteSubject, siteSubjectFor, vouchesFor } from '../src/lib/siteAssertion';

const env = {
  GOOGLE_CLIENT_ID: 'client-123.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'shh',
  AINIZE_WEB_SESSION_SECRET: 'k'.repeat(32), AINIZE_SITE_ASSERTION_SECRET: 'v'.repeat(40),
} as NodeJS.ProcessEnv;
const config = { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: 'shh', sessionSecret: env.AINIZE_WEB_SESSION_SECRET!, redirectUri: null };
const NOW = 1_790_000_000_000;
const signedIn = (cookie: string) => new Request('https://ainize.ai/api/keys', { headers: { cookie: `a=b; ${GOOGLE_SESSION_COOKIE}=${encodeURIComponent(cookie)}` } });
const cookie = mintGoogleSessionCookie({ sub: '42', email: 'a@b.c', name: null, picture: null }, config, NOW);

test('the signing format matches the node (the same vector is pinned in ainize-node)', () => {
  assert.equal(signSiteSubject('s'.repeat(32), 'google:1234567890', 1790000000), 'google:1234567890.1790000000.c2a430649d5c90d92d7243695f1d2e0f397316959d796104dafeb2f7ad8dee3a');
});

test('a Google session is vouched for as google:<sub>, signed with the shared secret', () => {
  const v = siteSubjectFor(signedIn(cookie), NOW, env);
  assert.equal(v, signSiteSubject(env.AINIZE_SITE_ASSERTION_SECRET!, 'google:42', NOW / 1000));
});

test('nothing is vouched for without a session, a valid cookie, or the secret', () => {
  assert.equal(siteSubjectFor(new Request('https://ainize.ai/api/keys'), NOW, env), null);
  assert.equal(siteSubjectFor(signedIn(cookie + 'x'), NOW, env), null, 'a tampered cookie is no session');
  assert.equal(siteSubjectFor(signedIn(cookie), NOW, { ...env, AINIZE_SITE_ASSERTION_SECRET: '' }), null);
  assert.equal(siteSubjectFor(signedIn(cookie), NOW, { ...env, AINIZE_SITE_ASSERTION_SECRET: 'short' }), null);
});

test('only /api/keys carries it', () => {
  assert.ok(vouchesFor('/api/keys'));
  assert.ok(vouchesFor('/api/keys/abc'));
  for (const p of ['/api/keysx', '/api/auth/me', '/api/patches', '/agents/x', '/api/']) assert.ok(!vouchesFor(p), p);
});
