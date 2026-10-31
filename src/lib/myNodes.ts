import type { MyNode } from '../api/types';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const address = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const text = (v: unknown) => v === null || typeof v === 'string';
const count = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
export interface MyNodeList { nodes: MyNode[]; hub: string; hubAddress: string | null; reviewed: boolean }

export function readMyNodes(raw: unknown, owner: string): MyNodeList | null {
  if (!object(raw) || !Array.isArray(raw.nodes) || typeof raw.hub !== 'string') return null;
  if (raw.owner !== undefined && (typeof raw.owner !== 'string' || !same(raw.owner, owner))) return null;
  if (raw.hub_address !== undefined && !address(raw.hub_address)) return null;
  const ids = new Set<string>();
  for (const n of raw.nodes) {
    if (!object(n) || !address(n.address) || ids.has(n.address.toLowerCase()) || !text(n.name) || !text(n.ledger) || !text(n.version)
      || !Array.isArray(n.roles) || !n.roles.every((r: unknown) => typeof r === 'string')
      || !Array.isArray(n.agents) || !n.agents.every((a: unknown) => object(a) && typeof a.id === 'string' && !!a.id && typeof a.name === 'string')
      || ![true, false, null].includes(n.seen) || n.last_seen !== null && !count(n.last_seen) || !count(n.connected_at)
      || typeof n.is_this_hub !== 'boolean' || typeof n.operable !== 'boolean' || (raw.owner !== undefined || n.can_unlink !== undefined) && typeof n.can_unlink !== 'boolean'
      || n.revision != null && (typeof n.revision !== 'string' || !/^[a-f0-9]{64}$/.test(n.revision))
      || n.operable && !n.is_this_hub || raw.hub_address !== undefined && n.is_this_hub !== same(n.address, raw.hub_address)) return null;
    ids.add(n.address.toLowerCase());
  }
  if (raw.nodes.filter((n: MyNode) => n.is_this_hub).length > 1) return null;
  return { nodes: raw.nodes, hub: raw.hub, hubAddress: raw.hub_address ?? null, reviewed: typeof raw.owner === 'string' && address(raw.hub_address) };
}

export class NodeLinkActionError extends Error {
  constructor(readonly code: 'read' | 'changed' | 'unconfirmed') { super(code); }
}
export async function disconnectMyNode(selected: { address: string; revision: string; hubAddress: string }, owner: string, deps: {
  current: () => boolean; read: () => Promise<unknown>; write: (input: { address: string; expected_revision: string }) => Promise<unknown>;
}) {
  if (!deps.current()) return null;
  const before = readMyNodes(await deps.read(), owner);
  if (!deps.current()) return null;
  if (!before || !before.reviewed) throw new NodeLinkActionError('read');
  const target = before.nodes.find(n => same(n.address, selected.address));
  if (!target?.can_unlink || !target.revision || target.revision !== selected.revision || !same(before.hubAddress!, selected.hubAddress)) throw new NodeLinkActionError('changed');
  let reply: unknown;
  try { reply = await deps.write({ address: target.address, expected_revision: target.revision }); }
  catch { if (!deps.current()) return null; throw new NodeLinkActionError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!object(reply) || reply.ok !== true || !address(reply.address) || !same(reply.address, target.address) || reply.revision !== selected.revision) throw new NodeLinkActionError('unconfirmed');
  let after;
  try { after = readMyNodes(await deps.read(), owner); } catch { throw new NodeLinkActionError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!after?.reviewed || !same(after.hubAddress!, selected.hubAddress) || after.nodes.some(n => same(n.address, target.address) && !(n.is_this_hub && n.can_unlink === false && n.revision === null))) throw new NodeLinkActionError('unconfirmed');
  return { address: target.address };
}
