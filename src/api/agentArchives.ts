import { api } from './api';
import { readAgentArchivePage, type AgentArchivePage } from './agentArchiveEvidence';
export type { AgentArchiveSummary } from './agentArchiveEvidence';
export const archiveApi = api.injectEndpoints({ endpoints: (b) => ({
  agentArchives: b.query<AgentArchivePage, { offset: number; principal: string }>({
    keepUnusedDataFor: 0,
    queryFn: async ({ offset }, _api, _extra, baseQuery) => {
      const result = await baseQuery(`api/agent-archives?limit=10&offset=${offset}`);
      if (result.error) return { error: result.error };
      const data = readAgentArchivePage(result.data, offset);
      return data ? { data } : { error: { status: 'CUSTOM_ERROR', error: 'Invalid archive list' } };
    }, providesTags: ['HostedAgent'],
  }),
  restoreAgentArchive: b.mutation<unknown, string>({
    query: (id) => ({ url: `api/agent-archives/${encodeURIComponent(id)}/restore`, method: 'POST' }), invalidatesTags: ['Agents', 'HostedAgent'],
  }),
  deleteAgentArchive: b.mutation<unknown, string>({
    query: (id) => ({ url: `api/agent-archives/${encodeURIComponent(id)}`, method: 'DELETE' }), invalidatesTags: ['HostedAgent'],
  }),
}) });
export const { useAgentArchivesQuery, useRestoreAgentArchiveMutation, useDeleteAgentArchiveMutation } = archiveApi;
