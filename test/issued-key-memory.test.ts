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
