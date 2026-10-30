/**
 * The owner's "Address name" control on `/agent/<id>`: a readable alias for an agent whose id is not one.
 *
 * The id never changes — it is the agent's A2A address and workspaces hold it. The alias is a second address
 * (ainize-node agent-aliases.ts): `/agent/<alias>` and `/agents/<alias>` reach the same agent, and links use it.
 * The suggestion is the one a new agent would get from its name (`agentIdFromName`), so old and new agents read alike.
 * One component for both owner panels; the node decides who may set it (owner, write member, operator).
 */
import { useRef, useState } from 'react';
import { useActiveView } from '@/hooks/useActiveView';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useClearAgentAliasMutation, useSetAgentAliasMutation } from '@/api/api';
import { AGENT_ALIAS_PATTERN, agentPagePath, aliasSuggestion } from '@/api/agentIds';
import { hostedAgentApiErrorOf } from '@/api/hostedAgents';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { Mono } from '@/components/ui/Misc';
import { useT } from '@/i18n';

const AliasBox = styled.div`margin-top: 16px; display: flex; flex-direction: column; gap: 10px;`;
const AliasRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px;`;

export function AgentAliasControl({ agentId, agentName, alias }: { agentId: string; agentName: string; alias: string | null }) {
  const { t } = useT();
  const navigate = useNavigate();
  const active = useActiveView();
  const pending = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [setAlias, setState] = useSetAgentAliasMutation();
  const [clearAlias, clearState] = useClearAgentAliasMutation();
  const busy = setState.isLoading || clearState.isLoading;
  const valid = AGENT_ALIAS_PATTERN.test(draft) && draft !== agentId;

  const fail = (err: unknown) => {
    const e = hostedAgentApiErrorOf(err);
    // 409 is `alias_taken`; a 404 without the node's sentence is a node that has no alias routes
    setError(e.status === 409 ? t('agentAlias.taken') : e.message ?? (e.status === 404 ? t('agentAlias.unsupported') : e.code));
  };
  const save = async () => {
    if (!valid || pending.current || !active()) return;
    pending.current = true;
    setError(null);
    try {
      await setAlias({ id: agentId, alias: draft }).unwrap();
      if (!active()) return;
      setEditing(false);
      navigate(agentPagePath({ id: agentId, alias: draft }), { replace: true });
    } catch (err) { if (active()) fail(err); } finally { pending.current = false; }
  };
  const remove = async () => {
    if (pending.current || !active()) return;
    pending.current = true;
    setError(null);
    try {
      await clearAlias(agentId).unwrap();
      if (!active()) return;
      navigate(agentPagePath({ id: agentId }), { replace: true, state: { keepUrl: true } });
    } catch (err) { if (active()) fail(err); } finally { pending.current = false; }
  };

  return (
    <AliasBox data-testid="agent-alias-control">
      <AliasRow>
        <b>{t('agentAlias.title')}</b>
        <span data-testid="agent-alias-now">{alias ? <Mono>/agent/{alias}</Mono> : t('agentAlias.none')}</span>
        {!editing && (
          <Button size="small" variant="outlined" disabled={busy} onClick={() => { setDraft(aliasSuggestion(agentId, agentName, alias)); setEditing(true); setError(null); }} data-testid="agent-alias-change">
            {alias ? t('agentAlias.change') : t('agentAlias.set')}
          </Button>
        )}
        {!editing && alias && (
          <Button size="small" variant="text" color="secondary" loading={clearState.isLoading} onClick={() => void remove()} data-testid="agent-alias-clear">{t('agentAlias.clear')}</Button>
        )}
      </AliasRow>
      {editing && (
        <>
          <Input disabled={busy} value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value.toLowerCase())} aria-label={t('agentAlias.title')} data-testid="agent-alias-input" />
          <AliasRow>
            <span>{t('agentAlias.help', { id: agentId })}</span>
          </AliasRow>
          <AliasRow>
            <Button size="small" variant="contained" loading={setState.isLoading} disabled={!valid || busy} onClick={() => void save()} data-testid="agent-alias-save">{t('agentAlias.save')}</Button>
            <Button size="small" variant="text" disabled={busy} onClick={() => setEditing(false)}>{t('agentAlias.cancel')}</Button>
          </AliasRow>
        </>
      )}
      {error && <Alert $tone="error">{t('agentAlias.failed', { why: error })}</Alert>}
    </AliasBox>
  );
}

export default AgentAliasControl;
