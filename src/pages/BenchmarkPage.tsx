import { verificationCount } from '@ainize/core/browser';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import styled from 'styled-components';
import { useBenchmarkQuery, useInfoQuery } from '@/api/api';
import type { CatalogEntry } from '@/api/types';
import { executedAccuracy, PriceUnitNote, TermsLegend, usePriceLabel } from '@/components/public/PatchListItem';
import { CenterProgress, Description, Empty, PageWrapper, Pagination, SelectBox, StatusChip, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { SubText, Table, TableBody, TableData, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { bytes, num } from '@/utils/format';
import NotFoundPage from './NotFoundPage';

// Finding 74: Price is back. /explore offers it and the page whose whole job is "which of these should I buy?"
// was the one place that silently dropped it.
type Sort = 'popular' | 'latest' | 'price' | 'rows';
const SORTS: Sort[] = ['popular', 'price', 'latest', 'rows'];
const ITEM_LIMIT = 10;

const Schema = styled.span`
  font-family: ${(p) => p.theme.font.mono}; color: ${(p) => p.theme.color.PRIMARY};
`;
const Stats = styled(Description)`
  margin: 0 0 8px;
`;
const Explain = styled(Description)`
  margin: 0 0 24px;
`;
/** One question set = one exam. Everything under this heading was scored on the same questions, in the same form. */
const GroupHead = styled.h2`
  margin: 24px 0 8px; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 12px; font-weight: 400; color: ${(p) => p.theme.color.GREY}; }
`;
const GroupNote = styled(Description)`
  margin: 0 0 12px; font-size: 12px;
`;

/**
 * Finding 74 — the page whose entire job is comparison rendered the same card stack as /explore: four items of five
 * prose lines each, differing on 25/10/5/0.1 AIN, 100/100/100/96.2 % and 331.7/297.2/297.2/3.7 MB, none of which
 * were ever adjacent. Inside a question set the numbers ARE comparable (that is what the grouping means), so inside
 * a question set they are a table, one row per knowledge with the columns lined up.
 *
 * Its own scroller rather than TableWrapper, because nine columns do not fit a 360 px phone and a table that
 * scrolls has to look like one: the two edge shadows ride with the viewport, the two white covers ride with the
 * content, so each shadow disappears at its own end.
 */
const Scroller = styled.div`
  width: 100%; overflow-x: auto; overscroll-behavior-x: contain;
  background:
    linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0)) left center / 24px 100% no-repeat local,
    linear-gradient(to left, #ffffff, rgba(255, 255, 255, 0)) right center / 24px 100% no-repeat local,
    radial-gradient(farthest-side at 0 50%, rgba(0, 0, 0, 0.13), rgba(0, 0, 0, 0)) left center / 10px 100% no-repeat scroll,
    radial-gradient(farthest-side at 100% 50%, rgba(0, 0, 0, 0.13), rgba(0, 0, 0, 0)) right center / 10px 100% no-repeat scroll;
`;
/** The current version of a subject is the one a visitor can act on; it should not have to be spotted in a chip. */
const Row = styled(TableRow)<{ $current: boolean }>`
  background-color: ${(p) => (p.$current ? p.theme.color.PALE_GREY : '#ffffff')};
  td:first-child { box-shadow: ${(p) => (p.$current ? `inset 3px 0 0 0 ${p.theme.color.PRIMARY}` : 'none')}; }
`;
const NameCell = styled(TableData)`
  white-space: normal; word-break: keep-all; min-width: 220px;
  /* On a phone the whole table scrolls; a 220 px name column would leave one number visible beside it. */
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { min-width: 150px; }
  a { color: ${(p) => p.theme.color.BLACK}; font-weight: 600; text-decoration: none; }
  a:hover { color: ${(p) => p.theme.color.HOVER}; text-decoration: underline; }
`;
const Muted = styled.span`color: ${(p) => p.theme.color.GREY};`;
/** Nine columns have to fit 1,024 px, which is what the comparison is FOR — 6 px of padding buys 54 px of it. */
const CELL_PAD = '0 6px';
const Good = styled.span`color: ${(p) => p.theme.color.SUCCESS}; font-weight: 600;`;
const PriceCell = styled(TableData)`color: ${(p) => p.theme.color.PRIMARY}; font-weight: 700; white-space: nowrap;`;

/**
 * All knowledge that shares one topic (benchmark schema). A topic is NOT one exam: items on it can carry different
 * benchmark hashes, and two scores from different question sets cannot be compared — so the list is grouped by
 * question set and each group says what it can be compared with.
 */
export default function BenchmarkPage() {
  const { schema = '' } = useParams();
  const { t, help, tech } = useT();
  const [sort, setSort] = useState<Sort>('popular');
  const [page, setPage] = useState(1);
  const { data: info } = useInfoQuery();
  const { data, isLoading, error } = useBenchmarkQuery(schema);
  const priceLabel = usePriceLabel();
  useTitle(`${t('bench.title')} ${schema}`);

  const sortOptions = useMemo(() => SORTS.map((s) => ({ value: s, label: t(`explore.sort.${s}`) })), [t]);
  /**
   * Finding 24 — a score is comparable only with one measured on the SAME question set. These four items carry three
   * different benchmark_hashes (b6beb92f [template, chat], 7b126cec [template], 8f1017b4 [template, natural]), and
   * the page used to line their percentages up under a sentence promising they were comparable. Items are grouped by
   * benchmark_hash; the chosen sort orders the items inside each group, and the groups themselves are newest-first.
   */
  const groups = useMemo(() => {
    const list = [...(data?.items ?? [])];
    if (sort === 'latest') list.sort((a, b) => b.anchor.created_at - a.anchor.created_at);
    else if (sort === 'rows') list.sort((a, b) => b.anchor.rows - a.anchor.rows);
    else if (sort === 'price') list.sort((a, b) => (Number(a.anchor.price) || 0) - (Number(b.anchor.price) || 0));
    else list.sort((a, b) => b.downloads - a.downloads || b.passed - a.passed);
    const byHash = new Map<string, typeof list>();
    for (const e of list) {
      const key = e.anchor.benchmark_hash || `no-hash:${e.anchor.id}`;
      const bucket = byHash.get(key);
      if (bucket) bucket.push(e); else byHash.set(key, [e]);
    }
    return [...byHash.entries()]
      .map(([hash, entries]) => ({
        hash,
        entries,
        /** the group's own facts: the format its verifiers used and how many questions the set declares */
        format: entries[0].anchor.benchmark.format ?? [],
        queries: entries[0].anchor.benchmark.queries,
        newest: Math.max(...entries.map((e) => e.anchor.created_at)),
      }))
      .sort((a, b) => b.newest - a.newest);
  }, [data, sort]);
  const items = useMemo(() => groups.flatMap((g) => g.entries), [groups]);
  const nameOf = useMemo(() => {
    const m = new Map(items.map((e) => [e.anchor.id, e.anchor.name || e.anchor.id]));
    return (id: string) => m.get(id);
  }, [items]);

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (error || !data) return <NotFoundPage message={t('bench.notfound', { schema })} />;

  const pageCount = Math.max(1, Math.ceil(items.length / ITEM_LIMIT));
  const current = Math.min(page, pageCount);
  const visible = items.slice((current - 1) * ITEM_LIMIT, current * ITEM_LIMIT);
  const listed = items.filter((e) => e.status === 'VERIFIED').length;
  const models = [...new Set(items.map((e) => e.anchor.model.id_M))];

  const row = (e: CatalogEntry) => {
    const a = e.anchor;
    const acc = executedAccuracy(e);
    const p = priceLabel(a.price, a.currency ?? info?.currency);
    /** What it sits on: an add-on's price is not the whole price (findings 282, 270). */
    const stack = a.base?.stack?.map((s) => s.patch_id) ?? [];
    const parents = stack.length ? stack : (a.parents ?? []);
    const names = parents.map((id) => nameOf(id) ?? id).join(', ');
    return (
      <Row key={a.id} $current={e.status === 'VERIFIED'} data-testid="bench-row">
        <NameCell $align="left" $maxWidth="300px" $padding={CELL_PAD}>
          <Link to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}`}>{a.name || a.id}</Link>
          <SubText>{a.id}</SubText>
          {parents.length > 0 && (
            <SubText data-testid="bench-built-on">{stack.length ? t('item.addon', { names }) : t('item.built_on', { names })}</SubText>
          )}
        </NameCell>
        {/* the successor's id is in the chip's own tooltip; in a column it is 60 px that push Price off screen */}
        <TableData $align="left" $maxWidth="180px" $padding={CELL_PAD}><StatusChip status={e.status} /></TableData>
        <PriceCell $align="right" $padding={CELL_PAD}>{p.text}</PriceCell>
        <TableData $align="right" $padding={CELL_PAD}>
          {acc ? <><Good>{acc.pct}%</Good><SubText title={t('item.accuracy_raw', { raw: acc.raw })}>{acc.raw}</SubText></> : <Muted>{t('bench.col.unscored')}</Muted>}
        </TableData>
        <TableData $align="right" $padding={CELL_PAD}>
          {e.quorum_ok && e.sellable !== false ? <Good>{t('units.verified_by', { passed: verificationCount(e).shown, quorum: e.quorum })}</Good>
            : t('units.verified_by', { passed: verificationCount(e).shown, quorum: e.quorum })}
        </TableData>
        <TableData $align="right" $padding={CELL_PAD}>{num(a.benchmark.queries)}</TableData>
        <TableData $align="right" $padding={CELL_PAD}>{num(a.rows)}</TableData>
        <TableData $align="right" $padding={CELL_PAD}>{bytes(a.size_bytes)}</TableData>
        <TableData $align="right" $padding={CELL_PAD}>{num(e.downloads)}</TableData>
      </Row>
    );
  };

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{t('bench.title')} <Schema title={t('explore.filter.schema_help')}>{data.schema}</Schema></Title>
        <SelectBox options={sortOptions} value={sort} onChange={(v) => { setSort(v as Sort); setPage(1); }} label={t('common.sort_aria')} />
      </TitleRow>
      <Stats>{t('bench.stats', { total: num(items.length), listed: num(listed), sets: num(groups.length), models: models.join(', ') || '—' })}</Stats>
      <Explain title={`${help('superseded')} (${tech('superseded')})`}>
        {t('bench.explain')}{' '}<StyledLink to="/explore">{t('bench.back')}</StyledLink>
      </Explain>
      {items.length > 0 && <TermsLegend />}
      {/* Finding 18: same as /explore — the price is in the table, its unit is said once for the page. */}
      <PriceUnitNote entries={visible} currency={info?.currency} data-testid="bench-price-note" />
      <div>
        {groups.map((g) => {
          const shown = g.entries.filter((e) => visible.includes(e));
          if (shown.length === 0) return null;
          return (
            <section key={g.hash} data-testid="bench-group">
              <GroupHead data-testid="bench-group-head">
                {g.format.length ? t('bench.group.title', { format: g.format.join(' + '), n: num(g.queries) }) : t('bench.group.title_noformat', { n: num(g.queries) })}
                <code title={t('detail.ov.benchmark_hash')}>{g.hash.slice(0, 8)}</code>
              </GroupHead>
              <GroupNote>{g.entries.length === 1 ? t('bench.group.alone') : t('bench.group.note', { n: g.entries.length })}</GroupNote>
              <Scroller>
                <Table data-testid="bench-table">
                  {/* The column names are short on purpose — every one of them is defined in full in the legend
                      above the first table, where it costs one line for the page instead of nine header cells. */}
                  <TableHeader>
                    <TableRow>
                      <TableHead $align="left" $padding={CELL_PAD}>{t('bench.col.name')}</TableHead>
                      <TableHead $align="left" $padding={CELL_PAD}>{t('bench.col.status')}</TableHead>
                      <TableHead $align="right" $padding={CELL_PAD}>{t('common.price')}</TableHead>
                      <TableHead $align="right" $padding={CELL_PAD}>{t('bench.col.accuracy')}</TableHead>
                      <TableHead $align="right" $padding={CELL_PAD}>{t('bench.col.verified')}</TableHead>
                      <TableHead $align="right" $padding={CELL_PAD}>{t('bench.col.facts')}</TableHead>
                      <TableHead $align="right" $padding={CELL_PAD}>{t('bench.col.rows')}</TableHead>
                      <TableHead $align="right" $padding={CELL_PAD}>{t('bench.col.size')}</TableHead>
                      <TableHead $align="right" $padding={CELL_PAD}>{t('bench.col.downloads')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{shown.map(row)}</TableBody>
                </Table>
              </Scroller>
            </section>
          );
        })}
      </div>
      {items.length === 0 && <Empty>{t('bench.empty')}</Empty>}
      {items.length > 0 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
    </PageWrapper>
  );
}
