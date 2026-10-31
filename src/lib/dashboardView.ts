import { benchmarkQuestionCount } from './benchmarkQuestions';
import type { CatalogEntry } from '../api/types';
import { ledgerView } from './ledgerView';
import { isKnowledgeAuthor } from './detailRoutes';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const amount = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0;
export const STATUS_ORDER = ['DRAFT', 'ANNOUNCED', 'VERIFYING', 'CHALLENGED', 'VERIFIED', 'SUPERSEDED', 'RETIRED', 'REJECTED'];
export const statusRank = (status: string) => { const i = STATUS_ORDER.indexOf(status); return i < 0 ? STATUS_ORDER.length : i; };
export const paidSales = (entry: CatalogEntry): number | null => count(entry.sales?.sales_all) ? entry.sales!.sales_all : null;

export const inventoryQuestionCount = benchmarkQuestionCount;

export function dashboardInventory(raw: unknown): CatalogEntry[] | null {
  if (!object(raw) || !Array.isArray(raw.items)) return null;
  if (!raw.items.every((e: any) => object(e) && object(e.anchor) && typeof e.anchor.id === 'string' && !!e.anchor.id
    && typeof e.anchor.author === 'string' && isKnowledgeAuthor(e.anchor.author) && typeof e.anchor.name === 'string'
    && object(e.anchor.model) && typeof e.anchor.model.id_M === 'string' && object(e.anchor.benchmark)
    && typeof e.anchor.benchmark.schema === 'string' && inventoryQuestionCount(e.anchor.benchmark.queries) !== null
    && count(e.anchor.created_at) && (e.listed_at == null || count(e.listed_at)) && STATUS_ORDER.includes(e.status)
    && ['passed', 'quorum', 'integrity_checks'].every(k => count(e[k])) && amount(e.revenue)
    && (e.anchor.branch == null || typeof e.anchor.branch === 'string') && typeof e.anchor.currency === 'string' && (e.sales == null || object(e.sales) && count(e.sales.sales_all))
    && ['revenue_net', 'revenue_shared'].every(k => e[k] == null || amount(e[k])))) return null;
  if (new Set(raw.items.map((e: CatalogEntry) => e.anchor.id)).size !== raw.items.length) return null;
  return raw.items.map((e: CatalogEntry) => ({ ...e, anchor: { ...e.anchor, benchmark: { ...e.anchor.benchmark, queries: inventoryQuestionCount(e.anchor.benchmark.queries)! } } }));
}

export function inventoryRows(items: CatalogEntry[], query: string, status: string, sort: 'status' | 'new' | 'name' | 'sales') {
  const needle = query.trim().toLowerCase();
  const recency = (e: CatalogEntry) => e.listed_at ?? e.anchor.created_at ?? 0;
  const recentFirst = (a: CatalogEntry, b: CatalogEntry) => recency(b) - recency(a) || a.anchor.id.localeCompare(b.anchor.id);
  const rows = items.filter(e => (status === 'all' || e.status === status) && (!needle ||
    [e.anchor.id, e.anchor.name, e.anchor.model.id_M, e.anchor.benchmark.schema, e.anchor.branch].some(v => (v ?? '').toLowerCase().includes(needle))));
  return rows.sort({
    status: (a: CatalogEntry, b: CatalogEntry) => statusRank(a.status) - statusRank(b.status) || recentFirst(a, b),
    new: recentFirst,
    name: (a: CatalogEntry, b: CatalogEntry) => (a.anchor.name || a.anchor.id).localeCompare(b.anchor.name || b.anchor.id) || a.anchor.id.localeCompare(b.anchor.id),
    sales: (a: CatalogEntry, b: CatalogEntry) => (paidSales(b) ?? -1) - (paidSales(a) ?? -1) || recentFirst(a, b),
  }[sort]);
}

export function verificationWindow(raw: unknown, address: string) {
  const view = ledgerView(raw, 'attest');
  if (!view || !isKnowledgeAuthor(address)) return null;
  const all = view.records.map(r => r.body as Record<string, any>);
  const mine = all.filter(b => b.verifier.toLowerCase() === address.toLowerCase());
  return { shown: all.length, ledgerTotal: view.info.records, networkFailed: all.filter(b => b.passed === false).length,
    total: mine.length, passed: mine.filter(b => b.passed === true).length, failed: mine.filter(b => b.passed === false).length,
    hashOnly: mine.filter(b => b.verified_on === 'hash-only').length, knowledges: new Set(mine.map(b => b.patch_id ?? b.id)).size };
}

export type VerificationPayment = { currency: string; state: string; evidence: string; amount: number };
/** The server's verification_total mixes currencies and unpaid claims. Keep those dimensions separate. */
export function verificationPayments(raw: unknown): VerificationPayment[] | null {
  if (!object(raw) || !Array.isArray(raw.verification)) return null;
  const groups = new Map<string, VerificationPayment>();
  const seen = new Set<string>();
  for (const r of raw.verification) {
    if (!object(r) || r.kind != null && r.kind !== 'verification' || !amount(r.amount) || typeof r.currency !== 'string' || !r.currency.trim()
      || !['credited', 'paid', 'pending', 'failed', 'unconfirmed'].includes(r.state)
      || r.evidence != null && !['record', 'seller_reported'].includes(r.evidence)) return null;
    if (r.settle_hash != null) {
      if (typeof r.settle_hash !== 'string' || !r.settle_hash || seen.has(r.settle_hash)) return null;
      seen.add(r.settle_hash);
    }
    const evidence = r.state === 'paid' ? r.evidence ?? 'unknown' : '';
    const key = JSON.stringify([r.currency, r.state, evidence]);
    const group = groups.get(key) ?? { currency: r.currency, state: r.state, evidence, amount: 0 };
    group.amount += Number(r.amount);
    if (!Number.isFinite(group.amount)) return null;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency) || a.state.localeCompare(b.state) || a.evidence.localeCompare(b.evidence));
}
