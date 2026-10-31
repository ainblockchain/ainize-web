import type { PurchaseReview, PurchaseOperation } from '../src/lib/purchaseReview';
import { manageFixture } from './fixtures/manageKnowledge';
export const purchaseReviewNode = `0x${'11'.repeat(20)}`, purchaseReviewSubject = `0x${'22'.repeat(20)}`;
export function purchaseReviewFixture(): PurchaseReview {
  const base = manageFixture('base').anchor, root = manageFixture('root').anchor;
  base.price = '2'; base.currency = 'CREDIT'; root.price = '0.00000001'; root.currency = 'AIN';
  root.base = { stack: [{ patch_id: 'base' }] } as any;
  return { version: 1, revision: 'a'.repeat(64), node: purchaseReviewNode, patch_id: 'root', again: false,
    items: [base, root].map(anchor => ({ anchor, status: 'VERIFIED', sellable: true, challenged: false, owned: false, purchased: false, licensed: false, has_body: false, pending: false, action: 'buy' })),
    maximum: [{ amount: '0.00000001', currency: 'AIN' }, { amount: '2', currency: 'CREDIT' }] };
}
export function purchaseRequestFixture() {
  const review = purchaseReviewFixture(), op: PurchaseOperation = { owner: 'owner-key', id: 'b'.repeat(32), subject: purchaseReviewSubject, review };
  const items = review.items.map(i => ({ id: i.anchor.id, sha256: i.anchor.patch_sha256, state: 'complete', receipt: {
    receipt_version: 1, node: review.node, patch_id: i.anchor.id, path: '/file', amount: i.anchor.price, currency: i.anchor.currency, tx_hash: i.anchor.id, scheme: 'fixture',
    manifest: { id: i.anchor.id, patch_sha256: i.anchor.patch_sha256, blob_urls: [] }, steps: [], totals: [{ amount: i.anchor.price, currency: i.anchor.currency }],
  } }));
  const request: any = { version: 1, id: op.id, node: review.node, subject: op.subject, patch_id: 'root', again: false, revision: review.revision,
    state: 'finished', created_at: 1, updated_at: 2, error: null,
    result: { version: 1, node: review.node, patch_id: 'root', again: false, revision: review.revision, state: 'complete', items, confirmed_totals: review.maximum } };
  return { op, request };
}
