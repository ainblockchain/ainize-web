/**
 * Projects — a git repository in an aindrive drive, deployed by this node on every push (ainize-node
 * `docs/PROJECTS.md`). The node keeps no repository; it binds a repo URL + branch, aindrive calls the project's push
 * hook, and `ainize.json` in the repo says what to build. These are the wire shapes and the two pieces of logic
 * the pages need and tests can hold still: reading the node's error, and handing the one-time webhook secret back to
 * aindrive ("Connect to ainize", aindrive#206).
 */

export type ProjectKind = 'nextjs' | 'service' | 'script' | 'agent';
export type DeploymentStatus = 'queued' | 'building' | 'ready' | 'error';
export type ProjectStatus = 'idle' | DeploymentStatus;

/** One `ainize.json` input, the GitHub `workflow_dispatch` shape (ainize-node project-manifest.ts). */
export interface ManifestInput { description?: string; type?: 'string' | 'choice' | 'boolean' | 'number'; required?: boolean; options?: string[]; default?: string | number | boolean }
/** A named preset of inputs (`examples` in ainize.json) — one click in the Run panel. */
export interface ManifestExample { name: string; description?: string; inputs: Record<string, string | number | boolean> }
/** What the newest deployment read out of the repo's `ainize.json` (the node snapshots it; no clone on the page). */
export interface ProjectManifest {
  kind: ProjectKind;
  name?: string;
  entry?: string;
  runtime?: string;
  timeoutMs?: number;
  env: Record<string, string>;
  inputs: Record<string, ManifestInput>;
  examples: ManifestExample[];
  detected: 'ainize.json' | 'package.json';
}

export interface ProjectSource { repoId: string; target: 'head' | 'commit' | 'deployed'; sha: string; sourcePath: string; manifest: ProjectManifest }

/**
 * A project as the node answers it. Reading is public (ainize-node docs/PROJECTS.md "Who sees what"): `owner` and
 * `hookUrl` arrive for the owner only; `canManage` (delete, rotate) and `canOperate` (run, redeploy) say what the
 * signed-in caller may do here.
 */
