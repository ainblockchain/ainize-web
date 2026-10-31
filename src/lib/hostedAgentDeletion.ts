export type AgentDeletionTarget = { id: string; name: string; owner?: string | null };
export type AgentDeletionRequest = { id: string; expected: { name: string; owner: string; version: number } };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export class AgentDeletionError extends Error {
  constructor(readonly reason: 'changed' | 'unconfirmed') { super(reason); }
}
export function isAgentCleanupPending(error: unknown): boolean {
  const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
  return e?.status === 502 && e.data?.error?.code === 'agent_cleanup_pending';
}
export function agentDeletionRequest(raw: unknown, target: AgentDeletionTarget): AgentDeletionRequest | null {
  const a = object(raw) && object(raw.agent) ? raw.agent : null;
  if (!a || a.id !== target.id || !target.id || a.name !== target.name || a.can_delete !== true
    || typeof a.owner !== 'string' || !a.owner || target.owner != null && a.owner !== target.owner
    || !Number.isSafeInteger(a.version) || (a.version as number) < 1) return null;
  return { id: target.id, expected: { name: target.name, owner: a.owner, version: a.version as number } };
}
export function agentDeletionComplete(raw: unknown, id: string): boolean {
  return object(raw) && raw.deleted === id && raw.cleanup === 'complete'
    && (raw.archiveId === undefined || typeof raw.archiveId === 'string' && raw.archiveId.length > 0);
}
/** Per-view exclusion. A lost response is not evidence of failure or permission to repeat deletion. */
export function createHostedAgentDeletion() {
  let busy = false, unknown = false, started = false, confirmed = false;
  return {
    blocked: () => busy || unknown,
    started: () => started,
    confirmed: () => confirmed,
    uncertain: () => unknown,
    async run(target: AgentDeletionTarget, io: { read: () => Promise<unknown>; send: (request: AgentDeletionRequest) => Promise<unknown>; active: () => boolean }) {
      if (busy || unknown || !io.active()) return false;
      busy = true; confirmed = false; let dispatched = false;
      try {
        const fresh = await io.read();
        if (!io.active()) return false;
        const request = agentDeletionRequest(fresh, target);
        if (!request) throw new AgentDeletionError('changed');
        dispatched = true; started = true;
        const receipt = await io.send(request);
        if (!agentDeletionComplete(receipt, target.id)) throw new AgentDeletionError('unconfirmed');
        confirmed = true;
        return io.active();
      } catch (error) {
        const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
        const code = e?.data?.error?.code;
        const refused = typeof e?.status === 'number' && e.status >= 400 && e.status < 500
          && ['agent_changed', 'not_signed_in', 'not_found', 'not_owner'].includes(String(code));
        if (dispatched && !refused && !isAgentCleanupPending(error)) unknown = true;
        if (refused) started = false;
        throw error;
      } finally { busy = false; }
    },
  };
}
