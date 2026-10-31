/**
 * What the network serves — every model any connected node offers, grouped by what it does, each one a door to its own page.
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
import { Link, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useModelsQuery, useNetworkModelsQuery } from '@/api/api';
import { networkModelCatalogue, networkModelHref, networkProviderLabel, readNetworkModelsResponse } from '@/api/networkModels';
import { MODEL_MODALITIES, modelsFetchState, readModelsResponse } from '@/api/models';
import { Button } from '@/components/ui/Button';
import { CardGrid, CenterProgress, Description, Empty, PageWrapper, SubTitle, SectionTitle } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { useAuth } from '@/auth/AuthContext';
import { docsFromModels, matchingSearchIds } from '@/lib/globalSearch';

/** huggingface.co's card grid (Misc.CardGrid), the same columns every listing steps through. */
const Cards = styled(CardGrid)`margin: 12px 0 28px;`;

/** A card is a link: the whole model page is behind it, not a selection on this one. */
const ModelsPageCard = styled(Link)<{ $available: boolean }>`
  display: block; text-align: left; text-decoration: none; color: inherit;
  padding: 14px 16px; border-radius: 10px; font: inherit;
  border: 1px solid #e2e4ea; background: #fff;
  opacity: ${(p) => (p.$available ? 1 : 0.55)};
  &:hover, &:focus-visible { border-color: #5b3df5; background: #f4f1ff; }
`;

const CardId = styled.div`font-weight: 600; font-size: 14px; word-break: break-all;`;
const CardMeta = styled.div`margin-top: 6px; font-size: 12px; color: #6b7280; overflow-wrap: anywhere;`;
const Dot = styled.span<{ $up: boolean }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$up ? '#1ea672' : '#c2c6cf')};
`;

export default function ModelsPage() {
  const { t } = useT();
  const { address } = useAuth();
  useTitle(t('models.title'));
  /** `?q=` is how the header's search hands over its query ("See all models"); the box here edits the same text. */
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const { currentData: data, isLoading, isFetching, error, refetch } = useModelsQuery(undefined, { pollingInterval: 15_000, skipPollingIfUnfocused: true, refetchOnMountOrArgChange: true, refetchOnFocus: true, refetchOnReconnect: true });
  const fetchState = modelsFetchState(error as { status?: number | string; originalStatus?: number } | undefined);
  const ownRead = useMemo(() => error ? null : readModelsResponse(data), [data, error]);
  // The network's models, not only this node's: every node that joined brings its own (api/networkModels.ts).
  const network = useNetworkModelsQuery(undefined, { pollingInterval: 60_000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true });
  const networkRead = useMemo(() => network.isError ? null : readNetworkModelsResponse(network.currentData, address), [network.currentData, network.isError, address]);
  const catalogue = useMemo(() => networkModelCatalogue(ownRead?.models ?? [], networkRead?.models ?? [], address), [ownRead, networkRead, address]);
  const networkState = modelsFetchState(network.error as never);
  const pending = isLoading || network.isLoading;
  const invalid = (!isLoading && !error && !ownRead) || (!network.isLoading && !network.isError && !networkRead) || fetchState === 'invalid' || networkState === 'invalid';
  const incomplete = invalid || fetchState === 'offline' || networkState === 'offline';
  const unsupported = (ownRead?.unsupported ?? 0) + (networkRead?.unsupported ?? 0);
  const complete = (!!ownRead && (!!networkRead || networkState === 'outdated')) || (!!networkRead && fetchState === 'outdated');
  const empty = !pending && !incomplete && complete && !catalogue.length && !unsupported;
  const retry = () => { void refetch(); void network.refetch(); };
  const needle = q.trim().toLowerCase();
  const matchingIds = useMemo(() => matchingSearchIds(docsFromModels(catalogue), q), [catalogue, q]);
  const groups = useMemo(() => MODEL_MODALITIES
    .map((modality) => ({ modality, models: catalogue.filter(m => m.modality === modality)
      .map(m => ({ ...m, providers: m.providers.filter(p => matchingIds.has(networkModelHref(m, p))) }))
      .filter(m => m.providers.length > 0) }))
    .filter((g) => g.models.length > 0), [catalogue, matchingIds]);

  if (pending && !catalogue.length) return <PageWrapper><CenterProgress /></PageWrapper>;

  return (
    <PageWrapper>
      <SectionTitle>{t('nav.models')}</SectionTitle>
      {q && <Description>{t('search.query', { q })}</Description>}
      {!pending && !incomplete && needle && catalogue.length > 0 && !groups.length && <Empty>{t('models.search_none', { q: q.trim() })}</Empty>}

      {pending && <Description role="status">{t('models.list.loading')}</Description>}
      {incomplete && <Empty data-testid="models-list-incomplete" role="alert">
        <Description>{t(invalid ? 'models.list.invalid' : 'models.list.incomplete')}</Description>
        <Button type="button" disabled={isFetching || network.isFetching} onClick={retry}>{t('models.offline.retry')}</Button>
      </Empty>}
      {!pending && !incomplete && fetchState === 'outdated' && !networkRead && <Empty>{t('models.outdated.title')}</Empty>}
      {!!unsupported && <Description role="status">{t('models.list.unsupported')}</Description>}
      {empty && <Empty data-testid="models-list-empty">{t('models.empty.title')}</Empty>}

      {groups.map((group) => (
        <div key={group.modality}>
          <SubTitle $mt={0}>{t(`models.modality.${group.modality}`)}</SubTitle>
          <Cards>
            {group.models.map((model) => {
              const available = model.providers.some((p) => p.available);
              return (
                <ModelsPageCard
                  key={model.id}
                  to={networkModelHref(model)}
                  data-testid={`model-card-${model.id}`}
                  $available={available}
                >
                  <CardId>{model.id}</CardId>
                  <CardMeta><Dot $up={available} />{t(!available ? model.providers.every(p => p.availabilityKnown === false) ? 'models.status_unknown' : 'models.unavailable' : model.providers.some(p => p.local && p.available) ? 'models.available' : 'models.advertised')}</CardMeta>
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
