/**
 * API response shapes of a marketplace node (packages/node/src/api.ts).
 * Domain types come straight from @ngram/core (type-only import, erased at build time).
 */
import type {
  Attestation, BranchInfo, Challenge, LedgerInfo, LedgerRecord, PatchAnchor, PatchManifest, PatchStatus, PeerInfo, RuntimeStatus, Settlement,
} from '@ngram/core';

export type { Attestation, BranchInfo, Challenge, LedgerInfo, LedgerRecord, PatchAnchor, PatchManifest, PatchStatus, PeerInfo, RuntimeStatus, Settlement };

export interface CatalogEntry {
  anchor: PatchAnchor & { entry_id?: string; node_id?: string; gateway_url?: string };
  status: PatchStatus;
  attestations: Attestation[];
  passed: number;
  integrity_checks: number;
  quorum: number;
  quorum_ok: boolean;
  settlements: Settlement[];
  downloads: number;
  revenue: string;
  challenges: Challenge[];
  superseded_by: string[];
  supersedes: string[];
  children: string[];
  record_hash: string;
  listed_at?: number;
}

export interface InfoResponse {
  node: PeerInfo;
  ledger: LedgerInfo;
  runtime: RuntimeStatus;
  quorum: number;
  currency: 'AIN' | 'CREDIT' | 'USDC';
  peers: number;
  initial_credit?: string;
  /** Lineage share of each sale distributed to source creators. */
  royalty_share?: number;
  /** Visitors may teach and publish knowledge through this node as data providers (teach mode). */
  accepts_contributions?: boolean;
  /** Default data-provider share of the seller remainder. */
  contributor_share?: number;
  counts: { patches: number; listed: number; verifying?: number; superseded?: number; rejected?: number };
}

export interface CatalogResponse { total: number; items: CatalogEntry[]; models: string[]; schemas: string[]; }

export interface LineageRef { id: string; name: string; author: string; status: PatchStatus; }
export interface ConflictInfo { patch_id: string; overlap_rows: number; same_schema: boolean; status: string; }

export interface PatchDetail extends CatalogEntry {
  lineage: { parents: LineageRef[]; children: LineageRef[] };
  conflicts: ConflictInfo[];
  branches: { name: string; context: Record<string, string> }[];
  owned: boolean;
  purchased: boolean;
  has_body: boolean;
  applied: boolean;
  gateway_url: string | null;
}

export interface EventRow { seq: number; ts: number; level: 'debug' | 'info' | 'warn' | 'error'; kind: string; patch_id: string | null; message: string; data: unknown; }

export interface LedgerResponse { info: LedgerInfo; records: LedgerRecord[]; }
export interface VerifyResponse { valid: boolean; checked: number; errors: string[]; }
export interface GraphResponse {
  nodes: { id: string; name: string; author: string; status: PatchStatus; model: string; schema: string; branch?: string }[];
  edges: { from: string; to: string; type: string }[];
  chain: unknown;
}
export interface BranchesResponse { branches: (BranchInfo & { subscribers: Partial<PeerInfo>[] })[]; mine: string[]; }
export interface RouteResponse { branch: BranchInfo | null; nodes: PeerInfo[]; }
export interface NodesResponse { nodes: PeerInfo[]; peers: { endpoint: string; address: string | null; info: PeerInfo | null; last_seen: number; failures: number }[]; self: string; }
export interface ChainResponse extends LedgerInfo { address: string; balance: number | null; }

