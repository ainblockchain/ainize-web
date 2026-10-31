import type { PatchDetail } from '../api/types';
import { managedKnowledge, managementMatchesAuthor } from './manageKnowledge';
import { sameAccountAddress } from './accountAccess';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 8.64e15;
const canonical = (v: unknown) => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value);
export class ManageLifecycleError extends Error {
  constructor(readonly code: 'price' | 'reason' | 'confirm' | 'read' | 'changed' | 'state' | 'unconfirmed' | 'access') { super(code); }
}
interface LifecycleDeps { current: () => boolean; read: () => Promise<unknown> }
export const sameManagedArtifact = (a: PatchDetail, b: PatchDetail) => a.anchor.id === b.anchor.id
  && sameAccountAddress(a.anchor.author, b.anchor.author) && a.anchor.patch_sha256 === b.anchor.patch_sha256
  && a.anchor.benchmark_hash === b.anchor.benchmark_hash && a.anchor.created_at === b.anchor.created_at
  && canonical(a.anchor.model) === canonical(b.anchor.model);
export const sameDraftPreview = (a: PatchDetail, b: PatchDetail) => sameManagedArtifact(a, b) && canonical(a.anchor) === canonical(b.anchor);
async function selected(expected: PatchDetail, deps: LifecycleDeps) {
  if (!deps.current()) return null;
  const fresh = managedKnowledge(await deps.read(), expected.anchor.id);
  if (!deps.current()) return null;
  if (!fresh || !fresh.owned || !managementMatchesAuthor(fresh, expected.anchor.author)) throw new ManageLifecycleError('read');
  if (!sameManagedArtifact(fresh, expected)) throw new ManageLifecycleError('changed');
  return fresh;
}
async function confirmRead(expected: PatchDetail, deps: LifecycleDeps) {
  try { return await selected(expected, deps); }
  catch { throw new ManageLifecycleError('unconfirmed'); }
}
const why = (value: string) => { const reason = value.trim(); if (reason.length > 500) throw new ManageLifecycleError('reason'); return reason; };
const retired = (p: PatchDetail) => p.status === 'RETIRED' || p.retired_at != null;

export async function changeManagedPrice(expected: PatchDetail, value: string, reasonText: string, deps: LifecycleDeps & { write: (price: string, reason: string) => Promise<unknown> }) {
  const price = value.trim(), reason = why(reasonText);
  if (!/^\d+(\.\d+)?$/.test(price)) throw new ManageLifecycleError('price');
  const fresh = await selected(expected, deps); if (!fresh) return null;
  if (fresh.status === 'DRAFT' || retired(fresh)) throw new ManageLifecycleError('state');
  if (fresh.anchor.currency !== expected.anchor.currency) throw new ManageLifecycleError('changed');
  if (fresh.anchor.price === price) return { detail: fresh, already: true };
  if (fresh.anchor.price !== expected.anchor.price) throw new ManageLifecycleError('changed');
  const reply = await deps.write(price, reason);
  if (!deps.current()) return null;
  if (!object(reply) || reply.ok !== true || reply.patch_id !== expected.anchor.id || reply.price !== price
    || reply.previous !== fresh.anchor.price || reply.currency !== fresh.anchor.currency || !time(reply.created_at)) throw new ManageLifecycleError('unconfirmed');
  const after = await confirmRead(expected, deps); if (!after) return null;
  if (after.anchor.price !== price || after.anchor.currency !== fresh.anchor.currency || retired(after) || after.status === 'DRAFT') throw new ManageLifecycleError('unconfirmed');
  return { detail: after, already: false };
}

export async function retireManagedKnowledge(expected: PatchDetail, typedId: string, reasonText: string, deps: LifecycleDeps & { write: (reason: string) => Promise<unknown> }) {
  if (typedId.trim() !== expected.anchor.id) throw new ManageLifecycleError('confirm');
  const reason = why(reasonText), fresh = await selected(expected, deps); if (!fresh) return null;
  if (fresh.status === 'DRAFT') throw new ManageLifecycleError('state');
  if (fresh.status === 'RETIRED' && fresh.sellable === false && time(fresh.retired_at)) return { detail: fresh, already: true };
  const reply = await deps.write(reason);
  if (!deps.current()) return null;
  if (!object(reply) || reply.ok !== true || reply.patch_id !== expected.anchor.id || reply.reason !== reason || !time(reply.retired_at)) throw new ManageLifecycleError('unconfirmed');
  const after = await confirmRead(expected, deps); if (!after) return null;
  if (after.status !== 'RETIRED' || after.sellable !== false || after.retired_at !== reply.retired_at || after.retire_reason !== reason) throw new ManageLifecycleError('unconfirmed');
  return { detail: after, already: false };
}

/** A draft 404 may also mean lost permission: confirm the same operator session before claiming deletion. */
export async function deleteManagedDraft(expected: PatchDetail, subject: string | null, deps: LifecycleDeps & { write: () => Promise<unknown>; readAccess: () => Promise<unknown> }) {
  const fresh = await selected(expected, deps); if (!fresh) return null;
  if (fresh.status !== 'DRAFT') throw new ManageLifecycleError('state');
  if (!sameDraftPreview(fresh, expected)) throw new ManageLifecycleError('changed');
  const reply = await deps.write();
  if (!deps.current()) return null;
  if (!object(reply) || reply.ok !== true) throw new ManageLifecycleError('unconfirmed');
  let missing = false;
  try { await deps.read(); } catch (error) { missing = object(error) && error.status === 404; }
  if (!deps.current()) return null;
  if (!missing) throw new ManageLifecycleError('unconfirmed');
  let access: unknown;
  try { access = await deps.readAccess(); } catch { throw new ManageLifecycleError('access'); }
  if (!deps.current()) return null;
  if (!object(access) || access.signedIn !== true || access.isOwner !== true || !sameAccountAddress(access.subject, subject)) throw new ManageLifecycleError('access');
  return { deleted: true };
}
