import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseRows, purchaseStanding, purchasePayment } from '../src/lib/purchaseView';
import { purchaseFixture } from './fixtures/purchase';

const runtime = (id: string, sha256: string) => ({ available: true, hook: true, applied: [id], stack: [{ patch_id: id, sha256, reason: 'manual', applied_at: 1, position: 0 }] });
test('purchase views preserve exact transaction money and reject duplicate or wrong item rows', () => {
  const row = purchaseFixture(); assert.equal(purchaseRows({ items: [row] })?.[0].payment?.amount, '0.00000001');
  assert.equal(purchaseRows({ items: [row, row] }), null);
  row.entry.anchor.id = 'other'; assert.equal(purchaseRows({ items: [row] }), null);
});
test('unknown payment evidence does not become current listing currency or a zero payment', () => {
  const row = purchaseFixture(); delete row.payment;
  assert.equal(purchaseRows({ items: [row] })?.[0].payment, null);
  assert.equal(purchasePayment({ ...purchaseFixture().payment, tx_hash: 'other' }, 'tx'), null);
  assert.equal(purchasePayment({ ...purchaseFixture().payment, evidence: 'free' }, 'tx'), null);
});
test('current metadata may differ from the purchased file without enabling its actions', () => {
  const row = purchaseFixture(); row.entry.anchor.patch_sha256 = 'changed';
  assert.equal(purchaseRows({ items: [row] })?.[0].currentFile, false);
});
test('load standing distinguishes physical aliases, substituted files and missing evidence', () => {
  const row = purchaseFixture();
  assert.equal(purchaseStanding(row, runtime('selected', 'file'))?.state, 'recorded');
  assert.equal(purchaseStanding(row, runtime('alias', 'file'))?.state, 'alias');
  assert.equal(purchaseStanding(row, runtime('selected', 'other'))?.state, 'different');
  assert.equal(purchaseStanding(row, { available: true, hook: true, applied: [] }), null);
  assert.equal(purchaseStanding(row, { available: true, hook: true, applied: [], stack: [] })?.state, 'absent');
});
