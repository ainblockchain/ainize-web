import type { AuthMe, InfoResponse, WalletResponse } from '../api/types';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const address = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export type AccountNode = Pick<AuthMe, 'address' | 'name' | 'roles'>;
export function accountNode(raw: unknown): AccountNode | null {
  if (!object(raw) || !address(raw.address) || typeof raw.name !== 'string' || !Array.isArray(raw.roles) || !raw.roles.every((v: unknown) => typeof v === 'string')) return null;
  return { address: raw.address, name: raw.name, roles: raw.roles };
}

/** Validate the fields this screen uses, including the serving node, before showing a currency or actions. */
export function accountOverview(raw: unknown, expectedNode: string): InfoResponse | null {
  if (!object(raw) || !object(raw.node) || !address(raw.node.address) || raw.node.address.toLowerCase() !== expectedNode.toLowerCase()
    || typeof raw.node.endpoint !== 'string' || typeof raw.node.version !== 'string'
    || raw.node.chain_id !== undefined && !count(raw.node.chain_id)
    || !object(raw.ledger) || !['ain', 'local'].includes(raw.ledger.kind) || !count(raw.ledger.records)
    || raw.ledger.height !== undefined && !count(raw.ledger.height)
    || raw.ledger.provider != null && typeof raw.ledger.provider !== 'string'
    || raw.ledger.app != null && typeof raw.ledger.app !== 'string'
    || raw.ledger.head != null && typeof raw.ledger.head !== 'string'
    || !['AIN', 'CREDIT', 'USDC'].includes(raw.currency) || !count(raw.quorum)) return null;
  return raw as InfoResponse;
}

/** Optional labels must never crash the financial screen or relabel another record after a failed read. */
export function accountKnowledgeReferences(raw: unknown): Array<{ id: string; author: string; authorName: string | null; contributors: Array<{ address: string; signer: string | null; name: string | null }>; verifiers: string[] }> | null {
  if (!object(raw) || !Array.isArray(raw.items)) return null;
  const ids = new Set<string>();
  const rows = [];
  for (const entry of raw.items) {
    const a = entry?.anchor;
    if (!object(entry) || !object(a) || typeof a.id !== 'string' || !a.id || ids.has(a.id) || !address(a.author)
      || a.author_name != null && typeof a.author_name !== 'string'
      || a.contributors != null && !Array.isArray(a.contributors) || entry.verifiers != null && !Array.isArray(entry.verifiers)) return null;
    const contributors = a.contributors ?? [], verifiers = entry.verifiers ?? [];
    if (!contributors.every((c: unknown) => object(c) && address(c.address) && (c.signer == null || address(c.signer)) && (c.name == null || typeof c.name === 'string')) || !verifiers.every(address)) return null;
    rows.push({ id: a.id, author: a.author, authorName: a.author_name ?? null, contributors: contributors.map((c: any) => ({ address: c.address, signer: c.signer ?? null, name: c.name ?? null })), verifiers });
    ids.add(a.id);
  }
  return rows;
}

export function accountChainReady(info: InfoResponse | null): boolean {
  if (!info || info.ledger.kind !== 'ain' || !count(info.node.chain_id) || typeof info.ledger.provider !== 'string') return false;
  try { const url = new URL(info.ledger.provider); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}

/** Native chain balance is AIN even when the marketplace prices goods in another currency. */
export function accountBalanceCurrency(wallet: WalletResponse | null, info: InfoResponse | null): string | null {
  if (!wallet || !info || typeof wallet.address !== 'string' || wallet.address.toLowerCase() !== info.node.address.toLowerCase() || wallet.kind !== info.ledger.kind) return null;
  if (wallet.kind === 'local') return info.currency;
  if (wallet.kind !== 'ain' || !accountChainReady(info) || typeof wallet.provider !== 'string') return null;
  try { return new URL(wallet.provider).href === new URL(info.ledger.provider!).href ? 'AIN' : null; }
  catch { return null; }
}
