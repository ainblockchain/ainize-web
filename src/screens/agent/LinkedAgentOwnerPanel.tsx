/**
 * What the person who LINKED an agent can do to it: change its address or name, and unlink it.
 *
 * Shown on `/agent/<id>` when the row is a linked agent (`isLinkedAgentRow`) whose `owner` is one of the viewer's
 * principals. Like the hosted panel, the check is for the page, not for safety — every route behind these buttons
 * is owner-only on the node. There are no logs: the node forwards to the agent, it does not run it.
 */
import { useRef, useState } from 'react';
import { useActiveView } from '@/hooks/useActiveView';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useDeleteLinkedAgentMutation, useLazyLinkedAgentQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { createLinkedAgentRemoval, LinkedAgentRemovalError } from '@/lib/linkedAgentRemoval';
import { linkedAgentApiErrorOf } from '@/api/linkedAgents';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Description, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import type { AgentVisibility } from '@/api/sharedAgents';
import { AgentVisibilityControl } from '@/components/agent/AgentVisibilityControl';
import { AgentAliasControl } from '@/components/agent/AgentAliasControl';

const LinkedAgentOwnerBox = styled.div`
  margin-top: 24px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; }
`;
const LinkedAgentOwnerRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;`;

export function LinkedAgentOwnerPanel({ agentId, agentName, owner = null, alias = null, visibility = null, orgId = null, removalBlocked = false, onRemovalStateChange }: { agentId: string; agentName: string; owner?: string | null; alias?: string | null; visibility?: AgentVisibility | null; orgId?: string | null; removalBlocked?: boolean; onRemovalStateChange?: (state: 'pending' | 'unconfirmed' | 'complete' | null) => void }) {
  const { t } = useT();
  const navigate = useNavigate();
  const active = useActiveView();
  const auth = useAuth();
  const removal = useRef(createLinkedAgentRemoval()).current;
  const [busy, setBusy] = useState(false);
  const [read] = useLazyLinkedAgentQuery();
  const [unlink] = useDeleteLinkedAgentMutation();
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (removalBlocked || removal.blocked() || !active() || !auth.isCurrentAccount()) return;
    setError(null); setBusy(true);
    try {
      const done = await removal.run({ id: agentId, owner }, auth.principal, {
        read: () => read({ id: agentId, identity: auth.cacheIdentity }, false).unwrap(),
        confirm: review => window.confirm(t('linkedOwner.delete_confirm', { name: review.name, id: review.id })),
        send: request => { onRemovalStateChange?.('pending'); return unlink(request).unwrap(); }, current: () => active() && auth.isCurrentAccount(),
      });
      if (done) navigate('/me/agents');
    } catch (err) {
      if (!active() || !auth.isCurrentAccount()) return;
      const e = linkedAgentApiErrorOf(err);
      setError(removal.uncertain() ? t('linkedOwner.delete_unknown') : err instanceof LinkedAgentRemovalError
        ? t(err.reason === 'unsupported' ? 'linkedOwner.delete_unsupported' : 'linkedOwner.delete_changed')
        : t('agentOwner.delete_failed', { why: e.message ?? t(`agentLink.api.${e.code}`) }));
    } finally {
      onRemovalStateChange?.(removal.uncertain() ? 'unconfirmed' : removal.confirmed() ? 'complete' : null);
      if (active()) setBusy(false);
    }
  };

  return (
    <LinkedAgentOwnerBox data-testid="linked-agent-owner">
      <h3>{t('agentOwner.title')}</h3>
      <Description>{t('linkedOwner.lede')}</Description>
      <fieldset disabled={removalBlocked || busy || removal.uncertain()} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <LinkedAgentOwnerRow>
        {!removalBlocked && !busy && !removal.uncertain() && <StyledLink to={`/agent/${encodeURIComponent(agentId)}/link`} data-testid="linked-agent-edit">{t('linkedOwner.edit')}</StyledLink>}
        <Button size="small" variant="text" color="secondary" loading={busy} disabled={removalBlocked || removal.blocked()} onClick={() => void remove()} data-testid="linked-agent-unlink">
          {t('linkedOwner.delete')}
        </Button>
      </LinkedAgentOwnerRow>
      <AgentAliasControl agentId={agentId} agentName={agentName} alias={alias} />
      <AgentVisibilityControl agentId={agentId} visibility={visibility} orgId={orgId} />
      </fieldset>
      {error && <Alert $tone="error" role="alert" style={{ marginTop: 12 }}>{error}</Alert>}
      {removal.uncertain() && <StyledLink to="/me/agents">{t('myAgents.title')}</StyledLink>}
    </LinkedAgentOwnerBox>
  );
}
