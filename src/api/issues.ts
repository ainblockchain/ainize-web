/**
 * Issues — what went wrong on the node, grouped by cause the way Sentry groups errors (ainize-node
 * src/project-issues.ts). One issue per fingerprint with first/last seen, a count, the last day as 24 hourly buckets
 * (the sparkline), a status a person sets and, in the detail view, the events behind it.
 *
 *   GET  /api/orgs/:id/issues?status=unresolved|resolved|ignored|all   → { issues: Issue[], counts }
 *   GET  /api/projects/:id/issues?status=                               → { issues: Issue[] }
 *   GET  /api/issues/:iid                                               → { issue: Issue & { events } }
 *   POST /api/issues/:iid/status { status }                             → { issue }
 *
 * What is here is pure and tested (test/issues-api.test.ts): the defensive parse, the grouping of rows the page
 * shows, the sparkline geometry and the words for each kind.
 */

export const ISSUE_STATUSES = ['unresolved', 'resolved', 'ignored'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export const ISSUE_KINDS = ['deploy_failed', 'run_failed', 'container_down', 'agent_unreachable', 'site_down', 'model_down', 'custom'] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

export interface IssueEvent { at: number; message: string; meta: Record<string, unknown> }

export interface Issue {
  id: string;
  orgId: string | null;
  projectId: string | null;
  kind: IssueKind;
  fingerprint: string;
  title: string;
  culprit: string;
  status: IssueStatus;
  firstSeen: number;
  lastSeen: number;
  count: number;
  statusChangedAt: number | null;
  statusChangedBy: string | null;
  /** events per hour over the last 24 hours, newest last */
  hourly: number[];
  /** detail view only, newest first */
  events: IssueEvent[];
}

export interface IssueCounts { unresolved: number; resolved: number; ignored: number }

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const nullable = (v: unknown) => (typeof v === 'string' ? v : null);
export const isIssueStatus = (v: unknown): v is IssueStatus => typeof v === 'string' && (ISSUE_STATUSES as readonly string[]).includes(v);
export const isIssueKind = (v: unknown): v is IssueKind => typeof v === 'string' && (ISSUE_KINDS as readonly string[]).includes(v);

/** One issue as the node sends it (snake_case); anything malformed becomes a safe default, never a crash. */
export function parseIssue(raw: unknown): Issue | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const hourly = Array.isArray(r.hourly) ? r.hourly.map((n) => Math.max(0, Math.floor(num(n)))) : [];
  const events = Array.isArray(r.events) ? r.events.flatMap((e): IssueEvent[] => {
    const x = (e ?? {}) as Record<string, unknown>;
    if (typeof x.at !== 'number') return [];
    return [{ at: x.at, message: str(x.message), meta: x.meta && typeof x.meta === 'object' ? (x.meta as Record<string, unknown>) : {} }];
  }) : [];
  return {
    id: r.id, orgId: nullable(r.org_id), projectId: nullable(r.project_id), kind: isIssueKind(r.kind) ? r.kind : 'custom',
    fingerprint: str(r.fingerprint), title: str(r.title) || str(r.fingerprint) || r.id, culprit: str(r.culprit),
    status: isIssueStatus(r.status) ? r.status : 'unresolved',
    firstSeen: num(r.first_seen), lastSeen: num(r.last_seen, num(r.first_seen)), count: Math.max(1, Math.floor(num(r.count, 1))),
    statusChangedAt: typeof r.status_changed_at === 'number' ? r.status_changed_at : null, statusChangedBy: nullable(r.status_changed_by),
    hourly: hourly.length === 24 ? hourly : [...new Array(Math.max(0, 24 - hourly.length)).fill(0), ...hourly].slice(-24),
    events,
  };
}

export function parseIssueList(raw: unknown): { issues: Issue[]; counts: IssueCounts } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const c = (r.counts ?? {}) as Record<string, unknown>;
  const issues = Array.isArray(r.issues) ? r.issues.map(parseIssue).filter((i): i is Issue => i !== null) : [];
  return { issues, counts: { unresolved: num(c.unresolved), resolved: num(c.resolved), ignored: num(c.ignored) } };
}

export const issueListUrl = (orgId: string, status: IssueStatus | 'all') => `api/orgs/${encodeURIComponent(orgId)}/issues?status=${status}`;
export const projectIssuesUrl = (projectId: string, status: IssueStatus | 'all') => `api/projects/${encodeURIComponent(projectId)}/issues?status=${status}`;
export const issueUrl = (id: string) => `api/issues/${encodeURIComponent(id)}`;

/** The i18n key of a kind's label — `issues.kind.<kind>` — so every kind has words in both languages (tested). */
export const issueKindKey = (kind: IssueKind) => `issues.kind.${kind}` as const;

/**
 * Where to look: a failed deployment or run opens that record on the project's console; an agent issue goes to the
 * agent's page. Null when the issue points nowhere the site has a page for (a site or model an external monitor saw).
 */
export function issueLink(issue: Issue, latest: IssueEvent | null = issue.events[0] ?? null): { to: string; key: 'issues.open.deployment' | 'issues.open.run' | 'issues.open.agent' | 'issues.open.project' } | null {
  const deploymentId = typeof latest?.meta.deploymentId === 'string' ? latest.meta.deploymentId : null;
  if (issue.projectId && (issue.kind === 'deploy_failed' || issue.kind === 'run_failed')) {
    const tab = issue.kind === 'run_failed' ? 'tab=runs&' : '';
    return deploymentId
      ? { to: `/projects/${encodeURIComponent(issue.projectId)}?${tab}open=${encodeURIComponent(deploymentId)}`, key: issue.kind === 'run_failed' ? 'issues.open.run' : 'issues.open.deployment' }
      : { to: `/projects/${encodeURIComponent(issue.projectId)}`, key: 'issues.open.project' };
  }
  if (issue.kind === 'agent_unreachable') {
    const agentId = typeof latest?.meta.agentId === 'string' ? latest.meta.agentId : issue.culprit.replace(/^\/agents\//, '');
    if (agentId) return { to: `/agent/${encodeURIComponent(agentId)}`, key: 'issues.open.agent' };
  }
  if (issue.projectId) return { to: `/projects/${encodeURIComponent(issue.projectId)}`, key: 'issues.open.project' };
  return null;
}

/** An SVG polyline's points for a 24-bucket sparkline in a `w`×`h` box; a flat line when nothing happened. */
export function sparklinePoints(hourly: number[], w = 96, h = 24): string {
  const n = Math.max(1, hourly.length - 1);
  const max = Math.max(1, ...hourly);
  return hourly.map((v, i) => `${((i / n) * w).toFixed(1)},${(h - 1 - (v / max) * (h - 2)).toFixed(1)}`).join(' ');
}

/** The refusal codes the issue routes answer, turned into the page's message key. */
export function issueProblemOf(status: number | undefined, code: string | undefined): string {
  if (status === 401 || code === 'not_signed_in') return 'issues.problem.signin';
  if (status === 403) return code === 'insufficient_role' ? 'issues.problem.role' : 'issues.problem.member';
  if (status === 404) return 'issues.problem.unavailable';
  return 'issues.problem.failed';
}
