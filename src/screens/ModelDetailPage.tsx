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
import { Link, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useAgentsByModelQuery, useModelDetailQuery, useModelsQuery } from '@/api/api';
import { agentsBuiltOnModel } from '@/api/hostedAgents';
import { modelDetailViewState } from '@/api/models';
import { useAuth } from '@/auth/AuthContext';
import { AgentListItem } from '@/components/public/AgentListItem';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, Mono, PageWrapper, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { ModelPlaygroundPanel } from './models/ModelPlaygroundPanel';

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
const ModelDetailAgents = styled.div`margin-top: 12px;`;

export default function ModelDetailPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  useTitle(id || t('models.title'));

  const detail = useModelDetailQuery(id, { skip: !id });
  const list = useModelsQuery();
  const view = modelDetailViewState({
    id,
    detail: detail.data, detailError: detail.error as never, detailLoading: detail.isLoading,
    list: list.data, listError: list.error as never, listLoading: list.isLoading,
  });
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
      </ModelDetailFacts>

      {isChat && (
        <ModelDetailCreateRow>
          <Button variant="contained" size="large" data-testid="model-create-agent" onClick={startCreate}>
            {t('modelDetail.create')}
          </Button>
          <ModelDetailSmall>{auth.subject ? t('modelDetail.create_help') : t('modelDetail.create_signin')}</ModelDetailSmall>
        </ModelDetailCreateRow>
      )}

      <ModelPlaygroundPanel key={model.id} model={model} signInNext={here} />

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
    </PageWrapper>
  );
}
