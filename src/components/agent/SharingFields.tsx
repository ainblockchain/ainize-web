/**
 * "Who can see it" — the two fields every agent form shares (built on a model, linked by URL): a visibility select
 * and, for `org`, the organization to share with.
 *
 * The organizations come from the AIN SSO session (`auth.sso.orgs`). A wallet session has none, so `org` is shown
 * DISABLED with the reason, not hidden: a person who signed in with a wallet should learn that the feature exists
 * and what would turn it on. Everything that decides — the default org, the problem key — is in
 * `src/api/sharedAgents.ts`; this is the control around it.
 */
import styled from 'styled-components';
import { AGENT_VISIBILITIES, defaultOrgIdFor, orgVisibilityAvailable, type AgentVisibility, type OrgOption } from '@/api/sharedAgents';
import { Field, FieldLabel, HelperText, Select } from '@/components/ui/Form';
import { useT } from '@/i18n';

const SharingRow = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;`;

export interface SharingFieldsProps {
  visibility: AgentVisibility;
  orgId: string | null;
  orgs: readonly OrgOption[] | null | undefined;
  /** The org preselected when switching to `org` (the session's active one). */
  activeOrg?: string | null;
  onChange: (next: { visibility: AgentVisibility; orgId: string | null }) => void;
  /** The dictionary key of what is wrong, when the form is showing problems. */
  problemKey?: string | null;
  idPrefix?: string;
}

export function SharingFields({ visibility, orgId, orgs, activeOrg, onChange, problemKey, idPrefix = 'sharing' }: SharingFieldsProps) {
  const { t } = useT();
  const orgAvailable = orgVisibilityAvailable(orgs);

  const setVisibility = (v: AgentVisibility) => {
    onChange({ visibility: v, orgId: v === 'org' ? orgId ?? defaultOrgIdFor(orgs, activeOrg) : null });
  };

  return (
    <SharingRow data-testid="sharing-fields">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-visibility`}>{t('sharing.field.visibility')}</FieldLabel>
        <Select id={`${idPrefix}-visibility`} value={visibility} onChange={(e) => setVisibility(e.target.value as AgentVisibility)} data-testid="sharing-visibility">
          {AGENT_VISIBILITIES.map((v) => (
            <option key={v} value={v} disabled={v === 'org' && !orgAvailable && visibility !== 'org'}>
              {t(`sharing.visibility.${v}`)}{v === 'org' && !orgAvailable ? ` — ${t('sharing.org_needs_sso')}` : ''}
            </option>
          ))}
        </Select>
        <HelperText>{t(`sharing.visibility.${visibility}.help`)}</HelperText>
      </Field>
      {visibility === 'org' && (
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-org`}>{t('sharing.field.org')}</FieldLabel>
          <Select id={`${idPrefix}-org`} value={orgId ?? ''} disabled={!orgAvailable} onChange={(e) => onChange({ visibility, orgId: e.target.value || null })} data-testid="sharing-org">
            {!orgId && <option value="">{t('sharing.field.org_pick')}</option>}
            {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name || o.slug || o.id}</option>)}
            {/* An org this session is not in (a spec stored by somebody else, an org left since) stays selectable so the form can show it. */}
            {orgId && !(orgs ?? []).some((o) => o.id === orgId) && <option value={orgId}>{orgId}</option>}
          </Select>
          <HelperText $error={!!problemKey}>
            {problemKey ? t(problemKey) : !orgAvailable ? t(orgs && orgs.length === 0 ? 'sharing.org_none' : 'sharing.org_needs_sso') : t('sharing.field.org_help')}
          </HelperText>
        </Field>
      )}
    </SharingRow>
  );
}

export default SharingFields;
