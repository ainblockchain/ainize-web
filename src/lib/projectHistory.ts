import type { Deployment, Project } from '../api/projects';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const optionalText = (v: unknown) => v === undefined || typeof v === 'string';
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(v);
const entryPath = (v: unknown): v is string => text(v) && v.length <= 200 && !/[\\\0\n\r]/.test(v) && !v.split('/').some(s => !s || s === '.' || s === '..');

/** History is scoped to this project; invalid rows must not become a confirmed empty history. */
function readHistory(raw: unknown, projectId: string, key: 'runs' | 'deployments'): Deployment[] | null {
  if (!object(raw) || !Array.isArray(raw[key])) return null;
  const seen = new Set<string>();
  const number = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  const optionalNumber = (v: unknown) => v == null || number(v);
  const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
  const url = (v: unknown) => {
    if (typeof v !== 'string') return false;
    try { const parsed = new URL(v); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password; } catch { return false; }
  };
  for (const row of raw[key]) {
    if (!object(row) || !text(row.id) || row.id !== row.id.trim() || seen.has(row.id) || row.projectId !== projectId || typeof row.trigger !== 'string' || (key === 'runs' ? row.trigger !== 'run' : !['push', 'redeploy'].includes(row.trigger))
      || (row.sha !== '' && !sha(row.sha)) || typeof row.ref !== 'string'
      || typeof row.status !== 'string' || !['queued', 'building', 'ready', 'error'].includes(row.status)
      || !number(row.createdAt) || !optionalNumber(row.startedAt) || !optionalNumber(row.finishedAt) || !optionalNumber(row.ms)
      || !url(row.logUrl) || row.outputUrl !== undefined && !url(row.outputUrl)
      || row.visitUrl !== undefined && !url(row.visitUrl)
      || row.outputState !== undefined && (typeof row.outputState !== 'string' || !['current', 'artifact', 'historical', 'unconfirmed'].includes(row.outputState))
      || row.visitUrl !== undefined && !['current', 'artifact'].includes(String(row.outputState))
      || row.outputState === 'artifact' && row.trigger !== 'run' && row.kind !== 'script'
      || row.outputState === 'current' && (row.trigger === 'run' || row.kind === 'script')
      || row.kind !== undefined && (typeof row.kind !== 'string' || !['script', 'nextjs', 'service', 'agent'].includes(row.kind))
      || row.entry != null && !entryPath(row.entry) || row.subject !== undefined && !optionalText(row.subject)
      || row.error !== undefined && !optionalText(row.error) || row.exitCode !== undefined && !Number.isInteger(row.exitCode)
      || row.inputKeys !== undefined && !strings(row.inputKeys) || row.envKeys !== undefined && !strings(row.envKeys)
      || row.inputs !== undefined && !object(row.inputs) || row.env !== undefined && !object(row.env)
      || row.pusher != null && (!object(row.pusher) || !text(row.pusher.subject))
      || row.placement != null && (!object(row.placement) || !text(row.placement.address) || typeof row.placement.local !== 'boolean')) return null;
    seen.add(row.id);
  }
  return [...raw[key] as unknown as Deployment[]].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}


export const readProjectRunHistory = (raw: unknown, projectId: string) => readHistory(raw, projectId, 'runs');
export const readProjectDeploymentHistory = (raw: unknown, projectId: string) => readHistory(raw, projectId, 'deployments');
export function readProjectDeployment(raw: unknown, projectId: string, deploymentId: string): Deployment | null {
  const row = readProjectDeploymentHistory({ deployments: [raw] }, projectId)?.[0];
  return row?.id === deploymentId ? row : null;
}
export const deploymentLogHref = (id: string) => `/api/deployments/${encodeURIComponent(id)}/log`;

/** Header redeploy means the project's latest deployment attempt, never the first arbitrary response row. */
export function projectRedeployTarget(project: Pick<Project, 'id' | 'lastDeploymentId'>, rows: Deployment[]): Deployment | null {
  return rows.find(row => row.projectId === project.id && row.id === project.lastDeploymentId && row.trigger !== 'run' && sha(row.sha)) ?? null;
}

/** Keep an explicitly opened record on its page; a shrinking history cannot leave a blank later page. */
export function deploymentPage(rows: Deployment[], requested: number, open: string | null, size: number) {
  const count = Math.max(1, Math.ceil(rows.length / size));
  const index = open ? rows.findIndex(row => row.id === open) : -1;
  const page = index >= 0 ? Math.floor(index / size) + 1 : Math.min(count, Math.max(1, requested));
  return { page, count, rows: rows.slice((page - 1) * size, page * size) };
}
