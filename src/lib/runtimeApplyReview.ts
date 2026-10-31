import type { RuntimeTarget } from './loadKnowledge';
import { sameAccountAddress, validAccountAddress } from './accountAccess';

type RecordRow = { patch_id: string; sha256: string };
export interface RuntimeApplyReview {
  version: 1; node: string; instance: string; requested: string[]; with_base: boolean; revision: string;
  before: RecordRow[]; after: RecordRow[];
  order: { anchor: RuntimeTarget; requested: boolean; physical_id: string; action: 'load' | 'reuse' }[];
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v;
const canonical = (v: unknown) => JSON.stringify(v, (_k, value) => object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value);
const target = (a: RuntimeTarget) => { const { id, name, author, patch_sha256, benchmark_hash, created_at, model, base } = a; return { id, name, author, patch_sha256, benchmark_hash, created_at, model, base }; };
export const sameRuntimeRecords = (a: RecordRow[], b: RecordRow[]) => a.length === b.length && a.every((row, i) => row.patch_id === b[i].patch_id && row.sha256 === b[i].sha256);
function records(raw: unknown): raw is RecordRow[] {
  return Array.isArray(raw) && raw.every(row => object(row) && text(row.patch_id) && text(row.sha256))
    && new Set(raw.map(row => row.patch_id)).size === raw.length && new Set(raw.map(row => row.sha256)).size === raw.length;
}

/** Validate the exact selected target, full prerequisite graph and physical load/reuse explanation. */
export function parseRuntimeApplyReview(raw: unknown, expected: RuntimeTarget, node: string | null, instance?: string): RuntimeApplyReview | null {
  if (!object(raw) || raw.version !== 1 || !validAccountAddress(raw.node) || !sameAccountAddress(raw.node, node)
    || typeof raw.instance !== 'string' || !/^[a-f0-9]{32}$/.test(raw.instance) || instance !== undefined && raw.instance !== instance
    || typeof raw.revision !== 'string' || !/^[a-f0-9]{64}$/.test(raw.revision) || typeof raw.with_base !== 'boolean'
    || !Array.isArray(raw.requested) || raw.requested.length !== 1 || raw.requested[0] !== expected.id
    || !records(raw.before) || !records(raw.after) || !Array.isArray(raw.order) || !raw.order.length) return null;
  if (!raw.order.every(row => object(row) && object(row.anchor) && text(row.anchor.id) && typeof row.anchor.name === 'string'
    && validAccountAddress(row.anchor.author) && text(row.anchor.patch_sha256) && text(row.anchor.benchmark_hash)
    && Number.isSafeInteger(row.anchor.created_at) && row.anchor.created_at >= 0 && object(row.anchor.model) && text(row.anchor.model.id_M)
    && typeof row.requested === 'boolean' && text(row.physical_id) && ['load', 'reuse'].includes(row.action))) return null;
  const review = raw as RuntimeApplyReview;
  if (new Set(review.order.map(row => row.anchor.id)).size !== review.order.length
    || canonical(target(review.order.at(-1)!.anchor)) !== canonical(target(expected))) return null;
  const planned = [...review.before];
  for (const row of review.order) {
    if (row.requested !== (row.anchor.id === expected.id)) return null;
    const physical = review.after.find(next => next.patch_id === row.physical_id);
    if (!physical || physical.sha256 !== row.anchor.patch_sha256) return null;
    const reused = review.before.some(next => next.patch_id === row.physical_id && next.sha256 === physical.sha256);
    if (row.action !== (reused ? 'reuse' : 'load') || !review.with_base && !row.requested && !reused) return null;
    if (!planned.some(next => next.patch_id === physical.patch_id)) planned.push(physical);
    const bases = row.anchor.base?.stack;
    if (row.anchor.base != null && !Array.isArray(bases)) return null;
    for (const base of bases ?? []) {
      if (!object(base) || !text(base.patch_id) || !text(base.patch_sha256)) return null;
      const prerequisite = review.order.find(next => next.anchor.id === base.patch_id);
      if (!prerequisite || prerequisite.anchor.patch_sha256 !== base.patch_sha256
        || review.after.findIndex(next => next.patch_id === prerequisite.physical_id) > review.after.findIndex(next => next.patch_id === row.physical_id)) return null;
    }
  }
  if (!sameRuntimeRecords(planned, review.after)) return null;
  const seen = new Set<string>(), visiting = new Set<string>();
  const visit = (id: string, depth: number): boolean => {
    if (visiting.has(id)) return false;
    if (seen.has(id)) return true;
    if (depth >= 8) return false;
    const row = review.order.find(item => item.anchor.id === id);
    if (!row) return false;
    visiting.add(id);
    for (const base of row.anchor.base?.stack ?? []) if (!visit(base.patch_id, depth + 1)) return false;
    visiting.delete(id); seen.add(id); return true;
  };
  if (!visit(expected.id, 0) || seen.size !== review.order.length) return null;
  return structuredClone(review);
}

/** Both the receipt and fresh records must preserve the complete reviewed physical stack/order. */
export function reviewedRuntimeOutcome(review: RuntimeApplyReview, reply: unknown, fresh: RecordRow[]): boolean {
  if (!object(reply) || !records(reply.stack) || !Array.isArray(reply.order) || !Array.isArray(reply.loaded) || !object(reply.aliases)
    || canonical(reply.order) !== canonical(review.order.map(row => row.anchor.id)) || !sameRuntimeRecords(reply.stack, review.after)) return false;
  const aliases = Object.fromEntries(review.order.filter(row => row.anchor.id !== row.physical_id).map(row => [row.anchor.id, row.physical_id]));
  const loaded = review.after.filter(row => !review.before.some(old => old.patch_id === row.patch_id)).map(row => row.patch_id);
  if (canonical(reply.aliases) !== canonical(aliases) || canonical(reply.loaded) !== canonical(loaded)) return false;
  // Unrelated later loads may append; removing, replacing or reordering any reviewed layer remains unconfirmed.
  return fresh.length >= review.after.length && sameRuntimeRecords(fresh.slice(0, review.after.length), review.after);
}
