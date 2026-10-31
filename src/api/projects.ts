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
export interface ManifestRun { entry: string; name?: string; description?: string; runtime?: string; inputs?: Record<string, ManifestInput>; examples?: ManifestExample[] }
/** What the newest deployment read out of the repo's `ainize.json` (the node snapshots it; no clone on the page). */
export interface ProjectManifest {
  kind: ProjectKind;
  name?: string;
  entry?: string;
  runtime?: string;
  timeoutMs?: number;
  /** The NAMES of `ainize.json`'s env — the node never reads the values back through a page (`env` is an older node's). */
  envKeys?: string[];
  env?: Record<string, string>;
  /** The NAMES of the project's environment variables the code expects (`secrets`); values are set in the console. */
  secrets?: string[];
  inputs: Record<string, ManifestInput>;
  examples: ManifestExample[];
  run?: ManifestRun[];
  detected: 'ainize.json' | 'package.json';
}

export interface ProjectSource { repoId: string; target: 'head' | 'commit' | 'deployed'; sha: string; sourcePath: string; manifest: ProjectManifest }

/**
 * A project as the node answers it (ainize-node docs/PROJECTS.md "Who sees what"): a public project reads to anyone; an
 * org-private one (`visibility: 'org'` — its repository's org slug is an organization's) only to that organization's
 * active members, and is 404 to anyone else. `owner` and `hookUrl` arrive for the owner only; `canManage` (delete,
 * rotate) and `canOperate` (run, redeploy) say what the signed-in caller may do here.
 */
export interface Project {
  deletionRequestedAt?: number;
  id: string;
  org: string;
  repoName: string;
  repo: string;
  upstreamRepo?: string | null;
  publicPreview?: boolean;
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
  visibility?: 'org' | 'public';
  owner?: string;
  /** Who pushed it, when aindrive bound it for an organization (`owner: 'org:<id>'`). */
  createdBy?: string;
  url: string;
  pageUrl: string;
  hookUrl?: string;
  lastDeploymentId: string | null;
  lastDeployment?: Deployment | null;
  manifest?: ProjectManifest | null;
  runnable?: string[];
  canManage?: boolean;
  canOperate?: boolean;
  /** Where the project lives on aindrive (ainize-node docs/PROJECTS.md "Where the data lives"); an older node omits it. */
  aindrive?: ProjectAindrive | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * The repository's drive page, and — owner and members, once the durable log store was set up on a node that has one —
 * the drive folder `app-data/<id>/` the project's logs are written to, with ready-made links into it.
 */
export interface ProjectAindrive {
  repo: { url: string };
  logStore?: { driveId: string; basePath: string; urls: { base?: string; logs: string; transcriptsToday: string; state: string } } | null;
}

/** One link of the AinDrive block: which folder (an i18n key under `projects.aindrive.`), the path as text, the drive URL. */
export interface AindriveLink { key: 'logs' | 'transcripts_today' | 'state'; path: string; url: string }

/** The log-store links the AinDrive block lists, each with the path it opens (`app-data/<id>/logs/…`) read back off the URL. */
export function aindriveLinksOf(a: ProjectAindrive | null | undefined): AindriveLink[] {
  const store = a?.logStore;
  if (!store || typeof store.basePath !== 'string' || !store.urls) return [];
  const pathOf = (url: string) => {
    try { const segs = new URL(url).pathname.split('/').slice(1).map(decodeURIComponent); const i = segs.indexOf('app-data'); return i >= 0 ? segs.slice(i).join('/') + '/' : store.basePath; }
    catch { return store.basePath; }
  };
  const rows: AindriveLink[] = [];
  for (const [key, url] of [['logs', store.urls.logs], ['transcripts_today', store.urls.transcriptsToday], ['state', store.urls.state]] as const) {
    if (typeof url === 'string' && /^https:\/\//.test(url)) rows.push({ key, path: pathOf(url), url });
  }
  return rows;
}

/**
 * Where the "Code" action opens the project's repository to edit: the ainize.ai/code workspace's `_aincode/open`
 * route with the repo URL — under `/code/org/<org>/` for an organization's project (the node says `visibility: 'org'`,
 * or the owner is the organization), under `/code/` for a personal one. The workspace itself decides who may open it.
 */
export function codeWorkspaceUrlOf(p: Pick<Project, 'org' | 'repo'> & Partial<Pick<Project, 'visibility' | 'owner'>>): string {
  const isOrg = p.visibility === 'org' || (typeof p.owner === 'string' && p.owner.startsWith('org:'));
  const base = isOrg ? `/code/org/${encodeURIComponent(p.org)}` : '/code';
  return `${base}/_aincode/open?repo=${encodeURIComponent(p.repo)}`;
}

/** `POST /api/projects` — the secret appears here and nowhere else, once. */
export interface ProjectCreated extends Project { owner: string; hookUrl: string; webhookSecret: string; hasDeployToken: boolean }

export interface ProjectCreateInput { repo: string; branch?: string; name?: string; deployToken?: string }

export type DeploymentTrigger = 'push' | 'redeploy' | 'run';

export interface Deployment {
  placement?: { address: string; endpoint: string; local: boolean; score: number; gpuUuids: string[]; reason: string } | null;
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
  /**
   * `run` only: what it was started with — the entry, and the NAMES of its inputs and env. The values may be a person's
   * secrets and are never read back (`inputs` / `env` are an older node's answer).
   */
  entry?: string | null;
  target?: 'head' | 'commit' | 'deployed';
  inputKeys?: string[];
  envKeys?: string[];
  inputs?: Record<string, string>;
  env?: Record<string, string>;
  /** Who pushed or pressed Run — a subject; the node no longer sends an email (`email` is an older node's). */
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
  // A monorepo folder's project is its own row, `<repo>/<folder>` — never the repository's row, which is the root's.
  for (const p of projects) {
    const name = p.sourcePath ? `${p.repoName}/${p.sourcePath}` : p.repoName;
    const k = name.toLowerCase();
    const row = rows.get(k);
    if (row) { if (!row.project) row.project = p; }
    else rows.set(k, { name, project: p, repo: null });
  }
  const when = (r: OrgRepoRow) => Math.max(r.project?.updatedAt ?? 0, r.repo?.updatedAt ?? 0);
  return [...rows.values()].sort((a, b) => when(b) - when(a) || a.name.localeCompare(b.name));
}

/** The one-line inputs form: a manifest input's answer as text, from the person's answer or the input's default. */
export function inputAnswers(inputs: Record<string, ManifestInput>, answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, spec] of Object.entries(inputs)) {
    const v = Object.hasOwn(answers, name) ? answers[name] : undefined;
    const value = v !== undefined ? v : spec.default !== undefined ? String(spec.default) : undefined;
    if (value !== undefined) Object.defineProperty(out, name, { value, enumerable: true, writable: true, configurable: true });
  }
  return out;
}
/** Which required inputs are still blank. */
export function missingInputs(inputs: Record<string, ManifestInput>, answers: Record<string, string>): string[] {
  const filled = inputAnswers(inputs, answers);
  return Object.entries(inputs).filter(([name, spec]) => spec.required && (!Object.hasOwn(filled, name) || !filled[name].trim())).map(([name]) => name);
}
/** The input that may offer model suggestions: a `choice` or a `string` whose name says "model", without its own options. */
export const isModelInput = (name: string, spec: ManifestInput): boolean => /^(?:[a-z0-9]+_)*model(?:_id|_name)?$/i.test(name) && !spec.options?.length && (spec.type ?? 'string') !== 'boolean' && (spec.type ?? 'string') !== 'number';

