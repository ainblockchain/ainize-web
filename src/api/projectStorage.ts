/**
 * Managed storage — the organization-owned Postgres and Blob (S3-compatible) stores a node runs for its projects
 * (ainize-node `src/project-storage-routes.ts`, docs/PROJECTS.md "Managed storage"). A store is a container the node
 * provisions on NFS; a project CONNECTS to it (an attachment under a binding name) and the connection details arrive
 * in its environment at the next deploy; backups land on the NAS and the organization's AinDrive.
 *
 *   GET    /api/orgs/:id/stores                          → { stores, backupDrive, limits, deletedStores }
 *   POST   /api/orgs/:id/stores                          { name, kind, engine?, resources?, extensions?, backups? } → 201 Store
 *   GET    /api/stores/:sid                              → Store + attachments
 *   PATCH  /api/stores/:sid                              { name?, backups?, resources? } → Store | 202 { recreating, store }
 *   POST   /api/stores/:sid/start | /stop | /recreate    → 202 Store
 *   DELETE /api/stores/:sid                              { confirm, skipFinalBackup? } → 202 { deleting, backupId? }
 *   POST   /api/stores/:sid/attachments[?redeploy=1]     { projectId, binding?, envPrefix?, database? } → 201 { attachment, envNames, redeploy }
 *   DELETE /api/stores/:sid/attachments/:projectId[?redeploy=1] → { ok, redeploy }
 *   POST   /api/stores/:sid/reveal                       { projectId? } → { env, dotenv }   (logged by the node)
 *   POST   /api/stores/:sid/rotate[?all=1]               → { credentialsVersion, redeploys }
 *   GET    /api/stores/:sid/tables?database=             → { database, tables }
 *   GET    /api/stores/:sid/tables/:schema/:table/rows   → { columns, rows, total, limit, offset }
 *   POST   /api/stores/:sid/query                        { sql, database? } → { columns, rows, rowCount, truncated, ms }
 *   GET    /api/stores/:sid/objects?prefix=&after=       → { objects, prefixes, next }
 *   GET    /api/stores/:sid/backups                      → { backups, schedule, drive }
 *   POST   /api/stores/:sid/backups                      → 202 { backupId, running }
 *   DELETE /api/stores/:sid/backups/:bk                  → { ok }
 *   POST   /api/stores/:sid/restore | /restore/undo      → 202 { store, newStore? }
 *   GET    /api/stores/:sid/logs?tail=                   → { lines }
 *   PUT    /api/orgs/:id/storage/backup-target           { driveId, token } → { driveId, verifiedAt }
 *   DELETE /api/orgs/:id/storage/backup-target           → { ok }
 *   GET    /api/projects/:id/storage                     → { attached, declared, missing, optionalMissing, orgStores, canManage }
 *
 * Who: a store is its organization's — any role reads, `write` creates, connects, reveals, browses and backs up,
 * `admin` rotates, resizes, deletes and restores. A non-member is told 404 (whether an organization has stores is its
 * own business). A node without `AINIZE_STORAGE_*` answers every route 503 `storage_off`; a node from before storage
 * answers 404 — the pages tell the two apart.
 *
 * What is here is what tests can hold still: the node's rules mirrored (names, prefixes, limits), the defensive
 * readers of every answer, the error codes, the access decision, the env names a binding produces, the `.env` text,
 * the next scheduled backup, and the URLs.
 */
import type { Queued } from './projects';

// ------------------------------------------------------------------------------------------------ the node's rules

/** ainize-node project-manifest.ts `PROJECT_STORE_NAME` — a store's / binding's name, also its host `<name>.store.internal`. */
export const STORE_NAME = /^[a-z][a-z0-9-]{0,31}$/;
/** ainize-node project-manifest.ts `PROJECT_STORE_ENV_PREFIX` — `TEAMS` → `TEAMS_DATABASE_URL`. */
export const ENV_PREFIX = /^[A-Z][A-Z0-9_]{0,31}$/;
/** ainize-node project-manifest.ts `PROJECT_STORE_KINDS`. */
export const STORE_KINDS = ['postgres', 'blob'] as const;
export type StoreKind = (typeof STORE_KINDS)[number];
/** ainize-node project-manifest.ts `PROJECT_STORAGE_MAX` — stores one project connects at most. */
export const STORAGE_MAX = 4;
/** ainize-node project-storage-routes.ts `STORE_QUERY_MAX_BYTES` / `STORE_ROWS_MAX` / `STORE_QUERY_TIMEOUT_MS`. */
export const QUERY_MAX_BYTES = 16 * 1024;
export const ROWS_MAX = 200;
export const QUERY_TIMEOUT_S = 10;
/** ainize-node project-storage.ts `STORE_ENGINES`. */
export const STORE_ENGINES = ['postgres16', 'postgres16-pgvector', 'minio'] as const;
export type StoreEngine = (typeof STORE_ENGINES)[number];
export const STORE_STATUSES = ['provisioning', 'ready', 'stopped', 'error', 'restoring', 'deleting'] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];
export const BACKUP_TRIGGERS = ['schedule', 'manual', 'pre-restore', 'pre-delete', 'pre-rotate'] as const;
export type BackupTrigger = (typeof BACKUP_TRIGGERS)[number];
export type BackupSchedule = 'off' | 'daily' | 'hourly';
/** ainize-node project-storage-docker.ts `STORE_DATABASE_NAME`. */
export const DATABASE_NAME = /^[a-z][a-z0-9_]{0,62}$/;
/** ainize-node project-storage.ts `STORE_DEFAULT_DATABASE` / `STORE_BUCKET`. */
export const DEFAULT_DATABASE = 'app';
export const STORE_BUCKET = 'app';
/** The engine a kind is created with by default, and the kind an engine serves. */
export const engineKindOf = (engine: StoreEngine): StoreKind => (engine === 'minio' ? 'blob' : 'postgres');
export const defaultEngineOf = (kind: StoreKind): StoreEngine => (kind === 'blob' ? 'minio' : 'postgres16');
/** `teams-db` → `TEAMS_DB`: the default env prefix of a binding (ainize-node `storeEnvPrefixOf`). */
export const storeEnvPrefixOf = (name: string) => name.toUpperCase().replace(/-/g, '_');
/** The backup time zone the node schedules in (`AINIZE_STORAGE_BACKUP_TZ`, default). */
export const BACKUP_TZ = 'Asia/Seoul';
/** `AINDRIVE_MAX_UPLOAD_BYTES` — a larger dump stays on the NAS. */
export const DRIVE_UPLOAD_MAX_BYTES = 2 * 1024 * 1024 * 1024;

