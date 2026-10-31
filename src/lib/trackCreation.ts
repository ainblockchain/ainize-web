import { dashboardInventory } from './dashboardView';
import { trackBranches } from './trackView';
import { requireRuntimeOperator } from './loadKnowledge';

export type TrackCreation = { name: string; description: string; context: Record<string, string>; patch_ids: string[] };
export class TrackCreationError extends Error {
  constructor(readonly code: 'name' | 'context' | 'changed' | 'exists' | 'unconfirmed') { super(code); }
}
export function trackCreationInput(name: string, description: string, rows: { k: string; v: string }[], patch_ids: string[]): TrackCreation {
  name = name.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9/_-]{1,63}$/.test(name)) throw new TrackCreationError('name');
  const entries = rows.filter(r => r.k.trim() || r.v.trim()).map(r => [r.k.trim(), r.v.trim()]);
  if (entries.some(([k]) => !k) || new Set(entries.map(([k]) => k)).size !== entries.length) throw new TrackCreationError('context');
  if (new Set(patch_ids).size !== patch_ids.length || patch_ids.some(id => !id.trim())) throw new TrackCreationError('changed');
  return { name, description: description.trim(), context: Object.fromEntries(entries), patch_ids: [...patch_ids] };
}
const same = (actual: unknown, expected: TrackCreation, node: string): boolean => {
  if (!actual || typeof actual !== 'object') return false;
  const b = actual as Record<string, any>;
  return b.name === expected.name && typeof b.owner === 'string' && b.owner.toLowerCase() === node.toLowerCase()
    && b.description === expected.description && Number.isSafeInteger(b.created_at) && b.created_at >= 0
    && Array.isArray(b.patch_ids) && JSON.stringify(b.patch_ids) === JSON.stringify(expected.patch_ids)
    && b.context && typeof b.context === 'object' && !Array.isArray(b.context)
    && Object.keys(b.context).length === Object.keys(expected.context).length
    && Object.entries(expected.context).every(([k, v]) => Object.hasOwn(b.context, k) && b.context[k] === v)
    && b.archived !== true && (b.visibility == null || b.visibility === 'public');
};

/** No retry of a write after a lost response. Only exact receipt and fresh public state confirm creation. */
export async function createTrack(input: TrackCreation, deps: {
  current: () => boolean; node: string | null; subject: string | null; readAccess: () => Promise<unknown>;
  readBranches: () => Promise<unknown>; readInventory: () => Promise<unknown>; write: (input: TrackCreation) => Promise<unknown>;
}) {
  const expected = structuredClone(input);
  if (!await requireRuntimeOperator(deps)) return null;
  const before = trackBranches(await deps.readBranches());
  if (!deps.current()) return null;
  if (!before) throw new TrackCreationError('changed');
  if (before.branches.some(b => b.name === expected.name)) throw new TrackCreationError('exists');
  if (expected.patch_ids.length) {
    const entries = dashboardInventory(await deps.readInventory());
    if (!deps.current()) return null;
    if (!entries || expected.patch_ids.some(id => !entries.some(e => e.anchor.id === id && e.status === 'VERIFIED'
      && e.anchor.author.toLowerCase() === deps.node!.toLowerCase()))) throw new TrackCreationError('changed');
  }
  if (!await requireRuntimeOperator(deps)) return null;
  let reply: unknown;
  try { reply = await deps.write(structuredClone(expected)); }
  catch { if (deps.current()) throw new TrackCreationError('unconfirmed'); return null; }
  if (!deps.current()) return null;
  if (!reply || typeof reply !== 'object' || !same((reply as any).branch, expected, deps.node!)) throw new TrackCreationError('unconfirmed');
  let after;
  try { after = trackBranches(await deps.readBranches()); }
  catch { if (deps.current()) throw new TrackCreationError('unconfirmed'); return null; }
  if (!deps.current()) return null;
  const branch = after?.branches.find(b => b.name === expected.name);
  if (!same(branch, expected, deps.node!) || branch!.created_at !== (reply as any).branch.created_at) throw new TrackCreationError('unconfirmed');
  return expected.name;
}
