import type { GraphResponse, LedgerRecord, LedgerResponse, VerifyResponse } from '../api/types';
import { isKnowledgeAuthor } from './detailRoutes';

export const LEDGER_KINDS = ['anchor', 'attest', 'settle', 'branch', 'node', 'supersede', 'subscribe', 'challenge', 'retire', 'dispute', 'price', 'payout'];
const object = (v: unknown): Record<string, any> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const text = (v: unknown): v is string => typeof v === 'string';
const optionalText = (v: unknown) => v == null || text(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const amount = (v: unknown) => text(v) && !!v.trim() && Number.isFinite(Number(v)) && Number(v) >= 0;
const texts = (p: Record<string, any>, fields: string[]) => fields.every(k => text(p[k]));
const amounts = (v: unknown) => v == null || !!object(v) && Object.values(v as object).every(amount);

function bodyValid(kind: string, raw: unknown) {
  const b = object(raw); if (!b) return false;
  switch (kind) {
    case 'anchor': return texts(b, ['id', 'name', 'author']) && optionalText(b.author_name) && (b.contributors == null || Array.isArray(b.contributors) && b.contributors.every((c: any) => object(c) && ['name', 'address', 'signer'].every(k => optionalText(c[k]))));
    case 'attest': return text(b.patch_id ?? b.id) && text(b.verifier) && optionalText(b.verifier_name) && typeof b.passed === 'boolean' && text(b.verified_on);
    case 'settle': return text(b.patch_id ?? b.resource) && texts(b, ['buyer', 'seller', 'currency']) && amount(b.amount) && amounts(b.royalty) && amounts(b.royalty_unresolved);
    case 'supersede': return texts(b, ['new_patch_id', 'old_patch_id']) && (b.overlap_rows == null || count(b.overlap_rows));
    case 'challenge': return texts(b, ['patch_id', 'challenger', 'reason']);
    case 'branch': return text(b.name) && strings(b.patch_ids);
    case 'subscribe': return texts(b, ['node', 'branch']) && ['subscribe', 'unsubscribe'].includes(b.action);
    case 'node': return texts(b, ['address', 'name']) && optionalText(b.endpoint) && strings(b.roles);
    case 'retire': return text(b.patch_id) && optionalText(b.reason);
    case 'price': return texts(b, ['patch_id', 'currency']) && amount(b.price);
    case 'payout': return texts(b, ['patch_id', 'to', 'currency']) && amount(b.amount);
    case 'dispute': return texts(b, ['patch_id', 'author', 'reason']) && ['claim', 'answer'].includes(b.role);
    default: return true;
  }
}

export function ledgerView(raw: unknown, kind: string): LedgerResponse | null {
  const p = object(raw), info = object(p?.info);
  if (!p || !info || !['local', 'ain'].includes(info.kind) || !text(info.network) || !count(info.records)
    || (info.height != null && !count(info.height)) || !['provider', 'head', 'app'].every(k => optionalText(info[k]))
    || !Array.isArray(p.records) || p.records.length > info.records) return null;
  if (!p.records.every((r: any) => object(r) && text(r.hash) && !!r.hash && text(r.kind) && (!kind || r.kind === kind)
    && text(r.author) && count(r.ts) && optionalText(r.sig) && bodyValid(r.kind, r.body))) return null;
  if (new Set(p.records.map((r: any) => r.hash)).size !== p.records.length) return null;
  return { ...p, records: [...p.records].sort((a, b) => b.ts - a.ts) } as LedgerResponse;
}

export function ledgerVerification(raw: unknown): VerifyResponse | null {
  const p = object(raw);
  return p && typeof p.valid === 'boolean' && count(p.checked) && strings(p.errors)
    && p.valid === (p.errors.length === 0) ? p as VerifyResponse : null;
}

/** Newest records win; an older self-declared name must not replace a later one. */
export function ledgerNames(records: LedgerRecord[]): Map<string, string> {
  const names = new Map<string, string>();
  const add = (address: string | undefined, name: string | undefined) => { if (address && name && !names.has(address.toLowerCase())) names.set(address.toLowerCase(), name); };
  for (const r of [...records].sort((a, b) => b.ts - a.ts)) {
    const b = r.body as Record<string, any>;
    if (r.kind === 'node') add(b.address, b.name);
    if (r.kind === 'anchor') {
      add(b.author, b.author_name);
      for (const c of b.contributors ?? []) { add(c.address, c.name); add(c.signer, c.name); }
    }
  }
  return names;
}

export function ledgerGraph(raw: unknown): GraphResponse | null {
  const p = object(raw);
  if (!p || !Array.isArray(p.nodes) || !Array.isArray(p.edges)) return null;
  if (!p.nodes.every((n: any) => object(n) && texts(n, ['id', 'name', 'author', 'model', 'schema', 'status']) && !!n.id && isKnowledgeAuthor(n.author) && n.status !== 'DRAFT')) return null;
  const ids = new Set<string>(p.nodes.map((n: any) => n.id));
  if (ids.size !== p.nodes.length || !p.edges.every((e: any) => object(e) && texts(e, ['from', 'to']) && ['extends', 'supersedes'].includes(e.type))) return null;
  if (new Set(p.edges.map((e: any) => JSON.stringify([e.from, e.to, e.type]))).size !== p.edges.length) return null;
  // Layout assumes an acyclic parent graph. Missing public ancestors remain a separately explained omission.
  const degree = new Map([...ids].map(id => [id, 0])), children = new Map<string, string[]>();
  for (const e of p.edges) if (e.type === 'extends' && ids.has(e.from) && ids.has(e.to)) {
    degree.set(e.from, degree.get(e.from)! + 1); children.set(e.to, [...(children.get(e.to) ?? []), e.from]);
  }
  const queue = [...ids].filter(id => degree.get(id) === 0);
  for (let i = 0; i < queue.length; i++) for (const child of children.get(queue[i]) ?? []) { const n = degree.get(child)! - 1; degree.set(child, n); if (!n) queue.push(child); }
  return queue.length === ids.size ? p as GraphResponse : null;
}

export function ledgerSourceUrl(provider: string | undefined, app: string | undefined): string | null {
  if (!provider || !app) return null;
  try {
    const url = new URL(provider);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/$/, '')}/get_value`; url.searchParams.set('ref', app); return url.href;
  } catch { return null; }
}
