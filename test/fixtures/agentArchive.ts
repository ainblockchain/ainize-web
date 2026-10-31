import type { AgentArchiveSummary } from '../../src/api/agentArchiveEvidence';
export const archivedAgent = (): AgentArchiveSummary => ({
  id: 'archive_' + 'a'.repeat(24), agent: 'saved-agent', name: 'Retained assistant', createdAt: 1700000000000,
  bytes: 12500, repository: true, repositoryFormat: 'bundle', exportedAt: null, restoredAt: null,
  secretNames: ['TOKEN'], source: null,
});
export const archiveDetail = (record = archivedAgent()) => ({ archive: {
  ...record, owner: 'sso:viewer', runtime: null,
  spec: { id: record.agent, name: record.name, owner: 'sso:viewer', version: 5, secretNames: record.secretNames },
} });
export const archiveReceipt = (record = archivedAgent()) => ({
  archiveId: record.id, agentId: record.agent, version: 7, commit: 'a'.repeat(40), sourceCommit: 'b'.repeat(40),
  status: 'ready', secretsRequired: ['TOKEN'],
});
