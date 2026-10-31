import type { EventRow, LedgerRecord } from '../api/types';
import { ledgerView } from './ledgerView';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
const LOG_QUERY_KEYS = ['limit', 'level', 'kind', 'follow'] as const;

export function readLogSelection(params: URLSearchParams, scope: 'node' | 'knowledge') {
  const rawLimit = params.get('limit') ?? (scope === 'node' ? '200' : '100');
  const limit = Number(rawLimit), level = params.get('level') ?? 'all', kind = params.get('kind') ?? 'all', follow = params.get('follow') ?? '1';
  const valid = !LOG_QUERY_KEYS.some(k => params.getAll(k).length > 1)
    && /^[1-9][0-9]*$/.test(rawLimit) && Number.isSafeInteger(limit) && Number.isSafeInteger(limit + 200)
    && (level === 'all' || (LOG_LEVELS as readonly string[]).includes(level))
    && !!kind.trim() && !/[\u0000-\u001f\u007f]/.test(kind) && kind.length <= 200
    && (scope === 'node' || !params.has('kind')) && ['0', '1'].includes(follow);
  return { valid, limit, level, kind, follow: follow === '1' };
}

/** Preserve route, unrelated query fields and anchor in one history entry for each log control. */
export function logSelectionHref(location: { pathname: string; search: string; hash: string }, changes: Partial<Record<typeof LOG_QUERY_KEYS[number], string | null>>) {
  const params = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(changes)) { if (value === null) params.delete(key); else params.set(key, value); }
  return location.pathname + (params.size ? `?${params}` : '') + location.hash;
}

/** Identity and node are both necessary: localStorage is shared by accounts and a site may change its backing node. */
export function logSeenKey(identity: string, node: string | null | undefined): string | null {
  return node?.trim() ? `ainize.nodelog.seen.v2:${JSON.stringify([identity, node])}` : null;
}
export function readLogSeen(value: string | null): number {
  const n = Number(value);
  return value !== null && /^[0-9]+$/.test(value) && Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

/** Record only an observed event timestamp, never the browser clock or the end of an in-flight read. */
export function logSeenThrough(rows: readonly EventRow[]): number | null {
  return rows.length ? rows.reduce((max, e) => Math.max(max, e.ts), 0) : null;
}
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

export function logCommand(level: string, kind: string, follow: boolean, limit?: number): string {
  const quote = (s: string) => `'${s.replace(/'/g, `'"'"'`)}'`;
  return `ainize logs${follow ? ' --follow' : ''}${LOG_LEVELS.includes(level as EventRow['level']) ? ` --level ${level}` : ''}${kind !== 'all' ? ` --kind ${quote(kind)}` : ''}${limit !== undefined && Number.isSafeInteger(limit) && limit > 0 ? ` --limit ${limit}` : ''}`;
}
