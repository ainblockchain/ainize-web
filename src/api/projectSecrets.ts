/**
 * A project's environment variables — the node calls them project secrets (ainize-node `src/project-routes.ts`,
 * "secrets"). Sealed at rest, delivered to the project's container and its script runs as env, and never read back:
 * the console sees names and when each was set, the way Vercel shows a sensitive variable.
 *
 *   GET    /api/projects/:id/secrets                     → { secrets: [{ name, updatedAt }], declared, missing }
 *   PUT    /api/projects/:id/secrets/:name  { value, redeploy?: { deploymentId, sha } } → 201 | 200 { name, updatedAt, created, redeploy }
 *   DELETE /api/projects/:id/secrets/:name  { redeploy?: { deploymentId, sha } } → { ok, name, redeploy }
 *
 * Who: the owner, or a member of the project's organization with the write role; any other member gets 403
 * `not_writer`, everyone else 404. `declared` is what the newest deployment's ainize.json lists under `secrets`;
 * `missing` the declared names not set yet.
 *
 * What is here is what tests can hold still: the node's rules (name, reserved names, one line, 32 KiB, 64 per
 * project) checked before the request, the `.env` paste parser and the plan it turns into, the request shapes, the
 * error codes, and the sequential save the bulk paste uses.
 */
import type { Redeployed } from './projects';
import { projectRedeployReceipt } from '../lib/projectRedeploy';

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
export interface ProjectSecretsResponse { secrets: ProjectSecret[]; declared: string[]; missing: string[] }
export interface SecretSaved { name: string; updatedAt: number | null; created: boolean; redeploy: Redeployed | null }
export interface SecretRemoved { ok: boolean; name: string; redeploy: Redeployed | null }

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const names = (v: unknown): v is string[] => Array.isArray(v) && v.length <= SECRETS_MAX
  && v.every(n => typeof n === 'string' && SECRET_NAME.test(n)) && new Set(v).size === v.length;
export const declaredSecretNames = (raw: unknown): string[] | null => names(raw) ? [...raw] : null;
/** Reviewed source carried with the write. No secret value is retained here. */
export interface SecretRedeployTarget { projectId: string; deploymentId: string; sha: string }
const queuedOf = (v: unknown, expected?: SecretRedeployTarget | false): Redeployed | null => {
  if (!expected) {
    if (v !== null) throw new Error('unconfirmed_secret_mutation');
    return null;
  }
  if (!projectRedeployReceipt(v, { id: expected.deploymentId, projectId: expected.projectId, sha: expected.sha }))
    throw new Error('unconfirmed_secret_mutation');
  const r = v as Redeployed;
  return { deploymentId: r.deploymentId, status: r.status, projectId: r.projectId, redeployOf: r.redeployOf, sha: r.sha };
};

/** A malformed or contradictory snapshot cannot become an empty editable project. Never copy secret values. */
export function readProjectSecretsResponse(raw: unknown): ProjectSecretsResponse | null {
  if (!object(raw) || !Array.isArray(raw.secrets) || raw.secrets.length > SECRETS_MAX || !names(raw.declared)) return null;
  const seen = new Set<string>();
  const secrets: ProjectSecret[] = [];
  for (const row of raw.secrets) {
    if (!object(row) || typeof row.name !== 'string' || !SECRET_NAME.test(row.name) || seen.has(row.name)
      || row.updatedAt !== null && (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt) || row.updatedAt < 0)) return null;
    seen.add(row.name);
    secrets.push({ name: row.name, updatedAt: row.updatedAt as number | null });
  }
  const missing = raw.declared.filter(n => !seen.has(n));
  // Older nodes may omit the derived field; a supplied field must agree with the complete names snapshot.
  if (raw.missing !== undefined && (!names(raw.missing) || raw.missing.length !== missing.length || raw.missing.some(n => !missing.includes(n)))) return null;
  return { secrets: secrets.sort((a, b) => a.name.localeCompare(b.name)), declared: [...raw.declared], missing };
}

export function parseProjectSecretsResponse(raw: unknown): ProjectSecretsResponse {
  const result = readProjectSecretsResponse(raw);
  if (!result) throw new Error('invalid_project_secrets');
  return result;
}
type SecretExpected = { name: string; redeploy?: SecretRedeployTarget | false };
export function parseSecretSaved(raw: unknown, expected?: SecretExpected): SecretSaved {
  if (!object(raw) || typeof raw.name !== 'string' || !SECRET_NAME.test(raw.name) || typeof raw.created !== 'boolean'
    || typeof raw.updatedAt !== 'number' || !Number.isFinite(raw.updatedAt) || raw.updatedAt < 0
    || expected && (raw.name !== expected.name || !expected.redeploy && raw.redeploy !== null)) throw new Error('unconfirmed_secret_mutation');
  return { name: raw.name, updatedAt: raw.updatedAt, created: raw.created, redeploy: queuedOf(raw.redeploy, expected?.redeploy) };
}
export function parseSecretRemoved(raw: unknown, expected?: SecretExpected): SecretRemoved {
  if (!object(raw) || raw.ok !== true || typeof raw.name !== 'string' || !SECRET_NAME.test(raw.name)
    || expected && (raw.name !== expected.name || !expected.redeploy && raw.redeploy !== null)) throw new Error('unconfirmed_secret_mutation');
  return { ok: true, name: raw.name, redeploy: queuedOf(raw.redeploy, expected?.redeploy) };
}

