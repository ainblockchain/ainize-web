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

test('app routes and look-alike prefixes stay route changes', () => {
  assert.equal(servedOutsideApp('/'), false);
  assert.equal(servedOutsideApp('/my-nodes'), false);
  assert.equal(servedOutsideApp('/codex'), false);
  assert.equal(servedOutsideApp('/agent/code'), false);
});
