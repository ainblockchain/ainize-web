import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePurchaseReconciliation, confirmReconciledFiles } from '../src/lib/purchaseReconciliation';
import { reconciliationFixture } from './purchase-reconciliation-fixture';
import { manageFixture } from './fixtures/manageKnowledge';
test('recovery evidence binds the exact account, node, request, review and ordered files', () => {
  const { op, reconciliation: r } = reconciliationFixture();
  assert.ok(parsePurchaseReconciliation({ reconciliation: r }, op));
  for (const change of [{ request_id: 'd'.repeat(32) }, { node: 'other' }, { subject: 'other' }, { patch_id: 'other' },
    { revision: 'd'.repeat(64) }, { items: [...r.items].reverse() }]) {
    assert.equal(parsePurchaseReconciliation({ reconciliation: { ...r, ...change } }, op), null);
  }
  r.items[0].anchor.patch_sha256 = 'other'; assert.equal(parsePurchaseReconciliation({ reconciliation: r }, op), null);
});
test('completion cannot rely on existing files without this positive-price purchase evidence', () => {
  const { op, reconciliation: r } = reconciliationFixture(); r.items[1].payment = null;
  assert.equal(parsePurchaseReconciliation({ reconciliation: r }, op), null);
  r.items[1].state = 'unconfirmed'; r.state = 'incomplete';
  assert.ok(parsePurchaseReconciliation({ reconciliation: r }, op));
});
test('payment evidence rejects invented currency, over-budget amounts and contradictory free records', () => {
  for (const change of [{ amount: '0.00000002' }, { currency: 'USDC' }, { tx_hash: '' }, { scheme: 'free' }, { evidence: 'free' }, { evidence: 'unknown' }]) {
    const { op, reconciliation: r } = reconciliationFixture(); Object.assign(r.items[1].payment!, change);
    assert.equal(parsePurchaseReconciliation({ reconciliation: r }, op), null);
  }
});
test('only a missing confirmed file can expose collection, never running or unknown work', () => {
  const { op, reconciliation: r } = reconciliationFixture(); const i = r.items[0];
  r.state = 'incomplete'; i.state = 'paid_missing_file'; i.has_body = false; i.can_collect = true;
  assert.ok(parsePurchaseReconciliation({ reconciliation: r }, op));
  r.state = 'running'; assert.equal(parsePurchaseReconciliation({ reconciliation: r }, op), null);
  i.can_collect = false; assert.ok(parsePurchaseReconciliation({ reconciliation: r }, op));
  r.state = 'incomplete'; i.payment = null; assert.equal(parsePurchaseReconciliation({ reconciliation: r }, op), null);
  i.state = 'unconfirmed'; assert.ok(parsePurchaseReconciliation({ reconciliation: r }, op));
});
test('recovered completion requires fresh exact files and discards account departure', async () => {
  const { op, reconciliation: r } = reconciliationFixture(), reads: string[] = [];
  const read = async (id: string) => { reads.push(id); return { ...manageFixture(id), anchor: r.items.find(i => i.id === id)!.anchor }; };
  assert.equal(await confirmReconciledFiles(op, r, { current: () => true, read }), true); assert.deepEqual(reads, ['base', 'root']);
  await assert.rejects(confirmReconciledFiles(op, r, { current: () => true, read: async id => ({ ...await read(id), has_body: false }) }), /files/);
  let active = true;
  assert.equal(await confirmReconciledFiles(op, r, { current: () => active, read: async id => { active = false; return read(id); } }), false);
});
test('unavailable legacy evidence and partial outcomes cannot unlock completion', async () => {
  const { op, reconciliation: r } = reconciliationFixture(); r.state = 'unavailable'; r.items = [];
  assert.ok(parsePurchaseReconciliation({ reconciliation: r }, op));
  let reads = 0; assert.equal(await confirmReconciledFiles(op, r, { current: () => true, read: async () => { reads++; } }), false);
  assert.equal(reads, 0);
});