export interface Project {
  id: string;
  org: string;
  repoName: string;
  repo: string;
  branch: string;
  repoId?: string;
  sourcePath?: string;
  sourceCommit?: string | null;
  activeCommit?: string | null;
  activeDeploymentId?: string | null;
  kind: ProjectKind | null;
  entry: string | null;
  name: string;
  status: ProjectStatus;
  owner?: string;
  url: string;
  pageUrl: string;
  hookUrl?: string;
  lastDeploymentId: string | null;
  lastDeployment?: Deployment | null;
  manifest?: ProjectManifest | null;
  runnable?: string[];
  canManage?: boolean;
  canOperate?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** `POST /api/projects` — the secret appears here and nowhere else, once. */
export interface ProjectCreated extends Project { owner: string; hookUrl: string; webhookSecret: string; hasDeployToken: boolean }

export interface ProjectCreateInput { repo: string; branch?: string; name?: string; deployToken?: string }

export type DeploymentTrigger = 'push' | 'redeploy' | 'run';

export interface Deployment {
  id: string;
  projectId: string;
  sha: string;
  ref: string;
  status: DeploymentStatus;
  kind?: ProjectKind;
  /** push (aindrive's hook), redeploy (a person, of an earlier commit), run (an ad-hoc run from the console). */
  trigger: DeploymentTrigger;
  /** The commit's subject line. */
  subject?: string;
  /** `run` only: what it was started with. */
  entry?: string | null;
  target?: 'head' | 'commit' | 'deployed';
  inputs?: Record<string, string>;
  env?: Record<string, string>;
  pusher: { subject: string; email?: string } | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  ms: number | null;
  exitCode?: number;
  error?: string;
  logUrl: string;
  outputUrl?: string;
}

export interface ProjectsResponse { projects: Project[] }
export interface DeploymentsResponse { deployments: Deployment[] }
export interface RunsResponse { runs: Deployment[] }
export interface OrgProjectsResponse { org: string; projects: Project[] }
/** One repo of the drive's `repositories/` folder as aindrive lists it (through the node, `GET /api/orgs/:org/repositories`). */
export interface OrgRepository { name: string; cloneUrl: string; headSha: string | null; headSubject: string | null; updatedAt: number; hasManifest: boolean }
export interface OrgRepositoriesResponse { org: string; known: boolean; driveId: string | null; driveUrl: string | null; repositories: OrgRepository[] }
/** `POST /api/projects/:id/runs`. */
export interface RunInput { target?: 'head' | 'commit' | 'deployed'; sha?: string; entry?: string; inputs?: Record<string, string | number | boolean>; env?: Record<string, string>; timeoutMs?: number }
export interface Queued { deploymentId: string; status: DeploymentStatus; runId?: string }
export interface RotatedSecret { id: string; webhookSecret: string; hookUrl: string }

/**
 * The `/<org>` page shows the drive's repositories beside the projects bound here, one row per repo: a project row
 * when the repo is bound (its status, its page), a plain row ("not deployed yet · push to deploy") when aindrive has
 * it and this node does not. Matched by name, case-insensitively; a project whose repo aindrive no longer lists
 * still shows (it is still deployed here).
 */
export interface OrgRepoRow { name: string; project: Project | null; repo: OrgRepository | null }
export function mergeOrgRepos(projects: Project[], repos: OrgRepository[]): OrgRepoRow[] {
  const rows = new Map<string, OrgRepoRow>();
  for (const r of repos) rows.set(r.name.toLowerCase(), { name: r.name, project: null, repo: r });
  for (const p of projects) {
    const k = p.repoName.toLowerCase();
    const row = rows.get(k);
    if (row) { if (!row.project) row.project = p; }
    else rows.set(k, { name: p.repoName, project: p, repo: null });
  }
  const when = (r: OrgRepoRow) => Math.max(r.project?.updatedAt ?? 0, r.repo?.updatedAt ?? 0);
  return [...rows.values()].sort((a, b) => when(b) - when(a) || a.name.localeCompare(b.name));
}

/** The one-line inputs form: a manifest input's answer as text, from the person's answer or the input's default. */
export function inputAnswers(inputs: Record<string, ManifestInput>, answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, spec] of Object.entries(inputs)) {
    const v = answers[name];
    if (v !== undefined && v !== '') out[name] = v;
    else if (spec.default !== undefined) out[name] = String(spec.default);
  }
  return out;
}
/** Which required inputs are still blank. */
export function missingInputs(inputs: Record<string, ManifestInput>, answers: Record<string, string>): string[] {
  const filled = inputAnswers(inputs, answers);
  return Object.entries(inputs).filter(([name, spec]) => spec.required && !(name in filled)).map(([name]) => name);
}
/** The input a model picker should drive: a `choice` or a `string` whose name says "model", without its own options. */
export const isModelInput = (name: string, spec: ManifestInput): boolean => /model/i.test(name) && !spec.options?.length && (spec.type ?? 'string') !== 'boolean' && (spec.type ?? 'string') !== 'number';

/** The Run panel's extra env: `KEY=value` lines → env; a line without `=` or with a bad name is skipped. */
export function parseEnvLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]!] = m[2]!.trim();
  }
  return out;
}

