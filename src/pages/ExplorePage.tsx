import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useCatalogQuery, useInfoQuery, errorMessage } from '@/api/api';
import { PatchListItem } from '@/components/public/PatchListItem';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, Empty, PageWrapper, Pagination, SelectBox, Title, TitleRow } from '@/components/ui/Misc';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Popular' },
  { value: 'latest', label: 'Latest' },
  { value: 'price', label: 'Price' },
  { value: 'rows', label: 'Rows' },
];
const ITEM_LIMIT = 10;

const Filters = styled.div`
  display: flex; flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 24px;
`;
const FilterGroup = styled.div`
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  span.label { font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-right: 2px; }
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

export default function ExplorePage() {
  const [sort, setSort] = useState<'popular' | 'latest' | 'price' | 'rows'>('popular');
  const [model, setModel] = useState('');
  const [schema, setSchema] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data: info } = useInfoQuery();
  const { data, isLoading, isFetching, error } = useCatalogQuery({ sort, model: model || undefined, schema: schema || undefined, q: q || undefined, limit: 200 });

  const items = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / ITEM_LIMIT));
  const current = Math.min(page, pageCount);
  const visible = useMemo(() => items.slice((current - 1) * ITEM_LIMIT, current * ITEM_LIMIT), [items, current]);

  const reset = () => setPage(1);

  return (
    <PageWrapper>
      <TitleRow>
        <Title>Explore</Title>
        <SelectBox options={SORT_OPTIONS} value={sort} onChange={(v) => { setSort(v as typeof sort); reset(); }} />
      </TitleRow>

      <Filters>
        {!!data?.models.length && (
          <FilterGroup>
            <span className="label">Model</span>
            <Chip $active={!model} onClick={() => { setModel(''); reset(); }}>All</Chip>
            {data.models.map((m) => <Chip key={m} $active={model === m} onClick={() => { setModel(model === m ? '' : m); reset(); }}>{m}</Chip>)}
          </FilterGroup>
        )}
        {!!data?.schemas.length && (
          <FilterGroup>
            <span className="label">Benchmark</span>
            <Chip $active={!schema} onClick={() => { setSchema(''); reset(); }}>All</Chip>
            {data.schemas.map((s) => <Chip key={s} $active={schema === s} onClick={() => { setSchema(schema === s ? '' : s); reset(); }}>{s}</Chip>)}
          </FilterGroup>
        )}
        <Search placeholder="Search patches…" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} aria-label="search" />
      </Filters>

      {error && <Alert $tone="error">{errorMessage(error)}</Alert>}
      {isLoading && <CenterProgress />}
      {!isLoading && data && (
        <>
          <Count>{data.total} patch{data.total === 1 ? '' : 'es'}{isFetching ? ' · updating…' : ''}</Count>
          <div>
            {visible.map((e) => <PatchListItem key={e.anchor.id} entry={e} currency={info?.currency} />)}
          </div>
          {items.length === 0 && <Empty>No patches match. Try another model, benchmark or search term.</Empty>}
          {items.length > 0 && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
        </>
      )}
    </PageWrapper>
  );
}
