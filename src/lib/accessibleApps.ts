import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { Project, ProjectsResponse } from '@/api/projects';
import { parseOrgList } from '@/api/organizations';

export interface AccessibleAppsResponse extends ProjectsResponse { failedSources: string[] }
type Response = { data?: unknown; error?: FetchBaseQueryError };
type Query = (url: string) => Promise<Response>;
const invalidResponse = (): FetchBaseQueryError => ({ status: 'CUSTOM_ERROR', error: 'Invalid project list response' });
function projectList(value: unknown): Project[] | null {
  const projects = (value as Partial<ProjectsResponse> | null)?.projects;
  return Array.isArray(projects) && projects.every((p) => p && typeof p.id === 'string') ? projects : null;
}

/** Keep successful sources; a denied/offline organization is not an empty account. */
export async function loadAccessibleApps(orgHints: string[], query: Query): Promise<{ data: AccessibleAppsResponse } | { error: FetchBaseQueryError }> {
  const [personal, memberships] = await Promise.all([query('api/projects'), query('api/orgs')]);
  const failedSources: string[] = [];
  const membershipBody = memberships.data as { orgs?: unknown } | undefined;
  const membershipValid = !memberships.error && Array.isArray(membershipBody?.orgs);
  if (!membershipValid) failedSources.push('organizations');
  const orgs = [...new Set([...orgHints, ...(membershipValid ? parseOrgList(memberships.data).orgs.map((o) => o.id) : [])])].filter(Boolean).sort();
  const results = [personal, ...await Promise.all(orgs.map((org) => query(`api/orgs/${encodeURIComponent(org)}/projects`)))];
  const names = ['personal', ...orgs];
  const projects: Project[] = [];
  let successes = 0;
  let firstError: FetchBaseQueryError | undefined;
  results.forEach((result, index) => {
    const rows = !result.error ? projectList(result.data) : null;
    if (!rows) { failedSources.push(names[index]); firstError ??= result.error ?? invalidResponse(); return; }
    successes++;
    projects.push(...rows);
  });
  if (!successes) return { error: firstError ?? invalidResponse() };
  return { data: { projects: [...new Map(projects.map((p) => [p.id, p])).values()], failedSources } };
}
