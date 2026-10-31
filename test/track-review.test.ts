import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrackReview } from '../src/lib/trackReview';
import { trackReviewFixture } from './track-review-fixture';
const parse = (review: unknown) => parseTrackReview({ review }, 'selected', 'subscribe', 'test-node');
test('review parser binds selected action, branch and node and rejects quote-only old servers', () => {
  assert.ok(parse(trackReviewFixture())); assert.equal(parseTrackReview({ quote: trackReviewFixture().quote }, 'selected', 'subscribe', 'test-node'), null);
  for (const mutate of [(r: any) => { r.node = 'another'; }, (r: any) => { r.quote.branch = 'another'; },
    (r: any) => { r.action = 'sync'; }, (r: any) => { r.revision = ''; }, (r: any) => { r.version = 2; }]) {
    const value = trackReviewFixture(); mutate(value); assert.equal(parse(value), null);
  }
});
test('fee-only and multi-currency totals must include every due charge', () => {
  const value = trackReviewFixture(); value.quote.items = []; value.quote.current = value.quote.buy = []; value.anchors = []; value.after = [];
  value.total = [{ amount: '1', currency: 'CREDIT' }]; assert.ok(parse(value));
  value.total = []; assert.equal(parse(value), null);
  const multi = trackReviewFixture(); multi.quote.subscription!.terms!.currency = multi.fee.currency = 'AIN';
  multi.total = [{ amount: '1', currency: 'AIN' }, { amount: '2', currency: 'CREDIT' }]; assert.ok(parse(multi));
  multi.total[1].amount = '1'; assert.equal(parse(multi), null);
});
test('sync reviews do not invent another curation charge and require an active subscription', () => {
  const value = trackReviewFixture(); value.action = 'sync'; value.quote.subscribed = true;
  value.fee.amount = '0'; value.total[0].amount = '2';
  assert.ok(parseTrackReview({ review: value }, 'selected', 'sync', 'test-node'));
  value.quote.subscribed = false; assert.equal(parseTrackReview({ review: value }, 'selected', 'sync', 'test-node'), null);
});
test('invalid money, missing terms/targets and duplicate stack records never enable execution', () => {
  for (const mutate of [(r: any) => { r.fee.amount = 'NaN'; }, (r: any) => { r.total[0].amount = '-3'; },
    (r: any) => { r.quote.subscription = null; }, (r: any) => { r.anchors = []; },
    (r: any) => { r.after.push({ ...r.after[0], patch_id: 'alias' }); }, (r: any) => { r.quote.buy = []; },
    (r: any) => { r.total.push(r.total[0]); }]) {
    const value = trackReviewFixture(); mutate(value); assert.equal(parse(value), null);
  }
});
test('review snapshots stay unchanged when later quote cache data changes', () => {
  const raw = trackReviewFixture(), checked = parse(raw)!;
  raw.total[0].amount = '100'; raw.after[0].sha256 = 'replaced';
  assert.equal(checked.total[0].amount, '3'); assert.equal(checked.after[0].sha256, 'file');
});
test('small prices remain exact rather than becoming an apparently free review', () => {
  const value = trackReviewFixture(); value.quote.items[0].price = '0.00000002'; value.fee.amount = value.quote.subscription!.terms!.price = '0.00000001';
  value.total[0].amount = '0.00000003'; assert.ok(parse(value));
  value.total[0].amount = '0'; assert.equal(parse(value), null);
});
