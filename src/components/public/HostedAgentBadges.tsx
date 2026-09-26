/**
 * The chips a hosted agent adds to a row: which model it is built on, how it runs, and whether its build is done.
 *
 * One component for the marketplace row (`AgentListItem`) and the agent page, so both say the same thing in the
 * same words. Each chip appears only when the node sent its field (`agentSummaryHostedFieldsOf`): an older node's
 * row has none of them, and a chip that guessed — "upstream", "ready" — would be a claim nobody made.
 *
 * The model chip is a link to `/models/<model>`, because "built on X" is the first thing a reader wants to click.
 * It sits above the row's full-card link (`z-index: 1`), the same way the row's copy button does.
 */
import { Link } from 'react-router';
import styled from 'styled-components';
import type { AgentSummary } from '@/api/types';
import { agentSummaryHostedFieldsOf } from '@/api/hostedAgents';
import { useT } from '@/i18n';

const hostedAgentChipCss = `display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; line-height: 1.7; position: relative; z-index: 1;`;
const HostedAgentModelChip = styled(Link)`
  ${hostedAgentChipCss}
  background: #e8f0fe; color: #1a4fb5; text-decoration: none;
  &:hover { text-decoration: underline; }
`;
const HostedAgentChip = styled.span<{ $tone: 'kind' | 'building' | 'ready' | 'failed' }>`
  ${hostedAgentChipCss}
  background: ${(p) => ({ kind: '#eef1f4', building: '#fff1de', ready: '#e3f4e8', failed: '#fdeaea' }[p.$tone])};
  color: ${(p) => ({ kind: '#4a5560', building: '#8a4b00', ready: '#1c6b34', failed: '#9b2226' }[p.$tone])};
`;

export function HostedAgentBadges({ agent, showStatus = true }: { agent: AgentSummary; showStatus?: boolean }) {
  const { t } = useT();
  const { model, kind, status } = agentSummaryHostedFieldsOf(agent);
  return (
    <>
      {model && (
        <HostedAgentModelChip to={`/models/${encodeURIComponent(model)}`} title={t('hostedAgent.model_help')} data-testid="agent-model-badge">
          {t('hostedAgent.model', { model })}
        </HostedAgentModelChip>
      )}
      {kind && kind !== 'upstream' && <HostedAgentChip $tone="kind" title={t(`hostedAgent.kind.${kind}.help`)}>{t(`hostedAgent.kind.${kind}`)}</HostedAgentChip>}
      {/* `ready` is the normal state and says nothing a reader needs; only the two exceptions are chips. */}
      {showStatus && status && status !== 'ready' && (
        <HostedAgentChip $tone={status} data-testid="agent-status-badge">{t(`hostedAgent.status.${status}`)}</HostedAgentChip>
      )}
    </>
  );
}

export default HostedAgentBadges;