export type StoreNameProblem = 'empty' | 'invalid';
export function storeNameProblem(name: string): StoreNameProblem | null {
  if (!name) return 'empty';
  return STORE_NAME.test(name) ? null : 'invalid';
}
export function envPrefixProblem(prefix: string): 'invalid' | null {
  return !prefix || ENV_PREFIX.test(prefix) ? null : 'invalid';
}
export function databaseNameProblem(name: string): 'invalid' | null {
  return !name || DATABASE_NAME.test(name) ? null : 'invalid';
}

// ------------------------------------------------------------------------------------------------ the shapes

export interface StoreHealth { state: string; ready: boolean | null; checkedAt: number; error?: string }
export interface StoreBackupSettings { schedule: BackupSchedule; hour: number; retainDays: number; retainCount: number; lastAt: number | null; lastId: string | null; lastStatus: 'ok' | 'error' | null; lastError: string | null }
export interface StoreRestore { at: number; backupId: string; database: string; undoDatabase: string; undoUntil: number }
export interface StoreOperation { kind: 'provision' | 'backup' | 'restore' | 'rotate' | 'recreate' | 'delete'; startedAt: number; log: string[] }
export interface AttachedProject { projectId: string; binding: string; envPrefix: string; database: string }
export interface LastBackup { id: string; status: 'running' | 'ok' | 'error'; startedAt: number; finishedAt: number | null; bytes: number | null; trigger: BackupTrigger }

/** A store as the node shows it (`StoreView`) — never a credential. */
export interface Store {
  id: string;
  orgId: string;
  name: string;
  kind: StoreKind;
  engine: StoreEngine;
  image: string;
  generation: number;
  status: StoreStatus;
  error: string | null;
  warning: 'over_quota' | 'drive_unauthorized' | null;
  host: string;
  port: number;
  resources: { memory: string; cpus: number; diskGiB: number };
  postgres: { databases: string[]; extensions: string[] } | null;
  blob: { bucket: string; accessKeyId: string } | null;
  backups: StoreBackupSettings;
  restores: StoreRestore[];
  credentialsVersion: number;
  usage: { bytes: number; at: number } | null;
  operation: StoreOperation | null;
  connectionNames: string[];
  attachedProjects: AttachedProject[];
  lastBackup: LastBackup | null;
  health: StoreHealth | null;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
}

/** One connected project as `GET /api/stores/:sid` lists it. */
export interface StoreAttachment { projectId: string; org: string | null; repoName: string | null; binding: string; envPrefix: string; database: string; createdAt: number | null }
export interface StoreDetail extends Store { attachments: StoreAttachment[] }

export type BackupDrive = { driveId: string; path: string; uploadedAt: number } | { error: string; retryAt: number } | null;
export interface StoreBackup {
  id: string;
  storeId: string;
  storeName: string | null;
  kind: StoreKind;
  engine: StoreEngine;
  trigger: BackupTrigger;
  status: 'running' | 'ok' | 'error';
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  bytes: number | null;
  sha256: string | null;
  pgVersion: string | null;
  local: string | null;
  drive: BackupDrive;
  keepUntil: number | null;
  files: { database: string; local: string; bytes: number; sha256: string; drive: string | null }[];
}

/** The organization's AinDrive backup target, as the node describes it (never the token). */
export interface BackupTarget { configured: boolean; driveId: string | null; origin: string | null; setAt: number | null; lastOkAt: number | null; lastError: string | null; defaultDriveId: string | null }
export interface StoreLimits { perOrg: number | null; memoryMax: string | null; cpusMax: number | null; attachmentsPerStore: number | null; extensions: string[] }
export interface DeletedStore { storeId: string; name: string | null; kind: StoreKind; engine: StoreEngine; backups: StoreBackup[] }
export interface OrgStoresResponse { stores: Store[]; backupDrive: BackupTarget; limits: StoreLimits; deletedStores: DeletedStore[] }
export interface StoreBackupsResponse { backups: StoreBackup[]; schedule: StoreBackupSettings | null; drive: BackupTarget }

export interface StoreTable { schema: string; name: string; rows: number | null; bytes: number | null }
export interface StoreTablesResponse { database: string; tables: StoreTable[] }
export interface StoreRows { database: string; schema: string; table: string; columns: { name: string; type: string }[]; rows: unknown[][]; total: number | null; limit: number; offset: number }
export interface QueryResult { database: string; columns: string[]; rows: unknown[][]; rowCount: number; truncated: boolean; ms: number }
export interface StoreObject { key: string; size: number; lastModified: string | null }
export interface StoreObjects { prefix: string; objects: StoreObject[]; prefixes: string[]; next: string | null }

