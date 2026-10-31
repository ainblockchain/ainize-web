import { purchaseRequestFixture } from './purchase-review-fixture';
import type { PurchaseReconciliation } from '../src/lib/purchaseReconciliation';
export function reconciliationFixture() {
  const { op, request } = purchaseRequestFixture();
  const reconciliation: PurchaseReconciliation = { version: 1, request_id: op.id, node: op.review.node, subject: op.subject!,
    patch_id: op.review.patch_id, revision: op.review.revision, evidence_revision: 'c'.repeat(64), state: 'complete',
    items: op.review.items.map(i => ({ id: i.anchor.id, anchor: structuredClone(i.anchor), state: 'complete', has_body: true, can_collect: false,
      payment: { evidence: 'settlement', amount: i.anchor.price, currency: i.anchor.currency, scheme: 'fixture', tx_hash: i.anchor.id } })) };
  return { op, request, reconciliation };
}
