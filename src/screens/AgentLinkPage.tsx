/**
 * Register an external A2A agent by URL — or change one you registered. `/agent/link` and `/agent/<id>/link`, one form.
 *
 * The node does not run what this form describes (that is `AgentCreatePage`, for agents built on a model). It gives
 * the agent a public address under `/agents/<id>`, lists it in the catalogue and forwards calls to `upstream`
 * (ainize-node linked-agents design). This is the door through which an agent that lives anywhere reaches the
 * catalogue — and, through the catalogue, AIN Teams, which imports every agent it shows from here.
 *
 * Signing in with an AIN account is enough: a URL is not a node resource, so the wallet the hosted form asks for is
 * not asked for here. Everything that decides — the id rule, the URL rule, the body, the refusal codes — is in
 * `src/api/linkedAgents.ts`, pure and tested; this file is the form around it.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useCreateLinkedAgentMutation, useLinkedAgentQuery, useMyOrgsQuery, useOrgQuery, useUpdateLinkedAgentMutation } from '@/api/api';
import { parseOrgList, parseOrgProfile, roleAtLeast } from '@/api/organizations';
import {
  linkedAgentApiErrorOf, linkedAgentDraftFromView, linkedAgentFormProblems, linkedAgentIdFromName, linkedAgentInputFromDraft,
  parseLinkedAgentResponse, type LinkedAgentFormDraft, type LinkedAgentFormField,
} from '@/api/linkedAgents';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, HelperText, Input, SelectField, Textarea } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const AgentLinkForm = styled.form`display: flex; flex-direction: column; gap: 24px; margin-top: 8px; max-width: 760px;`;
const AgentLinkSection = styled.section`
  display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; background: #fff;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;
const AgentLinkTwoCol = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;`;
const AgentLinkActions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;

const EMPTY: LinkedAgentFormDraft = { id: '', name: '', description: '', upstream: '', org: null, visibility: 'public', group: null };

export default function AgentLinkPage() {
  const { t } = useT();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams<{ id: string }>();
  const editing = !!editId;
  // `/agent/link?org=comcom` — the organization page's "register an agent here" preselects the organization
  const [search] = useSearchParams();
  const orgFromUrl = search.get('org');
  useTitle(t(editing ? 'agentLink.title_edit' : 'agentLink.title'));

  const stored = useLinkedAgentQuery(editId ?? '', { skip: !editing || !auth.isSignedIn });
  const storedView = useMemo(() => parseLinkedAgentResponse(stored.data), [stored.data]);

  const [draft, setDraft] = useState<LinkedAgentFormDraft>({ ...EMPTY, org: orgFromUrl || null });
  // Organizations the person may register under (contributor or above), and the chosen one's resource groups.
  const orgsRaw = useMyOrgsQuery(undefined, { skip: !auth.isSignedIn });
  const registrable = useMemo(() => parseOrgList(orgsRaw.data).orgs.filter((o) => roleAtLeast(o.my_role, 'contributor')), [orgsRaw.data]);
  const orgRaw = useOrgQuery(draft.org ?? '', { skip: !draft.org || !auth.isSignedIn });
  const orgProfile = useMemo(() => parseOrgProfile(orgRaw.data), [orgRaw.data]);
  const [idTouched, setIdTouched] = useState(false);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [create] = useCreateLinkedAgentMutation();
  const [update] = useUpdateLinkedAgentMutation();

  useEffect(() => { if (storedView) setDraft(linkedAgentDraftFromView(storedView)); }, [storedView]);

  const set = <K extends keyof LinkedAgentFormDraft>(k: K, v: LinkedAgentFormDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  // The id follows the name until the person types an id of their own — the same courtesy the hosted form does.
  const setName = (name: string) => setDraft((d) => ({ ...d, name, ...(editing || idTouched ? {} : { id: linkedAgentIdFromName(name) }) }));

  const problems = useMemo(() => linkedAgentFormProblems(draft), [draft]);
  const problemFor = (f: LinkedAgentFormField) => (touched ? problems.find((p) => p.field === f) : undefined);

  const submit = async () => {
    setTouched(true);
    setServerError(null);
    if (problems.length) return;
    setSaving(true);
    try {
      const body = linkedAgentInputFromDraft(draft);
      const answer = editing ? await update(body).unwrap() : await create(body).unwrap();
      const view = parseLinkedAgentResponse(answer);
      const name = view?.name ?? body.name ?? body.id;
      const note = view?.reachable === false
        ? t('agentLink.done.unreachable', { name, why: view.error ?? 'no card' })
        : t('agentLink.done.reachable', { name });
      navigate(`/agent/${encodeURIComponent(body.id)}`, { state: { linkedNote: note } });
    } catch (err) {
      const e = linkedAgentApiErrorOf(err);
      setServerError(e.message ? `${t(`agentLink.api.${e.code}`)} — ${e.message}` : t(`agentLink.api.${e.code}`));
    } finally {
      setSaving(false);
    }
  };

  if (auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;

  if (!auth.isSignedIn) {
    const next = `${location.pathname}${location.search}`;
    return (
      <PageWrapper>
        <TitleRow><Title>{t(editing ? 'agentLink.title_edit' : 'agentLink.title')}</Title></TitleRow>
        <Empty data-testid="agent-link-signin">
          <Description style={{ margin: '0 auto 16px' }}>{t('agentLink.signin.body')}</Description>
          <StyledLink to={`/signing?next=${encodeURIComponent(next)}`}>{t('agentLink.signin.cta')}</StyledLink>
        </Empty>
      </PageWrapper>
    );
  }

  if (editing && stored.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (editing && (stored.error || !storedView)) {
    const e = stored.error ? linkedAgentApiErrorOf(stored.error) : null;
    return (
      <PageWrapper>
        <TitleRow><Title>{t('agentLink.title_edit')}</Title></TitleRow>
        <Empty data-testid="agent-link-unavailable">
          {e ? t(`agentLink.api.${e.code}`) : t('agentLink.edit.unreadable', { id: editId ?? '' })}{' '}
          <StyledLink to={`/agent/${encodeURIComponent(editId ?? '')}`}>{t('agentLink.edit.back')}</StyledLink>
        </Empty>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <TitleRow><Title>{t(editing ? 'agentLink.title_edit' : 'agentLink.title')}</Title></TitleRow>
      <Description>{t('agentLink.lede')}</Description>

      <AgentLinkForm onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate data-testid="agent-link-form">
        <AgentLinkSection>
          <h2>{t('agentLink.section.address')}</h2>
          <Field>
            <FieldLabel htmlFor="agent-link-upstream">{t('agentLink.field.upstream')}</FieldLabel>
            <Input id="agent-link-upstream" value={draft.upstream} placeholder="https://agent.example.com" inputMode="url" autoComplete="off"
              onChange={(e) => set('upstream', e.target.value)} data-testid="agent-link-upstream" />
            <HelperText $error={!!problemFor('upstream')}>{problemFor('upstream') ? t(problemFor('upstream')!.key) : t('agentLink.field.upstream_help')}</HelperText>
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-link-id">{t('agentLink.field.id')}</FieldLabel>
            <Input id="agent-link-id" value={draft.id} maxLength={40} readOnly={editing} disabled={editing} data-testid="agent-link-id"
              onChange={(e) => { setIdTouched(true); set('id', e.target.value.toLowerCase()); }} />
            <HelperText $error={!!problemFor('id')}>
              {problemFor('id') ? t(problemFor('id')!.key) : editing ? t('agentLink.field.id_fixed') : t('agentLink.field.id_help', { id: draft.id || 'my-agent' })}
            </HelperText>
          </Field>
        </AgentLinkSection>

        <AgentLinkSection>
          <h2>{t('agentLink.section.listing')}</h2>
          <AgentLinkTwoCol>
            <Field>
              <FieldLabel htmlFor="agent-link-name">{t('agentLink.field.name')}</FieldLabel>
              <Input id="agent-link-name" value={draft.name} maxLength={80} onChange={(e) => setName(e.target.value)} data-testid="agent-link-name" />
              <HelperText $error={!!problemFor('name')}>{problemFor('name') ? t(problemFor('name')!.key) : t('agentLink.field.name_help')}</HelperText>
            </Field>
          </AgentLinkTwoCol>
          <Field>
            <FieldLabel htmlFor="agent-link-description">{t('agentLink.field.description')}</FieldLabel>
            <Textarea id="agent-link-description" value={draft.description} maxLength={500} style={{ minHeight: 64 }}
              onChange={(e) => set('description', e.target.value)} />
            <HelperText $error={!!problemFor('description')}>{problemFor('description') ? t(problemFor('description')!.key) : t('agentLink.field.description_help')}</HelperText>
          </Field>
        </AgentLinkSection>

        <AgentLinkSection data-testid="agent-link-org-section">
          <h2>{t('agentLink.section.org')}</h2>
          <SelectField label={t('agentLink.field.org')} helper={t('agentLink.field.org_help')} value={draft.org ?? ''} data-testid="agent-link-org"
            onChange={(e) => setDraft((d) => ({ ...d, org: e.target.value || null, group: null }))}>
            <option value="">{t('agentLink.field.org_personal')}</option>
            {registrable.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.id})</option>)}
            {draft.org && !registrable.some((o) => o.id === draft.org) && <option value={draft.org}>{draft.org}</option>}
          </SelectField>
          {draft.org && (
            <AgentLinkTwoCol>
              <SelectField label={t('agentLink.field.visibility')} helper={t('org.private_help')} value={draft.visibility} data-testid="agent-link-visibility"
                onChange={(e) => set('visibility', e.target.value === 'private' ? 'private' : 'public')}>
                <option value="public">{t('org.public')}</option>
                <option value="private">🔒 {t('org.private')}</option>
              </SelectField>
              <SelectField label={t('agentLink.field.group')} helper={t('agentLink.field.group_help')} value={draft.group ?? ''} data-testid="agent-link-group"
                disabled={draft.visibility !== 'private'} onChange={(e) => set('group', e.target.value || null)}>
                <option value="">{t('agentLink.field.group_none')}</option>
                {(orgProfile?.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </SelectField>
            </AgentLinkTwoCol>
          )}
        </AgentLinkSection>

        {serverError && <Alert $tone="error" data-testid="agent-link-error">{serverError}</Alert>}

        <AgentLinkActions>
          <Button type="submit" variant="contained" loading={saving} loadingText={t('agentLink.submitting')} data-testid="agent-link-submit">
            {t(editing ? 'agentLink.submit_edit' : 'agentLink.submit')}
          </Button>
          <StyledLink to="/me/agents">{t('myAgents.title')}</StyledLink>
        </AgentLinkActions>
      </AgentLinkForm>
    </PageWrapper>
  );
}
