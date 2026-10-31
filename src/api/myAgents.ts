import type { AgentSummary } from './types';
import { agentsOwnedBy, isAgentOwnedBy } from './linkedAgents';
import { agentSummaryFromLinkedList, type ManageableAgent } from './sharedAgents';

export interface MyAgentRow { agent: AgentSummary; canEdit: boolean; canDelete: boolean; shared: boolean }

/** The owner's linked list includes private/unlisted records omitted from the public catalogue. */
export function parseMyLinkedAgents(raw: unknown): AgentSummary[] | null {
  const agents = (raw as { agents?: unknown } | null)?.agents;
  if (!Array.isArray(agents)) return null;
  const result: AgentSummary[] = [];
  for (const row of agents) {
    if (!row || typeof row.id !== 'string') return null;
    const agent = agentSummaryFromLinkedList({ agents: [row] }, row.id);
    if (!agent?.owner) return null;
    result.push(agent);
  }
  return result;
}

/** Management permissions come from the local store; catalogue rows only enrich health/usage. */
export function myAgentRows(catalogue: readonly AgentSummary[], managed: readonly ManageableAgent[], linked: readonly AgentSummary[], principals: string[]): MyAgentRow[] {
  const local = catalogue.filter(a => !a.node);
  const enrich = (agent: AgentSummary): AgentSummary => {
    const publicRow = local.find(a => a.id === agent.id);
    return publicRow ? { ...publicRow, ...agent, reachable: publicRow.reachable, last_checked: publicRow.last_checked, calls: publicRow.calls, last_call_at: publicRow.last_call_at } : agent;
  };
  const rows = new Map<string, MyAgentRow>();
  for (const row of managed) {
    rows.set(row.agent.id, { agent: enrich(row.agent), canEdit: row.canManage, canDelete: row.canDelete, shared: !isAgentOwnedBy(row.agent.owner, principals) });
  }
  for (const agent of agentsOwnedBy([...linked], principals)) {
    rows.set(agent.id, { agent: enrich(agent), canEdit: true, canDelete: true, shared: false });
  }
  for (const agent of agentsOwnedBy(local, principals)) {
    if (!rows.has(agent.id)) rows.set(agent.id, { agent, canEdit: true, canDelete: true, shared: false });
  }
  return [...rows.values()];
}
