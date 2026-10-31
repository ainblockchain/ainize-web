/**
 * A project's environment variables — the node calls them project secrets (ainize-node `src/project-routes.ts`,
 * "secrets"). Sealed at rest, delivered to the project's container and its script runs as env, and never read back:
 * the console sees names and when each was set, the way Vercel shows a sensitive variable.
 *
 *   GET    /api/projects/:id/secrets                     → { secrets: [{ name, updatedAt }], declared, missing, managed }
 *   PUT    /api/projects/:id/secrets/:name[?redeploy=1]  { value } → 201 | 200 { name, updatedAt, created, redeploy }
 *   DELETE /api/projects/:id/secrets/:name[?redeploy=1]  → { ok, name, redeploy }
 *
 * Who: the owner, or a member of the project's organization with the write role; any other member gets 403
 * `not_writer`, everyone else 404. `declared` is what the newest deployment's ainize.json lists under `secrets`;
 * `missing` the declared names not set yet. `managed` (a node with managed storage) the names a connected store sets
 * at deploy — they win over a secret of the same name, so those rows are greyed and a PUT of one is refused
 * `managed_by_store` (src/api/projectStorage.ts).
 *
 * What is here is what tests can hold still: the node's rules (name, reserved names, one line, 32 KiB, 64 per
 * project) checked before the request, the `.env` paste parser and the plan it turns into, the request shapes, the
 * error codes, and the sequential save the bulk paste uses.
 */
import type { Queued } from './projects';

/** ainize-node project-manifest.ts `PROJECT_SECRET_NAME`. */
export const SECRET_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
/** ainize-node project-routes.ts `PROJECT_SECRET_VALUE_MAX` / `PROJECT_SECRETS_MAX`. */
export const SECRET_VALUE_MAX = 32 * 1024;
export const SECRETS_MAX = 64;
/** ainize-node project-containers.ts `PROJECT_RESERVED_ENV` — set by the node; plus anything starting AINIZE_. */
export const RESERVED_SECRET_NAMES: readonly string[] = [
  'HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY',
  'AINIZE_URL', 'AINIZE_API_KEY', 'PATH', 'PORT', 'HOSTNAME',
];

export interface ProjectSecret { name: string; updatedAt: number | null }
export interface ProjectSecretsResponse { secrets: ProjectSecret[]; declared: string[]; missing: string[]; managed: string[] }
export interface SecretSaved { name: string; updatedAt: number | null; created: boolean; redeploy: Queued | null }
export interface SecretRemoved { ok: boolean; name: string; redeploy: Queued | null }

