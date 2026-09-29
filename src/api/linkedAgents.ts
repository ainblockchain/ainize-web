/**
 * Linked agents — external A2A agents a person registers on the node by URL (ainize-node
 * `docs/superpowers/specs/2026-09-29-linked-agents-design.md`), and the "which of the catalogue is mine" question
 * the `/me/agents` page asks.
 *
 * Everything that decides is here, pure and tested (`test/linked-agents-api.test.ts`); `AgentLinkPage` and
 * `MyAgentsPage` are the forms around it. Same split as `hostedAgents.ts`, for the same reason: the node ships
 * separately, and a page that trusted a declared type would render an older node's answer as blanks.
 */
import type { AgentSummary } from './types';
import { HOSTED_AGENT_ID_PATTERN, HOSTED_AGENT_RESERVED_IDS } from './hostedAgents';
import { agentOrgIdOf, agentVisibilityOf, sharingFieldsOf, sharingProblemKey, type AgentVisibility, type OrgOption } from './sharedAgents';

/** One id rule for every agent on a node — the address is `/agents/<id>` whatever kind it is. */
export const LINKED_AGENT_ID_PATTERN = HOSTED_AGENT_ID_PATTERN;
/** `/agent/link` and `/agent/new` are routes, so an agent may not be called that (see App.tsx). */
export const LINKED_AGENT_RESERVED_IDS: readonly string[] = HOSTED_AGENT_RESERVED_IDS;

export const isLinkedAgentIdValid = (id: string): boolean => LINKED_AGENT_ID_PATTERN.test(id) && !LINKED_AGENT_RESERVED_IDS.includes(id);

