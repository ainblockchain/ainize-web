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
export interface ChatResult {
  /** The answer to show: cut at the point the model started repeating itself when `truncated === 'repetition'`. */
  content: string;
  reasoning?: string | null; usage?: Record<string, unknown>; latency_ms: number; model: string;
  /** Upstream finish_reason ("stop" | "length" | …). */
  finish_reason?: string | null;
  /** D1 — why the shown answer is shorter than what the model produced (null = nothing was cut). */
  truncated?: 'repetition' | 'length' | null;
  shown_chars?: number;
  raw_chars?: number;
  /** The model's full output — present only when it was cut, for the "show the raw answer" toggle. */
  raw_content?: string;
}
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
/**
 * Who holds the one shared serving model. `alive` is the node's own liveness probe of the holder process and
 * `stale` its 15-minute lease check — a lock file left behind by a killed node has alive:false and must not be
 * shown as "someone is testing". `mine` = this node's own request holds it.
 */
export interface ChatLock { owner: string; label: string; since: number; alive: boolean; stale: boolean; mine: boolean }
export interface ChatPatchesResponse {
  items: CatalogEntry[]; runtime: RuntimeStatus; lock: ChatLock | null;
  /** The node's clock, so elapsed times are measured against it rather than the browser's. */
  now?: number;
  /** What the shared model is doing and how many live tests of this node are waiting behind it. */
  queue?: { running: { label: string; since: number } | null; waiting: number };
  /** knowledge the operator keeps loaded for everyone — it is part of every "before" answer (contamination banner) */
  applied?: string[];
  overlaps?: ChatOverlap[];
  /** the caller's private lessons (only with a verified teach signature; filled by teach mode) */
  lessons?: CatalogEntry[];
  teacher?: string;
}
/** Body of POST /api/chat — exactly one of patch_id / patch_ids. */
export interface ChatRequest { patch_id?: string; patch_ids?: string[]; mode?: 'base' | 'patched' | 'compare'; messages: ChatMessage[]; max_tokens?: number; thinking?: boolean;
  /** D3 — the client's id for this live test, so it can ask GET /api/chat/status and cancel while queued. */
  request_id?: string }
/** GET /api/chat/status?request_id= — where one live test is in the queue behind the shared model. */
export interface ChatStatusResponse {
  state: 'queued' | 'running' | 'gone';
  queued_ms: number; running_ms: number;
  /** 1 = next in line; 0 once running. */
  position: number;
  cancelled: boolean;
  lock: ChatLock | null;
  running: { label: string; since: number } | null;
  waiting: number;
  now: number;
}
/** POST /api/chat/cancel — `charged` says plainly whether the free try was spent. */
export interface ChatCancelResponse { cancelled: boolean; reason: 'queued' | 'already_running' | 'gone'; charged: boolean }
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

// ------------------------------------------------------------------ teach mode (spec §6.2 / §6.5; server types in packages/node/src/teach.ts)
export type TeachStatus = 'QUEUED' | 'PREFLIGHT' | 'LOADING' | 'TRAINING' | 'EXPORTED' | 'CHECKING' | 'READY' | 'NEEDS_MORE'
  | 'FAILED' | 'CANCELLED' | 'PENDING_REVIEW' | 'REJECTED' | 'ANNOUNCED' | 'EXPIRED';