const names = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const queuedOf = (v: unknown): Queued | null => {
  const q = v as { deploymentId?: unknown; status?: unknown } | null | undefined;
  return q && typeof q.deploymentId === 'string' ? { deploymentId: q.deploymentId, status: (typeof q.status === 'string' ? q.status : 'queued') as Queued['status'] } : null;
};
const timeOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** `GET …/secrets`, read defensively: rows without a name are dropped, the list comes back sorted by name. */
export function parseProjectSecretsResponse(raw: unknown): ProjectSecretsResponse {
  const r = (raw ?? {}) as { secrets?: unknown; declared?: unknown; missing?: unknown; managed?: unknown };
  const secrets = (Array.isArray(r.secrets) ? r.secrets : [])
    .map((s) => s as { name?: unknown; updatedAt?: unknown })
    .filter((s) => typeof s?.name === 'string')
    .map((s) => ({ name: s.name as string, updatedAt: timeOf(s.updatedAt) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const declared = names(r.declared);
  // An older node sends no `managed`: nothing is set by a store there.
  const managed = names(r.managed);
  // An older answer without `missing` still gets one: declared and not set. A name a connected store provides is not
  // missing — the app gets it at deploy whether or not a secret is set.
  const missing = (Array.isArray(r.missing) ? names(r.missing) : declared.filter((n) => !secrets.some((s) => s.name === n))).filter((n) => !managed.includes(n));
  return { secrets, declared, missing, managed };
}
export function parseSecretSaved(raw: unknown): SecretSaved {
  const r = (raw ?? {}) as { name?: unknown; updatedAt?: unknown; created?: unknown; redeploy?: unknown };
  return { name: typeof r.name === 'string' ? r.name : '', updatedAt: timeOf(r.updatedAt), created: r.created === true, redeploy: queuedOf(r.redeploy) };
}
export function parseSecretRemoved(raw: unknown): SecretRemoved {
  const r = (raw ?? {}) as { ok?: unknown; name?: unknown; redeploy?: unknown };
  return { ok: r.ok !== false, name: typeof r.name === 'string' ? r.name : '', redeploy: queuedOf(r.redeploy) };
}

/**
 * One row of the table: a variable that is set, or one ainize.json declares and nobody has set. `managed`: a connected
 * store sets this name at deploy, so the secret's value (if any) is not what the app sees — the row is greyed.
 */
export interface EnvRow { name: string; updatedAt: number | null; set: boolean; declared: boolean; managed: boolean }
export function envRowsOf(r: ProjectSecretsResponse): EnvRow[] {
  const managed = r.managed ?? [];
  const rows: EnvRow[] = r.secrets.map((s) => ({ name: s.name, updatedAt: s.updatedAt, set: true, declared: r.declared.includes(s.name), managed: managed.includes(s.name) }));
  for (const n of r.missing) if (!rows.some((x) => x.name === n)) rows.push({ name: n, updatedAt: null, set: false, declared: true, managed: false });
  // a declared name a store provides is shown (greyed) rather than silently dropped from the list
  for (const n of r.declared) if (managed.includes(n) && !rows.some((x) => x.name === n)) rows.push({ name: n, updatedAt: null, set: false, declared: true, managed: true });
  // The missing ones first: they are what keeps the app from starting (a store-provided one is not missing).
  const ok = (x: EnvRow) => Number(x.set || x.managed);
  return rows.sort((a, b) => ok(a) - ok(b) || a.name.localeCompare(b.name));
}

// ------------------------------------------------------------------------------------------------ the rules

export type SecretNameProblem = 'empty' | 'invalid' | 'reserved';
export type SecretValueProblem = 'multiline' | 'too_large';

export const isReservedSecretName = (name: string): boolean => RESERVED_SECRET_NAMES.includes(name) || /^AINIZE_/i.test(name);

export function secretNameProblem(name: string): SecretNameProblem | null {
  if (!name) return 'empty';
  if (!SECRET_NAME.test(name)) return 'invalid';
  if (isReservedSecretName(name)) return 'reserved';
  return null;
}

export const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

/** One line (the container's env file cannot carry a line break — base64 a PEM), at most 32 KiB. Empty is allowed. */
export function secretValueProblem(value: string): SecretValueProblem | null {
  if (/[\r\n\0]/.test(value)) return 'multiline';
  if (utf8Bytes(value) > SECRET_VALUE_MAX) return 'too_large';
  return null;
}

// ------------------------------------------------------------------------------------------------ .env paste

export interface DotEnvEntry { name: string; value: string; line: number }
export type DotEnvSkipReason = 'syntax' | 'unterminated_quote';
export interface DotEnvParse { entries: DotEnvEntry[]; skipped: { line: number; text: string; reason: DotEnvSkipReason }[] }

/**
 * `.env` text → entries. Blank lines and `#` comments are ignored; `export KEY=value` is read as `KEY=value`; a value
 * in matching single, double or back quotes is taken between them (inside double quotes `\"` and `\\` unescape; a
 * `\n` stays the two characters it is — the node takes one line only); an unquoted value ends at ` #`. A quote that
 * does not close on its line is reported, not guessed at. The same name twice: the later line wins, as with dotenv.
 */
export function parseDotEnv(text: string): DotEnvParse {
  const byName = new Map<string, DotEnvEntry>();
  const skipped: DotEnvParse['skipped'] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    const s = raw.trim();
    if (!s || s.startsWith('#')) return;
    const m = /^(?:export\s+)?([^\s=#]+)\s*=\s*(.*)$/.exec(s);
    if (!m) { skipped.push({ line, text: raw, reason: 'syntax' }); return; }
    const name = m[1]!;
    let rest = m[2]!;
    let value: string;
    const q = rest[0];
    if (q === '"' || q === "'" || q === '`') {
      let end = -1;
      for (let j = 1; j < rest.length; j++) {
        if (q === '"' && rest[j] === '\\') { j++; continue; }
        if (rest[j] === q) { end = j; break; }
      }
      if (end < 0) { skipped.push({ line, text: raw, reason: 'unterminated_quote' }); return; }
      value = rest.slice(1, end);
      if (q === '"') value = value.replace(/\\(["\\])/g, '$1');
    } else {
      rest = rest.replace(/\s+#.*$/, '');
      value = rest.trim();
    }
    byName.delete(name);
    byName.set(name, { name, value, line });
  });
  return { entries: [...byName.values()], skipped };
}

export type BulkAction = 'create' | 'update' | 'invalid';
export interface BulkPlanRow { name: string; value: string; line: number; action: BulkAction; problem: SecretNameProblem | SecretValueProblem | 'limit' | null }

/** What saving the paste would do, row by row, against the names already set: create, update, or why not. */
export function planBulk(entries: DotEnvEntry[], existing: readonly string[], max = SECRETS_MAX): BulkPlanRow[] {
  let count = existing.length;
  return entries.map((e) => {
    const problem = secretNameProblem(e.name) ?? secretValueProblem(e.value);
    if (problem) return { ...e, action: 'invalid' as const, problem };
    if (existing.includes(e.name)) return { ...e, action: 'update' as const, problem: null };
    if (count >= max) return { ...e, action: 'invalid' as const, problem: 'limit' as const };
    count++;
    return { ...e, action: 'create' as const, problem: null };
  });
}

// ------------------------------------------------------------------------------------------------ requests

const base = (projectId: string) => `api/projects/${encodeURIComponent(projectId)}/secrets`;
export const secretsListUrl = (projectId: string) => base(projectId);
export function secretPutRequest(projectId: string, name: string, value: string, redeploy = false) {
  return { url: `${base(projectId)}/${encodeURIComponent(name)}${redeploy ? '?redeploy=1' : ''}`, method: 'PUT' as const, body: { value } };
}
export function secretDeleteRequest(projectId: string, name: string, redeploy = false) {
  return { url: `${base(projectId)}/${encodeURIComponent(name)}${redeploy ? '?redeploy=1' : ''}`, method: 'DELETE' as const };
}

export interface BulkSaveResult { saved: SecretSaved[]; failed: { name: string; error: unknown } | null; redeploy: Queued | null }

/**
 * Save rows one after another (the node has no batch write). `?redeploy=1` rides on the LAST write only, so the
 * project deploys once with every value in place. The first refusal stops the run — what was saved stays saved, and
 * no redeploy is asked for, since the set is incomplete.
 */
export async function saveSecretsSequentially(
  rows: readonly { name: string; value: string }[],
  put: (name: string, value: string, redeploy: boolean) => Promise<SecretSaved>,
  opts: { redeployLast?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<BulkSaveResult> {
  const saved: SecretSaved[] = [];
  let redeploy: Queued | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const last = i === rows.length - 1;
    try {
      const s = await put(r.name, r.value, !!opts.redeployLast && last);
      saved.push(s);
      if (s.redeploy) redeploy = s.redeploy;
    } catch (error) {
      return { saved, failed: { name: r.name, error }, redeploy: null };
    }
    opts.onProgress?.(i + 1, rows.length);
  }
  return { saved, failed: null, redeploy };
}

// ------------------------------------------------------------------------------------------------ errors and access

export type SecretErrorCode =
  | 'not_signed_in' | 'not_writer' | 'not_found' | 'secrets_off' | 'invalid_name' | 'reserved_name' | 'invalid_value' | 'value_too_large'
  | 'too_many_secrets' | 'invalid_request' | 'not_member' | 'forbidden' | 'managed_by_store' | 'network' | 'unknown';
export const SECRET_ERROR_CODES: readonly SecretErrorCode[] = [
  'not_signed_in', 'not_writer', 'not_found', 'secrets_off', 'invalid_name', 'reserved_name', 'invalid_value', 'value_too_large',
  'too_many_secrets', 'invalid_request', 'not_member', 'forbidden', 'managed_by_store', 'network', 'unknown',
];
export interface SecretApiError { status: number | null; code: SecretErrorCode; message: string | null }

/** The node's `{ error: { code, message } }` out of an RTK Query rejection. */
export function secretApiErrorOf(err: unknown): SecretApiError {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  const inner = (e.data as { error?: unknown } | null | undefined)?.error;
  if (inner && typeof inner === 'object') {
    const c = (inner as { code?: unknown }).code;
    const m = (inner as { message?: unknown }).message;
    const code = typeof c === 'string' && (SECRET_ERROR_CODES as readonly string[]).includes(c) ? (c as SecretErrorCode) : 'unknown';
    return { status, code, message: typeof m === 'string' ? m : null };
  }
  if (e.status === 'FETCH_ERROR') return { status: null, code: 'network', message: null };
  if (status === 401) return { status, code: 'not_signed_in', message: null };
  if (status === 403) return { status, code: 'not_writer', message: null };
  if (status === 404) return { status, code: 'not_found', message: null };
  if (status === 413) return { status, code: 'value_too_large', message: null };
  return { status, code: 'unknown', message: typeof inner === 'string' ? inner : null };
}

/**
 * What the section shows, from the list query: `writer` the editor, `reader` the names ainize.json declares (a
 * member without the write role is refused the list), `off` a node without a secret store, `hidden` nothing (not a
 * member — or a node too old to have the route, which answers 404 as well).
 */
export type EnvAccess = 'loading' | 'writer' | 'reader' | 'off' | 'hidden' | 'error';
export function envAccessOf(q: { skip?: boolean; isLoading?: boolean; data?: unknown; error?: unknown }): EnvAccess {
  if (q.skip) return 'hidden';
  if (q.data) return 'writer';
  if (q.error) {
    const e = secretApiErrorOf(q.error);
    if (e.code === 'not_writer' || e.code === 'forbidden') return 'reader';
    if (e.code === 'secrets_off') return 'off';
    if (e.code === 'not_found' || e.code === 'not_signed_in') return 'hidden';
    return 'error';
  }
  return 'loading';
}
