/**
 * The organizations the signed-in person may share an agent with, for the sharing control on every agent form:
 * ainize organizations where they are a `contributor` or more (`GET /api/orgs`), then the AIN SSO organizations the
 * session names (`shareableOrgOptions`). A node from before organizations answers `/api/orgs` with 404, and the
 * list is then the AIN organizations alone — what the forms offered before.
 */
import { useMemo } from 'react';
import { useMyOrgsQuery } from '@/api/api';
import { parseOrgList } from '@/api/organizations';
import { shareableOrgOptions, type OrgOption } from '@/api/sharedAgents';
import { useAuth } from '@/auth/AuthContext';

export function useShareableOrgs(): { orgs: OrgOption[] | null; activeOrg: string | null } {
  const { isSignedIn, sso } = useAuth();
  const { data } = useMyOrgsQuery(undefined, { skip: !isSignedIn });
  return useMemo(() => {
    const list = data ? parseOrgList(data) : null;
    const ainize = list?.signed_in ? list.orgs.map((o) => ({ id: o.id, name: o.name, role: o.my_role, ssoOrgIds: o.sso_org_ids })) : null;
    return { orgs: shareableOrgOptions(sso?.orgs, ainize && ainize.length ? ainize : null), activeOrg: sso?.activeOrg ?? null };
  }, [data, sso?.orgs, sso?.activeOrg]);
}
