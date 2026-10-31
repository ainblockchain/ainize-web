import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseResult, purchaseQuoteTotals } from '../src/lib/purchaseResult';
const result = (): any => ({ receipt_version: 1, node: 'node', patch_id: 'item', amount: '1', currency: 'AIN', scheme: 'ain-transfer', tx_hash: 'tx', path: '/file',
  manifest: { id: 'item', patch_sha256: 'file', blob_urls: [] }, steps: [], purchases: [{ patch_id: 'base', amount: '2', currency: 'CREDIT', scheme: 'local-credit', tx_hash: 'base-tx' },
    { patch_id: 'item', amount: '1', currency: 'AIN', scheme: 'ain-transfer', tx_hash: 'tx' }], totals: [{ amount: '1', currency: 'AIN' }, { amount: '2', currency: 'CREDIT' }] });
test('receipt parsing retains separate currencies and rejects contradictory scalar totals', () => {
  const r = result(); assert.equal(purchaseResult(r, 'item', 'file', 'node')?.totals?.length, 2);
  assert.equal(purchaseResult({ ...r, total: '3' }, 'item', 'file', 'node'), null);
  assert.equal(purchaseResult({ ...r, redeemed: true }, 'item', 'file', 'node'), null);
  assert.equal(purchaseResult(r, 'other', 'file', 'node'), null);
  assert.equal(purchaseResult({ ...r, amount: '10' }, 'item', 'file', 'node'), null);
});
test('unknown versions, unrelated files and incomplete receipts remain unconfirmed', () => {
  const r = result(); delete r.receipt_version; assert.equal(purchaseResult(r, 'item', 'file', 'node'), null);
  assert.equal(purchaseResult(result(), 'item', 'other', 'node'), null);
  assert.equal(purchaseResult({ ...result(), steps: [{}] }, 'item', 'file', 'node'), null);
});
test('quote display recomputes exact units rather than repeating a mixed scalar', () => {
  const q: any = { price: '0.00000001', currency: 'AIN', total: '999', unknown: [], requires: [{ id: 'base', known: true, price: '2', currency: 'CREDIT', licensed: false, mine: false }] };
  assert.equal(purchaseQuoteTotals(q), '0.00000001 AIN + 2 CREDIT');
  assert.equal(purchaseQuoteTotals({ ...q, totals: [{ amount: '2', currency: 'AIN' }] }), null);
  assert.equal(purchaseQuoteTotals({ ...q, unknown: ['missing'] }), null);
  assert.equal(purchaseQuoteTotals({ ...q, requires: [null] }), null);
  assert.equal(purchaseQuoteTotals({ ...q, requires: [q.requires[0], q.requires[0]] }), null);
});
