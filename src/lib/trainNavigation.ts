/** Keep bookmarked datasets, lesson IDs, query options and anchors when entering Train. */
export function legacyTrainDestination(pathname: string, search = '', hash = ''): string {
  return `${pathname.replace(/^\/teach(?=\/|$)/, '/train')}${search}${hash}`;
}

/** The old agent listing remains the same selection, not a reset to every public agent. */
export function legacyAgentsDestination(search = '', hash = ''): string {
  const params = new URLSearchParams(search);
  params.set('kind', 'agent');
  return `/explore?${params.toString()}${hash}`;
}
