/**
 * Organizations (ainize-node organizations design): a team's page on the node, who is in it and what each may do,
 * and the agents registered under it.
 *
 * Everything here is pure and tested (`test/organizations-api.test.ts`): the id rule, the role ranks, the form
 * rules, the response readers and the error codes. The pages under `src/screens/org/` are the forms around it.
 * Responses are read defensively — a node from before organizations answers 404 for every route here, and a
 * newer node may add fields — so a missing field becomes `null`, never a crash.
 */
import { HOSTED_AGENT_ID_PATTERN } from './hostedAgents';

export const ORG_ROLES = ['read', 'contributor', 'write', 'admin'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];
const RANK: Record<OrgRole, number> = { read: 0, contributor: 1, write: 2, admin: 3 };
export const isOrgRole = (v: unknown): v is OrgRole => typeof v === 'string' && (ORG_ROLES as readonly string[]).includes(v);
export const roleAtLeast = (role: OrgRole | null | undefined, min: OrgRole): boolean => role != null && RANK[role] >= RANK[min];

/** The node's id rule, and the words under `/org/` that are pages here rather than organizations. */
export const ORG_ID_PATTERN = HOSTED_AGENT_ID_PATTERN;
export const ORG_RESERVED_IDS: readonly string[] = ['new', 'join', 'mine'];
export const isOrgIdValid = (id: string): boolean => ORG_ID_PATTERN.test(id) && !ORG_RESERVED_IDS.includes(id);

