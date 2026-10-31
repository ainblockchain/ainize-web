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
  availabilityKnown?: boolean;
}

export interface NetworkModel {
  id: string;
  modality: ModelModality;
  /** this site's node first, then peers in the order the node listed them */
  providers: NetworkModelProvider[];
}

const isModality = (v: unknown): v is ModelModality => typeof v === 'string' && (MODEL_MODALITIES as readonly string[]).includes(v);
const isAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);

type NetworkEntry = NetworkModelProvider & { id: string; modality: ModelModality };
/** A reference must name the same id and provider shown on the card. Bad rows do not prove an empty list. */
export function readNetworkModelsResponse(raw: unknown, self?: string | null): { models: NetworkEntry[]; unsupported: number } | null {
  const data = (raw as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(data)) return null;
  const out: NetworkEntry[] = [];
  const seen = new Set<string>(), localNodes = new Set<string>();
  let unsupported = 0;
  for (const entry of data as Record<string, unknown>[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
    const node = entry.node as { address?: unknown; name?: unknown } | undefined;
    if (typeof entry.id !== 'string' || !entry.id.trim() || entry.id !== entry.id.trim() || typeof entry.modality !== 'string' || !entry.modality
      || !isAddress(node?.address) || typeof entry.local !== 'boolean' || (entry.available !== undefined && typeof entry.available !== 'boolean')) return null;
    const address = (node!.address as string).toLowerCase();
    if (entry.local && isAddress(self) && address !== self.toLowerCase()) return null;
    const ref = `${entry.id}@${address}`;
    if (entry.ref !== undefined && (typeof entry.ref !== 'string' || entry.ref.slice(0, entry.id.length + 1) !== `${entry.id}@`
      || entry.ref.slice(entry.id.length + 1).toLowerCase() !== address)) return null;
    const identity = JSON.stringify([entry.modality, entry.id, address]);
    if (seen.has(identity)) return null;
    seen.add(identity);
    if (entry.local) localNodes.add(address);
    if (localNodes.size > 1) return null;
    if (!isModality(entry.modality)) { unsupported++; continue; }
    out.push({
      id: entry.id,
      modality: entry.modality,
      ref,
      node: { address: address.toLowerCase(), name: typeof node!.name === 'string' ? node!.name : null },
      local: entry.local === true,
      // An advert permits a targeted attempt; it is not a successful health probe.
      available: entry.available !== false,
    });
  }
  return { models: out, unsupported };
}
export const parseNetworkModelsResponse = (raw: unknown): NetworkEntry[] => readNetworkModelsResponse(raw)?.models ?? [];

/**
 * One entry per (modality, id), providers merged. `own` (`/api/models`) supplies this node's availability, which
 * the network list does not probe; a node too old for the network list still gets its own models listed.
 */
export function networkModelCatalogue(own: PublicModelCard[], network: ReturnType<typeof parseNetworkModelsResponse>, self?: string | null): NetworkModel[] {
  const byKey = new Map<string, NetworkModel>();
  const key = (modality: string, id: string) => `${modality}\u0000${id}`;
  const add = (id: string, modality: ModelModality, p: NetworkModelProvider) => {
    const k = key(modality, id);
    const m = byKey.get(k) ?? { id, modality, providers: [] };
    if (!m.providers.some((x) => x.node.address === p.node.address)) m.providers.push(p);
    byKey.set(k, m);
  };
  const ownAvailable = new Map(own.map((c) => [key(c.modality, c.id), c]));
  for (const n of network) {
    const local = ownAvailable.get(key(n.modality, n.id));
    add(n.id, n.modality, { ...n, available: n.local ? (local?.available ?? false) : n.available,
      ...(n.local ? { availabilityKnown: !!local && local.availabilityKnown !== false } : {}) });
  }
  // An older node: no network list, only its own models — shown as served here, without an address to name.
  for (const c of own) if (!byKey.get(key(c.modality, c.id))?.providers.some(p => p.local)) {
    const address = isAddress(self) ? self.toLowerCase() : '';
    add(c.id, c.modality, { ref: address ? `${c.id}@${address}` : c.id, node: { address, name: null }, local: true, available: c.available, availabilityKnown: c.availabilityKnown !== false });
  }
  for (const m of byKey.values()) m.providers.sort((a, b) => Number(b.local) - Number(a.local));
  return MODEL_MODALITIES.flatMap((modality) => [...byKey.values()].filter((m) => m.modality === modality));
}

/** Which provider a model page drives: the `?node=` one, else this site's node, else the first peer. */
export function pickNetworkModelProvider(model: NetworkModel, node: string | null): NetworkModelProvider | null {
  if (node === 'local') return model.providers.find(p => p.local) ?? null;
  if (node !== null) return model.providers.find((p) => p.node.address === node.toLowerCase()) ?? null;
  return model.providers.find((p) => p.local && p.available) ?? model.providers.find(p => p.available) ?? model.providers.find(p => p.local) ?? model.providers[0] ?? null;
}

export type NetworkSelection = { kind: 'ok'; model: NetworkModel; provider: NetworkModelProvider } | { kind: 'missing' | 'ambiguous' };
export function selectNetworkModel(catalogue: NetworkModel[], id: string, node: string | null, modality: string | null): NetworkSelection {
  const models = catalogue.filter(model => model.id === id && (modality === null || model.modality === modality));
  const candidates = models.flatMap(model => { const provider = pickNetworkModelProvider(model, node); return provider ? [{ model, provider }] : []; });
  if (candidates.length !== 1) return { kind: candidates.length > 1 ? 'ambiguous' : 'missing' };
  return { kind: 'ok', ...candidates[0]! };
}

export function networkModelHref(model: NetworkModel, provider = pickNetworkModelProvider(model, null)): string {
  const query = new URLSearchParams({ modality: model.modality });
  if (provider?.node.address) query.set('node', provider.node.address);
  else if (provider?.local) query.set('node', 'local');
  return `/models/${encodeURIComponent(model.id)}?${query}`;
}

/** A provider as a person reads it: its name, else a shortened address. */
export const networkProviderLabel = (p: NetworkModelProvider): string =>
  p.node.name ?? (p.node.address ? `${p.node.address.slice(0, 8)}…${p.node.address.slice(-4)}` : '');