/** A suggestion for the id from a name: lower-case, hyphens, the id alphabet only. The person may overwrite it. */
export function linkedAgentIdFromName(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export interface LinkedAgentFormDraft {
  id: string;
  name: string;
  description: string;
  upstream: string;
  /** Who may see it (shared-agent registry). `orgId` goes with `org` only. */
  visibility: AgentVisibility;
  orgId: string | null;
}

export type LinkedAgentFormField = keyof LinkedAgentFormDraft;
export interface LinkedAgentFormProblem { field: LinkedAgentFormField; key: string }

/** Is this a URL the node will accept as an upstream — absolute, http or https? The public-address check is the node's. */
export function isLinkedAgentUpstreamValid(upstream: string): boolean {
  try {
    const u = new URL(upstream.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

/** What the form shows beside a field before it asks the node. Mirrors the node's zod schema, so a refusal is rare. */
export function linkedAgentFormProblems(draft: LinkedAgentFormDraft, orgs?: readonly OrgOption[] | null): LinkedAgentFormProblem[] {
  const out: LinkedAgentFormProblem[] = [];
  const sharing = sharingProblemKey(draft.visibility, draft.orgId, orgs);
  if (sharing) out.push({ field: 'orgId', key: sharing });
  if (!isLinkedAgentIdValid(draft.id)) out.push({ field: 'id', key: LINKED_AGENT_RESERVED_IDS.includes(draft.id) ? 'agentLink.problem.id_reserved' : 'agentLink.problem.id' });
  if (draft.name.trim().length > 80) out.push({ field: 'name', key: 'agentLink.problem.name' });
  if (draft.description.trim().length > 500) out.push({ field: 'description', key: 'agentLink.problem.description' });
  if (!isLinkedAgentUpstreamValid(draft.upstream)) out.push({ field: 'upstream', key: 'agentLink.problem.upstream' });
  return out;
}

export interface LinkedAgentInput { id: string; name: string; description: string; upstream: string; visibility?: AgentVisibility; orgId?: string | null }

/** The body. `visibility` is always sent: PUT replaces the record, and a save that dropped it would make an org agent public again. */
export function linkedAgentInputFromDraft(draft: LinkedAgentFormDraft): LinkedAgentInput {
  return { id: draft.id.trim(), name: draft.name.trim(), description: draft.description.trim(), upstream: draft.upstream.trim(), ...sharingFieldsOf(draft.visibility, draft.orgId) };
}

/** The node's answer to register / read / change, read defensively. */
export interface LinkedAgentView {
  id: string;
  name: string;
  description: string;
  owner: string;
  a2a_url: string;
  card_url: string;
  /** Only the owner's read (`GET /api/linked-agents/:id`) carries it; the catalogue never does. */
  upstream: string | null;
  /** Set on register and change: did the upstream answer with a card just now? */
  reachable: boolean | null;
  error: string | null;
  /** Who may see it; `null` from a node older than the registry, which the form reads as `public`. */
  visibility: AgentVisibility | null;
  orgId: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export function parseLinkedAgentResponse(body: unknown): LinkedAgentView | null {
  const agent = (body as { agent?: unknown } | null | undefined)?.agent as Record<string, unknown> | undefined;
  if (!agent || typeof agent !== 'object') return null;
  const id = str(agent.id); const name = str(agent.name); const a2a = str(agent.a2a_url); const card = str(agent.card_url);
  if (!id || !name || !a2a || !card) return null;
  return {
    id, name, description: str(agent.description) ?? '', owner: str(agent.owner) ?? '', a2a_url: a2a, card_url: card,
    upstream: str(agent.upstream),
    reachable: typeof agent.reachable === 'boolean' ? agent.reachable : null,
    error: str(agent.error),
    visibility: agentVisibilityOf(agent),
    orgId: agentOrgIdOf(agent),
  };
}

export function linkedAgentDraftFromView(view: LinkedAgentView): LinkedAgentFormDraft {
  return { id: view.id, name: view.name, description: view.description, upstream: view.upstream ?? '', visibility: view.visibility ?? 'public', orgId: view.orgId };
}

export type LinkedAgentApiErrorCode =
  | 'not_signed_in' | 'invalid_request' | 'upstream_not_public' | 'name_required' | 'id_taken' | 'limit_reached'
  | 'not_owner' | 'not_found' | 'unreachable' | 'unknown';

export interface LinkedAgentApiError { status: number | null; code: LinkedAgentApiErrorCode; message: string | null }

const KNOWN: readonly LinkedAgentApiErrorCode[] = ['not_signed_in', 'invalid_request', 'upstream_not_public', 'name_required', 'id_taken', 'limit_reached', 'not_owner', 'not_found'];

/**
 * An RTK Query error into something a page can switch on. A newer node says `{ error: { code, message } }`; an older
 * one, or the proxy, may say `{ error: "text" }`, HTML, or nothing (the request never got an answer).
 */
export function linkedAgentApiErrorOf(err: unknown): LinkedAgentApiError {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown; error?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  const body = e.data as { error?: unknown } | null | undefined;
  const inner = body?.error as { code?: unknown; message?: unknown } | string | undefined;
  if (inner && typeof inner === 'object') {
    const code = str(inner.code);
    return { status, code: code && (KNOWN as readonly string[]).includes(code) ? (code as LinkedAgentApiErrorCode) : fromStatus(status), message: str(inner.message) };
  }
  if (typeof inner === 'string') return { status, code: fromStatus(status), message: inner };
  if (status === null && typeof e.error === 'string') return { status, code: 'unreachable', message: e.error };
  return { status, code: fromStatus(status), message: null };
}

function fromStatus(status: number | null): LinkedAgentApiErrorCode {
  if (status === 401) return 'not_signed_in';
  if (status === 403) return 'not_owner';
  if (status === 404) return 'not_found';
  if (status === 409) return 'id_taken';
  if (status === 429) return 'limit_reached';
  if (status === 400) return 'invalid_request';
  return status === null ? 'unreachable' : 'unknown';
}

/**
 * Every principal the signed-in person is on this node: their wallet address (lower-case) and their AIN SSO
 * principal (`sso:<sub>`, case kept — an OIDC `sub` is case-sensitive). A hosted agent is owned by the former, a
 * linked agent by whichever the person was signed in with when they registered it.
 */
export function viewerPrincipals(subject: string | null | undefined, ssoPrincipal: string | null | undefined): string[] {
  const out: string[] = [];
  if (subject) out.push(subject.toLowerCase());
  if (ssoPrincipal) out.push(ssoPrincipal);
  return out;
}

/** Is this catalogue row owned by one of the viewer's principals? A row with no owner (a config agent, a peer's) is nobody's. */
export function isAgentOwnedBy(owner: string | null | undefined, principals: readonly string[]): boolean {
  if (!owner) return false;
  const o = /^0x[0-9a-fA-F]{40}$/.test(owner) ? owner.toLowerCase() : owner;
  return principals.includes(o);
}

/** The viewer's own agents in the catalogue, whatever kind — what `/me/agents` lists. */
export function agentsOwnedBy(agents: readonly AgentSummary[], principals: readonly string[]): AgentSummary[] {
  return agents.filter((a) => isAgentOwnedBy(a.owner, principals));
}

/** A linked agent is a proxied upstream with an owner; a config agent is the same shape with none. */
export function isLinkedAgentRow(agent: Pick<AgentSummary, 'kind' | 'owner' | 'node'>): boolean {
  return (agent.kind ?? 'upstream') === 'upstream' && !!agent.owner && !agent.node;
}