/** Defaults are actual displayed values; explicitly cleared values never silently restore them. */
export const projectInputValue = (spec: ManifestInput, answer: string | undefined): string => answer ?? (spec.default === undefined ? '' : String(spec.default));
const projectNumber = (value: string): boolean => /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(value) && Number.isFinite(Number(value));
export function invalidInputs(inputs: Record<string, ManifestInput>, answers: Record<string, string>): string[] {
  return Object.entries(inputs).filter(([name, spec]) => {
    const value = projectInputValue(spec, Object.hasOwn(answers, name) ? answers[name] : undefined);
    if (!value) return false; // Required blanks are reported separately.
    if (spec.options?.length && !spec.options.includes(value)) return true;
    if (spec.type === 'boolean') return value !== 'true' && value !== 'false';
    if (spec.type === 'number') return !projectNumber(value);
    return false;
  }).map(([name]) => name);
}

/** The Run panel's extra env: `KEY=value` lines → env; a line without `=` or with a bad name is skipped. */
export function parseEnvLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (m) Object.defineProperty(out, m[1]!, { value: m[2]!.trim(), enumerable: true, writable: true, configurable: true });
  }
  return out;
}

/** Line numbers that would otherwise be silently ignored or overwrite an earlier assignment. */
export function projectRunEnvIssues(text: string): number[] {
  const seen = new Set<string>(), invalid: number[] = [];
  text.split('\n').forEach((line, i) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return;
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (!match || seen.has(match[1])) invalid.push(i + 1);
    if (match) seen.add(match[1]);
  });
  return invalid;
}
export function projectRunTimeout(seconds: string): number | null | undefined {
  if (!seconds.trim()) return undefined;
  const n = Number(seconds);
  return projectNumber(seconds) && n >= 1 && n <= 300 && Number.isSafeInteger(n * 1000) ? n * 1000 : null;
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

export interface AppDomain { hostname: string; projectId: string; token: string; status: 'pending' | 'invalid' | 'verified' | 'ready' | 'error'; message: string; createdAt: number; checkedAt: number | null; managed?: boolean }
export interface AppDomainsResponse { domains: AppDomain[]; addresses: string[]; cname: string; managedBase?: string }
