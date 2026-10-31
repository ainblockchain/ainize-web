import { AgentActionBoundary, useAgentActions } from '@/components/agent/AgentActionBoundary';
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
import { useRef, useState } from 'react';
import { useActiveView } from '@/hooks/useActiveView';
import { useAuth } from '@/auth/AuthContext';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useDeleteHostedAgentMutation, useHostedAgentLogsQuery, useLazyHostedAgentQuery } from '@/api/api';
import { AgentDeletionError, createHostedAgentDeletion, isAgentCleanupPending } from '@/lib/hostedAgentDeletion';
import { hostedAgentApiErrorOf, parseHostedAgentLogsResponse } from '@/api/hostedAgents';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Description, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import type { AgentVisibility } from '@/api/sharedAgents';
import { AinftRegistrationPanel } from './AinftRegistrationPanel';
import { AinftCommunityPanel } from './AinftCommunityPanel';
import { AgentVisibilityControl } from '@/components/agent/AgentVisibilityControl';
import { AgentAliasControl } from '@/components/agent/AgentAliasControl';

const HostedAgentOwnerBox = styled.div`
  margin-top: 24px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; }
`;
const HostedAgentOwnerRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;`;
const HostedAgentOwnerLogs = styled.pre`
  margin: 12px 0 0; padding: 14px; border-radius: 4px; background: #303133; color: #f2f2f2; max-height: 360px; overflow: auto;
  font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
`;

/**
 * `canAdminister` is false for an organization member who may edit the agent but not delete it or change who sees
 * it (ainize-node: those stay with the owner and the organization's admins); the panel then offers edit and logs only.
 */
function HostedAgentOwnerPanelContent({ agentId, agentName, owner = null, alias = null, visibility = null, orgId = null, canAdminister = true, isCreator = false, cleanupPending = false }: { agentId: string; agentName: string; owner?: string | null; alias?: string | null; visibility?: AgentVisibility | null; orgId?: string | null; canAdminister?: boolean; isCreator?: boolean; cleanupPending?: boolean }) {
  const { t } = useT();
  const navigate = useNavigate();
  const active = useActiveView();
  const actions = useAgentActions();
  const deletion = useRef(createHostedAgentDeletion()).current;
  const [deleting, setDeleting] = useState(false);
  const [readAgent] = useLazyHostedAgentQuery();
  const auth = useAuth();
  const { cacheIdentity } = auth;
  const [logsOpen, setLogsOpen] = useState(false);
  const logs = useHostedAgentLogsQuery({ id: agentId, identity: cacheIdentity }, { skip: !logsOpen });
  const lines = parseHostedAgentLogsResponse(logs.currentData);
  const [deleteAgent, deleteState] = useDeleteHostedAgentMutation();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const remove = async () => {
    if (deletion.blocked() || !canAdminister || !active() || !auth.isCurrentAccount() || !actions.scope.canStart('delete', agentId)) return;
    if (!window.confirm(t('agentOwner.delete_confirm', { name: agentName }))) return;
    const lease = actions.scope.begin('delete', agentId);
    if (!lease) return;
    let cleanup = cleanupPending || deletion.started() || actions.state?.phase === 'cleanup';
    setDeleteError(null);
    setDeleting(true);
    try {
      const done = await deletion.run({ id: agentId, name: agentName, owner }, {
        read: () => readAgent({ id: agentId, identity: cacheIdentity }, false).unwrap(),
        send: request => deleteAgent(request).unwrap(), active: () => active() && auth.isCurrentAccount(),
      });
      if (done) navigate('/explore?kind=agent');
    } catch (err) {
      cleanup = cleanup || isAgentCleanupPending(err);
      if (!active() || !auth.isCurrentAccount()) return;
      const e = hostedAgentApiErrorOf(err);
      setDeleteError(deletion.uncertain() ? t('agentOwner.delete_unknown') : isAgentCleanupPending(err) ? t('agentOwner.delete_pending')
        : err instanceof AgentDeletionError ? t('agentOwner.delete_changed') : e.message ?? t(`agentCreate.api.${e.code}`));
    } finally {
      lease.finish(deletion.uncertain() ? 'unconfirmed' : deletion.confirmed() ? 'complete' : cleanup ? 'cleanup' : null);
      if (active()) setDeleting(false);
    }
  };

  return (
    <HostedAgentOwnerBox data-testid="hosted-agent-owner">
      <h3>{t('agentOwner.title')}</h3>
      <Description>{t('agentOwner.lede')}</Description>
      <HostedAgentOwnerRow>
        {!actions.blocked && !cleanupPending && !deleting && !deletion.started() && <StyledLink to={`/agent/${encodeURIComponent(agentId)}/edit`} data-testid="hosted-agent-edit">{t('agentOwner.edit')}</StyledLink>}
        <Button size="small" variant="outlined" onClick={() => setLogsOpen((o) => !o)} data-testid="hosted-agent-logs-toggle">
          {logsOpen ? t('agentOwner.logs_hide') : t('agentOwner.logs_show')}
        </Button>
        {logsOpen && (
          <Button size="small" variant="text" onClick={() => { void logs.refetch(); }} disabled={logs.isFetching}>
            {t('agentOwner.logs_refresh')}
          </Button>
        )}
        {canAdminister && (
          <Button size="small" variant="text" color="secondary" loading={deleting || deleteState.isLoading} disabled={deletion.blocked() || !actions.scope.canStart('delete', agentId)} onClick={() => { void remove(); }} data-testid="hosted-agent-delete">
            {t(cleanupPending || deletion.started() && !deletion.uncertain() ? 'agentOwner.delete_resume' : 'agentOwner.delete')}
          </Button>
        )}
      </HostedAgentOwnerRow>
      {deleteError && <Alert $tone="error" role="alert" style={{ marginTop: 12 }}>{deleteError}</Alert>}
      {cleanupPending && !deleteError && <Alert $tone="error" role="status">{t('agentOwner.delete_pending')}</Alert>}
      {!cleanupPending && !deleting && !deletion.started() && <>
      <AgentAliasControl kind="hosted" owner={owner} agentId={agentId} agentName={agentName} alias={alias} />
      <fieldset disabled={actions.blocked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      {isCreator && <AinftRegistrationPanel agentId={agentId} />}
      {isCreator && <AinftCommunityPanel agentId={agentId} />}
      </fieldset>
      {canAdminister && <AgentVisibilityControl kind="hosted" owner={owner} agentId={agentId} visibility={visibility} orgId={orgId} />}
      </>}
      {logsOpen && (
        logs.error
          ? <Alert $tone="error" style={{ marginTop: 12 }}>{t('agentOwner.logs_failed', { why: hostedAgentApiErrorOf(logs.error).message ?? String(hostedAgentApiErrorOf(logs.error).status ?? '') })}</Alert>
          : <HostedAgentOwnerLogs data-testid="hosted-agent-logs">{(!logs.currentData && logs.isFetching) ? '…' : lines.length ? lines.join('\n') : t('agentOwner.logs_empty')}</HostedAgentOwnerLogs>
      )}
    </HostedAgentOwnerBox>
  );
}

export default HostedAgentOwnerPanel;

export function HostedAgentOwnerPanel(props: Parameters<typeof HostedAgentOwnerPanelContent>[0]) {
  const { cacheIdentity } = useAuth();
  return <AgentActionBoundary key={JSON.stringify([cacheIdentity, props.agentId])}><HostedAgentOwnerPanelContent {...props} /></AgentActionBoundary>;
}
