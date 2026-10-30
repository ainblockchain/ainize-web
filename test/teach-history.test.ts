import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptBasketDraft, BASKET_PREFIX, carryBasket, chatStorageOwner, clearBasket, clearJobs, forgetJob, JOBS_KEY, legacyBaskets, loadBasket, loadJobs, rememberJob, saveBasket, strandedBaskets, type Basket } from '../src/lib/teachStore';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let values: Map<string, string>;
let rejectWrites = false;
beforeEach(() => {
  values = new Map();
  rejectWrites = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { if (rejectWrites) throw new Error('quota'); values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    get length() { return values.size; },
    key: (i: number) => [...values.keys()][i] ?? null,
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('history, deduplication and removal belong to the captured teaching identity', () => {
  const a = { id: 'same-id', name: 'A lesson', created_at: 1 };
  const b = { ...a, name: 'B lesson' };
  rememberJob(a, '0xABC'); rememberJob(b, '0xdef');
  rememberJob({ ...a, name: 'A updated' }, '0xabc');
  assert.deepEqual(loadJobs('0xABC'), [{ ...a, name: 'A updated' }]);
  assert.deepEqual(loadJobs('0xdef'), [b]);
  forgetJob(a.id, '0xabc');
  assert.deepEqual(loadJobs('0xabc'), []);
  assert.deepEqual(loadJobs('0xdef'), [b]);
  clearJobs('0xdef'); assert.deepEqual(loadJobs('0xdef'), []);
});

test('legacy records are retained but never assigned to an anonymous or unrelated teacher', () => {
  values.set(JOBS_KEY, JSON.stringify([{ id: 'unowned-private-job', created_at: 1 }]));
  for (const owner of ['', '0xabc', '0xdef']) assert.deepEqual(loadJobs(owner), []);
  rememberJob({ id: 'anonymous', created_at: 1 }, '');
  clearJobs('');
  assert.ok(values.get(JOBS_KEY)?.includes('unowned-private-job'));
  assert.equal(values.size, 1);
});

test('damaged and unavailable history storage does not break the page', () => {
  values.set(`${JOBS_KEY}:0xabc`, 'null'); assert.deepEqual(loadJobs('0xabc'), []);
  values.set(`${JOBS_KEY}:0xabc`, '{broken'); assert.deepEqual(loadJobs('0xabc'), []);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('unavailable'); } });
  assert.deepEqual(loadJobs('0xabc'), []);
  assert.doesNotThrow(() => rememberJob({ id: 'one', created_at: 1 }, '0xabc'));
});

const draft: Basket = { facts: [{ id: 'fact', prompt: 'Question', answer: 'Answer', added_at: 1 }], builds_on: false };
test('baskets and stranded-draft recovery are isolated by both account and teaching key', () => {
  const a = chatStorageOwner('account-a', '0xABC');
  const b = chatStorageOwner('account-b', '0xabc');
  const c = chatStorageOwner('account-a', '0xdef');
  saveBasket(['one'], draft, a);
  assert.deepEqual(loadBasket(['one'], chatStorageOwner('account-a', '0xabc')), draft);
  for (const owner of [b, c]) {
    assert.equal(loadBasket(['one'], owner).facts.length, 0);
    assert.deepEqual(strandedBaskets([], owner), []);
    clearBasket(['one'], owner);
  }
  assert.deepEqual(strandedBaskets([], a), [{ ids: ['one'], facts: 1 }]);
  assert.deepEqual(carryBasket(['one'], ['two'], a), draft);
  assert.equal(loadBasket(['one'], a).facts.length, 0);
  assert.deepEqual(loadBasket(['two'], a), draft);
});

test('draft movement preserves occupied targets and the source when storage is full', () => {
  saveBasket(['one'], draft, 'a');
  const target: Basket = { facts: [], builds_on: true, base: 'chosen-base' };
  saveBasket(['two'], target, 'a');
  assert.deepEqual(carryBasket(['one'], ['two'], 'a'), target);
  assert.deepEqual(loadBasket(['one'], 'a'), draft);
  rejectWrites = true;
  assert.deepEqual(carryBasket(['one'], ['three'], 'a'), draft);
  assert.deepEqual(loadBasket(['one'], 'a'), draft, 'never remove the only saved copy after a failed write');
});

test('legacy drafts are exportable without being adopted by any identity', () => {
  values.set(`${BASKET_PREFIX}old-stack`, JSON.stringify(draft));
  values.set(`${BASKET_PREFIX}broken`, 'null');
  saveBasket(['scoped'], draft, 'a');
  assert.deepEqual(legacyBaskets(), [{ ids: ['old-stack'], basket: draft }]);
  assert.deepEqual(strandedBaskets([], 'a'), [{ ids: ['scoped'], facts: 1 }]);
  assert.equal(loadBasket(['old-stack'], 'a').facts.length, 0);
  assert.ok(values.has(`${BASKET_PREFIX}old-stack`));
});

test('first-key handoff preserves the current draft while an imported key keeps its existing work', () => {
  const incoming = { ...draft, retry_of: 'current-retry', base: 'current-base' };
  assert.deepEqual(acceptBasketDraft([], incoming, 'fresh', 'new-key'), { conflict: false, basket: incoming });
  assert.deepEqual(loadBasket([], 'fresh'), incoming);
  assert.deepEqual(acceptBasketDraft([], draft, 'fresh', 'import-key'), { conflict: true });
  assert.deepEqual(loadBasket([], 'fresh'), incoming, 'an import cannot silently replace lineage or corrections');
  assert.deepEqual(acceptBasketDraft([], draft, 'fresh', 'keep-saved'), { conflict: false, basket: incoming });
  rejectWrites = true;
  assert.deepEqual(acceptBasketDraft([], draft, 'unpersisted', 'new-key'), { conflict: false, basket: draft }, 'keep the live draft when browser storage is unavailable');
});
