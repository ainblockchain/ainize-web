import type { PatchAnchor, PurchaseResult } from '../api/types';
import { collectionTarget } from './collectKnowledge';
import { requireRuntimeOperator, type RuntimeTarget } from './loadKnowledge';
import { managedKnowledge } from './manageKnowledge';
import { purchaseResult, purchaseChargeTotals } from './purchaseResult';
import type { OperationStorage } from './runtimeOperation';

export type PurchaseSelection = RuntimeTarget | Pick<RuntimeTarget, 'id' | 'author'>;
export interface PurchaseReviewItem {
  anchor: PatchAnchor; status: string; sellable: boolean; challenged: boolean;
  owned: boolean; purchased: boolean; licensed: boolean; has_body: boolean; pending: boolean;
  action: 'buy' | 'collect' | 'keep';
}
export interface PurchaseReview {
  version: 1; revision: string; node: string; patch_id: string; again: boolean;
  items: PurchaseReviewItem[]; maximum: { amount: string; currency: string }[];
}
export interface PurchaseOutcome {
  version: 1; node: string; patch_id: string; again: boolean; revision: string; state: 'complete' | 'incomplete';
  items: { id: string; sha256: string; state: 'kept' | 'complete' | 'failed'; receipt?: PurchaseResult; error?: string }[];
  confirmed_totals: { amount: string; currency: string }[];
}
export interface PurchaseOperation { owner: string; id: string; subject: string | null; review: PurchaseReview }
export interface PurchaseRequest {
  evidence_version?: 1;
  version: 1; id: string; node: string; subject: string; patch_id: string; again: boolean; revision: string;
  state: 'running' | 'finished' | 'failed' | 'interrupted' | 'refused'; created_at: number; updated_at: number;
  result: PurchaseOutcome | null; error: string | null;
}
export class PurchaseReviewError extends Error {
  constructor(readonly code: 'changed' | 'unconfirmed' | 'storage' | 'pending' | 'files') { super(code); }
}
const object = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: any): v is string => typeof v === 'string' && !!v.trim();
const amount = (v: any): v is string => typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v);
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const within = (a: string, b: string) => {
  const scale = Math.max(a.split('.')[1]?.length ?? 0, b.split('.')[1]?.length ?? 0);
  const units = (v: string) => { const [w, f = ''] = v.split('.'); return BigInt(w + f.padEnd(scale, '0')); };
  return units(a) <= units(b);
};
export function parsePurchaseReview(raw: unknown, target: PurchaseSelection, node: string | null, again: boolean): PurchaseReview | null {
  const r = (raw as any)?.review;
  if (!object(r) || r.version !== 1 || !text(r.node) || r.node !== node || !node || r.patch_id !== target.id || typeof r.again !== 'boolean' || r.again !== again
    || !text(r.revision) || !/^[a-f0-9]{64}$/.test(r.revision) || !Array.isArray(r.items) || !r.items.length || r.items.length > 1000
    || !Array.isArray(r.maximum) || !r.maximum.every((v: any) => v && amount(v.amount) && text(v.currency))) return null;
  const seen = new Set<string>();
  for (const i of r.items) {
    const a = i?.anchor;
    if (!object(i) || !object(a) || ![a.id, a.name, a.author, a.patch_sha256, a.benchmark_hash, a.currency, i.status].every(text)
      || !amount(a.price) || !Number.isSafeInteger(a.created_at) || a.created_at < 0 || !object(a.model) || !text(a.model.id_M)
      || !['sellable', 'challenged', 'owned', 'purchased', 'licensed', 'has_body', 'pending'].every(k => typeof i[k] === 'boolean')
      || seen.has(a.id) || a.base != null && (!object(a.base) || !Array.isArray(a.base.stack))
      || (a.base?.stack ?? []).some((b: any) => !object(b) || !text(b.patch_id) || !seen.has(b.patch_id))) return null;
    const expected = a.id === target.id && again ? 'buy' : i.licensed && i.has_body ? 'keep' : i.purchased ? 'collect' : 'buy';
    if (i.action !== expected || a.id === target.id && i.owned || i.owned && !i.has_body
      || i.action !== 'keep' && i.pending || i.action === 'buy' && (!i.sellable || i.challenged)) return null;
    seen.add(a.id);
  }
  const root = r.items.at(-1);
  if (root.anchor.id !== target.id || root.anchor.author.toLowerCase() !== target.author.toLowerCase()
    || 'patch_sha256' in target && canonical(collectionTarget(root.anchor)) !== canonical(collectionTarget(target))) return null;
  const totals = purchaseChargeTotals(r.items.filter((i: PurchaseReviewItem) => i.action === 'buy').map((i: PurchaseReviewItem) => ({ amount: i.anchor.price, currency: i.anchor.currency })));
  if (!totals || canonical(totals) !== canonical(r.maximum)) return null;
  return structuredClone(r);
}
export function parsePurchaseOutcome(raw: unknown, review: PurchaseReview): PurchaseOutcome | null {
  const r = raw as any;
  if (!object(r) || r.version !== 1 || r.node !== review.node || r.patch_id !== review.patch_id || r.again !== review.again || r.revision !== review.revision
    || !['complete', 'incomplete'].includes(r.state) || !Array.isArray(r.items) || r.items.length > review.items.length
    || !Array.isArray(r.confirmed_totals) || !r.confirmed_totals.every((v: any) => v && amount(v.amount) && text(v.currency))) return null;
  const charges: { amount: string; currency: string }[] = [];
  for (const [index, i] of r.items.entries()) {
    const expected = review.items[index], a = expected.anchor;
    if (!object(i) || i.id !== a.id || i.sha256 !== a.patch_sha256) return null;
    if (i.state === 'failed') { if (index !== r.items.length - 1 || !text(i.error)) return null; }
    else if (i.state === 'kept') { if (expected.action !== 'keep') return null; }
    else if (i.state === 'complete') {
      if (expected.action === 'keep') return null;
      const receipt = purchaseResult(i.receipt, a.id, a.patch_sha256, review.node);
      if (!receipt || !receipt.totals || receipt.purchases?.some(p => p.patch_id !== a.id)) return null;
      for (const charge of receipt.totals) {
        if (expected.action !== 'buy' || charge.currency !== a.currency || !within(charge.amount, a.price)) return null;
        charges.push(charge);
      }
    } else return null;
  }
  const complete = r.items.length === review.items.length && r.items.every((i: any) => i.state !== 'failed');
  if ((r.state === 'complete') !== complete || canonical(purchaseChargeTotals(charges)) !== canonical(r.confirmed_totals)) return null;
  return structuredClone(r);
}
export function parsePurchaseRequest(raw: unknown, op: PurchaseOperation): PurchaseRequest | null {
  const r = (raw as any)?.request;
  if (!object(r) || r.version !== 1 || r.id !== op.id || r.node !== op.review.node || r.patch_id !== op.review.patch_id
    || r.revision !== op.review.revision || r.again !== op.review.again || !text(r.subject)
    || r.subject.toLowerCase() !== (op.subject ?? op.review.node).toLowerCase()
    || !['running', 'finished', 'failed', 'interrupted', 'refused'].includes(r.state)
    || !Number.isSafeInteger(r.created_at) || !Number.isSafeInteger(r.updated_at) || r.created_at < 0 || r.updated_at < r.created_at
    || r.error !== null && typeof r.error !== 'string') return null;
  const result = r.result === null ? null : parsePurchaseOutcome(r.result, op.review);
  if (r.result !== null && !result || r.state === 'finished' && !result || ['failed', 'refused'].includes(r.state) && !text(r.error) || r.state === 'refused' && r.result !== null) return null;
  return { ...r, result };
}
export const purchaseOwner = (identity: string, node: string | null, id: string) => `ainize:purchase:v1:${JSON.stringify([identity, node, id])}`;
export function readPurchaseOperation(storage: OperationStorage, owner: string): PurchaseOperation | null {
  try {
    const raw = storage.getItem(owner); if (!raw) return null;
    const op = JSON.parse(raw), target = op.review?.items?.at(-1)?.anchor;
    if (op.owner !== owner || !/^[a-f0-9]{32}$/.test(op.id) || op.subject !== null && !text(op.subject)
      || !target || !parsePurchaseReview({ review: op.review }, target, op.review.node, op.review.again)) throw new Error('invalid');
    return op;
  } catch { throw new PurchaseReviewError('storage'); }
}
export function claimPurchaseOperation(storage: OperationStorage, op: PurchaseOperation) {
  if (readPurchaseOperation(storage, op.owner)) throw new PurchaseReviewError('pending');
  try { storage.setItem(op.owner, JSON.stringify(op)); if (canonical(readPurchaseOperation(storage, op.owner)) !== canonical(op)) throw new Error('not stored'); }
  catch { throw new PurchaseReviewError('storage'); }
}
export function clearPurchaseOperation(storage: OperationStorage, op: PurchaseOperation) {
  if (readPurchaseOperation(storage, op.owner)?.id !== op.id) throw new PurchaseReviewError('storage');
  try { storage.removeItem(op.owner); } catch { throw new PurchaseReviewError('storage'); }
}
interface Reads {
  current: () => boolean; node: string | null; subject: string | null; readAccess: () => Promise<unknown>;
  review: (id: string, again: boolean) => Promise<unknown>;
}
export async function reviewPurchase(target: PurchaseSelection, again: boolean, deps: Reads) {
  if (!await requireRuntimeOperator(deps)) return null;
  const raw = await deps.review(target.id, again); if (!deps.current()) return null;
  const result = parsePurchaseReview(raw, target, deps.node, again);
  if (!result) throw new PurchaseReviewError('changed');
  return result;
}
export async function confirmPurchase(op: PurchaseOperation, deps: Reads & { claim: () => Promise<void>; write: () => Promise<unknown> }) {
  const fresh = await reviewPurchase(op.review.items.at(-1)!.anchor, op.review.again, deps);
  if (!fresh) return null;
  if (canonical(fresh) !== canonical(op.review)) throw new PurchaseReviewError('changed');
  if (!await requireRuntimeOperator(deps)) return null;
  await deps.claim();
  if (!deps.current()) return null;
  let raw;
  try { raw = await deps.write(); } catch { if (deps.current()) throw new PurchaseReviewError('unconfirmed'); return null; }
  if (!deps.current()) return null;
  const request = parsePurchaseRequest(raw, op); if (!request) throw new PurchaseReviewError('unconfirmed');
  return request;
}
export async function confirmPurchasedFiles(op: PurchaseOperation, request: PurchaseRequest, deps: { current: () => boolean; read: (id: string) => Promise<unknown> }) {
  if (request.state === 'running' || request.result?.state !== 'complete') return false;
  for (const item of op.review.items) {
    const value = managedKnowledge(await deps.read(item.anchor.id), item.anchor.id);
    if (!deps.current()) return false;
    if (!value || !value.has_body || canonical(collectionTarget(value.anchor)) !== canonical(collectionTarget(item.anchor))) throw new PurchaseReviewError('files');
  }
  return true;
}