/** One `ainize.json` `storage` entry, as the node snapshots it. */
export interface DeclaredBinding { name: string; kind: StoreKind | null; env: string | null; required: boolean }
export interface AttachedStore { store: Store; binding: string; envPrefix: string; database: string; envNames: string[] }
export interface OrgStoreSummary { id: string; name: string; kind: StoreKind; engine: StoreEngine | null; status: StoreStatus }
export interface ProjectStorageResponse {
  attached: AttachedStore[];
  declared: DeclaredBinding[];
  missing: string[];
  optionalMissing: string[];
  orgStores: OrgStoreSummary[];
  orgId: string | null;
  canManage: boolean;
}

export interface RevealedEnv { env: Record<string, string>; dotenv: string }
export interface AttachResult { attachment: AttachedProject & { storeId: string }; envNames: string[]; redeploy: Queued | null }
export interface DetachResult { ok: boolean; redeploy: Queued | null }
export interface RotateResult { credentialsVersion: number; redeploys: { projectId: string; deploymentId: string }[] }
export interface RestoreResult { store: Store; newStore: Store | null }
export interface StoreLogs { storeId: string; tail: number; fetchedAt: number; lines: { ts: string | null; stream: 'stdout' | 'stderr'; text: string }[]; truncated: boolean }

// ------------------------------------------------------------------------------------------------ readers

type Rec = Record<string, unknown>;
const obj = (v: unknown): Rec | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const oneOf = <T extends string>(v: unknown, all: readonly T[], fallback: T): T => ((all as readonly string[]).includes(v as string) ? (v as T) : fallback);
const kindOf = (v: unknown, engine?: unknown): StoreKind => ((STORE_KINDS as readonly string[]).includes(v as string) ? (v as StoreKind) : engine === 'minio' ? 'blob' : 'postgres');
const queuedOf = (v: unknown): Queued | null => {
  const q = obj(v);
  return q && typeof q.deploymentId === 'string' ? { deploymentId: q.deploymentId, status: (typeof q.status === 'string' ? q.status : 'queued') as Queued['status'] } : null;
};

function backupSettingsOf(v: unknown): StoreBackupSettings {
  const b = obj(v) ?? {};
  const schedule = oneOf(b.schedule, ['off', 'daily', 'hourly'] as const, 'daily');
  const lastStatus = b.lastStatus === 'ok' || b.lastStatus === 'error' ? b.lastStatus : null;
  return { schedule, hour: num(b.hour, 4), retainDays: num(b.retainDays, 30), retainCount: num(b.retainCount, 60), lastAt: numOrNull(b.lastAt), lastId: strOrNull(b.lastId), lastStatus, lastError: strOrNull(b.lastError) };
}

/** One store, read defensively: unknown statuses become `error` with the node's text kept, counts default to 0. */
export function parseStore(raw: unknown): Store | null {
  const r = obj(raw);
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return null;
  const engine = oneOf(r.engine, STORE_ENGINES, 'postgres16');
  const kind = kindOf(r.kind, r.engine);
  const resources = obj(r.resources) ?? {};
  const pg = obj(r.postgres);
  const blob = obj(r.blob);
  const op = obj(r.operation);
  const health = obj(r.health);
  const last = obj(r.lastBackup);
  const warning = r.warning === 'over_quota' || r.warning === 'drive_unauthorized' ? r.warning : null;
  return {
    id: r.id, orgId: str(r.orgId), name: r.name, kind, engine,
    image: str(r.image), generation: num(r.generation, 1),
    status: oneOf(r.status, STORE_STATUSES, 'error'), error: strOrNull(r.error), warning,
    host: str(r.host, `${r.name}.store.internal`), port: num(r.port, kind === 'postgres' ? 5432 : 9000),
    resources: { memory: str(resources.memory, '—'), cpus: num(resources.cpus), diskGiB: num(resources.diskGiB) },
    postgres: kind === 'postgres' ? { databases: pg ? strings(pg.databases) : [DEFAULT_DATABASE], extensions: pg ? strings(pg.extensions) : [] } : null,
    blob: kind === 'blob' ? { bucket: str(blob?.bucket, STORE_BUCKET), accessKeyId: str(blob?.accessKeyId) } : null,
    backups: backupSettingsOf(r.backups),
    restores: (Array.isArray(r.restores) ? r.restores : []).flatMap((x): StoreRestore[] => {
      const o = obj(x);
      return o && typeof o.backupId === 'string' ? [{ at: num(o.at), backupId: o.backupId, database: str(o.database, DEFAULT_DATABASE), undoDatabase: str(o.undoDatabase), undoUntil: num(o.undoUntil) }] : [];
    }),
    credentialsVersion: num(r.credentialsVersion, 1),
    usage: obj(r.usage) && typeof obj(r.usage)!.bytes === 'number' ? { bytes: num(obj(r.usage)!.bytes), at: num(obj(r.usage)!.at) } : null,
    operation: op && typeof op.kind === 'string' ? { kind: op.kind as StoreOperation['kind'], startedAt: num(op.startedAt), log: strings(op.log) } : null,
    connectionNames: strings(r.connectionNames),
    attachedProjects: (Array.isArray(r.attachedProjects) ? r.attachedProjects : []).flatMap((x): AttachedProject[] => {
      const o = obj(x);
      return o && typeof o.projectId === 'string' ? [{ projectId: o.projectId, binding: str(o.binding), envPrefix: str(o.envPrefix), database: str(o.database, DEFAULT_DATABASE) }] : [];
    }),
    lastBackup: last && typeof last.id === 'string' ? { id: last.id, status: oneOf(last.status, ['running', 'ok', 'error'] as const, 'error'), startedAt: num(last.startedAt), finishedAt: numOrNull(last.finishedAt), bytes: numOrNull(last.bytes), trigger: oneOf(last.trigger, BACKUP_TRIGGERS, 'manual') } : null,
    health: health && typeof health.state === 'string' ? { state: health.state, ready: typeof health.ready === 'boolean' ? health.ready : null, checkedAt: num(health.checkedAt), ...(typeof health.error === 'string' ? { error: health.error } : {}) } : null,
    createdAt: num(r.createdAt), createdBy: str(r.createdBy), updatedAt: num(r.updatedAt),
  };
}

