/** Knowledge authors are ledger addresses, while organization project URLs use slugs. */
export const isKnowledgeAuthor = (value: string): boolean => /^0x[0-9a-f]{40}$/i.test(value);

export function knowledgePath(author: string, patchId: string): string {
  return `/${encodeURIComponent(author)}/${encodeURIComponent(patchId)}`;
}

/** Public records sometimes carry only the knowledge id; resolve its actual author before opening it. */
export const knowledgeLookupPath = (patchId: string) => `/patch/${encodeURIComponent(patchId)}`;
export function resolvedKnowledgePath(raw: unknown, patchId: string): string | null {
  const anchor = (raw as { anchor?: { id?: unknown; author?: unknown } } | null)?.anchor;
  return anchor?.id === patchId && typeof anchor.author === 'string' && isKnowledgeAuthor(anchor.author) ? knowledgePath(anchor.author, patchId) : null;
}
