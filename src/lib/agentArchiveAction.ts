import { reviewAgentArchive, type AgentArchiveSummary, type AgentArchiveReview } from '../api/agentArchiveEvidence';
export type AgentArchiveAction = 'export' | 'restore' | 'delete';
export type ArchiveDownloadResult = { kind: 'busy' | 'departed' | 'changed' } | { kind: 'failed'; error: unknown } | { kind: 'exported'; blob: Blob };
/** Export does not mutate the agent; restore/delete use the durable operation controller. */
export function createAgentArchiveDownload() {
  let pending = false;
  return {
    async run(record: AgentArchiveSummary, deps: { owner: string; current: () => boolean; read: () => Promise<unknown>;
      perform: (review: AgentArchiveReview) => Promise<unknown> }): Promise<ArchiveDownloadResult> {
      record = structuredClone(record);
      if (pending) return { kind: 'busy' };
      if (!deps.current()) return { kind: 'departed' };
      pending = true;
      try {
        const raw = await deps.read();
        if (!deps.current()) return { kind: 'departed' };
        const review = reviewAgentArchive(raw, record, deps.owner);
        if (!review) return { kind: 'changed' };
        const blob = await deps.perform(review);
        if (!deps.current()) return { kind: 'departed' };
        if (!(blob instanceof Blob)) throw new Error('archive_download_invalid');
        return { kind: 'exported', blob };
      } catch (error) { return deps.current() ? { kind: 'failed', error } : { kind: 'departed' }; }
      finally { pending = false; }
    },
  };
}