/** `GET /api/stores/:sid`: the store with the projects connected to it. */
export function parseStoreDetail(raw: unknown): StoreDetail | null {
  const store = parseStore(raw);
  if (!store) return null;
  const r = obj(raw)!;
  const attachments = (Array.isArray(r.attachments) ? r.attachments : []).flatMap((x): StoreAttachment[] => {
    const o = obj(x);
    return o && typeof o.projectId === 'string' ? [{ projectId: o.projectId, org: strOrNull(o.org), repoName: strOrNull(o.repoName), binding: str(o.binding), envPrefix: str(o.envPrefix), database: str(o.database, DEFAULT_DATABASE), createdAt: numOrNull(o.createdAt) }] : [];
  });
  return { ...store, attachments };
}

export function parseBackupTarget(raw: unknown): BackupTarget {
  const r = obj(raw) ?? {};
  return { configured: r.configured === true, driveId: strOrNull(r.driveId), origin: strOrNull(r.origin), setAt: numOrNull(r.setAt), lastOkAt: numOrNull(r.lastOkAt), lastError: strOrNull(r.lastError), defaultDriveId: strOrNull(r.defaultDriveId) };
}

export function parseBackup(raw: unknown): StoreBackup | null {
  const r = obj(raw);
  if (!r || typeof r.id !== 'string') return null;
  const drive = obj(r.drive);
  const engine = oneOf(r.engine, STORE_ENGINES, 'postgres16');
  return {
    id: r.id, storeId: str(r.storeId), storeName: strOrNull(r.storeName), kind: kindOf(r.kind, r.engine), engine,
    trigger: oneOf(r.trigger, BACKUP_TRIGGERS, 'manual'), status: oneOf(r.status, ['running', 'ok', 'error'] as const, 'error'), error: strOrNull(r.error),
    startedAt: num(r.startedAt), finishedAt: numOrNull(r.finishedAt), bytes: numOrNull(r.bytes), sha256: strOrNull(r.sha256), pgVersion: strOrNull(r.pgVersion),
    local: strOrNull(r.local),
    drive: !drive ? null : typeof drive.error === 'string' ? { error: drive.error, retryAt: num(drive.retryAt) } : typeof drive.driveId === 'string' ? { driveId: drive.driveId, path: str(drive.path), uploadedAt: num(drive.uploadedAt) } : null,
    keepUntil: numOrNull(r.keepUntil),
    files: (Array.isArray(r.files) ? r.files : []).flatMap((x) => { const o = obj(x); return o && typeof o.database === 'string' ? [{ database: o.database, local: str(o.local), bytes: num(o.bytes), sha256: str(o.sha256), drive: strOrNull(o.drive) }] : []; }),
  };
}

/** Backups newest first, whatever order the node sent them in. */
const newestFirst = (rows: StoreBackup[]) => rows.sort((a, b) => b.startedAt - a.startedAt);

/** `GET /api/orgs/:id/stores`. */
export function parseStores(raw: unknown): OrgStoresResponse {
  const r = obj(raw) ?? {};
  const limits = obj(r.limits) ?? {};
  return {
    stores: (Array.isArray(r.stores) ? r.stores : []).flatMap((s) => { const x = parseStore(s); return x ? [x] : []; }).sort((a, b) => a.name.localeCompare(b.name)),
    backupDrive: parseBackupTarget(r.backupDrive),
    limits: { perOrg: numOrNull(limits.perOrg), memoryMax: strOrNull(limits.memoryMax), cpusMax: numOrNull(limits.cpusMax), attachmentsPerStore: numOrNull(limits.attachmentsPerStore), extensions: strings(limits.extensions) },
    deletedStores: (Array.isArray(r.deletedStores) ? r.deletedStores : []).flatMap((d): DeletedStore[] => {
      const o = obj(d);
      if (!o || typeof o.storeId !== 'string') return [];
      const engine = oneOf(o.engine, STORE_ENGINES, 'postgres16');
      return [{ storeId: o.storeId, name: strOrNull(o.name), kind: kindOf(o.kind, o.engine), engine, backups: newestFirst((Array.isArray(o.backups) ? o.backups : []).flatMap((b) => { const x = parseBackup(b); return x ? [x] : []; })) }];
    }),
  };
}

/** `GET /api/stores/:sid/backups`. */
export function parseBackups(raw: unknown): StoreBackupsResponse {
  const r = obj(raw) ?? {};
  return {
    backups: newestFirst((Array.isArray(r.backups) ? r.backups : []).flatMap((b) => { const x = parseBackup(b); return x ? [x] : []; })),
    schedule: obj(r.schedule) ? backupSettingsOf(r.schedule) : null,
    drive: parseBackupTarget(r.drive),
  };
}

