import type { Deployment } from '../api/projects';
import { projectRunReceipt } from './projectRun';

/** One admission gate for every redeploy button in an account/project view. Durable recovery is separate. */
export function createProjectRedeployment() {
  let pending = false, uncertain = false;
  return {
    blocked: () => pending || uncertain,
    uncertain: () => uncertain,
    async submit(target: Deployment, send: (id: string) => Promise<unknown>, knownIds: readonly string[] = []): Promise<string | null> {
      if (pending || uncertain) return null;
      if (target.trigger === 'run' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(target.sha)) throw new Error('invalid_redeploy_target');
      pending = true;
      try {
        const id = projectRunReceipt(await send(target.id));
        if (!id || id === target.id || knownIds.includes(id)) throw new Error('redeploy_unconfirmed');
        return id;
      } catch (error) {
        const e = error as { status?: unknown; data?: { error?: { code?: unknown } } } | null;
        const status = e?.status, code = e?.data?.error?.code;
        // Only explicit pre-admission refusals establish that retrying cannot duplicate a deployment.
        if (typeof status !== 'number' || status < 400 || status >= 500 || typeof code !== 'string'
          || !['not_signed_in', 'not_found', 'not_member', 'not_yet_cloned'].includes(code)) uncertain = true;
        throw error;
      } finally { pending = false; }
    },
  };
}
