/**
 * RTK Query API slice — the modern replacement for ainize-web's redux-saga + fetch managers.
 * One endpoint per node API route; tags give cache invalidation after operator actions.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  AuthMe, BranchesResponse, CatalogEntry, CatalogResponse, ChainResponse, DriveChangesResponse, DriveResponse, EventRow, GraphResponse, InfoResponse,
  LedgerRecord, LedgerResponse, NodesResponse, PatchAnchor, PatchDetail, PurchaseResult, PurchaseRow, RouteResponse, RuntimeResponse, VerifyResponse, WalletResponse,
  ChatPatchesResponse, ChatRequest, ChatResponse, ChatStatusResponse, ChatCancelResponse, Settings, DocsResponse,
  CreateTeachJobResponse, PreflightResponse, PublishChallenge, PublishRequest, PublishResponse, TeachFactInput, TeachJob, TeachJobPublic, TeachJobResponse, TeachPolicy, TeachSaveResponse, TeacherProfile, VerifierProfile,
  DatasetParseOptions, DatasetResult, DatasetRowInput, DatasetRowsOp, DatasetRowsPage, DatasetSample, ForkPatchResponse, TeachDataset, TeachEventRow, TeachTrainingSpec,
  BanRow, ContributorRow, PayoutRow, PayoutsResponse, TeachJobAdmin, TeachPolicyAdmin, TeachPolicyPatch,
  IssuesResponse, MergePreview, PatchDatasetResponse, ShelvesResponse, SignalsResponse, TreeResponse,
  SubscribeResult, TrackQuote, CreditInfo,
} from './types';
import { currentTeacherKey, teachAuthHeader, teachAuthHeaderFor } from '@/lib/teacherKey';

/**
 * Endpoints that carry the visitor's signed `x-ngram-auth` when this browser has a teaching key (spec §6.1).
 * `chat` is included because a private draft (a taught lesson before publishing) can be live-tested only by its owner.
 */
const SIGNED_ENDPOINTS = new Set(['chat', 'chatPatches', 'teachPreflight', 'mergePreview',
  // the training-set preview: a `derivative` set is readable by anyone holding a teaching key, and the refusal says
  // exactly that — so the request has to carry the key the reader already has (lineage design §6.1, SC-10)
  'patchDataset', 'createTeachJob', 'teachJob', 'myTeachJobs', 'cancelTeachJob', 'retryTeachJob', 'recheckTeachJob', 'publishChallenge', 'publishPreview', 'publishTeachJob', 'saveTeachJob',
  // teach mode v2 — the dataset routes (design §7)
  'forkPatch', 'teachDatasets', 'teachDataset', 'teachDatasetRows', 'createTeachDataset', 'uploadTeachDataset', 'reparseTeachDataset', 'patchTeachDataset', 'forkTeachDataset', 'deleteTeachDataset',
  'retrainTeachJob', 'teachJobEvents',
  // item 306 — the person who is owed the money asks the node to try the transfer again, signed with the key that is owed it
  'nudgePayout']);
/** Header that carries the sha256 of a multipart upload — it is what the v2 signature covers (design §D14). */
export const DATASET_SHA_HEADER = 'x-ngram-dataset-sha256';
/** Internal marker set by prepareHeaders and consumed by `signedFetch` (never sent). */
const SIGN_MARKER = 'x-ngram-sign';

let nodeAddressPromise: Promise<string | null> | null = null;
/** This node's address (signed into every v2 header), fetched once from /api/info. */
const nodeAddress = (): Promise<string | null> => {
  nodeAddressPromise ??= fetch('/api/info', { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { node?: { address?: string } } | null) => j?.node?.address ?? null)
    .catch(() => null)
    .then((a) => { if (!a) nodeAddressPromise = null; return a; });
  return nodeAddressPromise;
};

/**
 * fetch with the request-bound v2 `x-ngram-auth` (`teach:<node>:<METHOD>:<path+query>:<ts>[:<sha256 body>]`) on marked
 * requests — single-use on the node and bound to route + body, so a captured header cannot be replayed elsewhere.
 * Falls back to the legacy `teach:<ts>` header only when the node address cannot be read.
 */
