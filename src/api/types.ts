/**
 * API response shapes of a marketplace node (packages/node/src/api.ts).
 * Domain types come straight from @ngram/core (type-only import, erased at build time).
 */
import type {
  Attestation, BranchInfo, Challenge, LedgerInfo, LedgerRecord, PatchAnchor, PatchManifest, PatchStatus, PeerInfo, RuntimeStatus, Settlement,
  TeachDataset, TeachDatasetFormat, TeachDatasetLang, TeachDatasetRef, TeachDatasetRow, TeachDatasetSource, TeachDatasetStatus, TeachDatasetSummary, TeachEffort, TeachRowStatus, TeachTrainingSpec,
} from '@ngram/core';

export type { Attestation, BranchInfo, Challenge, LedgerInfo, LedgerRecord, PatchAnchor, PatchManifest, PatchStatus, PeerInfo, RuntimeStatus, Settlement };
/** teach mode v2 — the dataset is a first-class object (design docs/teachable-dataset-design.md §6.3). */
export type { TeachDataset, TeachDatasetFormat, TeachDatasetLang, TeachDatasetRef, TeachDatasetRow, TeachDatasetSource, TeachDatasetStatus, TeachDatasetSummary, TeachEffort, TeachRowStatus, TeachTrainingSpec };

export interface CatalogEntry {
  anchor: PatchAnchor & { entry_id?: string; node_id?: string; gateway_url?: string };
  status: PatchStatus;
  attestations: Attestation[];
  passed: number;
  integrity_checks: number;
  /** Attestations by the anchor's own author — shown, never counted (see catalog.ts). */
  self_checks: number;
  quorum: number;
  quorum_ok: boolean;
  /** Quorum met AND no open challenge: the only flag that means "buyable". */
  sellable: boolean;
  open_challenge?: Challenge;
  /** Every challenge and what the verifiers said about it afterwards (item 328). */
  challenge_log?: { challenge: Challenge; state: 'open' | 'upheld' | 'dismissed'; answered_at?: number; answered_by?: string }[];
  /** Addresses whose attestations count — the verifiers paid the verification share of each sale (item 325). */
  verifiers?: string[];
  /** Distinct model-server fingerprints behind those attestations: `2/2` with ONE of these is not two runs (item 329). */
  executors?: string[];
  /** Counted attestations written before the fingerprint existed — independence unknown, never assumed. */
  executors_unknown?: number;
  /** Attestations recorded but not counted because the knowledge was already applied when they ran (item 329). */
  no_baseline?: number;
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

/**
 * What this node knows about its peers beyond the bare count (item 170): how many ANSWERED the last gossip round,
 * how many of those verify, and which publish on a ledger this node cannot read — whose knowledge therefore never
 * reaches this catalogue, however green every other indicator looks.
 */
export interface PeerStatus {
  known: number;
  reachable: number;
  unreachable: number;
  verifiers: number;
  ledger_mismatch: number;
  ledger: 'local' | 'ain';
  mismatched: { endpoint: string; name: string | null; ledger: string }[];
}

export interface InfoResponse {
  node: PeerInfo;
  ledger: LedgerInfo;
  runtime: RuntimeStatus;
  quorum: number;
  currency: 'AIN' | 'CREDIT' | 'USDC';
  peers: number;
  peer_status?: PeerStatus;
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
/**
 * An address-set overlap with another knowledge on this node. `cross_branch` and `branch` come straight from the
 * node (market.ts:459) and decide the supersede rule with `same_schema`: only a same-schema overlap that is NOT
 * cross-branch and is LISTED / VERIFYING / ANNOUNCED is retired when this one reaches quorum.
 */
export interface ConflictInfo {
  patch_id: string; overlap_rows: number; same_schema: boolean; status: string; branch?: string; cross_branch?: boolean;
  /** who published the overlapping knowledge — only your OWN overlaps are ever retired by a publish (items 151, 363) */
  author?: string; author_name?: string | null; same_author?: boolean; created_at?: number; sales?: number;
}

export interface PatchDetail extends CatalogEntry {
  lineage: { parents: LineageRef[]; children: LineageRef[] };
  conflicts: ConflictInfo[];
  branches: { name: string; context: Record<string, string> }[];
  /** Lineage §12.5: the bases a buyer must load under this knowledge, and whether this node holds them. */
  requires?: { id: string; name: string; held: boolean; price: string | null }[];
  /** Whether the published training set's bytes are on this node (a preview or download can only come from here). */
  dataset_held?: boolean;
  owned: boolean;
  purchased: boolean;
  has_body: boolean;
  applied: boolean;
  gateway_url: string | null;
  /** Set when the author retired it (item 148): off sale for good, the record kept. */
  retired_at?: number | null;
  retire_reason?: string | null;
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
export interface NodesResponse {
  /** `blobs` is filtered through THIS node's catalogue; `blobs_advertised` is what the node itself says it holds (item 170). */
  nodes: (PeerInfo & { blobs_advertised?: number; ledger_mismatch?: boolean })[];
  peers: { endpoint: string; address: string | null; info: PeerInfo | null; last_seen: number; failures: number; ledger?: string | null; ledger_mismatch?: boolean }[];
  self: string;
  ledger?: 'local' | 'ain';
  peer_status?: PeerStatus;
}
export interface ChainResponse extends LedgerInfo { address: string; balance: number | null; }

export interface AuthMe { signedIn: boolean; address: string; name: string; roles: string[]; needsSetup: boolean; }
export interface PurchaseRow { patch_id: string; sha256: string; tx_hash: string; scheme: string; amount: string; manifest: PatchManifest | null; path: string | null; created_at: number; entry: CatalogEntry | null; applied: boolean; }
/** One royalty transfer the node owes (node `payouts` table, spec §7.5): pending → paid (tx_hash) | failed (last_error, retried every 60 s up to 20 times). */
export interface PayoutRow { id: number; patch_id: string; settle_hash: string; address: string; amount: string; currency: string; status: 'pending' | 'paid' | 'failed'; tx_hash: string | null; attempts: number; last_error: string | null; created_at: number; updated_at: number }
export interface PayoutSummary { pending: number; failed: number; paid: number }
export interface PayoutsResponse { items: PayoutRow[]; summary: PayoutSummary; max_attempts: number; retry_ms: number; wallet: boolean }
/**
 * One creator-share line. `state` separates a promise from a payment (item 311): `credited` is play money already in
 * the balance, `paid` / `pending` / `failed` is what the SELLER's node answered about that settlement, and
 * `unconfirmed` means the only evidence is the record the seller wrote.
 */
export interface RoyaltyRow {
  patch_id: string; amount: string; created_at: number;
  kind?: 'lineage' | 'verification';
  state?: 'credited' | 'paid' | 'pending' | 'failed' | 'unconfirmed';
  seller?: string; seller_name?: string | null; buyer?: string; currency?: string; scheme?: string;
  tx_hash?: string | null; reported_at?: number | null; last_error?: string | null; days?: number;
}
export interface WalletResponse extends ChainResponse { sales: Settlement[]; royalties: RoyaltyRow[]; purchases: number; payouts?: PayoutSummary & { items: PayoutRow[] };
  royalty_totals?: { owed: string; credited: string; paid: string; unconfirmed: string };
  /** The share of other people's sales this node earned by verifying their knowledge (item 325). */
  verification?: RoyaltyRow[]; verification_total?: string; verifier_share?: number; }
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
  /** How many messages each column was sent, and whether the two conversations differed (split histories). */
  history?: { base: number; patched: number; split: boolean };
  /** SC-13 — the handle *Mark wrong* comes back with. The node holds the question behind it; the browser never resends it. */
  turn_id?: string;
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
export interface ChatRequest { patch_id?: string; patch_ids?: string[]; mode?: 'base' | 'patched' | 'compare'; messages: ChatMessage[];
  /**
   * Compare mode with a history: one conversation per column — `messages_base` replays the answers the BASE model
   * gave, `messages_patched` the ones the patched model gave. Both must end with the same (new) question; a column
   * without its own array falls back to `messages`. Without the split the base column is told it previously
   * produced the knowledge's answer and simply repeats it.
   */
  messages_base?: ChatMessage[]; messages_patched?: ChatMessage[];
  max_tokens?: number; thinking?: boolean;
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
export interface TeachProgress {
  step: number; max_steps: number; loss?: number; hits: number; total: number; load_s?: number; avg_step_s?: number; started_at?: number;
  /** Which stage the rail is on. The big bar stays the real `step / max_steps` — never a computed percent (design §D5). */
  phase?: 'load' | 'train' | 'check';
  /** Stage-weighted and monotonic, for compact surfaces only. NOT a time estimate; no surface may label it as one. */
  percent?: number;
  rows_total?: number; rows_touched?: number;
  /** How many questions the trainer probed at the last evaluation, of how many trained. */
  eval_sample?: { n: number; of: number };
  elapsed_s?: number;
}
export interface TeachChecks {
  /** false when the model server stayed down for the whole grace period — nothing measured, publish gated */
  executed: boolean;
  /** `sampled` is present when the dataset was too big to check whole — never make a whole-dataset claim from it. */
  taught: { hits: number; total: number; sampled?: { checked: number; of: number } };
  heldout: { hits: number; total: number };
  parent_regression: { ok: boolean; hit: number; total: number };
  /** `total` counts only the prompts whose own baseline repeated; `unstable` is how many were left out of the gate. */
  locality: { ok: boolean; same: number; total: number; unstable?: number };
  reverted_and_reapplied: boolean;
  /** hard publish gate */
  ok: boolean;
  /** the node measured nothing: a stub backend without a model server made these numbers up */
  simulated?: boolean;
  note?: string;
  /** The visitor turned the side-effect check off — publish stays gated until a recheck measures it. */
  skipped?: true;
  /**
   * Lineage (design §7.6): per knowledge in the stack, its own questions re-asked with the lesson ON TOP. `base_hit`
   * is the same questions measured BEFORE the lesson went on; `base_failed` are the ones the base itself misses on
   * this node (left out of the score); `overridden` are the ones this lesson deliberately replaces.
   */
  parent_check?: { patch_id: string; hit: number; total: number; failed: number[]; simulated?: boolean; base_hit?: number; base_total?: number; base_failed?: number[]; overridden?: number }[];
  /** "removing the lesson leaves the base exactly as it was" — null until it was measured. */
  reversibility_ok?: boolean | null;
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
  /** What this lesson was trained from. A v1 job renders `{id: null, source: 'derived', rows: facts.length}`. */
  dataset?: TeachDatasetRef;
  /** the worker's pre-training pass: `known` questions were dropped because the model already answered them */
  preflight?: { checked: number; of: number; known: number; overlaps?: number };
  training?: TeachTrainingSpec;
  /** Lineage (design §12.1): the ordered base stack (ancestors first), how the lesson was made, what it did with the base's questions. */
  bases?: { patch_id: string; sha256: string; name?: string; status?: string }[];
  mode?: 'scratch' | 'extend' | 'fork' | 'merge';
  export?: 'delta' | 'squash';
  inherited_rows?: number;
  changed_rows?: number;
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
  queue: { depth: number; max: number; position_eta_s?: number | null; queued_rows?: number; queued_rows_max?: number };
  limits: {
    facts_per_job: number; jobs_per_key_per_day: number; jobs_per_ip_per_day: number; prompt_max: number; answer_max: number;
    /** v2 (design §9) — every limit the UI shows comes from here; nothing may be hard-coded in the bundle. */
    dataset_max_bytes?: number; dataset_max_rows?: number; dataset_max_source_lines?: number;
    rows_per_job?: number; rows_per_job_source?: 'default' | 'measured' | 'operator';
    rows_per_key_per_day?: number; rows_per_ip_per_day?: number; datasets_per_key_per_day?: number; dataset_ttl_days?: number;
    formats?: string[]; declaration_rows?: number;
  };
  /** Every field is null until >= 3 lessons were measured with `backend: 'gradient'`; a stub node reports `simulated`. */
  timing: { p50_s: number | null; p90_s: number | null; samples: number; backend?: 'gradient' | 'stub'; simulated?: boolean; load_s_p50?: number | null; s_per_row_p50?: number | null; s_per_row_p90?: number | null };
  effort?: { id: TeachEffort; max_steps: number; eval_every: number }[];
  samples?: { kind: string; name: string; rows: number }[];
  /** true when this node's checks are simulated (stub backend without a model server) — never claim a live-model verification */
  simulated_checks: boolean;
  shares: { contributor: number; lineage: number };
  model: { id_M: string | null };
  applied: string[];
  draft_ttl_days: number;
  /** `teach.lineage` — whether this node lets a lesson be built on top of another knowledge (design §18 gating). */
  lineage?: boolean;
  /**
   * Can anything published here actually be SOLD? (item 298) `verifiers` counts peers that answered recently and
   * advertise the verifier role; a lesson needs `quorum` independent attestations, and this node's own does not count.
   * Absent on a node built before this field existed — treat that as "unknown", never as "yes".
   */
  verification?: { quorum: number; peers: number; reachable: number; verifiers: number; self_verifier: boolean };
  /** How this node settles a sale. `local` is development play money nobody can spend (item 299). */
  ledger?: { kind: 'local' | 'ain'; currency: string };
}
/**
 * What one sale would actually pay, and to whom (item 186). Computed by the node with the same `royaltySplit` that
 * settles a real sale, on a UNIT price — every branch of it is proportional, so a share scales exactly.
 */
export interface SplitPreview {
  currency: string;
  royalty_share: number;
  contributor_share: number;
  parents: { id: string; name: string; author?: string; price?: string }[];
  /** fraction of one sale, per address; `kind` says which line of the sheet it is */
  shares: { address: string; share: number; kind: 'you' | 'node' | 'lineage'; name?: string }[];
  /** the direct parent's price when there is one, else this node's default — a child priced 0 pays its parents 0 */
  suggested_price: string;
}
/** `POST /api/patches/:id/fork` — Story B, *Copy and continue*. */
export interface ForkPatchResponse {
  dataset_id: string; dataset: TeachDataset; created: boolean; inherited_rows: number;
  parent: { patch_id: string; name: string; dataset_sha256: string }; license: string | null;
}
export interface TeachQuota { key_remaining: number; ip_remaining: number; rows_remaining?: number; rows_ip_remaining?: number }
export interface TeachFactInput { prompt: string; answer: string; alt_prompt?: string; base_answer?: string }
export interface PreflightFact {
  index: number;
  /** `in_base` / `base_conflict` appear only when a base was chosen (lineage design §12.1, SC-6). */
  status: 'will_train' | 'already_known' | 'overlaps_listing' | 'invalid' | 'in_base' | 'base_conflict';
  base_answer?: string; detail?: string; base_id?: string;
}
export interface PreflightResponse { facts: PreflightFact[]; trainable: number; quota: TeachQuota; bases?: string[]; sampled?: { checked: number; of: number } }
export interface TeachJobResponse { job: TeachJob }
export interface CreateTeachJobResponse { job: TeachJob; quota: TeachQuota }
export interface TeachSaveResponse { download: { npz_url: string; recipe_url: string; readme_url: string; expires_at: number }; sha256: string; rows: number; size_bytes: number; filename: string }
export interface PublishChallenge {
  patch_sha256: string; benchmark_hash: string; address: string; signer: string; share: number; claim: string;
  /** items 186 / 298 / 299 — what a sale pays, whether it can be sold here at all, and in what money. */
  split_preview?: SplitPreview;
  verification?: { quorum: number; peers: number; reachable: number; verifiers: number; self_verifier: boolean };
  ledger?: { kind: 'local' | 'ain'; currency: string };
}
export interface PublishRequest {
  name: string; description?: string; price?: string; license?: string; payout_address?: string | null; claim_sig: string;
  consent: { permanent: boolean; rights: boolean }; contributor?: { name?: string };
  /** SC-8 — what may be done with the questions, their licence, and where they came from (lineage design §6.1, §6.5). */
  dataset?: {
    access?: 'public' | 'derivative' | 'private'; license?: string; include_notes?: boolean;
    declaration?: { source: 'own' | 'public' | 'licensed'; license?: string; no_pii: boolean } | null;
  };
}
export type PublishResponse = { status: 'PENDING_REVIEW' } | { status: 'ANNOUNCED'; patch_id: string; url: string };
// ---------------- teach mode v2: dataset requests and responses (design §7)
export interface DatasetReport { summary: TeachDatasetSummary; rows: TeachDatasetRow[] }
export interface DatasetResult { dataset: TeachDataset; report: DatasetReport; created: boolean }
export interface DatasetRowsPage {
  total: number; source_rows: number; offset: number; limit: number; summary: TeachDatasetSummary; items: TeachDatasetRow[];
  /** SC-5 filter counts over the WHOLE set (not the page): mine / inherited / changed / conflicts. */
  origins?: { mine: number; inherited: number; changed: number; conflicts: number };
}
export interface DatasetSample { kind: string; name: string; description?: string; rows: number; sha256: string; preview: TeachDatasetRow[]; download_url: string }
export interface DatasetParseOptions { format?: TeachDatasetFormat; delimiter?: string; has_header?: boolean; encoding?: string; layout?: string; columns?: Record<string, string | number> }
export type DatasetRowInput = { prompt: string; answer: string; alt_prompt?: string; note?: string };
export type DatasetRowsOp =
  | { op: 'remove'; indexes: number[] }
  | { op: 'append'; rows: DatasetRowInput[] }
  | { op: 'replace'; index: number; row: DatasetRowInput };
export interface TeachEventRow { seq: number; ts: number; level: string; message: string; data: unknown }

export interface TeacherLesson {
  id: string; name: string; status: string; verified: boolean; downloads: number; revenue: string;
  /** item 298: how long it has been waiting, and how many independent verifiers have actually looked. */
  created_at?: number; attestations?: number; quorum?: number;
}
export interface TeacherEarningItem { patch_id: string; seller: string; settle_hash: string; amount: string; currency: string; scheme: string; status: 'paid' | 'pending' | 'failed'; tx_hash?: string; attempts?: number; created_at: number; paid_at?: number }
export interface TeacherProfile {
  address: string; name?: string; hidden: boolean; lessons: TeacherLesson[];
  /** item 298 — whether a lesson published on this node can ever reach quorum here. */
  verification?: { quorum: number; peers: number; reachable: number; verifiers: number; self_verifier: boolean };
  /** item 299 — `local` means every number on this page is node credit, not money. */
  ledger?: { kind: 'local' | 'ain'; currency: string };
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

// ---------------------------------------------------------------- family tree, signals, open questions (lineage design §12.5, SC-9 … SC-12)
/** One knowledge in the family tree. `missing` = an id only: unknown on this node, or not for this reader. */
export interface TreeNode {
  id: string; name: string; missing?: boolean;
  author?: string; author_name?: string | null; taught_by?: string | null;
  contributors: { address: string; name: string | null; role?: string; share?: number }[];
  status?: string; superseded_by: string[]; supersedes: string[];
  branch?: string | null; tracks?: string[];
  derivation?: { kind: string; bases: { patch_id: string; rows: number }[]; added_rows: number; changed_rows: number; removed_rows: number } | null;
  base_stack: string[]; export?: 'delta' | 'squash' | null;
  /** No `derivation`: a declared parent, not a knowledge trained on top of it (design §14). */
  legacy?: boolean;
  dataset?: { sha256: string; rows: number; access: 'public' | 'derivative' | 'private'; license: string | null } | null;
  added: { questions: number; changed: number; removed: number; rows: number; new: number };
  signals: Record<string, number>;
  /** 0 = the knowledge being looked at; negative = an ancestor, positive = a descendant. */
  depth: number;
}
export type TreeEdgeKind = 'extend' | 'update' | 'contradict' | 'merge' | 'version' | 'track' | 'declared';
export interface TreeResponse {
  root: string; depth: number; dir: 'up' | 'down' | 'both';
  nodes: TreeNode[]; edges: { from: string; to: string; kind: TreeEdgeKind }[];
  truncated: boolean;
  family: { sales: number; knowledges: number; authors: number };
  /** `lineage_pct` is what the ancestors' authors share; `contributor_pct` is this knowledge's own credited teacher — two different promises. */
  money: {
    seller_pct: number; lineage_pct: number; contributor_pct: number;
    /** what the verifiers keeping this knowledge on sale are paid out of one sale (item 325) */
    verifier_pct?: number; verifier_count?: number;
    seller_name: string | null; lineage_names: string[];
    recipients: { address: string; pct: number; name: string | null; kind: 'lineage' | 'contributor' | 'verifier' }[];
  };
}
export interface SignalsResponse {
  patch_id: string;
  /** Read from the ledger and the peer table — the same on every node. */
  network: { scope: 'network'; sales_all: number; sales_30d: number; buyers: number; revenue: string; loads: number; dataset_loads: number; built_on: number; versions: number; subscribers: number; passed: number; quorum: number };
  /** This node's own counters. `window_days` says how far back, and the label must say "this node". */
  node: { scope: 'node'; window_days: number; days: number; visitors: number; open_questions: number } & Record<string, number | string>;
}
export type IssueKind = 'own_miss' | 'preflight' | 'free_wrong' | 'request' | 'gap';
export interface IssueItem {
  id: string; kind: IssueKind; count: number; people: number; topic: string | null;
  /** null when the question was counted but not kept — nobody consented to share it (design §10). */
  text: string | null;
  sample_index: number | null; status: string; covered_by: string | null; first_seen: number; last_seen: number;
}
export interface IssuesResponse { patch_id: string; total: number; counts: Record<string, number>; items: IssueItem[] }
export interface PatchDatasetResponse {
  sha256: string; rows: number; access: 'public' | 'derivative' | 'private'; license: string | null;
  parents: { patch_id: string; sha256: string; rows: number }[];
  held: boolean; include_notes: boolean; benchmark_samples: number | null; merkle_root: string | null;
  preview?: { prompt: string; answer: string; from?: string }[];
}
export interface ShelfCard {
  id: string; name: string; author: string; author_name: string | null; status: string;
  price: string; currency: string; rows: number; topic_path: string;
  requires: { id: string; name: string }[];
  built_on?: number; sales_30d?: number; sales_all?: number; created_at?: number;
}
export interface ShelvesResponse {
  shelves: { id: 'selling' | 'built_on' | 'fresh'; items: ShelfCard[] }[];
  asked: { topic: string; count: number; people: number; patches: string[] }[];
  scope: Record<string, string>;
}
