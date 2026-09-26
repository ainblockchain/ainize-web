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
import { useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useAgentsByModelQuery, useModelDetailQuery, useModelsQuery, useNetworkModelsQuery, useThroughputQuoteQuery } from '@/api/api';
import { networkModelCatalogue, networkProviderLabel, parseNetworkModelsResponse, pickNetworkModelProvider } from '@/api/networkModels';
import { parseBillingThroughputResponse } from '@/api/billingThroughput';
import { agentsBuiltOnModel } from '@/api/hostedAgents';
import { modelDetailViewState, parseModelsResponse } from '@/api/models';
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
const ModelDetailProviders = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 18px 0 4px;
  span { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY}; margin-right: 4px; }
`;
const ModelDetailProvider = styled(Link)<{ $selected: boolean }>`
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

  const detail = useModelDetailQuery(id, { skip: !id });
  // Same arguments as the playground's, so the two share one request (and one poll). Busy/idle changes by the
  // second, so it is re-read; 15 s is often enough to see a queue form without polling a page nobody watches.
  const throughputQuery = useThroughputQuoteQuery({ model: id, token: 'sAIN', amount: MODEL_SPEED_QUOTE_SAIN }, { skip: !id, pollingInterval: 15_000 });
  const list = useModelsQuery();
  const ownView = modelDetailViewState({
    id,
    detail: detail.data, detailError: detail.error as never, detailLoading: detail.isLoading,
    list: list.data, listError: list.error as never, listLoading: list.isLoading,
  });
  // The model as the network has it: which nodes serve this id, and which one this page drives (`?node=`).
  const [params] = useSearchParams();
  const network = useNetworkModelsQuery(undefined, { pollingInterval: 60_000 });
  const netModel = useMemo(
    () => networkModelCatalogue(parseModelsResponse(list.data), parseNetworkModelsResponse(network.data)).find((m) => m.id === id) ?? null,
    [list.data, network.data, id],
  );
  const provider = netModel ? pickNetworkModelProvider(netModel, params.get('node')) : null;
  const onPeer = !!provider && !provider.local;
  // Served only by another node: the page still exists, it just describes that node's model.
  const view = ownView.kind === 'ok' || ownView.kind === 'loading'
    ? (ownView.kind === 'loading' && netModel ? { kind: 'ok' as const, model: { id, modality: netModel.modality, available: provider?.available ?? true, agents: null } } : ownView)
    : netModel && provider
      ? { kind: 'ok' as const, model: { id, modality: netModel.modality, available: provider.available, agents: null } }
      : network.isLoading ? { kind: 'loading' as const } : ownView;
  const served = view.kind === 'ok';
  const agentsQuery = useAgentsByModelQuery(id, { skip: !served, pollingInterval: 60_000 });
  const agents = useMemo(() => agentsBuiltOnModel(agentsQuery.data?.agents, id), [agentsQuery.data, id]);

  const here = `/models/${encodeURIComponent(id)}`;
  const createPath = `/agent/new?model=${encodeURIComponent(id)}`;

  /** Signed in with a wallet → the form. Otherwise → the wallet sign-in, which returns to the form. */
  const startCreate = () => {
    if (auth.subject) navigate(createPath);
    else navigate(`/signing?next=${encodeURIComponent(createPath)}`);
  };

  if (view.kind === 'loading') return <PageWrapper><CenterProgress /></PageWrapper>;

  if (view.kind !== 'ok') {
    const [title, body] = view.kind === 'offline'
      ? ['models.offline.title', 'models.offline.body']
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
        </Empty>
      </PageWrapper>
    );
  }

  const { model } = view;
  const isChat = model.modality === 'chat';
  const speed = modelSpeedFactOf(parseBillingThroughputResponse(throughputQuery.data));

  return (
    <PageWrapper>
      <TitleRow><Title data-testid="model-detail-title">{model.id}</Title></TitleRow>
      <ModelDetailBack to="/models">← {t('modelDetail.back')}</ModelDetailBack>

      <ModelDetailFacts>
        <div><dt>{t('modelDetail.fact.id')}</dt><dd><Mono>{model.id}</Mono></dd></div>
        <div><dt>{t('modelDetail.fact.modality')}</dt><dd>{t(`models.modality.${model.modality}`)}</dd></div>
        <div>
          <dt>{t('modelDetail.fact.status')}</dt>
          <dd><ModelDetailDot $up={model.available} />{t(model.available ? 'models.available' : 'models.unavailable')}</dd>
        </div>
        <div>
          <dt>{t('modelDetail.fact.agents')}</dt>
          {/* The node's count when it gave one; an older node did not, and a 0 would read as "nobody built on it". */}
          <dd>{model.agents !== null ? model.agents : agentsQuery.data ? agents.length : '—'}</dd>
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
              to={`/models/${encodeURIComponent(id)}?node=${p.node.address}`}
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
          <Button variant="contained" size="large" data-testid="model-create-agent" onClick={startCreate}>
            {t('modelDetail.create')}
          </Button>
          <ModelDetailSmall>{auth.subject ? t('modelDetail.create_help') : t('modelDetail.create_signin')}</ModelDetailSmall>
        </ModelDetailCreateRow>
      )}

      <ModelPlaygroundPanel
        key={`${model.id}:${provider?.ref ?? ''}`}
        model={model}
        signInNext={onPeer && provider ? `${here}?node=${provider.node.address}` : here}
        callModel={onPeer && provider ? provider.ref : model.id}
        peer={onPeer}
      />

      {!onPeer && <>
      <SubTitle>{t('modelDetail.agents.title')}</SubTitle>
      <Description>{t('modelDetail.agents.lede')}</Description>
      <ModelDetailAgents data-testid="model-agents">
        {agentsQuery.isLoading && <CenterProgress />}
        {agentsQuery.error && <Alert $tone="error">{t('modelDetail.agents.failed', { why: errorMessage(agentsQuery.error) })}</Alert>}
        {!agentsQuery.isLoading && !agentsQuery.error && agents.length === 0 && (
          <Empty data-testid="model-agents-empty">
            {t('modelDetail.agents.empty')}
            {isChat && <> <Button size="small" variant="text" onClick={startCreate}>{t('modelDetail.agents.empty_cta')}</Button></>}
          </Empty>
        )}
        {agents.map((a) => <AgentListItem key={a.id} agent={a} />)}
      </ModelDetailAgents>
      </>}
    </PageWrapper>
  );
}
