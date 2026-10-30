/**
 * The header's unified search — one box over everything the site lists: apps (projects), models, agents and
 * knowledge, grouped the way huggingface.co's header groups models / datasets / spaces.
 *
 * Pure: the component (`components/ui/GlobalSearch.tsx`) feeds it what the queries returned and draws the groups
 * it gets back. Keeping the ranking here is what lets `test/global-search.test.ts` hold it without a renderer.
 */
export type SearchKind = 'app' | 'model' | 'agent' | 'knowledge';

/** The order the groups are drawn in — the order the header's nav lists them. */
export const SEARCH_KINDS: readonly SearchKind[] = ['app', 'model', 'agent', 'knowledge'];

export interface SearchDoc {
  kind: SearchKind;
  /** Stable within a kind; `${kind}:${id}` is the row key. */
  id: string;
  title: string;
  /** One line under the title: owner, modality, author — whatever tells two same-named rows apart. */
  subtitle?: string;
  href: string;
  /** Searched, never shown: skills, tags, descriptions, aliases. */
  keywords?: string[];
}

export interface SearchHit extends SearchDoc { score: number }
export interface SearchGroup { kind: SearchKind; hits: SearchHit[]; /** How many matched before the cut. */ total: number }

/** Where "See all results" goes for each group, carrying the query. */
export function seeAllHref(kind: SearchKind, q: string): string {
  const query = encodeURIComponent(q.trim());
  switch (kind) {
    case 'app': return `/apps?q=${query}`;
    case 'model': return `/models?q=${query}`;
    case 'agent': return `/explore?kind=agent&q=${query}`;
    case 'knowledge': return `/train/knowledge?q=${query}`;
  }
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Score one document against one query. Zero is "not a hit".
 *
 * Exact id/title beats a title that starts with the query, which beats a title that merely contains it, which
 * beats a match only in the keywords — and every word of a multi-word query has to land somewhere, so
 * "deepseek chat" does not list every model with "chat" in its modality.
 */
export function scoreDoc(doc: SearchDoc, q: string): number {
  const needle = norm(q);
  if (!needle) return 0;
  const title = norm(doc.title);
  const id = norm(doc.id);
  const subtitle = norm(doc.subtitle ?? '');
  const keywords = norm((doc.keywords ?? []).join(' '));
  const words = needle.split(/\s+/).filter(Boolean);
  const haystack = `${title} ${id} ${subtitle} ${keywords}`;
  if (!words.every((w) => haystack.includes(w))) return 0;
  if (title === needle || id === needle) return 100;
  if (title.startsWith(needle) || id.startsWith(needle)) return 60;
  if (title.includes(needle) || id.includes(needle)) return 40;
  if (subtitle.includes(needle)) return 25;
  if (keywords.includes(needle)) return 20;
  return 10;   // every word matched, somewhere
}

/**
 * Rank and group. Groups come back in `SEARCH_KINDS` order with at most `perKind` rows each and `total` saying how
 * many there were; a kind with no hits is left out so the dropdown never draws an empty heading.
 */
export function searchDocs(docs: readonly SearchDoc[], q: string, perKind = 4): SearchGroup[] {
  if (!norm(q)) return [];
  const groups: SearchGroup[] = [];
  for (const kind of SEARCH_KINDS) {
    const hits = docs
      .filter((d) => d.kind === kind)
      .map((d) => ({ ...d, score: scoreDoc(d, q) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    if (hits.length) groups.push({ kind, hits: hits.slice(0, perKind), total: hits.length });
  }
  return groups;
}

/** The rows in the order the keyboard walks them — group by group. */
export function flattenHits(groups: readonly SearchGroup[]): SearchHit[] {
  return groups.flatMap((g) => g.hits);
}

// ------------------------------------------------------------------ adapters: what the API returned → SearchDoc

export function docsFromProjects(projects: readonly { id: string; org: string; repoName: string; name: string; kind?: string | null; status?: string }[]): SearchDoc[] {
  return projects.map((p) => ({
    kind: 'app', id: p.id, title: p.name || `${p.org}/${p.repoName}`,
    subtitle: `${p.org}/${p.repoName}${p.kind ? ` · ${p.kind}` : ''}`,
    href: `/${encodeURIComponent(p.org)}/${encodeURIComponent(p.repoName)}`,
    keywords: [p.org, p.repoName, p.kind ?? '', p.status ?? ''],
  }));
}

export function docsFromModels(models: readonly { id: string; modality: string; providers?: readonly { node: { name: string | null; address: string } }[] }[]): SearchDoc[] {
  return models.map((m) => ({
    kind: 'model', id: m.id, title: m.id, subtitle: m.modality,
    href: `/models/${encodeURIComponent(m.id)}`,
    keywords: (m.providers ?? []).flatMap((p) => [p.node.name ?? '', p.node.address]),
  }));
}

export function docsFromAgents(agents: readonly { id: string; name: string; description: string | null; alias?: string | null; provider?: string | null; model?: string | null; skills?: readonly { name: string; description?: string | null; tags?: readonly string[] }[] }[]): SearchDoc[] {
  return agents.map((a) => ({
    kind: 'agent', id: a.id, title: a.name || a.id,
    subtitle: a.description ?? undefined,
    href: `/agent/${encodeURIComponent(a.alias || a.id)}`,
    keywords: [a.alias ?? '', a.provider ?? '', a.model ?? '', ...(a.skills ?? []).flatMap((s) => [s.name, s.description ?? '', ...(s.tags ?? [])])],
  }));
}

export function docsFromCatalog(items: readonly { anchor: { id: string; name: string; author: string; author_name?: string; description?: string; topic_path?: string } }[]): SearchDoc[] {
  return items.map(({ anchor: a }) => ({
    kind: 'knowledge', id: a.id, title: a.name || a.id,
    subtitle: a.author_name || a.author,
    href: `/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}`,
    keywords: [a.description ?? '', a.topic_path ?? '', a.author],
  }));
}
