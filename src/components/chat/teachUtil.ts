/**
 * Teach-mode helpers shared by the chat components: error mapping (spec §5.14), lesson status → panel label,
 * client-side downloads and a couple of formatters.
 */
import { errorMessage } from '@/api/api';
import type { CatalogEntry, TeachJob, TeachJobPublic, TeachPolicy } from '@/api/types';

type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** A number the node put in `TeachError.details` (v2), with a fallback so the sentence is never left with a hole. */
function detailNumber(err: unknown, key: string, fallback: number): number {
  const v = (err as { data?: Record<string, unknown> } | undefined)?.data?.[key];
  return typeof v === 'number' ? v : fallback;
}

/** True for the two "you ran out of free tries this hour" answers — the caller may want to keep what it already has. */
export function isQuotaError(err: unknown): boolean {
  const e = err as { status?: number | string } | undefined;
  return e?.status === 429 || /^(quota_chat|rate_limited)\s*:/.test(errorMessage(err).toLowerCase());
}

/** Same style as mapChatError: machine-readable code = message prefix (spec §5.14), transport errors get their own line. */
export function mapTeachError(err: unknown, t: Tr, ctx: { stage?: 'preflight' | 'remove' } = {}): string {
  const e = err as { status?: number | string; name?: string } | undefined;
  const raw = errorMessage(err);
  const m = raw.toLowerCase();
  /** at pre-flight no lesson exists yet, so "the lesson will continue automatically" would be untrue */
  const runtimeKey = ctx.stage === 'preflight' ? 'teach.pre.err_runtime' : 'teach.err.runtime';
  if (e?.status === 'FETCH_ERROR') return t('teach.err.network');
  const code = /^([a-z_]+)\s*:/.exec(m)?.[1] ?? '';
  switch (code) {
    case 'teaching_disabled': return t('teach.err.teaching_disabled');
    case 'trainer_paused': return t('teach.err.trainer_paused');
    case 'quota_key': case 'quota_ip': return t('teach.err.quota');
    // `chat.err.quota` ends with "buy the knowledge" — nonsense when you are the one MAKING the knowledge.
    // an HOURLY live-test budget, never the daily lesson limit: "come back tomorrow" would send the visitor away for
    // 23 hours too long, and "buy the knowledge" is nonsense when they are the one making it
    case 'quota_chat': return t(ctx.stage === 'preflight' ? 'teach.err.quota_check' : 'teach.err.quota_try');
    case 'banned': return t('teach.err.banned');
    case 'already_known': return t('teach.err.already_known');
    case 'overlaps_listing': return t('teach.err.overlaps_listing');
    case 'job_not_ready': return t('teach.err.job_not_ready');
    case 'checks_failed': return t('teach.err.checks_failed');
    case 'invalid_signature': return t('teach.err.invalid_signature');
    case 'not_owner': return t('teach.err.not_owner');
    case 'published_immutable': return t('teach.err.published_immutable');
    case 'publish_disabled': return t('teach.pub.off');
    case 'rate_limited': return t('teach.err.rate_limited');
    // teach mode v2 — the dataset codes (design §5.11). `details` carries the numbers the sentence needs.
    case 'dataset_too_large': return t('teach.err.dataset_too_large', { mb: detailNumber(err, 'max_bytes', 4_000_000) / 1e6 });
    case 'dataset_empty': return t(ctx.stage === 'remove' ? 'teach.err.dataset_empty_remove' : 'teach.err.dataset_empty');
    case 'dataset_format': return t('teach.err.dataset_format');
    case 'dataset_not_found': return t('teach.err.dataset_not_found');
    case 'dataset_in_use': return t('teach.err.dataset_in_use');
    case 'dataset_hash': return t('teach.err.dataset_hash');
    case 'quota_dataset': return t('teach.err.quota_dataset');
    case 'quota_rows': return t('teach.err.quota_rows');
    case 'quota_bytes': return t('teach.err.quota_bytes');
    case 'dataset_declaration': return t('teach.err.dataset_declaration', { n: detailNumber(err, 'rows', 100) });
    default: break;
  }
  // v1 shape: a missing job answers 404 with a bare sentence and no machine code
  if (e?.status === 404 && m.includes('lesson not found')) return t('teach.err.lesson_not_found');
  // an older node answers the live test with a bare sentence and no code — it is still the hourly budget, not the daily one
  if (m.includes('live-test quota')) return t(ctx.stage === 'preflight' ? 'teach.err.quota_check' : 'teach.err.quota_try');
  if (e?.status === 429 || m.includes('quota')) return t('teach.err.quota');
  if (m.includes('runtime busy') || m.includes('shared runtime busy')) return t('teach.err.busy');
  if (m.includes('runtime unavailable') || m.includes('unreachable') || m.includes('econnrefused') || m.includes('not responding') || (e?.status === 503 && m.includes('model server'))) return t(runtimeKey);
  return t('teach.err.generic', { message: raw });
}

