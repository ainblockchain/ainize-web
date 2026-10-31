import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackCardQuote, trackStanding, trackWindowStats } from '../src/lib/trackCardEvidence';
import { trackReviewFixture } from './track-review-fixture';

const runtime = (patch_id = 'new', sha256 = 'file') => ({ available: true, hook: true, applied: [patch_id],
  stack: [{ patch_id, sha256, reason: 'manual', applied_at: 1, position: 0 }] });
const record = (hash: string, kind: string, body: any) => ({ hash, kind, author: 'author', ts: 1, body });
const settle = (hash: string, extra = {}) => record(hash, 'settle', { patch_id: 'new', buyer: 'buyer', seller: 'seller', scheme: 'local-credit', tx_hash: hash,
  amount: '0.00000001', currency: 'CREDIT', ...extra });
const window = (records: any[], total = records.length) => ({ info: { kind: 'local', network: 'fixture', records: total }, records });
test('standing confirms exact files including physical aliases, never a substituted file with the same ID', () => {
  const q = trackReviewFixture().quote;
  assert.deepEqual(trackStanding(['new'], q, runtime('physical-alias')), { loaded: ['new'], missing: [], total: 1 });
  assert.deepEqual(trackStanding(['new'], q, runtime('new', 'another-file')), { loaded: [], missing: ['new'], total: 1 });
});
test('missing file hashes, stack evidence or inconsistent snapshots keep standing unknown', () => {
  const q = trackReviewFixture().quote;
  assert.equal(trackStanding(['new'], q, { available: true, hook: true, applied: ['new'] }), null);
  assert.equal(trackStanding(['another'], q, runtime()), null);
  assert.equal(trackStanding(['new'], null, runtime()), null);
  assert.equal(trackStanding(['new'], { ...q, runtime_model: 'different' }, runtime()), null);
  q.items[0].patch_sha256 = undefined; assert.equal(trackStanding(['new'], q, runtime()), null);
});
test('card quotes validate actual membership, owner, plans and dates instead of crashing or guessing coverage', () => {
  const q = trackReviewFixture().quote;
  assert.ok(trackCardQuote({ quote: q }, 'selected', { owner: 'curator', patch_ids: ['new'], current: ['new'] }));
  assert.equal(trackCardQuote({ quote: q }, 'selected', { owner: 'changed-owner', patch_ids: ['new'], current: ['new'] }), null);
  assert.equal(trackCardQuote({ quote: q }, 'selected', { owner: 'curator', patch_ids: ['new', 'blocked'], current: ['new'] }), null);
  for (const value of [{ ...q, items: [{}] }, { ...q, current: [] }, { ...q, buy: [] },
    { ...q, subscription: { ...q.subscription, paid_until: 1e30 } }]) assert.equal(trackCardQuote({ quote: value }, 'selected'), null);
});
test('ledger summaries explicitly retain their window and distinguish joins from departures', () => {
  const rows = [record('join', 'subscribe', { branch: 'selected', node: 'n', action: 'subscribe' }),
    record('left', 'subscribe', { branch: 'selected', node: 'n', action: 'unsubscribe' }),
    record('other', 'subscribe', { branch: 'another', node: 'n', action: 'subscribe' })];
  const stats = trackWindowStats(window(rows, 9000), 'selected', ['new'])!;
  assert.equal(stats.joined, 1); assert.equal(stats.left, 1); assert.equal(stats.window, 3); assert.equal(stats.available, 9000); assert.equal(stats.partial, true);
  assert.equal(trackWindowStats(window(rows), 'selected', ['new'])!.partial, false);
});
test('settlement summaries exclude free/self transfers, deduplicate payments and keep exact currencies separate', () => {
  const first = settle('one'), duplicate = settle('duplicate', { tx_hash: 'one', amount: '0.000000010' });
  const rows = [first, duplicate, settle('two'), settle('ain', { currency: 'AIN', amount: '2' }), settle('free', { amount: '0' }),
    settle('self', { buyer: 'SELLER' }), settle('other', { patch_id: 'not-in-track' })];
  const stats = trackWindowStats(window(rows), 'selected', ['new'])!;
  assert.equal(stats.settlements, 3); assert.deepEqual(stats.totals, [{ currency: 'CREDIT', amount: '0.00000002' }, { currency: 'AIN', amount: '2' }]);
});
test('failed-shaped or contradictory histories cannot turn into zero or inflated totals', () => {
  assert.equal(trackWindowStats({ error: 'offline' }, 'selected', ['new']), null);
  assert.equal(trackWindowStats(window([settle('one'), settle('two', { tx_hash: 'one', amount: '100' })]), 'selected', ['new']), null);
  assert.equal(trackWindowStats(window([settle('one'), settle('one')]), 'selected', ['new']), null);
  assert.equal(trackWindowStats(window([settle('one', { amount: 'NaN' })]), 'selected', ['new']), null);
  assert.equal(trackWindowStats(window([record('invalid', 'subscribe', { branch: 'selected', node: 'n', action: 'unknown' })]), 'selected', ['new']), null);
  assert.equal(trackWindowStats(window([settle('one', { tx_hash: null })]), 'selected', ['new']), null);
});
