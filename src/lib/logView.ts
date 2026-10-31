import type { EventRow, LedgerRecord } from '../api/types';
import { ledgerView } from './ledgerView';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;

/** Validate the displayed window; a foreign knowledge row is not a partially usable response. */
export function logEvents(raw: unknown, patchId?: string): EventRow[] | null {
  if (!object(raw) || !Array.isArray(raw.events) || !raw.events.every((e: unknown) => object(e)
    && count(e.seq) && count(e.ts) && LOG_LEVELS.includes(e.level)
    && typeof e.kind === 'string' && !!e.kind && typeof e.message === 'string'
    && (e.patch_id === null || typeof e.patch_id === 'string') && (patchId === undefined || e.patch_id === patchId))) return null;
  if (new Set(raw.events.map((e: EventRow) => e.seq)).size !== raw.events.length) return null;
  return [...raw.events].sort((a, b) => b.seq - a.seq);
}

/** Severity is a floor, matching the server and CLI (info excludes debug, warn includes errors). */
export function filterLogEvents(rows: EventRow[], level: string, kind = 'all'): EventRow[] {
  const floor = LOG_LEVELS.indexOf(level as EventRow['level']);
  return rows.filter(e => (kind === 'all' || e.kind === kind) && (level === 'all' || floor >= 0 && LOG_LEVELS.indexOf(e.level) >= floor));
}

export function patchLogRecords(raw: unknown, id: string): LedgerRecord[] | null {
  if (!object(raw) || !Array.isArray(raw.records)) return null;
  const view = ledgerView({ records: raw.records, info: { kind: 'local', network: '', records: raw.records.length } }, '');
  return view && view.records.every(r => {
    const b = r.body as Record<string, unknown>;
    return ['id', 'patch_id', 'old_patch_id', 'new_patch_id'].some(key => b[key] === id);
  }) ? view.records : null;
}

export function logCommand(level: string, kind: string, follow: boolean): string {
  const quote = (s: string) => `'${s.replace(/'/g, `'"'"'`)}'`;
  return `ainize logs${follow ? ' --follow' : ''}${LOG_LEVELS.includes(level as EventRow['level']) ? ` --level ${level}` : ''}${kind !== 'all' ? ` --kind ${quote(kind)}` : ''}`;
}
