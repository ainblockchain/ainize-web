import type { InfoResponse, NodesResponse } from '../api/types';

const object = (v: unknown): Record<string, any> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const text = (v: unknown): v is string => typeof v === 'string';
const optionalText = (v: unknown) => v == null || text(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(text);
const kind = (v: unknown) => v === 'local' || v === 'ain';
function peer(raw: unknown): boolean {
  const p = object(raw);
  return !!p && text(p.address) && optionalText(p.name) && optionalText(p.endpoint) && strings(p.roles) && kind(p.ledger)
    && optionalText(p.model) && strings(p.blobs) && strings(p.branches) && optionalText(p.version)
    && (p.blobs_advertised == null || count(p.blobs_advertised)) && (p.last_seen == null || count(p.last_seen))
    && (p.shares == null || !!object(p.shares) && ['royalty', 'teach'].every(k => p.shares[k] == null || typeof p.shares[k] === 'number' && Number.isFinite(p.shares[k]) && p.shares[k] >= 0 && p.shares[k] <= 1))
    && (p.quorum == null || count(p.quorum)) && optionalText(p.default_price);
}
function health(raw: unknown): boolean {
  const p = object(raw);
  return !!p && kind(p.ledger) && ['known', 'reachable', 'unreachable', 'verifiers', 'ledger_mismatch'].every(k => count(p[k]))
    && Array.isArray(p.mismatched) && p.mismatched.every((m: any) => object(m) && optionalText(m.endpoint) && optionalText(m.name) && text(m.ledger));
}

/** Check the values this view renders; no invented healthy/empty defaults for malformed replies. */
export function networkInfo(raw: unknown): InfoResponse | null {
  const p = object(raw), rt = object(p?.runtime), ledger = object(p?.ledger);
  if (!p || !peer(p.node) || !ledger || !kind(ledger.kind) || !count(ledger.records) || !optionalText(ledger.provider)
    || !count(p.peers) || !rt || typeof rt.available !== 'boolean' || typeof rt.hook !== 'boolean'
    || !['model', 'error', 'api', 'repo'].every(k => optionalText(rt[k])) || (p.peer_status != null && !health(p.peer_status))) return null;
  const d = p.disk;
  if (d != null && (!object(d) || !['total', 'blobs', 'datasets', 'uploads', 'db', 'reclaimable_bytes', 'reclaimable_files'].every(k => count(d[k])) || (d.free !== null && !count(d.free)))) return null;
  return p as InfoResponse;
}
export function networkNodes(raw: unknown): NodesResponse | null {
  const p = object(raw);
  if (!p || !text(p.self) || !Array.isArray(p.nodes) || !p.nodes.every(peer) || !Array.isArray(p.peers)
    || (p.peer_status != null && !health(p.peer_status))) return null;
  if (!p.peers.every((n: any) => object(n) && optionalText(n.address) && optionalText(n.endpoint) && optionalText(n.name)
    && count(n.last_seen) && count(n.failures) && (n.info === null || peer(n.info)))) return null;
  return p as NodesResponse;
}

export interface NetworkRecord { listed: number; sold: number; attested: number; challenged: number; since: number }
export function networkRecords(raw: unknown) {
  const p = object(raw), info = object(p?.info);
  if (!p || !info || !count(info.records) || !Array.isArray(p.records) || p.records.length > info.records) return null;
  const rows = new Map<string, NetworkRecord>(), seenHashes = new Set<string>();
  const at = (address: string, ts: number) => {
    const key = address.toLowerCase(), row = rows.get(key) ?? { listed: 0, sold: 0, attested: 0, challenged: 0, since: ts };
    row.since = Math.min(row.since, ts); rows.set(key, row); return row;
  };
  for (const r of p.records) {
    if (!object(r) || !text(r.hash) || !r.hash || seenHashes.has(r.hash) || !text(r.kind) || !count(r.ts)) return null;
    seenHashes.add(r.hash);
    if (!['anchor', 'attest', 'challenge', 'settle', 'node'].includes(r.kind)) continue;
    const b = object(r.body); if (!b) return null;
    const addressField = ({ anchor: 'author', attest: 'verifier', challenge: 'challenger', node: 'address' } as Record<string, string>)[r.kind];
    if (addressField && (!text(b[addressField]) || !b[addressField])) return null;
    if (r.kind === 'anchor') at(b.author, r.ts).listed++;
    if (r.kind === 'attest') at(b.verifier, r.ts).attested++;
    if (r.kind === 'challenge') at(b.challenger, r.ts).challenged++;
    if (r.kind === 'node') at(b.address, r.ts);
    if (r.kind === 'settle') {
      if (!text(b.seller) || !b.seller || !text(b.buyer) || !b.buyer || !text(b.amount) || !b.amount.trim() || !Number.isFinite(Number(b.amount)) || Number(b.amount) < 0) return null;
      const seller = at(b.seller, r.ts); at(b.buyer, r.ts);
      if (Number(b.amount) > 0 && b.seller.toLowerCase() !== b.buyer.toLowerCase()) seller.sold++;
    }
  }
  return { rows, shown: p.records.length as number, total: info.records, partial: p.records.length < info.records };
}
