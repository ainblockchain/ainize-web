import { AgentArchivePanel } from './agent/AgentArchivePanel';
/** Own and manageable agents, including private linked records outside the public catalogue. */
import { useMemo, useRef, useState } from 'react';
import { useActiveView } from '@/hooks/useActiveView';
import { AgentDeletionError, createHostedAgentDeletion, isAgentCleanupPending } from '@/lib/hostedAgentDeletion';
import styled from 'styled-components';
import { useAgentsQuery, useDeleteHostedAgentMutation, useDeleteLinkedAgentMutation, useManageableHostedAgentsQuery, useMyLinkedAgentsQuery, useLazyHostedAgentQuery } from '@/api/api';
import { isLinkedAgentRow, linkedAgentApiErrorOf, viewerPrincipals } from '@/api/linkedAgents';
import { myAgentRows, parseMyLinkedAgents } from '@/api/myAgents';
import { signInHref } from '@/lib/uiNavigation';
import { useLocation } from 'react-router';
import { agentListKey, parseManageableHostedAgents, visibilityBadgeOf } from '@/api/sharedAgents';
import { agentPagePath } from '@/api/agentIds';
import type { AgentSummary } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, ExternalLink, Mono, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const MyAgentsActions = styled.div`display: flex; gap: 12px; flex-wrap: wrap; margin: 4px 0 20px;`;
const MyAgentsList = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;`;
const MyAgentsItem = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; padding: 16px 18px; background: #fff;
  display: flex; flex-direction: column; gap: 8px; min-width: 0; overflow-wrap: anywhere;
`;
const MyAgentsHead = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const MyAgentsName = styled.span`font-weight: 700; font-size: 15px;`;
const MyAgentsChip = styled.span<{ $tone?: 'ok' | 'warn' | 'muted' }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px;
  background: ${(p) => (p.$tone === 'ok' ? '#e8f6ec' : p.$tone === 'warn' ? '#fdeeee' : '#f1f2f5')};
  color: ${(p) => (p.$tone === 'ok' ? '#227a3c' : p.$tone === 'warn' ? '#a33030' : '#555')};
`;
const MyAgentsRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px; min-width: 0; & > * { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }`;

