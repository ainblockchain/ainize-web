/**
 * Shared agents — who may see an agent, and the registry that says so.
 *
 * Until now every agent on a node was public: listed to everyone, callable by everyone. The shared-agent registry
 * (ainize-node `feat/shared-agent-registry`, contract 1.0 from `@ain/integration-contracts`) gives an agent a
 * `visibility` and, for `org`, the organization it is shared with — an AIN SSO organization the owner belongs to.
 * AIN Teams and the other products read the same list, scoped the same way, so what a person sees here is what
 * their workspace imports.
 *
 *   • `public`   — listed to everyone, as before. The default, and what every agent stored before this was.
 *   • `org`      — listed to members of `orgId`. The owner picks one of the organizations their AIN account is in.
 *   • `private`  — the owner's alone.
 *   • `unlisted` — in no listing; answers to anyone who holds the id. Visibility is about LISTING, never the wire:
 *                  an A2A address stays public by construction whatever the visibility says.
 *
 * Everything here is pure and read defensively, as `hostedAgents.ts` and `linkedAgents.ts` are and for the same
 * reason: the node ships separately. An older node has no `/api/shared-agents` (404) and sends rows without
 * `visibility`; both have to land on the page as something true — a public list, and no badge — never as a guess.
 * `test/shared-agents-api.test.ts` pins it.
 */
import type { AgentSkill, AgentSummary } from './types';
import { foldOwner, type HostedAgentKind } from './hostedAgents';

// ─────────────────────────────────────────────────────────────── visibility

export type AgentVisibility = 'public' | 'org' | 'private' | 'unlisted';
export const AGENT_VISIBILITIES: readonly AgentVisibility[] = ['public', 'org', 'private', 'unlisted'];

const oneOf = <T extends string>(list: readonly T[], value: unknown): T | null =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : null;

/**
 * A row's visibility, or `null` when the node did not say. Absent is NOT `public`: an older node sends nothing,
 * and a badge that claimed "public" would be a claim nobody made. Callers that need a value to act on (the edit
 * form) fall back to `public` themselves, because that is what every agent stored before visibility existed.
 */
export function agentVisibilityOf(row: Record<string, unknown> | AgentSummary | null | undefined): AgentVisibility | null {
  return oneOf(AGENT_VISIBILITIES, (row as Record<string, unknown> | null | undefined)?.visibility);
}

/** The organization an `org` agent is shared with — `org_id` on a listing row, `orgId` on a stored spec. */
export function agentOrgIdOf(row: Record<string, unknown> | AgentSummary | null | undefined): string | null {
  const r = (row ?? {}) as Record<string, unknown>;
  const v = r.org_id ?? r.orgId;
  return typeof v === 'string' && v ? v : null;
}

/** An organization the signed-in AIN account belongs to, as `/api/auth/me` reports it. */
export interface OrgOption { id: string; slug: string; name: string }

/**
 * What the visibility control may offer this person.
 *
 * `org` needs an organization to share with, and only an AIN SSO session has any: a wallet belongs to none, and the
 * node refuses `org` from one ("a wallet belongs to none"). The control still SHOWS the option — disabled, with the
 * reason — rather than hiding it, so a person signed in with a wallet learns the feature exists and why it is off.
 */
export function orgVisibilityAvailable(orgs: readonly OrgOption[] | null | undefined): boolean {
  return Array.isArray(orgs) && orgs.length > 0;
}

/**
 * The org to preselect when a person switches to `org`: the active one, else the only one, else none — the form
 * then asks rather than picking a random organization to share a private agent with.
 */
export function defaultOrgIdFor(orgs: readonly OrgOption[] | null | undefined, activeOrg: string | null | undefined): string | null {
  if (!Array.isArray(orgs) || orgs.length === 0) return null;
  if (activeOrg && orgs.some((o) => o.id === activeOrg)) return activeOrg;
  return orgs.length === 1 ? orgs[0].id : null;
}

/** The pair a spec carries. `orgId` goes with `org` and only with `org` — the node's rule, applied before it is asked. */
export function sharingFieldsOf(visibility: AgentVisibility | null | undefined, orgId: string | null | undefined): { visibility: AgentVisibility; orgId: string | null } {
  const v = visibility ?? 'public';
  return { visibility: v, orgId: v === 'org' && orgId ? orgId : null };
}

