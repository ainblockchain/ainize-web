/**
 * The agents that belong to the person — built on a model here, or linked by address — with the doors to make more.
 *
 * `/me/agents`, behind sign-in only: an AIN account with no wallet owns linked agents, so ownership of this page is
 * "signed in", not "has an address". The list is the public catalogue (`GET /api/agents`) filtered by `owner`
 * against every principal the viewer is (`viewerPrincipals`) — one source of truth for "what is on this node",
 * and the same rows AIN Teams reads when it offers agents to import. What is not here is not there either, and the
 * page says so.
 */
import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useAgentsQuery, useDeleteHostedAgentMutation, useDeleteLinkedAgentMutation } from '@/api/api';
import { agentsOwnedBy, isLinkedAgentRow, linkedAgentApiErrorOf, viewerPrincipals } from '@/api/linkedAgents';
import { agentListKey, visibilityBadgeOf } from '@/api/sharedAgents';
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
  display: flex; flex-direction: column; gap: 8px;
`;
const MyAgentsHead = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap;`;
const MyAgentsName = styled.span`font-weight: 700; font-size: 15px;`;
const MyAgentsChip = styled.span<{ $tone?: 'ok' | 'warn' | 'muted' }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px;
  background: ${(p) => (p.$tone === 'ok' ? '#e8f6ec' : p.$tone === 'warn' ? '#fdeeee' : '#f1f2f5')};
  color: ${(p) => (p.$tone === 'ok' ? '#227a3c' : p.$tone === 'warn' ? '#a33030' : '#555')};
`;
const MyAgentsRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px;`;

export default function MyAgentsPage() {
  const { t } = useT();
  useTitle(t('myAgents.title'));
  const { subject, sso } = useAuth();
  const principals = useMemo(() => viewerPrincipals(subject, sso?.principal), [subject, sso?.principal]);
  const { data, isLoading } = useAgentsQuery(undefined, { pollingInterval: 30_000 });
  const mine = useMemo(() => agentsOwnedBy(data?.agents ?? [], principals), [data, principals]);
  const [deleteLinked] = useDeleteLinkedAgentMutation();
  const [deleteHosted] = useDeleteHostedAgentMutation();
  const [error, setError] = useState<string | null>(null);

  const remove = async (agent: AgentSummary) => {
    if (!window.confirm(t('myAgents.delete_confirm', { name: agent.name }))) return;
    setError(null);
    try {
      if (isLinkedAgentRow(agent)) await deleteLinked(agent.id).unwrap();
      else await deleteHosted(agent.id).unwrap();
    } catch (err) {
      const e = linkedAgentApiErrorOf(err);
      setError(t('myAgents.delete_failed', { why: e.message ?? t(`agentLink.api.${e.code}`) }));
    }
  };

  return (
    <PageWrapper>
      <TitleRow><Title>{t('myAgents.title')}</Title></TitleRow>
      <Description>{t('myAgents.lede')}</Description>
      <MyAgentsActions>
        <StyledLink to="/agent/link" data-testid="my-agents-link">{t('myAgents.link')} →</StyledLink>
        <StyledLink to="/agent/new" data-testid="my-agents-create">{t('myAgents.create')} →</StyledLink>
      </MyAgentsActions>

      {error && <Alert $tone="error">{error}</Alert>}
      {isLoading && <CenterProgress />}
      {!isLoading && mine.length === 0 && <Empty data-testid="my-agents-empty">{t('myAgents.empty')}</Empty>}

      <MyAgentsList data-testid="my-agents-list">
        {mine.map((agent) => {
          const linked = isLinkedAgentRow(agent);
          const kind = agent.kind ?? 'upstream';
          return (
            <MyAgentsItem key={agentListKey(agent)} data-testid={`my-agent-${agent.id}`}>
              <MyAgentsHead>
                <MyAgentsName>{agent.name}</MyAgentsName>
                <MyAgentsChip>{t(`myAgents.kind.${kind}`)}</MyAgentsChip>
                {visibilityBadgeOf(agent) && <MyAgentsChip data-testid={`my-agent-visibility-${agent.id}`}>{t(`sharing.visibility.${visibilityBadgeOf(agent)}`)}</MyAgentsChip>}
                <MyAgentsChip $tone={agent.reachable === true ? 'ok' : agent.reachable === false ? 'warn' : 'muted'}>
                  {agent.reachable === true ? t('myAgents.reachable') : agent.reachable === false ? t('myAgents.unreachable') : t('myAgents.unknown')}
                </MyAgentsChip>
              </MyAgentsHead>
              {agent.description && <Description style={{ margin: 0 }}>{agent.description}</Description>}
              <MyAgentsRow>
                <span>{t('myAgents.address')}:</span>
                <Mono>{agent.a2a_url}</Mono>
                <CopyButton text={agent.a2a_url} label={t('myAgents.copy')} />
              </MyAgentsRow>
              <MyAgentsRow>
                <StyledLink to={`/agent/${encodeURIComponent(agent.id)}`}>{t('myAgents.open')}</StyledLink>
                <StyledLink to={linked ? `/agent/${encodeURIComponent(agent.id)}/link` : `/agent/${encodeURIComponent(agent.id)}/edit`}>{t('myAgents.edit')}</StyledLink>
                <ExternalLink href={agent.card_url} target="_blank" rel="noreferrer">agent-card.json</ExternalLink>
                <Button size="small" variant="text" color="secondary" onClick={() => void remove(agent)} data-testid={`my-agent-delete-${agent.id}`}>{t('myAgents.delete')}</Button>
              </MyAgentsRow>
            </MyAgentsItem>
          );
        })}
      </MyAgentsList>

      <Description style={{ marginTop: 24 }}>{t('myAgents.teams_hint')}</Description>
    </PageWrapper>
  );
}
