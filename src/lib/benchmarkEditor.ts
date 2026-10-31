export interface BenchmarkSampleDraft { prompt: string; expect: string; [key: string]: unknown }
export interface BenchmarkDraft {
  schema: string; queries: number | BenchmarkSampleDraft[]; format: string | string[];
  samples?: BenchmarkSampleDraft[]; collateral_bound_nat?: number; [key: string]: unknown;
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const samples = (v: unknown): v is BenchmarkSampleDraft[] => Array.isArray(v) && v.every(q => object(q) && typeof q.prompt === 'string' && typeof q.expect === 'string');
export type BenchmarkIssue = 'json' | 'object' | 'schema' | 'queries' | 'format' | 'samples' | 'bound' | 'sample_prompt' | 'sample_count';

/** Draft reads preserve incomplete numeric edits. Submission validates them, never coerces them. */
export function readBenchmarkDraft(text: string, complete = false): { value: BenchmarkDraft; issue?: never } | { value?: never; issue: BenchmarkIssue } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { issue: 'json' }; }
  if (!object(raw)) return { issue: 'object' };
  if (typeof raw.schema !== 'string' || complete && !raw.schema.trim()) return { issue: 'schema' };
  if (!(typeof raw.queries === 'number' && Number.isFinite(raw.queries) || samples(raw.queries))) return { issue: 'queries' };
  if (complete && typeof raw.queries === 'number' && (!Number.isSafeInteger(raw.queries) || raw.queries < 0)) return { issue: 'queries' };
  if (!(typeof raw.format === 'string' || Array.isArray(raw.format) && raw.format.every(f => typeof f === 'string'))) return { issue: 'format' };
  if (raw.samples !== undefined && !samples(raw.samples)) return { issue: 'samples' };
  if (raw.collateral_bound_nat !== undefined && (typeof raw.collateral_bound_nat !== 'number' || !Number.isFinite(raw.collateral_bound_nat) || complete && raw.collateral_bound_nat < 0)) return { issue: 'bound' };
  if (complete) {
    const cases = [...(Array.isArray(raw.queries) ? raw.queries : []), ...(raw.samples as BenchmarkSampleDraft[] | undefined ?? [])];
    if (cases.some(q => !q.prompt.trim())) return { issue: 'sample_prompt' };
    const count = typeof raw.queries === 'number' ? raw.queries : (raw.queries as BenchmarkSampleDraft[]).length;
    if (count < ((raw.samples as BenchmarkSampleDraft[] | undefined)?.length ?? 0)) return { issue: 'sample_count' };
  }
  return { value: raw as unknown as BenchmarkDraft };
}

export const benchmarkEditorSamples = (draft: BenchmarkDraft): BenchmarkSampleDraft[] => draft.samples ?? (Array.isArray(draft.queries) ? draft.queries : []);

/** Legacy inline questions remain in queries; separate samples and all extra fields keep their meaning. */
export function editBenchmarkDraft(draft: BenchmarkDraft, patch: Partial<BenchmarkDraft>): BenchmarkDraft {
  const next = { ...draft, ...patch };
  if (patch.samples !== undefined && draft.samples === undefined && Array.isArray(draft.queries)) {
    next.queries = patch.samples; delete next.samples;
  }
  if (patch.collateral_bound_nat === undefined && Object.hasOwn(patch, 'collateral_bound_nat')) delete next.collateral_bound_nat;
  return next;
}
