/**
 * The owner's visibility control on `/agent/<id>`: what it is now, and a small form to change it in place.
 *
 * One component for both owner panels (hosted and linked), because the registry treats the two alike:
 * `PUT /api/shared-agents/<id>/visibility` is one route for either kind, owner or node operator. An older node has
 * no such route; its 404 is reported as "this node does not support visibility" and the control offers nothing else.
 */
import { useState } from 'react';
import styled from 'styled-components';
import { useSetAgentVisibilityMutation } from '@/api/api';
import { hostedAgentApiErrorOf } from '@/api/hostedAgents';
import { sharedAgentsUnsupported, sharingFieldsOf, sharingProblemKey, type AgentVisibility } from '@/api/sharedAgents';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { useT } from '@/i18n';
import { SharingFields } from './SharingFields';
import { useShareableOrgs } from '@/hooks/useShareableOrgs';

const VisibilityBox = styled.div`margin-top: 16px; display: flex; flex-direction: column; gap: 10px;`;
const VisibilityNow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; font-size: 13px;`;
const VisibilityActions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;

export function AgentVisibilityControl({ agentId, visibility, orgId }: { agentId: string; visibility: AgentVisibility | null; orgId: string | null }) {
  const { t } = useT();
  const shareable = useShareableOrgs();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ visibility: AgentVisibility; orgId: string | null }>({ visibility: visibility ?? 'public', orgId });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [save, state] = useSetAgentVisibilityMutation();

  const problem = editing ? sharingProblemKey(draft.visibility, draft.orgId, shareable.orgs) : null;
  const current = visibility ?? 'public';

  const submit = async () => {
    if (problem) return;
    setError(null); setSaved(false);
    try {
      await save({ id: agentId, ...sharingFieldsOf(draft.visibility, draft.orgId) }).unwrap();
      setEditing(false); setSaved(true);
    } catch (err) {
      if (sharedAgentsUnsupported(err)) { setUnsupported(true); setEditing(false); return; }
      const e = hostedAgentApiErrorOf(err);
      setError(e.message ?? t(`agentCreate.api.${e.code}`));
    }
  };

  return (
    <VisibilityBox data-testid="agent-visibility-control">
      <VisibilityNow>
        <b>{t('sharing.owner.title')}</b>
        <span data-testid="agent-visibility-now">
          {current === 'org' && orgId ? t('sharing.owner.current_org', { org: orgId }) : t('sharing.owner.current', { visibility: t(`sharing.visibility.${current}`) })}
        </span>
        {!editing && !unsupported && (
          <Button size="small" variant="outlined" onClick={() => { setDraft({ visibility: current, orgId }); setEditing(true); setSaved(false); }} data-testid="agent-visibility-change">
            {t('sharing.owner.change')}
          </Button>
        )}
      </VisibilityNow>
      {unsupported && <Alert $tone="info">{t('sharing.owner.unsupported')}</Alert>}
      {saved && <Alert $tone="success">{t('sharing.owner.saved')}</Alert>}
      {editing && (
        <>
          <SharingFields visibility={draft.visibility} orgId={draft.orgId} orgs={shareable.orgs} activeOrg={shareable.activeOrg} onChange={setDraft} problemKey={problem} idPrefix="agent-visibility" />
          <VisibilityActions>
            <Button size="small" variant="contained" loading={state.isLoading} disabled={!!problem} onClick={() => { void submit(); }} data-testid="agent-visibility-save">{t('sharing.owner.save')}</Button>
            <Button size="small" variant="text" onClick={() => setEditing(false)}>{t('sharing.owner.cancel')}</Button>
          </VisibilityActions>
        </>
      )}
      {error && <Alert $tone="error">{t('sharing.owner.failed', { why: error })}</Alert>}
    </VisibilityBox>
  );
}

export default AgentVisibilityControl;
