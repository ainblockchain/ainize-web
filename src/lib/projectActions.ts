import type { Deployment, Project } from '@/api/projects';

export const isScriptProject = (project: Pick<Project, 'kind' | 'manifest'>): boolean =>
  (project.kind ?? project.manifest?.kind) === 'script';

/** Visit opens the active deployment, never an arbitrary historical successful build. */
export function activeProjectUrl(project: Project, deployments: Deployment[] = []): string | null {
  if (!['nextjs', 'service', 'agent'].includes(project.kind ?? project.manifest?.kind ?? '')) return null;
  const rows = [...deployments, ...(project.lastDeployment ? [project.lastDeployment] : [])];
  const active = project.activeDeploymentId ? rows.find((row) => row.id === project.activeDeploymentId)
    : project.activeCommit ? rows.find((row) => row.sha === project.activeCommit && row.status === 'ready')
      : project.status === 'ready' ? project.lastDeployment : null;
  return active?.status === 'ready' && active.outputUrl && /^https?:\/\//.test(active.outputUrl) ? active.outputUrl : null;
}
