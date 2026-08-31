import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import styled from 'styled-components';
import { useBenchmarkQuery, useInfoQuery } from '@/api/api';
import { PatchListItem } from '@/components/public/PatchListItem';
import { CenterProgress, Description, Empty, PageWrapper, Pagination, SelectBox, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
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

/** All knowledge that shares one topic (benchmark schema) — comparable because it is scored with the same question set. */
export default function BenchmarkPage() {
  const { schema = '' } = useParams();
  const { t, help, tech } = useT();
  const [sort, setSort] = useState<Sort>('popular');
  const [page, setPage] = useState(1);
  const { data: info } = useInfoQuery();
  const { data, isLoading, error } = useBenchmarkQuery(schema);

  const sortOptions = useMemo(() => SORTS.map((s) => ({ value: s, label: t(`explore.sort.${s}`) })), [t]);
  const items = useMemo(() => {
    const list = [...(data?.items ?? [])];
    if (sort === 'latest') list.sort((a, b) => b.anchor.created_at - a.anchor.created_at);
    else if (sort === 'rows') list.sort((a, b) => b.anchor.rows - a.anchor.rows);
    else list.sort((a, b) => b.downloads - a.downloads || b.passed - a.passed);
    return list;
  }, [data, sort]);

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
        <SelectBox options={sortOptions} value={sort} onChange={(v) => { setSort(v as Sort); setPage(1); }} />
      </TitleRow>
      <Stats>{t('bench.stats', { total: num(items.length), listed: num(listed), models: models.join(', ') || '—' })}</Stats>
      <Explain title={`${help('superseded')} (${tech('superseded')})`}>
        {t('bench.explain')}{' '}<StyledLink to="/explore">{t('bench.back')}</StyledLink>
      </Explain>
      <div>
        {visible.map((e) => <PatchListItem key={e.anchor.id} entry={e} currency={info?.currency} />)}
      </div>
      {items.length === 0 && <Empty>{t('bench.empty')}</Empty>}
      {items.length > 0 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
    </PageWrapper>
  );
}
