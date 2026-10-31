import type { SubscribeResult, TrackOverlap } from '../api/types';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const amount = (v: unknown): v is string => typeof v === 'string' && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(v) && Number.isFinite(Number(v));

/** HTTP success alone does not prove either the subscription or the model transition completed. */
export function trackActionResult(raw: unknown, branch: string, action: SubscribeResult['action']): SubscribeResult | null {
  if (!object(raw) || raw.branch !== branch || raw.action !== action || typeof raw.ok !== 'boolean'
    || !ids(raw.acquired) || !ids(raw.applied) || !ids(raw.removed)
    || !Array.isArray(raw.failed) || !raw.failed.every(r => object(r) && text(r.patch_id) && text(r.error))
    || !Array.isArray(raw.skipped) || !raw.skipped.every(r => object(r) && text(r.patch_id) && text(r.reason))
    || !Array.isArray(raw.spent) || !raw.spent.every(r => object(r) && text(r.currency) && amount(r.amount))
    || new Set(raw.spent.map(r => r.currency)).size !== raw.spent.length) return null;
  if (raw.receipt !== undefined) {
    const r = raw.receipt, v = r?.runtime;
    if (!object(r) || r.version !== 1 || typeof r.subscribed !== 'boolean' || typeof r.subscription_changed !== 'boolean'
      || !object(v) || !['recorded', 'unavailable', 'failed'].includes(v.state)
      || !(v.error === null || text(v.error)) || !ids(v.pending) || !Array.isArray(v.records)
      || !v.records.every(x => object(x) && text(x.patch_id) && text(x.sha256) && text(x.reason))
      || new Set(v.records.map(x => x.patch_id)).size !== v.records.length
      || new Set(v.records.map(x => x.sha256)).size !== v.records.length
      || v.state === 'recorded' && (v.error !== null || v.pending.length)
      || action === 'unsubscribe' && r.subscribed
      || action !== 'unsubscribe' && !r.subscribed
      || raw.ok && (v.state !== 'recorded' || raw.failed.length)) return null;
  }
  return raw as SubscribeResult;
}

/** An acquisition error may still include money already spent. Never discard that evidence with the error. */
export function trackAcquisitionFailure(error: unknown, branch: string): SubscribeResult | null {
  if (!object(error) || error.status !== 409 || !object(error.data)
    || typeof error.data.error !== 'string' || !error.data.error.startsWith('subscription_incomplete:')) return null;
  // api.ts spreads MarketError.details directly into the response body.
  const d = error.data;
  if (d.branch !== branch || typeof d.subscribed !== 'boolean' || !Array.isArray(d.failed) || !d.failed.length) return null;
  return trackActionResult({ ok: false, branch, action: 'subscribe', acquired: d.acquired, failed: d.failed,
    spent: d.spent, applied: [], removed: [], skipped: [] }, branch, 'subscribe');
}
export function trackOverlapRefusal(error: unknown, branch: string): TrackOverlap[] | null {
  if (!object(error) || error.status !== 409 || !object(error.data)) return null;
  const d = error.data;
  if (d.branch !== branch || d.code !== 'overlaps_loaded' || !Array.isArray(d.pairs) || !d.pairs.length
    || !d.pairs.every(r => object(r) && text(r.track_id) && text(r.loaded_id) && text(r.loaded_reason)
      && typeof r.estimated === 'boolean' && (r.rows === null ? r.estimated && typeof r.jaccard === 'number'
        && Number.isFinite(r.jaccard) && r.jaccard >= 0 && r.jaccard <= 1 : Number.isSafeInteger(r.rows) && r.rows >= 0))) return null;
  return d.pairs;
}
export function trackActionConfirmed(result: SubscribeResult): boolean {
  return result.ok && result.failed.length === 0 && result.receipt?.runtime.state === 'recorded';
}
/** Lines describe reported changes, then separately state what the node actually confirmed. */
export function trackOutcomeText(x: SubscribeResult, t: (key: string, values?: Record<string, string | number>) => string,
  fmt: (amount: string, currency: string) => string): string {
  const parts: string[] = [];
  if (x.acquired.length) parts.push(t('op.dash.branches.done.acquired', { n: x.acquired.length }));
  if (x.spent.length) parts.push(t('op.dash.branches.done.spent', { total: x.spent.map(s => fmt(s.amount, s.currency)).join(' + ') }));
  if (x.applied.length) parts.push(t('op.dash.branches.done.loaded', { ids: x.applied.join(', ') }));
  if (x.removed.length) parts.push(t('op.dash.branches.done.unloaded', { ids: x.removed.join(', ') }));
  for (const s of x.skipped) parts.push(t('op.dash.branches.done.skipped', { id: s.patch_id, reason: s.reason }));
  for (const f of x.failed) parts.push(t('op.dash.branches.done.failed', { id: f.patch_id, reason: f.error }));
  if (!x.receipt) parts.push(t('op.dash.branches.done.unconfirmed'));
  else {
    parts.push(t(x.receipt.subscribed ? 'op.dash.branches.done.subscribed' : 'op.dash.branches.done.unsubscribed'));
    const r = x.receipt.runtime;
    parts.push(t(`op.dash.branches.done.runtime.${r.state}`));
    if (r.error) parts.push(r.error);
    if (r.pending.length) parts.push(t('op.dash.branches.done.pending', { ids: r.pending.join(', ') }));
  }
  return parts.join(' ');
}