/** The dictionary key of what is wrong with a sharing choice, or `null` when nothing is. */
export function sharingProblemKey(visibility: AgentVisibility, orgId: string | null, orgs: readonly OrgOption[] | null | undefined): string | null {
  if (visibility !== 'org') return null;
  if (!orgVisibilityAvailable(orgs)) return 'sharing.err.org_needs_sso';
  if (!orgId) return 'sharing.err.org_required';
  if (!orgs!.some((o) => o.id === orgId)) return 'sharing.err.org_not_member';
  return null;
}

// ─────────────────────────────────────────────────────────────── the registry (contract 1.0)

/** `GET /api/shared-agents?scope=` — the four views the registry offers. */
export type AgentListScope = 'public' | 'mine' | 'shared_with_me' | 'shared_with_org';
export const AGENT_LIST_SCOPES: readonly AgentListScope[] = ['public', 'mine', 'shared_with_me', 'shared_with_org'];

export type AgentRefStatus = 'active' | 'disabled' | 'stopped' | 'deleted';
const AGENT_REF_STATUSES: readonly AgentRefStatus[] = ['active', 'disabled', 'stopped', 'deleted'];

export interface OwnerRef { kind: 'account' | 'org' | 'wallet' | 'principal'; issuer: string; subject: string }

/** One agent as the shared registry describes it (`@ain/integration-contracts` `AgentRef`). */
export interface AgentRef {
  registryIssuer: string;
  agentId: string;
  /** `v<n>` for a hosted agent, `linked-v<n>` for a linked one, `upstream` for an operator's config agent. */
  releaseId: string;
  ownerRef: OwnerRef | null;
  visibility: AgentVisibility;
  orgRef: OwnerRef | null;
  agentCardUrl: string;
  endpoint: string;
  supportedProtocolVersions: string[];
  skills: { id: string; name: string; description?: string; examples?: string[] }[];
  inputModes: string[];
  outputModes: string[];
  uiCapabilities: string[];
  status: AgentRefStatus;
  displayName: string;
  description: string | null;
  updatedAt: string | null;
}

export interface SharedAgentsPage { items: { ref: AgentRef; canInvoke: boolean }[]; nextCursor: string | null; asOf: string | null }

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function ownerRefOf(v: unknown): OwnerRef | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kind = oneOf(['account', 'org', 'wallet', 'principal'] as const, o.kind);
  const issuer = str(o.issuer); const subject = str(o.subject);
  return kind && issuer && subject ? { kind, issuer, subject } : null;
}

/** One ref, or `null` when it is not one — no id, no endpoint, or a visibility this build has not heard of. */
export function parseAgentRef(raw: unknown): AgentRef | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const agentId = str(r.agentId); const endpoint = str(r.endpoint); const card = str(r.agentCardUrl);
  const visibility = oneOf(AGENT_VISIBILITIES, r.visibility);
  if (!agentId || !endpoint || !card || !visibility) return null;
  const skills: AgentRef['skills'] = [];
  for (const s of Array.isArray(r.skills) ? r.skills : []) {
    if (!s || typeof s !== 'object') continue;
    const sk = s as Record<string, unknown>;
    const id = str(sk.id); const name = str(sk.name);
    if (!id || !name) continue;
    skills.push({ id, name, ...(str(sk.description) ? { description: str(sk.description)! } : {}), ...(strList(sk.examples).length ? { examples: strList(sk.examples) } : {}) });
  }
  return {
    registryIssuer: str(r.registryIssuer) ?? '',
    agentId,
    releaseId: str(r.releaseId) ?? 'unversioned',
    ownerRef: ownerRefOf(r.ownerRef),
    visibility,
    orgRef: ownerRefOf(r.orgRef),
    agentCardUrl: card,
    endpoint,
    supportedProtocolVersions: strList(r.supportedProtocolVersions),
    skills,
    inputModes: strList(r.inputModes),
    outputModes: strList(r.outputModes),
    uiCapabilities: strList(r.uiCapabilities),
    status: oneOf(AGENT_REF_STATUSES, r.status) ?? 'active',
    displayName: str(r.displayName) ?? agentId,
    description: str(r.description),
    updatedAt: str(r.updatedAt),
  };
}

/** `GET /api/shared-agents` → the page, or `null` when the body is not one (an older node's 404 page, a proxy error). */
export function parseSharedAgentsResponse(raw: unknown): SharedAgentsPage | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.items)) return null;
  const items: SharedAgentsPage['items'] = [];
  for (const it of r.items) {
    const ref = parseAgentRef((it as { ref?: unknown } | null)?.ref);
    if (ref) items.push({ ref, canInvoke: (it as { canInvoke?: unknown }).canInvoke !== false });
  }
  return { items, nextCursor: str(r.nextCursor), asOf: str(r.asOf) };
}

