/**
 * RTK Query API slice — the modern replacement for ainize-web's redux-saga + fetch managers.
 * One endpoint per node API route; tags give cache invalidation after operator actions.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  AuthMe, BranchesResponse, CatalogEntry, CatalogResponse, ChainResponse, DriveChangesResponse, DriveResponse, EventRow, GraphResponse, InfoResponse,
  LedgerRecord, LedgerResponse, NodesResponse, PatchAnchor, PatchDetail, PurchaseResult, PurchaseRow, RouteResponse, RuntimeResponse, VerifyResponse, WalletResponse,
  ChatPatchesResponse, ChatRequest, ChatResponse, Settings, DocsResponse,
} from './types';

export interface CatalogQuery {
  sort?: 'latest' | 'popular' | 'price' | 'rows';
  status?: string; model?: string; schema?: string; branch?: string; author?: string; q?: string;
  limit?: number; offset?: number; include_drafts?: boolean;
}

const toQuery = (params: Record<string, unknown>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/', credentials: 'include' }),
  tagTypes: ['Info', 'Catalog', 'Patch', 'Ledger', 'Branches', 'Nodes', 'Me', 'Events', 'Runtime', 'Drive', 'Settings', 'Chat'],
  endpoints: (b) => ({
    info: b.query<InfoResponse, void>({ query: () => 'api/info', providesTags: ['Info'] }),
    catalog: b.query<CatalogResponse, CatalogQuery | void>({ query: (q) => `api/catalog${toQuery({ ...(q ?? {}) })}`, providesTags: ['Catalog'] }),
    patch: b.query<PatchDetail, string>({ query: (id) => `api/patches/${encodeURIComponent(id)}`, providesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Catalog'] }),
    patchRecords: b.query<{ records: LedgerRecord[] }, string>({ query: (id) => `api/patches/${encodeURIComponent(id)}/records`, providesTags: ['Ledger'] }),
    patchEvents: b.query<{ events: EventRow[] }, { id: string; limit?: number }>({ query: ({ id, limit }) => `api/patches/${encodeURIComponent(id)}/events${toQuery({ limit })}`, providesTags: ['Events'] }),
    benchmark: b.query<{ schema: string; items: CatalogEntry[] }, string>({ query: (schema) => `api/benchmarks/${encodeURIComponent(schema)}`, providesTags: ['Catalog'] }),
    ledger: b.query<LedgerResponse, { kind?: string; limit?: number } | void>({ query: (q) => `api/ledger${toQuery({ ...(q ?? {}) })}`, providesTags: ['Ledger'] }),
    ledgerVerify: b.query<VerifyResponse, void>({ query: () => 'api/ledger/verify', providesTags: ['Ledger'] }),
    graph: b.query<GraphResponse, void>({ query: () => 'api/ledger/graph', providesTags: ['Ledger', 'Catalog'] }),
    branches: b.query<BranchesResponse, void>({ query: () => 'api/branches', providesTags: ['Branches'] }),
    route: b.query<RouteResponse, Record<string, string>>({ query: (ctx) => `api/route${toQuery(ctx)}`, providesTags: ['Branches', 'Nodes'] }),
    nodes: b.query<NodesResponse, void>({ query: () => 'api/nodes', providesTags: ['Nodes'] }),
    events: b.query<{ events: EventRow[] }, { limit?: number; kind?: string; since?: number } | void>({ query: (q) => `api/events${toQuery({ ...(q ?? {}) })}`, providesTags: ['Events'] }),
    chain: b.query<ChainResponse, void>({ query: () => 'api/chain', providesTags: ['Info', 'Me'] }),
    runtime: b.query<RuntimeResponse, void>({ query: () => 'api/runtime', providesTags: ['Runtime'] }),
    drive: b.query<DriveResponse, void>({ query: () => 'api/drive', providesTags: ['Drive'] }),
    driveChanges: b.query<DriveChangesResponse, string>({ query: (path) => `api/drive/changes${toQuery({ path })}`, providesTags: ['Drive'] }),
    docs: b.query<DocsResponse, void>({ query: () => 'api/docs' }),

    // auth
    me: b.query<AuthMe, void>({ query: () => 'api/auth/me', providesTags: ['Me'] }),
    login: b.mutation<{ ok: boolean }, { password: string }>({ query: (body) => ({ url: 'api/auth/login', method: 'POST', body }), invalidatesTags: ['Me', 'Catalog'] }),
    setup: b.mutation<{ ok: boolean }, { password: string }>({ query: (body) => ({ url: 'api/auth/setup', method: 'POST', body }), invalidatesTags: ['Me', 'Catalog'] }),
    logout: b.mutation<{ ok: boolean }, void>({ query: () => ({ url: 'api/auth/logout', method: 'POST' }), invalidatesTags: ['Me', 'Catalog'] }),

    // operator
    myPatches: b.query<{ items: CatalogEntry[] }, void>({ query: () => 'api/me/patches', providesTags: ['Me', 'Catalog'] }),
    myPurchases: b.query<{ items: PurchaseRow[] }, void>({ query: () => 'api/me/purchases', providesTags: ['Me', 'Catalog'] }),
    wallet: b.query<WalletResponse, void>({ query: () => 'api/me/wallet', providesTags: ['Me', 'Ledger'] }),
    createPatch: b.mutation<{ anchor: PatchAnchor }, FormData>({ query: (body) => ({ url: 'api/patches', method: 'POST', body }), invalidatesTags: ['Catalog', 'Me'] }),
    updatePatch: b.mutation<{ anchor: PatchAnchor }, { id: string; patch: Partial<PatchAnchor> }>({ query: ({ id, patch }) => ({ url: `api/patches/${encodeURIComponent(id)}`, method: 'PATCH', body: patch }), invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Me'] }),
    deletePatch: b.mutation<{ ok: boolean }, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}`, method: 'DELETE' }), invalidatesTags: ['Catalog', 'Me'] }),
    announce: b.mutation<{ record: LedgerRecord }, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}/announce`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Catalog', 'Me', 'Ledger', 'Events'] }),
    verify: b.mutation<unknown, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}/verify`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Catalog', 'Ledger', 'Events'] }),
    challenge: b.mutation<unknown, { id: string; reason: string }>({ query: ({ id, reason }) => ({ url: `api/patches/${encodeURIComponent(id)}/challenge`, method: 'POST', body: { reason } }), invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Ledger'] }),
    buy: b.mutation<PurchaseResult, { id: string; apply?: boolean }>({ query: ({ id, apply }) => ({ url: `api/patches/${encodeURIComponent(id)}/buy`, method: 'POST', body: { apply } }), invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Me', 'Ledger', 'Events', 'Runtime'] }),
    apply: b.mutation<{ result: string }, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}/apply`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Runtime', 'Events', 'Me'] }),
    remove: b.mutation<{ result: string }, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}/remove`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Runtime', 'Events', 'Me'] }),
    createBranch: b.mutation<unknown, { name: string; description: string; context: Record<string, string>; patch_ids: string[] }>({ query: (body) => ({ url: 'api/branches', method: 'POST', body }), invalidatesTags: ['Branches', 'Ledger'] }),
    addToBranch: b.mutation<unknown, { name: string; patch_id: string }>({ query: ({ name, patch_id }) => ({ url: `api/branches/${encodeURIComponent(name)}/patches`, method: 'POST', body: { patch_id } }), invalidatesTags: ['Branches', 'Ledger'] }),
    subscribe: b.mutation<unknown, { name: string; action: 'subscribe' | 'unsubscribe' }>({ query: ({ name, action }) => ({ url: `api/branches/${encodeURIComponent(name)}/${action}`, method: 'POST' }), invalidatesTags: ['Branches', 'Ledger', 'Runtime', 'Events'] }),
    complete: b.mutation<{ text: string }, { prompt: string; max_tokens?: number }>({ query: (body) => ({ url: 'api/runtime/complete', method: 'POST', body }) }),
    addPeer: b.mutation<unknown, { endpoint: string }>({ query: (body) => ({ url: 'api/peers', method: 'POST', body }), invalidatesTags: ['Nodes', 'Info'] }),
    removePeer: b.mutation<unknown, { endpoint: string }>({ query: (body) => ({ url: 'api/peers', method: 'DELETE', body }), invalidatesTags: ['Nodes', 'Info'] }),
    chainSetup: b.mutation<unknown, void>({ query: () => ({ url: 'api/chain/setup', method: 'POST' }), invalidatesTags: ['Info', 'Ledger'] }),
    driveAction: b.mutation<unknown, { action: 'up' | 'stop' | 'sync' | 'login'; server?: string }>({ query: (body) => ({ url: 'api/drive', method: 'POST', body }), invalidatesTags: ['Drive'] }),

    // ChatMode (live test)
    chatPatches: b.query<ChatPatchesResponse, void>({ query: () => 'api/chat/patches', providesTags: ['Chat', 'Catalog', 'Runtime'] }),
    chat: b.mutation<ChatResponse, ChatRequest>({ query: (body) => ({ url: 'api/chat', method: 'POST', body }), invalidatesTags: ['Events'] }),
    // operator settings (persisted on the node)
    settings: b.query<{ settings: Settings }, void>({ query: () => 'api/me/settings', providesTags: ['Settings'] }),
    updateSettings: b.mutation<{ settings: Settings }, Partial<Settings>>({ query: (body) => ({ url: 'api/me/settings', method: 'PATCH', body }), invalidatesTags: ['Settings', 'Me', 'Info'] }),
  }),
});

export const {
  useInfoQuery, useCatalogQuery, usePatchQuery, usePatchRecordsQuery, usePatchEventsQuery, useBenchmarkQuery, useLedgerQuery, useLedgerVerifyQuery,
  useGraphQuery, useBranchesQuery, useRouteQuery, useLazyRouteQuery, useNodesQuery, useEventsQuery, useChainQuery, useRuntimeQuery, useDriveQuery, useDriveChangesQuery,
  useMeQuery, useLoginMutation, useSetupMutation, useLogoutMutation,
  useMyPatchesQuery, useMyPurchasesQuery, useWalletQuery, useCreatePatchMutation, useUpdatePatchMutation, useDeletePatchMutation, useAnnounceMutation,
  useVerifyMutation, useChallengeMutation, useBuyMutation, useApplyMutation, useRemoveMutation, useCreateBranchMutation, useAddToBranchMutation,
  useSubscribeMutation, useCompleteMutation, useAddPeerMutation, useRemovePeerMutation, useChainSetupMutation, useDriveActionMutation,
  useChatPatchesQuery, useChatMutation, useSettingsQuery, useUpdateSettingsMutation, useDocsQuery,
} = api;

/** Extract a human message from an RTK Query error. */
export function errorMessage(err: unknown): string {
  if (!err) return '';
  const e = err as { data?: { error?: string; issues?: { message: string }[] }; error?: string; status?: number | string };
  if (e.data?.error) return e.data.issues?.length ? `${e.data.error}: ${e.data.issues.map((i) => i.message).join(', ')}` : e.data.error;
  if (typeof e.error === 'string') return e.error;
  return `request failed${e.status ? ` (${e.status})` : ''}`;
}