export default function MyAgentsPage() {
  const auth = useAuth();
  const location = useLocation();
  const { t } = useT();
  if (auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!auth.isSignedIn) return <PageWrapper><Empty><StyledLink to={signInHref(location)}>{t('nav.signin')}</StyledLink></Empty></PageWrapper>;
  return <MyAgentsContent key={auth.cacheIdentity} />;
}
function MyAgentsContent() {
  const { t } = useT();
  useTitle(t('myAgents.title'));
  const { subject, sso, sitePrincipal, cacheIdentity } = useAuth();
  const principals = useMemo(() => viewerPrincipals(subject, sso?.principal, sitePrincipal), [subject, sso?.principal, sitePrincipal]);
  const catalogue = useAgentsQuery(undefined, { pollingInterval: 30_000 });
  const manageable = useManageableHostedAgentsQuery(cacheIdentity, { pollingInterval: 30_000 });
  const linked = useMyLinkedAgentsQuery(cacheIdentity, { pollingInterval: 30_000 });
  const managed = useMemo(() => parseManageableHostedAgents(manageable.currentData, typeof window === 'undefined' ? '' : window.location.origin), [manageable.currentData]);
  const ownLinked = useMemo(() => parseMyLinkedAgents(linked.currentData), [linked.currentData]);
  const rows = useMemo(() => myAgentRows(catalogue.currentData?.agents ?? [], managed ?? [], ownLinked ?? [], principals), [catalogue.currentData, managed, ownLinked, principals]);
  const queries = [catalogue, manageable, linked];
  const loading = queries.some(q => !q.currentData && q.isFetching);
  const failed = queries.some(q => q.isError) || (manageable.isSuccess && !managed) || (linked.isSuccess && !ownLinked);
  const complete = queries.every(q => q.isSuccess) && !!managed && !!ownLinked;
  const reload = () => Promise.allSettled(queries.map(q => q.refetch()));
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteLinked] = useDeleteLinkedAgentMutation();
  const [deleteHosted] = useDeleteHostedAgentMutation();
  const [readHosted] = useLazyHostedAgentQuery();
  const active = useActiveView();
  const pending = useRef(false);
  const deletion = useRef(createHostedAgentDeletion()).current;
  const [error, setError] = useState<string | null>(null);

  const remove = async (agent: AgentSummary) => {
    if (pending.current || deletion.blocked() || !active() || !window.confirm(t('myAgents.delete_confirm', { name: agent.name }))) return;
    pending.current = true;
    setDeleting(agent.id); setError(null);
    try {
      if (isLinkedAgentRow(agent)) await deleteLinked(agent.id).unwrap();
      else await deletion.run({ id: agent.id, name: agent.name, owner: agent.owner }, {
        read: () => readHosted({ id: agent.id, identity: cacheIdentity }, false).unwrap(),
        send: request => deleteHosted(request).unwrap(), active,
      });
    } catch (err) {
      if (!active()) return;
      const e = linkedAgentApiErrorOf(err);
      setError(deletion.uncertain() ? t('agentOwner.delete_unknown') : isAgentCleanupPending(err) ? t('agentOwner.delete_pending')
        : err instanceof AgentDeletionError ? t('agentOwner.delete_changed') : t('myAgents.delete_failed', { why: e.message ?? t(`agentLink.api.${e.code}`) }));
    } finally { pending.current = false; if (active()) setDeleting(null); }
  };

  return (
    <PageWrapper>
      <TitleRow><Title>{t('myAgents.title')}</Title></TitleRow>
      <MyAgentsActions>
        <StyledLink to="/agent/link" data-testid="my-agents-link">{t('myAgents.link')} →</StyledLink>
        <StyledLink to="/agent/new" data-testid="my-agents-create">{t('myAgents.create')} →</StyledLink>
        <StyledLink to="/org" data-testid="my-agents-orgs">{t('org.nav')} →</StyledLink>
      </MyAgentsActions>

      {error && <Alert $tone="error" role="alert">{error}</Alert>}
      {loading && <div role="status" data-testid="my-agents-loading"><CenterProgress /></div>}
      {failed && <Alert $tone="error" role="alert" data-testid="my-agents-load-error">{t('myAgents.load_failed')} <Button size="small" disabled={queries.some(q => q.isFetching)} onClick={() => void reload()}>{t('offline.retry')}</Button></Alert>}
      {!loading && complete && !failed && rows.length === 0 && <Empty data-testid="my-agents-empty">{t('myAgents.empty')}</Empty>}

      <MyAgentsList data-testid="my-agents-list">
        {rows.map(({ agent, canEdit, canDelete, shared }) => {
          const linked = isLinkedAgentRow(agent);
          const kind = agent.kind ?? 'upstream';
          return (
            <MyAgentsItem key={agentListKey(agent)} data-testid={`my-agent-${agent.id}`}>
              <MyAgentsHead>
                <MyAgentsName>{agent.name}</MyAgentsName>
                <MyAgentsChip>{t(`myAgents.kind.${kind}`)}</MyAgentsChip>
                {shared && agent.org_id && <MyAgentsChip data-testid={`my-agent-org-${agent.id}`}>🏢 {agent.org_id}</MyAgentsChip>}
                {visibilityBadgeOf(agent) && <MyAgentsChip data-testid={`my-agent-visibility-${agent.id}`}>{t(`sharing.visibility.${visibilityBadgeOf(agent)}`)}</MyAgentsChip>}
                <MyAgentsChip $tone={agent.reachable === true ? 'ok' : agent.reachable === false ? 'warn' : 'muted'}>
                  {agent.reachable === true ? t('myAgents.reachable') : agent.reachable === false ? t('myAgents.unreachable') : t('myAgents.unknown')}
                </MyAgentsChip>
              </MyAgentsHead>
              {agent.description && <Description style={{ margin: 0 }}>{agent.description}</Description>}
              {!!agent.deletion_requested_at && <Alert $tone="error" role="status">{t('agentOwner.delete_pending')}</Alert>}
              <MyAgentsRow>
                <span>{t('myAgents.address')}:</span>
                <Mono>{agent.a2a_url}</Mono>
                <CopyButton text={agent.a2a_url} label={t('myAgents.copy')} />
              </MyAgentsRow>
              <MyAgentsRow>
                <StyledLink to={agentPagePath(agent)}>{t('myAgents.open')}</StyledLink>
                {canEdit && !agent.deletion_requested_at && <StyledLink to={linked ? `/agent/${encodeURIComponent(agent.id)}/link` : `/agent/${encodeURIComponent(agent.id)}/edit`}>{t('myAgents.edit')}</StyledLink>}
                <ExternalLink href={agent.card_url} target="_blank" rel="noreferrer">agent-card.json</ExternalLink>
                {canDelete && <Button size="small" variant="text" color="secondary" disabled={!!deleting || deletion.blocked()} loading={deleting === agent.id} onClick={() => void remove(agent)} data-testid={`my-agent-delete-${agent.id}`}>{t(agent.deletion_requested_at ? 'agentOwner.delete_resume' : 'myAgents.delete')}</Button>}
              </MyAgentsRow>
            </MyAgentsItem>
          );
        })}
      </MyAgentsList>

      <AgentArchivePanel />
    </PageWrapper>
  );
}
