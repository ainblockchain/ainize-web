import { projectRepoRef, type ProjectCreated, type ProjectCreateInput } from '../api/projects';
import { isReservedFirstSegment, SLUG_PATTERN } from './reservedRoutes';

export function projectBranchValid(branch: string): boolean {
  return !!branch && branch.length <= 200 && /^[A-Za-z0-9._/-]+$/.test(branch) && !branch.includes('..')
    && !branch.includes('//') && branch.split('/').every(s => s && !s.startsWith('.') && !s.endsWith('.') && !s.endsWith('.lock'));
}

/** Creation returns a one-time secret. Verify the captured account/source before displaying it or handing it to Drive. */
export function createdProjectReceipt(raw: unknown, input: ProjectCreateInput, principal: string): ProjectCreated | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as ProjectCreated, repo = projectRepoRef(input.repo);
  if (!repo || !principal || p.owner !== principal || !/^prj_[a-f0-9]{16}$/.test(p.id)
    || p.repo !== repo.url || p.org !== repo.org || p.repoName !== repo.repoName
    || (!/^[A-Za-z0-9._-]+$/.test(p.org) || isReservedFirstSegment(p.org)) || !SLUG_PATTERN.test(p.repoName) || p.branch !== input.branch
    || (p.sourcePath ?? '') !== '' || p.canManage !== true || p.deletionRequestedAt !== undefined
    || typeof p.hasDeployToken !== 'boolean' || p.hasDeployToken !== !!input.deployToken
    || !/^whsec_[a-f0-9]{48}$/.test(p.webhookSecret)) return null;
  try {
    const hook = new URL(p.hookUrl);
    if (!['https:', 'http:'].includes(hook.protocol) || hook.username || hook.password || hook.search || hook.hash
      || hook.pathname !== `/api/projects/${p.id}/hook`) return null;
  } catch { return null; }
  return p;
}
const refused = (error: unknown) => {
  const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
  const pairs: Record<string, number> = { not_signed_in: 401, invalid_request: 400, not_member: 403, repo_taken: 409, limit: 429 };
  const code = e?.data?.error?.code;
  return typeof code === 'string' && pairs[code] !== undefined && e?.status === pairs[code];
};
export class ProjectCreationUnconfirmed extends Error { constructor() { super('Project creation could not be confirmed'); } }

/** Per-view admission; server request IDs are still needed for reload/tab recovery. Never retry an ambiguous write here. */
export function createProjectCreation() {
  let busy = false, uncertain = false, completed = false;
  return {
    blocked: () => busy || uncertain || completed,
    uncertain: () => uncertain,
    async run(input: ProjectCreateInput, principal: string, io: { active: () => boolean; send: () => Promise<unknown> }) {
      if (busy || uncertain || completed || !io.active()) return null;
      busy = true;
      try {
        const raw = await io.send();
        const receipt = createdProjectReceipt(raw, input, principal);
        if (!receipt) { uncertain = true; throw new ProjectCreationUnconfirmed(); }
        completed = true;
        return io.active() ? receipt : null;
      } catch (error) {
        if (!refused(error)) uncertain = true;
        throw error;
      } finally { busy = false; }
    },
  };
}
