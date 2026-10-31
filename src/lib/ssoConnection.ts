import { safeReturnPath } from './uiNavigation';

export interface SsoConnectionReview {
  request: string; issuer: string; subject: string; name: string | null; email: string | null;
  next: string; expiresAt: number; legacy: { principal: string; email: string } | null;
}
export type ConnectionChoice = 'legacy' | 'new';
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (v: unknown, max = 1000): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
export function readConnectionReview(raw: unknown): SsoConnectionReview | null {
  if (!record(raw) || Object.keys(raw).length !== 8 || !text(raw.request) || !/^[a-f0-9]{64}$/.test(raw.request)
    || !text(raw.issuer) || !/^https?:\/\//.test(raw.issuer) || !text(raw.subject, 255) || !/^[A-Za-z0-9._~-]+$/.test(raw.subject)
    || !(raw.name === null || text(raw.name)) || !(raw.email === null || text(raw.email))
    || !text(raw.next, 4000) || safeReturnPath(raw.next) !== raw.next || !Number.isSafeInteger(raw.expiresAt) || Number(raw.expiresAt) <= 0
    || !(raw.legacy === null || record(raw.legacy) && Object.keys(raw.legacy).length === 2
      && text(raw.legacy.principal, 262) && /^google:[0-9a-z_-]+$/.test(raw.legacy.principal) && text(raw.legacy.email))) return null;
  return { request: raw.request, issuer: raw.issuer, subject: raw.subject, name: raw.name, email: raw.email,
    next: raw.next, expiresAt: Number(raw.expiresAt), legacy: raw.legacy as SsoConnectionReview['legacy'] };
}
export function sameConnectionReview(a: SsoConnectionReview, b: SsoConnectionReview) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export class SsoConnectionError extends Error {
  constructor(readonly code: 'changed' | 'unconfirmed') { super(code); }
}

/** Browser read-back must show the reviewed AIN account and, for linking, the selected legacy principal. */
export function connectionSessionMatches(raw: unknown, review: SsoConnectionReview, choice: ConnectionChoice, node: string): boolean {
  if (!record(raw) || raw.address !== node || !record(raw.sso) || raw.sso.sub !== review.subject) return false;
  const principal = raw.sso.principal;
  return text(principal) && (choice === 'legacy' ? principal === review.legacy?.principal
    : principal === `sso:${review.subject}`.toLowerCase() || /^google:[0-9a-z_-]{1,255}$/.test(principal));
}

export async function connectReviewedAccount(review: SsoConnectionReview, choice: ConnectionChoice, node: string, deps: {
  current: () => boolean; read: () => Promise<unknown>; session: () => Promise<unknown>;
  attempting: () => void; refused: () => void;
  write: (choice: ConnectionChoice, expected: SsoConnectionReview) => Promise<unknown>;
}): Promise<boolean> {
  if (!deps.current()) return false;
  const raw = await deps.read();
  if (!deps.current()) return false;
  const latest = record(raw) ? readConnectionReview(raw.connectionReview) : null;
  if (!latest || !sameConnectionReview(review, latest) || choice === 'legacy' && !review.legacy) throw new SsoConnectionError('changed');
  deps.attempting();
  let answer: unknown;
  try { answer = await deps.write(choice, review); }
  catch (error) {
    if (!deps.current()) return false;
    if (record(error) && typeof error.status === 'number' && error.status >= 400 && error.status < 500) {
      deps.refused();
      if (error.status === 409) throw new SsoConnectionError('changed');
      throw error;
    }
    // A lost reply can still have installed the session cookie. Only a read may follow it.
  }
  if (!deps.current()) return false;
  if (answer !== undefined && (!record(answer) || answer.ok !== true || answer.request !== review.request
    || answer.next !== review.next || answer.subject !== review.subject
    || choice === 'legacy' && answer.principal !== review.legacy?.principal)) throw new SsoConnectionError('unconfirmed');
  const result = await deps.session().catch(() => null);
  if (!deps.current()) return false;
  if (!connectionSessionMatches(result, review, choice, node)
    || record(answer) && record(result) && record(result.sso) && answer.principal !== result.sso.principal) throw new SsoConnectionError('unconfirmed');
  return true;
}
