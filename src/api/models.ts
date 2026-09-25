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