export interface TeachFact { prompt: string; answer: string; alt_prompt?: string; base_answer?: string; after_answer?: string; hit?: boolean; heldout_hit?: boolean }
export interface TeachProgress { step: number; max_steps: number; loss?: number; hits: number; total: number; load_s?: number; avg_step_s?: number; started_at?: number }
export interface TeachChecks {
  /** false when the model server stayed down for the whole grace period — nothing measured, publish gated */
  executed: boolean;
  taught: { hits: number; total: number };
  heldout: { hits: number; total: number };
  parent_regression: { ok: boolean; hit: number; total: number };
  locality: { ok: boolean; same: number; total: number };
  reverted_and_reapplied: boolean;
  /** hard publish gate */
  ok: boolean;
  note?: string;
}
export interface TeachJob {
  id: string;
  status: TeachStatus;
  contributor: { address: string; name?: string };
  context_patch_ids: string[];
  builds_on_context: boolean;
  facts: TeachFact[];
  name?: string;
  position?: number;
  eta_s?: number | null;
  /** why a QUEUED / EXPORTED job is waiting: 'slot' (trainer booked), 'lock' (model server busy), 'runtime' (model server down) */
  blocked?: string | null;
  progress?: TeachProgress;
  checks?: TeachChecks;
  result?: { sha256: string; rows: number; size_bytes: number };
  draft_id?: string; patch_id?: string;
  publish_status: 'none' | 'pending_review' | 'rejected' | 'announced' | 'listed';
  reject_reason?: string; error?: string; parent_job?: string;
  created_at: number; updated_at: number; started_at?: number; finished_at?: number; expires_at?: number;
}
/** What strangers get for a job they do not own. */
export type TeachJobPublic = Pick<TeachJob, 'id' | 'status' | 'position' | 'eta_s'>;
export interface TeachPolicy {
  enabled: boolean;
  publish: 'review' | 'auto' | 'never';
  trainer: 'ready' | 'busy' | 'paused';
  paused_reason?: string;
  backend: 'gradient' | 'stub';
  queue: { depth: number; max: number; position_eta_s?: number | null };
  limits: { facts_per_job: number; jobs_per_key_per_day: number; jobs_per_ip_per_day: number; prompt_max: number; answer_max: number };
  timing: { p50_s: number | null; p90_s: number | null; samples: number };
  shares: { contributor: number; lineage: number };
  model: { id_M: string | null };
  applied: string[];
  draft_ttl_days: number;
}
export interface TeachQuota { key_remaining: number; ip_remaining: number }
export interface TeachFactInput { prompt: string; answer: string; alt_prompt?: string; base_answer?: string }
export interface PreflightFact { index: number; status: 'will_train' | 'already_known' | 'overlaps_listing' | 'invalid'; base_answer?: string; detail?: string }
export interface PreflightResponse { facts: PreflightFact[]; trainable: number; quota: TeachQuota }
export interface TeachJobResponse { job: TeachJob }
export interface CreateTeachJobResponse { job: TeachJob; quota: TeachQuota }
export interface TeachSaveResponse { download: { npz_url: string; recipe_url: string; readme_url: string; expires_at: number }; sha256: string; rows: number; size_bytes: number; filename: string }
export interface PublishChallenge { patch_sha256: string; benchmark_hash: string; address: string; signer: string; share: number; claim: string }
export interface PublishRequest { name: string; description?: string; price?: string; license?: string; payout_address?: string | null; claim_sig: string; consent: { permanent: boolean; rights: boolean } }
export type PublishResponse = { status: 'PENDING_REVIEW' } | { status: 'ANNOUNCED'; patch_id: string; url: string };
export interface TeacherLesson { id: string; name: string; status: string; verified: boolean; downloads: number; revenue: string }
export interface TeacherEarningItem { patch_id: string; seller: string; settle_hash: string; amount: string; currency: string; scheme: string; status: 'paid' | 'pending' | 'failed'; tx_hash?: string; attempts?: number; created_at: number; paid_at?: number }
export interface TeacherProfile {
  address: string; name?: string; hidden: boolean; lessons: TeacherLesson[];
  earnings: { currency: string; owed: string; paid: string; pending: string; failed: string; sales: number; items: TeacherEarningItem[] };
}

// ------------------------------------------------------------------ teach mode — operator (spec §6.4; PR-7 Teaching tab)
/** kv overrides the operator saved (unset = config.json default). */
export interface TeachSettings {
  enabled?: boolean; publish?: 'review' | 'auto' | 'never'; factsPerJob?: number; jobsPerKeyPerDay?: number; jobsPerIpPerDay?: number;
  queueMax?: number; contributorShare?: number; draftTtlDays?: number; pausedReason?: string | null; blockedTopics?: string | null;
}
/** Effective config (config.json ← kv overrides). */
export interface TeachEffective extends Required<Omit<TeachSettings, 'pausedReason' | 'blockedTopics'>> {
  backend: 'gradient' | 'stub'; stubOffline?: boolean; pausedReason?: string | null; blockedTopics?: string | null;
  trainer: { container: string; script: string; gpus: string; maxSteps: number; timeoutMs: number };
}
export interface TeachPolicyAdmin { policy: TeachSettings; effective: TeachEffective; trainer: { state: 'ready' | 'busy' | 'paused'; reason?: string } }
export interface TeachPolicyPatch {
  enabled?: boolean; publish?: 'review' | 'auto' | 'never'; facts_per_job?: number; jobs_per_key_per_day?: number; jobs_per_ip_per_day?: number;
  queue_max?: number; contributor_share?: number; draft_ttl_days?: number; paused_reason?: string | null; blocked_topics?: string | null;
}
export type TeachJobAdmin = TeachJob & { ip: string | null };
export interface ContributorRow { address: string; name: string | null; payout_address: string | null; first_seen: number; last_seen: number; jobs: number; published: number; hidden: boolean; note: string | null }
export interface BanRow { id: number; kind: 'address' | 'ip'; value: string; reason: string | null; ts: number }
