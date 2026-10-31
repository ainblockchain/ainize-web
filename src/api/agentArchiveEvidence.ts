/** Evidence for archive controls. A list row or a 2xx alone is not a restore receipt. */
export interface AgentArchiveSummary {
  id: string; agent: string; name: string; createdAt: number; bytes: number;
  repository: boolean; repositoryFormat: 'bundle' | 'bare-tar';
  exportedAt: number | null; restoredAt: number | null; secretNames: string[];
  source: { provider: string; url?: string; sourceCommit?: string | null } | null;
}
export interface AgentArchivePage { archives: AgentArchiveSummary[]; total: number; limit: number; offset: number }
export interface AgentArchiveReview { record: AgentArchiveSummary; version: number }
export interface AgentArchiveRestored {
  archiveId: string; agentId: string; version: number; commit: string; sourceCommit: string | null;
  status: 'ready'; secretsRequired: string[];
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const time = (v: unknown): v is number => integer(v) && v > 0 && v <= 8.64e15;
const names = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 16 && v.every(n => typeof n === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(n));
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{40}([a-f0-9]{24})?$/.test(v);
export function readAgentArchiveSummary(v: unknown): AgentArchiveSummary | null {
  if (!object(v) || typeof v.id !== 'string' || !/^archive_[a-f0-9]{24}$/.test(v.id)
    || typeof v.agent !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(v.agent)
    || typeof v.name !== 'string' || !v.name.trim() || !time(v.createdAt) || !integer(v.bytes)
    || typeof v.repository !== 'boolean' || !['bundle', 'bare-tar'].includes(String(v.repositoryFormat))
    || !(v.exportedAt === null || time(v.exportedAt)) || !(v.restoredAt === null || time(v.restoredAt)) || !names(v.secretNames)
    || !(v.source === null || object(v.source) && typeof v.source.provider === 'string'
      && (v.source.url === undefined || typeof v.source.url === 'string')
      && (v.source.sourceCommit == null || sha(v.source.sourceCommit)))) return null;
  return { id: v.id, agent: v.agent, name: v.name, createdAt: v.createdAt, bytes: v.bytes,
    repository: v.repository, repositoryFormat: v.repositoryFormat as AgentArchiveSummary['repositoryFormat'],
    exportedAt: v.exportedAt, restoredAt: v.restoredAt, secretNames: [...v.secretNames],
    source: v.source === null ? null : { provider: v.source.provider as string,
      ...(typeof v.source.url === 'string' ? { url: v.source.url } : {}),
      ...(v.source.sourceCommit !== undefined ? { sourceCommit: v.source.sourceCommit as string | null } : {}) } };
}
export function readAgentArchivePage(raw: unknown, offset: number, limit = 10): AgentArchivePage | null {
  if (!integer(offset) || !integer(limit) || limit < 1 || limit > 50 || !object(raw) || !integer(raw.total) || raw.limit !== limit || raw.offset !== offset || !Array.isArray(raw.archives)) return null;
  if (raw.archives.length !== Math.min(limit, Math.max(0, raw.total - offset))) return null;
  const rows = raw.archives.map(readAgentArchiveSummary);
  if (rows.some(r => !r) || new Set(rows.map(r => r!.id)).size !== rows.length) return null;
  return { archives: rows as AgentArchiveSummary[], total: raw.total, limit, offset };
}
/** Read-only preflight binds the selected immutable archive and the server's version, never the first list row. */
export function reviewAgentArchive(raw: unknown, selected: AgentArchiveSummary, owner: string): AgentArchiveReview | null {
  if (!object(raw) || !object(raw.archive)) return null;
  const a = raw.archive;
  if (!object(a.spec) || a.owner !== owner.toLowerCase() || a.spec.owner !== a.owner || a.spec.id !== selected.agent
    || !integer(a.spec.version) || a.spec.version < 1 || a.spec.version > Number.MAX_SAFE_INTEGER - 2) return null;
  const record = readAgentArchiveSummary({ ...a, name: a.spec.name, repository: a.repository !== false,
    repositoryFormat: a.repositoryFormat ?? 'bundle', exportedAt: a.exportedAt ?? null, restoredAt: a.restoredAt ?? null,
    secretNames: a.spec.secretNames, source: object(a.runtime) ? a.runtime.source : null });
  if (!record || ['id', 'agent', 'name', 'createdAt', 'bytes', 'repository', 'repositoryFormat', 'restoredAt'].some(k =>
    record[k as keyof AgentArchiveSummary] !== selected[k as keyof AgentArchiveSummary])
    || JSON.stringify(record.secretNames) !== JSON.stringify(selected.secretNames)) return null;
  return { record, version: a.spec.version };
}
export function readAgentArchiveRestore(raw: unknown, review: AgentArchiveReview): AgentArchiveRestored | null {
  if (!object(raw) || raw.archiveId !== review.record.id || raw.agentId !== review.record.agent
    || raw.status !== 'ready' || raw.version !== review.version + 2 || !sha(raw.commit)
    || !(raw.sourceCommit === null || sha(raw.sourceCommit)) || !names(raw.secretsRequired)) return null;
  return structuredClone(raw) as unknown as AgentArchiveRestored;
}
export function agentArchiveDeleted(raw: unknown, id: string): boolean { return object(raw) && raw.deleted === id; }

/** Do not download an HTML sign-in page or a different archive under the reviewed filename. */
export async function readAgentArchiveDownload(response: Response, record: AgentArchiveSummary): Promise<Blob> {
  if (!response.ok) throw { status: response.status, data: await response.json().catch(() => null) };
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const disposition = response.headers.get('content-disposition') ?? '';
  const expected = `${record.agent}-${record.id}.tar.gz`;
  const filename = /(?:^|;)\s*filename=(?:"([^"]+)"|([^;\s]+))/i.exec(disposition);
  if (!['application/gzip', 'application/x-gzip'].includes(type ?? '') || !/^attachment(?:;|$)/i.test(disposition)
    || (filename?.[1] ?? filename?.[2]) !== expected) throw new Error('archive_download_invalid');
  const blob = await response.blob();
  const magic = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  if (magic[0] !== 0x1f || magic[1] !== 0x8b || magic[2] !== 8) throw new Error('archive_download_invalid');
  return blob;
}
