import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useCatalogQuery, useInfoQuery, errorMessage } from '@/api/api';
import { PatchListItem, PriceUnitNote } from '@/components/public/PatchListItem';
import { Shelves } from '@/components/public/Shelves';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, Description, Empty, PageWrapper, Pagination, SelectBox, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { num } from '@/utils/format';

// `built_on` and `trending` are the two orderings §10 of the lineage design defines: most built on (children on the
// ledger plus this node's derive intents) and doing well this week (3·sales + 2·builds-on + loads + ½·tests·hit-rate).
type Sort = 'popular' | 'latest' | 'price' | 'rows' | 'built_on' | 'trending';
const SORTS: Sort[] = ['popular', 'trending', 'built_on', 'latest', 'price', 'rows'];
const ITEM_LIMIT = 10;
/**
 * "Current only" — everything a visitor could sensibly load today. SUPERSEDED and REJECTED are the two states that
 * are not, and on the demo node three of the four listings are superseded, so the default view was 75% dead rows.
 * Sent as the catalog's own `status` query param, so the filtering happens where the catalogue lives.
 */
const CURRENT_STATUS = 'LISTED,ANNOUNCED,VERIFYING,CHALLENGED';

const Filters = styled.div`
  display: flex; flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 24px;
`;
const FilterGroup = styled.div`
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  span.label { font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-right: 2px; cursor: default; }
`;
const Chip = styled.button<{ $active: boolean }>`
  padding: 3px 12px; border-radius: 14px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap;
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  color: ${(p) => (p.$active ? p.theme.color.HOVER : p.theme.color.GREY)};
  transition: border-color 0.2s ease, background 0.2s ease;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
`;
const Search = styled(Input)`
  max-width: 320px; margin-left: auto;
`;
const Count = styled.div`
  font-size: 12px; color: ${(p) => p.theme.color.GREY}; padding-bottom: 12px;
`;
const Hidden = styled.div`
  margin-top: -6px; padding-bottom: 12px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  button { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; text-decoration: underline; }
`;
const Intro = styled(Description)`margin: 0 0 24px;`;

export default function ExplorePage() {
  const { t, tech, help } = useT();
  useTitle(t('explore.title'));
  const [sort, setSort] = useState<Sort>('popular');
  const [model, setModel] = useState('');
  const [schema, setSchema] = useState('');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const { data: info } = useInfoQuery();
  const filters = { sort, model: model || undefined, schema: schema || undefined, q: q || undefined };
  const { data, isLoading, isFetching, error } = useCatalogQuery({ ...filters, status: showAll ? undefined : CURRENT_STATUS, limit: 200 });
  // How many rows "Current only" is holding back, for exactly the model/topic/search in force — one cheap
  // page-of-one call for its `total`, never a node-wide count that would not match what is on screen.
  const { data: unfiltered } = useCatalogQuery({ ...filters, limit: 1 }, { skip: showAll });
  const hidden = showAll || !data || !unfiltered ? 0 : Math.max(0, unfiltered.total - data.total);

  const sortOptions = useMemo(() => SORTS.map((s) => ({ value: s, label: t(`explore.sort.${s}`) })), [t]);
  const items = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / ITEM_LIMIT));
  const current = Math.min(page, pageCount);
  const visible = useMemo(() => items.slice((current - 1) * ITEM_LIMIT, current * ITEM_LIMIT), [items, current]);

  const reset = () => setPage(1);

  return (
    <PageWrapper>
      <TitleRow>
        <Title>{t('explore.title')}</Title>
        <SelectBox options={sortOptions} value={sort} onChange={(v) => { setSort(v as Sort); reset(); }} label={t('common.sort_aria')} />
      </TitleRow>
      <Intro title={help('liveTest')}>{t('explore.sub')}</Intro>

      {/* SC-17: what is selling, what is being built ON, what is new, and what people asked for here. */}
      <Shelves />

      <Filters>
        {!!data?.models.length && (
          <FilterGroup>
            <span className="label">{t('explore.filter.model')}</span>
            <Chip $active={!model} onClick={() => { setModel(''); reset(); }}>{t('explore.filter.all')}</Chip>
            {data.models.map((m) => <Chip key={m} $active={model === m} onClick={() => { setModel(model === m ? '' : m); reset(); }}>{m}</Chip>)}
          </FilterGroup>
        )}
        {!!data?.schemas.length && (
          <FilterGroup>
            <span className="label" title={`${t('explore.filter.schema_help')} (${tech('facts')})`}>{t('explore.filter.schema')}</span>
            <Chip $active={!schema} onClick={() => { setSchema(''); reset(); }}>{t('explore.filter.all')}</Chip>
            {data.schemas.map((s) => <Chip key={s} $active={schema === s} onClick={() => { setSchema(schema === s ? '' : s); reset(); }}>{s}</Chip>)}
          </FilterGroup>
        )}
        <FilterGroup>
          <span className="label" title={t('explore.filter.show_help')}>{t('explore.filter.show')}</span>
          <Chip $active={!showAll} onClick={() => { setShowAll(false); reset(); }}>{t('explore.filter.current')}</Chip>
          <Chip $active={showAll} onClick={() => { setShowAll(true); reset(); }}>{t('explore.filter.all_versions')}</Chip>
        </FilterGroup>
        <Search placeholder={t('explore.search')} value={q} onChange={(e) => { setQ(e.target.value); reset(); }} aria-label={t('explore.search')} />
      </Filters>

      {error && <Alert $tone="error">{t('common.error', { message: errorMessage(error) })}</Alert>}
      {isLoading && <CenterProgress />}
      {!isLoading && data && (
        <>
          <Count>{t('explore.count', { n: num(data.total) })}{isFetching ? ` · ${t('explore.updating')}` : ''}</Count>
          {hidden > 0 && (
            <Hidden data-testid="explore-hidden" title={t('explore.filter.show_help')}>
              {t('explore.hidden', { n: num(hidden) }, hidden)}{' · '}
              <button type="button" onClick={() => { setShowAll(true); reset(); }}>{t('explore.hidden_show')}</button>
            </Hidden>
          )}
          {/* Finding 18: the price rides in each card's facts row on a phone, so its unit is explained once here
              instead of four times down the list. Desktop cards carry the note under their own price. */}
          <PriceUnitNote entries={visible} currency={info?.currency} data-testid="explore-price-note" />
          <div>
            {visible.map((e) => <PatchListItem key={e.anchor.id} entry={e} currency={info?.currency} />)}
          </div>
          {items.length === 0 && <Empty>{t('explore.empty')}</Empty>}
          {items.length > 0 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
        </>
      )}
    </PageWrapper>
  );
}
