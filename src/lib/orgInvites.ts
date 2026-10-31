import { parseOrgInvite, type OrgInviteView, type OrgRole } from '../api/organizations';

export const openOrgInvite = (invite: OrgInviteView, now: number) => invite.used_by === null && invite.expires_at !== null && invite.expires_at > now;

/** Match the exact role/email/expiry and bearer link from this creation, never a previous result. */
export function createdOrgInvite(raw: unknown, expected: { role: OrgRole; email: string | null; ttlHours: number }, now: number): OrgInviteView | null {
  const invite = parseOrgInvite(raw);
  if (!invite?.id || !invite.token || !/^[A-Za-z0-9_-]+$/.test(invite.token) || invite.token_prefix !== invite.token.slice(0, 6)
    || invite.role !== expected.role || invite.email !== (expected.email?.trim().toLowerCase() || null)
    || invite.created_at === null || invite.expires_at !== invite.created_at + expected.ttlHours * 3600_000 || !openOrgInvite(invite, now) || !invite.url) return null;
  try {
    const url = new URL(invite.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== `/org/join/${invite.token}`) return null;
  } catch { return null; }
  return invite;
}

/** A one-time link is copyable only while its exact invitation remains active in the refreshed list. */
export function listedOrgInvite(fresh: OrgInviteView | null, list: OrgInviteView[], now: number): boolean {
  return !!fresh?.id && openOrgInvite(fresh, now) && list.some(row => row.id === fresh.id && row.role === fresh.role
    && row.email === fresh.email && row.created_at === fresh.created_at && row.expires_at === fresh.expires_at && openOrgInvite(row, now));
}

export function confirmedInviteRevocation(raw: unknown, id: string): boolean {
  const value = raw as { revoked?: unknown; id?: unknown } | null;
  return value?.revoked === true && value.id === id;
}
