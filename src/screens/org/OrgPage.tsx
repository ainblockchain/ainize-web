/**
 * `/org/:id` — an organization's page: the README card at the top, then its agents, then its members. Members only;
 * a non-member gets the name and a way to ask to join.
 *
 * The agents are the ones shared with the organization (ainize-node: `visibility: 'org'` with the organization's id
 * or one of its linked AIN SSO organization ids). Every member sees all of them; resource groups only label. Sharing
 * an agent with the organization goes through the ordinary link form with `?org=`.
 */
import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import styled from 'styled-components';
import { useOrgQuery, useRequestJoinOrgMutation } from '@/api/api';
import { orgApiErrorOf, parseOrgProfile, roleAtLeast } from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Blocks, Prose } from '@/components/docs/Markdown';
import { parseDoc } from '@/components/docs/markdown-parser';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, ExternalLink, Mono, PageWrapper, StyledLink, Tabs, Title, TitleRow } from '@/components/ui/Misc';
import { viewerPrincipals } from '@/api/linkedAgents';
import { useLocale, useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const OrgHeader = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px;`;
const OrgChip = styled.span<{ $tone?: 'lock' | 'muted' }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px;
  background: ${(p) => (p.$tone === 'lock' ? '#fff4e0' : '#f1f2f5')}; color: ${(p) => (p.$tone === 'lock' ? '#8a5a00' : '#555')};
`;
const OrgMeta = styled.div`display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; color: ${(p) => p.theme.color.GREY}; margin-bottom: 16px;`;
const ReadmeCard = styled.section`
  background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; padding: 20px 24px; margin: 8px 0 24px;
`;
const List = styled.ul`list-style: none; margin: 16px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px;`;
const Item = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; padding: 16px 18px; background: #fff;
  display: flex; flex-direction: column; gap: 8px;
`;
const Head = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const Name = styled.span`font-weight: 700; font-size: 15px;`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px;`;
const Actions = styled.div`display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0 4px;`;

export default function OrgPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useT();
  const { locale } = useLocale();
  const location = useLocation();
  const auth = useAuth();
  const { data, isLoading, error } = useOrgQuery(id, { skip: !auth.isSignedIn, pollingInterval: 60_000 });
  const org = useMemo(() => parseOrgProfile(data), [data]);
  const err = error ? orgApiErrorOf(error) : null;
  useTitle(org?.name ?? err?.org?.name ?? t('orgs.title'));
  const [tab, setTab] = useState<'agents' | 'members' | 'readme'>('agents');
  const [message, setMessage] = useState('');
  const [requestJoin, requestState] = useRequestJoinOrgMutation();
  const [requestError, setRequestError] = useState<string | null>(null);
  const readme = useMemo(() => (org?.readme ? parseDoc(org.readme).blocks : []), [org?.readme]);

  if (auth.loading || (auth.isSignedIn && isLoading)) return <PageWrapper><CenterProgress /></PageWrapper>;

  if (!auth.isSignedIn) {
    return (
      <PageWrapper>
        <TitleRow><Title>{t('orgs.title')}</Title></TitleRow>
        <Empty data-testid="org-signin">
          <Description style={{ margin: '0 auto 16px' }}>{t('orgs.signin')}</Description>
          <StyledLink to={`/signing?next=${encodeURIComponent(location.pathname)}`}>{t('orgs.signin.cta')}</StyledLink>
        </Empty>
      </PageWrapper>
    );
  }

  if (err?.code === 'not_member') {
    const ask = async () => {
      setRequestError(null);
      try { await requestJoin({ id, message }).unwrap(); } catch (e) { setRequestError(t(`org.api.${orgApiErrorOf(e).code}`)); }
    };
    const requested = err.requested || requestState.isSuccess;
    return (
      <PageWrapper>
        <TitleRow><Title>{err.org?.name ?? id}</Title></TitleRow>
        {err.org?.description && <Description>{err.org.description}</Description>}
        <Empty data-testid="org-not-member">
          <h3 style={{ margin: '0 0 8px' }}>{t('org.not_member.title')}</h3>
          <Description style={{ margin: '0 auto 16px' }}>{t('org.not_member.body', { name: err.org?.name ?? id })}</Description>
          {requested ? (
            <Description data-testid="org-requested">{t('org.not_member.requested')}</Description>
          ) : (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Input value={message} maxLength={500} placeholder={t('org.not_member.message')} onChange={(e) => setMessage(e.target.value)} style={{ maxWidth: 320 }} data-testid="org-request-message" />
              <Button variant="contained" loading={requestState.isLoading} onClick={() => void ask()} data-testid="org-request-join">{t('org.not_member.request')}</Button>
            </div>
          )}
          {requestError && <Alert $tone="error" style={{ marginTop: 12 }}>{requestError}</Alert>}
        </Empty>
      </PageWrapper>
    );
  }

  if (err || !org) {
    return (
      <PageWrapper>
        <TitleRow><Title>{t('orgs.title')}</Title></TitleRow>
        <Empty data-testid="org-unavailable">{err ? (err.status === 404 ? t('org.not_found') : t(`org.api.${err.code}`)) : t('org.not_found')} <StyledLink to="/org">{t('orgs.title')}</StyledLink></Empty>
      </PageWrapper>
    );
  }

  const admin = roleAtLeast(org.my_role, 'admin');
  const contributor = roleAtLeast(org.my_role, 'contributor');
  const write = roleAtLeast(org.my_role, 'write');
  const principals = viewerPrincipals(auth.subject, auth.sso?.principal, auth.sitePrincipal);

  return (
    <PageWrapper>
      <OrgHeader>
        <Title style={{ margin: 0 }}>{org.name}</Title>
        {org.my_role && <OrgChip data-testid="org-my-role">{t('org.my_role', { role: t(`org.role.${org.my_role}`) })}</OrgChip>}
        {admin && org.pending_requests > 0 && <StyledLink to={`/org/${encodeURIComponent(org.id)}/settings?tab=members`} data-testid="org-pending">{t('org.pending_badge', { n: org.pending_requests })}</StyledLink>}
        {(admin || write) && <StyledLink to={`/org/${encodeURIComponent(org.id)}/settings`} data-testid="org-settings-link" style={{ marginLeft: 'auto' }}>{t('org.settings')} →</StyledLink>}
      </OrgHeader>
      {org.description && <Description style={{ marginTop: 4 }}>{org.description}</Description>}
      <OrgMeta>
        <span>{t('org.members.count', { n: org.member_count })}</span>
        <span>{t('orgs.agents', { n: org.agent_count })}</span>
        {org.domains.map((d) => <span key={d}>@{d}</span>)}
      </OrgMeta>

      {readme.length > 0 && (
        <ReadmeCard data-testid="org-readme">
          <Prose><Blocks blocks={readme} ctx={{ lang: locale === 'ko' ? 'ko' : 'en', slug: `org/${org.id}` }} /></Prose>
        </ReadmeCard>
      )}

      <Tabs value={tab} onChange={(v) => setTab(v as typeof tab)} tabs={[
        { id: 'agents', label: `${t('org.tab.agents')} · ${org.agent_count}` },
        { id: 'members', label: `${t('org.tab.members')} · ${org.member_count}` },
        { id: 'readme', label: t('org.tab.readme') },
      ]} />

      {tab === 'agents' && (
        <>
          <Actions>
            {contributor && <StyledLink to={`/agent/new?org=${encodeURIComponent(org.id)}`} data-testid="org-create-agent">{t('org.create_agent')} →</StyledLink>}
            {contributor && <StyledLink to={`/agent/link?org=${encodeURIComponent(org.id)}`} data-testid="org-register-agent">{t('org.register_agent')} →</StyledLink>}
          </Actions>
          {org.agents.length === 0 && <Empty data-testid="org-agents-empty">{t('org.agents.empty')}</Empty>}
          <List data-testid="org-agents">
            {org.agents.map((a) => {
              const groups = org.groups.filter((g) => a.groups.includes(g.id));
              const mine = principals.includes(a.owner);
              // The node's rules: a hosted agent is edited by its owner or a write member; a linked agent's upstream by its owner alone.
              const editTo = a.kind === 'linked' ? (mine ? `/agent/${encodeURIComponent(a.id)}/link` : null) : (mine || write ? `/agent/${encodeURIComponent(a.id)}/edit` : null);
              return (
                <Item key={a.id} data-testid={`org-agent-${a.id}`}>
                  <Head>
                    <Name>{a.name}</Name>
                    {groups.map((g) => <OrgChip key={g.id}>{t('org.agents.group', { name: g.name })}</OrgChip>)}
                    <OrgChip>{t('org.agents.calls', { n: a.calls })}</OrgChip>
                  </Head>
                  {a.description && <Description style={{ margin: 0 }}>{a.description}</Description>}
                  <Row><Mono>{a.a2a_url}</Mono><CopyButton text={a.a2a_url} label={t('myAgents.copy')} /></Row>
                  <Row>
                    <StyledLink to={`/agent/${encodeURIComponent(a.id)}`}>{t('org.agents.open')}</StyledLink>
                    {editTo && <StyledLink to={editTo}>{t('org.agents.edit')}</StyledLink>}
                    <ExternalLink href={a.card_url} target="_blank" rel="noreferrer">agent-card.json</ExternalLink>
                  </Row>
                </Item>
              );
            })}
          </List>
          {org.hidden_agents > 0 && <Description style={{ marginTop: 12 }} data-testid="org-agents-hidden">{t('org.agents.hidden', { n: org.hidden_agents })}</Description>}
        </>
      )}

      {tab === 'members' && (
        <>
          {org.domains.length > 0 && <Description style={{ marginTop: 16 }}>{t('org.members.domain_note', { domains: org.domains.join(', @'), role: t(`org.role.${org.domain_role}`) })}</Description>}
          <List data-testid="org-members">
            {org.members.map((m) => (
              <Item key={m.principal} data-testid={`org-member-${m.principal}`}>
                <Head>
                  <Name>{m.name ?? m.email ?? m.principal}</Name>
                  <OrgChip>{t(`org.role.${m.role}`)}</OrgChip>
                  {m.via && <OrgChip>{t(`org.via.${m.via}`)}</OrgChip>}
                </Head>
                <Row><Mono>{m.principal}</Mono>{m.email && <span>{m.email}</span>}</Row>
              </Item>
            ))}
          </List>
        </>
      )}

      {tab === 'readme' && (
        readme.length > 0
          ? <ReadmeCard><Prose><Blocks blocks={readme} ctx={{ lang: locale === 'ko' ? 'ko' : 'en', slug: `org/${org.id}` }} /></Prose></ReadmeCard>
          : <Empty>{t('org.readme.empty')}</Empty>
      )}
    </PageWrapper>
  );
}
