import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SubscribeResult } from '../src/api/types';
import { trackAcquisitionFailure, trackActionConfirmed, trackActionResult, trackOutcomeText, trackOverlapRefusal } from '../src/lib/trackAction';
import { operatorDash } from '../src/i18n/pages/operator';

const result = (): SubscribeResult => ({ ok: true, branch: 'selected', action: 'sync', acquired: [], failed: [], applied: [], removed: [], skipped: [], spent: [],
  receipt: { version: 1, subscribed: true, subscription_changed: false, runtime: { state: 'recorded', error: null, pending: [], records: [] } } });
const render = (value: SubscribeResult, lang: 'en' | 'ko' = 'en') => trackOutcomeText(value,
  (key, values) => Object.entries(values ?? {}).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), (operatorDash[key] as any)[lang]),
  (amount, currency) => `${amount} ${currency}`);
test('a response must belong to the selected track and action and carry valid evidence', () => {
  assert.ok(trackActionResult(result(), 'selected', 'sync'));
  for (const value of [null, {}, { ...result(), branch: 'another' }, { ...result(), action: 'subscribe' },
    { ...result(), spent: [{ amount: 'NaN', currency: 'CREDIT' }] }, { ...result(), acquired: ['one', 'one'] },
    { ...result(), failed: [{ patch_id: 'one' }] }, { ...result(), receipt: { version: 2 } }]) {
    assert.equal(trackActionResult(value, 'selected', 'sync'), null);
  }
});
test('legacy HTTP success is shown as unconfirmed, never as nothing to do or success', () => {
  const old = result(); delete old.receipt;
  assert.ok(trackActionResult(old, 'selected', 'sync')); assert.equal(trackActionConfirmed(old), false);
  assert.match(render(old), /unconfirmed/); assert.doesNotMatch(render(old), /nothing new|were confirmed/);
});
test('fee-only spend and all purchase errors stay visible in both languages', () => {
  const partial = result(); partial.ok = false; delete partial.receipt;
  partial.spent = [{ currency: 'CREDIT', amount: '7' }]; partial.failed = [{ patch_id: 'missing-file', error: 'seller offline' }];
  for (const lang of ['ko', 'en'] as const) {
    const text = render(partial, lang); assert.match(text, /7 CREDIT/); assert.match(text, /missing-file/); assert.match(text, /seller offline/);
  }
  assert.equal(trackActionConfirmed(partial), false);
});
test('unsubscribe can confirm departure while disclosing an incomplete model cleanup', () => {
  const partial = result(); partial.action = 'unsubscribe'; partial.ok = false;
  partial.receipt!.subscribed = false; partial.receipt!.subscription_changed = true;
  partial.receipt!.runtime = { state: 'failed', error: 'retained dependency', pending: ['old'], records: [{ patch_id: 'old', sha256: 'file', reason: 'subscription:selected' }] };
  assert.ok(trackActionResult(partial, 'selected', 'unsubscribe')); assert.equal(trackActionConfirmed(partial), false);
  const text = render(partial); assert.match(text, /inactive/); assert.match(text, /did not complete/); assert.match(text, /retained dependency/); assert.match(text, /old/);
});
test('contradictory successful receipts and duplicate physical records cannot produce success', () => {
  for (const mutate of [
    (r: SubscribeResult) => { r.failed.push({ patch_id: 'missing', error: 'failed' }); },
    (r: SubscribeResult) => { r.receipt!.runtime.pending.push('missing'); },
    (r: SubscribeResult) => { r.receipt!.runtime.error = 'write failed'; },
    (r: SubscribeResult) => { r.receipt!.runtime.state = 'unavailable'; },
    (r: SubscribeResult) => { r.receipt!.subscribed = false; },
    (r: SubscribeResult) => { r.receipt!.runtime.records = ['one', 'alias'].map(patch_id => ({ patch_id, sha256: 'same-file', reason: 'manual' })); },
  ]) { const value = result(); mutate(value); assert.equal(trackActionResult(value, 'selected', 'sync'), null); }
});
test('partial acquisition errors preserve spend evidence only for the requested track', () => {
  const details = { branch: 'selected', subscribed: false, acquired: [], failed: [{ patch_id: 'needed', error: 'seller offline' }], spent: [{ currency: 'CREDIT', amount: '4' }] };
  const response = { status: 409, data: { error: 'subscription_incomplete: seller offline', ...details } };
  const partial = trackAcquisitionFailure(response, 'selected');
  assert.ok(partial); assert.equal(partial.ok, false); assert.match(render(partial), /4 CREDIT/);
  assert.equal(trackAcquisitionFailure(response, 'another'), null);
  assert.equal(trackAcquisitionFailure({ ...response, data: { ...response.data, spent: 'unknown' } }, 'selected'), null);
  assert.equal(trackAcquisitionFailure({ status: 409, data: { details } }, 'selected'), null);
});
test('overlap review reads the actual flattened API error and rejects unrelated or malformed pairs', () => {
  const pair = { track_id: 'new', loaded_id: 'manual', loaded_reason: 'manual', rows: 5, estimated: false };
  const response = { status: 409, data: { code: 'overlaps_loaded', branch: 'selected', pairs: [pair] } };
  assert.deepEqual(trackOverlapRefusal(response, 'selected'), [pair]);
  assert.equal(trackOverlapRefusal(response, 'another'), null);
  assert.equal(trackOverlapRefusal({ ...response, data: { ...response.data, pairs: [{ ...pair, rows: null, estimated: true, jaccard: 2 }] } }, 'selected'), null);
  assert.equal(trackOverlapRefusal({ status: 409, data: { details: response.data } }, 'selected'), null);
});
test('a complete cleanup uses record-based language without claiming a replacement or live weight probe', () => {
  const complete = result(); complete.action = 'unsubscribe'; complete.receipt!.subscribed = false; complete.removed = ['old'];
  assert.equal(trackActionConfirmed(complete), true); assert.ok(trackActionResult(complete, 'selected', 'unsubscribe'));
  assert.match(render(complete), /Node reported unloading: old/); assert.match(render(complete), /load records were confirmed/);
  assert.doesNotMatch(render(complete), /replaced|newer version|live probe/);
});
