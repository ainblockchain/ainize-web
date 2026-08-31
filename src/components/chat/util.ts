import type { CatalogEntry } from '@/api/types';
import { pct, scoreText } from '@/utils/format';

export type ChatModeKind = 'compare' | 'patched' | 'base';

/** "340ms" / "1.2초" (ko) or "1.2s" (en). */
export function fmtMs(ms: number | null | undefined, locale: 'ko' | 'en'): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}${locale === 'ko' ? '초' : 's'}`;
}

/**
 * Accuracy of a knowledge as measured by verifiers that actually ran it on a model (not hash-only checks).
 * Returns null when nothing has been executed yet — the UI must not invent a number.
 */
export function executedAccuracy(entry: CatalogEntry): { pct: number | null; raw: string } | null {
  const executed = entry.attestations.filter((a) => a.verified_on !== 'hash-only' && a.score && Object.keys(a.score).length > 0);
  if (!executed.length) return null;
  const raw = scoreText(executed[executed.length - 1].score);
  if (raw === '—') return null;
  return { pct: pct(raw), raw };
}

/** The benchmark sample that matches a prompt (same rule the node uses for benchmark_hit). */
export function matchSample(entry: CatalogEntry | undefined, prompt: string): { prompt: string; expect: string } | undefined {
  const p = prompt.trim();
  if (!entry || !p) return undefined;
  return entry.anchor.benchmark.samples?.find((x) => p.includes(x.prompt.trim()) || x.prompt.includes(p));
}

/** Client-side check identical to the node's: answer (whitespace removed) contains the expected string. */
export function answerHits(content: string | undefined, expect: string | undefined): boolean | null {
  if (!content || !expect) return null;
  return content.replace(/\s/g, '').includes(expect);
}
