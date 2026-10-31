import type { PatchAnchor, PatchDetail } from '../api/types';
import { managedKnowledge, managementMatchesAuthor } from './manageKnowledge';
import { readBenchmarkDraft, type BenchmarkIssue } from './benchmarkEditor';

export interface ManageDraftValues { description: string; price: string; branch: string; license: string; billing: string; benchmark: string }
export type DraftGroup = 'fields' | 'benchmark';
export type DraftKey = keyof ManageDraftValues;
export interface ManageDraftEditor { base: ManageDraftValues; draft: ManageDraftValues }
export const draftGroupKeys: Record<DraftGroup, DraftKey[]> = { fields: ['description', 'price', 'branch', 'license', 'billing'], benchmark: ['benchmark'] };
const keys: DraftKey[] = [...draftGroupKeys.fields, 'benchmark'];
export const manageDraftValues = (a: PatchAnchor): ManageDraftValues => ({ description: a.description ?? '', price: a.price, branch: a.branch ?? '', license: a.license ?? '', billing: a.billing, benchmark: JSON.stringify(a.benchmark, null, 2) });
export const manageDraftEditor = (a: PatchAnchor): ManageDraftEditor => { const base = manageDraftValues(a); return { base, draft: { ...base } }; };
const stable = (v: any): string => JSON.stringify(v, (_key, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, value[k]])) : value);
const equivalent = (key: DraftKey, left: string, right: string): boolean => {
  if (key === 'price') return left.trim() === right.trim();
  if (key !== 'benchmark') return left === right;
  try { return stable(JSON.parse(left)) === stable(JSON.parse(right)); } catch { return left === right; }
};
export const draftDirty = (editor: ManageDraftEditor, group?: DraftGroup) => (group ? draftGroupKeys[group] : keys).some(key => editor.draft[key] !== editor.base[key]);
/** Dirty fields retain both their text and the baseline against which conflicts are checked. */
export function receiveManageDraft(editor: ManageDraftEditor | null, a: PatchAnchor): ManageDraftEditor {
  if (!editor) return manageDraftEditor(a);
  const latest = manageDraftValues(a), base = { ...editor.base }, draft = { ...editor.draft };
  for (const key of keys) if (editor.draft[key] === editor.base[key]) { base[key] = latest[key]; draft[key] = latest[key]; }
  return keys.every(key => base[key] === editor.base[key] && draft[key] === editor.draft[key]) ? editor : { base, draft };
}
export const draftConflicts = (editor: ManageDraftEditor, a: PatchAnchor, group: DraftGroup): DraftKey[] => {
  const latest = manageDraftValues(a);
  return draftGroupKeys[group].filter(key => editor.draft[key] !== editor.base[key] && !equivalent(key, latest[key], editor.base[key]) && !equivalent(key, latest[key], editor.draft[key]));
};
/** Explicitly accept the current server baseline, optionally retaining changes in this group. */
export function resolveDraftGroup(editor: ManageDraftEditor, a: PatchAnchor, group: DraftGroup, keep: boolean): ManageDraftEditor {
  const next = receiveManageDraft(editor, a), latest = manageDraftValues(a), base = { ...next.base }, draft = { ...next.draft };
  for (const key of draftGroupKeys[group]) {
    base[key] = latest[key];
    draft[key] = keep && editor.draft[key] !== editor.base[key] ? editor.draft[key] : latest[key];
  }
  return { base, draft };
}
export class ManageDraftError extends Error {
  constructor(readonly code: 'price' | 'billing' | 'read' | 'sealed' | 'conflict' | 'unconfirmed' | 'benchmark', readonly benchmarkIssue?: BenchmarkIssue) { super(code); }
}

/** Checks current fields; the server currently has no atomic version precondition for draft PATCH. */
export async function saveManageDraft(editor: ManageDraftEditor, group: DraftGroup, id: string, author: string, deps: {
  current: () => boolean; read: () => Promise<unknown>; write: (patch: Partial<PatchAnchor>) => Promise<unknown>;
}): Promise<{ detail: PatchDetail; wrote: boolean } | null> {
  if (!deps.current()) return null;
  const dirty = draftGroupKeys[group].filter(key => editor.draft[key] !== editor.base[key]);
  const desired = { ...editor.draft, price: editor.draft.price.trim() };
  if (dirty.includes('price') && !/^\d+(\.\d+)?$/.test(desired.price)) throw new ManageDraftError('price');
  if (dirty.includes('billing') && desired.billing !== 'per_download') throw new ManageDraftError('billing');
  let benchmark: unknown;
  if (dirty.includes('benchmark')) {
    const parsed = readBenchmarkDraft(desired.benchmark, true);
    if (!parsed.value) throw new ManageDraftError('benchmark', parsed.issue);
    benchmark = parsed.value;
  }
  const fresh = managedKnowledge(await deps.read(), id);
  if (!deps.current()) return null;
  if (!fresh || !fresh.owned || !managementMatchesAuthor(fresh, author)) throw new ManageDraftError('read');
  if (fresh.status !== 'DRAFT') throw new ManageDraftError('sealed');
  const before = manageDraftValues(fresh.anchor);
  const changed = dirty.filter(key => !equivalent(key, before[key], desired[key]));
  if (!changed.length) return { detail: fresh, wrote: false };
  if (draftConflicts(editor, fresh.anchor, group).length) throw new ManageDraftError('conflict');
  const patch = Object.fromEntries(changed.map(key => [key, key === 'benchmark' ? benchmark : desired[key]])) as Partial<PatchAnchor>;
  const response = await deps.write(patch) as { anchor?: unknown } | null;
  if (!deps.current()) return null;
  const acknowledged = managedKnowledge({ ...fresh, anchor: response?.anchor }, id);
  if (!acknowledged || !managementMatchesAuthor(acknowledged, author) || changed.some(key => !equivalent(key, manageDraftValues(acknowledged.anchor)[key], desired[key]))) throw new ManageDraftError('unconfirmed');
  let confirmed: PatchDetail | null;
  try { confirmed = managedKnowledge(await deps.read(), id); } catch { throw new ManageDraftError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!confirmed || !confirmed.owned || !managementMatchesAuthor(confirmed, author) || changed.some(key => !equivalent(key, manageDraftValues(confirmed!.anchor)[key], desired[key]))) throw new ManageDraftError('unconfirmed');
  return { detail: confirmed, wrote: true };
}
