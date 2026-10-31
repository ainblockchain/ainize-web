import { emailDomain, isOrgRole, parseOrgProfile, type OrgCreateInput } from '../api/organizations';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Only a successful current-account response can establish whether a domain is available. */
export function orgCreationAccess(raw: unknown): { domain: string | null; heldBy: string | null } | null {
  const r = record(raw);
  if (!r || r.signed_in !== true || !Array.isArray(r.orgs)) return null;
  const domain = r.email_domain;
  const heldBy = r.domain_org;
  if (domain !== null && (typeof domain !== 'string' || emailDomain(`viewer@${domain}`) !== domain)) return null;
  if (heldBy !== null && (typeof heldBy !== 'string' || !heldBy.trim())) return null;
  if (domain === null && heldBy !== null) return null;
  return { domain, heldBy };
}

export function orgInviteTarget(raw: unknown): { id: string; name: string; role: import('../api/organizations').OrgRole; email: string | null } | null {
  const r = record(raw);
  const org = record(r?.org);
  if (!r || !org || typeof org.id !== 'string' || !org.id.trim() || !isOrgRole(r.role)) return null;
  if (r.email != null && typeof r.email !== 'string') return null;
  return { id: org.id, name: typeof org.name === 'string' ? org.name : org.id, role: r.role, email: typeof r.email === 'string' ? r.email : null };
}

export class OrgEntryError extends Error {
  constructor(readonly code: 'read_failed' | 'domain_changed' | 'unconfirmed') { super(code); }
}

function confirmedOrg(raw: unknown, id: string, creator: boolean) {
  const r = record(record(raw)?.org);
  const org = parseOrgProfile(raw);
  if (!r || !org || org.id !== id || !isOrgRole(r.my_role) || (creator && r.my_role !== 'admin')) throw new OrgEntryError('unconfirmed');
  return org;
}

/** Keep the exact submitted domain choice; a refreshed policy must never silently remove it. */
export async function createSelectedOrg(body: OrgCreateInput, deps: {
  readAccess: () => Promise<unknown>; create: (body: OrgCreateInput) => Promise<unknown>; isCurrent: () => boolean;
}) {
  if (!deps.isCurrent()) return null;
  const raw = await deps.readAccess();
  if (!deps.isCurrent()) return null;
  const access = orgCreationAccess(raw);
  if (!access) throw new OrgEntryError('read_failed');
  if (body.domains.length && (body.domains.length !== 1 || access.heldBy || body.domains[0] !== access.domain)) throw new OrgEntryError('domain_changed');
  const answer = await deps.create(body);
  if (!deps.isCurrent()) return null;
  return confirmedOrg(answer, body.id, true);
}

/** The invite's displayed organization is the only valid completion destination. */
export async function joinSelectedOrg(token: string, id: string, deps: {
  accept: (token: string) => Promise<unknown>; isCurrent: () => boolean;
}) {
  if (!deps.isCurrent()) return null;
  const answer = await deps.accept(token);
  if (!deps.isCurrent()) return null;
  return confirmedOrg(answer, id, false);
}
