export const DEFAULT_BENCHMARK_TEXT = JSON.stringify({ schema: '', queries: 0, format: ['template'], samples: [] }, null, 2);
export interface NewPatchDraft {
  name: string; id: string; description: string; modelId: string; priceV: string; license: string;
  parents: string; branch: string; topic: string; asOf: string; benchText: string; source: 'upload' | 'path'; path: string;
}
export const emptyNewPatchDraft = (modelId = ''): NewPatchDraft => ({
  name: '', id: '', description: '', modelId, priceV: '0.1', license: '', parents: '', branch: '', topic: '', asOf: '',
  benchText: DEFAULT_BENCHMARK_TEXT, source: 'upload', path: '',
});
export const newPatchDraftKey = (identity: string, from: string | null) => `ainize.new-patch.form.v2:${JSON.stringify([identity, from])}`;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Partial stored drafts are allowed, but a corrupt shape must not reach controlled inputs. */
export function readNewPatchDraft(text: string | null): Partial<NewPatchDraft> | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    if (!object(value)) return null;
    const next: Partial<NewPatchDraft> = {};
    for (const key of Object.keys(emptyNewPatchDraft()) as (keyof NewPatchDraft)[]) {
      if (value[key] === undefined) continue;
      if (typeof value[key] !== 'string') return null;
      if (key === 'source') {
        if (value[key] !== 'upload' && value[key] !== 'path') return null;
        next.source = value[key];
      } else next[key] = value[key];
    }
    return Object.keys(next).length ? next : null;
  } catch { return null; }
}

/** Resolve the requested anchor directly; never substitute a catalog neighbour or truncate its benchmark. */
export function newPatchFromSource(value: unknown, id: string): NewPatchDraft | null {
  if (!object(value) || !object(value.anchor)) return null;
  const a = value.anchor;
  if (a.id !== id || !object(a.model) || typeof a.model.id_M !== 'string' || typeof a.price !== 'string' || !object(a.benchmark)) return null;
  for (const field of ['name', 'description', 'branch', 'topic_path', 'as_of', 'license']) {
    if (a[field] !== undefined && typeof a[field] !== 'string') return null;
  }
  const suffix = id.endsWith('-v2') ? '-v3' : '-v2';
  return {
    ...emptyNewPatchDraft(a.model.id_M), name: a.name as string ?? '', id: `${id.slice(0, 64 - suffix.length)}${suffix}`,
    description: a.description as string ?? '', priceV: a.price, parents: id, branch: a.branch as string ?? '',
    topic: a.topic_path as string ?? '', asOf: a.as_of as string ?? '', license: a.license as string ?? '',
    benchText: JSON.stringify(a.benchmark, null, 2),
  };
}

export const hasNewPatchEdits = (draft: NewPatchDraft, initial: NewPatchDraft) =>
  (Object.keys(initial) as (keyof NewPatchDraft)[]).some(key => draft[key] !== initial[key]);
