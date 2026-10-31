import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { activateIssuedKeyOwner, rememberIssuedKey, recallIssuedKey, forgetIssuedKey, subscribeIssuedKey } from '../src/screens/models/issuedKeyMemory';

const slot = 'ainize.issuedApiKey';
const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  } });
  activateIssuedKeyOwner(null);
});
afterEach(() => {
  activateIssuedKeyOwner(null);
  if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
});

test('a held key is visible only to the account that created it', () => {
  activateIssuedKeyOwner('account-a');
  assert.equal(rememberIssuedKey('account-a', 'fixture-secret-a'), true);
  assert.equal(recallIssuedKey('account-a'), 'fixture-secret-a');
  assert.equal(recallIssuedKey('account-b'), null);
  assert.equal(recallIssuedKey(''), null);
  activateIssuedKeyOwner('account-b');
  assert.equal(recallIssuedKey('account-a'), null);
  assert.equal(recallIssuedKey('account-b'), null);
  assert.equal(storage.has(slot), false);
  activateIssuedKeyOwner('account-a');
  assert.equal(recallIssuedKey('account-a'), null, 'switching back must not resurrect a cleared secret');
});

test('late creation responses cannot restore a key after logout or an account change', () => {
  activateIssuedKeyOwner('account-a');
  activateIssuedKeyOwner(null);
  assert.equal(rememberIssuedKey('account-a', 'late-secret'), false);
  activateIssuedKeyOwner('account-b');
  assert.equal(rememberIssuedKey('account-a', 'late-secret'), false);
  assert.equal(storage.has(slot), false);
});

test('reload restores only an explicitly owned value; legacy or corrupt values are discarded', () => {
  storage.set(slot, JSON.stringify({ owner: 'account-a', key: 'restored-fixture' }));
  activateIssuedKeyOwner('account-a');
  assert.equal(recallIssuedKey('account-a'), 'restored-fixture');
  activateIssuedKeyOwner(null);
  for (const value of ['legacy-unscoped-secret', '{broken', JSON.stringify({ key: 'no-owner' })]) {
    storage.set(slot, value);
    activateIssuedKeyOwner('account-a');
    assert.equal(recallIssuedKey('account-a'), null);
    assert.equal(storage.has(slot), false);
  }
});

test('another account cannot forget or overwrite the current account key', () => {
  activateIssuedKeyOwner('account-b');
  rememberIssuedKey('account-b', 'fixture-b');
  forgetIssuedKey('account-a');
  assert.equal(rememberIssuedKey('account-a', 'fixture-a'), false);
  assert.equal(recallIssuedKey('account-b'), 'fixture-b');
  forgetIssuedKey('account-b');
  assert.equal(recallIssuedKey('account-b'), null);
});

test('changes notify every mounted consumer, and unsubscribed consumers stop receiving changes', () => {
  let calls = 0;
  const unsubscribe = subscribeIssuedKey(() => { calls++; });
  activateIssuedKeyOwner('account-a');
  rememberIssuedKey('account-a', 'fixture');
  forgetIssuedKey('account-a');
  assert.equal(calls, 3);
  unsubscribe();
  activateIssuedKeyOwner(null);
  assert.equal(calls, 3);
});

test('blocked session storage keeps a current-account copy only until sign-out', () => {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('storage blocked'); } });
  activateIssuedKeyOwner('account-a');
  rememberIssuedKey('account-a', 'private-mode-fixture');
  assert.equal(recallIssuedKey('account-a'), 'private-mode-fixture');
  activateIssuedKeyOwner(null);
  assert.equal(recallIssuedKey('account-a'), null);
});

test('revocation forgets a held secret by its hash identifier, never its raw prefix', async () => {
  const { apiKeyHash, apiKeyPrefix } = await import('../src/api/apiKeyEvidence');
  const { forgetIssuedKeyById } = await import('../src/screens/models/issuedKeyMemory');
  const secret = 'ainize-sk-' + 'a'.repeat(32);
  activateIssuedKeyOwner('account-a');
  rememberIssuedKey('account-a', secret);
  assert.equal(forgetIssuedKeyById('account-a', secret.slice(0, 8)), false);
  assert.equal(forgetIssuedKeyById('account-b', apiKeyPrefix(secret)), false);
  assert.equal(recallIssuedKey('account-a'), secret);
  assert.equal(forgetIssuedKeyById('account-a', apiKeyPrefix(secret)), true);
  assert.equal(recallIssuedKey('account-a'), null);
  assert.equal(storage.has(slot), false);
});

