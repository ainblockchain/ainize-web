import { readModelsResponse, type PublicModelCard } from './models';
import { readNetworkModelsResponse, type NetworkModelProvider } from './networkModels';

/** Read-only preflight; a refreshed catalogue can refuse this target but cannot pick another one. */
export async function confirmModelTarget(model: PublicModelCard, provider: NetworkModelProvider, load: () => Promise<unknown>, current: () => boolean): Promise<void> {
  if (!current()) throw new DOMException('view changed', 'AbortError');
  let raw: unknown;
  try { raw = await load(); } catch { throw new Error('model_unavailable'); }
  if (!current()) throw new DOMException('view changed', 'AbortError');
  const found = provider.local
    ? readModelsResponse(raw)?.models.some(row => row.id === model.id && row.modality === model.modality && row.available)
    : readNetworkModelsResponse(raw)?.models.some(row => row.id === model.id && row.modality === model.modality
      && row.ref === provider.ref && row.node.address === provider.node.address && !row.local && row.available);
  if (!found) throw new Error('model_unavailable');
}