/** `releaseId` → the row's `kind`: a linked or config agent is an upstream the node forwards to; a hosted one's mode is not in the ref. */
export function agentKindFromReleaseId(releaseId: string): HostedAgentKind | null {
  return releaseId === 'upstream' || releaseId.startsWith('linked-') ? 'upstream' : null;
}

/** The A2UI extension URI the row badge looks for (`AgentListItem`), stood in for by the contract's `a2ui_basic` capability. */
export const A2UI_EXTENSION_STAND_IN = 'https://a2ui.org/a2ui/v0.9';

/**
 * A ref as a marketplace row, so the one list component renders both sources.
 *
 * What the ref does not carry stays honest: `reachable` is `null` (the registry says whether the agent is `active`,
 * not whether its card answered just now), `calls` is `null` (not counted here), and `node` is `null` unless the
 * ref names a registry other than the one this page is on — then the issuer stands in for the node's name.
 */
export function agentSummaryFromRef(ref: AgentRef, thisRegistry?: string | null): AgentSummary {
  const skills: AgentSkill[] = ref.skills.map((s) => ({ id: s.id, name: s.name, ...(s.description ? { description: s.description } : {}), tags: [], examples: s.examples ?? [] }));
  const own = !thisRegistry || !ref.registryIssuer || trimSlash(ref.registryIssuer) === trimSlash(thisRegistry);
  return {
    id: ref.agentId,
    name: ref.displayName,
    description: ref.description,
    skills,
    protocols: ref.supportedProtocolVersions,
    extensions: ref.uiCapabilities.some((c) => c === 'a2ui_basic' || c === 'ainui') ? [A2UI_EXTENSION_STAND_IN] : [],
    provider: null,
    documentation_url: null,
    a2a_url: ref.endpoint,
    card_url: ref.agentCardUrl,
    reachable: ref.status === 'stopped' || ref.status === 'deleted' ? false : null,
    last_checked: null,
    error: null,
    calls: null,
    last_call_at: null,
    node: own ? null : { address: ref.registryIssuer, name: hostOf(ref.registryIssuer) },
    kind: agentKindFromReleaseId(ref.releaseId),
    owner: ref.ownerRef?.kind === 'org' ? null : ref.ownerRef?.subject ?? null,
    visibility: ref.visibility,
    org_id: ref.orgRef?.subject ?? null,
  };
}

const trimSlash = (u: string) => u.replace(/\/+$/, '');
const hostOf = (u: string): string => { try { return new URL(u).host; } catch { return u; } };

// ─────────────────────────────────────────────────────────────── the list, on the page

/** Which chip a signed-in person may pick. `shared_with_me` is the registry's, not a chip: it is what `mine` and `org` add up to. */
export type AgentListFilter = 'all' | 'mine' | 'org';
export const AGENT_LIST_FILTERS: readonly AgentListFilter[] = ['all', 'mine', 'org'];

export const scopeForFilter = (f: AgentListFilter): AgentListScope => (f === 'mine' ? 'mine' : f === 'org' ? 'shared_with_org' : 'public');

/**
 * A key that is one row, not one id. Two nodes can each run an agent called `donga-desk` (host-an-agent.md, "An id
 * is not an identity"), and a list keyed by id alone re-used one row's state for the other.
 */
export function agentListKey(agent: Pick<AgentSummary, 'id' | 'node'>): string {
  return `${agent.node?.address ?? 'self'}#${agent.id}`;
}

/**
 * What the visibility badge says, or nothing.
 *
 * `public` is the ordinary state and says nothing a reader needs, and a row from an older node has no visibility
 * at all — neither gets a chip. Only an agent that is NOT for everyone is marked, because that is the one fact a
 * person about to share the address should know.
 */
export function visibilityBadgeOf(agent: AgentSummary | Record<string, unknown> | null | undefined): Exclude<AgentVisibility, 'public'> | null {
  const v = agentVisibilityOf(agent);
  return v && v !== 'public' ? v : null;
}

/**
 * Is `err` the answer of a node that has no `/api/shared-agents`? A 404 from Express is HTML, not the contract's
 * error body — so a 404 with no coded body means the route does not exist, and the page falls back to `/api/agents`.
 */
export function sharedAgentsUnsupported(err: unknown): boolean {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  if (status !== 404) return false;
  const code = ((e.data as { error?: { code?: unknown } } | null)?.error as { code?: unknown } | undefined)?.code;
  return typeof code !== 'string';
}

