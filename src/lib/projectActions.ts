import { projectRunTargets, readRunManifest } from './projectRun';
import type { Deployment, Project } from '@/api/projects';

export const isScriptProject = (project: Pick<Project, 'kind' | 'manifest'>): boolean =>
  (project.kind ?? project.manifest?.kind) === 'script';

/** A web app or service can also declare runnable maintenance scripts. The source read still validates the selected commit. */
export const hasProjectRunTargets = (project: Pick<Project, 'kind' | 'manifest'>): boolean =>
  isScriptProject(project) || projectRunTargets(readRunManifest(project.manifest)).length > 0;

/** Visit opens the active deployment, never an arbitrary historical successful build. */
export function activeProjectUrl(project: Project, deployments?: Deployment[]): string | null {
  if (project.deletionRequestedAt !== undefined) return null;
  if (!['nextjs', 'service', 'agent'].includes(project.kind ?? project.manifest?.kind ?? '')) return null;
  const rows = (deployments ?? (project.lastDeployment ? [project.lastDeployment] : []))
    .filter(row => (!project.id || row.projectId === project.id) && row.trigger !== 'run');
  const active = project.activeDeploymentId ? rows.find((row) => row.id === project.activeDeploymentId)
    : project.activeCommit ? rows.find((row) => row.sha === project.activeCommit && row.status === 'ready')
      : project.status === 'ready' ? rows.find(row => row.id === (project.lastDeploymentId ?? project.lastDeployment?.id)) : null;
  if (active?.status !== 'ready' || active.outputState !== 'current' || !active.visitUrl) return null;
  if (project.activeCommit && active.sha !== project.activeCommit) return null;
  try {
    const url = new URL(active.visitUrl);
    if ((active.kind ?? project.kind ?? project.manifest?.kind) === 'agent' && !/^\/agent\/[a-z0-9][a-z0-9-]{0,39}$/.test(url.pathname)) return null;
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? active.visitUrl : null;
  } catch { return null; }
}
