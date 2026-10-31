/**
 * One model: what it is, a place to press it, the code to take away — and the agents built on it.
 *
 * `/models/<id>`. The list (`/models`) links here; so does every hosted agent's page, which names the model it is
 * built on. The page is where a model becomes an agent: **Create agent based on this model** opens the create form
 * with this model already chosen. Only a chat model has the button, because the agent runtime talks to its model as
 * a chat — a speech-to-text model cannot be given a system prompt.
 *
 * Signing in comes first when it is needed, and it comes back: the button sends a signed-out visitor through the
 * wallet sign-in (`/signing?next=…`) with the create form as the place to return to. A Google-only session is not
 * enough — an agent has an owner, and an owner is an address — so the check is `subject`, not `isSignedIn`.
 *
 * Three ways this page can have nothing to show, each said as itself (see `modelDetailViewState`): the node does
 * not serve this id, the node is older than the model routes, or the node is not answering at all.
 */
import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useAgentsByModelQuery, useModelDetailQuery, useModelsQuery, useNetworkModelsQuery, useThroughputQuoteQuery } from '@/api/api';
import { networkModelCatalogue, networkModelHref, networkProviderLabel, readNetworkModelsResponse, selectNetworkModel } from '@/api/networkModels';
import { billingView } from '@/lib/billingView';
import { confirmModelTarget } from '@/api/modelTarget';
import { agentsBuiltOnModel, readModelAgentList } from '@/api/hostedAgents';
import { agentListKey } from '@/api/sharedAgents';
import { harnessForModel } from '@/api/modelHarness';
import { modelDetailViewState, modelsFetchState, readModelsResponse } from '@/api/models';
import { useAuth } from '@/auth/AuthContext';
import { AgentListItem } from '@/components/public/AgentListItem';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, Mono, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { ModelPlaygroundPanel } from './models/ModelPlaygroundPanel';
import { MODEL_SPEED_QUOTE_SAIN, modelSpeedBillingHref, modelSpeedFactOf } from './models/modelSpeedHints';

const ModelDetailBack = styled(Link)`
  display: inline-block; margin: -8px 0 16px; font-size: 13px; color: ${(p) => p.theme.color.GREY};
  text-decoration: none; &:hover { color: ${(p) => p.theme.color.PRIMARY}; text-decoration: underline; }
`;
const ModelDetailFacts = styled.dl`
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px 24px; margin: 16px 0 8px;
  div { min-width: 0; }
  dt { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: ${(p) => p.theme.color.GREY}; }
  dd { margin: 2px 0 0; font-size: 13px; color: ${(p) => p.theme.color.BLACK}; overflow-wrap: anywhere; }
`;
const ModelDetailDot = styled.span<{ $up: boolean }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$up ? '#1ea672' : '#c2c6cf')};
`;
const ModelDetailCreateRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 20px 0 8px;`;
const ModelDetailSmall = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
/** Busy is not down: amber, not the grey of "unavailable" — the model answers, free requests just wait. */
const ModelDetailSpeedDot = styled.span<{ $busy: boolean }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$busy ? '#e8a317' : '#1ea672')};
`;
/** Quiet while idle (a deposit changes nothing then), the way in while free requests are waiting. */
const ModelDetailSpeedLink = styled(StyledLink)<{ $busy: boolean }>`
  display: inline-block; margin-top: 4px; font-size: ${(p) => (p.$busy ? '13px' : '12px')}; font-weight: ${(p) => (p.$busy ? 600 : 400)};
  color: ${(p) => (p.$busy ? p.theme.color.PRIMARY : p.theme.color.GREY)};
