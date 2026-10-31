import type { TrackQuote } from '../api/types';
import { accountRuntime } from './accountNodeActions';
import { ledgerView } from './ledgerView';

const obj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const decimal = (v: unknown): v is string => typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v);
const count = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => b[i] === id);
const canonicalAmount = (v: string) => { const [whole, fraction = ''] = v.split('.'); const tail = fraction.replace(/0+$/, ''); return `${BigInt(whole)}${tail ? `.${tail}` : ''}`; };
function sum(values: string[]): string {
  const scale = Math.max(0, ...values.map(v => v.split('.')[1]?.length ?? 0));
  const total = values.reduce((n, v) => { const [a, b = ''] = v.split('.'); return n + BigInt(a + b.padEnd(scale, '0')); }, 0n);
  const digits = String(total).padStart(scale + 1, '0');
  return canonicalAmount(scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits);
}

/** Validate the fields used by the card before reading prices, dates or file identities. */
export function trackCardQuote(raw: unknown, name: string, expected?: { owner: string; patch_ids: string[]; current?: string[] }): TrackQuote | null {
  if (!obj(raw) || !obj(raw.quote)) return null;
  const q = raw.quote;
  if (q.branch !== name || !text(q.owner) || !text(q.currency) || typeof q.subscribed !== 'boolean'
    || !ids(q.current) || !ids(q.retired) || !ids(q.buy) || typeof q.runtime_available !== 'boolean'
    || !Array.isArray(q.items) || !q.items.every(i => obj(i) && text(i.patch_id) && (i.name === null || typeof i.name === 'string')
      && (i.patch_sha256 == null || text(i.patch_sha256)) && decimal(i.price) && text(i.currency)
      && ['buy', 'held', 'own', 'retired', 'blocked', 'wrong_model', 'unknown'].includes(i.plan))) return null;
  if (new Set(q.items.map(i => i.patch_id)).size !== q.items.length
    || !sameIds(q.current, q.items.filter(i => ['buy', 'held', 'own'].includes(i.plan)).map(i => i.patch_id))
    || !sameIds(q.retired, q.items.filter(i => i.plan === 'retired').map(i => i.patch_id))
    || !sameIds(q.buy, q.items.filter(i => i.plan === 'buy').map(i => i.patch_id))) return null;
  if (expected && (q.owner.toLowerCase() !== expected.owner.toLowerCase() || !sameIds(q.items.map(i => i.patch_id), expected.patch_ids)
    || !expected.current || !sameIds(q.current, expected.current))) return null;
  if (q.subscription != null) {
    const s = q.subscription, rate = s.run_rate;
    if (!obj(s) || s.branch !== name || s.owner !== q.owner || typeof s.due !== 'boolean'
      || s.paid_until !== null && (!count(s.paid_until) || s.paid_until > 8.64e15)
      || !obj(rate) || !count(rate.knowledge_added)) return null;
    if (s.terms !== null && (!obj(s.terms) || !decimal(s.terms.price) || !text(s.terms.currency)
      || !Number.isSafeInteger(s.terms.period_days) || s.terms.period_days < 1 || s.terms.period_days > 365)) return null;
  }
  return q as TrackQuote;
}

/** A logical ID is not proof of its current file. Matching physical aliases are valid load-record evidence. */
export function trackStanding(current: unknown, quote: TrackQuote | null, rawRuntime: unknown) {
  const runtime = accountRuntime(rawRuntime);
  if (!ids(current) || !quote || !sameIds(current, quote.current) || !quote.runtime_available || !runtime?.available || !runtime.stack
    || new Set(runtime.stack.map(r => r.sha256)).size !== runtime.stack.length
    || quote.runtime_model != null && quote.runtime_model !== runtime.model) return null;
  const wanted = current.map(id => quote.items.find(i => i.patch_id === id));
  if (wanted.some(i => !i?.patch_sha256)) return null;
  const loaded = wanted.filter(i => runtime.stack!.some(r => r.sha256 === i!.patch_sha256)).map(i => i!.patch_id);
  return { loaded, missing: current.filter(id => !loaded.includes(id)), total: current.length };
}

/** This is a summary of the returned ledger window, not lifetime demand or the curator's personal income. */
export function trackWindowStats(raw: unknown, branch: string, members: string[]) {
  const ledger = ledgerView(raw, '');
  if (!ledger || !ids(members)) return null;
  let joined = 0, left = 0, settlements = 0;
  const totals = new Map<string, string[]>(), seen = new Map<string, string>();
  for (const r of ledger.records) {
    const b = r.body as Record<string, any>;
    if (r.kind === 'subscribe' && b.branch === branch) { if (b.action === 'subscribe') joined++; else if (b.action === 'unsubscribe') left++; }
    if (r.kind !== 'settle' || !members.includes(b.patch_id)) continue;
    if (!text(b.tx_hash) || !text(b.scheme) || !text(b.seller) || !text(b.buyer) || !text(b.currency) || !decimal(b.amount)) return null;
    const key = JSON.stringify([b.patch_id, b.seller.toLowerCase(), b.scheme, b.tx_hash]);
    const value = JSON.stringify([b.buyer.toLowerCase(), b.currency, canonicalAmount(b.amount)]);
    if (seen.has(key)) { if (seen.get(key) !== value) return null; continue; }
    seen.set(key, value);
    if (canonicalAmount(b.amount) === '0' || b.buyer.toLowerCase() === b.seller.toLowerCase()) continue;
    settlements++; totals.set(b.currency, [...(totals.get(b.currency) ?? []), b.amount]);
  }
  return { joined, left, settlements, window: ledger.records.length, available: ledger.info.records,
    partial: ledger.records.length < ledger.info.records, totals: [...totals].map(([currency, values]) => ({ currency, amount: sum(values) })) };
}
