/**
 * Teach-mode helpers shared by the chat components: error mapping (spec §5.14), lesson status → panel label,
 * client-side downloads and a couple of formatters.
 */
import { errorMessage } from '@/api/api';
import type { CatalogEntry, TeachJob, TeachJobPublic, TeachPolicy } from '@/api/types';

type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** Same style as mapChatError: machine-readable code = message prefix (spec §5.14), transport errors get their own line. */
export function mapTeachError(err: unknown, t: Tr): string {
  const e = err as { status?: number | string; name?: string } | undefined;
  const raw = errorMessage(err);
  const m = raw.toLowerCase();
  if (e?.status === 'FETCH_ERROR') return t('teach.err.network');
  const code = /^([a-z_]+)\s*:/.exec(m)?.[1] ?? '';
  switch (code) {
    case 'teaching_disabled': return t('teach.err.teaching_disabled');
    case 'trainer_paused': return t('teach.err.trainer_paused');
    case 'quota_key': case 'quota_ip': return t('teach.err.quota');
    case 'quota_chat': return t('chat.err.quota');
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
    default: break;
  }
  if (e?.status === 429 || m.includes('quota')) return t('teach.err.quota');
  if (m.includes('runtime busy') || m.includes('shared runtime busy')) return t('teach.err.busy');
  if (m.includes('runtime unavailable') || m.includes('unreachable') || m.includes('econnrefused') || m.includes('not responding') || (e?.status === 503 && m.includes('model server'))) return t('teach.err.runtime');
  return t('teach.err.generic', { message: raw });
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
  if (policy.timing.samples >= 3 && policy.timing.p50_s !== null) {
    const min = (s: number | null) => Math.max(1, Math.round((s ?? 0) / 60));
    return { text: t('teach.basket.policy_open', { q: policy.queue.depth, p50: min(policy.timing.p50_s), p90: min(policy.timing.p90_s ?? policy.timing.p50_s) }), ok: true };
  }
  return { text: t('teach.basket.policy_untimed'), ok: true };
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

/** Naive "suggest phrasings" (v1: templates; model-generated phrasings are a follow-up). */
export function suggestPhrasings(question: string, locale: 'ko' | 'en'): string[] {
  const q = question.trim().replace(/[?？.。!]+$/, '');
  if (!q) return [];
  const hasKorean = /[ㄱ-힝]/.test(q);
  const out = (hasKorean || locale === 'ko')
    ? [`${q} 알려줘.`, `${q} 숫자나 이름만 답해줘.`, `질문: ${q}? 답:`]
    : [`Tell me: ${q}?`, `Answer briefly: ${q}?`, `Question: ${q}? Answer:`];
  return out.filter((s) => s.trim() !== question.trim());
}

export const mb = (bytes: number) => (bytes / 1e6).toFixed(bytes < 1e6 ? 2 : 1);
export const pct = (x: number) => Math.round(x * 100);
