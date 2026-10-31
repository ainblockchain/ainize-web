import { modelsFetchState, readModelsResponse, type PublicModelCard } from './models';
import { networkModelHref, readNetworkModelsResponse, type NetworkModelProvider } from './networkModels';
import type { HostedAgentMedia } from './hostedAgents';

export type AgentModelChoice = PublicModelCard & { modelId: string; provider: NetworkModelProvider; href: string };
export interface AgentModelSelection { model: string; media: HostedAgentMedia }
export function hostedAgentModels(input: { own: unknown; ownError?: unknown; network: unknown; networkError?: unknown; self: string | null }) {
  const own = input.ownError ? null : readModelsResponse(input.own);
  const network = input.networkError ? null : readNetworkModelsResponse(input.network, input.self);
  // Spec creation requires registration, not a successful inference health probe. Health is shown separately.
  const cards = [...(own?.models ?? []), ...(network?.models.filter(row => !row.local && row.available) ?? [])];
  const choices: AgentModelChoice[] = [];
  for (const row of own?.models ?? []) {
    if (row.modality !== 'chat') continue;
    const address = /^0x[0-9a-f]{40}$/i.test(input.self ?? '') ? input.self!.toLowerCase() : '';
    const provider: NetworkModelProvider = { ref: address ? `${row.id}@${address}` : row.id, node: { address, name: null }, local: true, available: row.available };
    choices.push({ ...row, id: provider.ref, modelId: row.id, provider, href: networkModelHref({ id: row.id, modality: 'chat', providers: [provider] }, provider) });
  }
  for (const row of network?.models ?? []) {
    if (row.local || row.modality !== 'chat') continue;
    choices.push({ ...row, id: row.ref, modelId: row.id, provider: row, href: networkModelHref({ id: row.id, modality: 'chat', providers: [row] }, row) });
  }
  const complete = own !== null && (network !== null || modelsFetchState(input.networkError as Parameters<typeof modelsFetchState>[0]) === 'outdated');
  return { choices, complete, media: {
    transcription: cards.some(card => card.modality === 'transcription'),
    image: cards.some(card => card.modality === 'image'),
  } };
}
export function hostedAgentModelChoice(choices: AgentModelChoice[], id: string): AgentModelChoice | null {
  const direct = choices.find(choice => choice.id === id);
  if (direct) return direct;
  // Address casing is not a different provider. Keep the original spec reference in the select value.
  const pinned = /^(.+)@(0x[0-9a-f]{40})$/i.exec(id);
  const matching = choices.find(choice => pinned
    ? choice.provider.node.address.toLowerCase() === pinned[2].toLowerCase() && choice.modelId === pinned[1]
    : choice.provider.local && choice.modelId === id);
  return matching ? { ...matching, id } : null;
}
/** A link names the same model/provider as the form, even when that provider is currently missing. */
export const hostedAgentModelIsPinned = (id: string): boolean => /^.+@0x[0-9a-f]{40}$/i.test(id);
/** A new form opened with a bare local id must persist the chosen node, not automatic future peer routing. */
export function hostedAgentModelPrefill(id: string, self: string | null): string {
  return id && !hostedAgentModelIsPinned(id) && /^0x[0-9a-f]{40}$/i.test(self ?? '') ? `${id}@${self!.toLowerCase()}` : id;
}
export function hostedAgentModelHref(id: string): string {
  const pinned = /^(.+)@(0x[0-9a-f]{40})$/i.exec(id);
  const params = new URLSearchParams({ modality: 'chat' });
  if (pinned) params.set('node', pinned[2].toLowerCase());
  return `/models/${encodeURIComponent(pinned ? pinned[1] : id)}?${params}`;
}
export function hostedAgentSelectionUsable(selection: AgentModelSelection, read: ReturnType<typeof hostedAgentModels>, existing?: AgentModelSelection | null): boolean {
  // An unrelated edit may preserve an existing missing model; it must not silently replace or re-enable it.
  const choice = hostedAgentModelChoice(read.choices, selection.model);
  if (!selection.model || (!(choice && hostedAgentModelIsPinned(selection.model) && (choice.provider.local || choice.available)) && existing?.model !== selection.model)) return false;
  return (!selection.media.transcription || read.media.transcription || existing?.media.transcription === true)
    && (!selection.media.image || read.media.image || existing?.media.image === true);
}
export async function confirmHostedAgentSelection(options: {
  selection: AgentModelSelection;
  existing?: AgentModelSelection | null;
  self: string | null;
  current: () => boolean;
  own: () => Promise<unknown>;
  network: () => Promise<unknown>;
}): Promise<void> {
  if (!options.current()) throw new Error('editor_departed');
  const [own, network] = await Promise.allSettled([options.own(), options.network()]);
  if (!options.current()) throw new Error('editor_departed');
  const read = hostedAgentModels({ self: options.self,
    own: own.status === 'fulfilled' ? own.value : undefined, ownError: own.status === 'rejected' ? own.reason : undefined,
    network: network.status === 'fulfilled' ? network.value : undefined, networkError: network.status === 'rejected' ? network.reason : undefined });
  if (!hostedAgentSelectionUsable(options.selection, read, options.existing)) throw new Error('model_selection_unavailable');
}
