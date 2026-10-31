import type { AgentVisibility } from '@/api/sharedAgents';
export interface AgentSharingReview {
  id: string; kind: 'hosted' | 'linked'; owner: string; actor: string; registry: string; revision: string;
  visibility: AgentVisibility; orgId: string | null;
}
export type AgentSharingChange = { visibility: AgentVisibility; orgId: string | null };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = ['id', 'kind', 'owner', 'actor', 'registry', 'revision', 'visibility', 'orgId'] as const;
export function readAgentSharingReview(raw: unknown): AgentSharingReview | null {
  const r = object(raw) && object(raw.review) ? raw.review : null;
  if (!r || Object.keys(r).length !== keys.length || !['hosted', 'linked'].includes(String(r.kind))
    || !['public', 'private', 'org', 'unlisted'].includes(String(r.visibility))
    || !['id', 'owner', 'actor', 'registry'].every(key => typeof r[key] === 'string' && !!r[key])
    || typeof r.revision !== 'string' || !/^[a-f0-9]{64}$/.test(r.revision)
    || (r.visibility === 'org' ? typeof r.orgId !== 'string' || !r.orgId : r.orgId !== null)) return null;
  return Object.fromEntries(keys.map(key => [key, r[key]])) as unknown as AgentSharingReview;
}
export const sameAgentSharingReview = (a: AgentSharingReview | null, b: AgentSharingReview): boolean => !!a && keys.every(key => a[key] === b[key]);
export function agentSharingConfirmed(raw: unknown, expected: AgentSharingReview, change: AgentSharingChange): AgentSharingReview | null {
  if (!object(raw) || !object(raw.applied) || !object(raw.agent)) return null;
  const after = readAgentSharingReview(raw), before = readAgentSharingReview({ review: raw.applied.expected });
  const ref = raw.agent;
  if (!after || !sameAgentSharingReview(before, expected) || raw.applied.visibility !== change.visibility || raw.applied.orgId !== change.orgId
    || !(['id', 'kind', 'owner', 'actor', 'registry'] as const).every(key => after[key] === expected[key])
    || after.revision === expected.revision || after.visibility !== change.visibility || after.orgId !== change.orgId
    || ref.agentId !== expected.id || ref.registryIssuer !== expected.registry || !object(ref.ownerRef) || ref.ownerRef.subject !== expected.owner || ref.ownerRef.issuer !== expected.registry
    || ref.visibility !== change.visibility || (change.visibility === 'org' ? !object(ref.orgRef) || ref.orgRef.subject !== change.orgId : ref.orgRef != null)) return null;
  return after;
}
export class AgentSharingError extends Error {
  constructor(readonly reason: 'changed' | 'unconfirmed') { super(reason); }
}
export async function saveReviewedSharing(expected: AgentSharingReview, change: AgentSharingChange, io: {
  current: () => boolean; read: () => Promise<unknown>;
  send: (body: AgentSharingChange & { id: string; expected: AgentSharingReview }) => Promise<unknown>;
}): Promise<AgentSharingReview | null> {
  if (!io.current()) return null;
  const fresh = readAgentSharingReview(await io.read());
  if (!io.current()) return null;
  if (!sameAgentSharingReview(fresh, expected)) throw new AgentSharingError('changed');
  let raw: unknown;
  try { raw = await io.send({ id: expected.id, expected, ...change }); }
  catch (error) {
    const e = error as { status?: unknown; data?: { error?: { code?: unknown } } };
    const refused = typeof e?.status === 'number' && e.status >= 400 && e.status < 500
      && ['review_required', 'review_changed', 'resource_busy', 'invalid_request', 'auth_required', 'forbidden', 'resource_deleted', 'rate_limited'].includes(String(e?.data?.error?.code));
    if (refused) throw error;
    throw new AgentSharingError('unconfirmed');
  }
  const after = agentSharingConfirmed(raw, expected, change);
  if (!after) throw new AgentSharingError('unconfirmed');
  return io.current() ? after : null;
}
