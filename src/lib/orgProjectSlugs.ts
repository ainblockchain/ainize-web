/** Project repositories are named by the local org slug or a linked SSO organization's slug. */
export function orgProjectSlugs(org: { id: string; sso_org_ids: string[] }, memberships: readonly { id: string; slug: string }[]): string[] {
  return [...new Set([org.id, ...memberships.filter(member => org.sso_org_ids.includes(member.id)).map(member => member.slug)])];
}
