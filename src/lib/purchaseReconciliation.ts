import type { PatchAnchor } from '../api/types';
import type { PurchaseOperation } from './purchaseReview';
import { PurchaseReviewError } from './purchaseReview';
import { collectionTarget } from './collectKnowledge';
import { managedKnowledge } from './manageKnowledge';
export interface ReconciliationItem {
  id: string; anchor: PatchAnchor; state: 'complete' | 'paid_missing_file' | 'not_started' | 'unconfirmed' | 'changed'; has_body: boolean; can_collect: boolean;
  payment: { evidence: 'request_receipt' | 'purchase' | 'settlement' | 'free'; amount: string; currency: string | null; scheme: string; tx_hash: string } | null;
}
export interface PurchaseReconciliation {
  version: 1; request_id: string; node: string; subject: string; patch_id: string; revision: string; evidence_revision: string;
  state: 'running' | 'complete' | 'incomplete' | 'unavailable'; items: ReconciliationItem[];
}
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v: any) => typeof v === 'string' && !!v.trim();
const canonical = (v: unknown) => JSON.stringify(v, (_k, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const within = (value: string, maximum: string) => {
  const scale = Math.max(value.split('.')[1]?.length ?? 0, maximum.split('.')[1]?.length ?? 0);
  const units = (v: string) => { const [w, f = ''] = v.split('.'); return BigInt(w + f.padEnd(scale, '0')); };
  return units(value) <= units(maximum);
};
export function parsePurchaseReconciliation(raw: unknown, op: PurchaseOperation): PurchaseReconciliation | null {
  const r = (raw as any)?.reconciliation;
  if (!object(r) || r.version !== 1 || r.request_id !== op.id || r.node !== op.review.node || r.patch_id !== op.review.patch_id
    || !text(r.subject) || r.subject.toLowerCase() !== (op.subject ?? op.review.node).toLowerCase() || r.revision !== op.review.revision
    || !text(r.evidence_revision) || !/^[a-f0-9]{64}$/.test(r.evidence_revision) || !['running', 'complete', 'incomplete', 'unavailable'].includes(r.state)
    || !Array.isArray(r.items) || (r.state === 'unavailable' ? r.items.length !== 0 : r.items.length !== op.review.items.length)) return null;
  for (const [index, i] of r.items.entries()) {
    const expected = op.review.items[index];
    if (!object(i) || i.id !== expected.anchor.id || !object(i.anchor) || typeof i.anchor.author !== 'string' || typeof i.has_body !== 'boolean' || typeof i.can_collect !== 'boolean'
      || canonical(collectionTarget(i.anchor)) !== canonical(collectionTarget(expected.anchor))
      || !['complete', 'paid_missing_file', 'not_started', 'unconfirmed', 'changed'].includes(i.state)) return null;
    const p = i.payment;
    if (p !== null && (!object(p) || !['request_receipt', 'purchase', 'settlement', 'free'].includes(p.evidence)
      || typeof p.amount !== 'string' || !/^\d+(?:\.\d+)?$/.test(p.amount) || p.currency !== null && !text(p.currency)
      || !text(p.scheme) || typeof p.tx_hash !== 'string' || !p.tx_hash && (p.scheme !== 'free' || /[1-9]/.test(p.amount)))) return null;
    if (p && (p.scheme === 'free' && (p.tx_hash || /[1-9]/.test(p.amount)) || p.evidence === 'free' && p.scheme !== 'free'
      || expected.action === 'buy' && p.scheme !== 'free' && (p.currency !== expected.anchor.currency || !within(p.amount, expected.anchor.price)))) return null;
    if (i.state === 'complete' && !i.has_body || i.state === 'paid_missing_file' && (i.has_body || !p)
      || i.state === 'complete' && expected.action === 'buy' && /[1-9]/.test(expected.anchor.price) && !p
      || i.can_collect && (i.state !== 'paid_missing_file' || r.state === 'running')
      || ['not_started', 'unconfirmed', 'changed'].includes(i.state) && p) return null;
  }
  const all = r.items.length > 0 && r.items.every((i: ReconciliationItem) => i.state === 'complete');
  if (r.state === 'complete' && !all || r.state === 'incomplete' && all) return null;
  return structuredClone(r);
}
export async function confirmReconciledFiles(op: PurchaseOperation, evidence: PurchaseReconciliation, deps: { current: () => boolean; read: (id: string) => Promise<unknown> }) {
  if (!parsePurchaseReconciliation({ reconciliation: evidence }, op) || evidence.state !== 'complete') return false;
  for (const item of evidence.items) {
    const value = managedKnowledge(await deps.read(item.id), item.id);
    if (!deps.current()) return false;
    if (!value?.has_body || canonical(collectionTarget(value.anchor)) !== canonical(collectionTarget(item.anchor))) throw new PurchaseReviewError('files');
  }
  return true;
}