const signedFetch: typeof fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  if (!req.headers.has(SIGN_MARKER)) return fetch(req);
  const headers = new Headers(req.headers);
  headers.delete(SIGN_MARKER);
  if (currentTeacherKey()) {
    const node = await nodeAddress();
    const method = req.method.toUpperCase();
    // A multipart body is never captured as `rawBody` on the node, so the client signs the value of
    // `x-ngram-dataset-sha256` instead and the node re-hashes the stored file against it (design §D14).
    const declared = headers.get(DATASET_SHA_HEADER);
    const body = declared ?? (method === 'GET' || method === 'HEAD' ? null : await req.clone().text());
    const u = new URL(req.url);
    const h = node ? teachAuthHeaderFor({ node, method, path: `${u.pathname}${u.search}`, body }) : teachAuthHeader();
    if (h) headers.set('x-ngram-auth', h);
  }
  return fetch(new Request(req, { headers }));
};

/** This node's address, for requests signed outside RTK Query (authenticated downloads). */
export const nodeAddressOnce = (): Promise<string | null> => nodeAddress();

export interface CatalogQuery {
  /** `built_on` and `trending` are the lineage design's §10 orderings (most built on, doing well this week). */
  sort?: 'latest' | 'popular' | 'price' | 'rows' | 'built_on' | 'trending' | 'fresh';
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
  baseQuery: fetchBaseQuery({
    baseUrl: '/', credentials: 'include', fetchFn: signedFetch,
    prepareHeaders: (headers, { endpoint }) => {
      if (SIGNED_ENDPOINTS.has(endpoint)) headers.set(SIGN_MARKER, '1');
      return headers;
    },
  }),
  tagTypes: ['Info', 'Catalog', 'Patch', 'Ledger', 'Branches', 'Nodes', 'Me', 'Events', 'Runtime', 'Drive', 'Settings', 'Chat', 'Teach', 'TeachDataset', 'Teacher', 'TeachAdmin', 'Payouts', 'Issues'],
  endpoints: (b) => ({
    info: b.query<InfoResponse, void>({ query: () => 'api/info', providesTags: ['Info'] }),
    catalog: b.query<CatalogResponse, CatalogQuery | void>({ query: (q) => `api/catalog${toQuery({ ...(q ?? {}) })}`, providesTags: ['Catalog'] }),
    patch: b.query<PatchDetail, string>({ query: (id) => `api/patches/${encodeURIComponent(id)}`, providesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Catalog'] }),
    patchRecords: b.query<{ records: LedgerRecord[] }, string>({ query: (id) => `api/patches/${encodeURIComponent(id)}/records`, providesTags: ['Ledger'] }),
    patchEvents: b.query<{ events: EventRow[] }, { id: string; limit?: number }>({ query: ({ id, limit }) => `api/patches/${encodeURIComponent(id)}/events${toQuery({ limit })}`, providesTags: ['Events'] }),
    // lineage §12.5 — the family tree, how it is doing, and what people asked it that it could not answer
    patchTree: b.query<TreeResponse, { id: string; depth?: number; dir?: 'up' | 'down' | 'both' }>({ query: ({ id, depth, dir }) => `api/patches/${encodeURIComponent(id)}/tree${toQuery({ depth, dir })}`, providesTags: ['Catalog'] }),
    patchSignals: b.query<SignalsResponse, string>({ query: (id) => `api/patches/${encodeURIComponent(id)}/signals`, providesTags: ['Catalog'] }),
    patchIssues: b.query<IssuesResponse, { id: string; kind?: string; status?: string; limit?: number }>({ query: ({ id, ...q }) => `api/patches/${encodeURIComponent(id)}/issues${toQuery(q)}`, providesTags: ['Issues'] }),
    patchDataset: b.query<PatchDatasetResponse, string>({ query: (id) => `api/patches/${encodeURIComponent(id)}/dataset`, providesTags: ['Catalog'] }),
    createIssue: b.mutation<{ id: string; count: number; people: number; shared: boolean }, { id: string; text: string; topic?: string; share: boolean }>({
      query: ({ id, ...body }) => ({ url: `api/patches/${encodeURIComponent(id)}/issues`, method: 'POST', body }), invalidatesTags: ['Issues'],
    }),
    chatFeedback: b.mutation<{ turn_id: string; shared: boolean; items: { patch_id: string; count: number; people: number; shared: boolean }[] }, { turn_id: string; patch_ids?: string[]; share: boolean }>({
      query: (body) => ({ url: 'api/chat/feedback', method: 'POST', body: { ...body, verdict: 'wrong' } }), invalidatesTags: ['Issues'],
    }),
    exploreShelves: b.query<ShelvesResponse, { limit?: number } | void>({ query: (q) => `api/explore/shelves${toQuery({ ...(q ?? {}) })}`, providesTags: ['Catalog'] }),
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
    /**
     * Item 34 — the node has had `POST /api/auth/password` since item 121, and no client could reach it: the one
     * credential guarding sales, publishing, the wallet and the runtime could be rotated only from the CLI. The
     * route drops every other session and hands back a fresh token for this browser, so the operator changing it
     * stays signed in here and a stolen cookie does not survive the change.
     */
    changePassword: b.mutation<{ ok: boolean }, { current: string; password: string }>({
      query: (body) => ({ url: 'api/auth/password', method: 'POST', body }), invalidatesTags: ['Me'],
    }),

    // operator
    myPatches: b.query<{ items: CatalogEntry[] }, void>({ query: () => 'api/me/patches', providesTags: ['Me', 'Catalog'] }),
    myPurchases: b.query<{ items: PurchaseRow[] }, void>({ query: () => 'api/me/purchases', providesTags: ['Me', 'Catalog'] }),
    wallet: b.query<WalletResponse, void>({ query: () => 'api/me/wallet', providesTags: ['Me', 'Ledger'] }),
    createPatch: b.mutation<{ anchor: PatchAnchor }, FormData>({ query: (body) => ({ url: 'api/patches', method: 'POST', body }), invalidatesTags: ['Catalog', 'Me'] }),
    updatePatch: b.mutation<{ anchor: PatchAnchor }, { id: string; patch: Partial<PatchAnchor> }>({ query: ({ id, patch }) => ({ url: `api/patches/${encodeURIComponent(id)}`, method: 'PATCH', body: patch }), invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Me'] }),
    deletePatch: b.mutation<{ ok: boolean }, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}`, method: 'DELETE' }), invalidatesTags: ['Catalog', 'Me'] }),
    announce: b.mutation<{ record: LedgerRecord; verifiers?: { known: number; reachable: number; verifiers: number; quorum: number; self_attest: boolean }; visibility?: string }, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}/announce`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Catalog', 'Me', 'Ledger', 'Events'] }),
    // The takedown (item 148): the anchor stays on the record, the knowledge goes off sale everywhere.
    retire: b.mutation<{ patch_id: string; retired_at: number; reason: string }, { id: string; reason?: string }>({ query: ({ id, reason }) => ({ url: `api/patches/${encodeURIComponent(id)}/retire`, method: 'POST', body: { reason } }), invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Me', 'Ledger', 'Events'] }),
    /**
     * A price change (item 278): the anchor is immutable, and re-pricing used to mean publishing a new knowledge
     * that superseded the old one — restarting verification and splitting its sales history to run a discount.
     */
    setPrice: b.mutation<{ patch_id: string; price: string; previous: string; currency: string; history: { price: string; created_at: number }[] }, { id: string; price: string; reason?: string }>({
      query: ({ id, price, reason }) => ({ url: `api/patches/${encodeURIComponent(id)}/price`, method: 'POST', body: { price, reason } }),
      invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Me', 'Ledger', 'Events'] }),
    verify: b.mutation<unknown, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}/verify`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Catalog', 'Ledger', 'Events'] }),
    challenge: b.mutation<unknown, { id: string; reason: string }>({ query: ({ id, reason }) => ({ url: `api/patches/${encodeURIComponent(id)}/challenge`, method: 'POST', body: { reason } }), invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Ledger'] }),
    /** Item 270 / design §12.4 — `bundle` buys the bases this knowledge needs underneath it too, deepest first,
     * one settlement each. */
    // `again` is the deliberate second payment (item 271): without it the node collects on the receipt it already has.
    buy: b.mutation<PurchaseResult, { id: string; apply?: boolean; bundle?: boolean; again?: boolean }>({ query: ({ id, apply, bundle, again }) => ({ url: `api/patches/${encodeURIComponent(id)}/buy`, method: 'POST', body: { apply, bundle, again } }), invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: a.id }, 'Catalog', 'Me', 'Ledger', 'Events', 'Runtime'] }),
    /** Item 273 — collect a knowledge this node already paid for: a re-issued manifest, no second charge. */
    collect: b.mutation<PurchaseResult, string>({ query: (id) => ({ url: `api/patches/${encodeURIComponent(id)}/collect`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Patch', id }, 'Catalog', 'Me', 'Events', 'Runtime'] }),
    /** Item 364 — where this node's local credit came from, and the fact that it is not money. */
    myCredit: b.query<CreditInfo, void>({ query: () => 'api/me/credit', providesTags: ['Me', 'Ledger'] }),
    /**
     * Load / unload, along the chain (design §8, SC-15). `with_base` puts everything this knowledge was trained on
     * top of underneath it, in order; `cascade` unloads what is loaded on top of it. Both take a bare id too, so
     * every call site that only ever loads a stand-alone knowledge is unchanged.
     * The answer carries `order` — the chain it now sits on, ancestors first — which is what the screen reports.
     */
    apply: b.mutation<{ result: string; order?: string[]; loaded?: string[] }, string | { id: string; with_base?: boolean }>({
      query: (a) => { const { id, with_base } = typeof a === 'string' ? { id: a, with_base: undefined } : a; return { url: `api/patches/${encodeURIComponent(id)}/apply`, method: 'POST', body: { with_base } }; },
      invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: typeof a === 'string' ? a : a.id }, 'Runtime', 'Events', 'Me'],
    }),
    remove: b.mutation<{ result: string }, string | { id: string; cascade?: boolean }>({
      query: (a) => { const { id, cascade } = typeof a === 'string' ? { id: a, cascade: undefined } : a; return { url: `api/patches/${encodeURIComponent(id)}/remove`, method: 'POST', body: { cascade } }; },
      invalidatesTags: (_r, _e, a) => [{ type: 'Patch', id: typeof a === 'string' ? a : a.id }, 'Runtime', 'Events', 'Me'],
    }),
    createBranch: b.mutation<unknown, { name: string; description: string; context: Record<string, string>; patch_ids: string[] }>({ query: (body) => ({ url: 'api/branches', method: 'POST', body }), invalidatesTags: ['Branches', 'Ledger'] }),
    addToBranch: b.mutation<unknown, { name: string; patch_id: string }>({ query: ({ name, patch_id }) => ({ url: `api/branches/${encodeURIComponent(name)}/patches`, method: 'POST', body: { patch_id } }), invalidatesTags: ['Branches', 'Ledger'] }),
    // `replace` (item 214): the node refuses to load a track over knowledge already in the model unless it is passed.
    subscribe: b.mutation<SubscribeResult, { name: string; action: 'subscribe' | 'unsubscribe'; replace?: boolean }>({ query: ({ name, action, replace }) => ({ url: `api/branches/${encodeURIComponent(name)}/${action}`, method: 'POST', body: action === 'subscribe' ? { replace: !!replace } : {} }), invalidatesTags: ['Branches', 'Ledger', 'Runtime', 'Events', 'Me'] }),
    /** Item 357 — what subscribing would spend, decided by the node with the same rules `subscribe` follows. */
    trackQuote: b.query<{ quote: TrackQuote }, string>({ query: (name) => ({ url: `api/branches/${encodeURIComponent(name)}/quote`, method: 'POST' }), providesTags: ['Branches', 'Catalog', 'Me'] }),
    /** Item 255 — buy and load what the track added, unload what it retired. */
    syncBranch: b.mutation<SubscribeResult, string>({ query: (name) => ({ url: `api/branches/${encodeURIComponent(name)}/sync`, method: 'POST' }), invalidatesTags: ['Branches', 'Ledger', 'Runtime', 'Events', 'Me'] }),
    /** Item 297 — a visitor asks the operator to get a knowledge this node does not hold. */
    requestPatch: b.mutation<{ patch_id: string; requests: number }, string>({ query: (id) => ({ url: `api/chat/patches/${encodeURIComponent(id)}/request`, method: 'POST' }), invalidatesTags: ['Chat'] }),
    complete: b.mutation<{ text: string }, { prompt: string; max_tokens?: number }>({ query: (body) => ({ url: 'api/runtime/complete', method: 'POST', body }) }),
    addPeer: b.mutation<unknown, { endpoint: string }>({ query: (body) => ({ url: 'api/peers', method: 'POST', body }), invalidatesTags: ['Nodes', 'Info'] }),
    removePeer: b.mutation<unknown, { endpoint: string }>({ query: (body) => ({ url: 'api/peers', method: 'DELETE', body }), invalidatesTags: ['Nodes', 'Info'] }),
    chainSetup: b.mutation<unknown, void>({ query: () => ({ url: 'api/chain/setup', method: 'POST' }), invalidatesTags: ['Info', 'Ledger'] }),
    driveAction: b.mutation<unknown, { action: 'up' | 'stop' | 'sync' | 'login'; server?: string }>({ query: (body) => ({ url: 'api/drive', method: 'POST', body }), invalidatesTags: ['Drive'] }),

    // ChatMode (live test)
    chatPatches: b.query<ChatPatchesResponse, void>({ query: () => 'api/chat/patches', providesTags: ['Chat', 'Catalog', 'Runtime'] }),
    chat: b.mutation<ChatResponse, ChatRequest>({ query: (body) => ({ url: 'api/chat', method: 'POST', body }), invalidatesTags: ['Events'] }),
    // D3 — polled every 1.5 s while a turn is pending: is it still queued behind the shared model, and who holds it?
    chatStatus: b.query<ChatStatusResponse, string>({ query: (id) => `api/chat/status?request_id=${encodeURIComponent(id)}` }),
    cancelChat: b.mutation<ChatCancelResponse, string>({ query: (id) => ({ url: 'api/chat/cancel', method: 'POST', body: { request_id: id } }) }),
    // operator settings (persisted on the node)
    settings: b.query<{ settings: Settings }, void>({ query: () => 'api/me/settings', providesTags: ['Settings'] }),
    updateSettings: b.mutation<{ settings: Settings }, Partial<Settings>>({ query: (body) => ({ url: 'api/me/settings', method: 'PATCH', body }), invalidatesTags: ['Settings', 'Me', 'Info'] }),

    // Teach mode (spec §6.2) — visitor routes signed with the browser's teaching key; poll a job every 5 s (call site: pollingInterval)
    teachPolicy: b.query<TeachPolicy, void>({ query: () => 'api/teach/policy', providesTags: ['Teach'] }),
    teachPreflight: b.mutation<PreflightResponse, { patch_ids: string[]; base_ids?: string[]; context_ids?: string[]; facts?: TeachFactInput[]; dataset_id?: string; offset?: number; limit?: number }>({ query: (body) => ({ url: 'api/teach/preflight', method: 'POST', body }) }),
    /** Design §12.2: what combining two knowledges would mean — questions, rows and which builds are possible. Reads only. */
    mergePreview: b.mutation<MergePreview, { a: string; b: string }>({ query: (body) => ({ url: 'api/teach/merge/preview', method: 'POST', body }) }),
    createTeachJob: b.mutation<CreateTeachJobResponse, {
      patch_ids: string[]; builds_on_context: boolean; facts?: TeachFactInput[];
      /** lineage §12.1: the knowledge this lesson is built ON (two = a merge), what is only loaded for comparison, and the two confirmations the node will not make for the creator */
      base_ids?: string[]; context_ids?: string[]; mode?: 'scratch' | 'extend' | 'fork' | 'merge'; inherit?: boolean; confirm_conflicts?: boolean;
      /** merge §9: what the creator chose for each question the two answer differently, and how the result is built */
      resolutions?: Record<string, 'a' | 'b' | 'drop' | { answer: string }>; tier?: 'union' | 'retrain' | 'rebuild';
      dataset_id?: string; selected_indexes?: number[]; training?: Partial<TeachTrainingSpec>;
      /** what the preview's live pre-flight measured on those dataset rows (design §5.5) */
      known?: { index: number; base_answer: string }[];
      contributor?: { name?: string }; name?: string;
    }>({
      query: (body) => ({ url: 'api/teach/jobs', method: 'POST', body }), invalidatesTags: ['Teach', 'TeachDataset'],
    }),
    teachJob: b.query<{ job: TeachJob | TeachJobPublic }, string>({ query: (id) => `api/teach/jobs/${encodeURIComponent(id)}`, providesTags: (_r, _e, id) => [{ type: 'Teach', id }] }),
    myTeachJobs: b.query<{ items: TeachJob[] }, void>({ query: () => 'api/teach/jobs?mine=1', providesTags: ['Teach'] }),
    cancelTeachJob: b.mutation<{ ok: boolean; status: 'CANCELLED' }, string>({ query: (id) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}`, method: 'DELETE' }), invalidatesTags: (_r, _e, id) => [{ type: 'Teach', id }, 'Teach', 'Chat'] }),
    retryTeachJob: b.mutation<CreateTeachJobResponse, { id: string; facts: TeachFactInput[]; name?: string }>({ query: ({ id, ...body }) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}/retry`, method: 'POST', body }), invalidatesTags: ['Teach'] }),
    recheckTeachJob: b.mutation<{ ok: boolean; status: 'EXPORTED' }, string>({ query: (id) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}/recheck`, method: 'POST' }), invalidatesTags: (_r, _e, id) => [{ type: 'Teach', id }, 'Teach'] }),
    publishChallenge: b.mutation<PublishChallenge, { id: string; payout_address?: string | null }>({
      query: ({ id, payout_address }) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}/publish-challenge${toQuery({ payout_address: payout_address === null ? 'none' : payout_address })}`, method: 'GET' }),
    }),
    /**
     * The same route, read as a QUERY: the challenge is a pure computation (no nonce, no side effect), and the publish
     * sheet has to show what a sale would pay BEFORE the creator commits to a price (item 186). The mutation above
     * still fetches a fresh one at submit time, so the claim that is signed is never a cached one.
     */
    publishPreview: b.query<PublishChallenge, { id: string; payout_address?: string | null }>({
      query: ({ id, payout_address }) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}/publish-challenge${toQuery({ payout_address: payout_address === null ? 'none' : payout_address })}`, method: 'GET' }),
    }),
    publishTeachJob: b.mutation<PublishResponse, { id: string } & PublishRequest>({ query: ({ id, ...body }) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}/publish`, method: 'POST', body }), invalidatesTags: (_r, _e, a) => [{ type: 'Teach', id: a.id }, 'Teach', 'Chat', 'Catalog', 'Teacher'] }),
    saveTeachJob: b.mutation<TeachSaveResponse, string>({ query: (id) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}/save`, method: 'POST' }) }),
    // Teach mode v2 — datasets (design §7.1-§7.2). One pipeline, two doors: both produce a TeachDataset.
    /** Story B — copy a published knowledge's questions into my training sets (lineage design §12.3). */
    forkPatch: b.mutation<ForkPatchResponse, { id: string; name?: string }>({
      query: ({ id, ...body }) => ({ url: `api/patches/${encodeURIComponent(id)}/fork`, method: 'POST', body }), invalidatesTags: ['TeachDataset'],
    }),
    teachDatasets: b.query<{ items: TeachDataset[] }, void>({ query: () => 'api/teach/datasets', providesTags: ['TeachDataset'] }),
    teachDataset: b.query<{ dataset: TeachDataset }, string>({ query: (id) => `api/teach/datasets/${encodeURIComponent(id)}`, providesTags: (_r, _e, id) => [{ type: 'TeachDataset', id }] }),
    teachDatasetRows: b.query<DatasetRowsPage, { id: string; offset?: number; limit?: number; status?: 'all' | 'ok' | 'rejected'; origin?: 'all' | 'mine' | 'inherited' | 'changed' | 'conflicts' }>({
      query: ({ id, ...q }) => `api/teach/datasets/${encodeURIComponent(id)}/rows${toQuery({ ...q })}`,
      providesTags: (_r, _e, a) => [{ type: 'TeachDataset', id: a.id }],
    }),
    /** The chat door and the paste box: already-canonical questions, no file. */
    createTeachDataset: b.mutation<DatasetResult, { source?: 'chat' | 'inline' | 'sample'; rows?: DatasetRowInput[]; sample?: string; name?: string; retention?: 'keep' | 'delete_after_training' }>({
      query: (body) => ({ url: 'api/teach/datasets', method: 'POST', body }), invalidatesTags: ['TeachDataset'],
    }),
    /** The file door. `sha256` is signed as the body and re-checked against the stored bytes by the node (§D14). */
    uploadTeachDataset: b.mutation<DatasetResult, { file: File; sha256: string; name?: string; retention?: 'keep' | 'delete_after_training'; parse?: DatasetParseOptions }>({
      query: ({ file, sha256, name, retention, parse }) => {
        const form = new FormData();
        form.append('file', file, file.name);
        if (name) form.append('name', name);
        if (retention) form.append('retention', retention);
        for (const [k, v] of Object.entries(parse ?? {})) if (v !== undefined) form.append(k === 'has_header' ? 'has_header' : k, k === 'columns' ? JSON.stringify(v) : String(v));
        return { url: 'api/teach/datasets', method: 'POST', body: form, headers: { [DATASET_SHA_HEADER]: sha256 } };
      },
      invalidatesTags: ['TeachDataset'],
    }),
    reparseTeachDataset: b.mutation<DatasetResult, { id: string } & DatasetParseOptions>({
      query: ({ id, ...body }) => ({ url: `api/teach/datasets/${encodeURIComponent(id)}/reparse`, method: 'POST', body }),
      invalidatesTags: (_r, _e, a) => [{ type: 'TeachDataset', id: a.id }, 'TeachDataset'],
    }),
    patchTeachDataset: b.mutation<DatasetResult, { id: string; name?: string; retention?: 'keep' | 'delete_after_training'; rows_op?: DatasetRowsOp }>({
      query: ({ id, ...body }) => ({ url: `api/teach/datasets/${encodeURIComponent(id)}`, method: 'PATCH', body }),
      invalidatesTags: (_r, _e, a) => [{ type: 'TeachDataset', id: a.id }, 'TeachDataset'],
    }),
    forkTeachDataset: b.mutation<DatasetResult, { id: string; name?: string; rows_op?: DatasetRowsOp }>({
      query: ({ id, ...body }) => ({ url: `api/teach/datasets/${encodeURIComponent(id)}/fork`, method: 'POST', body }), invalidatesTags: ['TeachDataset'],
    }),
    deleteTeachDataset: b.mutation<{ ok: boolean; status: 'deleted' }, string>({
      query: (id) => ({ url: `api/teach/datasets/${encodeURIComponent(id)}`, method: 'DELETE' }), invalidatesTags: ['TeachDataset', 'Teach'],
    }),
    teachSamples: b.query<{ samples: DatasetSample[] }, void>({ query: () => 'api/teach/samples' }),
    /** Same dataset, another attempt (design §11): effort bumped, `parent_job` set, quota re-charged. */
    retrainTeachJob: b.mutation<CreateTeachJobResponse, { id: string; dataset_id?: string; selected_indexes?: number[]; training?: Partial<TeachTrainingSpec>; name?: string }>({
      query: ({ id, ...body }) => ({ url: `api/teach/jobs/${encodeURIComponent(id)}/retrain`, method: 'POST', body }), invalidatesTags: ['Teach', 'TeachDataset'],
    }),
    teachJobEvents: b.query<{ events: TeachEventRow[]; cursor: number }, { id: string; since?: number }>({
      query: ({ id, since }) => `api/teach/jobs/${encodeURIComponent(id)}/events${toQuery({ since })}`,
    }),
    teacher: b.query<TeacherProfile, string>({ query: (address) => `api/teacher/${encodeURIComponent(address)}`, providesTags: (_r, _e, address) => [{ type: 'Teacher', id: address.toLowerCase() }, 'Teacher'] }),
    /**
     * The teacher asks this node to retry a failed transfer (item 306). Signed with the teaching key that is owed
     * the money; the node refuses any other key and rate-limits it to one attempt every ten minutes.
     */
    nudgePayout: b.mutation<{ payout: PayoutRow; retried: boolean; retry_after_ms?: number }, number>({
      query: (id) => ({ url: `api/teach/payouts/${id}/nudge`, method: 'POST' }),
      invalidatesTags: ['Teacher'],
    }),
    /** A verifier's record, from the ledger (item 337) — what makes one tick weigh more than another. */
    verifier: b.query<VerifierProfile, string>({ query: (address) => `api/verifiers/${encodeURIComponent(address)}`, providesTags: ['Catalog'] }),

    // Teach mode — operator (spec §6.4): policy, review queue, contributors, bans, payouts (Teaching tab on My knowledge)
    teachAdminPolicy: b.query<TeachPolicyAdmin, void>({ query: () => 'api/me/teach/policy', providesTags: ['TeachAdmin'] }),
    updateTeachAdminPolicy: b.mutation<TeachPolicyAdmin, TeachPolicyPatch>({ query: (body) => ({ url: 'api/me/teach/policy', method: 'PATCH', body }), invalidatesTags: ['TeachAdmin', 'Teach', 'Info'] }),
    teachAdminJobs: b.query<{ items: TeachJobAdmin[] }, void>({ query: () => 'api/me/teach/jobs', providesTags: ['TeachAdmin'] }),
    approveTeachJob: b.mutation<{ status: 'ANNOUNCED'; patch_id: string; url: string }, string>({ query: (id) => ({ url: `api/me/teach/jobs/${encodeURIComponent(id)}/approve`, method: 'POST' }), invalidatesTags: ['TeachAdmin', 'Teach', 'Catalog', 'Me', 'Ledger', 'Events'] }),
    rejectTeachJob: b.mutation<{ ok: boolean; status: 'REJECTED' }, { id: string; reason: string }>({ query: ({ id, reason }) => ({ url: `api/me/teach/jobs/${encodeURIComponent(id)}/reject`, method: 'POST', body: { reason } }), invalidatesTags: ['TeachAdmin', 'Teach'] }),
    cancelTeachJobAdmin: b.mutation<{ ok: boolean; status: 'CANCELLED' }, string>({ query: (id) => ({ url: `api/me/teach/jobs/${encodeURIComponent(id)}/cancel`, method: 'POST' }), invalidatesTags: ['TeachAdmin', 'Teach'] }),
    teachContributors: b.query<{ items: ContributorRow[] }, void>({ query: () => 'api/me/teach/contributors', providesTags: ['TeachAdmin'] }),
    setContributorHidden: b.mutation<{ ok: boolean; contributor: ContributorRow }, { address: string; hidden: boolean }>({ query: ({ address, hidden }) => ({ url: `api/me/teach/contributors/${encodeURIComponent(address)}`, method: 'POST', body: { hidden } }), invalidatesTags: ['TeachAdmin', 'Catalog', 'Teacher'] }),
    teachBans: b.query<{ items: BanRow[] }, void>({ query: () => 'api/me/teach/bans', providesTags: ['TeachAdmin'] }),
    addTeachBan: b.mutation<{ ban: BanRow }, { kind: 'address' | 'ip'; value: string; reason?: string }>({ query: (body) => ({ url: 'api/me/teach/bans', method: 'POST', body }), invalidatesTags: ['TeachAdmin'] }),
    deleteTeachBan: b.mutation<{ ok: boolean }, number>({ query: (id) => ({ url: `api/me/teach/bans/${id}`, method: 'DELETE' }), invalidatesTags: ['TeachAdmin'] }),
    payouts: b.query<PayoutsResponse, { status?: 'pending' | 'paid' | 'failed'; limit?: number } | void>({ query: (q) => `api/me/payouts${toQuery({ ...(q ?? {}) })}`, providesTags: ['Payouts'] }),
    retryPayout: b.mutation<{ payout: PayoutRow }, number>({ query: (id) => ({ url: `api/me/payouts/${id}/retry`, method: 'POST' }), invalidatesTags: ['Payouts', 'Me', 'Teacher'] }),
  }),
});