/** `GET /api/projects/:id/storage`. */
export function parseProjectStorage(raw: unknown): ProjectStorageResponse {
  const r = obj(raw) ?? {};
  const declared = (Array.isArray(r.declared) ? r.declared : []).flatMap((d): DeclaredBinding[] => {
    if (typeof d === 'string') return STORE_NAME.test(d) ? [{ name: d, kind: null, env: null, required: true }] : [];
    const o = obj(d);
    if (!o || typeof o.name !== 'string') return [];
    return [{ name: o.name, kind: (STORE_KINDS as readonly string[]).includes(o.kind as string) ? (o.kind as StoreKind) : null, env: strOrNull(o.env), required: o.required !== false }];
  });
  const attached = (Array.isArray(r.attached) ? r.attached : []).flatMap((a): AttachedStore[] => {
    const o = obj(a);
    const store = o ? parseStore(o.store) : null;
    if (!o || !store) return [];
    const binding = str(o.binding, store.name);
    const envPrefix = str(o.envPrefix, storeEnvPrefixOf(binding));
    return [{ store, binding, envPrefix, database: str(o.database, DEFAULT_DATABASE), envNames: [] as string[] }];
  });
  // The names come from the deploy's order, not from the answer: a node that computes each attachment's `envNames`
  // alone counts every store as the first of its kind, and only the first one gets the bare DATABASE_URL / S3_*.
  const firsts = firstOfKindFlags(attached.map((a) => ({ binding: a.binding, kind: a.store.kind })), declared);
  for (const a of attached) a.envNames = envNamesOf(a.store.kind, a.envPrefix, firsts.get(a.binding) === true);
  const connected = new Set(attached.map((a) => a.binding));
  // An older answer without `missing` still gets one: declared, required, and not connected.
  const missing = Array.isArray(r.missing) ? strings(r.missing) : declared.filter((d) => d.required && !connected.has(d.name)).map((d) => d.name);
  const optionalMissing = Array.isArray(r.optionalMissing) ? strings(r.optionalMissing) : declared.filter((d) => !d.required && !connected.has(d.name)).map((d) => d.name);
  return {
    attached, declared, missing, optionalMissing,
    orgStores: (Array.isArray(r.orgStores) ? r.orgStores : []).flatMap((s): OrgStoreSummary[] => {
      const o = obj(s);
      return o && typeof o.id === 'string' && typeof o.name === 'string' ? [{ id: o.id, name: o.name, kind: kindOf(o.kind, o.engine), engine: (STORE_ENGINES as readonly string[]).includes(o.engine as string) ? (o.engine as StoreEngine) : null, status: oneOf(o.status, STORE_STATUSES, 'error') }] : [];
    }),
    orgId: strOrNull(r.orgId), canManage: r.canManage === true,
  };
}

export function parseTables(raw: unknown): StoreTablesResponse {
  const r = obj(raw) ?? {};
  return {
    database: str(r.database, DEFAULT_DATABASE),
    tables: (Array.isArray(r.tables) ? r.tables : []).flatMap((t): StoreTable[] => {
      const o = obj(t);
      return o && typeof o.name === 'string' ? [{ schema: str(o.schema, 'public'), name: o.name, rows: numOrNull(typeof o.rows === 'string' ? Number(o.rows) : o.rows), bytes: numOrNull(typeof o.bytes === 'string' ? Number(o.bytes) : o.bytes) }] : [];
    }),
  };
}

export function parseRows(raw: unknown): StoreRows {
  const r = obj(raw) ?? {};
  const columns = (Array.isArray(r.columns) ? r.columns : []).flatMap((c) => { const o = obj(c); return o && typeof o.name === 'string' ? [{ name: o.name, type: str(o.type) }] : []; });
  return {
    database: str(r.database, DEFAULT_DATABASE), schema: str(r.schema, 'public'), table: str(r.table), columns,
    rows: (Array.isArray(r.rows) ? r.rows : []).filter((x): x is unknown[] => Array.isArray(x)),
    total: numOrNull(r.total), limit: num(r.limit, 50), offset: num(r.offset, 0),
  };
}

export function parseQueryResult(raw: unknown): QueryResult {
  const r = obj(raw) ?? {};
  const rows = (Array.isArray(r.rows) ? r.rows : []).filter((x): x is unknown[] => Array.isArray(x));
  return { database: str(r.database, DEFAULT_DATABASE), columns: strings(r.columns), rows, rowCount: num(r.rowCount, rows.length), truncated: r.truncated === true, ms: num(r.ms) };
}

export function parseObjects(raw: unknown): StoreObjects {
  const r = obj(raw) ?? {};
  return {
    prefix: str(r.prefix),
    objects: (Array.isArray(r.objects) ? r.objects : []).flatMap((o): StoreObject[] => { const x = obj(o); return x && typeof x.key === 'string' ? [{ key: x.key, size: num(x.size), lastModified: strOrNull(x.lastModified) }] : []; }),
    prefixes: strings(r.prefixes), next: strOrNull(r.next),
  };
}

export function parseRevealed(raw: unknown): RevealedEnv {
  const r = obj(raw) ?? {};
  const env = Object.fromEntries(Object.entries(obj(r.env) ?? {}).filter((e): e is [string, string] => typeof e[1] === 'string'));
  return { env, dotenv: typeof r.dotenv === 'string' ? r.dotenv : dotenvOf(env) };
}

