/** Repository projects retain distinct folder and branch identities. */
export interface RepoProject { id: string; repo: string; repoId?: string; sourcePath?: string; org: string; repoName: string; branch?: string }

const sameRepo = (a: RepoProject, b: RepoProject) => (a.repoId && b.repoId ? a.repoId === b.repoId : a.repo === b.repo);
const order = <P extends RepoProject>(a: P, b: P) => (a.sourcePath ?? '').localeCompare(b.sourcePath ?? '') || (a.branch ?? '').localeCompare(b.branch ?? '') || a.id.localeCompare(b.id);

/** Include every branch, including root siblings; deduplicate only the same project id. */
export function repoProjects<P extends RepoProject>(root: P, orgProjects: readonly P[]): P[] {
  const byId = new Map([[root.id, root]]);
  for (const p of orgProjects) if (sameRepo(p, root) && !byId.has(p.id)) byId.set(p.id, p);
  return [...byId.values()].sort(order);
}

/** Validate list identity before selecting or rendering, including malformed unrelated rows. */
export function readProjectList<P extends RepoProject>(raw: unknown): P[] | null {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { projects?: unknown }).projects)) return null;
  const seen = new Set<string>(), rows = (raw as { projects: unknown[] }).projects;
  for (const row of rows) {
    if (!row || typeof row !== 'object') return null;
    const p = row as RepoProject, value = row as Record<string, unknown>;
    if (['id', 'repo', 'org', 'repoName', 'branch'].some(k => typeof value[k] !== 'string' || !value[k]) || seen.has(p.id) || p.sourcePath !== undefined && typeof p.sourcePath !== 'string' || p.repoId !== undefined && typeof p.repoId !== 'string') return null;
    seen.add(p.id);
  }
  return rows as P[];
}

export function readRepoProjectList<P extends RepoProject>(raw: unknown, org: string, repo: string): P[] | null {
  return readProjectList<P>(raw)?.filter(p => p.org.toLowerCase() === org.toLowerCase() && p.repoName.toLowerCase() === repo.toLowerCase()).sort(order) ?? null;
}

/** Explicit ids/folders never fall back. A legacy address resolves only a unique root or unique remaining project. */
export function selectRepoProject<P extends RepoProject>(projects: readonly P[], folder: string | null, id: string | null = null): P | undefined {
  let matches = id !== null ? projects.filter(p => p.id === id) : [...projects];
  if (folder !== null) matches = matches.filter(p => (p.sourcePath ?? '') === folder);
  else if (id === null) { const roots = matches.filter(p => !p.sourcePath); if (roots.length) matches = roots; }
  return matches.length === 1 ? matches[0] : undefined;
}

export const repoProjectLabel = (p: RepoProject) => `${p.repoName}${p.sourcePath ? `/${p.sourcePath}` : ''}${p.branch ? ` · ${p.branch}` : ''}`;
