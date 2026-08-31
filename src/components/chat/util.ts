import type { CatalogEntry } from '@/api/types';

export type ChatModeKind = 'compare' | 'patched' | 'base';

/** Single source of truth for "accuracy shown only when an executed, passing attestation exists". */
export { executedAccuracy } from '@/components/public/PatchListItem';

/** "340ms" / "1.2초" (ko) or "1.2s" (en). */
export function fmtMs(ms: number | null | undefined, locale: 'ko' | 'en'): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}${locale === 'ko' ? '초' : 's'}`;
}

/** The benchmark sample that matches a prompt (same rule the node uses for benchmark_hit). */
export function matchSample(entry: CatalogEntry | undefined, prompt: string): { prompt: string; expect: string } | undefined {
  const p = prompt.trim();
  if (!entry || !p) return undefined;
  return entry.anchor.benchmark.samples?.find((x) => p.includes(x.prompt.trim()) || x.prompt.includes(p));
}

/** First matching sample across several selected knowledges (the node scores each one separately in benchmark_hits). */
export function matchSampleAny(entries: CatalogEntry[], prompt: string): { prompt: string; expect: string; patch_id: string } | undefined {
  for (const e of entries) { const s = matchSample(e, prompt); if (s) return { ...s, patch_id: e.anchor.id }; }
  return undefined;
}

/** Up to 3 knowledges per live test (server limit, spec §6.3). */
export const MAX_CHAT_PATCHES = 3;
/** Route param `/chat/a,b,c` ↔ ordered id list (ids never contain a comma: slug = [a-z0-9._-]). */
export const SEL_SEP = ',';
export function parseSelection(param: string | undefined): string[] {
  return [...new Set((param ?? '').split(SEL_SEP).map((s) => s.trim()).filter(Boolean))].slice(0, MAX_CHAT_PATCHES);
}
export function selectionPath(ids: string[]): string { return `/chat/${ids.map((id) => encodeURIComponent(id)).join(SEL_SEP)}`; }

/** Client-side check identical to the node's: answer (whitespace removed) contains the expected string. */
export function answerHits(content: string | undefined, expect: string | undefined): boolean | null {
  if (!content || !expect) return null;
  return content.replace(/\s/g, '').includes(expect);
}

/** Server limits for POST /api/chat (zod): at most 24 messages, each non-empty. We send the last 23 + the new prompt. */
export const MAX_HISTORY = 23;

/** Extract a numeric pid from the lock owner label ("pid:1234" → "1234"); falls back to the raw owner. */
export function lockOwnerLabel(owner: string): string {
  const m = /^pid:(\d+)$/.exec(owner);
  return m ? m[1] : owner;
}
