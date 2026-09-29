/**
 * `/org/new` — make an organization. Id, name, description, README, and who gets in: the one domain the node lets
 * this person claim is their own sign-in's, so the form offers exactly that as a checkbox rather than a text field
 * (a text field would invite typing `comcom.ai` and being refused). Everything that decides is in
 * `src/api/organizations.ts`.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useCreateOrgMutation, useMyOrgsQuery } from '@/api/api';
import {
  ORG_ROLES, emailDomain, orgApiErrorOf, orgCreateInputFromDraft, orgFormProblems, orgIdFromName, parseOrgList, parseOrgProfile,
  type OrgFormDraft, type OrgFormField, type OrgRole,
} from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, SelectField, Textarea } from '@/components/ui/Form';
import { Description, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const OrgForm = styled.form`display: flex; flex-direction: column; gap: 24px; margin-top: 8px; max-width: 760px;`;
const OrgSection = styled.section`
  display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; background: #fff;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;
const OrgActions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;

const EMPTY: OrgFormDraft = { id: '', name: '', description: '', readme: '', claimDomain: true, domainRole: 'write' };

export default function OrgCreatePage() {
  const { t } = useT();
  useTitle(t('orgNew.title'));
  const navigate = useNavigate();
  const { sso } = useAuth();
  const domain = useMemo(() => emailDomain(sso?.email), [sso?.email]);
  const { data: listRaw } = useMyOrgsQuery();
  const domainTaken = useMemo(() => parseOrgList(listRaw).domain_org, [listRaw]);
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
  const canClaim = !!domain && !domainTaken;

  const submit = async () => {
    setTouched(true);
    setServerError(null);
    if (problems.length) return;
    setSaving(true);
    try {
      const body = orgCreateInputFromDraft(draft, canClaim ? domain : null);
      const answer = await create(body).unwrap();
      const org = parseOrgProfile(answer);
      navigate(`/org/${encodeURIComponent(org?.id ?? body.id)}`);
    } catch (err) {
      const e = orgApiErrorOf(err);
      setServerError(e.message ? `${t(`org.api.${e.code}`)} — ${e.message}` : t(`org.api.${e.code}`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageWrapper>
      <TitleRow><Title>{t('orgNew.title')}</Title></TitleRow>
      <Description>{t('orgNew.lede')}</Description>

      <OrgForm onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate data-testid="org-new-form">
        <OrgSection>
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

        <OrgSection>
          <h2>{t('orgNew.section.who')}</h2>
          {canClaim ? (
            <>
              <Checkbox label={t('orgNew.claim_domain', { domain })} checked={draft.claimDomain} onChange={(e) => set('claimDomain', e.target.checked)} data-testid="org-new-claim" />
              <HelperText>{t('orgNew.claim_domain_help')}</HelperText>
            </>
          ) : (
            <Description style={{ margin: 0 }}>{domain ? t('orgs.create_for_domain', { domain }).replace(/—.*$/, '') && t('org.api.domain_taken') : t('orgNew.no_domain')}</Description>
          )}
          <SelectField label={t('orgNew.field.domain_role')} value={draft.domainRole} onChange={(e) => set('domainRole', e.target.value as OrgRole)} data-testid="org-new-domain-role" disabled={!canClaim || !draft.claimDomain}>
            {ORG_ROLES.map((r) => <option key={r} value={r}>{t(`org.role.${r}`)} — {t(`org.role.${r}_help`)}</option>)}
          </SelectField>
        </OrgSection>

        {serverError && <Alert $tone="error" data-testid="org-new-error">{serverError}</Alert>}

        <OrgActions>
          <Button type="submit" variant="contained" loading={saving} data-testid="org-new-submit">{t('orgNew.submit')}</Button>
          <StyledLink to="/org">{t('orgs.title')}</StyledLink>
        </OrgActions>
      </OrgForm>
    </PageWrapper>
  );
}
