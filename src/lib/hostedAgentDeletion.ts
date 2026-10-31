export type AgentDeletionTarget = { id: string; name: string; owner?: string | null };
export interface AgentDeletionReview {
  id: string; name: string; owner: string; generation: string; version: number; actor: string; registry: string; revision: string; cleanupId: string | null;
}
export type AgentDeletionRequest = { id: string; expected: AgentDeletionReview };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = ['id', 'name', 'owner', 'generation', 'version', 'actor', 'registry', 'revision', 'cleanupId'] as const;
function readReview(raw: unknown): AgentDeletionReview | null {
  if (!object(raw) || Object.keys(raw).length !== keys.length
    || !['id', 'name', 'owner', 'generation', 'actor', 'registry'].every(key => typeof raw[key] === 'string' && !!raw[key])
    || !Number.isSafeInteger(raw.version) || (raw.version as number) < 1 || typeof raw.revision !== 'string' || !/^[a-f0-9]{64}$/.test(raw.revision)
    || !(raw.cleanupId === null || typeof raw.cleanupId === 'string' && !!raw.cleanupId)) return null;
  return Object.fromEntries(keys.map(key => [key, raw[key]])) as unknown as AgentDeletionReview;
}
const sameReview = (a: AgentDeletionReview | null, b: AgentDeletionReview) => !!a && keys.every(key => a[key] === b[key]);
const sameRegistration = (a: AgentDeletionReview, b: AgentDeletionReview) => (['id', 'name', 'owner', 'generation', 'version', 'actor', 'registry'] as const).every(key => a[key] === b[key]);
export class AgentDeletionError extends Error {
  constructor(readonly reason: 'changed' | 'unconfirmed' | 'unsupported') { super(reason); }
}
/** Only the node's exact progress reply permits another attempt at the same cleanup. */
export function agentCleanupProgress(error: unknown, request?: AgentDeletionRequest): AgentDeletionReview | null {
  const e = error as { status?: unknown; data?: unknown } | null;
  if (e?.status !== 502 || !object(e.data) || !object(e.data.error) || e.data.error.code !== 'agent_cleanup_pending' || !object(e.data.pending)) return null;
  const pending = e.data.pending, before = readReview(pending.expected), after = readReview(pending.review);
  if (!before || !after || !sameRegistration(before, after) || !after.cleanupId || pending.operationId !== after.cleanupId
    || before.cleanupId === null && before.revision === after.revision
    || before.cleanupId !== null && before.cleanupId !== after.cleanupId || request && (request.id !== before.id || !sameReview(before, request.expected))) return null;
  return after;
}
export const isAgentCleanupPending = (error: unknown): boolean => !!agentCleanupProgress(error);
export function agentDeletionRequest(raw: unknown, target: AgentDeletionTarget, actor: string | null): AgentDeletionRequest | null {
  const a = object(raw) && object(raw.agent) ? raw.agent : null;
  const review = a ? readReview(a.delete_review) : null;
  if (!a || !review || a.can_delete !== true || review.id !== target.id || review.id !== a.id || review.name !== target.name || review.name !== a.name
    || review.owner !== a.owner || target.owner != null && review.owner !== target.owner || review.actor !== actor || review.version !== a.version) return null;
  return { id: target.id, expected: review };
}
export function agentDeletionComplete(raw: unknown, request: AgentDeletionRequest): boolean {
  return object(raw) && raw.deleted === request.id && raw.cleanup === 'complete' && raw.actor === request.expected.actor && raw.registry === request.expected.registry
    && typeof raw.operationId === 'string' && !!raw.operationId && (request.expected.cleanupId === null || raw.operationId === request.expected.cleanupId)
    && sameReview(readReview(raw.removed), request.expected)
    && (raw.archiveId === undefined || typeof raw.archiveId === 'string' && raw.archiveId.length > 0);
}
/** Current page keeps this controller across owner-panel remounts. Reload still needs durable request recovery. */
export function createHostedAgentDeletion() {
  let busy = false, unknown = false, started = false, confirmed = false;
  let resume: AgentDeletionReview | null = null;
  return {
    blocked: () => busy || unknown,
    started: () => started,
    confirmed: () => confirmed,
    uncertain: () => unknown,
    pendingId: () => resume?.id ?? null,
    async run(target: AgentDeletionTarget, actor: string | null, io: {
      read: () => Promise<unknown>; confirm: (review: AgentDeletionReview) => boolean;
      send: (request: AgentDeletionRequest) => Promise<unknown>; active: () => boolean;
    }) {
      if (busy || unknown || !io.active()) return false;
      busy = true; confirmed = false; let dispatched: AgentDeletionRequest | null = null;
      try {
        const fresh = await io.read();
        if (!io.active()) return false;
        if (object(fresh) && object(fresh.agent) && fresh.agent.can_delete === true && fresh.agent.delete_review === undefined)
          throw new AgentDeletionError('unsupported');
        const request = agentDeletionRequest(fresh, target, actor);
        if (!request) throw new AgentDeletionError('changed');
        if (resume && (!sameRegistration(request.expected, resume) || request.expected.cleanupId !== resume.cleanupId)) throw new AgentDeletionError('changed');
        if (!io.confirm(request.expected) || !io.active()) return false;
        dispatched = request; started = true;
        const receipt = await io.send(request);
        if (!agentDeletionComplete(receipt, request)) throw new AgentDeletionError('unconfirmed');
        confirmed = true; resume = null;
        return io.active();
      } catch (error) {
        const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
        const refused = typeof e?.status === 'number' && e.status >= 400 && e.status < 500
          && ['review_required', 'agent_changed', 'not_signed_in', 'not_found', 'not_owner'].includes(String(e?.data?.error?.code));
        const progress = dispatched ? agentCleanupProgress(error, dispatched) : null;
        if (progress) resume = progress;
        if (dispatched && !refused && !progress) unknown = true;
        if (refused && !resume) started = false;
        throw error;
      } finally { busy = false; }
    },
  };
}
