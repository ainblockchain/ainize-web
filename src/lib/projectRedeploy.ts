import type { Deployment } from '../api/projects';
import { projectRunReceipt } from './projectRun';

export function projectRedeployReceipt(result: unknown, target: Pick<Deployment, 'id' | 'projectId' | 'sha'>, knownIds: readonly string[] = []): string | null {
  const receipt = result as { projectId?: unknown; redeployOf?: unknown; sha?: unknown } | null;
  const id = projectRunReceipt(result);
  return id && id !== target.id && !knownIds.includes(id) && receipt?.projectId === target.projectId
    && receipt.redeployOf === target.id && receipt.sha === target.sha ? id : null;
}

/** One admission gate for every redeploy button in an account/project view. Durable recovery is separate. */
export function createProjectRedeployment() {
  let pending = false, uncertain = false;
  return {
    blocked: () => pending || uncertain,
    uncertain: () => uncertain,
    async submit(target: Deployment, send: (id: string) => Promise<unknown>, knownIds: readonly string[] = []): Promise<string | null> {
      if (pending || uncertain) return null;
      if (!target.id || !target.projectId || target.trigger === 'run' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(target.sha)) throw new Error('invalid_redeploy_target');
      pending = true;
      try {
        const result = await send(target.id);
        const id = projectRedeployReceipt(result, target, knownIds);
        if (!id) throw new Error('redeploy_unconfirmed');
        return id;
      } catch (error) {
        const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
        const status = e?.status, code = e?.data?.error?.code;
        // Only explicit pre-admission refusals establish that retrying cannot duplicate a deployment.
        if (typeof status !== 'number' || status < 400 || status >= 500 || typeof code !== 'string'
          || !['not_signed_in', 'not_found', 'not_member', 'not_yet_cloned', 'project_deleting', 'invalid_redeploy_target', 'redeploy_target_changed'].includes(code)) uncertain = true;
        throw error;
      } finally { pending = false; }
    },
  };
}
