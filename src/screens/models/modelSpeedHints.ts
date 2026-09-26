/**
 * When a model page mentions deposits — and what it says when it does.
 *
 * A deposit does not make a model faster in general. On an idle node everybody, free or paid, already gets the
 * whole model; what a deposit buys is being served FIRST when others are asking too (ainize-node
 * `docs/superpowers/specs/2026-09-26-throughput-billing-design.md`). So the page raises it where that is true
 * and felt, not as a banner:
 *
 *   • the facts row carries the model's speed and whether it is busy — quiet while idle, the way in while busy;
 *   • the playground, while a free request is waiting behind paid work, says so with the quote;
 *   • the API key panel, because a deposit applies to exactly the calls a key makes.
 *
 * Everything here is pure: it reads `GET /api/throughput` (parsed by `parseBillingThroughputResponse`) and decides
 * what to show. `test/model-speed-hints.test.ts` pins it.
 */
import { billingFormatTokS, type BillingThroughput } from '@/api/billingThroughput';

/** The amount the page quotes without being asked: the middle preset on `/billing`, where the link lands. */
export const MODEL_SPEED_QUOTE_SAIN = '100';

export interface ModelSpeedFact {
  /** the model's speed, formatted */
  tokS: string;
  /** false → the node's fallback estimate, not a measurement */
  measured: boolean;
  /** someone else is asking: free requests now wait behind paid ones */
  busy: boolean;
}

export function modelSpeedFactOf(t: BillingThroughput | null): ModelSpeedFact | null {
  if (!t) return null;
  return { tokS: billingFormatTokS(t.rate.tokS), measured: t.rate.measured, busy: !t.freeTier.idle };
}

/** What depositing would change for this visitor when the node is busy — the only case a deposit is for. */
export interface ModelSpeedPriorityOffer {
  /** this visitor's tok/s while others are asking: the free tier's, or their own deposit's when signed in */
  nowBusyTokS: string;
  /** the same after depositing `amount` sAIN */
  afterBusyTokS: string;
  amount: string;
}

/**
 * Null when there is nothing honest to offer: the node takes no deposits, the quote could not be made, or the
 * deposit would not change the busy number (a visitor who already holds a large share).
 */
export function modelSpeedPriorityOfferOf(t: BillingThroughput | null): ModelSpeedPriorityOffer | null {
  if (!t || !t.deposits.enabled || !t.quote || t.quote.error) return null;
  const now = t.you ? t.you.busyExpectedTokS : t.freeTier.busyExpectedTokS;
  const after = t.quote.busyExpectedTokS;
  if (now === null || after === null || after <= now) return null;
  const nowText = billingFormatTokS(now);
  const afterText = billingFormatTokS(after);
  if (nowText === afterText) return null;
  return { nowBusyTokS: nowText, afterBusyTokS: afterText, amount: t.quote.amount };
}

/** Where the offer links: `/billing` with this model and amount already chosen. */
export const modelSpeedBillingHref = (model: string, amount = MODEL_SPEED_QUOTE_SAIN): string =>
  `/billing?model=${encodeURIComponent(model)}&amount=${encodeURIComponent(amount)}&token=sAIN`;
