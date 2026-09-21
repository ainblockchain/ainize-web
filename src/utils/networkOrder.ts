type NetworkEntry = {
  address?: string | null;
  endpoint?: string | null;
  name?: string | null;
  ledger?: string | null;
  info?: { name?: string | null; address?: string | null } | null;
};

export function networkEntryKey(entry: NetworkEntry): string {
  return entry.address?.toLowerCase() || entry.info?.address?.toLowerCase() || entry.endpoint ||
    JSON.stringify([entry.name || entry.info?.name || '', entry.ledger || '']);
}

// Heartbeats change last_seen and response order. Keep rows in a readable order.
export function orderNetworkEntries<T extends NetworkEntry>(entries: readonly T[]): T[] {
  const label = (entry: NetworkEntry) => entry.name || entry.info?.name || entry.endpoint || networkEntryKey(entry);
  return [...entries].sort((a, b) => label(a).localeCompare(label(b), 'en', { numeric: true }) ||
    networkEntryKey(a).localeCompare(networkEntryKey(b), 'en'));
}

export function uniqueNetworkWarnings<T extends NetworkEntry>(entries: readonly T[]): T[] {
  return orderNetworkEntries([...new Map(entries.map(entry => [networkEntryKey(entry), entry])).values()]);
}
