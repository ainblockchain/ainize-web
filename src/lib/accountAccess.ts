import type { Binding, NodeOwner } from '../api/types';
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const validAccountAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const address = validAccountAddress;
export const sameAccountAddress = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && !!a && !!b && a.toLowerCase() === b.toLowerCase();
const date = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 8.64e15;
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

export function accountOwners(raw: unknown): NodeOwner[] | null {
  if (!object(raw) || !Array.isArray(raw.owners)) return null;
  const seen = new Set<string>();
  for (const row of raw.owners) {
    if (!object(row) || !address(row.address) || seen.has(row.address.toLowerCase()) || !['node', 'config', 'granted'].includes(row.source)
      || row.added_at != null && !date(row.added_at) || row.added_by != null && !address(row.added_by) || row.note != null && typeof row.note !== 'string') return null;
    seen.add(row.address.toLowerCase());
  }
  if (raw.owners.filter((r: NodeOwner) => r.source === 'node').length !== 1) return null;
  return raw.owners as NodeOwner[];
}
export function ownerRemovalReason(row: NodeOwner, actor: string | null): 'protected' | 'unknown_actor' | 'self' | null {
  if (row.source !== 'granted') return 'protected';
  if (!address(actor)) return 'unknown_actor';
  return sameAccountAddress(row.address, actor) ? 'self' : null;
}
export function accountBindings(raw: unknown, actor: string | null): { bindings: Binding[]; via: string | null } | null {
  if (!object(raw) || !address(actor) || !Array.isArray(raw.bindings) || raw.via !== null && !address(raw.via)) return null;
  const seen = new Set<string>();
  for (const row of raw.bindings) {
    if (!object(row) || !address(row.delegate) || seen.has(row.delegate.toLowerCase()) || !sameAccountAddress(row.owner, actor)
      || !date(row.created_at) || row.last_seen_at != null && !date(row.last_seen_at) || row.label != null && typeof row.label !== 'string') return null;
    seen.add(row.delegate.toLowerCase());
  }
  if (raw.via !== null && !seen.has(raw.via.toLowerCase())) return null;
  return raw as { bindings: Binding[]; via: string | null };
}
export class AccessActionError extends Error {
  constructor(readonly code: 'address' | 'read' | 'protected' | 'unknown_actor' | 'self' | 'missing' | 'unconfirmed') { super(code); }
}

export async function changeAccountOwner(kind: 'add' | 'remove', target: string, actor: string | null, deps: {
  current: () => boolean; read: () => Promise<unknown>; write: (address: string) => Promise<unknown>;
}) {
  const selected = target.trim(); if (!address(selected)) throw new AccessActionError('address');
  if (!deps.current()) return null;
  const before = accountOwners(await deps.read());
  if (!deps.current()) return null;
  if (!before) throw new AccessActionError('read');
  const existing = before.find(row => sameAccountAddress(row.address, selected));
  if (kind === 'add' && existing) return { address: existing.address, already: true, ended: 0 };
  if (kind === 'remove') {
    if (!existing) throw new AccessActionError('missing');
    const reason = ownerRemovalReason(existing, actor); if (reason) throw new AccessActionError(reason);
  }
  const reply = await deps.write(selected);
  if (!deps.current()) return null;
  const returned = accountOwners(reply);
  if (!object(reply) || reply.ok !== true || !sameAccountAddress(reply.address, selected) || !returned
    || returned.some(row => sameAccountAddress(row.address, selected)) !== (kind === 'add')
    || (kind === 'add' ? typeof reply.already !== 'boolean' : !count(reply.sessions_ended))) throw new AccessActionError('unconfirmed');
  let after;
  try { after = accountOwners(await deps.read()); } catch { throw new AccessActionError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!after || after.some(row => sameAccountAddress(row.address, selected)) !== (kind === 'add')) throw new AccessActionError('unconfirmed');
  return { address: selected, already: kind === 'add' && reply.already, ended: kind === 'remove' ? reply.sessions_ended as number : 0 };
}

export async function endAccountBinding(target: string, actor: string | null, deps: {
  current: () => boolean; read: () => Promise<unknown>; write: (delegate: string) => Promise<unknown>;
}) {
  if (!address(target)) throw new AccessActionError('address');
  if (!deps.current()) return null;
  const before = accountBindings(await deps.read(), actor);
  if (!deps.current()) return null;
  if (!before) throw new AccessActionError('read');
  const selected = before.bindings.find(row => sameAccountAddress(row.delegate, target));
  if (!selected) throw new AccessActionError('missing');
  const self = sameAccountAddress(before.via, selected.delegate);
  const reply = await deps.write(selected.delegate);
  if (!deps.current()) return null;
  const returned = object(reply) ? accountBindings({ bindings: reply.bindings, via: self ? null : before.via }, actor) : null;
  if (!object(reply) || reply.ok !== true || !sameAccountAddress(reply.delegate, selected.delegate) || !count(reply.sessions_ended)
    || !returned || returned.bindings.some(row => sameAccountAddress(row.delegate, selected.delegate))) throw new AccessActionError('unconfirmed');
  // Ending the key used for this request invalidates this session; its response is the final acknowledgement.
  if (!self) {
    let after;
    try { after = accountBindings(await deps.read(), actor); } catch { throw new AccessActionError('unconfirmed'); }
    if (!deps.current()) return null;
    if (!after || after.bindings.some(row => sameAccountAddress(row.delegate, selected.delegate))) throw new AccessActionError('unconfirmed');
  }
  return { delegate: selected.delegate, ended: reply.sessions_ended as number, self };
}
