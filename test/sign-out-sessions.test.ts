import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signOutSessions } from '../src/auth/signOutSessions';

const ok = async () => ({ ok: true });
const failed = async () => { throw new Error('network unavailable'); };

test('every active cookie family must confirm logout before success', async () => {
  assert.equal(await signOutSessions({ nodeActive: true, googleActive: true, node: ok, google: ok }), true);
  assert.equal(await signOutSessions({ nodeActive: true, googleActive: true, node: failed, google: ok }), false);
  assert.equal(await signOutSessions({ nodeActive: true, googleActive: true, node: ok, google: failed }), false);
  assert.equal(await signOutSessions({ nodeActive: true, googleActive: false, node: async () => ({ ok: false }), google: ok }), false);
});

test('inactive providers do not prevent the active account from completing logout', async () => {
  assert.equal(await signOutSessions({ nodeActive: true, googleActive: false, node: ok, google: failed }), true);
  assert.equal(await signOutSessions({ nodeActive: false, googleActive: true, node: failed, google: ok }), true);
});

test('one provider failure still attempts the other and a later retry can succeed', async () => {
  let first = true, googleCalls = 0;
  const input = { nodeActive: true, googleActive: true, node: async () => { if (first) { first = false; throw new Error('offline'); } return { ok: true }; }, google: async () => { googleCalls++; return { ok: true }; } };
  assert.equal(await signOutSessions(input), false);
  assert.equal(googleCalls, 1);
  assert.equal(await signOutSessions(input), true);
  assert.equal(googleCalls, 2);
});

test('synchronous provider errors are handled and both operations settle before returning', async () => {
  let finish!: (value: unknown) => void;
  let completed = false;
  const pending = signOutSessions({ nodeActive: true, googleActive: true, node: () => { throw new Error('unavailable'); }, google: () => new Promise(resolve => { finish = resolve; }) }).then(value => { completed = true; return value; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(completed, false);
  finish({ ok: true });
  assert.equal(await pending, false);
});
