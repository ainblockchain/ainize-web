/** Knowledge authors are ledger addresses, while organization project URLs use slugs. */
export const isKnowledgeAuthor = (value: string): boolean => /^0x[0-9a-f]{40}$/i.test(value);

export function knowledgePath(author: string, patchId: string): string {
  return `/${encodeURIComponent(author)}/${encodeURIComponent(patchId)}`;
}
