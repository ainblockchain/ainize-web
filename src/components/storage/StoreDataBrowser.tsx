/**
 * The store page's Data tab — Vercel's data browser: for Postgres, the tables of a database down the side, the rows
 * of the chosen one as a grid (50 a page, ordered by a column), and a read-only SQL box (one statement, `app_ro`,
 * ten seconds, 200 rows); for Blob, the bucket's objects under a prefix with breadcrumbs, a Download per object, and
 * Previous / Next / First page over the node's `after` cursor (the cursors already passed are kept to go back).
 *
 * Everything here needs the write role (the node refuses `read` 403); the component is told whether it has it and
 * says so instead of asking.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStoreObjectsQuery, useStoreQueryMutation, useStoreRowsQuery, useStoreTablesQuery } from '@/api/api';
import {
  bytesLabel, DEFAULT_DATABASE, objectPagesAfter, objectPagesNext, objectPagesPrev, objectPagesStart, QUERY_MAX_BYTES, QUERY_TIMEOUT_S, ROWS_MAX, storeObjectDownloadUrl,
  type ObjectPages, type QueryResult, type StoreDetail, type StoreRows,
} from '@/api/projectStorage';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, Select, Textarea } from '@/components/ui/Form';
import { ExternalLink, Mono, Pagination } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import styled from 'styled-components';
import { Actions, Help, Meta, Panel, Row, Spacer, storageErrorText } from './common';

const PAGE = 50;
const Split = styled.div`display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: 240px minmax(0, 1fr); }`;
const Side = styled.nav`display: flex; flex-direction: column; gap: 2px; min-width: 0; max-height: 480px; overflow: auto; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px; padding: 6px;`;
const TableBtn = styled.button<{ $active?: boolean }>`
  display: flex; gap: 8px; align-items: center; width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; cursor: pointer; text-align: left; font-size: 13px;
  background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : 'transparent')}; color: ${(p) => p.theme.color.BLACK};
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
  span.n { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ${(p) => p.theme.font.mono}; }
  span.c { color: ${(p) => p.theme.color.GREY}; font-size: 12px; white-space: nowrap; }
`;
const SqlArea = styled(Textarea)`font-family: ${(p) => p.theme.font.mono}; font-size: 13px; min-height: 80px;`;
const Crumbs = styled.div`display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 13px; button { border: 0; background: transparent; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; padding: 2px 4px; font-size: 13px; }`;

const cell = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** A result as a grid — the rows tab and the SQL box share it. */
function Grid({ columns, rows, emptyText }: { columns: string[]; rows: unknown[][]; emptyText: string }) {
  if (!columns.length) return <Help>{emptyText}</Help>;
  return (
    <TableWrapper>
      <Table>
        <TableHeader><TableRow>{columns.map((c) => <TableHead key={c} $align="left"><Mono>{c}</Mono></TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => <TableRow key={i}>{columns.map((c, j) => { const v = cell(r[j]); return <TableData key={c} $align="left" $mono $maxWidth="320px" $color={v === '' ? '#999' : undefined} title={v}>{v === '' ? 'NULL' : v}</TableData>; })}</TableRow>)}
        </TableBody>
      </Table>
    </TableWrapper>
  );
}

