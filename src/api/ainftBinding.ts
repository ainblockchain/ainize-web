import { api } from './api';
import { parseAinftBinding, type AinftBinding } from '../lib/ainftBinding';

type Scope = { id: string; identity: string };
const tag = (id: string) => ({ type: 'HostedAgent' as const, id: `ainft:${id}` });
const invalid = { status: 'CUSTOM_ERROR' as const, error: 'Could not read the AINFT binding for this agent.' };
const path = (id: string, name: string) => `api/hosted-agents/${encodeURIComponent(id)}/${name}`;
export const ainftBindingApi = api.injectEndpoints({ endpoints: (b) => ({
  ainftBinding: b.query<{ binding: AinftBinding | null }, Scope>({
    keepUnusedDataFor: 0,
    queryFn: async ({ id }, _api, _extra, baseQuery) => {
      const result = await baseQuery(path(id, 'ainft-binding'));
      if (result.error) return { error: result.error };
      const binding = parseAinftBinding(result.data, id);
      return binding === undefined ? { error: invalid } : { data: { binding } };
    },
    providesTags: (_result, _error, { id }) => [tag(id)],
  }),
  saveAinftBinding: b.mutation<AinftBinding, Scope & { body: { chainId: 0 | 1; objectId: string; tokenId: string; address: string } }>({
    queryFn: async ({ id, body }, _api, _extra, baseQuery) => {
      const result = await baseQuery({ url: path(id, 'ainft-binding'), method: 'POST', body });
      if (result.error) return { error: result.error };
      const binding = parseAinftBinding(result.data, id);
      return binding && binding.chainId === body.chainId && binding.objectId.toLowerCase() === body.objectId.toLowerCase() && binding.tokenId === body.tokenId ? { data: binding } : { error: invalid };
    },
    invalidatesTags: (_result, _error, { id }) => [tag(id)],
  }),
  saveAinftCommunity: b.mutation<AinftBinding, Scope & { body: { expectedVersion: number; community: { appId: string; symbol: string } | null } }>({
    queryFn: async ({ id, body }, _api, _extra, baseQuery) => {
      const result = await baseQuery({ url: path(id, 'ainft-community'), method: 'POST', body });
      if (result.error) return { error: result.error };
      const binding = parseAinftBinding(result.data, id);
      const expected = body.community;
      return binding && binding.communityVersion === body.expectedVersion + 1
        && (expected === null ? binding.community === null : binding.community?.appId === expected.appId && binding.community?.symbol === expected.symbol)
        ? { data: binding } : { error: invalid };
    },
    invalidatesTags: (_result, _error, { id }) => [tag(id)],
  }),
}) });
export const { useAinftBindingQuery, useSaveAinftBindingMutation, useSaveAinftCommunityMutation } = ainftBindingApi;
