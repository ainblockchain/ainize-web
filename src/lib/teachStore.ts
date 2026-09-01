/**
 * Teach-mode browser storage (spec §7.7): the lesson basket per knowledge stack, a mirror of job ids (the node is the
 * source of truth) and the banner dismissal. Every read/write is wrapped in try/catch — the page must work with no
 * stored value at all.
 */
import type { TeachFactInput } from '@/api/types';

export const BASKET_PREFIX = 'ainize.teach.basket.';
export const JOBS_KEY = 'ainize.teach.jobs';
export const BANNER_KEY = 'ainize.teach.banner_dismissed';
/** Last-resort cap for what a browser will hold; the REAL per-lesson cap is the node's `limits.facts_per_job`. */
export const MAX_FACTS = 64;
/** What the UI promises before the node's policy has loaded (the shipped default of `facts_per_job`). */
export const DEFAULT_FACTS_PER_JOB = 8;

export interface Correction extends TeachFactInput { id: string; model_answer?: string; added_at: number }
export interface Basket { facts: Correction[]; builds_on: boolean; /** set by "Improve & retry": the next training call goes through POST …/retry with this parent job */ retry_of?: string }
export interface JobRef { id: string; name?: string; created_at: number }

const read = <T>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };
const remove = (key: string) => { try { localStorage.removeItem(key); } catch { /* ignore */ } };

/** One basket per knowledge stack (load order matters, so the key is the ordered id list). */
export function stackHash(ids: string[]): string { return ids.length ? ids.join('+') : 'base'; }

export function loadBasket(ids: string[]): Basket {
  const b = read<Partial<Basket>>(BASKET_PREFIX + stackHash(ids), {});
  const facts = Array.isArray(b.facts) ? b.facts.filter((f) => f && typeof f.prompt === 'string' && typeof f.answer === 'string').slice(0, MAX_FACTS) : [];
  return { facts, builds_on: !!b.builds_on, ...(typeof b.retry_of === 'string' ? { retry_of: b.retry_of } : {}) };
}
export function saveBasket(ids: string[], basket: Basket) {
  if (basket.facts.length === 0 && !basket.builds_on && !basket.retry_of) remove(BASKET_PREFIX + stackHash(ids));
  else write(BASKET_PREFIX + stackHash(ids), basket);
}
export function clearBasket(ids: string[]) { remove(BASKET_PREFIX + stackHash(ids)); }

export function loadJobs(): JobRef[] {
  const j = read<JobRef[]>(JOBS_KEY, []);
  return Array.isArray(j) ? j.filter((x) => x && typeof x.id === 'string') : [];
}
export function rememberJob(ref: JobRef) {
  const rest = loadJobs().filter((j) => j.id !== ref.id);
  write(JOBS_KEY, [ref, ...rest].slice(0, 50));
}
export function forgetJob(id: string) { write(JOBS_KEY, loadJobs().filter((j) => j.id !== id)); }
export function clearJobs() { remove(JOBS_KEY); }

export function bannerDismissed(): boolean { return read<boolean>(BANNER_KEY, false) === true; }
export function dismissBanner() { write(BANNER_KEY, true); }
export function undismissBanner() { remove(BANNER_KEY); }

export const newCorrectionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
