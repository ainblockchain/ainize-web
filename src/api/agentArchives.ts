import { api } from './api';
export interface AgentArchiveSummary {
  id: string; agent: string; name: string; createdAt: number; bytes: number;
  repository: boolean; repositoryFormat: 'bundle' | 'bare-tar';
  exportedAt: number | null; restoredAt: number | null; secretNames: string[];
  source: { provider: string; url?: string; commit?: string } | null;
}
export const archiveApi = api.injectEndpoints({ endpoints: (b) => ({
  agentArchives: b.query<{ archives: AgentArchiveSummary[]; total: number; limit: number; offset: number }, number>({
    query: (offset) => `api/agent-archives?limit=10&offset=${offset}`, providesTags: ['HostedAgent'],
  }),
  restoreAgentArchive: b.mutation<{ agentId: string; version: number; secretsRequired: string[] }, string>({
    query: (id) => ({ url: `api/agent-archives/${encodeURIComponent(id)}/restore`, method: 'POST' }), invalidatesTags: ['Agents', 'HostedAgent'],
  }),
  deleteAgentArchive: b.mutation<{ deleted: string }, string>({
    query: (id) => ({ url: `api/agent-archives/${encodeURIComponent(id)}`, method: 'DELETE' }), invalidatesTags: ['HostedAgent'],
  }),
}) });
export const { useAgentArchivesQuery, useRestoreAgentArchiveMutation, useDeleteAgentArchiveMutation } = archiveApi;
