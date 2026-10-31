import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directSignIn, type SignInFlow } from '../src/lib/signInFlow';
const flow = (query = '', extra: Partial<SignInFlow> = {}): SignInFlow => ({
  loading: false, signedIn: false, ssoConfigured: true, googleConfigured: false, optionsFailed: false,
  params: new URLSearchParams(query), ...extra,
});

test('ordinary login has one account-provider hop with the complete return URL', () => {
  const next = '/team/repo?project=apps%2Fweb&tab=logs#output';
  assert.deepEqual(directSignIn(flow(`next=${encodeURIComponent(next)}`)), { kind: 'provider', href: `/api/auth/sso/start?next=${encodeURIComponent(next)}` });
  assert.deepEqual(directSignIn(flow()), { kind: 'provider', href: '/api/auth/sso/start?next=%2Fme' });
});

test('all signed-in account types resume without a second continue or wallet step', () => {
  assert.deepEqual(directSignIn(flow('next=%2Fapps', { signedIn: true })), { kind: 'return', href: '/apps' });
  assert.deepEqual(directSignIn(flow('next=%2Fapps', { signedIn: true, optionsFailed: true })), { kind: 'return', href: '/apps' });
});

test('loading, failure, account linking and explicit wallet work never start an automatic login loop', () => {
  for (const query of ['sso_error=denied', 'sso_error=', 'google_error=failed', 'sso=connect', 'token=invite', 'wallet=1', 'options=1']) {
    assert.equal(directSignIn(flow(query)), null, query);
    assert.equal(directSignIn(flow(query, { signedIn: true })), null, query);
  }
  assert.equal(directSignIn(flow('', { loading: true })), null);
  assert.equal(directSignIn(flow('', { optionsFailed: true })), null);
});

test('provider fallback follows server configuration; no wallet proof is fabricated', () => {
  assert.deepEqual(directSignIn(flow('', { ssoConfigured: false, googleConfigured: true })), { kind: 'provider', href: '/api/auth/google/start?next=%2Fme' });
  assert.equal(directSignIn(flow('', { ssoConfigured: false })), null);
});

test('automatic login rejects external and self-return destinations', () => {
  for (const next of ['https://example.test', '//example.test', '/\\example.test', '/signing?next=/apps']) {
    assert.equal(directSignIn(flow(`next=${encodeURIComponent(next)}`))?.href, '/api/auth/sso/start?next=%2Fme');
  }
});