/** "3 minutes ago" — the console's relative times; the exact time stays in the title. */
export function relativeTime(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return '';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 36) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  const mo = Math.round(d / 30); if (mo < 18) return `${mo}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

export const AINDRIVE_URL = 'https://aindrive.ainetwork.ai';

export type ProjectApiErrorCode = 'not_signed_in' | 'invalid_request' | 'repo_taken' | 'limit' | 'not_found' | 'not_member' | 'not_a_script' | 'aindrive_off' | 'network' | 'unknown';
export interface ProjectApiError { status: number | null; code: ProjectApiErrorCode; message: string | null }

const KNOWN: readonly ProjectApiErrorCode[] = ['not_signed_in', 'invalid_request', 'repo_taken', 'limit', 'not_found', 'not_member', 'not_a_script', 'aindrive_off'];

/** The node's `{ error: { code, message } }` out of an RTK Query rejection; a dead connection is `network`. */
export function projectApiErrorOf(err: unknown): ProjectApiError {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown; error?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  const inner = ((e.data as { error?: unknown } | null | undefined)?.error ?? null) as { code?: unknown; message?: unknown } | string | null;
  if (inner && typeof inner === 'object') {
    const code = typeof inner.code === 'string' ? inner.code : '';
    return { status, code: (KNOWN as readonly string[]).includes(code) ? (code as ProjectApiErrorCode) : 'unknown', message: typeof inner.message === 'string' ? inner.message : null };
  }
  if (e.status === 'FETCH_ERROR') return { status: null, code: 'network', message: null };
  if (status === 401) return { status, code: 'not_signed_in', message: null };
  if (status === 404) return { status, code: 'not_found', message: null };
  return { status, code: 'unknown', message: typeof inner === 'string' ? inner : null };
}

/**
 * The query string aindrive's "Connect to ainize" opens this app with: `/projects/new?repo=<cloneUrl>&driveId=<id>
 * &returnTo=<drive page url>`. `returnTo` is honoured only on aindrive's own origin (or a path of this app) — a
 * redirect target from a query string is otherwise an open door to anywhere.
 */
export interface ConnectParams { repo: string | null; driveId: string | null; returnTo: string | null }

export function connectParamsOf(search: string, aindriveOrigin = AINDRIVE_URL): ConnectParams {
  const q = new URLSearchParams(search);
  const repo = q.get('repo')?.trim() || null;
  const driveId = q.get('driveId')?.trim() || null;
  const raw = q.get('returnTo')?.trim() || null;
  let returnTo: string | null = null;
  if (raw) {
    if (raw.startsWith('/') && !raw.startsWith('//')) returnTo = raw;
    else {
      try { const u = new URL(raw); if (u.origin === aindriveOrigin) returnTo = u.href; } catch { /* not a URL */ }
    }
  }
  return { repo, driveId, returnTo };
}

/** Is this an aindrive git URL the node will accept? (`/<org>/git/<repo>` or `/api/drives/<id>/git/<path>`, https.) */
export function repoUrlLooksRight(repo: string): boolean {
  try {
    const u = new URL(repo);
    if (u.username || u.password) return false;
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(u.hostname))) return false;
    const segs = u.pathname.split('/').filter(Boolean);
    const at = segs.indexOf('git');
    return at >= 1 && at < segs.length - 1;
  } catch { return false; }
}

/** The repo's org/name as the node will read them — for the page's heading before the node has answered. */
export function repoLabelOf(repo: string): string {
  try {
    const segs = new URL(repo).pathname.split('/').filter(Boolean).map(decodeURIComponent);
    const at = segs.indexOf('git');
    if (at < 1 || at === segs.length - 1) return repo;
    const org = segs[0] === 'api' && segs[1] === 'drives' && segs[2] ? segs[2] : segs[at - 1]!;
    return `${org}/${segs[segs.length - 1]!.replace(/\.git$/, '')}`;
  } catch { return repo; }
}

/**
 * Hand the one-time secret to aindrive, which stores it beside the repo's hook: `POST
 * /api/drives/<driveId>/git-connect { repo, projectId, webhookSecret }` with the person's aindrive session
 * (`credentials: include`; aindrive answers CORS for this app's origin). The result says whether aindrive took it —
 * when it did not, the page shows the secret so the person can paste it, because it will never be shown again.
 */
export async function connectRepoOnAindrive(input: { driveId: string; repo: string; projectId: string; webhookSecret: string }, opts: { aindriveUrl?: string; fetchImpl?: typeof fetch } = {}): Promise<{ ok: true } | { ok: false; status: number | null; message: string }> {
  const base = (opts.aindriveUrl ?? AINDRIVE_URL).replace(/\/+$/, '');
  const f = opts.fetchImpl ?? fetch;
  try {
    const res = await f(`${base}/api/drives/${encodeURIComponent(input.driveId)}/git-connect`, {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ repo: input.repo, projectId: input.projectId, webhookSecret: input.webhookSecret }),
    });
    if (res.ok) return { ok: true };
    let message = `aindrive answered ${res.status}`;
    try { const j = (await res.json()) as { error?: { message?: string } | string; message?: string }; message = (typeof j.error === 'object' ? j.error?.message : j.error) ?? j.message ?? message; } catch { /* no body */ }
    return { ok: false, status: res.status, message };
  } catch (e) {
    return { ok: false, status: null, message: (e as Error).message };
  }
}

export const statusToneOf = (s: ProjectStatus | DeploymentStatus): 'ok' | 'warn' | 'busy' | 'muted' =>
  s === 'ready' ? 'ok' : s === 'error' ? 'warn' : s === 'building' || s === 'queued' ? 'busy' : 'muted';

export const shortSha = (sha: string) => sha.slice(0, 7);

export function durationLabel(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