export function parseAttachResult(raw: unknown): AttachResult {
  const r = obj(raw) ?? {};
  const a = obj(r.attachment) ?? {};
  return { attachment: { storeId: str(a.storeId), projectId: str(a.projectId), binding: str(a.binding), envPrefix: str(a.envPrefix), database: str(a.database, DEFAULT_DATABASE) }, envNames: strings(r.envNames), redeploy: queuedOf(r.redeploy) };
}
export function parseDetachResult(raw: unknown): DetachResult {
  const r = obj(raw) ?? {};
  return { ok: r.ok !== false, redeploy: queuedOf(r.redeploy) };
}
export function parseRotateResult(raw: unknown): RotateResult {
  const r = obj(raw) ?? {};
  return { credentialsVersion: num(r.credentialsVersion), redeploys: (Array.isArray(r.redeploys) ? r.redeploys : []).flatMap((x) => { const o = obj(x); return o && typeof o.deploymentId === 'string' ? [{ projectId: str(o.projectId), deploymentId: o.deploymentId }] : []; }) };
}
export function parseRestoreResult(raw: unknown): RestoreResult | null {
  const r = obj(raw) ?? {};
  const store = parseStore(r.store);
  if (!store) return null;
  return { store, newStore: parseStore(r.newStore) };
}
export function parseStoreLogs(raw: unknown): StoreLogs {
  const r = obj(raw) ?? {};
  return {
    storeId: str(r.storeId), tail: num(r.tail, 200), fetchedAt: num(r.fetchedAt, Date.now()), truncated: r.truncated === true,
    lines: (Array.isArray(r.lines) ? r.lines : []).flatMap((l) => { const o = obj(l); return o && typeof o.text === 'string' ? [{ ts: strOrNull(o.ts), stream: o.stream === 'stderr' ? 'stderr' as const : 'stdout' as const, text: o.text }] : []; }),
  };
}

// ------------------------------------------------------------------------------------------------ errors and access

export type StorageApiErrorCode =
  | 'storage_off' | 'storage_not_allowed' | 'not_signed_in' | 'not_found' | 'not_member' | 'insufficient_role' | 'not_writer' | 'invalid_request'
  | 'name_taken' | 'too_many_stores' | 'store_attached' | 'store_busy' | 'store_not_ready' | 'store_stopped' | 'store_owned_elsewhere'
  | 'cross_org' | 'binding_taken' | 'kind_mismatch' | 'prefix_taken' | 'invalid_prefix' | 'too_many_attachments' | 'not_attached'
  | 'confirm_mismatch' | 'checksum_mismatch' | 'backup_not_found' | 'backup_running' | 'nothing_to_undo'
  | 'not_postgres' | 'not_blob' | 'table_not_found' | 'sql_error' | 'sql_timeout' | 'multi_statement' | 'result_too_large' | 'object_too_large'
  | 'drive_unauthorized' | 'aindrive_error' | 'managed_by_store' | 'credentials_missing' | 'storage_error' | 'network' | 'unknown';
export const STORAGE_ERROR_CODES: readonly StorageApiErrorCode[] = [
  'storage_off', 'storage_not_allowed', 'not_signed_in', 'not_found', 'not_member', 'insufficient_role', 'not_writer', 'invalid_request',
  'name_taken', 'too_many_stores', 'store_attached', 'store_busy', 'store_not_ready', 'store_stopped', 'store_owned_elsewhere',
  'cross_org', 'binding_taken', 'kind_mismatch', 'prefix_taken', 'invalid_prefix', 'too_many_attachments', 'not_attached',
  'confirm_mismatch', 'checksum_mismatch', 'backup_not_found', 'backup_running', 'nothing_to_undo',
  'not_postgres', 'not_blob', 'table_not_found', 'sql_error', 'sql_timeout', 'multi_statement', 'result_too_large', 'object_too_large',
  'drive_unauthorized', 'aindrive_error', 'managed_by_store', 'credentials_missing', 'storage_error', 'network', 'unknown',
];
export interface StorageApiError { status: number | null; code: StorageApiErrorCode; message: string | null; extra: Record<string, unknown> }

/**
 * The node's `{ error: { code, message, …extra } }` out of an RTK Query rejection. A 404 with no body is `not_found`
 * too — that is a node from before storage, which has no such route; the pages read it as "no storage API here".
 */
export function storageApiErrorOf(err: unknown): StorageApiError {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  const inner = obj(obj(e.data)?.error);
  if (inner) {
    const { code: c, message: m, ...extra } = inner;
    const code = typeof c === 'string' && (STORAGE_ERROR_CODES as readonly string[]).includes(c) ? (c as StorageApiErrorCode) : 'unknown';
    return { status, code, message: typeof m === 'string' ? m : null, extra };
  }
  if (e.status === 'FETCH_ERROR') return { status: null, code: 'network', message: null, extra: {} };
  if (status === 401) return { status, code: 'not_signed_in', message: null, extra: {} };
  if (status === 403) return { status, code: 'insufficient_role', message: null, extra: {} };
  if (status === 404) return { status, code: 'not_found', message: null, extra: {} };
  if (status === 503) return { status, code: 'storage_off', message: null, extra: {} };
  const text = obj(e.data)?.error;
  return { status, code: 'unknown', message: typeof text === 'string' ? text : null, extra: {} };
}

/**
 * What a storage section shows, from its list query (mirrors `envAccessOf`): `writer` the whole thing (the node said
 * `canManage`, or the list came back for a writer), `reader` the read-only view, `off` a node without storage (503),
 * `hidden` nothing — not a member, not signed in, or a node too old to have the route (404) — and `error` otherwise.
 */
export type StorageAccess = 'hidden' | 'loading' | 'off' | 'reader' | 'writer' | 'error';
export function storageAccessOf(q: { skip?: boolean; isLoading?: boolean; data?: unknown; error?: unknown }): StorageAccess {
  if (q.skip) return 'hidden';
  if (q.data) {
    const d = obj(q.data);
    return d && d.canManage === false ? 'reader' : 'writer';
  }
  if (q.error) {
    const e = storageApiErrorOf(q.error);
    if (e.code === 'storage_off') return 'off';
    if (e.code === 'not_found' || e.code === 'not_signed_in' || e.code === 'not_member') return 'hidden';
    if (e.code === 'storage_not_allowed') return 'off';
    if (e.code === 'insufficient_role' || e.code === 'not_writer') return 'reader';
    return 'error';
  }
  return 'loading';
}

