import { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useBranchesQuery, useCatalogQuery, useInfoQuery, errorMessage } from '@/api/api';
import { PatchListItem, PriceUnitNote, TermsLegend } from '@/components/public/PatchListItem';
import { Shelves } from '@/components/public/Shelves';
import { Alert, Input } from '@/components/ui/Form';
import { Description, Empty, PageWrapper, Pagination, SelectBox, Shimmer, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { num } from '@/utils/format';

// `built_on` and `trending` are the two orderings §10 of the lineage design defines: most built on (children on the
// ledger plus this node's derive intents) and doing well this week (3·sales + 2·builds-on + loads + ½·tests·hit-rate).
type Sort = 'popular' | 'latest' | 'price' | 'rows' | 'built_on' | 'trending' | 'fresh';
// `fresh` is item 267's ordering: by the day the DATA is true of, not the day the file was registered.
const SORTS: Sort[] = ['popular', 'trending', 'built_on', 'fresh', 'latest', 'price', 'rows'];
/** Item 188: the subject chips are capped, and every taught lesson's own subject is one chip behind this prefix. */
const SCHEMA_CHIPS = 8;
const TAUGHT = 'taught/';
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
/** Finding 81: the first result was the 19th focusable element, behind every filter chip and every sort option. */
const Skip = styled.a`
  position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden;
  &:focus {
    position: static; width: auto; height: auto; display: inline-block; margin-bottom: 12px;
    padding: 8px 14px; border-radius: 4px; background: ${(p) => p.theme.color.PALE_GREY};
    color: ${(p) => p.theme.color.HOVER}; font-size: 13px; font-weight: 600; text-decoration: none;
  }
`;
const ResultsHead = styled.h2`
  margin: 0 0 6px; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
`;
const Count = styled.div`
  font-size: 12px; color: ${(p) => p.theme.color.GREY}; padding-bottom: 12px;
`;
const Hidden = styled.div`
  margin-top: -6px; padding-bottom: 12px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  button { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; text-decoration: underline; }
`;
const Intro = styled(Description)`margin: 0 0 24px;`;
/**
 * Finding 76 — a failing catalogue printed the raw exception ("Something went wrong: TypeError: Failed to fetch")
 * and offered nothing to do about it. The sentence says what actually happened on this network — a peer node is
 * unreachable — the technical text stays available for whoever wants it, and Try again re-runs the query.
 */
const Failure = styled(Alert)`
  display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
  details { font-size: 12px; }
  summary { cursor: pointer; color: ${(p) => p.theme.color.GREY}; }
  code { display: block; margin-top: 6px; font-size: 12px; word-break: break-all; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
const Retry = styled.button`
  padding: 7px 16px; border-radius: 4px; border: 1px solid ${(p) => p.theme.color.PRIMARY};
  background: #fff; font-size: 13px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;
/** Finding 76: a list-shaped skeleton, so the page keeps its shape instead of collapsing to a lone spinner. */
const SkeletonRow = styled.div`
  padding: 16px 32px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff;
  display: flex; gap: 16px; align-items: flex-start;
  &:not(:last-child) { margin-bottom: 16px; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px; }
`;
const SkeletonCol = styled.div`flex: 1; display: flex; flex-direction: column; gap: 8px;`;

function ListSkeleton() {
  return (
    <div data-testid="explore-skeleton" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <SkeletonRow key={i}>
          <Shimmer $w="56px" $h="56px" />
          <SkeletonCol>
            <Shimmer $w="42%" $h="18px" />
            <Shimmer $w="28%" $h="12px" />
            <Shimmer $w="66%" $h="12px" />
            <Shimmer $w="80%" $h="12px" />
          </SkeletonCol>
        </SkeletonRow>
      ))}
    </div>
  );
}

