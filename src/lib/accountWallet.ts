import type { PayoutRow, RoyaltyRow, Settlement, WalletResponse } from '../api/types';
import { isKnowledgeAuthor } from './detailRoutes';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const amount = (v: unknown) => typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v) && Number.isFinite(Number(v));
const date = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 8.64e15;
const states = ['credited', 'paid', 'pending', 'failed', 'unconfirmed'];

export function accountWallet(raw: unknown, address: string): WalletResponse | null {
  if (!object(raw) || !isKnowledgeAuthor(address) || typeof raw.address !== 'string' || raw.address.toLowerCase() !== address.toLowerCase()
    || !(raw.balance === null || typeof raw.balance === 'number' && Number.isFinite(raw.balance) && raw.balance >= 0)
    || !Number.isSafeInteger(raw.purchases) || raw.purchases < 0 || !Array.isArray(raw.sales) || !Array.isArray(raw.royalties)) return null;
  const hashes = new Set<string>();
  for (const s of raw.sales) {
    if (!object(s) || !text(s.patch_id) || !text(s.tx_hash) || hashes.has(s.tx_hash) || !text(s.currency) || !text(s.scheme)
      || typeof s.seller !== 'string' || s.seller.toLowerCase() !== address.toLowerCase() || typeof s.buyer !== 'string' || !isKnowledgeAuthor(s.buyer)
      || !amount(s.amount) || !date(s.created_at) || s.royalty != null && (!object(s.royalty) || Object.entries(s.royalty).some(([a, v]) => !isKnowledgeAuthor(a) || !amount(v)))) return null;
    if (s.royalty_unresolved != null && (!object(s.royalty_unresolved) || Object.entries(s.royalty_unresolved).some(([id, v]) => !text(id) || !amount(v)))) return null;
    const unresolved = Object.values(s.royalty_unresolved ?? {}).reduce<number>((n, v) => n + Number(v), 0);
    const shared = Object.entries(s.royalty ?? {}).filter(([a]) => a.toLowerCase() !== address.toLowerCase()).reduce((n, [, v]) => n + Number(v), 0);
    if (!Number.isFinite(shared + unresolved) || shared + unresolved > Number(s.amount) + 1e-9) return null;
    hashes.add(s.tx_hash);
  }
  for (const r of raw.royalties) {
    if (!object(r) || !text(r.patch_id) || !amount(r.amount) || !date(r.created_at)
      || r.currency != null && !text(r.currency) || r.state != null && !states.includes(r.state)
      || r.kind != null && !['lineage', 'verification'].includes(r.kind)
      || r.evidence != null && !['record', 'seller_reported'].includes(r.evidence)) return null;
  }
  return raw as WalletResponse;
}

export function accountSales(sales: Settlement[], address: string) {
  const split = new Map<string, { mine: number; unresolved: number; shared: { address: string; amount: number }[] }>();
  const totals = new Map<string, { currency: string; grossTotal: number; sharedTotal: number; netTotal: number; unresolvedTotal: number }>();
  for (const s of sales) {
    const shared = Object.entries(s.royalty ?? {}).filter(([a]) => a.toLowerCase() !== address.toLowerCase()).map(([address, amount]) => ({ address, amount: Number(amount) }));
    const unresolved = Object.values(s.royalty_unresolved ?? {}).reduce((n, v) => n + Number(v), 0);
    const out = shared.reduce((n, r) => n + r.amount, 0) + unresolved, mine = Math.max(0, Number(s.amount) - out);
    split.set(s.tx_hash, { mine, shared, unresolved });
    const group = totals.get(s.currency) ?? { currency: s.currency, grossTotal: 0, sharedTotal: 0, netTotal: 0, unresolvedTotal: 0 };
    group.grossTotal += Number(s.amount); group.sharedTotal += out; group.netTotal += mine; group.unresolvedTotal += unresolved;
    if (![group.grossTotal, group.sharedTotal, group.netTotal].every(Number.isFinite)) return null;
    totals.set(s.currency, group);
  }
  return { split, totals: [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency)) };
}

export function accountPayouts(raw: unknown): PayoutRow[] | null {
  if (!object(raw) || !Array.isArray(raw.items)) return null;
  const ids = new Set<number>();
  for (const p of raw.items) {
    if (!object(p) || !Number.isSafeInteger(p.id) || ids.has(p.id) || !text(p.patch_id) || !text(p.currency) || !amount(p.amount)
      || typeof p.address !== 'string' || !isKnowledgeAuthor(p.address) || !['pending', 'paid', 'failed'].includes(p.status) || !date(p.created_at) || !date(p.updated_at)) return null;
    ids.add(p.id);
  }
  return raw.items as PayoutRow[];
}

export interface OwedRow { key: string; address: string; patch_id: string; amount: number; currency: string; n: number; last: number; state: 'credited' | PayoutRow['status'] }
export function accountOwed(sales: Settlement[], payouts: PayoutRow[], me: string) {
  const groups = new Map<string, OwedRow>();
  const add = (address: string, patch_id: string, amount: number, currency: string, state: OwedRow['state'], at: number) => {
    if (amount <= 0 || address.toLowerCase() === me.toLowerCase()) return;
    const key = JSON.stringify([address.toLowerCase(), patch_id, currency, state]);
    const row = groups.get(key) ?? { key, address, patch_id, amount: 0, currency, state, n: 0, last: 0 };
    row.amount += amount; row.n++; row.last = Math.max(row.last, at); groups.set(key, row);
  };
  for (const s of sales) if (s.scheme === 'local-credit') for (const [address, amount] of Object.entries(s.royalty ?? {})) add(address, s.patch_id, Number(amount), s.currency, 'credited', s.created_at);
  for (const p of payouts) add(p.address, p.patch_id, Number(p.amount), p.currency, p.status, p.updated_at || p.created_at);
  const rows = [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount || a.key.localeCompare(b.key));
  const totals = new Map<string, { currency: string; open: number; credited: number; paid: number }>();
  for (const r of rows) {
    const group = totals.get(r.currency) ?? { currency: r.currency, open: 0, credited: 0, paid: 0 };
    group[r.state === 'pending' || r.state === 'failed' ? 'open' : r.state] += r.amount;
    if (![r.amount, group.open, group.credited, group.paid].every(Number.isFinite)) return null;
    totals.set(r.currency, group);
  }
  return { rows, totals: [...totals.values()] };
}

/** Missing currency or evidence cannot inherit the current node's monetary unit or imply a confirmed receipt. */
export function accountPayments(rows: RoyaltyRow[] | undefined, expectedKind?: 'verification') {
  if (!Array.isArray(rows)) return null;
  const groups = new Map<string, { currency: string; state: string; evidence: string; amount: number }>();
  for (const r of rows) {
    if (!object(r) || r.kind != null && (!['lineage', 'verification'].includes(r.kind) || expectedKind !== undefined && r.kind !== expectedKind) || !text(r.currency) || !amount(r.amount) || r.state != null && !states.includes(r.state)
      || r.evidence != null && !['record', 'seller_reported'].includes(r.evidence)) return null;
    const state = r.state ?? 'unconfirmed', evidence = state === 'paid' ? r.evidence ?? 'unknown' : '';
    const key = JSON.stringify([r.currency, state, evidence]);
    const group = groups.get(key) ?? { currency: r.currency, state, evidence, amount: 0 };
    group.amount += Number(r.amount); if (!Number.isFinite(group.amount)) return null;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency) || a.state.localeCompare(b.state) || a.evidence.localeCompare(b.evidence));
}