test('held secrets cannot cross nodes even when the account is unchanged', async () => {
  const { issuedKeyScope } = await import('../src/screens/models/issuedKeyMemory');
  const a = issuedKeyScope('same-account', '0x' + 'a'.repeat(40));
  const b = issuedKeyScope('same-account', '0x' + 'b'.repeat(40));
  assert.equal(a, issuedKeyScope('same-account', '0x' + 'A'.repeat(40)));
  assert.equal(issuedKeyScope('same-account', null), '');
  assert.equal(issuedKeyScope('same-account', 'unknown'), '');
  activateIssuedKeyOwner(a);
  rememberIssuedKey(a, 'fixture-a');
  assert.equal(recallIssuedKey(b), null);
  activateIssuedKeyOwner(b);
  assert.equal(rememberIssuedKey(a, 'late-fixture-a'), false);
  assert.equal(recallIssuedKey(b), null);
  activateIssuedKeyOwner(a);
  assert.equal(recallIssuedKey(a), null);
});

test('upgrading account-only storage preserves the sole secret until the owned node list proves it', async () => {
  const { apiKeyHash, apiKeyPrefix } = await import('../src/api/apiKeyEvidence');
  const { issuedKeyScope, adoptLegacyIssuedKey } = await import('../src/screens/models/issuedKeyMemory');
  const secret = 'ainize-sk-' + 'a'.repeat(32);
  const scope = issuedKeyScope('account-a', '0x' + 'a'.repeat(40));
  storage.set(slot, JSON.stringify({ owner: 'account-a', key: secret }));
  activateIssuedKeyOwner(scope);
  assert.equal(recallIssuedKey(scope), null, 'not yet bound to this node');
  assert.equal(storage.has(slot), true, 'do not lose the only copy on upgrade');
  for (const listing of [null, {}, { keys: [] }, { keys: [{ prefix: apiKeyPrefix(secret), issuedAt: 1, label: null }] }, { keys: [{ prefix: apiKeyPrefix(secret), key_id: apiKeyHash(secret), issuedAt: 1, label: null, disabled: true }] }]) {
    assert.equal(adoptLegacyIssuedKey(scope, listing), false);
    assert.equal(recallIssuedKey(scope), null);
  }
  const listing = { keys: [{ prefix: apiKeyPrefix(secret), key_id: apiKeyHash(secret), issuedAt: 1, label: null }] };
  assert.equal(adoptLegacyIssuedKey('other-account', listing), false);
  assert.equal(adoptLegacyIssuedKey(scope, listing), true);
  assert.equal(recallIssuedKey(scope), secret);
  assert.equal(JSON.parse(storage.get(slot)!).owner, scope);
  assert.equal(adoptLegacyIssuedKey(scope, listing), false, 'no recursive adoption on storage notifications');
});

test('an unconfirmed legacy secret is cleared on logout or account change', async () => {
  const { issuedKeyScope, adoptLegacyIssuedKey } = await import('../src/screens/models/issuedKeyMemory');
  const scope = issuedKeyScope('account-a', '0x' + 'a'.repeat(40));
  for (const next of [null, issuedKeyScope('account-b', '0x' + 'a'.repeat(40))]) {
    storage.set(slot, JSON.stringify({ owner: 'account-a', key: 'fixture' }));
    activateIssuedKeyOwner(scope);
    activateIssuedKeyOwner(next);
    assert.equal(storage.has(slot), false);
    assert.equal(adoptLegacyIssuedKey(scope, { keys: [] }), false);
  }
});

test('full-hash revocation clears exactly the held secret and preserves another key', async () => {
  const { apiKeyHash } = await import('../src/api/apiKeyEvidence');
  const { forgetIssuedKeyById, recallIssuedKeyRecord } = await import('../src/screens/models/issuedKeyMemory');
  const secret = 'ainize-sk-' + 'a'.repeat(32);
  activateIssuedKeyOwner('account-a');
  rememberIssuedKey('account-a', secret, 100);
  assert.equal(recallIssuedKeyRecord('account-a')?.receivedAt, 100);
  assert.equal(forgetIssuedKeyById('account-a', apiKeyHash('different-key')), false);
  assert.equal(recallIssuedKey('account-a'), secret);
  assert.equal(forgetIssuedKeyById('account-a', apiKeyHash(secret)), true);
  assert.equal(recallIssuedKeyRecord('account-a'), null);
});
