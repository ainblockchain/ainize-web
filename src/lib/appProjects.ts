import type { Project } from '../api/projects';

export function appProjects(projects: Project[], query = ''): Project[] {
  const needle = query.trim().toLowerCase();
  return [...new Map(projects.map((p) => [p.id, p])).values()]
    .filter((p) => (p.kind === 'nextjs' || p.kind === 'service') &&
      `${p.name} ${p.org}/${p.repoName} ${p.sourcePath ?? ''} ${p.kind}`.toLowerCase().includes(needle))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
