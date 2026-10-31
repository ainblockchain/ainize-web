export type NetworkKind = 'credit' | 'local_chain' | 'testnet' | 'mainnet' | 'unknown';

/** Recognize reported public network configuration, not arbitrary hostname substrings.
 * Official endpoint/chain pairs: https://docs.ainetwork.ai/ain-blockchain/developer-guide/getting-started
 * A custom/loopback RPC may proxy any chain; a name containing "test" or "localhost" proves nothing.
 * Legacy ledger.network is not authoritative: older core labels every nonzero chain ID as mainnet.
 */
export function networkKindOf(ledger?: { kind?: string; provider?: string | null }, chainId?: number): NetworkKind {
  if (ledger?.kind === 'local') return 'credit';
  if (ledger?.kind !== 'ain' || typeof ledger.provider !== 'string' || !Number.isSafeInteger(chainId)) return 'unknown';
  try {
    const rpc = new URL(ledger.provider);
    if (rpc.protocol !== 'https:' || rpc.username || rpc.password || rpc.port) return 'unknown';
    if (rpc.hostname === 'mainnet-api.ainetwork.ai' && chainId === 1) return 'mainnet';
    if (rpc.hostname === 'testnet-api.ainetwork.ai' && chainId === 0) return 'testnet';
  } catch { /* malformed provider is unknown, not a guessed network */ }
  return 'unknown';
}