/** The contract's refusal, when the node named one: `auth_required` is the one the page acts on (sign in). */
export function sharedAgentsErrorCode(err: unknown): string | null {
  const e = (err ?? {}) as { data?: unknown };
  const code = ((e.data as { error?: { code?: unknown } } | null)?.error as { code?: unknown } | undefined)?.code;
  return typeof code === 'string' ? code : null;
}

/**
 * The public list, when the registry is unavailable and the chip asks for more than "everyone's".
 *
 * `mine` can be answered from `/api/agents` by owner, as `/me/agents` does. `org` cannot — an older node has no
 * organizations — so the fallback is the public list and the page says the node does not know about organizations.
 */
export function fallbackRows(filter: AgentListFilter, agents: readonly AgentSummary[], principals: readonly string[]): AgentSummary[] {
  if (filter !== 'mine') return [...agents];
  return agents.filter((a) => {
    const o = a.owner;
    if (!o) return false;
    return principals.includes(foldOwner(o));
  });
}

/** `PUT /api/shared-agents/:id/visibility` body. */
export interface AgentVisibilityInput { id: string; visibility: AgentVisibility; orgId?: string | null }

// ─────────────────────────────────────────────────────────────── one agent, found off the public list

/**
 * The agent page reads the public list and finds its id there. An `org` or `private` agent is not on that list, so
 * the page then asks the two stores that know non-public agents: the hosted spec (readable by its owner and, as a
 * listing view, by anyone it is visible to) and the linked-agents list. Either answer becomes a row.
 */
export function agentSummaryFromHostedSpecResponse(raw: unknown, origin: string): AgentSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const outer = raw as Record<string, unknown>;
  const inner = (outer.agent && typeof outer.agent === 'object' ? outer.agent : outer.spec && typeof outer.spec === 'object' ? outer.spec : outer) as Record<string, unknown>;
  const id = str(inner.id);
  if (!id) return null;
  const base = `${trimSlash(origin)}/agents/${encodeURIComponent(id)}`;
  const skills: AgentSkill[] = [];
  for (const s of Array.isArray(inner.skills) ? inner.skills : []) {
    const sk = (s ?? {}) as Record<string, unknown>;
    const sid = str(sk.id); const name = str(sk.name);
    if (sid && name) skills.push({ id: sid, name, ...(str(sk.description) ? { description: str(sk.description)! } : {}), tags: [], examples: strList(sk.examples) });
  }
  const mode = oneOf(['prompt', 'tools', 'handler'] as const, inner.mode);
  return {
    id,
    name: str(inner.name) ?? id,
    description: str(inner.description),
    skills,
    protocols: [],
    extensions: inner.a2ui === true ? [A2UI_EXTENSION_STAND_IN] : [],
    provider: null,
    documentation_url: null,
    a2a_url: str(outer.a2a_url) ?? str(inner.a2a_url) ?? base,
    card_url: str(outer.card_url) ?? str(inner.card_url) ?? `${base}/.well-known/agent-card.json`,
    reachable: null,
    last_checked: null,
    error: null,
    calls: null,
    last_call_at: null,
    node: null,
    model: str(inner.model),
    kind: mode,
    owner: typeof inner.owner === 'string' ? foldOwner(inner.owner) : null,
    status: oneOf(['building', 'ready', 'failed'] as const, inner.status),
    visibility: agentVisibilityOf(inner),
    org_id: agentOrgIdOf(inner),
  };
}

/** `GET /api/linked-agents` → the one row with this id, as a marketplace row, or `null`. */
export function agentSummaryFromLinkedList(raw: unknown, id: string): AgentSummary | null {
  const agents = (raw as { agents?: unknown } | null | undefined)?.agents;
  if (!Array.isArray(agents)) return null;
  const hit = agents.find((a) => a && typeof a === 'object' && (a as { id?: unknown }).id === id) as Record<string, unknown> | undefined;
  if (!hit) return null;
  const a2a = str(hit.a2a_url); const card = str(hit.card_url);
  if (!a2a || !card) return null;
  return {
    id,
    name: str(hit.name) ?? id,
    description: str(hit.description),
    skills: [],
    protocols: [],
    extensions: [],
    provider: null,
    documentation_url: null,
    a2a_url: a2a,
    card_url: card,
    reachable: typeof hit.reachable === 'boolean' ? hit.reachable : null,
    last_checked: null,
    error: str(hit.error),
    calls: null,
    last_call_at: null,
    node: null,
    kind: 'upstream',
    owner: typeof hit.owner === 'string' ? foldOwner(hit.owner) : null,
    visibility: agentVisibilityOf(hit),
    org_id: agentOrgIdOf(hit),
  };
}
