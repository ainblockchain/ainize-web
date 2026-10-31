/**
 * The first path segments this app (and the Next.js routes beside it) already claim, so that the GitHub-shaped
 * pages `/<org>` and `/<org>/<repo>` (ProjectByNamePage, OrgPage) never swallow a real page. React Router ranks a
 * static segment above a dynamic one, so `/models/x` reaches ModelDetailPage on its own; this list is for the paths
 * nothing claims (`/explore/whatever`, `/docs`'s neighbours) and for the Next routes the SPA never sees — they must
 * answer "not found", not "no such project". One place; `test/reserved-routes.test.ts` checks it against App.tsx.
 */
export const RESERVED_FIRST_SEGMENTS: readonly string[] = [
  // React Router routes (src/App.tsx)
  'explore', 'search', 'apps', 'models', 'billing', 'network', 'agent', 'agents', 'tracks', 'ledger', 'terms', 'signing', 'authorize', 'docs',
  'chat', 'teach', 'train', 'teacher', 'verifier', 'benchmarks', 'patch', 'me', 'projects', 'org', 'dashboard', 'new-patch', 'my-nodes',
  'logs', 'project', 'account', 'drive', 'aincode',
  // Next.js routes (app/*) — served before the SPA ever renders
  'api', 'git', 'p2p', 'v1', 'svc', 'x402', '_next', 'code',
  // never a slug
  'static', 'assets', 'favicon.ico', 'robots.txt', 'sitemap.xml',
];

const set = new Set(RESERVED_FIRST_SEGMENTS.map((s) => s.toLowerCase()));

/** May this first segment be an organization slug (`/<org>`, `/<org>/<repo>`)? */
export function isReservedFirstSegment(segment: string): boolean {
  let s: string;
  try { s = decodeURIComponent(segment).toLowerCase(); }
  catch { return true; }
  return !s || s.startsWith('.') || s.startsWith('_') || set.has(s);
}

/** An organization slug or repository name as aindrive and the node spell them (`[A-Za-z0-9._-]`). */
export const SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export const looksLikeSlug = (s: string): boolean => SLUG_PATTERN.test(s) && !isReservedFirstSegment(s);

/**
 * The address of a project — every link to a project goes through here. `/<org>/<repo>` for a repository's own
 * project; a monorepo folder's project (`sourcePath`, a folder with its own ainize.json) is shown on that same page,
 * selected with `project=<folder>` and its exact `projectId` (src/lib/repoProjects.ts).
 */
export const projectPath = (p: { org: string; repoName: string; id?: string; sourcePath?: string }): string => {
  const query = new URLSearchParams();
  if (p.sourcePath) query.set('project', p.sourcePath);
  if (p.id) query.set('projectId', p.id);
  return `/${encodeURIComponent(p.org)}/${encodeURIComponent(p.repoName)}${query.size ? `?${query}` : ''}`;
};

/** Redirecting an id URL retains record/run context but cannot inherit a conflicting project selection. */
export function projectRedirectPath(p: Parameters<typeof projectPath>[0], search: string): string {
  const [path, own = ''] = projectPath(p).split('?');
  const merged = new URLSearchParams(search);
  merged.delete('project'); merged.delete('projectId');
  for (const [k, v] of new URLSearchParams(own)) merged.set(k, v);
  return `${path}${merged.size ? `?${merged}` : ''}`;
}
/** The organization's page, `/<org>`. */
export const orgPath = (org: string): string => `/${encodeURIComponent(org)}`;
