/**
 * Build an agent on a model — or change one you built. `/agent/new` and `/agent/<id>/edit`, one form.
 *
 * The node runs what this form describes (ainize-node hosted-agents design): a name and an id, the chat model it
 * talks to, a system prompt, and one of three modes —
 *
 *   • **prompt**  — no code. The model answers with the system prompt in front of the conversation.
 *   • **tools**   — `index.mjs` exports `tools`; the node runs the function-calling loop against the model.
 *   • **handler** — `index.mjs` exports `execute(input, ctx)`, which decides the whole reply.
 *
 * Code runs in a container on the node, never in its process, which is why a node without Docker refuses the two
 * code modes with 501 `docker_unavailable`. The form cannot know that before it asks, so it learns it from the
 * refusal: the code tabs are then disabled with the reason beside them, and a prompt agent is still one click away.
 *
 * Secrets are two steps on purpose. The spec carries only their NAMES and is readable by its owner; each value
 * goes on its own `PUT …/secrets/<name>` after the spec is saved, and is never sent back. In the edit form an empty
 * value therefore means "keep the stored one", and the row says whether one is stored.
 *
 * Everything that decides — the id rule, the body, the refusal codes — is in `src/api/hostedAgents.ts`, pure and
 * tested; this file is the form around it.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  useCreateHostedAgentMutation, useHostedAgentQuery, useModelsQuery, useSetHostedAgentSecretMutation, useUpdateHostedAgentMutation,
} from '@/api/api';
import {
  chatModelsForHostedAgent, HOSTED_AGENT_ENTRY_FILE, HOSTED_AGENT_MODES, hostedAgentApiErrorOf, hostedAgentDraftFromSpec,
  hostedAgentFormProblems, hostedAgentIdFromName, hostedAgentSecretsToSend, hostedAgentSpecInputFromDraft,
  isHostedAgentCodeMode, parseHostedAgentSpecResponse,
  type HostedAgentApiError, type HostedAgentFormDraft, type HostedAgentFormProblem, type HostedAgentMode,
} from '@/api/hostedAgents';
import { parseModelsResponse } from '@/api/models';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select, Textarea } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, Mono, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import {
  HOSTED_AGENT_PACKAGE_JSON_TEMPLATE, hostedAgentCodeTemplateFor, isUntouchedHostedAgentTemplate,
} from './agentCreate/hostedAgentCodeTemplates';

const AgentCreateForm = styled.form`display: flex; flex-direction: column; gap: 24px; margin-top: 8px; max-width: 880px;`;
const AgentCreateSection = styled.section`
  display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; background: #fff;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
`;
const AgentCreateTwoCol = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;`;
const AgentCreateModeTabs = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const AgentCreateModeTab = styled.button<{ $on: boolean }>`
  cursor: pointer; font: inherit; font-size: 13px; padding: 6px 14px; border-radius: 999px; text-align: left;
  border: 1px solid ${(p) => (p.$on ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$on ? '#f4f1ff' : '#fff')}; color: ${(p) => p.theme.color.BLACK};
  &:disabled { cursor: not-allowed; opacity: 0.45; }
`;
/** A plain textarea as a code editor: monospace, no wrapping, tabs kept. No editor dependency for one field. */
const AgentCreateCode = styled.textarea`
  width: 100%; min-height: 380px; padding: 14px; border-radius: 6px; resize: vertical; tab-size: 2;
  font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; line-height: 1.6; white-space: pre; overflow: auto;
  background: #11131a; color: #e6e8ee; border: 1px solid #11131a;
  &:focus { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; }
`;
const AgentCreateFileLabel = styled.div`display: flex; justify-content: space-between; align-items: center; gap: 12px;`;
const AgentCreateSecretRow = styled.div`display: grid; grid-template-columns: minmax(140px, 1fr) minmax(160px, 1.4fr) auto auto; gap: 12px; align-items: end;
  @media (max-width: 640px) { grid-template-columns: 1fr; }
`;
const AgentCreateSecretState = styled.span<{ $set: boolean }>`
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; white-space: nowrap;
  background: ${(p) => (p.$set ? '#e3f4e8' : '#eef1f4')}; color: ${(p) => (p.$set ? '#1c6b34' : '#4a5560')};
`;
const AgentCreateActions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;

