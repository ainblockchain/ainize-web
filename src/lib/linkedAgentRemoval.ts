export interface LinkedAgentUnlinkReview { id: string; name: string; owner: string; revision: string }
export interface LinkedAgentUnlinkRequest { id: string; expected_actor: string; expected: LinkedAgentUnlinkReview }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export class LinkedAgentRemovalError extends Error {
  constructor(readonly reason: 'changed' | 'unsupported' | 'unconfirmed') { super(reason); }
}
export function readLinkedAgentUnlinkReview(raw: unknown): LinkedAgentUnlinkReview | null {
  const a = object(raw) && object(raw.agent) ? raw.agent : null;
  const review = a && object(a.unlink_review) ? a.unlink_review : null;
  if (!a || a.can_unlink !== true || !review || Object.keys(review).length !== 4
    || typeof review.id !== 'string' || !review.id || review.id !== a.id
    || typeof review.owner !== 'string' || !review.owner || review.owner !== a.owner
    || typeof review.name !== 'string' || !review.name || review.name !== a.name
    || typeof review.revision !== 'string' || !/^[a-f0-9]{64}$/.test(review.revision)) return null;
  return { id: review.id, owner: review.owner, name: review.name, revision: review.revision };
}
export function linkedAgentRemovalConfirmed(raw: unknown, request: LinkedAgentUnlinkRequest): boolean {
  if (!object(raw) || raw.deleted !== request.id || raw.registry !== 'unlinked' || raw.actor !== request.expected_actor || !object(raw.removed)) return false;
  const removed = raw.removed;
  return Object.keys(removed).length === 4 && (['id', 'name', 'owner', 'revision'] as const).every(key => removed[key] === request.expected[key]);
}
/** Read and confirm before one write. Missing/ambiguous acknowledgement never authorizes another unlink. */
export function createLinkedAgentRemoval() {
  let busy = false, uncertain = false, confirmed = false;
  return {
    blocked: () => busy || uncertain,
    uncertain: () => uncertain,
    confirmed: () => confirmed,
    async run(target: { id: string; owner?: string | null }, actor: string | null, io: {
      read: () => Promise<unknown>; confirm: (review: LinkedAgentUnlinkReview) => boolean;
      send: (request: LinkedAgentUnlinkRequest) => Promise<unknown>; current: () => boolean;
    }): Promise<boolean> {
      if (busy || uncertain || !io.current()) return false;
      busy = true; confirmed = false; let sent = false;
      try {
        if (!actor) throw new LinkedAgentRemovalError('changed');
        const raw = await io.read();
        if (!io.current()) return false;
        const review = readLinkedAgentUnlinkReview(raw);
        if (!review) throw new LinkedAgentRemovalError('unsupported');
        if (review.id !== target.id || target.owner && review.owner !== target.owner) throw new LinkedAgentRemovalError('changed');
        if (!io.confirm(review) || !io.current()) return false;
        const request = { id: target.id, expected_actor: actor, expected: review };
        sent = true;
        const receipt = await io.send(request);
        if (!linkedAgentRemovalConfirmed(receipt, request)) throw new LinkedAgentRemovalError('unconfirmed');
        confirmed = true;
        return io.current();
      } catch (error) {
        const e = error as { status?: unknown; data?: { error?: { code?: unknown } } };
        const refused = typeof e?.status === 'number' && e.status >= 400 && e.status < 500
          && ['review_required', 'review_changed', 'not_owner', 'not_signed_in', 'not_found'].includes(String(e?.data?.error?.code));
        if (sent && !refused) uncertain = true;
        throw error;
      } finally { busy = false; }
    },
  };
}
