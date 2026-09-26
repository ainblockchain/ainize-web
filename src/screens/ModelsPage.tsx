/**
 * What this node serves — every model, grouped by what it does, each one a door to its own page.
 *
 * This page used to be one model at a time: a card grid that selected, a playground under it and the code to take
 * away. A model now has more than a playground — the agents built on it, and the button that builds one — so each
 * model got a page (`/models/<id>`, `ModelDetailPage`) and the playground moved there whole
 * (`models/ModelPlaygroundPanel.tsx`). What stays here is the list, and the list's job is to be complete: an
 * unavailable model is still shown (dimmed, and still linked — its page says why it is not answering).
 *
 * Everything here has to survive a node that is unreachable or serves nothing, because that is what production
 * looks like when its node is down, and a page whose failure states were never looked at has not been built.
 */
import { useMemo } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useModelsQuery, useNetworkModelsQuery } from '@/api/api';
import { networkModelCatalogue, networkProviderLabel, parseNetworkModelsResponse } from '@/api/networkModels';
import { MODEL_MODALITIES, modelsFetchState, parseModelsResponse } from '@/api/models';
import { CenterProgress, Description, Empty, Mono, PageWrapper, SubTitle, Title } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const Cards = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin: 12px 0 28px;`;

/** A card is a link: the whole model page is behind it, not a selection on this one. */
const ModelsPageCard = styled(Link)<{ $available: boolean }>`
  display: block; text-align: left; text-decoration: none; color: inherit;
  padding: 14px 16px; border-radius: 10px; font: inherit;
  border: 1px solid #e2e4ea; background: #fff;
  opacity: ${(p) => (p.$available ? 1 : 0.55)};
  &:hover, &:focus-visible { border-color: #5b3df5; background: #f4f1ff; }
`;

const CardId = styled.div`font-weight: 600; font-size: 14px; word-break: break-all;`;
const CardMeta = styled.div`margin-top: 6px; font-size: 12px; color: #6b7280;`;
const Dot = styled.span<{ $up: boolean }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$up ? '#1ea672' : '#c2c6cf')};
`;

export default function ModelsPage() {
  const { t } = useT();
  useTitle(t('models.title'));
  const { data, isLoading, error } = useModelsQuery();
  const fetchState = modelsFetchState(error as { status?: number | string; originalStatus?: number } | undefined);
  const cards = useMemo(() => parseModelsResponse(data), [data]);
  // The network's models, not only this node's: every node that joined brings its own (api/networkModels.ts).
  const network = useNetworkModelsQuery(undefined, { pollingInterval: 60_000 });
  const catalogue = useMemo(() => networkModelCatalogue(cards, parseNetworkModelsResponse(network.data)), [cards, network.data]);
  const groups = useMemo(() => MODEL_MODALITIES
    .map((modality) => ({ modality, models: catalogue.filter((m) => m.modality === modality) }))
    .filter((g) => g.models.length > 0), [catalogue]);

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;

  return (
    <PageWrapper>
      <Title>{t('models.title')}</Title>
      <Description>{t('models.lede')}</Description>

      {/* The two states production is in when its node is down. Neither pretends to be a model list. */}
      {fetchState === 'offline' && (
        <Empty>
          <SubTitle>{t('models.offline.title')}</SubTitle>
          <Description>{t('models.offline.body')}</Description>
        </Empty>
      )}
      {fetchState === 'outdated' && (
        <Empty>
          <SubTitle>{t('models.outdated.title')}</SubTitle>
          <Description>{t('models.outdated.body')}</Description>
        </Empty>
      )}
      {fetchState === 'ok' && catalogue.length === 0 && (
        <Empty>
          <SubTitle>{t('models.empty.title')}</SubTitle>
          <Description>{t('models.empty.body')}</Description>
          <Mono>{'"backends": [{ "id": "llm", "modality": "chat", "upstream": "http://127.0.0.1:8000", "models": ["…"] }]'}</Mono>
        </Empty>
      )}

      {groups.map((group) => (
        <div key={group.modality}>
          <SubTitle>{t(`models.modality.${group.modality}`)}</SubTitle>
          <Cards>
            {group.models.map((model) => {
              const available = model.providers.some((p) => p.available);
              return (
                <ModelsPageCard
                  key={model.id}
                  to={`/models/${encodeURIComponent(model.id)}`}
                  data-testid={`model-card-${model.id}`}
                  $available={available}
                >
                  <CardId>{model.id}</CardId>
                  <CardMeta><Dot $up={available} />{t(available ? 'models.available' : 'models.unavailable')}</CardMeta>
                  {/* Which nodes serve it — the same id on two nodes is two models, and this is where that shows. */}
                  {model.providers.some((p) => p.node.address) && (
                    <CardMeta data-testid={`model-card-providers-${model.id}`}>
                      {t('models.served_by', { nodes: model.providers.map(networkProviderLabel).join(' · ') })}
                    </CardMeta>
                  )}
                </ModelsPageCard>
              );
            })}
          </Cards>
        </div>
      ))}
    </PageWrapper>
  );
}
