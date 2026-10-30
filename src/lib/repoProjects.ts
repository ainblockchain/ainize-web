/**
 * Every deployment of one repository, as its page `/<org>/<repo>` shows them: the root project (the repository's own
 * `ainize.json`) first, then each monorepo folder project (a first-level folder with its own `ainize.json`,
 * `sourcePath`) by folder name. `?project=<folder>` picks a folder's; no parameter selects the root,
 * so a repository without folder projects looks exactly as it always did.
 */
export interface RepoProject { id: string; repo: string; repoId?: string; sourcePath?: string; org: string; repoName: string }

const sameRepo = (a: RepoProject, b: RepoProject) => (a.repoId && b.repoId ? a.repoId === b.repoId : a.repo === b.repo);

/** The root first, then its siblings in folder order. Projects of other repositories are left out. */
export function repoProjects<P extends RepoProject>(root: P, orgProjects: readonly P[]): P[] {
  const folders = orgProjects.filter((p) => p.id !== root.id && !!p.sourcePath && sameRepo(p, root));
  const seen = new Set<string>();
  return [root, ...folders.filter((p) => !seen.has(p.sourcePath!) && seen.add(p.sourcePath!)).sort((a, b) => a.sourcePath!.localeCompare(b.sourcePath!))];
}

/** Only an absent selection chooses the root; an unknown explicit folder must not select another project. */
export function selectRepoProject<P extends RepoProject>(projects: readonly P[], param: string | null): P | undefined {
  const want = (param ?? '').replace(/^\/+|\/+$/g, '');
  return want ? projects.find((p) => (p.sourcePath ?? '') === want) : projects[0];
}

/** What the switcher calls a deployment: the repository's name, or `<repo>/<folder>`. */
export const repoProjectLabel = (p: RepoProject) => (p.sourcePath ? `${p.repoName}/${p.sourcePath}` : p.repoName);