// ------------------------------------------------------------------------------------------------ builders

/** The names of one binding's variables, exactly as ainize-node `storeEnv()` sets them (§4): every binding gets `P_…`, the first of a kind the bare set too. */
export function envNamesOf(kind: StoreKind, prefix: string, first: boolean): string[] {
  const P = prefix;
  const out: string[] = [];
  if (kind === 'postgres') {
    const urls = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_URL_NO_SSL'];
    const parts = ['HOST', 'PORT', 'USER', 'PASSWORD', 'DATABASE'];
    if (first) {
      out.push(...urls, 'POSTGRES_PRISMA_URL', ...parts.map((k) => `POSTGRES_${k}`), 'POSTGRES_DB', 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE');
    }
    out.push(...urls.map((n) => `${P}_${n}`), `${P}_POSTGRES_PRISMA_URL`, ...parts.map((k) => `${P}_POSTGRES_${k}`));
  } else {
    const s3 = ['ENDPOINT', 'BUCKET', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'REGION', 'FORCE_PATH_STYLE'];
    const minio = ['ENDPOINT', 'ACCESS_KEY', 'SECRET_KEY', 'BUCKET', 'USE_SSL'];
    if (first) {
      out.push(...s3.map((k) => `S3_${k}`), 'AWS_ENDPOINT_URL_S3', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', ...minio.map((k) => `MINIO_${k}`));
    }
    out.push(...s3.map((k) => `${P}_S3_${k}`), ...minio.map((k) => `${P}_MINIO_${k}`));
  }
  return out;
}

/**
 * The order a deployment binds its stores in (ainize-node project-storage-manager.ts `bindingsFor`): the bindings
 * ainize.json declares, in its order, then the connected-but-undeclared ones in connection order.
 */
export function deployOrderOf<T extends { binding: string }>(bindings: readonly T[], declared: readonly Pick<DeclaredBinding, 'name'>[]): T[] {
  const at = (b: string) => { const i = declared.findIndex((d) => d.name === b); return i < 0 ? declared.length : i; };
  return bindings.map((b, i) => ({ b, i })).sort((x, y) => at(x.b.binding) - at(y.b.binding) || x.i - y.i).map((x) => x.b);
}

/** binding → whether it is the first of its kind in deploy order, i.e. also gets the unprefixed names (`storesEnv`). */
export function firstOfKindFlags(bindings: readonly { binding: string; kind: StoreKind }[], declared: readonly Pick<DeclaredBinding, 'name'>[]): Map<string, boolean> {
  const seen = new Set<StoreKind>();
  const out = new Map<string, boolean>();
  for (const b of deployOrderOf(bindings, declared)) { out.set(b.binding, !seen.has(b.kind)); seen.add(b.kind); }
  return out;
}

/** Whether a binding about to be connected would be the first of its kind — Connect's preview of the names it gets. */
export function wouldBeFirstOfKind(next: { binding: string; kind: StoreKind }, attached: readonly { binding: string; store: Pick<Store, 'kind'> }[], declared: readonly Pick<DeclaredBinding, 'name'>[]): boolean {
  const all = [...attached.filter((a) => a.binding !== next.binding).map((a) => ({ binding: a.binding, kind: a.store.kind })), next];
  return firstOfKindFlags(all, declared).get(next.binding) === true;
}

/** Connect's preselected store: the one named like the binding if it is ready, else the first ready one, else none. */
export function defaultStoreChoiceOf(candidates: readonly Pick<OrgStoreSummary, 'id' | 'name' | 'status'>[], bindingName: string | null): string {
  const ready = candidates.filter((s) => s.status === 'ready');
  return (ready.find((s) => s.name === bindingName) ?? ready[0])?.id ?? '';
}

/**
 * Await a started mutation and take it out of the Redux store — for a reveal (its answer holds passwords) and the
 * backup target (its argument holds an AinDrive token). RTK Query keeps a mutation's `data` and `originalArgs` in
 * `state.api.mutations` until its hook unmounts or is reset, and the project's Storage tab stays mounted while it is
 * open, so the entry is removed the moment the answer arrives, or the refusal. The started promise's own `reset()`
 * is the one that works here: the hook's `reset` is bound to the render before the trigger and would do nothing.
 */
export async function unwrapUncached<T>(started: { unwrap(): Promise<T>; reset(): void }): Promise<T> {
  try { return await started.unwrap(); } finally { started.reset(); }
}

/**
 * The Storage tab of an attached project, by its id: `/projects/:id` forwards to the right page with the query kept,
 * a monorepo folder's project included (the store's attachment rows carry no folder, so `projectPath` cannot be built).
 */
export const attachedProjectStoragePath = (projectId: string) => `/projects/${encodeURIComponent(projectId)}?tab=storage`;

/** The Blob listing's pages: `trail` holds the cursor each page was opened with, so Previous and First page work. */
export interface ObjectPages { trail: (string | undefined)[] }
export const objectPagesStart = (): ObjectPages => ({ trail: [undefined] });
export const objectPagesAfter = (p: ObjectPages): string | undefined => p.trail[p.trail.length - 1];
export const objectPagesNext = (p: ObjectPages, next: string): ObjectPages => ({ trail: [...p.trail, next] });
export const objectPagesPrev = (p: ObjectPages): ObjectPages => (p.trail.length > 1 ? { trail: p.trail.slice(0, -1) } : p);

/** `.env.local` text, quoted as ainize-node `renderDotenv` does: plain URL-safe values bare, anything else double-quoted with `\` `"` and newlines escaped. */
export function dotenvOf(env: Record<string, string>): string {
  const quote = (v: string) => (/^[A-Za-z0-9_./:@?&=%+-]*$/.test(v) ? v : `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`);
  const lines = Object.entries(env).map(([k, v]) => `${k}=${quote(v)}`);
  return lines.join('\n') + (lines.length ? '\n' : '');
}

/** The one line a person pastes first: the Postgres URL, or the S3 endpoint (the bucket is always `app`). */
export function connectionStringOf(kind: StoreKind, env: Record<string, string>): string | null {
  if (kind === 'postgres') return env.DATABASE_URL ?? Object.entries(env).find(([k]) => k.endsWith('_DATABASE_URL'))?.[1] ?? null;
  return env.S3_ENDPOINT ?? Object.entries(env).find(([k]) => k.endsWith('_S3_ENDPOINT'))?.[1] ?? null;
}

/** `••••` for the secret-bearing variables of a revealed set, the rest as they are. */
export const SECRET_ENV = /(PASSWORD|SECRET|_URL$|^DATABASE_URL$|_KEY$)/;
export function maskEnvValue(name: string, value: string): string {
  if (!SECRET_ENV.test(name)) return value;
  if (/_URL$/.test(name) || name === 'DATABASE_URL') return value.replace(/:\/\/([^:@/]+):([^@/]+)@/, '://$1:••••••@');
  return '••••••';
}

export type StatusTone = 'ok' | 'warn' | 'busy' | 'muted';
/** Green ready · grey (pulsing) provisioning/restoring/deleting · red error/stopped. */
export const storeStatusTone = (status: StoreStatus): StatusTone =>
  status === 'ready' ? 'ok' : status === 'error' || status === 'stopped' ? 'warn' : status === 'provisioning' || status === 'restoring' || status === 'deleting' ? 'busy' : 'muted';

/** Is the store in a state the page should poll more often for? */
export const storeIsBusy = (s: Pick<Store, 'status' | 'operation'>) => s.status === 'provisioning' || s.status === 'restoring' || s.status === 'deleting' || !!s.operation;

/** The wall-clock offset of `tz` at `at`, in milliseconds (positive east of UTC). */
function tzOffsetMs(at: number, tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(at));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(at / 1000) * 1000;
  } catch { return 9 * 3_600_000; }   // Asia/Seoul, when Intl has no zones
}

