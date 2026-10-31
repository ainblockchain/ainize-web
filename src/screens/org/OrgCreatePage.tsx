/**
 * `/org/new` — make an organization. Id, name, description, README, and who gets in: the one domain the node lets
 * this person claim is their own sign-in's, so the form offers exactly that as a checkbox rather than a text field
 * (a text field would invite typing `comcom.ai` and being refused). Everything that decides is in
 * `src/api/organizations.ts`.
 */
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useCreateOrgMutation, useMyOrgsQuery } from '@/api/api';
import {
  ORG_ROLES, orgApiErrorOf, orgCreateInputFromDraft, orgFormProblems, orgIdFromName,
  type OrgFormDraft, type OrgFormField, type OrgRole,
} from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, SelectField, Textarea } from '@/components/ui/Form';
import { Description, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { useActiveView } from '@/hooks/useActiveView';
import { createSelectedOrg, orgCreationAccess, OrgEntryError } from '@/lib/orgEntry';
import { OrgReadStatus } from './OrgReadStatus';

const OrgForm = styled.form`display: flex; flex-direction: column; gap: 24px; margin-top: 8px; max-width: 760px;`;
const OrgSection = styled.fieldset`
  display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; margin: 0; min-width: 0; background: #fff;
  input, textarea, select { min-width: 0; max-width: 100%; }
  @media (max-width: 480px) { padding: 16px; }
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;
const OrgActions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;

const EMPTY: OrgFormDraft = { id: '', name: '', description: '', readme: '', claimDomain: false, domainRole: 'write' };

export default function OrgCreatePage() {
  const auth = useAuth();
  return <OrgCreateForm key={auth.cacheIdentity} />;
}

function OrgCreateForm() {
  const { t } = useT();
  useTitle(t('orgNew.title'));
  const navigate = useNavigate();
  const auth = useAuth();
  const active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const flight = useRef(false);
  const query = useMyOrgsQuery(auth.cacheIdentity, { skip: !auth.isSignedIn || auth.loading, refetchOnMountOrArgChange: true });
  const access = orgCreationAccess(query.currentData);
  const ready = auth.isSignedIn && !auth.loading && !query.isFetching && !query.isError && !!access;
  const domain = access?.domain ?? null;
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [create] = useCreateOrgMutation();
  const [draft, setDraft] = useState<OrgFormDraft>(EMPTY);
  const [idTouched, setIdTouched] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const set = <K extends keyof OrgFormDraft>(k: K, v: OrgFormDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setName = (name: string) => setDraft((d) => ({ ...d, name, ...(idTouched ? {} : { id: orgIdFromName(name) }) }));
  const problems = useMemo(() => orgFormProblems(draft), [draft]);
  const problemFor = (f: OrgFormField) => (touched ? problems.find((p) => p.field === f) : undefined);
  const canClaim = ready && !!domain && !access?.heldBy;
  const claimChanged = !!selectedDomain && ready && (!canClaim || selectedDomain !== domain);

  const submit = async () => {
    if (flight.current || !isCurrent() || !ready || claimChanged) return;
    setTouched(true);
    setServerError(null);
    if (problems.length) return;
    flight.current = true;
    setSaving(true);
    try {
      const body = orgCreateInputFromDraft({ ...draft, claimDomain: !!selectedDomain }, selectedDomain);
      const org = await createSelectedOrg(body, {
        readAccess: () => query.refetch().unwrap(), create: (input) => create(input).unwrap(), isCurrent,
      });
      if (org) navigate(`/org/${encodeURIComponent(org.id)}`);
    } catch (err) {
      if (!isCurrent()) return;
      if (err instanceof OrgEntryError) { setServerError(t(`org.entry.${err.code}`)); return; }
      const e = orgApiErrorOf(err);
      setServerError(e.message ? `${t(`org.api.${e.code}`)} — ${e.message}` : t(`org.api.${e.code}`));
    } finally {
      flight.current = false;
      if (isCurrent()) setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <TitleRow><Title>{t('orgNew.title')}</Title></TitleRow>
      <Description>{t('orgNew.lede')}</Description>

      <OrgForm onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate data-testid="org-new-form">
        <OrgSection disabled={saving}>
          <Field>
            <FieldLabel htmlFor="org-new-name">{t('orgNew.field.name')}</FieldLabel>
            <Input id="org-new-name" value={draft.name} maxLength={80} onChange={(e) => setName(e.target.value)} data-testid="org-new-name" />
            <HelperText $error={!!problemFor('name')}>{problemFor('name') ? t(problemFor('name')!.key) : ''}</HelperText>
          </Field>
          <Field>
            <FieldLabel htmlFor="org-new-id">{t('orgNew.field.id')}</FieldLabel>
            <Input id="org-new-id" value={draft.id} maxLength={40} data-testid="org-new-id"
              onChange={(e) => { setIdTouched(true); set('id', e.target.value.toLowerCase()); }} />
            <HelperText $error={!!problemFor('id')}>{problemFor('id') ? t(problemFor('id')!.key) : t('orgNew.field.id_help', { id: draft.id || 'my-team' })}</HelperText>
          </Field>
          <Field>
            <FieldLabel htmlFor="org-new-description">{t('orgNew.field.description')}</FieldLabel>
            <Input id="org-new-description" value={draft.description} maxLength={500} onChange={(e) => set('description', e.target.value)} />
            <HelperText $error={!!problemFor('description')}>{problemFor('description') ? t(problemFor('description')!.key) : ''}</HelperText>
          </Field>
          <Field>
            <FieldLabel htmlFor="org-new-readme">{t('orgNew.field.readme')}</FieldLabel>
            <Textarea id="org-new-readme" value={draft.readme} style={{ minHeight: 120, fontFamily: 'ui-monospace, monospace' }} onChange={(e) => set('readme', e.target.value)} />
            <HelperText $error={!!problemFor('readme')}>{problemFor('readme') ? t(problemFor('readme')!.key) : t('orgNew.field.readme_help')}</HelperText>
          </Field>
        </OrgSection>

        <OrgSection disabled={saving}>
          <h2>{t('orgNew.section.who')}</h2>
          <OrgReadStatus query={query} valid={!!access} />
          {(canClaim || selectedDomain) ? (
            <>
              <Checkbox label={t('orgNew.claim_domain', { domain: selectedDomain ?? domain ?? '' })} checked={!!selectedDomain} disabled={!ready}
                onChange={(e) => setSelectedDomain(e.target.checked ? domain : null)} data-testid="org-new-claim" />
              <HelperText>{t('orgNew.claim_domain_help')}</HelperText>
              {claimChanged && <Alert role="alert" $tone="error">{t('org.entry.domain_changed')}</Alert>}
            </>
          ) : ready ? (
            <Description style={{ margin: 0 }}>{domain ? t('org.api.domain_taken') : t('orgNew.no_domain')}</Description>
          ) : null}
          <SelectField label={t('orgNew.field.domain_role')} value={draft.domainRole} onChange={(e) => set('domainRole', e.target.value as OrgRole)} data-testid="org-new-domain-role" disabled={!ready || !selectedDomain || claimChanged}>
            {ORG_ROLES.map((r) => <option key={r} value={r}>{t(`org.role.${r}`)} — {t(`org.role.${r}_help`)}</option>)}
          </SelectField>
        </OrgSection>

        {serverError && <Alert role="alert" $tone="error" data-testid="org-new-error">{serverError}</Alert>}

        <OrgActions>
          <Button type="submit" variant="contained" loading={saving} disabled={!ready || claimChanged} data-testid="org-new-submit">{t('orgNew.submit')}</Button>
          <StyledLink to="/org">{t('orgs.title')}</StyledLink>
        </OrgActions>
      </OrgForm>
    </PageWrapper>
  );
}
