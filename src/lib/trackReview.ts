import type { TrackActionReview } from '../api/types';
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const money = (v: unknown) => object(v) && text(v.currency) && typeof v.amount === 'string' && /^\d+(?:\.\d+)?$/.test(v.amount);
const precision = (v: string) => v.split('.')[1]?.length ?? 0;
const units = (v: string, scale: number) => { const [a, b = ''] = v.split('.'); return BigInt(a + b.padEnd(scale, '0')); };
const records = (v: unknown) => Array.isArray(v) && v.every(r => object(r) && text(r.patch_id) && text(r.sha256) && text(r.reason))
  && new Set(v.map(r => r.patch_id)).size === v.length && new Set(v.map(r => r.sha256)).size === v.length;
/** Render only a complete matching review. An old node's quote is not authorization for the new flow. */
export function parseTrackReview(raw: unknown, branch: string, action: 'subscribe' | 'sync', node: string | null): TrackActionReview | null {
  if (!object(raw) || !object(raw.review)) return null;
  const r = raw.review, q = r.quote;
  if (r.version !== 1 || !/^[a-f0-9]{64}$/.test(r.revision) || r.node !== node || r.action !== action
    || !object(q) || q.branch !== branch || !text(q.owner) || !text(q.currency) || typeof q.subscribed !== 'boolean'
    || action === 'sync' && !q.subscribed || typeof q.runtime_available !== 'boolean'
    || !records(r.before) || !records(r.after) || !ids(q.current) || !ids(q.buy)
    || !Array.isArray(q.items) || !q.items.every(i => object(i) && text(i.patch_id) && money({ amount: i.price, currency: i.currency })
      && ['buy', 'held', 'own', 'retired', 'blocked', 'wrong_model', 'unknown'].includes(i.plan)
      && (i.name === null || typeof i.name === 'string') && typeof i.reason === 'string')
    || new Set(q.items.map(i => i.patch_id)).size !== q.items.length
    || !Array.isArray(r.anchors) || !r.anchors.every(a => object(a) && text(a.id) && text(a.patch_sha256) && text(a.author) && text(a.name))
    || new Set(r.anchors.map(a => a.id)).size !== r.anchors.length
    || !q.current.every(id => r.anchors.some((a: any) => a.id === id) && q.items.some((i: any) => i.patch_id === id))
    || !q.buy.every(id => q.items.some((i: any) => i.patch_id === id && i.plan === 'buy'))
    || q.items.some(i => i.plan === 'buy' && !q.buy.includes(i.patch_id))
    || !Array.isArray(r.overlaps) || !r.overlaps.every(o => object(o) && text(o.track_id) && text(o.loaded_id) && text(o.loaded_reason)
      && (o.rows === null || Number.isSafeInteger(o.rows) && o.rows >= 0) && typeof o.estimated === 'boolean')
    || !money(r.fee) || !Array.isArray(r.total) || !r.total.every(money)
    || new Set(r.total.map(v => v.currency)).size !== r.total.length
    || !object(q.subscription) || q.subscription.branch !== branch || q.subscription.owner !== q.owner
    || typeof q.subscription.due !== 'boolean') return null;
  const terms = q.subscription.terms;
  if (terms !== null && (!object(terms) || !money({ amount: terms.price, currency: terms.currency }) || !Number.isSafeInteger(terms.period_days) || terms.period_days < 1)) return null;
  const scale = Math.max(precision(r.fee.amount), ...(terms ? [precision(terms.price)] : []), ...q.items.map(i => precision(i.price)), ...r.total.map(v => precision(v.amount)));
  const fee = action === 'subscribe' && q.subscription.due && terms && q.owner.toLowerCase() !== node?.toLowerCase() ? units(terms.price, scale) : 0n;
  if (units(r.fee.amount, scale) !== fee || fee && r.fee.currency !== terms.currency) return null;
  const expected = new Map<string, bigint>();
  for (const i of q.items.filter(i => i.plan === 'buy')) expected.set(i.currency, (expected.get(i.currency) ?? 0n) + units(i.price, scale));
  if (fee) expected.set(r.fee.currency, (expected.get(r.fee.currency) ?? 0n) + fee);
  if (expected.size !== r.total.length || r.total.some(v => expected.get(v.currency) !== units(v.amount, scale))) return null;
  return structuredClone(r) as TrackActionReview;
}