/** Visitor-facing sentence for a FAILED lesson (the raw trainer error stays behind a "technical details" disclosure). */
export function failedKey(error: string | undefined): string {
  const e = (error ?? '').toLowerCase();
  if (/^already_known/.test(e)) return 'teach.card.failed_known';
  if (e.includes('node restarted') || e.includes('node stopping')) return 'teach.card.failed_restart';
  if (e.includes('out of memory') || e.includes('outofmemoryerror') || e.includes('cuda oom')) return 'teach.card.failed_memory';
  return 'teach.card.failed';
}

/** Lesson-card status pill (§3: never a raw enum in the UI). Same vocabulary as the Your-knowledge panel. */
export function cardStatusKey(status: string, publishStatus?: string): string {
  switch (status) {
    case 'QUEUED': case 'PREFLIGHT': return 'teach.mine.status.queued';
    case 'LOADING': case 'TRAINING': return 'teach.mine.status.training';
    case 'EXPORTED': case 'CHECKING': return 'teach.mine.status.checking';
    case 'READY': return 'teach.mine.status.ready';
    case 'NEEDS_MORE': return 'teach.mine.status.needs_more';
    case 'PENDING_REVIEW': return 'teach.mine.status.review';
    case 'ANNOUNCED': return publishStatus === 'listed' ? 'teach.mine.status.on_sale' : 'teach.mine.status.verifying';
    case 'REJECTED': return 'teach.mine.status.declined';
    case 'FAILED': return 'teach.mine.status.failed';
    case 'EXPIRED': return 'teach.mine.status.expired';
    case 'CANCELLED': return 'teach.mine.status.cancelled';
    default: return 'teach.mine.status.training';
  }
}

export function isFullJob(j: TeachJob | TeachJobPublic | undefined): j is TeachJob { return !!j && 'facts' in j; }

/** Statuses after which the card no longer changes on its own. */
export const TERMINAL: ReadonlySet<string> = new Set(['READY', 'NEEDS_MORE', 'FAILED', 'CANCELLED', 'PENDING_REVIEW', 'REJECTED', 'ANNOUNCED', 'EXPIRED']);
export const ACTIVE: ReadonlySet<string> = new Set(['QUEUED', 'PREFLIGHT', 'LOADING', 'TRAINING', 'EXPORTED', 'CHECKING']);

/** §5.11 status column: lesson job + (when announced) the catalog entry it became. */
export function mineStatusKey(job: TeachJob, entry?: CatalogEntry): string {
  switch (job.status) {
    case 'QUEUED': case 'PREFLIGHT': return 'teach.mine.status.queued';
    case 'LOADING': case 'TRAINING': case 'EXPORTED': case 'CHECKING': return 'teach.mine.status.training';
    case 'READY': return 'teach.mine.status.ready';
    case 'NEEDS_MORE': return 'teach.mine.status.needs_more';
    case 'PENDING_REVIEW': return 'teach.mine.status.review';
    case 'ANNOUNCED': return entry?.status === 'LISTED' || job.publish_status === 'listed' ? 'teach.mine.status.on_sale' : 'teach.mine.status.verifying';
    case 'REJECTED': return 'teach.mine.status.declined';
    case 'FAILED': return 'teach.mine.status.failed';
    case 'EXPIRED': return 'teach.mine.status.expired';
    case 'CANCELLED': return 'teach.mine.status.cancelled';
    default: return 'teach.mine.status.training';
  }
}

