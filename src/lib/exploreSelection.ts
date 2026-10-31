export const EXPLORE_SORTS = ['popular', 'trending', 'built_on', 'fresh', 'latest', 'price', 'rows'] as const;
export type ExploreSort = typeof EXPLORE_SORTS[number];
export type ExploreKind = 'knowledge' | 'agent';
export type ExploreScope = 'all' | 'mine' | 'org';
const KEYS = ['kind', 'q', 'sort', 'model', 'schema', 'branch', 'versions', 'page', 'agents', 'org'] as const;

/** The address is the selection, including when it cannot currently be read. Never substitute public/default results. */
export function readExploreSelection(params: URLSearchParams, fixedKind?: ExploreKind) {
  const rawKind = params.get('kind');
  const kind = fixedKind ?? rawKind ?? (params.has('agents') || params.has('org') ? 'agent' : 'knowledge');
  const scope = params.get('agents') ?? (params.has('org') ? 'org' : 'all');
  const sort = params.get('sort') ?? 'popular';
  const versions = params.get('versions') ?? 'current';
  const pageText = params.get('page') ?? '1', page = Number(pageText);
  const org = params.get('org');
  const invalid = KEYS.some(k => params.getAll(k).length > 1 || /[\u0000-\u001f\u007f]/.test(params.get(k) ?? ''))
    || !['knowledge', 'agent'].includes(kind) || rawKind !== null && rawKind !== kind
    || !['all', 'mine', 'org'].includes(scope) || !(EXPLORE_SORTS as readonly string[]).includes(sort)
    || !['current', 'all'].includes(versions) || !/^[1-9][0-9]*$/.test(pageText) || !Number.isSafeInteger((page - 1) * 10)
    || org !== null && (!org.trim() || scope !== 'org')
    || kind === 'knowledge' && (params.has('agents') || params.has('org'))
    || kind === 'agent' && ['sort', 'model', 'schema', 'branch', 'versions', 'page'].some(k => params.has(k));
  return { invalid, kind: kind as ExploreKind, scope: scope as ExploreScope, sort: sort as ExploreSort,
    q: (params.get('q') ?? '').trim(), model: params.get('model') ?? '', schema: params.get('schema') ?? '', branch: params.get('branch') ?? '',
    showAll: versions === 'all', page: invalid ? 1 : page, org };
}

/** One navigation per action: a filter change resets pagination atomically and history can restore the full selection. */
export function changeExploreSelection(params: URLSearchParams, changes: Partial<Record<typeof KEYS[number], string | null>>, resetPage = true): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '') next.delete(key); else next.set(key, value);
  }
  if (resetPage) next.delete('page');
  return next;
}

export function exploreSelectionHref(location: { pathname: string; search: string; hash: string }, changes: Parameters<typeof changeExploreSelection>[1], resetPage = true): string {
  const next = changeExploreSelection(new URLSearchParams(location.search), changes, resetPage).toString();
  return `${location.pathname}${next ? `?${next}` : ''}${location.hash}`;
}
