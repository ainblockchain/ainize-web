import type { BranchInfo } from '../api/types';
import { trackBranches } from './trackView';
import { LoadKnowledgeError, requireRuntimeOperator } from './loadKnowledge';

export interface TrackAdditionReview {
  version: 1; revision: string; node: string; branch: BranchInfo; already: boolean; replaces: string[];
  item: { id: string; name: string; author: string; sha256: string; price: string; currency: string; status: string };
}
export class TrackAdditionError extends Error {
  constructor(readonly code: 'input' | 'changed' | 'busy' | 'unconfirmed') { super(code); }
}
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const text = (v: any): v is string => typeof v === 'string' && !!v.trim();
const strings = (v: any): v is string[] => Array.isArray(v) && v.every(text) && new Set(v).size === v.length;
const canonical = (v: unknown) => JSON.stringify(v, (_key, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
const record = (b: any) => ({ name: b?.name, owner: b?.owner, description: b?.description, context: b?.context,
  patch_ids: b?.patch_ids, created_at: b?.created_at, terms: b?.terms ?? null, visibility: b?.visibility ?? 'public', archived: b?.archived ?? false });

export function parseTrackAddition(raw: unknown, name: string, id: string, node: string | null): TrackAdditionReview | null {
  const r = (raw as any)?.review, b = r?.branch, i = r?.item;
  if (!object(r) || r.version !== 1 || typeof r.revision !== 'string' || !/^[a-f0-9]{64}$/.test(r.revision)
    || !node || r.node !== node || !object(b) || b.name !== name || typeof b.owner !== 'string' || b.owner.toLowerCase() !== node.toLowerCase()
    || b.archived === true || b.visibility != null && b.visibility !== 'public'
    || !trackBranches({ branches: [{ ...b, current: [], subscribers: [] }], mine: [] })
    || !object(i) || i.id !== id || ![i.id, i.name, i.author, i.sha256, i.currency, i.status].every(text)
    || typeof i.price !== 'string' || !/^\d+(?:\.\d+)?$/.test(i.price)
    || typeof r.already !== 'boolean' || r.already !== b.patch_ids.includes(id)
    || !r.already && i.status !== 'VERIFIED' || !strings(r.replaces)
    || r.replaces.some((key: string) => key === id || !b.patch_ids.includes(key)) || r.already && r.replaces.length) return null;
  return structuredClone(r);
}
interface Reads {
  current: () => boolean; node: string | null; subject: string | null; readAccess: () => Promise<unknown>;
  review: (name: string, id: string) => Promise<unknown>;
}
export async function reviewTrackAddition(name: string, id: string, deps: Reads) {
  if (!text(name) || !text(id) || name !== name.trim() || id !== id.trim()) throw new TrackAdditionError('input');
  if (!await requireRuntimeOperator(deps)) return null;
  const raw = await deps.review(name, id);
  if (!deps.current()) return null;
  const review = parseTrackAddition(raw, name, id, deps.node);
  if (!review) throw new TrackAdditionError('changed');
  return review;
}
export async function confirmTrackAddition(input: TrackAdditionReview, deps: Reads & {
  write: (name: string, id: string, revision: string) => Promise<unknown>; readBranches: () => Promise<unknown>;
}) {
  const expected = structuredClone(input);
  const fresh = await reviewTrackAddition(expected.branch.name, expected.item.id, deps);
  if (!fresh) return null;
  if (canonical(fresh) !== canonical(expected)) throw new TrackAdditionError('changed');
  if (fresh.already) return { already: true, name: fresh.branch.name, id: fresh.item.id };
  if (!await requireRuntimeOperator(deps)) return null;
  let reply: any;
  try { reply = await deps.write(fresh.branch.name, fresh.item.id, fresh.revision); }
  catch (error: any) {
    if (!deps.current()) return null;
    if (error?.status === 401 || error?.status === 403) throw new LoadKnowledgeError('access');
    if (error?.status === 409 && typeof error?.data?.error === 'string') {
      if (error.data.error.startsWith('track_action_busy:')) throw new TrackAdditionError('busy');
      if (/^(track_review_changed|not_listed|branch_archived):/.test(error.data.error)) throw new TrackAdditionError('changed');
    }
    throw new TrackAdditionError('unconfirmed');
  }
  if (!deps.current()) return null;
  const target = { ...record(fresh.branch), patch_ids: [...fresh.branch.patch_ids, fresh.item.id] };
  if (canonical(record(reply?.branch)) !== canonical(target)) throw new TrackAdditionError('unconfirmed');
  let after;
  try { after = trackBranches(await deps.readBranches()); }
  catch { if (deps.current()) throw new TrackAdditionError('unconfirmed'); return null; }
  if (!deps.current()) return null;
  if (canonical(record(after?.branches.find(b => b.name === target.name))) !== canonical(target)) throw new TrackAdditionError('unconfirmed');
  return { already: false, name: fresh.branch.name, id: fresh.item.id };
}
