import type { PatchAnchor, PatchDetail, StackLayer } from '../api/types';
import { accountRuntime } from './accountNodeActions';
import { managedKnowledge } from './manageKnowledge';
import { sameAccountAddress, validAccountAddress } from './accountAccess';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(id => typeof id === 'string' && !!id) && new Set(v).size === v.length;
const canonical = (v: unknown) => JSON.stringify(v, (_k, value) => object(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value);
export class LoadKnowledgeError extends Error {
  constructor(readonly code: 'access' | 'read' | 'changed' | 'unavailable' | 'not_loaded' | 'unconfirmed') { super(code); }
}
function selected(raw: unknown, expected: PatchAnchor): PatchDetail {
  const detail = managedKnowledge(raw, expected.id);
  if (!detail) throw new LoadKnowledgeError('read');
  const a = detail.anchor;
  if (!sameAccountAddress(a.author, expected.author) || a.patch_sha256 !== expected.patch_sha256
    || a.benchmark_hash !== expected.benchmark_hash || a.created_at !== expected.created_at
    || canonical(a.model) !== canonical(expected.model) || canonical(a.base) !== canonical(expected.base)) throw new LoadKnowledgeError('changed');
  return detail;
}
function stack(raw: unknown): StackLayer[] | null {
  if (!Array.isArray(raw) || !raw.every(object)) return null;
  return accountRuntime({ available: true, hook: true, applied: raw.map(row => row.patch_id), stack: raw })?.stack ?? null;
}
export function runtimeRefusal(error: unknown, kind: 'needs_base' | 'has_dependents') {
  if (!object(error) || error.status !== 409 || !object(error.data) || typeof error.data.error !== 'string'
    || !error.data.error.startsWith(`${kind}:`)) return null;
  const list = error.data[kind === 'needs_base' ? 'missing' : 'ids'];
  return ids(list) && list.length ? list : null;
}
export const runtimeBaseMismatch = (error: unknown) => object(error) && error.status === 409 && object(error.data)
  && typeof error.data.error === 'string' && error.data.error.startsWith('base_mismatch:');
export async function changeRuntimeKnowledge(expected: PatchAnchor, kind: 'load' | 'unload', withBase: boolean, deps: {
  current: () => boolean; readAccess: () => Promise<unknown>; read: () => Promise<unknown>;
  runtime: () => Promise<unknown>; write: () => Promise<unknown>;
  node: string | null; subject: string | null;
}) {
  if (!deps.current()) return null;
  const access = await deps.readAccess();
  if (!deps.current()) return null;
  if (!object(access) || access.signedIn !== true || access.isOwner !== true || !validAccountAddress(deps.node)
    || !sameAccountAddress(access.address, deps.node)
    || (deps.subject === null ? access.subject !== null : !sameAccountAddress(access.subject, deps.subject))) throw new LoadKnowledgeError('access');
  const before = selected(await deps.read(), expected);
  if (!deps.current()) return null;
  const runtime = accountRuntime(await deps.runtime());
  if (!deps.current()) return null;
  if (!runtime?.available || !runtime.stack) throw new LoadKnowledgeError('unavailable');
  const recorded = runtime.stack.find(row => row.patch_id === expected.id);
  if (recorded && recorded.sha256 !== expected.patch_sha256) throw new LoadKnowledgeError('changed');
  if (kind === 'unload' && !recorded) throw new LoadKnowledgeError('not_loaded');
  if (kind === 'load' && !before.has_body) throw new LoadKnowledgeError('read');
  if (kind === 'load' && recorded && before.applied) return { order: [expected.id], already: true, alias: null };
  let reply: unknown;
  try { reply = await deps.write(); }
  catch (error) {
    if (!deps.current()) return null;
    // A documented refusal is actionable. Transport/server errors may have happened after mutation.
    if (object(error) && typeof error.status === 'number' && error.status >= 400 && error.status < 500) throw error;
    throw new LoadKnowledgeError('unconfirmed');
  }
  if (!deps.current()) return null;
  if (!object(reply) || typeof reply.result !== 'string') throw new LoadKnowledgeError('unconfirmed');
  const acknowledged = stack(reply.stack);
  if (!acknowledged) throw new LoadKnowledgeError('unconfirmed');
  if (kind === 'load' && (!ids(reply.order) || reply.order.at(-1) !== expected.id || !ids(reply.loaded)
    || !withBase && reply.loaded.some(id => id !== expected.id && !runtime.applied.includes(id)))) throw new LoadKnowledgeError('unconfirmed');
  const matches = (rows: StackLayer[]) => kind === 'load' ? rows.some(row => row.sha256 === expected.patch_sha256)
    && !rows.some(row => row.patch_id === expected.id && row.sha256 !== expected.patch_sha256)
    : !rows.some(row => row.patch_id === expected.id);
  if (!matches(acknowledged)) throw new LoadKnowledgeError('unconfirmed');
  const confirmedOrder = (rows: StackLayer[]) => {
    if (kind !== 'load') return true;
    const positions = (reply.order as string[]).map(id => rows.findIndex(row => row.patch_id === id || id === expected.id && row.sha256 === expected.patch_sha256));
    return positions.every((position, index) => position >= 0 && (index === 0 || position >= positions[index - 1]));
  };
  if (!confirmedOrder(acknowledged) || kind === 'load' && (reply.loaded as string[]).some(id => !acknowledged.some(row => row.patch_id === id))) throw new LoadKnowledgeError('unconfirmed');
  let after: PatchDetail, fresh;
  try { after = selected(await deps.read(), expected); if (!deps.current()) return null; fresh = accountRuntime(await deps.runtime()); }
  catch { if (!deps.current()) return null; throw new LoadKnowledgeError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!fresh?.available || !fresh.stack || !matches(fresh.stack) || !confirmedOrder(fresh.stack)) throw new LoadKnowledgeError('unconfirmed');
  if (kind === 'unload') {
    if (after.applied || runtime.stack.some(row => row.patch_id !== expected.id && !fresh!.stack!.some(next => next.patch_id === row.patch_id && next.sha256 === row.sha256))) throw new LoadKnowledgeError('unconfirmed');
    return { order: [] as string[], already: false, alias: null };
  }
  const exact = fresh.stack.find(row => row.patch_id === expected.id && row.sha256 === expected.patch_sha256);
  if (!!exact !== after.applied) throw new LoadKnowledgeError('unconfirmed');
  const alias = exact ? null : fresh.stack.find(row => row.sha256 === expected.patch_sha256)!.patch_id;
  return { order: reply.order as string[], already: false, alias };
}