const emptyHostedAgentDraft = (model: string): HostedAgentFormDraft => ({
  id: '', name: '', description: '', model, systemPrompt: '', mode: 'prompt', code: '', packageJson: '',
  a2ui: false, allowedHostsText: '', secrets: [],
});

export default function AgentCreatePage() {
  const { t } = useT();
  const { id: editId } = useParams();
  const editing = !!editId;
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  useTitle(editing ? t('agentCreate.title_edit') : t('agentCreate.title'));

  const prefilledModel = params.get('model') ?? '';
  const modelsQuery = useModelsQuery();
  const modelOptions = useMemo(
    () => chatModelsForHostedAgent(parseModelsResponse(modelsQuery.data), prefilledModel || null),
    [modelsQuery.data, prefilledModel],
  );

  const stored = useHostedAgentQuery(editId ?? '', { skip: !editing || !auth.subject });
  const storedSpec = useMemo(() => parseHostedAgentSpecResponse(stored.data), [stored.data]);

  const [draft, setDraft] = useState<HostedAgentFormDraft>(() => emptyHostedAgentDraft(prefilledModel));
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null);
  const [idTouched, setIdTouched] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [apiError, setApiError] = useState<HostedAgentApiError | null>(null);
  const [dockerUnavailable, setDockerUnavailable] = useState(false);
  const [secretFailures, setSecretFailures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [createAgent] = useCreateHostedAgentMutation();
  const [updateAgent] = useUpdateHostedAgentMutation();
  const [setSecret] = useSetHostedAgentSecretMutation();

  // The edit form is filled ONCE from the stored spec. Refilling on every refetch would erase what is being typed.
  useEffect(() => {
    if (editing && storedSpec && loadedFrom !== storedSpec.id) {
      setDraft(hostedAgentDraftFromSpec(storedSpec));
      setLoadedFrom(storedSpec.id);
    }
  }, [editing, storedSpec, loadedFrom]);

  // No model chosen and none prefilled: the first answering chat model is the sensible default.
  useEffect(() => {
    if (!editing && !draft.model && modelOptions.length) {
      const first = modelOptions.find((m) => m.available) ?? modelOptions[0];
      setDraft((d) => (d.model ? d : { ...d, model: first.id }));
    }
  }, [editing, draft.model, modelOptions]);

  const problems = useMemo(() => hostedAgentFormProblems(draft), [draft]);
  const problemFor = (field: HostedAgentFormProblem['field']) => (showProblems ? problems.find((p) => p.field === field) : undefined);
  const set = <K extends keyof HostedAgentFormDraft>(key: K, value: HostedAgentFormDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const setName = (name: string) => setDraft((d) => ({ ...d, name, id: editing || idTouched ? d.id : hostedAgentIdFromName(name) }));

  /** Switching mode swaps in that mode's template — but only over a template nobody has edited yet. */
  const setMode = (mode: HostedAgentMode) => setDraft((d) => ({
    ...d, mode,
    code: isHostedAgentCodeMode(mode) && isUntouchedHostedAgentTemplate(d.code) ? hostedAgentCodeTemplateFor(mode) : d.code,
    a2ui: mode === 'handler' && !isHostedAgentCodeMode(d.mode) && !d.a2ui ? true : d.a2ui,
  }));

  const submit = async () => {
    setShowProblems(true);
    setApiError(null);
    setSecretFailures([]);
    if (problems.length) return;
    setSaving(true);
    try {
      const body = hostedAgentSpecInputFromDraft(draft);
      try {
        await (editing ? updateAgent(body) : createAgent(body)).unwrap();
      } catch (err) {
        const e = hostedAgentApiErrorOf(err);
        if (e.code === 'docker_unavailable') setDockerUnavailable(true);
        setApiError(e);
        return;
      }
      const failed: string[] = [];
      for (const s of hostedAgentSecretsToSend(draft)) {
        try { await setSecret({ id: body.id, name: s.name, value: s.value }).unwrap(); } catch { failed.push(s.name); }
      }
      if (failed.length) { setSecretFailures(failed); return; }
      navigate(`/agent/${encodeURIComponent(body.id)}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── states before the form

  if (auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;

  if (!auth.subject) {
    const next = `${location.pathname}${location.search}`;
    return (
      <PageWrapper>
        <TitleRow><Title>{editing ? t('agentCreate.title_edit') : t('agentCreate.title')}</Title></TitleRow>
        <Empty data-testid="agent-create-signin">
          <Description style={{ margin: '0 auto 16px' }}>{t('agentCreate.signin.body')}</Description>
          <StyledLink to={`/signing?next=${encodeURIComponent(next)}`}>{t('agentCreate.signin.cta')}</StyledLink>
        </Empty>
      </PageWrapper>
    );
  }

  if (editing && stored.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (editing && (stored.error || !storedSpec)) {
    const e = stored.error ? hostedAgentApiErrorOf(stored.error) : null;
    const key = e?.code === 'forbidden' ? 'agentCreate.edit.forbidden' : e?.code === 'not_found' ? 'agentCreate.edit.not_found' : 'agentCreate.edit.unreadable';
    return (
      <PageWrapper>
        <TitleRow><Title>{t('agentCreate.title_edit')}</Title></TitleRow>
        <Empty data-testid="agent-edit-unavailable">
          {t(key, { id: editId ?? '' })}{' '}
          <StyledLink to={`/agent/${encodeURIComponent(editId ?? '')}`}>{t('agentCreate.edit.back')}</StyledLink>
        </Empty>
      </PageWrapper>
    );
  }

  const code = isHostedAgentCodeMode(draft.mode);
  const selectedModel = modelOptions.find((m) => m.id === draft.model);

  return (
    <PageWrapper>
      <TitleRow><Title>{editing ? t('agentCreate.title_edit') : t('agentCreate.title')}</Title></TitleRow>
      <Description>{t('agentCreate.lede')}</Description>

      <AgentCreateForm onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate data-testid="agent-create-form">
        <AgentCreateSection>
          <h2>{t('agentCreate.section.identity')}</h2>
          <AgentCreateTwoCol>
            <Field>
              <FieldLabel htmlFor="agent-create-name">{t('agentCreate.field.name')}</FieldLabel>
              <Input id="agent-create-name" value={draft.name} maxLength={80} onChange={(e) => setName(e.target.value)} data-testid="agent-create-name" />
              {problemFor('name') && <HelperText $error>{t(problemFor('name')!.key)}</HelperText>}
            </Field>
            <Field>
              <FieldLabel htmlFor="agent-create-id">{t('agentCreate.field.id')}</FieldLabel>
              <Input
                id="agent-create-id" value={draft.id} maxLength={40} readOnly={editing} disabled={editing} data-testid="agent-create-id"
                onChange={(e) => { setIdTouched(true); set('id', e.target.value.toLowerCase()); }}
              />
              <HelperText $error={!!problemFor('id')}>
                {problemFor('id') ? t(problemFor('id')!.key) : editing ? t('agentCreate.field.id_fixed') : t('agentCreate.field.id_help', { id: draft.id || 'my-agent' })}
              </HelperText>
            </Field>
          </AgentCreateTwoCol>
          <Field>
            <FieldLabel htmlFor="agent-create-description">{t('agentCreate.field.description')}</FieldLabel>
            <Textarea id="agent-create-description" value={draft.description} maxLength={500} style={{ minHeight: 64 }}
              onChange={(e) => set('description', e.target.value)} />
            {problemFor('description') && <HelperText $error>{t(problemFor('description')!.key)}</HelperText>}
          </Field>
          <Field>
            <FieldLabel htmlFor="agent-create-model">{t('agentCreate.field.model')}</FieldLabel>
            <Select id="agent-create-model" value={draft.model} onChange={(e) => set('model', e.target.value)} data-testid="agent-create-model">
              {!draft.model && <option value="">{t('agentCreate.field.model_pick')}</option>}
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.id}{m.available ? '' : ` — ${t('models.unavailable')}`}</option>
              ))}
            </Select>
            <HelperText $error={!!problemFor('model')}>
              {problemFor('model') ? t(problemFor('model')!.key)
                : modelOptions.length === 0 ? t('agentCreate.field.model_none')
                  : selectedModel && !selectedModel.available ? t('agentCreate.field.model_down')
                    : <>{t('agentCreate.field.model_help')} {draft.model && <StyledLink to={`/models/${encodeURIComponent(draft.model)}`}>{t('agentCreate.field.model_link')}</StyledLink>}</>}
            </HelperText>
          </Field>
        </AgentCreateSection>

        <AgentCreateSection>
          <h2>{t('agentCreate.section.behaviour')}</h2>
          <Field>
            <FieldLabel htmlFor="agent-create-prompt">{t('agentCreate.field.system_prompt')}</FieldLabel>
            <Textarea id="agent-create-prompt" value={draft.systemPrompt} maxLength={8000} style={{ minHeight: 140 }} data-testid="agent-create-prompt"
              placeholder={t('agentCreate.field.system_prompt_placeholder')} onChange={(e) => set('systemPrompt', e.target.value)} />
            <HelperText $error={!!problemFor('systemPrompt')}>
              {problemFor('systemPrompt') ? t(problemFor('systemPrompt')!.key) : t(`agentCreate.mode.${draft.mode}.prompt_help`)}
            </HelperText>
          </Field>

          <Field>
            <FieldLabel as="div">{t('agentCreate.field.mode')}</FieldLabel>
            <AgentCreateModeTabs role="tablist">
              {HOSTED_AGENT_MODES.map((mode) => (
                <AgentCreateModeTab
                  key={mode} type="button" role="tab" aria-selected={draft.mode === mode} $on={draft.mode === mode}
                  disabled={dockerUnavailable && isHostedAgentCodeMode(mode)} data-testid={`agent-create-mode-${mode}`}
                  onClick={() => setMode(mode)}
                >
                  <b>{t(`agentCreate.mode.${mode}`)}</b>
                </AgentCreateModeTab>
              ))}
            </AgentCreateModeTabs>
            <HelperText>{t(`agentCreate.mode.${draft.mode}.help`)}</HelperText>
            {dockerUnavailable && <Alert $tone="warning" data-testid="agent-create-docker">{t('agentCreate.docker_unavailable')}</Alert>}
          </Field>

          {code && (
            <>
              <Field>
                <AgentCreateFileLabel>
                  <FieldLabel htmlFor="agent-create-code"><Mono>{HOSTED_AGENT_ENTRY_FILE}</Mono></FieldLabel>
                  <Button type="button" size="small" variant="text" onClick={() => set('code', hostedAgentCodeTemplateFor(draft.mode))}>
                    {t('agentCreate.code.reset')}
                  </Button>
                </AgentCreateFileLabel>
                <AgentCreateCode
                  id="agent-create-code" value={draft.code} spellCheck={false} autoCapitalize="off" autoCorrect="off" data-testid="agent-create-code"
                  onChange={(e) => set('code', e.target.value)}
                  onKeyDown={(e) => {
                    // Tab indents inside the editor instead of leaving it — the one editor key a textarea lacks.
                    if (e.key !== 'Tab' || e.shiftKey) return;
                    e.preventDefault();
                    const el = e.currentTarget;
                    const { selectionStart: s, selectionEnd: end } = el;
                    const next = `${draft.code.slice(0, s)}  ${draft.code.slice(end)}`;
                    set('code', next);
                    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
                  }}
                />
                {problemFor('code') && <HelperText $error>{t(problemFor('code')!.key)}</HelperText>}
                {problemFor('files') && <HelperText $error>{t(problemFor('files')!.key)}</HelperText>}
              </Field>
              <Field>
                <AgentCreateFileLabel>
                  <FieldLabel htmlFor="agent-create-package"><Mono>package.json</Mono> · {t('agentCreate.code.optional')}</FieldLabel>
                  {!draft.packageJson && (
                    <Button type="button" size="small" variant="text" onClick={() => set('packageJson', HOSTED_AGENT_PACKAGE_JSON_TEMPLATE)}>
                      {t('agentCreate.code.add_package')}
                    </Button>
                  )}
                </AgentCreateFileLabel>
                <AgentCreateCode id="agent-create-package" value={draft.packageJson} spellCheck={false} style={{ minHeight: 120 }}
                  placeholder={t('agentCreate.code.package_placeholder')} onChange={(e) => set('packageJson', e.target.value)} />
                <HelperText $error={!!problemFor('packageJson')}>
                  {problemFor('packageJson') ? t(problemFor('packageJson')!.key) : t('agentCreate.code.package_help')}
                </HelperText>
              </Field>
            </>
          )}

          <Checkbox
            label={t('agentCreate.field.a2ui')} checked={draft.a2ui} data-testid="agent-create-a2ui"
            onChange={(e) => set('a2ui', e.target.checked)}
          />
        </AgentCreateSection>

        <AgentCreateSection>
          <h2>{t('agentCreate.section.access')}</h2>
          <Field>
            <FieldLabel htmlFor="agent-create-hosts">{t('agentCreate.field.hosts')}</FieldLabel>
            <Textarea id="agent-create-hosts" value={draft.allowedHostsText} style={{ minHeight: 64, fontFamily: 'monospace' }}
              placeholder={'api.example.com\n*.example.org'} onChange={(e) => set('allowedHostsText', e.target.value)} />
            <HelperText>{t('agentCreate.field.hosts_help')}</HelperText>
          </Field>

          <Field>
            <FieldLabel as="div">{t('agentCreate.field.secrets')}</FieldLabel>
            <HelperText $error={!!problemFor('secrets')}>
              {problemFor('secrets') ? t(problemFor('secrets')!.key) : t('agentCreate.field.secrets_help')}
            </HelperText>
            {draft.secrets.map((s, i) => (
              <AgentCreateSecretRow key={i}>
                <Input aria-label={t('agentCreate.secret.name')} placeholder="API_KEY" value={s.name} readOnly={s.set}
                  onChange={(e) => set('secrets', draft.secrets.map((x, j) => (j === i ? { ...x, name: e.target.value.toUpperCase() } : x)))} />
                <Input aria-label={t('agentCreate.secret.value')} type="password" autoComplete="off" value={s.value}
                  placeholder={s.set ? t('agentCreate.secret.keep') : t('agentCreate.secret.value')}
                  onChange={(e) => set('secrets', draft.secrets.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <AgentCreateSecretState $set={s.set}>{s.set ? t('agentCreate.secret.set') : t('agentCreate.secret.unset')}</AgentCreateSecretState>
                <Button type="button" size="small" variant="text" onClick={() => set('secrets', draft.secrets.filter((_, j) => j !== i))}>
                  {t('agentCreate.secret.remove')}
                </Button>
              </AgentCreateSecretRow>
            ))}
            <div>
              <Button type="button" size="small" onClick={() => set('secrets', [...draft.secrets, { name: '', value: '', set: false }])}>
                {t('agentCreate.secret.add')}
              </Button>
            </div>
          </Field>
        </AgentCreateSection>

        {apiError && (
          <Alert $tone="error" data-testid="agent-create-error">
            <b>{t(`agentCreate.api.${apiError.code}`)}</b>
            {apiError.message ? <> — {apiError.message}</> : null}
          </Alert>
        )}
        {secretFailures.length > 0 && (
          <Alert $tone="warning" data-testid="agent-create-secret-failed">
            {t('agentCreate.secret.failed', { names: secretFailures.join(', ') })}{' '}
            <Link to={`/agent/${encodeURIComponent(draft.id)}`}>{t('agentCreate.secret.continue')}</Link>
          </Alert>
        )}
        {showProblems && problems.length > 0 && <Alert $tone="error">{t('agentCreate.err.fix_fields')}</Alert>}

        <AgentCreateActions>
          <Button type="submit" variant="contained" size="large" loading={saving} data-testid="agent-create-submit">
            {editing ? t('agentCreate.save') : t('agentCreate.submit')}
          </Button>
          <Button type="button" variant="text" onClick={() => navigate(-1)}>{t('agentCreate.cancel')}</Button>
        </AgentCreateActions>
      </AgentCreateForm>
    </PageWrapper>
  );
}