export interface AuthMe { signedIn: boolean; address: string; name: string; roles: string[]; needsSetup: boolean; }
export interface PurchaseRow { patch_id: string; sha256: string; tx_hash: string; scheme: string; amount: string; manifest: PatchManifest | null; path: string | null; created_at: number; entry: CatalogEntry | null; applied: boolean; }
/** One royalty transfer the node owes (node `payouts` table, spec §7.5): pending → paid (tx_hash) | failed (last_error, retried every 60 s up to 20 times). */
export interface PayoutRow { id: number; patch_id: string; settle_hash: string; address: string; amount: string; currency: string; status: 'pending' | 'paid' | 'failed'; tx_hash: string | null; attempts: number; last_error: string | null; created_at: number; updated_at: number }
export interface PayoutSummary { pending: number; failed: number; paid: number }
export interface PayoutsResponse { items: PayoutRow[]; summary: PayoutSummary; max_attempts: number; retry_ms: number; wallet: boolean }
export interface WalletResponse extends ChainResponse { sales: Settlement[]; royalties: { patch_id: string; amount: string; created_at: number }[]; purchases: number; payouts?: PayoutSummary & { items: PayoutRow[] }; }
export interface PurchaseResult { patch_id: string; steps: { step: string; detail: string; at: number }[]; manifest: PatchManifest; path: string; tx_hash: string; amount: string; scheme: string; }
export interface RuntimeResponse extends Omit<RuntimeStatus, 'applied'> { applied: { patch_id: string; sha256: string; applied_at: number; reason: string }[]; }
export interface DriveResponse {
  configured: boolean; running: boolean; pid: number | null; folder: string; server: string | null; drive_id: string | null; url: string | null;
  login_hint: string; files: { path: string; size: number; mtime: number }[];
}
export interface DriveChange { seq: number; digest: string; created_at: number; kind: 'update' | 'snapshot'; bytes: number; text?: string | null; }
export interface DriveChangesResponse { path: string; doc_id: string | null; changes: DriveChange[]; current: string | null; }

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ChatResult { content: string; reasoning?: string | null; usage?: Record<string, unknown>; latency_ms: number; model: string }
export interface ChatApplied { patch_id: string; applied_ms: number | null; was_applied: boolean }
export interface ChatResponse {
  /** first knowledge (kept for old clients); `patch_ids` lists every knowledge loaded, in load order */
  patch_id: string; patch_ids?: string[]; mode: 'base' | 'patched' | 'compare'; base: ChatResult | null; patched: ChatResult | null;
  /** sum over all loaded knowledges */
  applied_ms: number | null; was_applied: boolean; model: string | null;
  /** OR over `benchmark_hits` */
  benchmark_hit?: boolean | null; applied?: ChatApplied[]; benchmark_hits?: Record<string, boolean | null>;
  remaining_quota: number | null;
  /** Hourly free-trial limit for visitors (null/undefined = unlimited or not reported). */
  quota_limit?: number | null;
}
/** Two testable knowledges that share `rows` memory entries (the one loaded last wins on those). */
export interface ChatOverlap { a: string; b: string; rows: number }
export interface ChatPatchesResponse {
  items: CatalogEntry[]; runtime: RuntimeStatus; lock: { owner: string; label: string; since: number } | null;
  /** knowledge the operator keeps loaded for everyone — it is part of every "before" answer (contamination banner) */
  applied?: string[];
  overlaps?: ChatOverlap[];
  /** the caller's private lessons (only with a verified teach signature; filled by teach mode) */
  lessons?: CatalogEntry[];
  teacher?: string;
}
/** Body of POST /api/chat — exactly one of patch_id / patch_ids. */
export interface ChatRequest { patch_id?: string; patch_ids?: string[]; mode?: 'base' | 'patched' | 'compare'; messages: ChatMessage[]; max_tokens?: number; thinking?: boolean }
export interface Settings { notifications: 'all' | 'sales' | 'none'; display_name: string; payout_address: string }

export interface OpenApiOperation { tags?: string[]; summary?: string; description?: string; parameters?: { name: string; in: string; required?: boolean; description?: string; schema?: { type?: string; enum?: string[]; default?: unknown } }[]; requestBody?: { content: Record<string, { schema: unknown }> }; responses?: Record<string, { description: string }>; security?: unknown[] }
export interface OpenApiDoc { openapi: string; info: { title: string; version: string; description: string }; servers: { url: string }[]; tags: { name: string; description: string }[]; paths: Record<string, Record<string, OpenApiOperation>>; components: { schemas: Record<string, unknown> } }
export interface CliReference {
  install: string[];
  oneLiners: Record<string, { ko: string; en: string; cmd: string }>;
  groups: { name: string; commands: { cmd: string; desc: string }[] }[];
  benchmarkExample: unknown;
}
export interface DocsResponse { openapi: OpenApiDoc; cli: CliReference; node: string }
