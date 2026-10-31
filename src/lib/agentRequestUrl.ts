import type { AgentSummary } from '../api/types';

/** A peer's short registered address can change owners; invoke and share its node-qualified route. */
export function agentEndpoints(agent: Pick<AgentSummary, 'id' | 'node' | 'a2a_url' | 'card_url' | 'call_url'>): { call: string; card: string } {
  if (!agent.node) return { call: agent.a2a_url, card: agent.card_url };
  const call = typeof agent.call_url === 'string' && agent.call_url.trim() ? agent.call_url
    : `/api/sam/${encodeURIComponent(agent.node.address)}/a2a/${encodeURIComponent(agent.id)}`;
  return { call, card: `${call.replace(/\/+$/, '')}/.well-known/agent-card.json` };
}

/** Relativize only this site's API routes, including its www alias. Preserve another node's destination. */
export function agentRequestUrl(value: string, origin: string): string {
  try {
    const url = new URL(value, origin);
    const here = new URL(origin);
    const sameSite = url.protocol === here.protocol && url.port === here.port
      && url.hostname.replace(/^www\./, '') === here.hostname.replace(/^www\./, '');
    return sameSite && /^\/(api|agents)\//.test(url.pathname) ? url.pathname + url.search : value;
  } catch { return value; }
}
