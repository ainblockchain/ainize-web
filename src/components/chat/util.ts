import { useEffect, useState } from 'react';
import type { CatalogEntry, ChatLock } from '@/api/types';
import { useT } from '@/i18n';

export type ChatModeKind = 'compare' | 'patched' | 'base';

/** Single source of truth for "accuracy shown only when an executed, passing attestation exists". */
export { executedAccuracy } from '@/components/public/PatchListItem';

/** "340ms" / "1.2초" (ko) or "1.2s" (en). */
export function fmtMs(ms: number | null | undefined, locale: 'ko' | 'en'): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}${locale === 'ko' ? '초' : 's'}`;
}

/** Shortest question that may be matched to a benchmark sample by containment — mirrors BENCH_MATCH_MIN on the node. */
export const BENCH_MATCH_MIN = 8;

/**
 * The benchmark sample that matches a prompt — the SAME rule the node uses for benchmark_hit
 * (packages/node/src/market.ts matchBenchmarkSample), so the ✓/✗ chip and the server never disagree.
 * Trimmed equality first (a chip sent verbatim still scores), then containment only for questions of at least
 * BENCH_MATCH_MIN characters: "드", "코드", "종목" and a bare space used to auto-score against
 * "종목코드 픽셀플러스 " and were shown as ✗ Wrong against a ticker the visitor never asked about.
 */
export function matchSample(entry: CatalogEntry | undefined, prompt: string): { prompt: string; expect: string } | undefined {
  const p = prompt.trim();
  if (!entry || !p) return undefined;
  const samples = entry.anchor.benchmark.samples;
  const exact = samples?.find((x) => x.prompt.trim() === p);
  if (exact) return exact;
  if (p.length < BENCH_MATCH_MIN) return undefined;
  return samples?.find((x) => p.includes(x.prompt.trim()) || x.prompt.trim().includes(p));
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

/** What a pending turn knows about its place in the queue behind the shared model (D3). */
export interface ChatQueueView {
  state: 'queued' | 'running';
  /** How long this request has been waiting, ticking on the client between polls. */
  waited_ms: number;
  /** 1 = next in line. */
  position: number;
  /** Who holds the shared model, with `since` already rendered ("started 40s ago"). */
  holder: { label: string; since: string } | null;
}

/**
 * Locale-aware "started n minutes ago". `skewMs` is (browser clock − node clock) so the elapsed time is measured
 * against the node's clock: `since` comes from the node, and the two machines need not agree.
 */
export function useSince(skewMs = 0): (ts: number) => string {
  const { t } = useT();
  return (ts: number): string => {
    const s = Math.floor(Math.max(0, Date.now() - skewMs - ts) / 1000);
    if (s < 60) return t('chat.time.s', { n: s });
    const m = Math.floor(s / 60);
    if (m < 60) return t('chat.time.m', { n: m });
    return t('chat.time.h', { n: Math.floor(m / 60) });
  };
}

/** Re-render every second while `on` — the lock/queue clocks must tick, not freeze between polls. */
export function useTicker(on: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [on]);
  return tick;
}

/**
 * Should the "someone else is testing" banner be shown for this lock? (D3)
 * A holder whose process is gone, or whose 15-minute lease has expired, is broken by the next request — showing it
 * made the banner permanent on an idle node. A lock held by this node's own request gets a different line.
 */
export function lockKind(lock: ChatLock | null | undefined, heldByThisTab = false): 'none' | 'stale' | 'mine' | 'other' {
  if (!lock) return 'none';
  if (!lock.alive || lock.stale) return 'stale';
  // NOTE: lock.mine means "this NODE process holds it" — with two tabs on one node that is still someone else's
  // test, so the "your test" wording is driven by this tab's own in-flight request, not by the node flag.
  return heldByThisTab ? 'mine' : 'other';
}

/** Extract a numeric pid from the lock owner label ("pid:1234" → "1234"); falls back to the raw owner. */
export function lockOwnerLabel(owner: string): string {
  const m = /^pid:(\d+)$/.exec(owner);
  return m ? m[1] : owner;
}
