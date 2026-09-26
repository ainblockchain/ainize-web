/**
 * When a model page mentions deposits (src/screens/models/modelSpeedHints.ts).
 *
 * The rule under test: a deposit is offered only where it changes something — busy-time speed — and never as a
 * general "faster" on an idle node, where everybody already has the whole model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBillingThroughputResponse } from '../src/api/billingThroughput';
import { modelSpeedBillingHref, modelSpeedFactOf, modelSpeedPriorityOfferOf } from '../src/screens/models/modelSpeedHints';

const live = (over: Record<string, unknown> = {}) => parseBillingThroughputResponse({
  model: 'Qwen3.8-Flash-Next',
  rate: { tok_s: 36.7, measured: true, samples: 12, window_s: 1800 },
  active: { callers: 1, others_weight: 0 },
  free_tier: { expected_tok_s: 36.662, busy_expected_tok_s: 0, idle: true },
  you: null,
  quote: { token: 'sAIN', amount: '100', sain: 100, expected_tok_s: 36.66, busy_expected_tok_s: 36.3, multiplier: null },
  deposits: { enabled: true, address: '0x77547927486Dc69793D460661f4a161D1B9068E3', ain_per_sain: 1.11, chains: [] },
  ...over,
});

test('the speed fact says the speed and whether it is busy — and nothing when the node could not say', () => {
  assert.deepEqual(modelSpeedFactOf(live()), { tokS: '37', measured: true, busy: false });
  assert.equal(modelSpeedFactOf(live({ free_tier: { expected_tok_s: 0, busy_expected_tok_s: 0, idle: false } }))!.busy, true);
  assert.equal(modelSpeedFactOf(null), null);
});

test('the offer is the busy-time change a deposit buys, from the free tier or from what you already hold', () => {
  assert.deepEqual(modelSpeedPriorityOfferOf(live()), { nowBusyTokS: '0', afterBusyTokS: '36', amount: '100' });
  const holder = live({ you: { address: '0xabc', deposited_sain: 50, expected_tok_s: 36, busy_expected_tok_s: 24, idle: true } });
  assert.deepEqual(modelSpeedPriorityOfferOf(holder), { nowBusyTokS: '24', afterBusyTokS: '36', amount: '100' });
});

test('no offer where a deposit would not be true: no deposits, no quote, or no change', () => {
  assert.equal(modelSpeedPriorityOfferOf(live({ deposits: { enabled: false } })), null);
  assert.equal(modelSpeedPriorityOfferOf(live({ quote: null })), null);
  const whale = live({ you: { address: '0xabc', deposited_sain: 1e6, expected_tok_s: 36.3, busy_expected_tok_s: 36.3, idle: true } });
  assert.equal(modelSpeedPriorityOfferOf(whale), null, 'already served first: nothing to sell');
  assert.equal(modelSpeedPriorityOfferOf(null), null);
});

test('the link lands on /billing with the model and the amount that was quoted', () => {
  assert.equal(modelSpeedBillingHref('Qwen3.8 Flash', '100'), '/billing?model=Qwen3.8%20Flash&amount=100&token=sAIN');
});