/** "ComCom Inc." → `comcom-inc` — the same courtesy the agent forms do. */
export function orgIdFromName(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
export function emailDomain(email: string | null | undefined): string | null {
  const at = (email ?? '').lastIndexOf('@');
  if (at < 0) return null;
  const d = (email as string).slice(at + 1).trim().toLowerCase();
  return DOMAIN.test(d) ? d : null;
}

// ------------------------------------------------------------------------------------------------ forms

export interface OrgFormDraft { id: string; name: string; description: string; readme: string; claimDomain: boolean; domainRole: OrgRole }
export type OrgFormField = keyof OrgFormDraft;
export interface OrgFormProblem { field: OrgFormField; key: string }

export function orgFormProblems(draft: OrgFormDraft): OrgFormProblem[] {
  const out: OrgFormProblem[] = [];
  if (!isOrgIdValid(draft.id)) out.push({ field: 'id', key: ORG_RESERVED_IDS.includes(draft.id) ? 'org.problem.id_reserved' : 'org.problem.id' });
  if (!draft.name.trim() || draft.name.trim().length > 80) out.push({ field: 'name', key: 'org.problem.name' });
  if (draft.description.length > 500) out.push({ field: 'description', key: 'org.problem.description' });
  if (draft.readme.length > 20_000) out.push({ field: 'readme', key: 'org.problem.readme' });
  return out;
}

export interface OrgCreateInput { id: string; name: string; description: string; readme: string; domains: string[]; domainRole: OrgRole }

/** `domain` is the signed-in email's — the only one the node lets this person claim. */
export function orgCreateInputFromDraft(draft: OrgFormDraft, domain: string | null): OrgCreateInput {
  return {
    id: draft.id.trim(), name: draft.name.trim(), description: draft.description.trim(), readme: draft.readme,
    domains: draft.claimDomain && domain ? [domain] : [], domainRole: draft.domainRole,
  };
}

export interface OrgUpdateInput {
  name?: string; description?: string; readme?: string; domains?: string[]; domainRole?: OrgRole; ssoOrgIds?: string[]; spendCapCredits?: number | null;
}

// ------------------------------------------------------------------------------------------------ views

export interface OrgSummary {
  id: string; name: string; description: string; domains: string[]; member_count: number; agent_count: number;
  created_at: number | null; updated_at: number | null; my_role: OrgRole | null;
  /** how the viewer is in it, on the list page */
  via: 'member' | 'domain' | 'sso' | null;
}

export interface OrgMemberView { principal: string; role: OrgRole; name: string | null; email: string | null; added_at: number | null; via: string }
export interface OrgGroupView { id: string; name: string; members: string[]; agents: string[] }
export interface OrgAgentView {
  id: string; name: string; description: string; owner: string; org: string | null; visibility: 'public' | 'private'; group: string | null;
  a2a_url: string; card_url: string; calls: number; last_call_at: number | null; created_at: number | null; updated_at: number | null;
}

export interface OrgProfile extends OrgSummary {
  readme: string; domain_role: OrgRole; sso_org_ids: string[]; spend_cap_credits: number | null; created_by: string | null;
  members: OrgMemberView[]; groups: OrgGroupView[]; pending_requests: number; open_invites: number; agents: OrgAgentView[]; hidden_agents: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

export function parseOrgSummary(raw: unknown): OrgSummary | null {
  const r = obj(raw);
  const id = r && str(r.id);
  if (!r || !id) return null;
  const role = r.my_role;
  return {
    id, name: str(r.name) ?? id, description: str(r.description) ?? '', domains: strs(r.domains),
    member_count: num(r.member_count) ?? 0, agent_count: num(r.agent_count) ?? 0, created_at: num(r.created_at), updated_at: num(r.updated_at),
    my_role: isOrgRole(role) ? role : null, via: r.via === 'member' || r.via === 'domain' || r.via === 'sso' ? r.via : null,
  };
}

export function parseOrgMember(raw: unknown): OrgMemberView | null {
  const r = obj(raw);
  const principal = r && str(r.principal);
  if (!r || !principal) return null;
  return { principal, role: isOrgRole(r.role) ? r.role : 'read', name: str(r.name), email: str(r.email), added_at: num(r.added_at), via: str(r.via) ?? '' };
}

export function parseOrgGroup(raw: unknown): OrgGroupView | null {
  const r = obj(raw);
  const id = r && str(r.id);
  if (!r || !id) return null;
  return { id, name: str(r.name) ?? id, members: strs(r.members), agents: strs(r.agents) };
}

export function parseOrgAgent(raw: unknown): OrgAgentView | null {
  const r = obj(raw);
  const id = r && str(r.id);
  const a2a = r && str(r.a2a_url);
  if (!r || !id || !a2a) return null;
  return {
    id, name: str(r.name) ?? id, description: str(r.description) ?? '', owner: str(r.owner) ?? '', org: str(r.org),
    visibility: r.visibility === 'private' ? 'private' : 'public', group: str(r.group), a2a_url: a2a, card_url: str(r.card_url) ?? `${a2a}/.well-known/agent-card.json`,
    calls: num(r.calls) ?? 0, last_call_at: num(r.last_call_at), created_at: num(r.created_at), updated_at: num(r.updated_at),
  };
}

export function parseOrgProfile(raw: unknown): OrgProfile | null {
  const r = obj((raw as { org?: unknown } | null | undefined)?.org ?? raw);
  const base = parseOrgSummary(r);
  if (!r || !base) return null;
  return {
    ...base,
    readme: str(r.readme) ?? '', domain_role: isOrgRole(r.domain_role) ? r.domain_role : 'write', sso_org_ids: strs(r.sso_org_ids),
    spend_cap_credits: num(r.spend_cap_credits), created_by: str(r.created_by),
    members: (Array.isArray(r.members) ? r.members : []).map(parseOrgMember).filter((m): m is OrgMemberView => m !== null),
    groups: (Array.isArray(r.groups) ? r.groups : []).map(parseOrgGroup).filter((g): g is OrgGroupView => g !== null),
    pending_requests: num(r.pending_requests) ?? 0, open_invites: num(r.open_invites) ?? 0,
    agents: (Array.isArray(r.agents) ? r.agents : []).map(parseOrgAgent).filter((a): a is OrgAgentView => a !== null),
    hidden_agents: num(r.hidden_agents) ?? 0,
  };
}

export interface OrgListView { orgs: OrgSummary[]; signed_in: boolean; email_domain: string | null; domain_org: string | null }

export function parseOrgList(raw: unknown): OrgListView {
  const r = obj(raw);
  return {
    orgs: (Array.isArray(r?.orgs) ? r!.orgs : []).map(parseOrgSummary).filter((o): o is OrgSummary => o !== null),
    signed_in: r?.signed_in === true, email_domain: str(r?.email_domain), domain_org: str(r?.domain_org),
  };
}

export interface OrgInviteView { token: string | null; token_prefix: string; role: OrgRole; email: string | null; created_by: string; created_at: number | null; expires_at: number | null; used_by: string | null; url: string | null }
export function parseOrgInvite(raw: unknown): OrgInviteView | null {
  const r = obj((raw as { invite?: unknown } | null | undefined)?.invite ?? raw);
  if (!r || !str(r.token_prefix)) return null;
  return {
    token: str(r.token), token_prefix: str(r.token_prefix) as string, role: isOrgRole(r.role) ? r.role : 'read', email: str(r.email), created_by: str(r.created_by) ?? '',
    created_at: num(r.created_at), expires_at: num(r.expires_at), used_by: str(r.used_by), url: str(r.url),
  };
}
export const parseOrgInvites = (raw: unknown): OrgInviteView[] => (Array.isArray(obj(raw)?.invites) ? (obj(raw)!.invites as unknown[]) : []).map(parseOrgInvite).filter((i): i is OrgInviteView => i !== null);

export interface OrgJoinRequestView { principal: string; email: string | null; name: string | null; message: string; requested_at: number | null }
export const parseOrgRequests = (raw: unknown): OrgJoinRequestView[] => (Array.isArray(obj(raw)?.requests) ? (obj(raw)!.requests as unknown[]) : [])
  .map((x) => { const r = obj(x); const p = r && str(r.principal); return r && p ? { principal: p, email: str(r.email), name: str(r.name), message: str(r.message) ?? '', requested_at: num(r.requested_at) } : null; })
  .filter((x): x is OrgJoinRequestView => x !== null);

export interface OrgAuditEntry { seq: number; ts: number; actor: string; action: string; target: string | null; detail: Record<string, unknown> | null }
export const parseOrgAudit = (raw: unknown): OrgAuditEntry[] => (Array.isArray(obj(raw)?.audit) ? (obj(raw)!.audit as unknown[]) : [])
  .map((x) => { const r = obj(x); return r && num(r.seq) !== null ? { seq: num(r.seq) as number, ts: num(r.ts) ?? 0, actor: str(r.actor) ?? '', action: str(r.action) ?? '', target: str(r.target), detail: obj(r.detail) } : null; })
  .filter((x): x is OrgAuditEntry => x !== null);

export interface OrgBillingView {
  spend_cap_credits: number | null; sso_org_ids: string[]; keys_available: boolean; spend_metered: boolean; agent_calls_total: number;
  keys: { prefix: string; owner: string; label: string | null; issuedAt: number | null; org_id: string | null; disabled: boolean }[];
  agents: { id: string; name: string; visibility: 'public' | 'private'; total: number; last_at: number | null }[];
}
export function parseOrgBilling(raw: unknown): OrgBillingView | null {
  const r = obj(raw);
  if (!r) return null;
  return {
    spend_cap_credits: num(r.spend_cap_credits), sso_org_ids: strs(r.sso_org_ids), keys_available: r.keys_available === true, spend_metered: r.spend_metered === true,
    agent_calls_total: num(r.agent_calls_total) ?? 0,
    keys: (Array.isArray(r.keys) ? r.keys : []).map((k) => { const o = obj(k); return o && str(o.prefix) ? { prefix: str(o.prefix) as string, owner: str(o.owner) ?? '', label: str(o.label), issuedAt: num(o.issuedAt), org_id: str(o.org_id), disabled: o.disabled === true } : null; }).filter((k): k is OrgBillingView['keys'][number] => k !== null),
    agents: (Array.isArray(r.agents) ? r.agents : []).map((a) => { const o = obj(a); return o && str(o.id) ? { id: str(o.id) as string, name: str(o.name) ?? (str(o.id) as string), visibility: o.visibility === 'private' ? 'private' as const : 'public' as const, total: num(o.total) ?? 0, last_at: num(o.last_at) } : null; }).filter((a): a is OrgBillingView['agents'][number] => a !== null),
  };
}

export interface OrgSecurityView {
  sso: { configured: boolean; issuer: string | null; org_ids: string[] }; domains: string[]; domain_role: OrgRole;
  members_by_via: Record<string, number>; admins: string[]; private_agents: number; audit: OrgAuditEntry[];
}
export function parseOrgSecurity(raw: unknown): OrgSecurityView | null {
  const r = obj(raw);
  if (!r) return null;
  const sso = obj(r.sso);
  const via = obj(r.members_by_via) ?? {};
  return {
    sso: { configured: sso?.configured === true, issuer: str(sso?.issuer), org_ids: strs(sso?.org_ids) }, domains: strs(r.domains), domain_role: isOrgRole(r.domain_role) ? r.domain_role : 'write',
    members_by_via: Object.fromEntries(Object.entries(via).map(([k, v]) => [k, num(v) ?? 0])), admins: strs(r.admins), private_agents: num(r.private_agents) ?? 0, audit: parseOrgAudit(r),
  };
}

// ------------------------------------------------------------------------------------------------ errors

export type OrgApiErrorCode =
  | 'not_signed_in' | 'not_found' | 'not_member' | 'insufficient_role' | 'invalid_request' | 'id_taken' | 'domain_taken' | 'domain_not_yours'
  | 'has_agents' | 'already_member' | 'last_admin' | 'limit_reached' | 'invite_for_someone_else' | 'org_not_found' | 'org_role' | 'unreachable' | 'unknown';
const KNOWN: readonly OrgApiErrorCode[] = ['not_signed_in', 'not_found', 'not_member', 'insufficient_role', 'invalid_request', 'id_taken', 'domain_taken', 'domain_not_yours', 'has_agents', 'already_member', 'last_admin', 'limit_reached', 'invite_for_someone_else', 'org_not_found', 'org_role'];

export interface OrgApiError { status: number | null; code: OrgApiErrorCode; message: string | null; /** 403 `not_member` carries the organization's name and whether asking to join is open */ org: { id: string; name: string; description: string } | null; can_request: boolean; requested: boolean }

function fromStatus(status: number | null): OrgApiErrorCode {
  if (status === 401) return 'not_signed_in';
  if (status === 403) return 'insufficient_role';
  if (status === 404) return 'not_found';
  if (status === 409) return 'id_taken';
  if (status === 429) return 'limit_reached';
  if (status === 400) return 'invalid_request';
  return status === null ? 'unreachable' : 'unknown';
}

export function orgApiErrorOf(err: unknown): OrgApiError {
  const e = (err ?? {}) as { status?: unknown; originalStatus?: unknown; data?: unknown; error?: unknown };
  const status = typeof e.status === 'number' ? e.status : typeof e.originalStatus === 'number' ? e.originalStatus : null;
  const body = obj(e.data);
  const inner = body?.error as { code?: unknown; message?: unknown } | string | undefined;
  const orgRaw = obj(body?.org);
  const org = orgRaw && str(orgRaw.id) ? { id: str(orgRaw.id) as string, name: str(orgRaw.name) ?? (str(orgRaw.id) as string), description: str(orgRaw.description) ?? '' } : null;
  const extra = { org, can_request: body?.can_request === true, requested: body?.requested === true };
  if (inner && typeof inner === 'object') {
    const code = str(inner.code);
    return { status, code: code && (KNOWN as readonly string[]).includes(code) ? (code as OrgApiErrorCode) : fromStatus(status), message: str(inner.message), ...extra };
  }
  if (typeof inner === 'string') return { status, code: fromStatus(status), message: inner, ...extra };
  if (status === null && typeof e.error === 'string') return { status, code: 'unreachable', message: e.error, ...extra };
  return { status, code: fromStatus(status), message: null, ...extra };
}

/** Which member row is the viewer, by any of their principals. */
export function myMembership(profile: Pick<OrgProfile, 'members'>, principals: readonly string[]): OrgMemberView | null {
  return profile.members.find((m) => principals.includes(m.principal)) ?? null;
}
