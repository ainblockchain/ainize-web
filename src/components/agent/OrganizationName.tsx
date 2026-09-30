import { Link } from 'react-router';
import { useMyOrgsQuery } from '@/api/api';
import { parseOrgList } from '@/api/organizations';
import { organizationDisplay } from '@/api/sharedAgents';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';

/** Resolve both stored organization slugs and SSO aliases to the same readable page. */
export function OrganizationName({ orgId }: { orgId: string }) {
  const { isSignedIn, sso } = useAuth();
  const { data } = useMyOrgsQuery(undefined, { skip: !isSignedIn });
  const { t } = useT();
  const org = organizationDisplay(orgId, data ? parseOrgList(data)?.orgs ?? [] : [], sso?.orgs);
  if (!org) return <span>{t('sharing.visibility.org')}</span>;
  return org.href ? <Link to={org.href}>{org.name}</Link> : <span>{org.name}</span>;
}
