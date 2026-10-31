import type { PurchaseRow } from '../api/types';
import { dashboardInventory } from './dashboardView';
import { accountRuntime } from './accountNodeActions';

const obj = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: any): v is string => typeof v === 'string' && !!v.trim();
const amount = (v: any): v is string => typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v);
const date = (v: any) => Number.isSafeInteger(v) && v >= 0 && v <= 8.64e15;
export interface PurchasePayment {
  evidence: 'purchase' | 'settlement' | 'free'; amount: string; currency: string | null; scheme: string; tx_hash: string;
  created_at: number; royalty: Record<string, string> | null;
}
export function purchasePayment(raw: unknown, tx: string): PurchasePayment | null {
  if (!obj(raw) || !['purchase', 'settlement', 'free'].includes(raw.evidence) || !amount(raw.amount)
    || !text(raw.scheme) || raw.tx_hash !== tx || !date(raw.created_at)
    || raw.royalty !== null && (!obj(raw.royalty) || !Object.entries(raw.royalty).every(([k, v]) => text(k) && amount(v)))) return null;
  if (raw.evidence === 'free') {
    if (raw.scheme !== 'free' || tx || /[1-9]/.test(raw.amount) || raw.currency !== null && !text(raw.currency) || raw.royalty !== null) return null;
  } else if (!text(tx) || !text(raw.currency) || raw.scheme === 'free') return null;
  return structuredClone(raw) as PurchasePayment;
}
export type PurchaseView = PurchaseRow & { payment: PurchasePayment | null; currentFile: boolean };
export function purchaseRows(raw: unknown): PurchaseView[] | null {
  if (!obj(raw) || !Array.isArray(raw.items)) return null;
  const rows: PurchaseView[] = [], ids = new Set<string>();
  for (const p of raw.items) {
    if (!obj(p) || !text(p.patch_id) || ids.has(p.patch_id) || !text(p.sha256) || typeof p.tx_hash !== 'string'
      || !text(p.scheme) || !amount(p.amount) || !date(p.created_at) || typeof p.applied !== 'boolean'
      || p.path !== null && !text(p.path) || p.origin != null && typeof p.origin !== 'string') return null;
    ids.add(p.patch_id);
    const entry = p.entry === null ? null : dashboardInventory({ items: [p.entry] })?.[0];
    if (entry === undefined || entry && (entry.anchor.id !== p.patch_id || !text(entry.anchor.patch_sha256) || !text(entry.anchor.benchmark_hash))) return null;
    const payment = purchasePayment(p.payment, p.tx_hash);
    // These are seller-reported allocations, not proof of individual downstream transfers.
    const payees = payment?.royalty && Array.isArray(p.payees) && p.payees.every((x: any) => obj(x) && text(x.address)
      && amount(x.amount) && x.amount === payment.royalty![x.address] && (x.name === null || typeof x.name === 'string')
      && text(x.role) && Array.isArray(x.knowledge) && x.knowledge.every(text) && typeof x.promised === 'boolean')
      && new Set(p.payees.map((x: any) => x.address.toLowerCase())).size === p.payees.length ? p.payees : [];
    rows.push({ ...p, entry, payment, payees, currentFile: !!entry && entry.anchor.patch_sha256 === p.sha256 } as PurchaseView);
  }
  return rows;
}
export function purchaseStanding(p: Pick<PurchaseRow, 'patch_id' | 'sha256'>, raw: unknown) {
  const runtime = accountRuntime(raw);
  if (!runtime?.stack || new Set(runtime.stack.map(r => r.sha256)).size !== runtime.stack.length) return null;
  const exact = runtime.stack.find(r => r.patch_id === p.patch_id);
  if (exact && exact.sha256 !== p.sha256) return { state: 'different' as const, id: exact.patch_id };
  const loaded = runtime.stack.find(r => r.sha256 === p.sha256);
  return { state: loaded ? loaded.patch_id === p.patch_id ? 'recorded' as const : 'alias' as const : 'absent' as const, id: loaded?.patch_id ?? null };
}
