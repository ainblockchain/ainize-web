/**
 * `/org/join/:token` — where an invite link lands. Says which organization and which role before asking anything;
 * a sign-in is needed to accept (and comes back here), and an invite pinned to an email tells the person so.
 */
import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { useAcceptOrgInviteMutation, usePeekOrgInviteQuery } from '@/api/api';
import { orgApiErrorOf } from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { useActiveView } from '@/hooks/useActiveView';
import { OrgReadStatus } from './OrgReadStatus';
import { joinSelectedOrg, orgInviteTarget, OrgEntryError } from '@/lib/orgEntry';

export default function OrgJoinPage() {
  const { token = '' } = useParams<{ token: string }>();
  const auth = useAuth();
  return <OrgJoinContent key={`${auth.cacheIdentity}:${token}`} />;
}

function OrgJoinContent() {
  const { token = '' } = useParams<{ token: string }>();
  const { t } = useT();
  useTitle(t('orgJoin.title'));
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const flight = useRef(false);
  const query = usePeekOrgInviteQuery(token, { refetchOnMountOrArgChange: true });
  const { currentData: data, isFetching, error } = query;
  const [accept, state] = useAcceptOrgInviteMutation();
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const peek = useMemo(() => orgInviteTarget(data), [data]);

  const join = async () => {
    if (flight.current || !isCurrent() || !auth.isSignedIn || !peek || error || isFetching) return;
    flight.current = true;
    setAcceptError(null);
    try {
      const org = await joinSelectedOrg(token, peek.id, { accept: (value) => accept(value).unwrap(), isCurrent });
      if (!org) return;
      navigate(`/org/${encodeURIComponent(org.id)}`, { state: { orgJoined: t('orgJoin.done', { name: org.name }) } });
    } catch (e) {
      if (isCurrent()) setAcceptError(e instanceof OrgEntryError ? t(`org.entry.${e.code}`) : t(`org.api.${orgApiErrorOf(e).code}`));
    } finally {
      flight.current = false;
    }
  };

  if ((!data && isFetching) || auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;
  const invalid = !!error && [404, 410].includes(orgApiErrorOf(error).status ?? 0);

  return (
    <PageWrapper>
      <TitleRow><Title>{t('orgJoin.title')}</Title></TitleRow>
      {invalid && <Empty data-testid="org-join-invalid">{t('orgJoin.invalid')} <StyledLink to="/org">{t('orgs.title')}</StyledLink></Empty>}
      {!invalid && (error || !peek) && <OrgReadStatus query={query} valid={!!peek} />}
      {peek && !error && (
        <Empty data-testid="org-join">
          <Description style={{ margin: '0 auto 8px' }}>{t('orgJoin.lede', { name: peek.name, role: t(`org.role.${peek.role}`) })}</Description>
          {peek.email && <Description style={{ margin: '0 auto 16px' }}>{t('orgJoin.for_email', { email: peek.email })}</Description>}
          {auth.isSignedIn ? (
            <Button variant="contained" loading={state.isLoading} disabled={isFetching} onClick={() => void join()} data-testid="org-join-accept">{t('orgJoin.accept')}</Button>
          ) : (
            <>
              <Description style={{ margin: '0 auto 12px' }}>{t('orgJoin.signin')}</Description>
              <StyledLink to={`/signing?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`}>{t('orgs.signin.cta')}</StyledLink>
            </>
          )}
          {acceptError && <Alert role="alert" $tone="error" style={{ marginTop: 12 }}>{acceptError} <StyledLink to="/org">{t('orgs.title')}</StyledLink></Alert>}
        </Empty>
      )}
    </PageWrapper>
  );
}
