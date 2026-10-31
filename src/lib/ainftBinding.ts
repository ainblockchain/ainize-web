export interface AinftBinding {
  agentId: string;
  chainId: 0 | 1;
  objectId: string;
  tokenId: string;
  release: number;
  verifiedAt: number;
  communityVersion: number;
  community: { appId: string; symbol: string } | null;
}

/** Null is an explicit unbound agent; undefined means an unreadable or mismatched response. */
export function parseAinftBinding(value: unknown, agentId: string): AinftBinding | null | undefined {
  if (!value || typeof value !== 'object' || !('binding' in value)) return undefined;
  const binding = value.binding;
  if (binding === null) return null;
  if (!binding || typeof binding !== 'object') return undefined;
  const b = binding as Record<string, unknown>;
  const nonnegative = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  if (b.agentId !== agentId || (b.chainId !== 0 && b.chainId !== 1)
    || typeof b.objectId !== 'string' || !/^0x[0-9a-f]{40}$/i.test(b.objectId)
    || typeof b.tokenId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(b.tokenId)
    || !nonnegative(b.release) || !nonnegative(b.verifiedAt)
    || (b.communityVersion !== undefined && !nonnegative(b.communityVersion))) return undefined;
  const community = b.community as { appId?: unknown; symbol?: unknown } | null | undefined;
  if (community != null && (typeof community !== 'object' || typeof community.appId !== 'string' || !community.appId.trim()
    || typeof community.symbol !== 'string' || !community.symbol.trim())) return undefined;
  return { agentId, chainId: b.chainId, objectId: b.objectId, tokenId: b.tokenId, release: b.release, verifiedAt: b.verifiedAt,
    communityVersion: b.communityVersion as number ?? 0, community: community == null ? null : { appId: community.appId as string, symbol: community.symbol as string } };
}
