import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import styled from 'styled-components';
import { useBenchmarkQuery, useInfoQuery } from '@/api/api';
import { PatchListItem } from '@/components/public/PatchListItem';
import { CenterProgress, Description, Empty, PageWrapper, Pagination, SelectBox, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { num } from '@/utils/format';
import NotFoundPage from './NotFoundPage';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popular' },
  { value: 'latest', label: 'Latest' },
  { value: 'rows', label: 'Rows' },
];
const ITEM_LIMIT = 10;

const Schema = styled.span`
  font-family: ${(p) => p.theme.font.mono}; color: ${(p) => p.theme.color.PRIMARY};
`;
const Stats = styled(Description)`
  margin: 0 0 24px;
`;

/** Ported from ainize-web DeploymentsPage.js ("all deployments of a GitHub repo") → all patches sharing a benchmark schema. */
export default function BenchmarkPage() {
  const { schema = '' } = useParams();
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const { data: info } = useInfoQuery();
  const { data, isLoading, error } = useBenchmarkQuery(schema);

  const items = useMemo(() => {
    const list = [...(data?.items ?? [])];
    if (sort === 'latest') list.sort((a, b) => b.anchor.created_at - a.anchor.created_at);
    else if (sort === 'rows') list.sort((a, b) => b.anchor.rows - a.anchor.rows);
    else list.sort((a, b) => b.downloads - a.downloads || b.passed - a.passed);
    return list;
  }, [data, sort]);

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (error || !data) return <NotFoundPage message={`No patches are registered for benchmark schema "${schema}".`} />;

  const pageCount = Math.max(1, Math.ceil(items.length / ITEM_LIMIT));
  const current = Math.min(page, pageCount);
  const visible = items.slice((current - 1) * ITEM_LIMIT, current * ITEM_LIMIT);
  const listed = items.filter((e) => e.status === 'LISTED').length;
  const models = [...new Set(items.map((e) => e.anchor.model.id_M))];

  return (
    <PageWrapper>
      <TitleRow>
        <Title>Patches for benchmark <Schema>{data.schema}</Schema></Title>
        <SelectBox options={SORT_OPTIONS} value={sort} onChange={(v) => { setSort(v); setPage(1); }} />
      </TitleRow>
      <Stats>
        {num(items.length)} patch{items.length === 1 ? '' : 'es'} · {num(listed)} listed · models: {models.join(', ') || '—'}.
        Patches on the same benchmark schema compete on the same questions; when their address sets overlap the newer listing supersedes the older one.
        {' '}<StyledLink to="/explore">Back to Explore</StyledLink>
      </Stats>
      <div>
        {visible.map((e) => <PatchListItem key={e.anchor.id} entry={e} currency={info?.currency} />)}
      </div>
      {items.length === 0 && <Empty>No patches for this benchmark.</Empty>}
      {items.length > 0 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
    </PageWrapper>
  );
}
