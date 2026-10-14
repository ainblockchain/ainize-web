import { stableJson } from '../src/lib/ainftRegistration.js';

/** Require a real published hosted agent before spending testnet funds on its native token. */
export async function loadLiveAgentFixture(detailUrl: string, http: typeof fetch = fetch) {
  const detail = new URL(detailUrl);
  const match = detail.pathname.match(/^(.*)\/agent\/([a-z0-9][a-z0-9-]{0,39})$/);
  if (!match || !['http:', 'https:'].includes(detail.protocol) || detail.username || detail.password || detail.search || detail.hash) throw new Error('Provide the exact hosted agent detail URL');
  const agentId = match[2], root = `${detail.origin}${match[1]}`;
  const read = async (url: string) => {
    const response = await http(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Hosted agent fixture is unavailable (${response.status})`);
    return response.json();
  };
  const metadata = await read(`${root}/api/hosted-agents/${agentId}/ainft-metadata`) as Record<string, any>;
  const extension = metadata.ainize;
  const agentUrl = `${root}/agents/${agentId}`, cardUrl = `${agentUrl}/.well-known/agent-card.json`;
  if (!metadata.name || typeof metadata.name !== 'string' || typeof metadata.description !== 'string'
    || metadata.external_url !== detail.href || metadata.image !== `${root}/api/ainft/avatar.svg`
    || extension?.schemaVersion !== 1 || extension.agentId !== agentId || extension.detailUrl !== detail.href
    || extension.agentUrl !== agentUrl || extension.cardUrl !== cardUrl || extension.access !== 'holder'
    || extension.growthPolicy !== 'activity-v1' || !/^[1-9][0-9]*$/.test(extension.release ?? '')) throw new Error('Hosted agent metadata does not match the requested agent');
  const card = await read(cardUrl);
  const endpoints: string[] = Array.isArray(card.supportedInterfaces)
    ? card.supportedInterfaces.map((entry: { url?: string }) => entry?.url).filter((url: unknown): url is string => typeof url === 'string') : [];
  if (typeof card.url === 'string') endpoints.push(card.url);
  if (card.name !== metadata.name || !endpoints.length || endpoints.some((url) => url !== agentUrl)
    || String(card.version) !== extension.release) throw new Error('Hosted agent card and metadata disagree on the agent release');
  return { agentId, detailUrl: detail.href, metadata, fingerprint: stableJson(metadata) };
}
