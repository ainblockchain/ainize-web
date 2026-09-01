import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import styled from 'styled-components';
import { useBenchmarkQuery, useInfoQuery } from '@/api/api';
import { PatchListItem } from '@/components/public/PatchListItem';
import { CenterProgress, Description, Empty, PageWrapper, Pagination, SelectBox, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { num } from '@/utils/format';
import NotFoundPage from './NotFoundPage';

type Sort = 'popular' | 'latest' | 'rows';
const SORTS: Sort[] = ['popular', 'latest', 'rows'];
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

/** All knowledge that shares one topic (benchmark schema) — comparable because it is scored with the same question set. */
export default function BenchmarkPage() {
  const { schema = '' } = useParams();
  const { t, help, tech } = useT();
  const [sort, setSort] = useState<Sort>('popular');
  const [page, setPage] = useState(1);
  const { data: info } = useInfoQuery();
  const { data, isLoading, error } = useBenchmarkQuery(schema);
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

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (error || !data) return <NotFoundPage message={t('bench.notfound', { schema })} />;

  const pageCount = Math.max(1, Math.ceil(items.length / ITEM_LIMIT));
  const current = Math.min(page, pageCount);
  const visible = items.slice((current - 1) * ITEM_LIMIT, current * ITEM_LIMIT);
  const listed = items.filter((e) => e.status === 'LISTED').length;
  const models = [...new Set(items.map((e) => e.anchor.model.id_M))];

  return (
    <PageWrapper>
      <TitleRow>
        <Title>{t('bench.title')} <Schema title={t('explore.filter.schema_help')}>{data.schema}</Schema></Title>
        <SelectBox options={sortOptions} value={sort} onChange={(v) => { setSort(v as Sort); setPage(1); }} label={t('common.sort_aria')} />
      </TitleRow>
      <Stats>{t('bench.stats', { total: num(items.length), listed: num(listed), sets: num(groups.length), models: models.join(', ') || '—' })}</Stats>
      <Explain title={`${help('superseded')} (${tech('superseded')})`}>
        {t('bench.explain')}{' '}<StyledLink to="/explore">{t('bench.back')}</StyledLink>
      </Explain>
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
              {shown.map((e) => <PatchListItem key={e.anchor.id} entry={e} currency={info?.currency} />)}
            </section>
          );
        })}
      </div>
      {items.length === 0 && <Empty>{t('bench.empty')}</Empty>}
      {items.length > 0 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
    </PageWrapper>
  );
}