/** One row of the table: a variable that is set, or one ainize.json declares and nobody has set. */
export interface EnvRow { name: string; updatedAt: number | null; set: boolean; declared: boolean }
export function envRowsOf(r: ProjectSecretsResponse): EnvRow[] {
  const rows: EnvRow[] = r.secrets.map((s) => ({ name: s.name, updatedAt: s.updatedAt, set: true, declared: r.declared.includes(s.name) }));
  for (const n of r.missing) if (!rows.some((x) => x.name === n)) rows.push({ name: n, updatedAt: null, set: false, declared: true });
  // The missing ones first: they are what keeps the app from starting.
  return rows.sort((a, b) => Number(a.set) - Number(b.set) || a.name.localeCompare(b.name));
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
const redeployBody = (projectId: string, target?: SecretRedeployTarget | false) => {
  if (!target) return {};
  if (target.projectId !== projectId || !/^[A-Za-z0-9_-]{1,128}$/.test(target.deploymentId) || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(target.sha))
    throw new Error('invalid_redeploy_target');
  return { redeploy: { deploymentId: target.deploymentId, sha: target.sha } };
};
export function secretPutRequest(projectId: string, name: string, value: string, redeploy?: SecretRedeployTarget | false) {
  return { url: `${base(projectId)}/${encodeURIComponent(name)}`, method: 'PUT' as const, body: { value, ...redeployBody(projectId, redeploy) } };
}
export function secretDeleteRequest(projectId: string, name: string, redeploy?: SecretRedeployTarget | false) {
  return { url: `${base(projectId)}/${encodeURIComponent(name)}`, method: 'DELETE' as const, ...(redeploy ? { body: redeployBody(projectId, redeploy) } : {}) };
}

export interface BulkSaveResult { saved: SecretSaved[]; failed: { name: string; error: unknown } | null; redeploy: Redeployed | null }

/**
 * Save rows one after another (the node has no batch write). The reviewed target rides on the LAST write only.
 * A concurrent deployment must not change which commit the sequence asks to redeploy. The first refusal stops the run — what was saved stays saved, and
 * no redeploy is asked for, since the set is incomplete.
 */
export async function saveSecretsSequentially(
  rows: readonly { name: string; value: string }[],
  put: (name: string, value: string, redeploy: SecretRedeployTarget | false) => Promise<SecretSaved>,
  opts: { redeployLast?: SecretRedeployTarget | false; onProgress?: (done: number, total: number) => void; isActive?: () => boolean } = {},
): Promise<BulkSaveResult> {
  const target = opts.redeployLast ? { ...opts.redeployLast } : false;
  const saved: SecretSaved[] = [];
  let redeploy: Redeployed | null = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const last = i === rows.length - 1;
    try {
      if (opts.isActive && !opts.isActive()) throw new Error('environment_view_left');
      const s = parseSecretSaved(await put(r.name, r.value, last ? target : false), { name: r.name, redeploy: last ? target : false });
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
  | 'project_deleting' | 'not_yet_cloned' | 'invalid_redeploy_target' | 'redeploy_target_changed' | 'secret_mutation_outcome_unknown' | 'redeploy_outcome_unknown'
  | 'too_many_secrets' | 'invalid_request' | 'not_member' | 'forbidden' | 'network' | 'unknown';
export const SECRET_ERROR_CODES: readonly SecretErrorCode[] = [
  'not_signed_in', 'not_writer', 'not_found', 'secrets_off', 'invalid_name', 'reserved_name', 'invalid_value', 'value_too_large',
  'project_deleting', 'not_yet_cloned', 'invalid_redeploy_target', 'redeploy_target_changed', 'secret_mutation_outcome_unknown', 'redeploy_outcome_unknown',
  'too_many_secrets', 'invalid_request', 'not_member', 'forbidden', 'network', 'unknown',
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
  if (q.error) {
    const e = secretApiErrorOf(q.error);
    if (e.code === 'not_writer' || e.code === 'forbidden') return 'reader';
    if (e.code === 'secrets_off') return 'off';
    if (e.code === 'not_found' || e.code === 'not_signed_in') return 'hidden';
    return 'error';
  }
  if (q.data !== undefined) return readProjectSecretsResponse(q.data) ? 'writer' : 'error';
  return q.isLoading ? 'loading' : 'error';
}
