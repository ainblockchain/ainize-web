import { managedKnowledge } from './manageKnowledge';
import { requireRuntimeOperator, LoadKnowledgeError, type RuntimeTarget } from './loadKnowledge';

const canonical = (v: unknown) => JSON.stringify(v, (_key, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
export const collectionTarget = (a: RuntimeTarget) => ({ id: a.id, author: a.author.toLowerCase(), patch_sha256: a.patch_sha256,
  benchmark_hash: a.benchmark_hash, created_at: a.created_at, model: a.model, base: a.base ?? null });
export class CollectionError extends Error {
  constructor(readonly code: 'changed' | 'unconfirmed' | 'busy' | 'missing' | 'payment') { super(code); }
}
export async function collectKnowledge(target: RuntimeTarget, deps: {
  current: () => boolean; node: string | null; subject: string | null; readAccess: () => Promise<unknown>;
  inspectOnly?: boolean;
  read: () => Promise<unknown>; write: (expected: ReturnType<typeof collectionTarget>) => Promise<unknown>;
}) {
  const expected = structuredClone(collectionTarget(target));
  if (!await requireRuntimeOperator(deps)) return null;
  const before = managedKnowledge(await deps.read(), expected.id);
  if (!deps.current()) return null;
  if (!before || canonical(collectionTarget(before.anchor)) !== canonical(expected) || before.owned || !before.purchased) throw new CollectionError('changed');
  if (before.has_body) return { already: true };
  if (deps.inspectOnly) throw new CollectionError('missing');
  if (!await requireRuntimeOperator(deps)) return null;
  let reply: any;
  try { reply = await deps.write(expected); }
  catch (error: any) {
    if (!deps.current()) return null;
    if (error?.status === 401 || error?.status === 403) throw new LoadKnowledgeError('access');
    if (error?.status === 409 && typeof error?.data?.error === 'string') {
      if (error.data.error.startsWith('collection_target_changed:')) throw new CollectionError('changed');
      if (error.data.error.startsWith('purchase_action_busy:')) throw new CollectionError('busy');
      if (error.data.error.startsWith('collection_payment_pending:')) throw new CollectionError('payment');
    }
    throw new CollectionError('unconfirmed');
  }
  if (!deps.current()) return null;
  if (reply?.receipt_version !== 1 || reply.node !== deps.node || reply.patch_id !== expected.id || reply.redeemed !== true
    || reply.total !== '0' || !Array.isArray(reply.totals) || reply.totals.length || reply.manifest?.id !== expected.id
    || reply.manifest.patch_sha256 !== expected.patch_sha256 || typeof reply.path !== 'string' || !reply.path.trim()) throw new CollectionError('unconfirmed');
  let after;
  try { after = managedKnowledge(await deps.read(), expected.id); }
  catch { if (deps.current()) throw new CollectionError('unconfirmed'); return null; }
  if (!deps.current()) return null;
  if (!after || canonical(collectionTarget(after.anchor)) !== canonical(expected) || !after.purchased || !after.has_body) throw new CollectionError('unconfirmed');
  return { already: false };
}
