import type { Project, RotatedSecret } from '../api/projects';

export type ProjectManagementAction = 'sync' | 'rotate' | 'delete';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const url = (v: unknown): v is string => {
  if (typeof v !== 'string') return false;
  try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
};
export function projectSyncTarget(p: Pick<Project, 'repo' | 'upstreamRepo'>) {
  if (!/^https:\/\/aindrive\.ainetwork\.ai\/[A-Za-z0-9_.-]+\/git\/[A-Za-z0-9_.-]+(?:\/)?$/.test(p.repo)) return false;
  try { const u = new URL(p.upstreamRepo ?? ''); return u.origin === 'https://github.com' && !u.username && !u.password && !u.search && !u.hash && /^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(u.pathname); } catch { return false; }
}
/** The reviewed identity is stable even if a build changes status while the confirmation is open. */
export function sameProjectManagementTarget(raw: unknown, selected: Project, action: ProjectManagementAction): raw is Project {
  if (!object(raw) || raw.id !== selected.id || typeof raw.id !== 'string' || !raw.id || !url(raw.repo)
    || raw.repo !== selected.repo || raw.branch !== selected.branch || typeof raw.branch !== 'string'
    || (raw.sourcePath ?? '') !== (selected.sourcePath ?? '') || raw.owner !== selected.owner
    || raw.hookUrl !== selected.hookUrl || raw.upstreamRepo !== selected.upstreamRepo
    || (action === 'sync' ? raw.canOperate !== true : raw.canManage !== true)) return false;
  if (action === 'rotate' && (!url(raw.hookUrl) || new URL(raw.hookUrl).pathname !== `/api/projects/${encodeURIComponent(selected.id)}/hook`
    || new URL(raw.hookUrl).search || new URL(raw.hookUrl).hash)) return false;
  return action !== 'sync' || projectSyncTarget(raw as unknown as Project);
}
export type ProjectManagementResult = { kind: 'delete'; id: string } | { kind: 'rotate'; receipt: RotatedSecret } | { kind: 'sync'; requestedAt: string };
export function projectManagementReceipt(raw: unknown, p: Project, action: ProjectManagementAction): ProjectManagementResult | null {
  if (!object(raw)) return null;
  if (action === 'delete') return raw.ok === true && raw.id === p.id ? { kind: 'delete', id: p.id } : null;
  if (action === 'rotate') return raw.id === p.id && raw.hookUrl === p.hookUrl && typeof raw.webhookSecret === 'string' && /^whsec_[a-f0-9]{48}$/.test(raw.webhookSecret)
    ? { kind: 'rotate', receipt: { id: p.id, hookUrl: raw.hookUrl as string, webhookSecret: raw.webhookSecret } } : null;
  return raw.projectId === p.id && raw.repository === p.repo && raw.requested === true && typeof raw.requestedAt === 'string'
    && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(raw.requestedAt) && Number.isFinite(Date.parse(raw.requestedAt))
    ? { kind: 'sync', requestedAt: raw.requestedAt } : null;
}
export class ProjectManagementError extends Error {
  constructor(readonly reason: 'changed' | 'unconfirmed') { super(reason); }
}
const refused = (error: unknown) => {
  const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
  const s = e?.status, c = e?.data?.error?.code;
  return s === 503 && c === 'github_sync_off' || typeof s === 'number' && s >= 400 && s < 500
    && typeof c === 'string' && ['not_signed_in', 'not_found', 'not_member', 'forbidden', 'ax_cleanup_required', 'not_aindrive', 'github_upstream_unknown'].includes(c);
};
/** Per-view exclusion only: unknown outcomes cannot be recovered by refreshing metadata. */
export function createProjectManagement() {
  let busy = false, unknown = false;
  return {
    blocked: () => busy || unknown,
    uncertain: () => unknown,
    async run(p: Project, action: ProjectManagementAction, io: { read: () => Promise<unknown>; send: () => Promise<unknown>; active: () => boolean }) {
      if (busy || unknown || !io.active()) return null;
      busy = true; let dispatched = false;
      try {
        const fresh = await io.read();
        if (!io.active()) return null;
        if (!sameProjectManagementTarget(fresh, p, action)) throw new ProjectManagementError('changed');
        dispatched = true;
        const raw = await io.send();
        if (!io.active()) return null;
        const result = projectManagementReceipt(raw, p, action);
        if (!result) throw new ProjectManagementError('unconfirmed');
        return result;
      } catch (error) {
        if (dispatched && !refused(error)) unknown = true;
        throw error;
      } finally { busy = false; }
    },
  };
}
