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

/** The node's answer, with anything malformed dropped rather than rendered. */
export function parseRuntimeLogs(raw: unknown): RuntimeLogs {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lines = Array.isArray(r.lines) ? r.lines : [];
  return {
    projectId: str(r.projectId),
    deploymentId: str(r.deploymentId),
    sha: str(r.sha),
    placement: r.placement === 'peer' ? 'peer' : 'local',
    tail: typeof r.tail === 'number' ? r.tail : RUNTIME_LOG_DEFAULT_TAIL,
    fetchedAt: typeof r.fetchedAt === 'number' ? r.fetchedAt : Date.now(),
    truncated: r.truncated === true,
    lines: lines.flatMap((l): RuntimeLogLine[] => {
      const x = (l ?? {}) as Record<string, unknown>;
      if (typeof x.text !== 'string') return [];
      return [{ ts: typeof x.ts === 'string' ? x.ts : null, stream: x.stream === 'stderr' ? 'stderr' : 'stdout', text: x.text }];
    }),
  };
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
