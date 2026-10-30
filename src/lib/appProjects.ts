import type { Project } from '../api/projects';
import { docsFromProjects, matchingSearchIds } from './globalSearch';

export function appProjects(projects: Project[], query = ''): Project[] {
  const unique = [...new Map(projects.map((p) => [p.id, p])).values()];
  const matches = matchingSearchIds(docsFromProjects(unique), query);
  return unique
    .filter((p) => matches.has(p.id))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
