/**
 * What `/api/models` says, read defensively.
 *
 * The node and this app are released separately, so this is a contract between two things that move on their own
 * schedules. Everything here is about what a *newer or older* node on the other end would do to the page:
 *
 *   • A modality this build cannot drive is dropped, not rendered. A card with no input and no snippet is worse
 *     than an absent one, and a newer node may serve something this page has never heard of.
 *   • `available` defaults to **false**, not true. An older node that does not send the field must not have its
 *     models drawn as ready — a button that does nothing is a worse answer than a label saying so.
 *   • A malformed answer is an empty list. The empty state is already written, and it is the honest thing to
 *     render when we cannot understand what came back.
 */

export type ModelModality = 'chat' | 'transcription' | 'image';

export interface PublicModelCard {
  id: string;
  modality: ModelModality;
  available: boolean;
}

/** The order the page shows them in — and the only modalities it knows how to drive. */
export const MODEL_MODALITIES: readonly ModelModality[] = ['chat', 'transcription', 'image'];

const isModality = (value: unknown): value is ModelModality =>
  typeof value === 'string' && (MODEL_MODALITIES as readonly string[]).includes(value);

export function parseModelsResponse(raw: unknown): PublicModelCard[] {
  const data = (raw as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(data)) return [];
  const cards: PublicModelCard[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== 'object') continue;
    const { id, modality, available } = entry as { id?: unknown; modality?: unknown; available?: unknown };
    if (typeof id !== 'string' || !id) continue;
    if (!isModality(modality)) continue;
    cards.push({ id, modality, available: available === true });
  }
  return cards;
}

export interface ModelGroup {
  modality: ModelModality;
  models: PublicModelCard[];
}

/**
 * Group into the sections the page draws, in a fixed order.
 *
 * A modality with no models is not a group: an empty heading reads as a promise the node did not make.
 */
export function modelsByModality(cards: PublicModelCard[]): ModelGroup[] {
  return MODEL_MODALITIES
    .map((modality) => ({ modality, models: cards.filter((c) => c.modality === modality) }))
    .filter((group) => group.models.length > 0);
}

/** What the fetch told us about the node, beyond whether it worked. */
export type ModelsFetchState = 'ok' | 'outdated' | 'offline';

/**
 * Tell a node that is down from one that is merely older than this page.
 *
 * Production hit exactly this distinction: the node answered `/api/info` and every other route, served a model,
 * and had never heard of `/api/models` — because the route shipped after it did. Rendering "this node is not
 * answering" there is wrong twice over, and it points whoever reads it at the wrong problem.
 */
export function modelsFetchState(error: { status?: number | string; originalStatus?: number } | undefined | null): ModelsFetchState {
  if (!error) return 'ok';
  // Express answers an unknown route with an HTML page, so RTK Query cannot parse it as JSON and moves the real
  // code to `originalStatus`. Reading only `status` reported a live node on an older build as unreachable.
  const code = typeof error.status === 'number' ? error.status : error.originalStatus;
  return code === 404 ? 'outdated' : 'offline';
}

/** `GET /api/models/:id` — one model, and how many agents are built on it. */
export interface PublicModelDetail extends PublicModelCard {
  /** Agents built on this model, as the node counts them. `null` when the node did not say (an older node). */
  agents: number | null;
}

/** Read one model's answer. `null` for anything without an id and a modality this build can drive. */
export function parseModelDetailResponse(raw: unknown): PublicModelDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const [card] = parseModelsResponse({ data: [raw] });
  if (!card) return null;
  const agents = (raw as { agents?: unknown }).agents;
  return { ...card, agents: typeof agents === 'number' && agents >= 0 ? agents : null };
}

/** What the model page can say about the id in its URL. */
export type ModelDetailViewState =
  | { kind: 'loading' }
  | { kind: 'ok'; model: PublicModelDetail }
  | { kind: 'not_served' }
  | { kind: 'outdated' }
  | { kind: 'offline' };

type RtkError = { status?: number | string; originalStatus?: number } | undefined | null;

/**
 * Decide the model page from two answers: `/api/models/:id` and the list `/api/models`.
 *
 * Both are asked because a 404 from the first means two different things. A node with the route says 404 for a
 * model it does not serve — a JSON answer; a node from before the route says 404 for the ROUTE, as an Express
 * HTML page. The list settles it: when it carries the id, the model is served and the node is merely older (the
 * page still works, it just cannot count agents); when it does not, the model really is not served here.
 */
export function modelDetailViewState(input: {
  id: string;
  detail: unknown; detailError: RtkError; detailLoading: boolean;
  list: unknown; listError: RtkError; listLoading: boolean;
}): ModelDetailViewState {
  const parsed = parseModelDetailResponse(input.detail);
  if (parsed && parsed.id === input.id) return { kind: 'ok', model: parsed };
  if (input.detailLoading || input.listLoading) return { kind: 'loading' };
  const fromList = parseModelsResponse(input.list).find((c) => c.id === input.id);
  if (fromList) return { kind: 'ok', model: { ...fromList, agents: null } };
  const listState = modelsFetchState(input.listError);
  if (listState === 'offline') return { kind: 'offline' };
  if (!input.detailError) return { kind: 'not_served' };
  const detailState = modelsFetchState(input.detailError);
  if (detailState === 'offline') return { kind: 'offline' };
  // The route answered 404 and the list does not carry the id. If the list is also missing, this is an old node.
  return listState === 'outdated' ? { kind: 'outdated' } : { kind: 'not_served' };
}
