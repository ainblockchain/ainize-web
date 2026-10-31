import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { BranchesResponse, CatalogEntry } from '../api/types';
import { isKnowledgeAuthor } from './detailRoutes';

const object = (v: unknown): Record<string, any> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const text = (v: unknown): v is string => typeof v === 'string';
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => text(x) && !!x) && new Set(v).size === v.length;
const amount = (v: unknown) => text(v) && v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
const statuses = ['ANNOUNCED', 'VERIFYING', 'VERIFIED', 'REJECTED', 'CHALLENGED', 'SUPERSEDED', 'RETIRED'];
const invalid = (): FetchBaseQueryError => ({ status: 'CUSTOM_ERROR', error: 'Track records changed or returned invalid data. Refresh to try again.' });

export function trackBranches(raw: unknown): BranchesResponse | null {
  const p = object(raw);
  if (!p || !strings(p.mine) || !Array.isArray(p.branches)) return null;
  if (!p.branches.every((b: any) => object(b) && text(b.name) && !!b.name && text(b.description) && text(b.owner)
    && object(b.context) && Object.values(b.context).every(text) && count(b.created_at)
    && strings(b.patch_ids) && strings(b.current) && b.current.every((id: string) => b.patch_ids.includes(id))
    && Array.isArray(b.subscribers) && b.subscribers.every((s: any) => object(s) && text(s.address) && (s.name == null || text(s.name)))
    && (b.terms == null || object(b.terms) && amount(b.terms.price) && text(b.terms.currency) && !!b.terms.currency && typeof b.terms.period_days === 'number' && Number.isFinite(b.terms.period_days) && b.terms.period_days > 0))) return null;
  if (new Set(p.branches.map((b: any) => b.name)).size !== p.branches.length) return null;
  return p as BranchesResponse;
}

function trackEntry(raw: unknown): raw is CatalogEntry {
  const p = object(raw), a = object(p?.anchor);
  return !!p && !!a && text(a.id) && !!a.id && text(a.author) && isKnowledgeAuthor(a.author)
    && (a.name == null || text(a.name)) && count(a.created_at) && !!object(a.model) && text(a.model.id_M)
    && amount(a.price) && (p.list_price == null || amount(p.list_price)) && text(a.currency) && !!a.currency && amount(p.revenue)
    && !!object(p.sales) && count(p.sales.sales_all) && statuses.includes(p.status);
}

export interface CatalogSnapshot { items: CatalogEntry[] }
export interface TrackCatalog extends CatalogSnapshot { name: string }
export function catalogSnapshotView(raw: unknown): CatalogSnapshot | null {
  const p = object(raw);
  return p && Array.isArray(p.items) && p.items.every(trackEntry)
    && new Set(p.items.map((e: CatalogEntry) => e.anchor.id)).size === p.items.length ? p as CatalogSnapshot : null;
}
export function trackCatalogView(raw: unknown, name: string): TrackCatalog | null {
  const p = object(raw);
  return p?.name === name && Array.isArray(p.items) && p.items.every(trackEntry)
    && new Set(p.items.map((e: CatalogEntry) => e.anchor.id)).size === p.items.length ? p as TrackCatalog : null;
}

/** The public catalog caps each page at 200 and omits retired knowledge unless explicitly requested. */
export async function loadTrackCatalog(name: string, query: (url: string) => Promise<{ data?: unknown; error?: FetchBaseQueryError }>, signal?: AbortSignal): Promise<{ data: TrackCatalog } | { error: FetchBaseQueryError }> {
  const result = await loadCatalogSnapshot(query, signal, name);
  return 'data' in result ? { data: { name, ...result.data } } : result;
}

export async function loadCatalogSnapshot(query: (url: string) => Promise<{ data?: unknown; error?: FetchBaseQueryError }>, signal?: AbortSignal, branch?: string): Promise<{ data: CatalogSnapshot } | { error: FetchBaseQueryError }> {
  const items: CatalogEntry[] = [], seen = new Set<string>();
  let total: number | undefined;
  do {
    if (signal?.aborted) return { error: { status: 'CUSTOM_ERROR', error: 'Track read cancelled' } };
    const params = new URLSearchParams({ status: statuses.join(','), limit: '200', offset: String(items.length) });
    if (branch !== undefined) params.set('branch', branch);
    const reply = await query(`api/catalog?${params}`);
    if (reply.error) return { error: reply.error };
    const page = object(reply.data);
    if (!page || !count(page.total) || !Array.isArray(page.items) || !page.items.every(trackEntry)
      || (total !== undefined && total !== page.total) || page.items.length !== Math.min(200, page.total - items.length)) return { error: invalid() };
    total = page.total;
    for (const entry of page.items as CatalogEntry[]) {
      if (seen.has(entry.anchor.id)) return { error: invalid() };
      seen.add(entry.anchor.id); items.push(entry);
    }
  } while (items.length < total!);
  return { data: { items } };
}

/** Missing public records mean a partial summary, not zero sales. Currencies must never be added together. */
export function trackSales(members: string[], items: CatalogEntry[]) {
  const ids = new Set(members), rows = items.filter(e => ids.has(e.anchor.id));
  const totals = new Map<string, { currency: string; sales: number; revenue: number }>();
  for (const e of rows) {
    const total = totals.get(e.anchor.currency) ?? { currency: e.anchor.currency, sales: 0, revenue: 0 };
    total.sales += e.sales!.sales_all; total.revenue += Number(e.revenue); totals.set(total.currency, total);
  }
  return { found: rows.length, missing: members.length - rows.length, totals: [...totals.values()] };
}

/** This API returns a bounded newest-first window, not a complete per-track history. */
export function trackHistory(raw: unknown, name: string) {
  const p = object(raw);
  if (!p || !Array.isArray(p.records) || !p.records.every((r: any) => object(r) && r.kind === 'subscribe' && text(r.hash) && count(r.ts)
    && object(r.body) && text(r.body.branch) && text(r.body.node) && ['subscribe', 'unsubscribe'].includes(r.body.action))) return null;
  const rows = p.records.filter((r: any) => r.body.branch === name).map((r: any) => ({ id: r.hash, node: r.body.node as string, left: r.body.action === 'unsubscribe', ts: r.ts as number })).sort((a: any, b: any) => b.ts - a.ts);
  return { rows, joined: rows.filter((r: any) => !r.left).length, left: rows.filter((r: any) => r.left).length, window: p.records.length };
}

export function trackSubscribeCommand(name: string): string {
  const arg = /^[a-zA-Z0-9_./-]+$/.test(name) ? name : `'${name.replace(/'/g, `'"'"'`)}'`;
  return `ainize branch subscribe ${name.startsWith('-') ? '-- ' : ''}${arg}`;
}