function PostgresBrowser({ store }: { store: StoreDetail }) {
  const { t } = useT();
  const databases = store.postgres?.databases.length ? store.postgres.databases : [DEFAULT_DATABASE];
  const [database, setDatabase] = useState(databases[0]!);
  const tables = useStoreTablesQuery({ sid: store.id, database }, { skip: store.status !== 'ready' });
  const [picked, setPicked] = useState<{ schema: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<{ column: string; dir: 'asc' | 'desc' } | null>(null);
  useEffect(() => { setPicked(null); setPage(1); setOrder(null); }, [database]);
  const first = tables.data?.tables[0];
  const current = picked ?? (first ? { schema: first.schema, name: first.name } : null);
  const rows = useStoreRowsQuery({ sid: store.id, schema: current?.schema ?? '', table: current?.name ?? '', database, limit: PAGE, offset: (page - 1) * PAGE, order: order?.column, dir: order?.dir }, { skip: !current || store.status !== 'ready' });
  const data: StoreRows | undefined = rows.data;
  const pageCount = data?.total != null ? Math.max(1, Math.ceil(data.total / PAGE)) : data && data.rows.length === PAGE ? page + 1 : page;

  const [sql, setSql] = useState('');
  const [run, running] = useStoreQueryMutation();
  const [result, setResult] = useState<QueryResult | null>(null);
  const [sqlErr, setSqlErr] = useState<string | null>(null);
  const tooLong = new TextEncoder().encode(sql).length > QUERY_MAX_BYTES;
  const execute = async () => {
    setSqlErr(null);
    try { setResult(await run({ sid: store.id, sql, database }).unwrap()); }
    catch (e) { setResult(null); setSqlErr(storageErrorText(t, e)); }
  };

  if (store.status !== 'ready') return <Alert $tone="info">{t('storage.data.not_ready', { status: t(`storage.status.${store.status}`) })}</Alert>;
  return (
    <>
      <Panel>
        <Row>
          <h3>{t('storage.data.tables')}</h3>
          {databases.length > 1 && (
            <Select aria-label={t('storage.data.database')} value={database} onChange={(e) => setDatabase(e.target.value)} style={{ width: 'auto' }}>
              {databases.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          )}
          <Spacer />
          <Button size="small" loading={tables.isFetching} onClick={() => { void tables.refetch(); void rows.refetch(); }}>{t('storage.data.refresh')}</Button>
        </Row>
        {tables.error && <Alert $tone="error">{storageErrorText(t, tables.error)}</Alert>}
        {tables.data && tables.data.tables.length === 0 && <Help>{t('storage.data.empty')}</Help>}
        {tables.data && tables.data.tables.length > 0 && (
          <Split>
            <Side aria-label={t('storage.data.tables')}>
              {tables.data.tables.map((tb) => (
                <TableBtn key={`${tb.schema}.${tb.name}`} type="button" $active={current?.schema === tb.schema && current?.name === tb.name} aria-pressed={current?.schema === tb.schema && current?.name === tb.name} onClick={() => { setPicked({ schema: tb.schema, name: tb.name }); setPage(1); setOrder(null); }} title={`${tb.schema}.${tb.name} · ${bytesLabel(tb.bytes)}`}>
                  <span className="n">{tb.schema === 'public' ? tb.name : `${tb.schema}.${tb.name}`}</span>
                  <span className="c">{tb.rows ?? '—'}</span>
                </TableBtn>
              ))}
            </Side>
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {current && (
                <Row>
                  <Mono>{current.schema}.{current.name}</Mono>
                  {data && <Meta>{t('storage.data.rows_total', { n: data.total ?? '?' })}</Meta>}
                  <Spacer />
                  {data && data.columns.length > 0 && (
                    <Select aria-label={t('storage.data.order')} value={order ? `${order.column}:${order.dir}` : ''} onChange={(e) => { const [c, d] = e.target.value.split(':'); setOrder(c ? { column: c, dir: d === 'desc' ? 'desc' : 'asc' } : null); setPage(1); }} style={{ width: 'auto' }}>
                      <option value="">{t('storage.data.order_none')}</option>
                      {data.columns.flatMap((c) => [<option key={`${c.name}:asc`} value={`${c.name}:asc`}>{c.name} ↑</option>, <option key={`${c.name}:desc`} value={`${c.name}:desc`}>{c.name} ↓</option>])}
                    </Select>
                  )}
                </Row>
              )}
              {rows.error && <Alert $tone="error">{storageErrorText(t, rows.error)}</Alert>}
              {data && <Grid columns={data.columns.map((c) => c.name)} rows={data.rows} emptyText={t('storage.data.no_rows')} />}
              {data && pageCount > 1 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
            </div>
          </Split>
        )}
      </Panel>
      <Panel>
        <h3>{t('storage.data.sql')}</h3>
        <Help>{t('storage.data.query_help', { s: QUERY_TIMEOUT_S, n: ROWS_MAX })}</Help>
        <Field>
          <FieldLabel htmlFor="store-sql">SQL · <Mono>{database}</Mono></FieldLabel>
          <SqlArea id="store-sql" value={sql} spellCheck={false} autoCapitalize="none" autoCorrect="off" placeholder="SELECT * FROM users ORDER BY created_at DESC" onChange={(e) => setSql(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && sql.trim() && !tooLong) void execute(); }} />
        </Field>
        <Actions>
          <Button variant="contained" size="small" loading={running.isLoading} disabled={!sql.trim() || tooLong} onClick={() => void execute()}>{t('storage.data.run')}</Button>
          {tooLong && <Meta>{t('storage.data.sql_too_long', { kb: QUERY_MAX_BYTES / 1024 })}</Meta>}
          {result && <Meta>{t('storage.data.result_meta', { n: result.rowCount, ms: result.ms })}{result.truncated ? ` · ${t('storage.data.truncated', { n: ROWS_MAX })}` : ''}</Meta>}
        </Actions>
        {sqlErr && <Alert $tone="error">{sqlErr}</Alert>}
        {result && <Grid columns={result.columns} rows={result.rows} emptyText={t('storage.data.no_rows')} />}
      </Panel>
    </>
  );
}

function BlobBrowser({ store }: { store: StoreDetail }) {
  const { t } = useT();
  const [prefix, setPrefix] = useState('');
  const [pages, setPages] = useState<ObjectPages>(objectPagesStart);
  const after = objectPagesAfter(pages);
  const q = useStoreObjectsQuery({ sid: store.id, prefix: prefix || undefined, after, limit: 200 }, { skip: store.status !== 'ready' });
  const crumbs = useMemo(() => prefix.split('/').filter(Boolean), [prefix]);
  const go = (p: string) => { setPrefix(p); setPages(objectPagesStart()); };
  const pageNo = pages.trail.length;
  if (store.status !== 'ready') return <Alert $tone="info">{t('storage.data.not_ready', { status: t(`storage.status.${store.status}`) })}</Alert>;
  return (
    <Panel>
      <Row>
        <h3>{t('storage.data.objects')}</h3>
        <Spacer />
        <Button size="small" loading={q.isFetching} onClick={() => void q.refetch()}>{t('storage.data.refresh')}</Button>
      </Row>
      <Crumbs aria-label={t('storage.data.prefix')}>
        <button type="button" onClick={() => go('')}><Mono>app/</Mono></button>
        {crumbs.map((c, i) => <span key={i}><button type="button" onClick={() => go(`${crumbs.slice(0, i + 1).join('/')}/`)}><Mono>{c}/</Mono></button></span>)}
      </Crumbs>
      {q.error && <Alert $tone="error">{storageErrorText(t, q.error)}</Alert>}
      {q.data && q.data.prefixes.length === 0 && q.data.objects.length === 0 && <Help>{t('storage.data.objects_empty')}</Help>}
      {q.data && (q.data.prefixes.length > 0 || q.data.objects.length > 0) && (
        <TableWrapper>
          <Table>
            <TableHeader><TableRow><TableHead $align="left">{t('storage.data.key')}</TableHead><TableHead $align="right">{t('storage.data.size')}</TableHead><TableHead $align="left">{t('storage.data.modified')}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {q.data.prefixes.map((p) => (
                <TableRow key={p}><TableData $align="left" $mono $maxWidth="480px"><button type="button" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#8b3eeb', fontFamily: 'inherit', fontSize: 'inherit' }} onClick={() => go(p)}>{p.slice(prefix.length)}</button></TableData><TableData $align="right">—</TableData><TableData $align="left">—</TableData><TableData /></TableRow>
              ))}
              {q.data.objects.map((o) => (
                <TableRow key={o.key}>
                  <TableData $align="left" $mono $maxWidth="480px" title={o.key}>{o.key.slice(prefix.length)}</TableData>
                  <TableData $align="right">{bytesLabel(o.size)}</TableData>
                  <TableData $align="left">{o.lastModified ? new Date(o.lastModified).toLocaleString() : '—'}</TableData>
                  <TableData><ExternalLink href={storeObjectDownloadUrl(store.id, o.key)} target="_blank" rel="noreferrer">{t('storage.data.download')}</ExternalLink></TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
      {(pageNo > 1 || q.data?.next) && (
        <Actions role="group" aria-label={t('storage.data.pages')}>
          {pageNo > 2 && <Button size="small" variant="text" onClick={() => setPages(objectPagesStart())}>{t('storage.data.first_page')}</Button>}
          {pageNo > 1 && <Button size="small" onClick={() => setPages(objectPagesPrev)}>{t('storage.data.prev')}</Button>}
          <Meta aria-live="polite">{t('storage.data.page_n', { n: pageNo })}</Meta>
          {q.data?.next && <Button size="small" onClick={() => { const next = q.data?.next; if (next) setPages((p) => objectPagesNext(p, next)); }}>{t('storage.data.more')}</Button>}
        </Actions>
      )}
    </Panel>
  );
}

export default function StoreDataBrowser({ store, canBrowse }: { store: StoreDetail; canBrowse: boolean }) {
  const { t } = useT();
  if (!canBrowse) return <Panel><Alert $tone="info">{t('storage.data.write_only')}</Alert></Panel>;
  return store.kind === 'postgres' ? <PostgresBrowser store={store} /> : <BlobBrowser store={store} />;
}
