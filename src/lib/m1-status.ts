export type M1Job = { index: number; node: string; status: string; jobId: string | null; step: number | null; maxSteps: number | null; percent: number | null; updatedAt: number | null };
export type M1Status = { version: 1; runId: string; generatedAt: number; startedAt: number | null; jobs: M1Job[] };
const statuses = new Set(['NOT_SUBMITTED', 'SUBMITTING', 'UNCONFIRMED', 'UNKNOWN', 'QUEUED', 'PREFLIGHT', 'LOADING', 'TRAINING', 'EXPORTED', 'CHECKING', 'READY', 'NEEDS_MORE', 'FAILED', 'CANCELLED', 'ANNOUNCED', 'PUBLISHED', 'PENDING_REVIEW', 'EXPIRED', 'REJECTED']);
const numeric = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const optional = (n: unknown): n is number | null => n === null || numeric(n);
// Reconstruct the public object. Never forward arbitrary fields from the collector.
export function parseM1Status(value: unknown): M1Status {
  const v = value as M1Status;
  if (!v || v.version !== 1 || typeof v.runId !== 'string' || v.runId.length > 200 || !numeric(v.generatedAt) || !optional(v.startedAt) || !Array.isArray(v.jobs) || v.jobs.length !== 70) throw new Error('Invalid M1 snapshot');
  const jobs = v.jobs.map((j, i) => {
    if (!j || j.index !== i + 1 || typeof j.node !== 'string' || j.node.length > 100 || !statuses.has(j.status) || !(j.jobId === null || (typeof j.jobId === 'string' && /^[a-f0-9-]{36}$/i.test(j.jobId))) || ![j.step, j.maxSteps, j.percent, j.updatedAt].every(optional) || (j.percent !== null && j.percent > 100)) throw new Error('Invalid M1 job');
    return { index: j.index, node: j.node, status: j.status, jobId: j.jobId, step: j.step, maxSteps: j.maxSteps, percent: j.percent, updatedAt: j.updatedAt };
  });
  if (new Set(jobs.map(j => j.node)).size !== 5 || [...new Set(jobs.map(j => j.node))].some(n => jobs.filter(j => j.node === n).length !== 14)) throw new Error('Expected five nodes');
  return { version: 1, runId: v.runId, generatedAt: v.generatedAt, startedAt: v.startedAt, jobs };
}
export function m1Group(status: string): string {
  if (['READY', 'ANNOUNCED', 'PUBLISHED', 'PENDING_REVIEW'].includes(status)) return 'done';
  if (['FAILED', 'CANCELLED', 'REJECTED', 'NEEDS_MORE', 'EXPIRED'].includes(status)) return 'attention';
  if (['PREFLIGHT', 'LOADING', 'TRAINING', 'EXPORTED', 'CHECKING'].includes(status)) return 'active';
  if (['UNKNOWN', 'UNCONFIRMED'].includes(status)) return 'unknown';
  return 'waiting';
}
