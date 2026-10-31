export interface KnowledgeDemandTarget { patch_id: string; author: string; patch_sha256: string; requester: string; }
export interface KnowledgeDemandStatus extends KnowledgeDemandTarget {
  version: 1; node: string; actor: string | null; scope: 'account' | 'network';
  requested: boolean; available: boolean; can_request: boolean; requests: number; count_scope: 'retained_requests'; event_id: number | null;
}
type Selection = { id: string; author: string };
type Context = { node: string | null; actor: string | null };
const object = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: any): v is string => typeof v === 'string' && !!v.trim();
const principal = (v: string | null) => v && /^0x[\da-f]{40}$/i.test(v) ? v.toLowerCase() : v;
export const knowledgeDemandTarget = (value: KnowledgeDemandStatus): KnowledgeDemandTarget => ({
  patch_id: value.patch_id, author: value.author, patch_sha256: value.patch_sha256, requester: value.requester,
});
export function parseKnowledgeDemand(raw: unknown, selected: Selection, context: Context, expected?: KnowledgeDemandTarget): KnowledgeDemandStatus | null {
  const r = raw as any;
  if (!object(r) || r.version !== 1 || !context.node || r.node !== context.node || r.patch_id !== selected.id
    || !text(r.author) || r.author.toLowerCase() !== selected.author.toLowerCase() || !text(r.patch_sha256) || !text(r.requester)
    || r.actor !== null && !text(r.actor) || principal(r.actor) !== principal(context.actor) || r.scope !== (r.actor ? 'account' : 'network')
    || r.count_scope !== 'retained_requests' || !Number.isSafeInteger(r.requests) || r.requests < 0
    || typeof r.requested !== 'boolean' || typeof r.available !== 'boolean' || typeof r.can_request !== 'boolean'
    || r.can_request !== (!r.requested && !r.available)
    || (r.requested ? !Number.isSafeInteger(r.event_id) || r.event_id < 1 || r.requests < 1 : r.event_id !== null)) return null;
  if (expected && (r.patch_id !== expected.patch_id || r.author.toLowerCase() !== expected.author.toLowerCase()
    || r.patch_sha256 !== expected.patch_sha256 || r.requester !== expected.requester)) return null;
  return structuredClone(r);
}
export class KnowledgeDemandError extends Error {
  constructor(readonly code: 'read' | 'changed' | 'unconfirmed') { super(code); }
}
/** This only records interest in the exact item; inspection never resubmits the write. */
export async function requestKnowledge(selected: Selection, deps: Context & {
  current: () => boolean; inspectOnly?: boolean; expected?: KnowledgeDemandTarget;
  read: () => Promise<unknown>; write: (target: KnowledgeDemandTarget) => Promise<unknown>; intent: (target: KnowledgeDemandTarget) => void;
}) {
  if (!deps.current()) return null;
  const before = parseKnowledgeDemand(await deps.read(), selected, deps, deps.expected);
  if (!deps.current()) return null;
  if (!before) throw new KnowledgeDemandError('read');
  if (deps.inspectOnly || !before.can_request) return before;
  const expected = knowledgeDemandTarget(before);
  deps.intent(expected);
  if (!deps.current()) return null;
  let reply;
  try { reply = await deps.write(expected); }
  catch (error: any) {
    if (!deps.current()) return null;
    if (error?.status === 409 && /^knowledge_request_(changed|available):/.test(error?.data?.error ?? '')) throw new KnowledgeDemandError('changed');
    throw new KnowledgeDemandError('unconfirmed');
  }
  if (!deps.current()) return null;
  const receipt = parseKnowledgeDemand(reply, selected, deps, expected);
  if (!receipt?.requested) throw new KnowledgeDemandError('unconfirmed');
  let raw;
  try { raw = await deps.read(); }
  catch { if (deps.current()) throw new KnowledgeDemandError('unconfirmed'); return null; }
  if (!deps.current()) return null;
  const after = parseKnowledgeDemand(raw, selected, deps, expected);
  if (!after?.requested || after.event_id! < receipt.event_id!) throw new KnowledgeDemandError('unconfirmed');
  return after;
}
