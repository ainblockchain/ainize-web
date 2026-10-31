import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePurchaseReview, parsePurchaseRequest, parsePurchaseOutcome, reviewPurchase, confirmPurchase, confirmPurchasedFiles,
  claimPurchaseOperation, readPurchaseOperation, clearPurchaseOperation } from '../src/lib/purchaseReview';
import { purchaseRequestFixture, purchaseReviewFixture, purchaseReviewNode as node, purchaseReviewSubject as subject } from './purchase-review-fixture';
import { manageFixture } from './fixtures/manageKnowledge';
const storage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } }; };
const deps = () => ({ current: () => true, node, subject, readAccess: async (): Promise<any> => ({ signedIn: true, isOwner: true, address: node, subject }), review: async (): Promise<unknown> => ({ review: purchaseReviewFixture() }) });
test('review parsing binds selected artifact, current node, complete ordered items and exact maximums', () => {
  const r = purchaseReviewFixture(), target = r.items.at(-1)!.anchor;
  assert.equal(parsePurchaseReview({ review: r }, target, node, false)?.items.length, 2);
  for (const changed of [{ ...r, node: subject }, { ...r, again: true }, { ...r, maximum: [{ amount: '2.00000001', currency: 'AIN' }] }, { ...r, items: [...r.items].reverse() }]) {
    assert.equal(parsePurchaseReview({ review: changed }, target, node, false), null);
  }
  assert.equal(parsePurchaseReview({ review: r }, { ...target, patch_sha256: 'other' }, node, false), null);
});
test('fresh access and review changes refuse before intent or submission', async () => {
  const { op } = purchaseRequestFixture(); let claimed = 0, writes = 0;
  const d = { ...deps(), claim: async () => { claimed++; }, write: async () => { writes++; } };
  d.readAccess = async () => ({ signedIn: true, isOwner: false, address: node, subject });
  await assert.rejects(confirmPurchase(op, d), /access/);
  d.readAccess = deps().readAccess;
  d.review = async () => ({ review: { ...op.review, revision: 'c'.repeat(64) } });
  await assert.rejects(confirmPurchase(op, d), /changed/); assert.equal(claimed, 0); assert.equal(writes, 0);
});
test('confirmation persists intent before a single exact submission and accepts only matching outcome', async () => {
  const { op, request } = purchaseRequestFixture(), s = storage(); let calls = 0;
  const value = await confirmPurchase(op, { ...deps(), claim: async () => claimPurchaseOperation(s, op), write: async () => {
    assert.equal(readPurchaseOperation(s, op.owner)?.id, op.id); calls++; return { request };
  } });
  assert.equal(value?.state, 'finished'); assert.equal(calls, 1);
  assert.throws(() => claimPurchaseOperation(s, op), /pending/);
});
test('storage failure, departure or a lost reply never starts an automatic replacement purchase', async () => {
  const { op } = purchaseRequestFixture(); let calls = 0;
  await assert.rejects(confirmPurchase(op, { ...deps(), claim: async () => { throw new Error('disk'); }, write: async () => { calls++; } }), /disk/);
  assert.equal(calls, 0);
  let active = true;
  assert.equal(await confirmPurchase(op, { ...deps(), current: () => active, claim: async () => { active = false; }, write: async () => { calls++; } }), null); assert.equal(calls, 0);
  const s = storage();
  await assert.rejects(confirmPurchase(op, { ...deps(), claim: async () => claimPurchaseOperation(s, op), write: async () => { calls++; throw new Error('lost'); } }), /unconfirmed/);
  assert.equal(calls, 1); assert.equal(readPurchaseOperation(s, op.owner)?.id, op.id);
});
test('request recovery refuses other accounts, IDs and inconsistent or over-budget payment outcomes', () => {
  const { op, request } = purchaseRequestFixture(); assert.ok(parsePurchaseRequest({ request }, op));
  for (const change of [{ subject: node }, { id: 'c'.repeat(32) }, { revision: 'c'.repeat(64) }, { node: subject }]) {
    assert.equal(parsePurchaseRequest({ request: { ...request, ...change } }, op), null);
  }
  const over = structuredClone(request.result); over.items[0].receipt.amount = '3'; over.items[0].receipt.totals[0].amount = '3';
  assert.equal(parsePurchaseOutcome(over, op.review), null);
  assert.equal(parsePurchaseOutcome({ ...request.result, confirmed_totals: [] }, op.review), null);
});
test('partial outcomes preserve completed charges without implying the failed item was free', () => {
  const { op, request } = purchaseRequestFixture(), r = request.result;
  r.state = 'incomplete'; r.items[1] = { id: 'root', sha256: op.review.items[1].anchor.patch_sha256, state: 'failed', error: 'lost' };
  r.confirmed_totals = [{ amount: '2', currency: 'CREDIT' }];
  assert.equal(parsePurchaseRequest({ request }, op)?.result?.state, 'incomplete');
  assert.equal(parsePurchaseOutcome({ ...r, state: 'complete' }, op.review), null);
});
test('completion confirms fresh storage for every selected file and does not load a model', async () => {
  const { op, request } = purchaseRequestFixture(); const seen: string[] = [];
  const read = async (id: string) => { seen.push(id); return { ...manageFixture(id), anchor: op.review.items.find(i => i.anchor.id === id)!.anchor }; };
  assert.equal(await confirmPurchasedFiles(op, request, { current: () => true, read }), true); assert.deepEqual(seen, ['base', 'root']);
  await assert.rejects(confirmPurchasedFiles(op, request, { current: () => true, read: async id => ({ ...await read(id), has_body: false }) }), /files/);
  const s = storage(); claimPurchaseOperation(s, op); clearPurchaseOperation(s, op); assert.equal(readPurchaseOperation(s, op.owner), null);
});
test('read-only review departure discards the result', async () => {
  const r = purchaseReviewFixture(); let active = true;
  assert.equal(await reviewPurchase(r.items.at(-1)!.anchor, false, { ...deps(), current: () => active, review: async () => { active = false; return { review: r }; } }), null);
});
test('a completed durable outcome can be reconciled after interruption using fresh file reads', async () => {
  const { op, request } = purchaseRequestFixture(); request.state = 'interrupted';
  const recovered = parsePurchaseRequest({ request }, op); assert.ok(recovered);
  assert.equal(await confirmPurchasedFiles(op, recovered, { current: () => true,
    read: async id => ({ ...manageFixture(id), anchor: op.review.items.find(i => i.anchor.id === id)!.anchor }) }), true);
  request.result = null;
  assert.equal(await confirmPurchasedFiles(op, request, { current: () => true, read: async () => { throw new Error('must not infer completion'); } }), false);
});
test('a before-execution refusal is not an incomplete charged outcome', () => {
  const { op, request } = purchaseRequestFixture(); request.state = 'refused'; request.result = null; request.error = 'price changed';
  assert.equal(parsePurchaseRequest({ request }, op)?.state, 'refused');
  assert.equal(parsePurchaseRequest({ request: { ...request, result: {} } }, op), null);
});
test('a picker selection resolves fresh review facts only for its exact author and ID', () => {
  const r = purchaseReviewFixture(), a = r.items.at(-1)!.anchor;
  assert.ok(parsePurchaseReview({ review: r }, { id: a.id, author: a.author }, node, false));
  assert.equal(parsePurchaseReview({ review: r }, { id: a.id, author: node }, node, false), null);
});
