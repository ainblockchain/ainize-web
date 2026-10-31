/** Address changes are bound to a fresh review; only a matching save receipt can move the page. */
import { useRef, useState } from 'react';
import { useActiveView } from '@/hooks/useActiveView';
import { useAuth } from '@/auth/AuthContext';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useLazyAgentAliasReviewQuery, useClearAgentAliasMutation, useSetAgentAliasMutation } from '@/api/api';
import { AGENT_ALIAS_PATTERN, agentPagePath, aliasSuggestion } from '@/api/agentIds';
import { sharedAgentsErrorCode } from '@/api/sharedAgents';
import { readAgentAliasReview, changeReviewedAlias, AgentAliasChangeError, type AgentAliasReview } from '@/lib/agentAliasChange';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { Mono } from '@/components/ui/Misc';
import { useT } from '@/i18n';
const AliasBox = styled.div`margin-top: 16px; display: flex; flex-direction: column; gap: 10px;`;
const AliasRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px; overflow-wrap: anywhere;`;

export function AgentAliasControl({ agentId, agentName, alias, kind, owner }: { agentId: string; agentName: string; alias: string | null; kind: 'hosted' | 'linked'; owner?: string | null }) {
  const { t } = useT(), auth = useAuth(), navigate = useNavigate(), active = useActiveView();
  const pending = useRef(false), [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'set' | 'remove' | null>(null), [draft, setDraft] = useState('');
  const [review, setReview] = useState<AgentAliasReview | null>(null);
  const [issue, setIssue] = useState<string | null>(null), [conflict, setConflict] = useState(false), [unknown, setUnknown] = useState(false);
  const [read] = useLazyAgentAliasReviewQuery(), [setAlias] = useSetAgentAliasMutation(), [clearAlias] = useClearAgentAliasMutation();
  const current = () => active() && auth.isCurrentAccount();
  const readFresh = () => read({ id: agentId, identity: auth.cacheIdentity }, false).unwrap();
  const valid = mode === 'remove' ? !!review?.alias : AGENT_ALIAS_PATTERN.test(draft) && draft !== agentId && (draft !== review?.alias || review?.state === 'unverified');

  const load = async (next: 'set' | 'remove' | null) => {
    if (pending.current || !current() || next && unknown) return;
    pending.current = true; setBusy(true); setIssue(null);
    try {
      const value = readAgentAliasReview(await readFresh());
      if (!current()) return;
      if (!value || value.id !== agentId || value.kind !== kind || value.actor !== auth.principal || owner && value.owner !== owner) { setIssue('agentAlias.read_failed'); return; }
      setReview(value);
      if (next === 'remove' && value.alias === null) { setMode(null); setIssue('agentAlias.changed'); return; }
      if (next) { setMode(next); setDraft(aliasSuggestion(agentId, agentName, value.alias)); setConflict(false); }
    } catch { if (current()) setIssue('agentAlias.read_failed'); }
    finally { pending.current = false; if (active()) setBusy(false); }
  };
  const submit = async () => {
    if (!valid || !review || !mode || unknown || conflict || pending.current || !current()) return;
    pending.current = true; setBusy(true); setIssue(null);
    try {
      const after = await changeReviewedAlias({ id: agentId, expected: review, alias: mode === 'remove' ? null : draft }, {
        current, read: readFresh, send: change => change.alias === null ? clearAlias({ id: change.id, expected: change.expected }).unwrap() : setAlias({ ...change, alias: change.alias }).unwrap(),
      });
      if (!after || !current()) return;
      setReview(after); setMode(null);
      navigate(agentPagePath({ id: after.id, alias: after.alias }), { replace: true, ...(after.alias === null ? { state: { keepUrl: true } } : {}) });
    } catch (error) {
      if (!current()) return;
      if (error instanceof AgentAliasChangeError && error.reason === 'unconfirmed') { setUnknown(true); return; }
      if (error instanceof AgentAliasChangeError && error.reason === 'read_failed') { setIssue('agentAlias.read_failed'); return; }
      const code = sharedAgentsErrorCode(error);
      if (error instanceof AgentAliasChangeError || code === 'review_changed') { setConflict(true); setIssue('agentAlias.changed'); }
      else setIssue(code === 'alias_taken' ? 'agentAlias.taken' : 'agentAlias.not_saved');
    } finally { pending.current = false; if (active()) setBusy(false); }
  };

  return <AliasBox data-testid="agent-alias-control">
    <AliasRow>
      <b>{t('agentAlias.title')}</b>
      <span data-testid="agent-alias-now">{alias ? <Mono>/agent/{alias}</Mono> : t('agentAlias.none')}</span>
      {!mode && !unknown && <>
        <Button size="small" variant="outlined" disabled={busy} onClick={() => void load('set')} data-testid="agent-alias-change">{alias ? t('agentAlias.change') : t('agentAlias.set')}</Button>
        {alias && <Button size="small" variant="text" disabled={busy} onClick={() => void load('remove')} data-testid="agent-alias-clear">{t('agentAlias.clear')}</Button>}
      </>}
    </AliasRow>
    {unknown && <Alert $tone="error" data-testid="agent-alias-unconfirmed">{t('agentAlias.unconfirmed')}{' '}<Button size="small" disabled={busy} onClick={() => void load(null)}>{t('agentAlias.check')}</Button></Alert>}
    {review && <AliasRow>{t(review.state === 'unverified' ? 'agentAlias.recorded' : 'agentAlias.reviewed')} <Mono>{agentPagePath({ id: review.id, alias: review.alias })}</Mono></AliasRow>}
    {review?.state === 'unverified' && <Alert $tone="error" data-testid="agent-alias-legacy">{t('agentAlias.unverified')}</Alert>}
    {mode && <>
      {mode === 'set' ? <Input disabled={busy || unknown} value={draft} maxLength={40} onChange={e => setDraft(e.target.value.toLowerCase())} aria-label={t('agentAlias.title')} data-testid="agent-alias-input" />
        : <span>{t('agentAlias.remove_confirm', { alias: review?.alias ?? '', id: agentId })}</span>}
      <span>{t('agentAlias.help', { id: agentId })}</span>
      <AliasRow>
        <Button size="small" variant="contained" loading={busy} disabled={!valid || busy || conflict || unknown} onClick={() => void submit()} data-testid="agent-alias-save">{t(mode === 'remove' ? 'agentAlias.clear' : review?.state === 'unverified' && draft === review.alias ? 'agentAlias.confirm' : 'agentAlias.save')}</Button>
        {mode === 'set' && review?.state === 'unverified' && <Button size="small" disabled={busy || unknown} onClick={() => setMode('remove')}>{t('agentAlias.clear')}</Button>}
        {conflict && !unknown && <Button size="small" disabled={busy} onClick={() => void load(mode)}>{t('agentAlias.reload')}</Button>}
        <Button size="small" variant="text" disabled={busy} onClick={() => setMode(null)}>{t('agentAlias.cancel')}</Button>
      </AliasRow>
    </>}
    {issue && <Alert $tone="error">{t(issue)}</Alert>}
  </AliasBox>;
}
export default AgentAliasControl;
