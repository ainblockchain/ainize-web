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
  counts: { patches: number; listed: number };
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
export interface WalletResponse extends ChainResponse { sales: Settlement[]; royalties: { patch_id: string; amount: string; created_at: number }[]; purchases: number; }
export interface PurchaseResult { patch_id: string; steps: { step: string; detail: string; at: number }[]; manifest: PatchManifest; path: string; tx_hash: string; amount: string; scheme: string; }
export interface RuntimeResponse extends Omit<RuntimeStatus, 'applied'> { applied: { patch_id: string; sha256: string; applied_at: number; reason: string }[]; }
export interface DriveResponse {
  configured: boolean; running: boolean; pid: number | null; folder: string; server: string | null; drive_id: string | null; url: string | null;
  login_hint: string; files: { path: string; size: number; mtime: number }[];
}
export interface DriveChange { seq: number; digest: string; created_at: number; kind: 'update' | 'snapshot'; bytes: number; text?: string | null; }
export interface DriveChangesResponse { path: string; doc_id: string | null; changes: DriveChange[]; current: string | null; }
