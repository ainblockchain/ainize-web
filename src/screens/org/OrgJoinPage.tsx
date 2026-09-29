/**
 * `/org/join/:token` — where an invite link lands. Says which organization and which role before asking anything;
 * a sign-in is needed to accept (and comes back here), and an invite pinned to an email tells the person so.
 */
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAcceptOrgInviteMutation, usePeekOrgInviteQuery } from '@/api/api';
import { isOrgRole, orgApiErrorOf, parseOrgProfile } from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

export default function OrgJoinPage() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useT();
  useTitle(t('orgJoin.title'));
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, isLoading, error } = usePeekOrgInviteQuery(token);
  const [accept, state] = useAcceptOrgInviteMutation();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const peek = useMemo(() => {
    const r = (data ?? null) as { org?: { id?: unknown; name?: unknown; description?: unknown }; role?: unknown; email?: unknown } | null;
    const id = typeof r?.org?.id === 'string' ? r.org.id : null;
    if (!id) return null;
    return { id, name: typeof r?.org?.name === 'string' ? r.org.name : id, role: isOrgRole(r?.role) ? r.role : 'read', email: typeof r?.email === 'string' ? r.email : null };
  }, [data]);

  const join = async () => {
    setAcceptError(null);
    try {
      const org = parseOrgProfile(await accept(token).unwrap());
      navigate(`/org/${encodeURIComponent(org?.id ?? peek?.id ?? '')}`, { state: { orgJoined: t('orgJoin.done', { name: org?.name ?? peek?.name ?? '' }) } });
    } catch (e) {
      setAcceptError(t(`org.api.${orgApiErrorOf(e).code}`));
    }
  };

  if (isLoading || auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;

  return (
    <PageWrapper>
      <TitleRow><Title>{t('orgJoin.title')}</Title></TitleRow>
      {(error || !peek) && <Empty data-testid="org-join-invalid">{t('orgJoin.invalid')} <StyledLink to="/org">{t('orgs.title')}</StyledLink></Empty>}
      {peek && (
        <Empty data-testid="org-join">
          <Description style={{ margin: '0 auto 8px' }}>{t('orgJoin.lede', { name: peek.name, role: t(`org.role.${peek.role}`) })}</Description>
          {peek.email && <Description style={{ margin: '0 auto 16px' }}>{t('orgJoin.for_email', { email: peek.email })}</Description>}
          {auth.isSignedIn ? (
            <Button variant="contained" loading={state.isLoading} onClick={() => void join()} data-testid="org-join-accept">{t('orgJoin.accept')}</Button>
          ) : (
            <>
              <Description style={{ margin: '0 auto 12px' }}>{t('orgJoin.signin')}</Description>
              <StyledLink to={`/signing?next=${encodeURIComponent(location.pathname)}`}>{t('orgs.signin.cta')}</StyledLink>
            </>
          )}
          {acceptError && <Alert $tone="error" style={{ marginTop: 12 }}>{acceptError}</Alert>}
        </Empty>
      )}
    </PageWrapper>
  );
}
