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
export interface Basket {
  facts: Correction[];
  builds_on: boolean;
  /**
   * Lineage (design §4 SC-1): the knowledge this lesson is being built ON TOP OF — `undefined` means "not chosen yet"
   * (the first loaded knowledge is offered), `null` means the visitor chose the plain model on purpose.
   */
  base?: string | null;
  /** the visitor confirmed that answers differing from the base's are meant to replace them (§12.1) */
  confirm_conflicts?: boolean;
  /** set by "Improve & retry": the next training call goes through POST …/retry with this parent job */
  retry_of?: string;
}
export interface JobRef { id: string; name?: string; created_at: number }

const read = <T>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};
const write = (key: string, value: unknown) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };
const remove = (key: string) => { try { localStorage.removeItem(key); } catch { /* ignore */ } };

/** One basket per knowledge stack (load order matters, so the key is the ordered id list). */
export function stackHash(ids: string[]): string { return ids.length ? ids.join('+') : 'base'; }
/** `stackHash` read back: ids never contain '+' (slug = [a-z0-9._-]), and 'base' is the empty stack. */
export function stackIds(hash: string): string[] { return hash === 'base' ? [] : hash.split('+').filter(Boolean); }

const basketPrefix = (owner: string) => `${BASKET_PREFIX}v2:${encodeURIComponent(owner)}:`;
export const chatStorageOwner = (account: string, teacher: string) => JSON.stringify([account, teacher.toLowerCase()]);
export const hasBasketContent = (basket: Basket) => basket.facts.length > 0 || !!basket.retry_of || basket.base !== undefined || basket.builds_on || !!basket.confirm_conflicts;

function parseBasket(value: unknown): Basket {
  const b = value && typeof value === 'object' ? value as Partial<Basket> : {};
  const facts = Array.isArray(b.facts) ? b.facts.filter((f) => f && typeof f.prompt === 'string' && typeof f.answer === 'string').slice(0, MAX_FACTS) : [];
  return {
    facts, builds_on: !!b.builds_on,
    ...(typeof b.base === 'string' || b.base === null ? { base: b.base } : {}),
    ...(b.confirm_conflicts ? { confirm_conflicts: true } : {}),
    ...(typeof b.retry_of === 'string' ? { retry_of: b.retry_of } : {}),
  };
}
export function loadBasket(ids: string[], owner: string): Basket { return parseBasket(read(basketPrefix(owner) + stackHash(ids), null)); }
export function saveBasket(ids: string[], basket: Basket, owner: string): boolean {
  try {
    const key = basketPrefix(owner) + stackHash(ids);
    if (!hasBasketContent(basket)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(basket));
    return true;
  } catch { return false; }
}
export function clearBasket(ids: string[], owner: string) { remove(basketPrefix(owner) + stackHash(ids)); }

/** The first-key flow may carry its draft; importing an existing key must not overwrite that key's work. */
export function acceptBasketDraft(ids: string[], incoming: Basket, owner: string, choice: 'new-key' | 'import-key' | 'keep-saved') {
  const saved = loadBasket(ids, owner);
  if (choice === 'keep-saved') return { conflict: false as const, basket: saved };
  if (choice === 'import-key' && hasBasketContent(saved)) return { conflict: true as const };
  saveBasket(ids, incoming, owner);
  // The active view keeps the in-memory draft even when persistence is unavailable.
  return { conflict: false as const, basket: incoming };
}

/**
 * Finding 14 — the basket FOLLOWS the selection instead of being swapped out with it. Ticking a second knowledge
 * moved the page to a different, empty record: the panel read "Your lesson (0 of 8) — no corrections yet" while the
 * corrections sat in localStorage under the old key with nothing saying so, and the rational response was to retype
 * them. The draft now moves to the new stack's key, so the same lesson is still there after a tick.
 *
 * Nothing is ever overwritten: a stack that already holds its own draft keeps it, and the one left behind is named
 * to the visitor by `strandedBaskets` rather than disappearing.
 */
export function carryBasket(fromIds: string[], toIds: string[], owner: string): Basket {
  const to = stackHash(toIds);
  const target = loadBasket(toIds, owner);
  if (to === stackHash(fromIds) || hasBasketContent(target)) return target;
  const source = loadBasket(fromIds, owner);
  if (!hasBasketContent(source)) return target;
  if (saveBasket(toIds, source, owner)) clearBasket(fromIds, owner);
  return source;
}

/**
 * Every OTHER stack that still holds corrections — work this browser has saved under a key the page is not showing.
 * The chat page names each one and offers to load it, so a draft can never be invisible (finding 14).
 */
export function strandedBaskets(currentIds: string[], owner: string): { ids: string[]; facts: number }[] {
  const prefix = basketPrefix(owner);
  const here = prefix + stackHash(currentIds);
  const out: { ids: string[]; facts: number }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix) || key === here) continue;
      const ids = stackIds(key.slice(prefix.length));
      const facts = loadBasket(ids, owner).facts.length;
      if (facts > 0) out.push({ ids, facts });
    }
  } catch { /* storage unavailable */ }
  return out.sort((a, b) => b.facts - a.facts || stackHash(a.ids).localeCompare(stackHash(b.ids)));
}

/** Job ownership is the teaching address, not the browser. Legacy unowned records are not auto-selected. */
const jobsKey = (owner: string) => `${JOBS_KEY}:${encodeURIComponent(owner.toLowerCase())}`;
export function loadJobs(owner: string): JobRef[] {
  if (!owner) return [];
  const j = read<JobRef[]>(jobsKey(owner), []);
  return Array.isArray(j) ? j.filter((x) => x && typeof x.id === 'string') : [];
}
export function rememberJob(ref: JobRef, owner: string) {
  if (!owner) return;
  const rest = loadJobs(owner).filter((j) => j.id !== ref.id);
  write(jobsKey(owner), [ref, ...rest].slice(0, 50));
}
export function forgetJob(id: string, owner: string) { if (owner) write(jobsKey(owner), loadJobs(owner).filter((j) => j.id !== id)); }
export function clearJobs(owner: string) { if (owner) remove(jobsKey(owner)); }

export function bannerDismissed(): boolean { return read<boolean>(BANNER_KEY, false) === true; }
export function dismissBanner() { write(BANNER_KEY, true); }
export function undismissBanner() { remove(BANNER_KEY); }

export const newCorrectionId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Legacy drafts have no owner. Offer an explicit export; never silently claim or delete them. */
export function legacyBaskets(): { ids: string[]; basket: Basket }[] {
  const out: { ids: string[]; basket: Basket }[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(BASKET_PREFIX) || key.startsWith(`${BASKET_PREFIX}v2:`)) continue;
      const basket = parseBasket(read(key, null));
      if (basket.facts.length) out.push({ ids: stackIds(key.slice(BASKET_PREFIX.length)), basket });
    }
  } catch { /* unavailable */ }
  return out;
}
