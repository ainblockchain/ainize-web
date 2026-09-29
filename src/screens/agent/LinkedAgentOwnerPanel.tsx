/**
 * What the person who LINKED an agent can do to it: change its address or name, and unlink it.
 *
 * Shown on `/agent/<id>` when the row is a linked agent (`isLinkedAgentRow`) whose `owner` is one of the viewer's
 * principals. Like the hosted panel, the check is for the page, not for safety — every route behind these buttons
 * is owner-only on the node. There are no logs: the node forwards to the agent, it does not run it.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useDeleteLinkedAgentMutation } from '@/api/api';
import { linkedAgentApiErrorOf } from '@/api/linkedAgents';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Description, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';

const LinkedAgentOwnerBox = styled.div`
  margin-top: 24px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; }
`;
const LinkedAgentOwnerRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;`;

export function LinkedAgentOwnerPanel({ agentId, agentName }: { agentId: string; agentName: string }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [unlink, state] = useDeleteLinkedAgentMutation();
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    if (!window.confirm(t('linkedOwner.delete_confirm', { name: agentName }))) return;
    setError(null);
    try {
      await unlink(agentId).unwrap();
      navigate('/me/agents');
    } catch (err) {
      const e = linkedAgentApiErrorOf(err);
      setError(e.message ?? t(`agentLink.api.${e.code}`));
    }
  };

  return (
    <LinkedAgentOwnerBox data-testid="linked-agent-owner">
      <h3>{t('agentOwner.title')}</h3>
      <Description>{t('linkedOwner.lede')}</Description>
      <LinkedAgentOwnerRow>
        <StyledLink to={`/agent/${encodeURIComponent(agentId)}/link`} data-testid="linked-agent-edit">{t('linkedOwner.edit')}</StyledLink>
        <Button size="small" variant="text" color="secondary" loading={state.isLoading} onClick={() => void remove()} data-testid="linked-agent-unlink">
          {t('linkedOwner.delete')}
        </Button>
      </LinkedAgentOwnerRow>
      {error && <Alert $tone="error" style={{ marginTop: 12 }}>{t('agentOwner.delete_failed', { why: error })}</Alert>}
    </LinkedAgentOwnerBox>
  );
}
