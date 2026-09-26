/**
 * What the person who built an agent can do to it: change it, take it down, and read what it has been logging.
 *
 * Shown on `/agent/<id>` only when the signed-in address is the row's `owner` (`isHostedAgentOwnedBy`). That check
 * is for the page, not for safety — every route behind these buttons is owner-only on the node, which answers 403
 * to anybody else. Hiding the panel just keeps a visitor from being offered buttons that would all refuse them.
 *
 * The logs are fetched when opened, not on page load: they are the build output and the container's tail (≤ 200
 * lines), read while debugging, and a page every visitor opens has no reason to ask for them.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useDeleteHostedAgentMutation, useHostedAgentLogsQuery } from '@/api/api';
import { hostedAgentApiErrorOf, parseHostedAgentLogsResponse } from '@/api/hostedAgents';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Description, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';

const HostedAgentOwnerBox = styled.div`
  margin-top: 24px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; }
`;
const HostedAgentOwnerRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;`;
const HostedAgentOwnerLogs = styled.pre`
  margin: 12px 0 0; padding: 14px; border-radius: 4px; background: #303133; color: #f2f2f2; max-height: 360px; overflow: auto;
  font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
`;

export function HostedAgentOwnerPanel({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [logsOpen, setLogsOpen] = useState(false);
  const logs = useHostedAgentLogsQuery(agentId, { skip: !logsOpen });
  const lines = parseHostedAgentLogsResponse(logs.data);
  const [deleteAgent, deleteState] = useDeleteHostedAgentMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm(t('agentOwner.delete_confirm', { name: agentName }))) return;
    setDeleteError(null);
    try {
      await deleteAgent(agentId).unwrap();
      navigate('/explore?kind=agent');
    } catch (err) {
      const e = hostedAgentApiErrorOf(err);
      setDeleteError(e.message ?? t(`agentCreate.api.${e.code}`));
    }
  };

  return (
    <HostedAgentOwnerBox data-testid="hosted-agent-owner">
      <h3>{t('agentOwner.title')}</h3>
      <Description>{t('agentOwner.lede')}</Description>
      <HostedAgentOwnerRow>
        <StyledLink to={`/agent/${encodeURIComponent(agentId)}/edit`} data-testid="hosted-agent-edit">{t('agentOwner.edit')}</StyledLink>
        <Button size="small" variant="outlined" onClick={() => setLogsOpen((o) => !o)} data-testid="hosted-agent-logs-toggle">
          {logsOpen ? t('agentOwner.logs_hide') : t('agentOwner.logs_show')}
        </Button>
        {logsOpen && (
          <Button size="small" variant="text" onClick={() => { void logs.refetch(); }} disabled={logs.isFetching}>
            {t('agentOwner.logs_refresh')}
          </Button>
        )}
        <Button size="small" variant="text" color="secondary" loading={deleteState.isLoading} onClick={() => { void remove(); }} data-testid="hosted-agent-delete">
          {t('agentOwner.delete')}
        </Button>
      </HostedAgentOwnerRow>
      {deleteError && <Alert $tone="error" style={{ marginTop: 12 }}>{t('agentOwner.delete_failed', { why: deleteError })}</Alert>}
      {logsOpen && (
        logs.error
          ? <Alert $tone="error" style={{ marginTop: 12 }}>{t('agentOwner.logs_failed', { why: hostedAgentApiErrorOf(logs.error).message ?? String(hostedAgentApiErrorOf(logs.error).status ?? '') })}</Alert>
          : <HostedAgentOwnerLogs data-testid="hosted-agent-logs">{logs.isLoading ? '…' : lines.length ? lines.join('\n') : t('agentOwner.logs_empty')}</HostedAgentOwnerLogs>
      )}
    </HostedAgentOwnerBox>
  );
}

export default HostedAgentOwnerPanel;
