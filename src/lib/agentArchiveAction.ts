import { reviewAgentArchive, readAgentArchiveRestore, agentArchiveDeleted,
  type AgentArchiveSummary, type AgentArchiveReview, type AgentArchiveRestored } from '../api/agentArchiveEvidence';

export type AgentArchiveAction = 'export' | 'restore' | 'delete';
export type ArchiveActionResult =
  | { kind: 'busy' | 'departed' | 'changed' | 'unknown' }
  | { kind: 'failed'; error: unknown }
  | { kind: 'exported'; blob: Blob }
  | { kind: 'restored'; receipt: AgentArchiveRestored }
  | { kind: 'deleted'; archiveId: string };

function knownRefusal(error: unknown, action: AgentArchiveAction): boolean {
  const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
  const code = e?.data?.error?.code;
  const statuses: Record<string, number> = {
    not_signed_in: 401, not_allowed: 403, not_found: 404,
    ...(action === 'delete' ? { export_required: 409 } : { invalid_request: 400, model_not_served: 400,
      id_taken: 409, state_exists: 409, project_binding_conflict: 409, project_environment_required: 409,
      active_version_missing: 409, limit_reached: 429, docker_unavailable: 501 }),
  };
  return typeof code === 'string' && Object.hasOwn(statuses, code) && statuses[code] === e?.status;
}

/** Synchronous admission lock; a lost/contradictory mutation result is never permission to retry in this view. */
export function createAgentArchiveActions() {
  let pending = false;
  const uncertain = new Set<string>();
  return {
    unresolved: (id: string) => uncertain.has(id),
    async run(record: AgentArchiveSummary, action: AgentArchiveAction, deps: {
      owner: string; current: () => boolean; read: () => Promise<unknown>;
      perform: (review: AgentArchiveReview) => Promise<unknown>;
    }): Promise<ArchiveActionResult> {
      record = structuredClone(record);
      if (pending) return { kind: 'busy' };
      if (action !== 'export' && uncertain.has(record.id)) return { kind: 'unknown' };
      if (!deps.current()) return { kind: 'departed' };
      pending = true;
      let submitted = false;
      try {
        const raw = await deps.read();
        if (!deps.current()) return { kind: 'departed' };
        const review = reviewAgentArchive(raw, record, deps.owner);
        if (!review || action === 'delete' && review.record.exportedAt === null) return { kind: 'changed' };
        submitted = action !== 'export';
        const result = await deps.perform(review);
        if (!deps.current()) { if (submitted) uncertain.add(record.id); return { kind: 'departed' }; }
        if (action === 'export') {
          if (!(result instanceof Blob)) throw new Error('archive_download_invalid');
          return { kind: 'exported', blob: result };
        }
        if (action === 'delete') {
          if (!agentArchiveDeleted(result, record.id)) throw new Error('archive_receipt_invalid');
          return { kind: 'deleted', archiveId: record.id };
        }
        const receipt = readAgentArchiveRestore(result, review);
        if (!receipt) throw new Error('archive_receipt_invalid');
        return { kind: 'restored', receipt };
      } catch (error) {
        if (submitted && !knownRefusal(error, action)) uncertain.add(record.id);
        if (!deps.current()) return { kind: 'departed' };
        return uncertain.has(record.id) && submitted ? { kind: 'unknown' } : { kind: 'failed', error };
      } finally { pending = false; }
    },
  };
}
