import { AGENT_ALIAS_PATTERN } from '@/api/agentIds';
export interface AgentAliasReview {
  id: string; kind: 'hosted' | 'linked' | 'config'; owner: string; actor: string; registry: string; alias: string | null; revision: string;
}
export interface AgentAliasChange { id: string; expected: AgentAliasReview; alias: string | null }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = ['id', 'kind', 'owner', 'actor', 'registry', 'alias', 'revision'] as const;
export function readAgentAliasReview(raw: unknown): AgentAliasReview | null {
  const r = object(raw) && object(raw.review) ? raw.review : null;
  if (!r || Object.keys(r).length !== keys.length || !['hosted', 'linked', 'config'].includes(String(r.kind))
    || !['id', 'owner', 'actor', 'registry'].every(key => typeof r[key] === 'string' && !!r[key])
    || typeof r.revision !== 'string' || !/^[a-f0-9]{64}$/.test(r.revision)
    || !(r.alias === null || typeof r.alias === 'string' && AGENT_ALIAS_PATTERN.test(r.alias) && r.alias !== r.id)) return null;
  return Object.fromEntries(keys.map(key => [key, r[key]])) as unknown as AgentAliasReview;
}
export const sameAgentAliasReview = (a: AgentAliasReview | null, b: AgentAliasReview): boolean => !!a && keys.every(key => a[key] === b[key]);
export function agentAliasChangeConfirmed(raw: unknown, change: AgentAliasChange): AgentAliasReview | null {
  if (!object(raw) || !object(raw.applied)) return null;
  const after = readAgentAliasReview(raw), before = readAgentAliasReview({ review: raw.applied.expected });
  return after && sameAgentAliasReview(before, change.expected) && raw.id === change.id && change.id === change.expected.id
    && raw.alias === change.alias && raw.applied.alias === change.alias && after.alias === change.alias
    && after.revision !== change.expected.revision
    && (['id', 'kind', 'owner', 'actor', 'registry'] as const).every(key => after[key] === change.expected[key]) ? after : null;
}
export class AgentAliasChangeError extends Error {
  constructor(readonly reason: 'changed' | 'unconfirmed' | 'read_failed') { super(reason); }
}
/** One write only; neither a successful HTTP code nor a later matching read proves that write's outcome. */
export async function changeReviewedAlias(change: AgentAliasChange, io: {
  current: () => boolean; read: () => Promise<unknown>; send: (change: AgentAliasChange) => Promise<unknown>;
}): Promise<AgentAliasReview | null> {
  if (!io.current()) return null;
  let fresh: AgentAliasReview | null;
  try { fresh = readAgentAliasReview(await io.read()); } catch { throw new AgentAliasChangeError('read_failed'); }
  if (!io.current()) return null;
  if (!sameAgentAliasReview(fresh, change.expected)) throw new AgentAliasChangeError('changed');
  let raw: unknown;
  try { raw = await io.send(change); }
  catch (error) {
    const e = error as { status?: unknown; data?: { error?: { code?: unknown } } };
    if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500
      && ['review_required', 'review_changed', 'resource_busy', 'alias_taken', 'invalid_request', 'not_signed_in', 'not_owner', 'not_found'].includes(String(e?.data?.error?.code))) throw error;
    throw new AgentAliasChangeError('unconfirmed');
  }
  const after = agentAliasChangeConfirmed(raw, change);
  if (!after) throw new AgentAliasChangeError('unconfirmed');
  return io.current() ? after : null;
}