/** Lesson basket policy line (§5.5). */
export function policyLine(policy: TeachPolicy | undefined, t: Tr): { text: string; ok: boolean } {
  if (!policy) return { text: '', ok: false };
  if (!policy.enabled) return { text: t('teach.basket.policy_off'), ok: false };
  if (policy.trainer === 'paused') return { text: t('teach.basket.policy_paused', { reason: policy.paused_reason ?? '' }).trim(), ok: false };
  // design §D7 / openapi: a node whose trainer is the stub reports `timing.simulated` and shows no minutes at all — its
  // three-second demo runs are not lessons, and any gradient samples left in its stats are not what it would do now
  if (policy.timing.simulated) return { text: t('teach.basket.policy_open_demo', { q: policy.queue.depth }), ok: true };
  // §8.4: only measured p50/p90 from ≥ 3 samples; never "1–1 min" — equal minutes collapse to "about N min", sub-minute lessons say so.
  if (policy.timing.samples >= 3 && policy.timing.p50_s !== null) {
    const p50s = policy.timing.p50_s;
    const p90s = policy.timing.p90_s ?? p50s;
    const q = policy.queue.depth;
    if (p90s < 60) return { text: t('teach.basket.policy_open_fast', { q }), ok: true };
    const min = (s: number) => Math.max(1, Math.round(s / 60));
    const p50 = min(p50s);
    const p90 = min(p90s);
    if (p50 === p90) return { text: t('teach.basket.policy_open_about', { q, p50 }), ok: true };
    return { text: t('teach.basket.policy_open', { q, p50, p90 }), ok: true };
  }
  return { text: t('teach.basket.policy_untimed'), ok: true };
}

/** QUEUED-card ETA under the same §8.4 rule (the node may send eta_s from fewer samples). */
export function etaText(etaS: number | null | undefined, policy: TeachPolicy | undefined, t: Tr): string | null {
  if (!etaS || !policy || policy.timing.samples < 3) return null;
  if (etaS < 90) return t('teach.card.eta_soon');
  return t('teach.card.eta', { min: Math.max(1, Math.round(etaS / 60)) });
}

/** Save a text blob from the browser (key backup, copied commands). */
export function downloadText(filename: string, text: string, type = 'application/json') {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* ignore */ }
}

/**
 * Naive "suggest phrasings" (v1: templates; model-generated phrasings are a follow-up).
 * Korean templates wrap the whole question instead of appending a verb to it: a stem that already ends in a particle
 * or a request ("…종목코드는", "…알려줘") stays grammatical, whereas "…종목코드는 알려줘." did not.
 */
export function suggestPhrasings(question: string, locale: 'ko' | 'en'): string[] {
  const q = question.trim().replace(/[\s?？.。!！]+$/, '');
  if (!q) return [];
  const hasKorean = /[ㄱ-힝]/.test(q);
  const out = (hasKorean || locale === 'ko')
    ? [`질문: ${q}? 답:`, `다음 질문에 짧게 답해줘: ${q}?`, `다음 질문에 숫자나 이름만으로 답해줘: ${q}?`]
    : [`Tell me: ${q}?`, `Answer briefly: ${q}?`, `Question: ${q}? Answer:`];
  return out.filter((s) => s.trim() !== question.trim());
}

export const mb = (bytes: number) => (bytes / 1e6).toFixed(bytes < 1e6 ? 2 : 1);
export const pct = (x: number) => Math.round(x * 100);