export const {
  useInfoQuery, useCatalogQuery, usePatchQuery, usePatchRecordsQuery, usePatchEventsQuery, useBenchmarkQuery, useLedgerQuery, useLedgerVerifyQuery,
  useGraphQuery, useBranchesQuery, useRouteQuery, useLazyRouteQuery, useNodesQuery, useEventsQuery, useChainQuery, useRuntimeQuery, useDriveQuery, useDriveChangesQuery,
  usePatchTreeQuery, usePatchSignalsQuery, usePatchIssuesQuery, usePatchDatasetQuery, useCreateIssueMutation, useChatFeedbackMutation, useExploreShelvesQuery,
  useMeQuery, useLoginMutation, useSetupMutation, useLogoutMutation, useChangePasswordMutation,
  useMyPatchesQuery, useMyPurchasesQuery, useWalletQuery, useCreatePatchMutation, useUpdatePatchMutation, useDeletePatchMutation, useAnnounceMutation, useRetireMutation, useSetPriceMutation,
  useVerifyMutation, useChallengeMutation, useBuyMutation, useCollectMutation, useMyCreditQuery, useApplyMutation, useRemoveMutation, useCreateBranchMutation, useAddToBranchMutation,
  useSubscribeMutation, useTrackQuoteQuery, useSyncBranchMutation, useRequestPatchMutation,
  useCompleteMutation, useAddPeerMutation, useRemovePeerMutation, useChainSetupMutation, useDriveActionMutation,
  useChatPatchesQuery, useChatMutation, useChatStatusQuery, useCancelChatMutation, useSettingsQuery, useUpdateSettingsMutation, useDocsQuery,
  useTeachPolicyQuery, useTeachPreflightMutation, useMergePreviewMutation, useCreateTeachJobMutation, useTeachJobQuery, useMyTeachJobsQuery, useCancelTeachJobMutation, useRetryTeachJobMutation,
  useRecheckTeachJobMutation, usePublishChallengeMutation, usePublishPreviewQuery, usePublishTeachJobMutation, useSaveTeachJobMutation, useTeacherQuery, useVerifierQuery, useNudgePayoutMutation,
  useForkPatchMutation, useTeachDatasetsQuery, useTeachDatasetQuery, useTeachDatasetRowsQuery, useCreateTeachDatasetMutation, useUploadTeachDatasetMutation, useReparseTeachDatasetMutation,
  usePatchTeachDatasetMutation, useForkTeachDatasetMutation, useDeleteTeachDatasetMutation, useTeachSamplesQuery, useRetrainTeachJobMutation, useTeachJobEventsQuery,
  useTeachAdminPolicyQuery, useUpdateTeachAdminPolicyMutation, useTeachAdminJobsQuery, useApproveTeachJobMutation, useRejectTeachJobMutation, useCancelTeachJobAdminMutation,
  useTeachContributorsQuery, useSetContributorHiddenMutation, useTeachBansQuery, useAddTeachBanMutation, useDeleteTeachBanMutation, usePayoutsQuery, useRetryPayoutMutation,
} = api;

/** Extract a human message from an RTK Query error. */
export function errorMessage(err: unknown): string {
  if (!err) return '';
  const e = err as { data?: { error?: string; issues?: { message: string }[] }; error?: string; status?: number | string };
  if (e.data?.error) return e.data.issues?.length ? `${e.data.error}: ${e.data.issues.map((i) => i.message).join(', ')}` : e.data.error;
  if (typeof e.error === 'string') return e.error;
  return `request failed${e.status ? ` (${e.status})` : ''}`;
}