`;
const ModelDetailAgents = styled.div`margin-top: 12px;`;
const ModelDetailHarness = styled.section`
  margin: 28px 0 8px; padding: 16px 20px; border: 1px solid #e2e4ea; border-radius: 12px;
  pre { margin: 8px 0 0; padding: 10px 12px; border-radius: 8px; background: #11131a; color: #e8eaf0; font-size: 12.5px; overflow-x: auto; }
`;
const ModelDetailHarnessOpen = styled.a`
  display: inline-block; margin-top: 12px; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 600;
  background: ${(p) => p.theme.color.PRIMARY}; color: #fff; text-decoration: none; &:hover { opacity: .9; }
`;
const ModelDetailProviders = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 18px 0 4px;
  span { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY}; margin-right: 4px; }
`;
const ModelDetailProvider = styled(Link)<{ $selected: boolean }>`
  max-width: 100%; overflow-wrap: anywhere;
  font-size: 13px; padding: 4px 12px; border-radius: 999px; text-decoration: none;
  border: 1px solid ${(p) => (p.$selected ? p.theme.color.PRIMARY : '#e2e4ea')};
  background: ${(p) => (p.$selected ? p.theme.color.PALE_GREY : '#fff')};
  color: ${(p) => (p.$selected ? p.theme.color.PRIMARY : p.theme.color.BLACK)};
`;

export default function ModelDetailPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  useTitle(id || t('models.title'));

  const detail = useModelDetailQuery(id, { skip: !id, pollingInterval: 15_000, refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true });
  // Same arguments as the playground's, so the two share one request (and one poll). Busy/idle changes by the
  // second, so it is re-read; 15 s is often enough to see a queue form without polling a page nobody watches.
  const throughputQuery = useThroughputQuoteQuery({ model: id, identity: auth.cacheIdentity, token: 'sAIN', amount: MODEL_SPEED_QUOTE_SAIN }, { skip: !id, pollingInterval: 15_000 });
  const list = useModelsQuery(undefined, { pollingInterval: 15_000, refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true });
  const ownView = modelDetailViewState({
    id,
    detail: detail.currentData, detailError: detail.error as never, detailLoading: detail.isLoading,
    list: list.currentData, listError: list.error as never, listLoading: list.isLoading,
  });
  // The model as the network has it: which nodes serve this id, and which one this page drives (`?node=`).
  const [params] = useSearchParams();
  const network = useNetworkModelsQuery(undefined, { pollingInterval: 60_000, refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true });
  const ownRead = !list.isError ? readModelsResponse(list.currentData) : null;
  const networkRead = !network.isError ? readNetworkModelsResponse(network.currentData, auth.address) : null;
  const catalogue = networkModelCatalogue(ownRead?.models ?? (ownView.kind === 'ok' ? [ownView.model] : []), networkRead?.models ?? [], auth.address);
  const selectedNode = params.get('node'), selectedModality = params.get('modality');
  const selection = selectNetworkModel(catalogue, id, selectedNode, selectedModality);
  const netModel = selection.kind === 'ok' ? selection.model : null;
  const provider = selection.kind === 'ok' ? selection.provider : null;
  const onPeer = !!provider && !provider.local;
  // A pinned provider is never replaced by a local/default provider, including during failed refreshes.
  const view = selection.kind === 'ambiguous' ? { kind: 'ambiguous' as const }
    : provider && netModel ? provider.local
      ? ownView.kind === 'ok' ? ownView.model.modality !== netModel.modality ? { kind: 'ambiguous' as const }
        : { ...ownView, model: { ...ownView.model, available: ownView.model.available && provider.available,
          availabilityKnown: ownView.model.availabilityKnown !== false && provider.availabilityKnown !== false } } : ownView
      : { kind: 'ok' as const, model: { id, modality: netModel.modality, available: provider.available, availabilityKnown: provider.availabilityKnown, agents: null } }
    : network.isLoading || ownView.kind === 'loading' ? { kind: 'loading' as const }
    : selectedNode !== null || selectedModality !== null ? { kind: 'provider_missing' as const }
    : !networkRead && modelsFetchState(network.error as never) !== 'outdated'
      ? { kind: network.isError ? 'offline' as const : 'invalid' as const } : ownView.kind === 'ok' ? { kind: 'invalid' as const } : ownView;
  const served = view.kind === 'ok';
  // Direct links without a provider resolve once and become explicit before Run is enabled.
  const targetResolved = selectedNode !== null && selectedModality !== null;
  const providerIdentityKnown = !!provider?.node.address && (!provider.local || provider.node.address.toLowerCase() === auth.address?.toLowerCase());
  const targetReady = targetResolved && providerIdentityKnown;
  useEffect(() => {
    if (served && netModel && provider && !targetResolved) navigate(networkModelHref(netModel, provider), { replace: true });
  }, [served, id, provider?.ref, netModel?.modality, targetResolved, navigate]);
  const refreshModels = () => { void detail.refetch(); void list.refetch(); void network.refetch(); if (!auth.address) void auth.refresh(); };
  const agentsQuery = useAgentsByModelQuery(id, { skip: !served, pollingInterval: 60_000 });
  const agentList = useMemo(() => agentsQuery.isError ? null : readModelAgentList(agentsQuery.currentData), [agentsQuery.currentData, agentsQuery.isError]);
  const agents = useMemo(() => agentsBuiltOnModel(agentList, provider?.ref ?? id, auth.address ?? (provider?.local ? provider.node.address : null)), [agentList, id, provider?.ref, provider?.local, provider?.node.address, auth.address]);
  const agentsFailed = !agentsQuery.isFetching && agentList === null;

  const here = `/models/${encodeURIComponent(id)}`;
  const createPath = `/agent/new?model=${encodeURIComponent(provider?.ref ?? id)}`;

  /** Sign-in returns to the form with this exact provider selected. */
  const startCreate = () => {
    if (!served || !targetReady || !view.model.available) return;
    if (auth.isSignedIn) navigate(createPath);
    else navigate(`/signing?next=${encodeURIComponent(createPath)}`);
  };

  if (view.kind === 'loading') return <PageWrapper><CenterProgress /></PageWrapper>;

  if (view.kind !== 'ok') {
    const [title, body] = view.kind === 'offline'
      ? ['models.offline.title', 'models.offline.body']
      : view.kind === 'provider_missing' ? ['modelDetail.provider_missing.title', 'modelDetail.provider_missing.body']
      : view.kind === 'ambiguous' ? ['modelDetail.ambiguous.title', 'modelDetail.ambiguous.body']
      : view.kind === 'invalid' ? ['models.list.invalid', 'models.list.incomplete']
      : view.kind === 'outdated'
        ? ['models.outdated.title', 'models.outdated.body']
        : ['modelDetail.not_served.title', 'modelDetail.not_served.body'];
    return (
      <PageWrapper>
        <TitleRow><Title><Mono>{id}</Mono></Title></TitleRow>
        <ModelDetailBack to="/models">← {t('modelDetail.back')}</ModelDetailBack>
        <Empty data-testid={`model-detail-${view.kind}`}>
          <SubTitle $mt={0}>{t(title)}</SubTitle>
          <Description style={{ margin: '12px auto 0' }}>{t(body, { id })}</Description>
          {selectedNode !== null && <Mono style={{ overflowWrap: 'anywhere' }}>{selectedNode}</Mono>}
          <Button type="button" disabled={detail.isFetching || list.isFetching || network.isFetching} onClick={refreshModels}>{t('models.offline.retry')}</Button>
        </Empty>
      </PageWrapper>
    );
  }

  const { model } = view;
  const isChat = model.modality === 'chat';
  const harness = harnessForModel(model.id);
  const speed = modelSpeedFactOf(throughputQuery.isError || auth.loading ? null : billingView(throughputQuery.currentData, id, auth.subject));

  return (
    <PageWrapper>
      <TitleRow><Title data-testid="model-detail-title">{model.id}</Title></TitleRow>
      <ModelDetailBack to="/models">← {t('modelDetail.back')}</ModelDetailBack>

      {!network.isLoading && !networkRead && modelsFetchState(network.error as never) !== 'outdated' && <Alert role="alert">
        {t('models.list.incomplete')}{' '}<Button size="small" disabled={network.isFetching} onClick={() => void network.refetch()}>{t('models.offline.retry')}</Button>
      </Alert>}
      <ModelDetailFacts>
        <div><dt>{t('modelDetail.fact.id')}</dt><dd><Mono>{model.id}</Mono></dd></div>
        <div><dt>{t('modelDetail.fact.modality')}</dt><dd>{t(`models.modality.${model.modality}`)}</dd></div>
        <div>
          <dt>{t('modelDetail.fact.status')}</dt>
          <dd><ModelDetailDot $up={model.available} />{t(!model.available ? model.availabilityKnown === false ? 'models.status_unknown' : 'models.unavailable' : onPeer ? 'models.advertised' : 'models.available')}</dd>
        </div>
        <div>
          <dt>{t('modelDetail.fact.agents')}</dt>
          {/* Count the list actually shown for this provider, not another provider's or an old public-only total. */}
          <dd data-testid="model-agent-count">{!onPeer && agentList !== null ? agents.length : '—'}</dd>
        </div>
        {/* Speed is a fact about the model, so it sits with the other facts — and says whether it is busy, which is
            the only time a deposit changes anything. An older node without /api/throughput shows no cell. */}
        {/* Speed is this node's; a peer's is its own and not reported here. */}
        {isChat && speed && !onPeer && (
          <div data-testid="model-speed">
            <dt>{t('billing.fact.title')}</dt>
            <dd>
              <ModelDetailSpeedDot $busy={speed.busy} />
              {t(speed.busy ? 'billing.fact.busy' : 'billing.fact.idle', { tokS: speed.tokS })}
              {!speed.measured && <ModelDetailSmall> ({t('billing.fact.estimated')})</ModelDetailSmall>}
              <br />
              <ModelDetailSpeedLink $busy={speed.busy} to={modelSpeedBillingHref(model.id)} data-testid="model-speed-link">
                {t(speed.busy ? 'billing.fact.link_busy' : 'billing.fact.link_idle')}
              </ModelDetailSpeedLink>
            </dd>
          </div>
        )}
      </ModelDetailFacts>

      {/* Who serves it. The same id on two nodes is two models — a different context window, a different queue —
          so the page names the one it drives and lets the reader switch. */}
      {netModel && netModel.providers.some((p) => p.node.address) && (
        <ModelDetailProviders data-testid="model-providers">
          <span>{t('modelDetail.providers')}</span>
          {netModel.providers.map((p) => (
            <ModelDetailProvider
              key={p.node.address}
              to={networkModelHref(netModel, p)}
              $selected={p === provider}
              title={p.node.address}
              data-testid={`model-provider-${p.node.address}`}
            >
              {networkProviderLabel(p)}{p.local ? ` · ${t('modelDetail.provider_here')}` : ''}
            </ModelDetailProvider>
          ))}
        </ModelDetailProviders>
      )}

      {/* An agent is built on a model its node runs itself, so only this node's own model offers it. */}
      {isChat && !onPeer && (
        <ModelDetailCreateRow>
          <Button variant="contained" size="large" data-testid="model-create-agent" disabled={!targetReady || !model.available} onClick={startCreate}>
            {t('modelDetail.create')}
          </Button>
          <ModelDetailSmall>{auth.isSignedIn ? t('modelDetail.create_help') : t('modelDetail.create_signin')}</ModelDetailSmall>
        </ModelDetailCreateRow>
      )}

      {harness && (
        <ModelDetailHarness data-testid="model-harness">
          <SubTitle $mt={0}>{t('modelDetail.harness.title')}</SubTitle>
          <Description>{t('modelDetail.harness.lede', { name: harness.name })}</Description>
          <ModelDetailFacts>
            <div>
              <dt>{t('modelDetail.harness.fact.harness')}</dt>
              <dd><a href={harness.source} target="_blank" rel="noreferrer">{harness.name}</a> {harness.version} · {harness.license}</dd>
            </div>
            <div><dt>{t('modelDetail.harness.fact.sampling')}</dt><dd><Mono>temperature {harness.settings.temperature.toFixed(1)} · top_p {harness.settings.topP.toFixed(1)}</Mono></dd></div>
            <div>
              <dt>{t('modelDetail.harness.fact.reasoning')}</dt>
              <dd>{t('modelDetail.harness.reasoning_value', { effort: harness.settings.reasoningEffort, efforts: harness.settings.reasoningEfforts.join('/') })}</dd>
            </div>
            <div>
              <dt>{t('modelDetail.harness.fact.context')}</dt>
              <dd>{t('modelDetail.harness.context_value', { context: harness.settings.context.toLocaleString('en-US'), compact: harness.settings.compactAt.toLocaleString('en-US') })}</dd>
            </div>
          </ModelDetailFacts>
          <ModelDetailSmall>{t('modelDetail.harness.howto')}</ModelDetailSmall>
          <pre>{`$ ${harness.commands.web}\n$ ${harness.commands.run}`}</pre>
          <ModelDetailHarnessOpen href={harness.openPath} data-testid="model-harness-open">{t('modelDetail.harness.open')} →</ModelDetailHarnessOpen>
        </ModelDetailHarness>
      )}

      {!providerIdentityKnown && <Alert role="alert">{t('agentCreate.field.model_node_unknown')} <Button size="small" onClick={refreshModels}>{t('models.offline.retry')}</Button></Alert>}
      <ModelPlaygroundPanel
        key={`${model.id}:${model.modality}:${provider?.local ? 'local' : provider?.ref ?? ''}`}
        model={model}
        signInNext={netModel && provider ? networkModelHref(netModel, provider) : here}
        targetReady={targetReady}
        confirmTarget={async (current) => {
          if (!provider || !netModel || !targetReady) throw new Error('model_unavailable');
          await confirmModelTarget(model, provider, () => provider.local ? list.refetch().unwrap() : network.refetch().unwrap(), current);
        }}
        callModel={provider?.ref}
        peer={onPeer}
      />

      {!onPeer && <>
      <SubTitle>{t('modelDetail.agents.title')}</SubTitle>
      <Description>{t('modelDetail.agents.lede')}</Description>
      <ModelDetailAgents data-testid="model-agents">
        {agentsQuery.isLoading && <CenterProgress />}
        {agentsFailed && <Alert role="alert" $tone="error">{t('modelDetail.agents.unreadable')} <Button size="small" onClick={() => void agentsQuery.refetch()}>{t('models.offline.retry')}</Button></Alert>}
        {!agentsQuery.isFetching && agentList !== null && agents.length === 0 && (
          <Empty data-testid="model-agents-empty">
            {t('modelDetail.agents.empty')}
            {isChat && <> <Button size="small" variant="text" disabled={!targetReady || !model.available} onClick={startCreate}>{t('modelDetail.agents.empty_cta')}</Button></>}
          </Empty>
        )}
        {agents.map((a) => <AgentListItem key={agentListKey(a)} agent={a} />)}
      </ModelDetailAgents>
      </>}
    </PageWrapper>
  );
}