/**
 * When the node's scheduler will next back this store up (ainize-node project-storage-backups.ts): `daily` at
 * `hour` o'clock in `tz` (the first such instant after `now`), `hourly` sixty minutes after the last one (or now,
 * when none ran yet), `off` never.
 */
export function nextBackupAt(store: Pick<Store, 'backups'>, now = Date.now(), tz = BACKUP_TZ): number | null {
  const b = store.backups;
  if (b.schedule === 'off') return null;
  if (b.schedule === 'hourly') return b.lastAt ? Math.max(now, b.lastAt + 3_600_000) : now;
  const offset = tzOffsetMs(now, tz);
  const local = now + offset;
  const day = Math.floor(local / 86_400_000) * 86_400_000;
  let slot = day + b.hour * 3_600_000 - offset;
  if (slot <= now) slot += 86_400_000;
  return slot;
}

/** `1.2 GiB`, `350 MiB`, `12 KiB` — sizes the tables show. */
export function bytesLabel(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes / 1024; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

/** The default name of a restore-to-new-store copy: `<name>-r<yyyymmdd>`, cut to the name rule. */
export function restoreCopyNameOf(name: string, now = Date.now()): string {
  const d = new Date(now);
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const suffix = `-r${stamp}`;
  return `${name.slice(0, 32 - suffix.length)}${suffix}`;
}

// ------------------------------------------------------------------------------------------------ urls

export const orgStoresUrl = (orgId: string) => `api/orgs/${encodeURIComponent(orgId)}/stores`;
export const backupTargetUrl = (orgId: string) => `api/orgs/${encodeURIComponent(orgId)}/storage/backup-target`;
export const storeUrl = (sid: string, sub?: string) => `api/stores/${encodeURIComponent(sid)}${sub ? `/${sub}` : ''}`;
export const projectStorageUrl = (projectId: string) => `api/projects/${encodeURIComponent(projectId)}/storage`;
export const storeRowsUrl = (sid: string, schema: string, table: string, q: { database?: string; limit?: number; offset?: number; order?: string; dir?: 'asc' | 'desc' }) => {
  const params = new URLSearchParams();
  if (q.database) params.set('database', q.database);
  params.set('limit', String(Math.max(1, Math.min(ROWS_MAX, q.limit ?? 50))));
  params.set('offset', String(Math.max(0, q.offset ?? 0)));
  if (q.order) { params.set('order', q.order); params.set('dir', q.dir ?? 'asc'); }
  return `${storeUrl(sid, `tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/rows`)}?${params.toString()}`;
};
export const storeObjectsUrl = (sid: string, q: { prefix?: string; after?: string; limit?: number }) => {
  const params = new URLSearchParams();
  if (q.prefix) params.set('prefix', q.prefix);
  if (q.after) params.set('after', q.after);
  if (q.limit) params.set('limit', String(q.limit));
  const s = params.toString();
  return `${storeUrl(sid, 'objects')}${s ? `?${s}` : ''}`;
};
export const storeObjectDownloadUrl = (sid: string, key: string) => `/${storeUrl(sid, 'objects/download')}?key=${encodeURIComponent(key)}`;
/** A backup's copy on the organization's AinDrive. */
export const driveBackupUrl = (driveId: string, path: string, origin = 'https://aindrive.ainetwork.ai') => `${origin}/d/${encodeURIComponent(driveId)}?path=${encodeURIComponent(path.replace(/\/[^/]*$/, ''))}`;
