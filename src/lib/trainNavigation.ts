/** Keep bookmarked datasets, lesson IDs, query options and anchors when entering Train. */
export function legacyTrainDestination(pathname: string, search = '', hash = ''): string {
  return `${pathname.replace(/^\/teach(?=\/|$)/, '/train')}${search}${hash}`;
}
