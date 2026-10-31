import type { OrgGroupView } from '../api/organizations';

const object = (raw: unknown): Record<string, unknown> | null => raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
const strings = (raw: unknown): raw is string[] => Array.isArray(raw) && raw.every(v => typeof v === 'string' && !!v.trim()) && new Set(raw).size === raw.length;
export function orgGroup(raw: unknown): OrgGroupView | null {
  const r = object(raw);
  return r && typeof r.id === 'string' && !!r.id.trim() && typeof r.name === 'string' && strings(r.members) && strings(r.agents)
    ? { id: r.id, name: r.name, members: r.members, agents: r.agents } : null;
}
export function orgGroups(raw: unknown): OrgGroupView[] | null {
  const rows = object(raw)?.groups;
  if (!Array.isArray(rows)) return null;
  const groups = rows.map(orgGroup);
  return groups.every((g): g is OrgGroupView => !!g) && new Set(groups.map(g => g.id)).size === groups.length ? groups : null;
}
export function sameOrgGroup(a: OrgGroupView | undefined, b: OrgGroupView): boolean {
  return !!a && a.id === b.id && a.name === b.name && sameSet(a.members, b.members) && sameSet(a.agents, b.agents);
}
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(v => b.includes(v));
export const missingGroupSelections = (selected: string[], available: string[]) => selected.filter(v => !available.includes(v));

export class OrgGroupError extends Error {
  constructor(readonly code: 'read_failed' | 'changed' | 'unconfirmed') { super(code); }
}

/** Re-read the selected group before a write, preserving the draft when the saved group changed. */
export async function saveSelectedOrgGroup(original: OrgGroupView | null, draft: Omit<OrgGroupView, 'id'>, deps: {
  read: () => Promise<unknown>; save: () => Promise<unknown>; isCurrent: () => boolean;
}) {
  if (!deps.isCurrent()) return null;
  const raw = await deps.read();
  if (!deps.isCurrent()) return null;
  const groups = orgGroups(raw);
  if (!groups) throw new OrgGroupError('read_failed');
  if (original && !sameOrgGroup(groups.find(g => g.id === original.id), original)) throw new OrgGroupError('changed');
  const answer = await deps.save();
  if (!deps.isCurrent()) return null;
  const saved = orgGroup(object(answer)?.group);
  if (!saved || (original && saved.id !== original.id) || saved.name !== draft.name || !sameSet(saved.members, draft.members) || !sameSet(saved.agents, draft.agents)) throw new OrgGroupError('unconfirmed');
  return saved;
}

export function confirmGroupDeletion(raw: unknown, id: string) {
  if (object(raw)?.deleted !== id) throw new OrgGroupError('unconfirmed');
}