export default function ExplorePage() {
  const { t, tech, help, term } = useT();
  useTitle(t('explore.title'));
  const [sort, setSort] = useState<Sort>('popular');
  const [model, setModel] = useState('');
  const [schema, setSchema] = useState('');
  /** Item 206: the API has always accepted `branch`; nothing on the page could ask for it. */
  const [branch, setBranch] = useState('');
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const { data: info } = useInfoQuery();
  const { data: tracks } = useBranchesQuery();
  const filters = { sort, model: model || undefined, schema: schema || undefined, branch: branch || undefined, q: q || undefined };
  const { data, isLoading, isFetching, error, refetch } = useCatalogQuery({ ...filters, status: showAll ? undefined : CURRENT_STATUS, limit: 200 });
  // How many rows "Current only" is holding back, for exactly the model/topic/search in force — one cheap
  // page-of-one call for its `total`, never a node-wide count that would not match what is on screen.
  const { data: unfiltered } = useCatalogQuery({ ...filters, limit: 1 }, { skip: showAll });
  const hidden = showAll || !data || !unfiltered ? 0 : Math.max(0, unfiltered.total - data.total);

  /**
   * Finding 76 — the Model and Topic chips came straight off `data`, so a failed request took the filters off the
   * page along with the results and the reader lost even the ability to try a different one. The last facets this
   * node answered with are kept and rendered through the failure.
   */
  const facets = useRef<{ models: string[]; schemas: string[] }>({ models: [], schemas: [] });
  useEffect(() => { if (data) facets.current = { models: data.models, schemas: data.schemas }; }, [data]);
  const models = data?.models ?? facets.current.models;
  const schemas = data?.schemas ?? facets.current.schemas;
  /**
   * Item 188 — `createLessonDraft` gives every lesson its own benchmark schema (`taught/<name>-<hex>`, by design F15
   * so a lesson never supersedes its base), and this filter row printed one chip per schema with no cap: 136 of them
   * on node-u. Taught lessons collapse into one chip, the rest are capped, and the cap is a click away.
   */
  const [allSchemas, setAllSchemas] = useState(false);
  const taughtCount = schemas.filter((x) => x.startsWith(TAUGHT)).length;
  const plainSchemas = schemas.filter((x) => !x.startsWith(TAUGHT));
  const shownSchemas = allSchemas ? plainSchemas : plainSchemas.slice(0, SCHEMA_CHIPS);
  const restSchemas = plainSchemas.length - shownSchemas.length;

  const sortOptions = useMemo(() => SORTS.map((s) => ({ value: s, label: t(`explore.sort.${s}`) })), [t]);
  const items = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / ITEM_LIMIT));
  const current = Math.min(page, pageCount);
  const visible = useMemo(() => items.slice((current - 1) * ITEM_LIMIT, current * ITEM_LIMIT), [items, current]);
  /** A parent id is only an id until something on this page knows its name (findings 282, 200). */
  const nameOf = useMemo(() => {
    const m = new Map(items.map((e) => [e.anchor.id, e.anchor.name || e.anchor.id]));
    return (id: string) => m.get(id);
  }, [items]);
  /**
   * Finding 70 — the hero counts `listed` and said "1 verified knowledge"; this line counted every row the default
   * filter returned and said "4 knowledge", with all four badged Verified. The default view no longer contains
   * superseded rows, and the count says how many of what it IS showing carry the same word the hero uses, so the
   * two pages can be read against each other. Counted from the rows on screen, never from a node-wide total.
   */
  const verified = items.filter((e) => e.quorum_ok && e.sellable !== false).length;
  const countExact = !!data && items.length === data.total;

  const reset = () => setPage(1);

  return (
    <PageWrapper>
      <TitleRow>
        <Title>{t('explore.title')}</Title>
        <SelectBox options={sortOptions} value={sort} onChange={(v) => { setSort(v as Sort); reset(); }} label={t('common.sort_aria')} />
      </TitleRow>
      <Intro>{t('explore.sub')}</Intro>
      <Skip href="#explore-results">{t('explore.skip')}</Skip>

      {/* SC-17: what is selling, what is being built ON, what is new, and what people asked for here. */}
      <Shelves />

      <Filters>
        {!!models.length && (
          <FilterGroup>
            <span className="label">{t('explore.filter.model')}</span>
            <Chip $active={!model} onClick={() => { setModel(''); reset(); }}>{t('explore.filter.all')}</Chip>
            {models.map((m) => <Chip key={m} $active={model === m} onClick={() => { setModel(model === m ? '' : m); reset(); }}>{m}</Chip>)}
          </FilterGroup>
        )}
        {!!schemas.length && (
          <FilterGroup>
            <span className="label" title={`${t('explore.filter.schema_help')} (${tech('facts')})`}>{t('explore.filter.schema')}</span>
            <Chip $active={!schema} onClick={() => { setSchema(''); reset(); }}>{t('explore.filter.all')}</Chip>
            {shownSchemas.map((s) => <Chip key={s} $active={schema === s} onClick={() => { setSchema(schema === s ? '' : s); reset(); }}>{s}</Chip>)}
            {/* Item 188 — every taught lesson gets its own `taught/<slug>-<hex>` subject by design, so this row was
                136 chips on a teaching node and the first card sat 4,297 px down a 360 px screen. The subjects with
                the most knowledge come first, the rest are behind "more", and every lesson's subject is one chip. */}
            {taughtCount > 0 && (
              <Chip $active={schema.startsWith(TAUGHT)} onClick={() => { setSchema(schema.startsWith(TAUGHT) ? '' : `${TAUGHT}*`); reset(); }} data-testid="schema-taught">
                {t('explore.filter.schema_taught', { n: num(taughtCount) })}
              </Chip>
            )}
            {restSchemas > 0 && !allSchemas && (
              <Chip $active={false} onClick={() => setAllSchemas(true)} data-testid="schema-more">{t('explore.filter.schema_more', { n: num(restSchemas) })}</Chip>
            )}
          </FilterGroup>
        )}
        {/* Item 206: a track is how a returning consumer thinks about a catalogue ("today's KRX bake"), and it was
            the one axis of the API the browse page never offered. Only rendered when this node knows any. */}
        {!!tracks?.branches.length && (
          <FilterGroup>
            <span className="label" title={`${help('branch')} (${tech('branch')})`}>{t('explore.filter.track')}</span>
            <Chip $active={!branch} onClick={() => { setBranch(''); reset(); }}>{t('explore.filter.all')}</Chip>
            {tracks.branches.map((b) => <Chip key={b.name} $active={branch === b.name} title={b.description} onClick={() => { setBranch(branch === b.name ? '' : b.name); reset(); }}>{b.name}</Chip>)}
          </FilterGroup>
        )}
        <FilterGroup>
          <span className="label" title={t('explore.filter.show_help')}>{t('explore.filter.show')}</span>
          <Chip $active={!showAll} onClick={() => { setShowAll(false); reset(); }}>{t('explore.filter.current')}</Chip>
          <Chip $active={showAll} onClick={() => { setShowAll(true); reset(); }}>{t('explore.filter.all_versions')}</Chip>
        </FilterGroup>
        <Search placeholder={t('explore.search')} value={q} onChange={(e) => { setQ(e.target.value); reset(); }} aria-label={t('explore.search')} />
      </Filters>

      <ResultsHead id="explore-results" tabIndex={-1}>{t('explore.results')}</ResultsHead>
      {error && (
        <Failure $tone="error" data-testid="explore-error">
          <span>{t('explore.unreachable')}</span>
          <Retry type="button" onClick={() => { void refetch(); }} data-testid="explore-retry">{t('explore.retry')}</Retry>
          <details>
            <summary>{t('explore.error_detail')}</summary>
            <code>{errorMessage(error)}</code>
          </details>
        </Failure>
      )}
      {isLoading && <ListSkeleton />}
      {!isLoading && data && (
        <>
          <Count data-testid="explore-count">
            {t('explore.count', { n: num(data.total) }, data.total)}
            {countExact && data.total > 0 && ` · ${verified === data.total ? t('explore.count_all_verified', { term: term('verified') }, data.total) : t('explore.count_verified', { n: num(verified), term: term('verified') }, verified)}`}
            {isFetching ? ` · ${t('explore.updating')}` : ''}
          </Count>
          {hidden > 0 && (
            <Hidden data-testid="explore-hidden" title={t('explore.filter.show_help')}>
              {t('explore.hidden', { n: num(hidden) }, hidden)}{' · '}
              <button type="button" onClick={() => { setShowAll(true); reset(); }}>{t('explore.hidden_show')}</button>
            </Hidden>
          )}
          {items.length > 0 && <TermsLegend title={help('liveTest')} />}
          {/* Finding 18: the price rides in each card's facts row on a phone, so its unit is explained once here
              instead of four times down the list. Desktop cards carry the note under their own price. */}
          <PriceUnitNote entries={visible} currency={info?.currency} data-testid="explore-price-note" />
          <div>
            {visible.map((e) => <PatchListItem key={e.anchor.id} entry={e} currency={info?.currency} nameOf={nameOf} />)}
          </div>
          {items.length === 0 && <Empty>{t('explore.empty')}</Empty>}
          {items.length > 0 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
        </>
      )}
    </PageWrapper>
  );
}
