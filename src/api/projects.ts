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

export interface Project {
  id: string;
  org: string;
  repoName: string;
  repo: string;
  branch: string;
  kind: ProjectKind | null;
  entry: string | null;
  name: string;
  status: ProjectStatus;
  owner: string;
  url: string;
  pageUrl: string;
  hookUrl: string;
  lastDeploymentId: string | null;
  createdAt: number;
  updatedAt: number;
}

/** `POST /api/projects` — the secret appears here and nowhere else, once. */
export interface ProjectCreated extends Project { webhookSecret: string; hasDeployToken: boolean }

export interface ProjectCreateInput { repo: string; branch?: string; name?: string; deployToken?: string }

export interface Deployment {
  id: string;
  projectId: string;
  sha: string;
  ref: string;
  status: DeploymentStatus;
  kind?: ProjectKind;
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

export const AINDRIVE_URL = 'https://aindrive.ainetwork.ai';

export type ProjectApiErrorCode = 'not_signed_in' | 'invalid_request' | 'repo_taken' | 'limit' | 'not_found' | 'network' | 'unknown';
export interface ProjectApiError { status: number | null; code: ProjectApiErrorCode; message: string | null }

const KNOWN: readonly ProjectApiErrorCode[] = ['not_signed_in', 'invalid_request', 'repo_taken', 'limit', 'not_found'];

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
