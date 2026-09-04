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
 * The benchmark sample that matches a prompt. Trimmed equality first (a chip sent verbatim still scores), then
 * containment only ONE WAY and only for questions of at least BENCH_MATCH_MIN characters: the user typed the
 * sample plus extra words.
 *
 * Finding 60 — the other direction (`x.prompt.trim().includes(p)`) scored a TRUNCATION of a sample against that
 * sample: "종목코드 한화머시" is a prefix of "종목코드 한화머시너리앤서비스홀딩스 ", so a question about one company
 * was marked ✗ Wrong against another company's ticker, with the expected value nowhere on screen. The node's
 * matchBenchmarkSample still keeps both directions (packages/node/src/market.ts:378, out of this workstream's
 * reach), so the UI treats ITS OWN match as the gate: a verdict is rendered only for a prompt matched here, which
 * is why `expects` below is what TurnView scores against.
 */
export function matchSample(entry: CatalogEntry | undefined, prompt: string): { prompt: string; expect: string } | undefined {
  const p = prompt.trim();
  if (!entry || !p) return undefined;
  const samples = entry.anchor.benchmark.samples;
  const exact = samples?.find((x) => x.prompt.trim() === p);
  if (exact) return exact;
  if (p.length < BENCH_MATCH_MIN) return undefined;
  return samples?.find((x) => p.includes(x.prompt.trim()));
}

/** First matching sample across several selected knowledges (the node scores each one separately in benchmark_hits). */
export function matchSampleAny(entries: CatalogEntry[], prompt: string): { prompt: string; expect: string; patch_id: string } | undefined {
  for (const e of entries) { const s = matchSample(e, prompt); if (s) return { ...s, patch_id: e.anchor.id }; }
  return undefined;
}

/**
 * What EACH selected knowledge expects for this question (finding 223): the node answers once with everything
 * loaded and scores that one answer against every knowledge's own sample, so the bubble shows several verdicts of
 * one text. Rendering them needs each knowledge's expected value, not just the first match.
 */
export function matchSampleEach(entries: CatalogEntry[], prompt: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of entries) { const s = matchSample(e, prompt); if (s) out[e.anchor.id] = s.expect; }
  return out;
}

/**
 * Finding 67 — the transcript survives leaving the page.
 *
 * The only route to buying is the panel head's *Details →*, and the answers that persuaded the visitor were
 * component state: one client-side navigation and Back came home to "No questions yet", with the free tries that
 * produced them already spent. The record is plain JSON, so it is kept in sessionStorage (this tab, this origin,
 * until the tab is closed) and restored on mount.
 *
 * Pending turns are never stored: a request in flight when the page unmounts has no answer to come back to.
 */
const TURNS_KEY = 'ainize.chat.turns';
/** Keep the tail of a long conversation rather than refusing to store it: a browser quota is a few hundred KB. */
const TURNS_MAX = 12;
export function loadTurns<T>(): T[] {
  try {
    const raw = sessionStorage.getItem(TURNS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch { return []; }
}
export function saveTurns<T extends { status: string }>(turns: T[]): void {
  const keep = turns.filter((t) => t.status !== 'pending').slice(-TURNS_MAX);
  try {
    if (keep.length === 0) { sessionStorage.removeItem(TURNS_KEY); return; }
    sessionStorage.setItem(TURNS_KEY, JSON.stringify(keep));
  } catch {
    // Out of room (a long conversation with raw answers): keep the last few rather than losing the lot.
    try { sessionStorage.setItem(TURNS_KEY, JSON.stringify(keep.slice(-3))); } catch { /* storage unavailable */ }
  }
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
/**
 * Longest question the node accepts (packages/node/src/api.ts:1041 — `content: z.string().min(1).max(4000)` per
 * message). Finding 61: the box had no limit, so an over-long question was cleared from the composer, sent, and
 * answered with a zod 400 the UI translated into "clear the conversation" — advice that could not work, on text
 * the visitor no longer had.
 */
export const PROMPT_MAX = 4000;
/** Where the counter appears: close enough to matter, far enough not to nag. */
export const PROMPT_COUNT_FROM = 3500;

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

/**
 * Finding 65 — what a VISITOR is told is holding the shared model. The raw label is an internal lock key
 * (`teach:e012b848-…:preflight`, `chat:krx-all-2761+pixelplus-087600`, `verify:krx-all-2761`) and the owner is the
 * node's OS process (`pid:1355814`); printing either turned a public page into a debug console. This maps the
 * label to the KIND of work, which is the only part a visitor can act on.
 *
 * `mineJobId` is the lesson this page is showing: a `teach:<that job>:…` lock is the visitor's OWN lesson being
 * checked, which the old wording blamed on a stranger.
 */
export type LockJobKind = 'chat' | 'teach' | 'teach_mine' | 'verify' | 'apply' | 'other';
export function lockJobKind(label: string | undefined, mineJobId?: string | null): LockJobKind {
  const l = (label ?? '').trim();
  if (l.startsWith('chat:')) return 'chat';
  if (l.startsWith('teach:')) return mineJobId && l.startsWith(`teach:${mineJobId}:`) ? 'teach_mine' : 'teach';
  if (l.startsWith('verify:')) return 'verify';
  if (l.startsWith('apply:') || l.startsWith('remove:')) return 'apply';
  return 'other';
}

/** Extract a numeric pid from the lock owner label ("pid:1234" → "1234"); falls back to the raw owner. */
export function lockOwnerLabel(owner: string): string {
  const m = /^pid:(\d+)$/.exec(owner);
  return m ? m[1] : owner;
}
