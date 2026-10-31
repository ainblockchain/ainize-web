import { useAgentActions } from './AgentActionBoundary';
/** Review current sharing before editing; a generic 200 is not a confirmed change. */
import { useEffect, useRef, useState } from 'react';
import { useActiveView } from '@/hooks/useActiveView';
import { useAuth } from '@/auth/AuthContext';
import styled from 'styled-components';
import { useLazyAgentVisibilityQuery, useSetAgentVisibilityMutation } from '@/api/api';
import { agentSharingConfirmed, readAgentSharingReview, saveReviewedSharing, AgentSharingError, type AgentSharingReview, type AgentSharingChange } from '@/lib/agentSharing';
import { sharedAgentsErrorCode, sharingProblemKey, type AgentVisibility } from '@/api/sharedAgents';
import { OrganizationName } from './OrganizationName';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { useT } from '@/i18n';
import { SharingFields } from './SharingFields';
import { useShareableOrgs } from '@/hooks/useShareableOrgs';
const VisibilityBox = styled.div`margin-top: 16px; display: flex; flex-direction: column; gap: 10px;`;
const VisibilityNow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px;`;
const VisibilityActions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;

export function AgentVisibilityControl({ agentId, kind, owner, visibility, orgId }: { agentId: string; kind: 'hosted' | 'linked'; owner?: string | null; visibility: AgentVisibility | null; orgId: string | null }) {
  const { t } = useT(), auth = useAuth(), shareable = useShareableOrgs(), active = useActiveView();
  const actions = useAgentActions();
  const canStart = actions.scope.canStart('sharing', agentId);
  const pending = useRef(false), [busy, setBusy] = useState(false);
  const [read] = useLazyAgentVisibilityQuery(), [save] = useSetAgentVisibilityMutation();
  const [review, setReview] = useState<AgentSharingReview | null>(null);
  const [confirmed, setConfirmed] = useState<AgentSharingChange | null>(null);
  const [draft, setDraft] = useState<AgentSharingChange>({ visibility: 'private', orgId: null });
  const [editing, setEditing] = useState(false), [saved, setSaved] = useState(false);
  const [issue, setIssue] = useState<string | null>(null), [conflict, setConflict] = useState(false), [localUnknown, setUnknown] = useState(false);
  const unknown = localUnknown || actions.state?.phase === 'unconfirmed' && actions.state.action === 'sharing' && actions.state.id === agentId;
  useEffect(() => { setConfirmed(null); setSaved(false); }, [visibility, orgId]);
  const current = () => active() && auth.isCurrentAccount();
  const problem = editing ? sharingProblemKey(draft.visibility, draft.orgId, shareable.orgs) : null;
  const displayed = confirmed?.visibility ?? visibility, displayedOrg = confirmed ? confirmed.orgId : orgId;
  const readFresh = () => read({ id: agentId, identity: auth.cacheIdentity }, false).unwrap();

  const load = async (edit: boolean) => {
    if (pending.current || !current() || edit && (unknown || !canStart)) return;
    pending.current = true; setBusy(true); setIssue(null); setSaved(false);
    try {
      const value = readAgentSharingReview(await readFresh());
      if (!current()) return;
      if (!value || value.id !== agentId || value.kind !== kind || value.actor !== auth.principal || owner && value.owner !== owner) { setIssue('sharing.owner.read_failed'); return; }
      setConfirmed({ visibility: value.visibility, orgId: value.orgId });
      if (edit) { setReview(value); setDraft({ visibility: value.visibility, orgId: value.orgId }); setEditing(true); setConflict(false); }
    } catch { if (current()) setIssue('sharing.owner.read_failed'); }
    finally { pending.current = false; if (active()) setBusy(false); }
  };

  const submit = async () => {
    if (problem || !review || conflict || unknown || pending.current || !current()) return;
    const lease = actions.scope.begin('sharing', agentId);
    if (!lease) return;
    let outcome: 'complete' | 'unconfirmed' | null = null;
    pending.current = true; setBusy(true); setIssue(null); setSaved(false);
    try {
      const after = await saveReviewedSharing(review, draft, { current, read: readFresh, send: async body => { const raw = await save(body).unwrap(); if (agentSharingConfirmed(raw, review, draft)) outcome = 'complete'; return raw; } });
      if (!after || !current()) return;
      setReview(after); setConfirmed({ visibility: after.visibility, orgId: after.orgId }); setEditing(false); setSaved(true);
    } catch (error) {
      if (error instanceof AgentSharingError && error.reason === 'unconfirmed') outcome = 'unconfirmed';
      if (!current()) return;
      if (error instanceof AgentSharingError && error.reason === 'unconfirmed') { setUnknown(true); return; }
      if (error instanceof AgentSharingError || sharedAgentsErrorCode(error) === 'review_changed') { setConflict(true); setIssue('sharing.owner.changed'); }
      else setIssue('sharing.owner.not_saved');
    } finally { lease.finish(outcome); pending.current = false; if (active()) setBusy(false); }
  };

  return <VisibilityBox data-testid="agent-visibility-control">
    <VisibilityNow>
      <b>{t('sharing.owner.title')}</b>
      <span data-testid="agent-visibility-now">{!displayed ? t('sharing.owner.unknown') : displayed === 'org' && displayedOrg ? <><OrganizationName orgId={displayedOrg} /> · {t('sharing.owner.shared_org')}</> : t('sharing.owner.current', { visibility: t(`sharing.visibility.${displayed}`) })}</span>
      {!editing && !unknown && <Button size="small" variant="outlined" disabled={busy || !canStart} loading={busy} onClick={() => void load(true)} data-testid="agent-visibility-change">{t('sharing.owner.change')}</Button>}
    </VisibilityNow>
    {saved && !actions.shared && <Alert $tone="success">{t('sharing.owner.saved')}</Alert>}
    {unknown && <Alert $tone="error" data-testid="agent-visibility-unconfirmed">{t('sharing.owner.unconfirmed')}{' '}<Button type="button" size="small" disabled={busy} onClick={() => void load(false)}>{t('sharing.owner.check')}</Button></Alert>}
    {editing && <>
      <fieldset disabled={busy || unknown || !canStart} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}><SharingFields visibility={draft.visibility} orgId={draft.orgId} orgs={shareable.orgs} activeOrg={shareable.activeOrg} onChange={setDraft} problemKey={problem} idPrefix="agent-visibility" /></fieldset>
      <VisibilityActions>
        <Button size="small" variant="contained" loading={busy} disabled={!!problem || busy || conflict || unknown || !canStart} onClick={() => void submit()} data-testid="agent-visibility-save">{t('sharing.owner.save')}</Button>
        {conflict && !unknown && <Button size="small" disabled={busy || !canStart} onClick={() => void load(true)}>{t('sharing.owner.reload')}</Button>}
        <Button size="small" variant="text" disabled={busy} onClick={() => setEditing(false)}>{t('sharing.owner.cancel')}</Button>
      </VisibilityActions>
    </>}
    {issue && <Alert $tone="error">{t(issue)}</Alert>}
  </VisibilityBox>;
}
export default AgentVisibilityControl;
