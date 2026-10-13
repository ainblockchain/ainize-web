/**
 * Where the sign-in page sends people next (src/lib/nextNavigation.ts): paths another service serves on this
 * origin need a full page load, everything else stays a route change.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { servedOutsideApp } from '../src/lib/nextNavigation';

test('the AinCode workspace at /code is served outside the app', () => {
  assert.equal(servedOutsideApp('/code'), true);
  assert.equal(servedOutsideApp('/code/'), true);
  assert.equal(servedOutsideApp('/code/abc/session/ses_1?x=1#m'), true);
  assert.equal(servedOutsideApp('/code?x=1'), true);
});

test('the node\'s /api (an org-private app\'s sign-in hop) is served outside the app', () => {
  assert.equal(servedOutsideApp('/api/projects/prj_1234567890abcdef/app-login?return=https%3A%2F%2Fa.ainetwork.xyz%2F'), true);
  assert.equal(servedOutsideApp('/api'), true);
  assert.equal(servedOutsideApp('/apis'), false);
});

test('app routes and look-alike prefixes stay route changes', () => {
  assert.equal(servedOutsideApp('/'), false);
  assert.equal(servedOutsideApp('/my-nodes'), false);
  assert.equal(servedOutsideApp('/codex'), false);
  assert.equal(servedOutsideApp('/agent/code'), false);
});
