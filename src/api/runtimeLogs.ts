/**
 * A project's runtime logs — what its RUNNING service/nextjs container prints to stdout/stderr, wherever the node
 * placed it (on the node itself or on a deployment peer). ainize-node docs/PROJECTS.md "Runtime logs":
 *
 *   GET /api/projects/:id/runtime-logs?tail=200[&since=<RFC 3339>]
 *     → { projectId, deploymentId, sha, placement: 'local'|'peer', tail, since?, fetchedAt,
 *         lines: [{ ts, stream: 'stdout'|'stderr', text }], truncated }
 *
 * Owner and active members of the project's organization only: 401 `sign_in_required` anonymous, 403 `not_member` an
 * outsider of a public project, 404 for an org-private one (or `not_running`), 502 `logs_unavailable` when the node
 * running it did not answer. The deployment log (`/api/deployments/:id/log`) is the build; this is the app.
 *
 * What is here is what tests can hold still: the defensive parse of the answer, the text a download gets, and which
 * message an error turns into.
 */

export interface RuntimeLogLine { ts: string | null; stream: 'stdout' | 'stderr'; text: string }
export interface RuntimeLogs {
  projectId: string;
  deploymentId: string;
  sha: string;
  placement: 'local' | 'peer';
  tail: number;
  fetchedAt: number;
  lines: RuntimeLogLine[];
  truncated: boolean;
}

/** The tail sizes the Logs tab offers; the node caps at 1000. */
export const RUNTIME_LOG_TAILS = [100, 200, 500, 1000] as const;
export const RUNTIME_LOG_DEFAULT_TAIL = 200;
/** How often the tab asks again while "Follow" is on. */
export const RUNTIME_LOG_POLL_MS = 3000;

export const runtimeLogsUrl = (id: string, tail: number) => `api/projects/${encodeURIComponent(id)}/runtime-logs?tail=${Math.max(1, Math.min(1000, Math.floor(tail)))}`;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v === v.trim();

/** Unknown placement, timestamps or omitted lines are unavailable evidence, not a fresh empty local log. */
export function readRuntimeLogs(raw: unknown, expected?: { id: string; tail: number }): RuntimeLogs | null {
  if (!object(raw) || !id(raw.projectId) || !id(raw.deploymentId)
    || typeof raw.sha !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(raw.sha)
    || !['local', 'peer'].includes(typeof raw.placement === 'string' ? raw.placement : '')
    || typeof raw.tail !== 'number' || !Number.isInteger(raw.tail) || raw.tail < 1 || raw.tail > 1000
    || typeof raw.fetchedAt !== 'number' || !Number.isFinite(raw.fetchedAt) || raw.fetchedAt < 0
    || typeof raw.truncated !== 'boolean' || !Array.isArray(raw.lines) || raw.lines.length > raw.tail
    || expected && (raw.projectId !== expected.id || raw.tail !== expected.tail)) return null;
  const lines: RuntimeLogLine[] = [];
  for (const row of raw.lines) {
    if (!object(row) || typeof row.text !== 'string' || row.text.length > 8192
      || row.stream !== 'stdout' && row.stream !== 'stderr'
      || row.ts !== null && (typeof row.ts !== 'string' || row.ts.length > 64 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(row.ts) || !Number.isFinite(Date.parse(row.ts)))) return null;
    lines.push({ ts: row.ts as string | null, stream: row.stream, text: row.text });
  }
  return { projectId: raw.projectId, deploymentId: raw.deploymentId, sha: raw.sha, placement: raw.placement as 'local' | 'peer',
    tail: raw.tail, fetchedAt: raw.fetchedAt, truncated: raw.truncated, lines };
}

export function parseRuntimeLogs(raw: unknown, expected?: { id: string; tail: number }): RuntimeLogs {
  const result = readRuntimeLogs(raw, expected);
  if (!result) throw new Error('invalid_runtime_logs');
  return result;
}

/** A response from a different active version must not be labelled as this version's current output. */
export function runtimeLogsMatchDeployment(logs: RuntimeLogs, project: { activeDeploymentId?: string | null; activeCommit?: string | null }): boolean {
  return (!project.activeDeploymentId || logs.deploymentId === project.activeDeploymentId)
    && (!project.activeCommit || logs.sha === project.activeCommit);
}

/** `HH:MM:SS` in the viewer's time zone; the full instant is the line's title. */
export function logTime(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour12: false });
}

/** What Download saves: one line per log line, `<timestamp> <stream> <text>`. */
export function runtimeLogsText(lines: RuntimeLogLine[]): string {
  return lines.map((l) => `${l.ts ?? ''} ${l.stream} ${l.text}`.trimStart()).join('\n') + (lines.length ? '\n' : '');
}

export type RuntimeLogProblem = 'sign_in' | 'not_member' | 'not_running' | 'unavailable';

/** Which message an RTK Query rejection of the runtime-logs request turns into. */
export function runtimeLogProblemOf(err: unknown): RuntimeLogProblem {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  const code = str(((e.data as { error?: { code?: unknown } } | null | undefined)?.error ?? {}).code);
  if (status === 401 || code === 'sign_in_required') return 'sign_in';
  if (status === 403 || code === 'not_member') return 'not_member';
  if (code === 'not_running') return 'not_running';
  return 'unavailable';
}
