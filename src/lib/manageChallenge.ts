import type { PatchDetail } from '../api/types';
import { managedKnowledge } from './manageKnowledge';
import { sameManagedArtifact } from './manageLifecycle';
import { sameAccountAddress, validAccountAddress } from './accountAccess';

// Match the node/core challenge contract; this is not a model execution request.
export const CHALLENGE_REASON_MIN = 20;
const COOLDOWN_MS = 24 * 3600_000;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const time = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 8.64e15;
type Challenge = NonNullable<PatchDetail['open_challenge']>;
const validChallenge = (v: unknown, id: string): v is Challenge => object(v) && v.patch_id === id
  && validAccountAddress(v.challenger) && typeof v.reason === 'string' && time(v.created_at);
function history(p: PatchDetail) {
  const log = p.challenge_log;
  if (!Array.isArray(log) || !log.every(row => object(row) && validChallenge(row.challenge, p.anchor.id)
    && ['open', 'upheld', 'dismissed'].includes(row.state)
    && (row.state === 'open' ? row.answered_at == null || time(row.answered_at) : time(row.answered_at)))) return null;
  return log;
}
export type ChallengeAvailability = { kind: 'ready' | 'read' | 'state' | 'open' | 'cooldown'; until?: number };
export function challengeAvailability(p: PatchDetail, node: string | null, now = Date.now()): ChallengeAvailability {
  if (p.status === 'DRAFT') return { kind: 'state' };
  const log = history(p);
  if (!validAccountAddress(node) || !log || !time(now)) return { kind: 'read' };
  const mine = log.filter(row => sameAccountAddress(row.challenge.challenger, node));
  if (mine.some(row => row.state === 'open')) return { kind: 'open' };
  const latest = Math.max(0, ...mine.filter(row => row.state === 'dismissed' && row.answered_at).map(row => row.answered_at!));
  if (latest && now - latest < COOLDOWN_MS) return { kind: 'cooldown', until: latest + COOLDOWN_MS };
  return { kind: 'ready' };
}
export class ManageChallengeError extends Error {
  constructor(readonly code: 'reason' | 'read' | 'state' | 'open' | 'cooldown' | 'access' | 'changed' | 'unconfirmed') { super(code); }
}
export async function requestManagedChallenge(expected: PatchDetail, node: string | null, subject: string | null, reasonText: string, deps: {
  current: () => boolean; read: () => Promise<unknown>; readAccess: () => Promise<unknown>;
  write: (reason: string) => Promise<unknown>; now?: () => number;
}) {
  const reason = reasonText.trim();
  if (reason.length < CHALLENGE_REASON_MIN) throw new ManageChallengeError('reason');
  if (!deps.current()) return null;
  const access = await deps.readAccess();
  if (!deps.current()) return null;
  if (!object(access) || access.signedIn !== true || access.isOwner !== true || !validAccountAddress(node)
    || !sameAccountAddress(access.address, node)
    || (subject === null ? access.subject !== null : !sameAccountAddress(access.subject, subject))) throw new ManageChallengeError('access');
  const fresh = managedKnowledge(await deps.read(), expected.anchor.id);
  if (!deps.current()) return null;
  if (!fresh || !fresh.owned) throw new ManageChallengeError('read');
  if (!sameManagedArtifact(fresh, expected)) throw new ManageChallengeError('changed');
  const available = challengeAvailability(fresh, node, deps.now?.() ?? Date.now());
  if (available.kind !== 'ready') throw new ManageChallengeError(available.kind);
  let reply: unknown;
  try { reply = await deps.write(reason); }
  catch { if (!deps.current()) return null; throw new ManageChallengeError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!object(reply) || reply.ok !== true || !validChallenge(reply.challenge, expected.anchor.id)
    || !sameAccountAddress(reply.challenge.challenger, node) || reply.challenge.reason !== reason
    || history(fresh)!.some(row => row.challenge.created_at === reply.challenge.created_at && sameAccountAddress(row.challenge.challenger, node))) throw new ManageChallengeError('unconfirmed');
  let after: PatchDetail | null;
  try { after = managedKnowledge(await deps.read(), expected.anchor.id); }
  catch { if (!deps.current()) return null; throw new ManageChallengeError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!after || !after.owned || !sameManagedArtifact(after, expected) || !history(after)?.some(row =>
    row.challenge.created_at === reply.challenge.created_at && row.challenge.reason === reason && sameAccountAddress(row.challenge.challenger, node))) throw new ManageChallengeError('unconfirmed');
  // It may already be answered by the time we reread. Confirm registration, never claim a model passed.
  return { detail: after };
}
