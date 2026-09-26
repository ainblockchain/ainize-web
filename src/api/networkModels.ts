/**
 * The network's models, as the Models pages show them: a model is an id AND the node that serves it.
 *
 * Nodes join the network with their own models (ainize-node `peer-models.ts`), and the same id can be served by
 * several — ainize.ai's Qwen3.8-Flash-Next and a GPU box's, with different context windows. So the catalogue is
 * one entry per id, each carrying its providers, and a call names the provider with `id@0x<node address>` (the
 * node's `ref`). A bare id still works; the node then answers with its own model or the freshest peer's.
 *
 * `GET /api/network/models` is new; against an older node the page falls back to `/api/models` (its own models).
 * Pure — `test/network-models.test.ts` pins it.
 */
import { MODEL_MODALITIES, type ModelModality, type PublicModelCard } from './models';

export interface NetworkModelProvider {
  /** `id@0x<address>` — what a call names to reach exactly this node's model */
  ref: string;
  node: { address: string; name: string | null };
  /** served by the node this site talks to */
  local: boolean;
  available: boolean;
}

export interface NetworkModel {
  id: string;
  modality: ModelModality;
  /** this site's node first, then peers in the order the node listed them */
  providers: NetworkModelProvider[];
}

const isModality = (v: unknown): v is ModelModality => typeof v === 'string' && (MODEL_MODALITIES as readonly string[]).includes(v);
const isAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);

/** Read `/api/network/models`. Entries without an id, a known modality or a node address are skipped. */
export function parseNetworkModelsResponse(raw: unknown): (NetworkModelProvider & { id: string; modality: ModelModality })[] {
  const data = (raw as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(data)) return [];
  const out: (NetworkModelProvider & { id: string; modality: ModelModality })[] = [];
  for (const entry of data as Record<string, unknown>[]) {
    if (!entry || typeof entry !== 'object') continue;
    const node = entry.node as { address?: unknown; name?: unknown } | undefined;
    if (typeof entry.id !== 'string' || !entry.id || !isModality(entry.modality) || !isAddress(node?.address)) continue;
    const address = node!.address as string;
    out.push({
      id: entry.id,
      modality: entry.modality,
      ref: typeof entry.ref === 'string' && entry.ref ? entry.ref : `${entry.id}@${address.toLowerCase()}`,
      node: { address: address.toLowerCase(), name: typeof node!.name === 'string' ? node!.name : null },
      local: entry.local === true,
      // A peer is listed only while its advert is fresh, which is as close to "answering" as the list can say.
      available: true,
    });
  }
  return out;
}

/**
 * One entry per (modality, id), providers merged. `own` (`/api/models`) supplies this node's availability, which
 * the network list does not probe; a node too old for the network list still gets its own models listed.
 */
export function networkModelCatalogue(own: PublicModelCard[], network: ReturnType<typeof parseNetworkModelsResponse>): NetworkModel[] {
  const byKey = new Map<string, NetworkModel>();
  const key = (modality: string, id: string) => `${modality}\u0000${id}`;
  const add = (id: string, modality: ModelModality, p: NetworkModelProvider) => {
    const k = key(modality, id);
    const m = byKey.get(k) ?? { id, modality, providers: [] };
    if (!m.providers.some((x) => x.node.address === p.node.address)) m.providers.push(p);
    byKey.set(k, m);
  };
  const ownAvailable = new Map(own.map((c) => [key(c.modality, c.id), c.available]));
  for (const n of network) add(n.id, n.modality, { ...n, available: n.local ? (ownAvailable.get(key(n.modality, n.id)) ?? true) : n.available });
  // An older node: no network list, only its own models — shown as served here, without an address to name.
  if (!network.length) for (const c of own) add(c.id, c.modality, { ref: c.id, node: { address: '', name: null }, local: true, available: c.available });
  for (const m of byKey.values()) m.providers.sort((a, b) => Number(b.local) - Number(a.local));
  return MODEL_MODALITIES.flatMap((modality) => [...byKey.values()].filter((m) => m.modality === modality));
}

/** Which provider a model page drives: the `?node=` one, else this site's node, else the first peer. */
export function pickNetworkModelProvider(model: NetworkModel, node: string | null): NetworkModelProvider | null {
  if (node) {
    const pinned = model.providers.find((p) => p.node.address === node.toLowerCase());
    if (pinned) return pinned;
  }
  return model.providers.find((p) => p.local) ?? model.providers[0] ?? null;
}

/** A provider as a person reads it: its name, else a shortened address. */
export const networkProviderLabel = (p: NetworkModelProvider): string =>
  p.node.name ?? (p.node.address ? `${p.node.address.slice(0, 8)}…${p.node.address.slice(-4)}` : '');
