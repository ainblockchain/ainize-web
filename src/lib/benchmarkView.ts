import { benchmarkQuestionCount } from './benchmarkQuestions';
import type { CatalogEntry } from '../api/types';

const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const count = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const strings = (value: unknown) => Array.isArray(value) && value.every(v => typeof v === 'string');

/** Validate the fields the comparison consumes; do not silently drop a broken row from its totals. */
export function benchmarkView(raw: unknown, schema: string): { schema: string; items: CatalogEntry[] } | null {
  const view = object(raw);
  if (!view || view.schema !== schema || !Array.isArray(view.items)) return null;
  const valid = view.items.every((item: unknown) => {
    const row = object(item), anchor = object(row?.anchor), model = object(anchor?.model), benchmark = object(anchor?.benchmark);
    if (!row || !anchor || !model || !benchmark || typeof anchor.id !== 'string' || !anchor.id || typeof anchor.author !== 'string' || !anchor.author
      || typeof model.id_M !== 'string' || typeof row.status !== 'string' || row.status === 'DRAFT' || benchmark.schema !== schema || benchmarkQuestionCount(benchmark.queries) === null
      || !['created_at', 'rows', 'size_bytes'].every(k => count(anchor[k])) || !['passed', 'quorum', 'downloads'].every(k => count(row[k]))
      || typeof row.quorum_ok !== 'boolean' || !Array.isArray(row.attestations)) return false;
    if (typeof benchmark.format !== 'string' && !strings(benchmark.format)) return false;
    if (anchor.name != null && typeof anchor.name !== 'string') return false;
    if (anchor.price != null && !['string', 'number'].includes(typeof anchor.price)) return false;
    if (anchor.currency != null && typeof anchor.currency !== 'string') return false;
    if (anchor.benchmark_hash != null && typeof anchor.benchmark_hash !== 'string') return false;
    if (anchor.parents != null && !strings(anchor.parents)) return false;
    const base = anchor.base == null ? null : object(anchor.base);
    if (anchor.base != null && !base) return false;
    if (base?.stack != null && (!Array.isArray(base.stack) || !base.stack.every(s => typeof object(s)?.patch_id === 'string'))) return false;
    return row.attestations.every(a => {
      const entry = object(a);
      return !!entry && typeof entry.passed === 'boolean' && typeof entry.verified_on === 'string' && (entry.score == null || !!object(entry.score));
    });
  });
  if (!valid || new Set(view.items.map(item => item.anchor.id)).size !== view.items.length) return null;
  return { ...view, items: view.items.map(item => ({ ...item, anchor: { ...item.anchor, benchmark: { ...item.anchor.benchmark, queries: benchmarkQuestionCount(item.anchor.benchmark.queries)! } } })) } as unknown as { schema: string; items: CatalogEntry[] };
}
