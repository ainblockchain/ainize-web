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
import { useLocation, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import { useCreateLinkedAgentMutation, useLinkedAgentQuery, useUpdateLinkedAgentMutation } from '@/api/api';
import {
  linkedAgentApiErrorOf, linkedAgentDraftFromView, linkedAgentFormProblems, linkedAgentIdFromName, linkedAgentInputFromDraft,
  parseLinkedAgentResponse, type LinkedAgentFormDraft, type LinkedAgentFormField,
} from '@/api/linkedAgents';
import { useAuth } from '@/auth/AuthContext';
import { SharingFields } from '@/components/agent/SharingFields';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, HelperText, Input, Textarea } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { useShareableOrgs } from '@/hooks/useShareableOrgs';

const AgentLinkForm = styled.form`display: flex; flex-direction: column; gap: 24px; margin-top: 8px; max-width: 760px;`;
const AgentLinkSection = styled.section`
  display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; background: #fff;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;
const AgentLinkTwoCol = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;`;
const AgentLinkActions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;

const EMPTY: LinkedAgentFormDraft = { id: '', name: '', description: '', upstream: '', visibility: 'public', orgId: null };

export default function AgentLinkPage() {
  const { t } = useT();
  const auth = useAuth();
  const shareable = useShareableOrgs();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams<{ id: string }>();
  const editing = !!editId;
  useTitle(t(editing ? 'agentLink.title_edit' : 'agentLink.title'));

  const stored = useLinkedAgentQuery(editId ?? '', { skip: !editing || !auth.isSignedIn });
  const storedView = useMemo(() => parseLinkedAgentResponse(stored.data), [stored.data]);

  // `?org=<id>` (the organization page's "share an agent" door): start shared with that organization.
  const presetOrg = new URLSearchParams(location.search).get('org');
  const [draft, setDraft] = useState<LinkedAgentFormDraft>(() => (presetOrg && !editing ? { ...EMPTY, visibility: 'org', orgId: presetOrg } : EMPTY));
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

  const problems = useMemo(() => linkedAgentFormProblems(draft, shareable.orgs), [draft, shareable.orgs]);
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

        <AgentLinkSection>
          <h2>{t('agentLink.section.sharing')}</h2>
          <SharingFields
            visibility={draft.visibility} orgId={draft.orgId} orgs={shareable.orgs} activeOrg={shareable.activeOrg}
            onChange={(next) => setDraft((d) => ({ ...d, ...next }))} problemKey={problemFor('orgId')?.key ?? null} idPrefix="agent-link"
          />
          <HelperText>{t('sharing.wire_note')}</HelperText>
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
