/**
 * `/org` — the organizations the signed-in person is in, and the door to make one.
 *
 * Membership is the node's to decide (explicit row, the sign-in's email domain, an AIN SSO organization), so this
 * page only lists what `GET /api/orgs` says. The one thing it adds is the hint the node gives with the list: the
 * viewer's email domain and whether an organization already holds it — "no organization holds @comcom.ai yet, you
 * can create it" is the moment a company's page comes into being.
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router';
import styled from 'styled-components';
import { useMyOrgsQuery } from '@/api/api';
import { orgApiErrorOf, parseOrgList } from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const OrgList = styled.ul`list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px;`;
const OrgItem = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; padding: 16px 18px; background: #fff;
  display: flex; flex-direction: column; gap: 6px;
`;
const OrgHead = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 15px; font-weight: 700;`;
const OrgMeta = styled.div`display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: ${(p) => p.theme.color.GREY};`;
const OrgChip = styled.span`font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #f1f2f5; color: #555; font-weight: 500;`;
const OrgActions = styled.div`display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;`;

export default function OrgsPage() {
  const { t } = useT();
  useTitle(t('orgs.title'));
  const auth = useAuth();
  const location = useLocation();
  const { data, isLoading, error } = useMyOrgsQuery(undefined, { skip: !auth.isSignedIn });
  const list = useMemo(() => parseOrgList(data), [data]);
  const err = error ? orgApiErrorOf(error) : null;

  if (auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;

  return (
    <PageWrapper>
      <TitleRow><Title>{t('orgs.title')}</Title></TitleRow>
      <Description>{t('orgs.lede')}</Description>

      {!auth.isSignedIn && (
        <Empty data-testid="orgs-signin">
          <Description style={{ margin: '0 auto 16px' }}>{t('orgs.signin')}</Description>
          <StyledLink to={`/signing?next=${encodeURIComponent(location.pathname)}`}>{t('orgs.signin.cta')}</StyledLink>
        </Empty>
      )}

      {auth.isSignedIn && isLoading && <CenterProgress />}
      {err && err.status === 404 && <Alert $tone="warning" data-testid="orgs-unsupported">{t('orgs.unsupported')}</Alert>}
      {err && err.status !== 404 && <Alert $tone="error">{t(`org.api.${err.code}`)}</Alert>}

      {auth.isSignedIn && !isLoading && !err && (
        <>
          {list.orgs.length === 0 && <Empty data-testid="orgs-empty">{t('orgs.empty')}</Empty>}
          <OrgList data-testid="orgs-list">
            {list.orgs.map((o) => (
              <OrgItem key={o.id} data-testid={`org-${o.id}`}>
                <OrgHead>
                  <StyledLink to={`/org/${encodeURIComponent(o.id)}`}>{o.name}</StyledLink>
                  {o.my_role && <OrgChip>{t(`org.role.${o.my_role}`)}</OrgChip>}
                  {o.via && o.via !== 'member' && <OrgChip>{t(`org.via.${o.via}`)}</OrgChip>}
                </OrgHead>
                {o.description && <Description style={{ margin: 0 }}>{o.description}</Description>}
                <OrgMeta>
                  <span>{t('orgs.members', { n: o.member_count })}</span>
                  <span>{t('orgs.agents', { n: o.agent_count })}</span>
                  {o.domains.map((d) => <span key={d}>@{d}</span>)}
                </OrgMeta>
              </OrgItem>
            ))}
          </OrgList>

          {list.email_domain && !list.domain_org && (
            <Alert $tone="info" style={{ marginTop: 16 }} data-testid="orgs-domain-hint">{t('orgs.create_for_domain', { domain: list.email_domain })}</Alert>
          )}
          <OrgActions>
            <StyledLink to="/org/new" data-testid="orgs-create">{t('orgs.create')} →</StyledLink>
          </OrgActions>
        </>
      )}
    </PageWrapper>
  );
}
