import type { Project } from '../api/projects';
import { docsFromProjects, matchingSearchIds } from './globalSearch';

export type ProjectFilter = 'all' | 'deployment' | 'script';
/** `/me/projects?kind=` → the filter; anything else is "all". */
export const projectFilterOf = (kind: string | null): ProjectFilter => (kind === 'script' || kind === 'deployment' ? kind : 'all');
/** A Run project: `kind: script` (by the node's answer or the manifest). Everything else is a Deployment. */
export const isRunProject = (p: Pick<Project, 'kind' | 'manifest'>): boolean => (p.kind ?? p.manifest?.kind) === 'script';
export function filterProjects<T extends Pick<Project, 'kind' | 'manifest'>>(rows: readonly T[], filter: ProjectFilter): T[] {
  return rows.filter((p) => filter === 'all' || (filter === 'script' ? isRunProject(p) : !isRunProject(p)));
}

/** The Runs landing: every script project the person can see, newest first, filtered by the search box. */
export function runProjects(projects: Project[], query = ''): Project[] {
  const unique = [...new Map(projects.map((p) => [p.id, p])).values()].filter(isRunProject);
  const q = query.trim().toLowerCase();
  return unique
    .filter((p) => !q || [p.name, p.org, p.repoName, `${p.org}/${p.repoName}`, p.sourcePath ?? '', p.entry ?? ''].some((s) => (s ?? '').toLowerCase().includes(q)))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}

/** The Deployments landing: web apps and API services (agents have their own marketplace page; scripts are Runs). */
export function appProjects(projects: Project[], query = ''): Project[] {
  const unique = [...new Map(projects.map((p) => [p.id, p])).values()];
  const matches = matchingSearchIds(docsFromProjects(unique), query);
  return unique
    .filter((p) => matches.has(p.id))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
