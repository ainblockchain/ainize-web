import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  api, errorMessage, useBranchesQuery, useCreateBranchMutation, useEventsQuery, useInfoQuery, useMeQuery, useMyPatchesQuery,
  useMyPurchasesQuery, useRuntimeQuery,
} from '@/api/api';
import type { CatalogEntry } from '@/api/types';
import { purchaseRows, purchaseStanding } from '@/lib/purchaseView';
import { accountRuntime } from '@/lib/accountNodeActions';
import { dashboardInventory, inventoryRows, paidSales, statusRank } from '@/lib/dashboardView';
import { knowledgePath } from '@/lib/detailRoutes';
import { trackBranches } from '@/lib/trackView';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { createTrack, trackCreationInput, TrackCreationError } from '@/lib/trackCreation';
import { LoadKnowledgeError } from '@/lib/loadKnowledge';
import { useActiveView } from '@/hooks/useActiveView';
import { VerificationWork } from '@/components/operator/VerificationWork';
import { logEvents } from '@/lib/logView';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Input, Select, TextField } from '@/components/ui/Form';
import { LogIcon, ManageIcon, OpenWindowIcon } from '@/components/ui/Icons';
import { CenterProgress, Empty, Pagination, PageWrapper, SelectBox, StatusChip, SubTitle, Tabs, Title, TitleRow, Description } from '@/components/ui/Misc';
import { SubText, Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { IconButton, LiveTestIcon, QueryError, Row, SmallSpinner, Stack, StatusText, Tip, isInFlight, useMoney } from '@/components/operator/common';
import { TrackAdditionForm } from '@/components/operator/TrackAdditionForm';
import { TrackCard } from '@/components/operator/TrackCard';
import { useLoadChain } from '@/components/detail/LoadChain';
import { num, shortAddr, shortHash } from '@/utils/format';

const NameLink = styled(Link)`
  font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { text-decoration: underline; }
`;
const IconLink = styled(Link)`
  display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-radius: 4px; &:hover { background: #f5eefc; }
`;
const BranchGrid = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr)); gap: 16px; margin-top: 16px;`;
const MiniForm = styled.form`
  margin-top: 16px; padding: 16px 20px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; display: flex; flex-direction: column; gap: 14px; max-width: 640px;
`;
const ContextRow = styled.div`display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 12px; align-items: end; @media (max-width: 640px) { grid-template-columns: minmax(0, 1fr); }`;
const FieldLabel = styled.span`font-size: 12px; color: #8d8d8f; font-weight: 500;`;

/**
 * Finding 31 — the inventory was `items.map` over the whole catalogue: 103 rows in a 12,134 px page with no filter,
 * no sort, no paging and no count, and 28 of those rows shared one name. These are the controls /explore already
 * uses, over the operator's own list, so picking the right row among the duplicates stops being guesswork.
 */
const Toolbar = styled.div`
  display: flex; flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
`;
const FilterGroup = styled.div`
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  span.label { font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-right: 2px; cursor: default; }
`;
const FilterChip = styled.button<{ $active: boolean }>`
  padding: 3px 12px; border-radius: 14px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap;
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  color: ${(p) => (p.$active ? p.theme.color.HOVER : p.theme.color.BLACK)};
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
`;
const Search = styled(Input)`max-width: 300px; margin-left: auto;`;
const IdText = styled.span`
  font-family: ${(p) => p.theme.font.mono}; font-weight: 600; color: ${(p) => p.theme.color.DARK_GREY}; user-select: all;
`;
const CountLine = styled.div`
  font-size: 12px; color: ${(p) => p.theme.color.GREY}; padding-bottom: 8px;
  button { padding: 0; margin-left: 8px; border: 0; background: none; font: inherit; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; text-decoration: underline; }
`;
/** Finding 133 — the way into the node-wide log, with what it has to say about itself since the last visit. */
const LogLink = styled(Link)`
  display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; text-decoration: none;
  color: ${(p) => p.theme.color.PRIMARY};
  &:hover { text-decoration: underline; }
`;
const LogBadge = styled.span`
  padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; background: #fff3e0; color: #8a4b00;
`;

const PAGE_SIZE = 25;
const NODELOG_SEEN = 'ainize.nodelog.seen';

/** Teaching tab (spec §5.13) is code-split: most operators open My knowledge far more often than the teach queue. */
const TeachingTab = lazy(() => import('@/components/operator/TeachingTab'));

export default function DashboardPage() {
  const { cacheIdentity } = useAuth();
  return <DashboardContent key={cacheIdentity} />;
}

export function DashboardContent() {
  const { t, term, help, tech } = useT();
  useTitle(t('op.dash.title'));
  const money = useMoney();
  const auth = useAuth();
  const { address, cacheIdentity, loading: authLoading } = auth;
  const active = useActiveView();
  const [creationTask] = useState(createNodeActionTask);
  useEffect(() => () => creationTask.abandon(), [creationTask]);
  const [creationBusy, setCreationBusy] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);
  const [readBranchAccess] = api.useLazyMeQuery();
  const [readBranches] = api.useLazyBranchesQuery();
  const [readInventory] = api.useLazyMyPatchesQuery();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: 'knowledge' | 'teaching' = params.get('tab') === 'teaching' ? 'teaching' : 'knowledge';
  const setTab = (id: string) => { const next = new URLSearchParams(params); if (id === 'teaching') next.set('tab', 'teaching'); else next.delete('tab'); setParams(next, { replace: true }); };
  const { data: info } = useInfoQuery();
  const { data: me } = useMeQuery();
  const currency = info?.currency ?? '';
  const [inFlight, setInFlight] = useState(false);
  const patches = useMyPatchesQuery({ identity: cacheIdentity }, { pollingInterval: inFlight ? 5000 : 0, skip: authLoading });
  const inventory = !authLoading && !patches.isError ? dashboardInventory(patches.currentData) : null;
  const items = inventory ?? [];
  const inventoryFailed = !authLoading && (patches.isError || !inventory && !patches.isFetching);
  const anyInFlight = items.some((e) => isInFlight(e.status));
  if (anyInFlight !== inFlight) setInFlight(anyInFlight);

  const purchases = useMyPurchasesQuery({ identity: cacheIdentity }, { skip: authLoading });
  const purchased = !authLoading && !purchases.isError ? purchaseRows(purchases.currentData) : null;
  const runtime = useRuntimeQuery({ identity: cacheIdentity }, { skip: authLoading });
  const model = !authLoading && !runtime.isError ? accountRuntime(runtime.currentData) : null;
  /**
   * SC-15 — this is the table where a bought add-on is loaded, so it is where the base has to be offered: a bare
   * apply answered `needs_base` with a code, on the one screen whose whole job is turning a purchase into a model
   * that knows something.
   */
  const chain = useLoadChain((id) => purchased?.find((x) => x.patch_id === id)?.entry?.anchor.name || id);
  const branches = useBranchesQuery({ identity: cacheIdentity }, { skip: authLoading });
  const branchData = !branches.isError ? trackBranches(branches.currentData) : null;
  const [createBranch, createState] = useCreateBranchMutation();

  // create branch mini form
  const [bName, setBName] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [ctx, setCtx] = useState<{ k: string; v: string }[]>([{ k: 'jurisdiction', v: '' }]);
  const [bPatches, setBPatches] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const listedMine = useMemo(() => items.filter((e) => e.status === 'VERIFIED'), [items]);
  const ownedBranches = useMemo(() => (branchData?.branches ?? []).filter((b) => b.owner.toLowerCase() === address?.toLowerCase()), [branchData, address]);

  // ---------------------------------------------------------------- finding 31: search, status filter, sort, paging
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<'status' | 'new' | 'name' | 'sales'>('status');
  const [page, setPage] = useState(1);
  const resetPage = () => setPage(1);

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of items) m.set(e.status, (m.get(e.status) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => statusRank(a[0]) - statusRank(b[0]));
  }, [items]);

  const matched = useMemo(() => inventoryRows(items, q, statusFilter, sort), [items, q, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  useEffect(() => { if (inventory && page > pageCount) setPage(pageCount); }, [inventory, page, pageCount]);
  const visible = useMemo(() => matched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [matched, currentPage]);
  const narrowed = statusFilter !== 'all' || !!q.trim();
  const clearFilters = () => { setQ(''); setStatusFilter('all'); resetPage(); };

  // ---------------------------------------------------------------- finding 133: what the node log has to say
  const [logSeen] = useState(() => { try { return Number(localStorage.getItem(NODELOG_SEEN)) || 0; } catch { return 0; } });
  const recentEvents = useEventsQuery({ limit: 200, identity: cacheIdentity }, { skip: authLoading });
  const unseenBad = (!authLoading && !recentEvents.isError ? logEvents(recentEvents.currentData) ?? [] : []).filter((e) => (e.level === 'warn' || e.level === 'error') && e.ts > logSeen).length;

  const onCreateBranch = async (e: FormEvent) => {
    e.preventDefault();
    const current = () => active() && auth.isCurrentAccount();
    if (creationTask.pending() || !current() || !auth.isOwner || !branchData || !inventory) return;
    setCreationError(null); setCreatedName(null); setCreationBusy(true);
    let stillCurrent = current;
    try {
      const input = trackCreationInput(bName, bDesc, ctx, bPatches);
      const name = await creationTask.run(current, async check => {
        stillCurrent = check;
        return createTrack(input, {
          current: check, node: address, subject: auth.subject,
          readAccess: () => readBranchAccess(undefined, false).unwrap(),
          readBranches: () => readBranches({ identity: cacheIdentity }, false).unwrap(),
          readInventory: () => readInventory({ identity: cacheIdentity }, false).unwrap(),
          write: value => createBranch(value).unwrap(),
        });
      });
      if (name && stillCurrent()) {
        setCreatedName(name); setBName(''); setBDesc(''); setBPatches([]); setCtx([{ k: 'jurisdiction', v: '' }]);
      }
    } catch (err) {
      if (stillCurrent()) setCreationError(err instanceof TrackCreationError ? t(`op.dash.branch.error.${err.code}`)
        : err instanceof LoadKnowledgeError ? t(`detail.apply.error.${err.code}`) : errorMessage(err));
    } finally { if (stillCurrent()) setCreationBusy(false); }
  };
  const run = async (fn: () => Promise<unknown>) => { setActionError(null); try { await fn(); } catch (err) { setActionError(errorMessage(err)); } };

  const salesText = (e: CatalogEntry) => t('op.dash.sales.cell', { n: paidSales(e) === null ? '—' : num(paidSales(e)!), revenue: money.revenue(e.revenue, e.anchor.currency || currency) });
  /** Item 194: what the sale price was, and what of it reached this node — the gross figure alone is not earnings. */
  const salesNet = (e: CatalogEntry) => (Number(e.revenue_shared ?? 0) > 0
    ? t('op.dash.sales.net', { revenue: money.revenue(e.revenue, e.anchor.currency || currency), net: money.revenue(e.revenue_net ?? e.revenue, e.anchor.currency || currency), shared: money.revenue(e.revenue_shared ?? '0', e.anchor.currency || currency) })
    : '');
  /*
   * Item 362 — `money.fmt` already renders the unit ("8 node credit"), and this appended the scheme, which on a
   * local-ledger node is the same words: "8 node credit (node credit)". The scheme is only worth printing when it
   * says something the amount does not: which wallet paid, or that nothing did.
   */
  const schemeText = (scheme: string, currency?: string | null) => (scheme === 'ain-transfer' ? (currency === 'AIN' ? '' : t('op.dash.purchases.scheme.ain'))
    : scheme === 'local-credit' ? (currency === 'CREDIT' ? '' : t('op.dash.purchases.scheme.credit'))
    : scheme === 'free' ? t('op.dash.purchases.scheme.free') : scheme);
  /** Item 362: what this node chose to buy, and what a track bought on its behalf. */
  const originText = (origin?: string) => (origin?.startsWith('subscription:')
    ? t('op.dash.purchases.origin.subscription', { track: origin.slice('subscription:'.length) })
    : '');

  const HEADERS: { key: string; label: string; tip?: string }[] = [
    { key: 'name', label: t('op.dash.col.name') },
    { key: 'status', label: t('op.dash.col.status') },
    { key: 'verif', label: t('op.dash.col.verif'), tip: `${help('verified')} · ${tech('verified')}` },
    { key: 'sales', label: t('op.dash.col.sales'), tip: t('op.dash.sales.hint') },
    { key: 'logs', label: t('op.dash.col.logs') },
    { key: 'gateway', label: t('op.dash.col.gateway'), tip: `${t('op.term.gateway.help')} · ${tech('autoPay')}` },
    { key: 'test', label: t('op.dash.col.test'), tip: help('liveTest') },
    { key: 'manage', label: t('op.dash.col.manage') },
  ];

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{t('op.dash.title')}</Title>
        <LogLink to="/logs" data-testid="nodelog-link">
          {t('op.dash.nodelog')}
          {unseenBad > 0 && <LogBadge title={t('op.dash.nodelog.badge.help')} data-testid="nodelog-badge">{t('op.dash.nodelog.badge', { n: unseenBad })}</LogBadge>}
        </LogLink>
        {tab === 'knowledge' && <Button variant="outlined" color="primary" onClick={() => navigate('/new-patch')}>{t('op.dash.register')}</Button>}
      </TitleRow>
      <div style={{ marginBottom: 24 }}>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'knowledge', label: t('op.dash.tab.knowledge') }, { id: 'teaching', label: t('op.dash.tab.teaching') }]} />
      </div>
      {tab === 'teaching' && <Suspense fallback={<CenterProgress />}><TeachingTab /></Suspense>}
      {tab === 'knowledge' && (<>
      {/* Item 335: what this node's verifier role actually did — above its own knowledge, which may be none. */}
      {me?.address && <VerificationWork address={me.address} />}
      {actionError && <Alert $tone="error" style={{ marginBottom: 16 }}>{actionError}</Alert>}
      {chain.error && <Alert $tone="error" style={{ marginBottom: 16 }} data-testid="apply-error">{chain.error}</Alert>}
      {chain.notice && <Alert $tone="success" style={{ marginBottom: 16 }} data-testid="apply-order">{chain.notice}</Alert>}
      {chain.dialog}

      {/* ---------------------------------------------------------------- my knowledge */}
      {inventoryFailed && <QueryError error={patches.error} what={t('op.error.what.patches')} retrying={patches.isFetching} onRetry={() => void patches.refetch()} />}
      {inventoryFailed ? null : !inventory ? <CenterProgress /> : (<>
        {/* Finding 31: search, narrow, order and count — the list stopped fitting on a screen long ago. */}
        {(items.length > 0 || narrowed) && (
          <Toolbar>
            <FilterGroup>
              <span className="label">{t('op.dash.filter.status')}</span>
              <FilterChip type="button" aria-pressed={statusFilter === 'all'} $active={statusFilter === 'all'} onClick={() => { setStatusFilter('all'); resetPage(); }}>{t('op.dash.filter.all', { n: items.length })}</FilterChip>
              {statusCounts.map(([s, n]) => (
                <FilterChip key={s} type="button" aria-pressed={statusFilter === s} $active={statusFilter === s} onClick={() => { setStatusFilter(statusFilter === s ? 'all' : s); resetPage(); }}>
                  {t('op.dash.filter.count', { label: t(`status.${s}`) === `status.${s}` ? s : t(`status.${s}`), n })}
                </FilterChip>
              ))}
            </FilterGroup>
            <span title={t('op.dash.sort.status.help')}>
              <SelectBox
                label={t('common.sort_aria')}
                value={sort}
                onChange={(v) => { setSort(v as typeof sort); resetPage(); }}
                options={(['status', 'new', 'name', 'sales'] as const).map((s) => ({ value: s, label: t(`op.dash.sort.${s}`) }))}
              />
            </span>
            <Search placeholder={t('op.dash.search')} aria-label={t('op.dash.search')} value={q} onChange={(e) => { setQ(e.target.value); resetPage(); }} data-testid="dash-search" />
          </Toolbar>
        )}
        {items.length > 0 && (
          <CountLine data-testid="dash-count">
            {narrowed
              ? t('op.dash.count.filtered', { shown: matched.length, total: items.length, from: matched.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1, to: Math.min(currentPage * PAGE_SIZE, matched.length) })
              : t('op.dash.count', { total: items.length, from: (currentPage - 1) * PAGE_SIZE + 1, to: Math.min(currentPage * PAGE_SIZE, matched.length) })}
            {narrowed && <button type="button" onClick={clearFilters}>{t('op.dash.clear')}</button>}
          </CountLine>
        )}
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                {HEADERS.map((h, i) => (
                  <TableHead key={h.key} $align={i === 0 ? 'left' : 'center'} $padding={i === 0 ? '0 0 0 32px' : undefined}>
                    {h.tip ? <Tip tech={h.tip}>{h.label}</Tip> : h.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((e) => {
                const a = e.anchor;
                const author = a.author;
                return (
                  <TableRow key={a.id}>
                    <TableData $align="left" $padding="8px 0 8px 32px" $maxWidth="360px">
                      <NameLink to={knowledgePath(author, a.id)}>{a.name || a.id}</NameLink>
                      {/* Finding 31: with 28 rows called "O69 grace period" the id is the identity, not a footnote —
                          it reads in the mono face, at full length, and one click selects the whole of it. */}
                      <SubText title={a.id}><IdText>{a.id}</IdText> · {a.model.id_M} · {t('op.dash.questions', { n: num(a.benchmark.queries) })}</SubText>
                    </TableData>
                    <TableData>
                      <StatusText style={{ justifyContent: 'center' }}>
                        {isInFlight(e.status) && e.status !== 'CHALLENGED' && <SmallSpinner />}
                        <StatusChip status={e.status} />
                      </StatusText>
                    </TableData>
                    <TableData title={`${t('op.term.executed')}: ${t('op.term.executed.help')}\n${t('op.term.integrity')}: ${t('op.term.integrity.help')}`}>
                      <div>{t('op.term.executed')} {e.passed}/{e.quorum}</div>
                      <SubText>{t('op.term.integrity')} {e.integrity_checks}</SubText>
                    </TableData>
                    <TableData title={salesNet(e) || t('op.dash.sales.hint')} data-testid="dash-sales">
                      {salesText(e)}
                      {salesNet(e) && <SubText style={{ display: 'block' }}>{salesNet(e)}</SubText>}
                    </TableData>
                    <TableData>
                      <IconButton aria-label={t('op.dash.col.logs')} title={t('op.dash.col.logs')} onClick={() => navigate(`/project${knowledgePath(author, a.id)}/logs`)}><LogIcon /></IconButton>
                    </TableData>
                    <TableData>
                      {a.gateway_url ? (
                        <a href={a.gateway_url} target="_blank" rel="noopener noreferrer" aria-label={t('op.term.gateway')} title={`${t('op.term.gateway')} · ${a.gateway_url}`} style={{ display: 'inline-flex', padding: 6 }}><OpenWindowIcon /></a>
                      ) : <span style={{ color: '#dadada' }}>—</span>}
                    </TableData>
                    <TableData>
                      <IconLink to={`/chat/${encodeURIComponent(a.id)}`} aria-label={t('op.livetest')} title={`${t('op.livetest')} — ${t('op.livetest.hint')}`}><LiveTestIcon /></IconLink>
                    </TableData>
                    <TableData>
                      <IconButton aria-label={t('op.dash.col.manage')} title={t('op.dash.col.manage')} onClick={() => navigate(`/project${knowledgePath(author, a.id)}`)}><ManageIcon /></IconButton>
                    </TableData>
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRowEmpty $height={160}><td colSpan={HEADERS.length}>{t('op.dash.empty')}</td></TableRowEmpty>}
              {items.length > 0 && matched.length === 0 && (
                <TableRowEmpty $height={120}><td colSpan={HEADERS.length}>
                  <Empty style={{ padding: 0, border: 0 }} data-testid="dash-nomatch">
                    {t('op.dash.nomatch')}
                    <div style={{ marginTop: 10 }}><Button size="small" variant="text" onClick={clearFilters}>{t('op.dash.clear')}</Button></div>
                  </Empty>
                </td></TableRowEmpty>
              )}
            </TableBody>
          </Table>
        </TableWrapper>
        {matched.length > PAGE_SIZE && <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />}
      </>)}

      {/* ---------------------------------------------------------------- purchases */}
      <SubTitle $mt={56}>{t('op.dash.purchases.title')}</SubTitle>
      <Description title={tech('autoPay')}>{t('op.dash.purchases.desc')}</Description>
      {(purchases.isError || purchases.currentData && !purchased) && <QueryError error={purchases.error} what={t('op.error.what.purchases')} retrying={purchases.isFetching} onRetry={() => void purchases.refetch()} />}
      {!purchases.isError && !purchases.currentData && <CenterProgress />}
      {purchased && (
      <TableWrapper style={{ marginTop: 16 }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead $align="left" $padding="0 0 0 32px">{t('op.knowledge')}</TableHead>
              <TableHead>{t('op.dash.purchases.col.paid')}</TableHead>
              <TableHead>{t('op.dash.purchases.col.tx')}</TableHead>
              <TableHead>{t('op.dash.purchases.col.file')}</TableHead>
              <TableHead>{t('op.dash.purchases.col.loaded')}</TableHead>
              <TableHead><Tip tech={`${tech('apply')} / ${tech('remove')}`}>{t('op.dash.purchases.col.actions')}</Tip></TableHead>
              <TableHead>{t('op.livetest')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchased.map((p) => {
              const author = p.entry?.anchor.author;
              const payment = p.payment;
              const cur = payment?.currency ?? '';
              const standing = purchaseStanding(p, model);
              const canChange = auth.isOwner && model?.available && p.currentFile && !chain.busy;
              const busy = chain.busy && chain.busyId === p.patch_id;
              return (
                <TableRow key={p.patch_id}>
                  <TableData $align="left" $padding="8px 0 8px 32px" $maxWidth="320px">
                    {author ? <NameLink to={knowledgePath(author, p.patch_id)}>{p.entry?.anchor.name ?? p.patch_id}</NameLink> : <strong>{p.patch_id}</strong>}
                    <SubText>{p.entry ? p.patch_id : shortHash(p.sha256, 16)}</SubText>
                    {p.entry && !p.currentFile && <SubText>{t('op.dash.purchases.changedFile')}</SubText>}
                  </TableData>
                  <TableData title={payment?.currency ? money.note(cur) : undefined} data-testid="purchase-paid">
                    {!payment ? t('op.dash.purchases.paymentUnknown') : payment.evidence === 'free' ? t('op.dash.purchases.scheme.free') : `${payment.amount} ${money.unit(cur)}`}
                    {payment && payment.evidence !== 'free' && schemeText(payment.scheme, cur) && <SubText style={{ display: 'inline' }}> ({schemeText(payment.scheme, cur)})</SubText>}
                    {originText(p.origin) && <SubText style={{ display: 'block' }}>{originText(p.origin)}</SubText>}
                    {/* Item 280: the settle record has carried the split all along, and the buyer was shown a tx hash. */}
                    {(p.payees?.length ?? 0) > 0 && (
                      <SubText style={{ display: 'block' }} data-testid="purchase-payees">{t('op.dash.purchases.paid_to', {
                        who: p.payees!.map((x) => t('op.dash.purchases.paid_to.line', { name: x.name ?? shortAddr(x.address, 6), amount: `${x.amount} ${money.unit(cur)}` })).join(' · '),
                      })}</SubText>
                    )}
                  </TableData>
                  <TableData $mono title={p.tx_hash}>{shortHash(p.tx_hash, 12)}</TableData>
                  <TableData $mono title={p.path ?? ''}>{p.path ? `…/${p.path.split('/').slice(-1)[0].slice(0, 18)}` : '—'}</TableData>
                  <TableData>{t(`op.dash.purchases.record.${standing?.state ?? 'unknown'}`, { id: standing?.id ?? '' })}</TableData>
                  <TableData>
                    <Row $gap={6} $justify="center">
                      <Button size="small" title={help('apply')} disabled={!canChange || standing?.state !== 'absent'} loading={busy && standing?.state === 'absent'} onClick={() => { setActionError(null); if (p.entry) void chain.load(p.entry.anchor); }}>{term('apply')}</Button>
                      <Button size="small" color="secondary" title={help('remove')} disabled={!canChange || standing?.state !== 'recorded'} loading={busy && standing?.state === 'recorded'} onClick={() => { setActionError(null); if (p.entry) void chain.unload(p.entry.anchor); }}>{term('remove')}</Button>
                    </Row>
                  </TableData>
                  <TableData>
                    {p.currentFile && <IconLink to={`/chat/${encodeURIComponent(p.patch_id)}`} aria-label={t('op.livetest')} title={`${t('op.livetest')} — ${t('op.livetest.hint')}`}><LiveTestIcon /></IconLink>}
                  </TableData>
                </TableRow>
              );
            })}
            {purchased.length === 0 && <TableRowEmpty $height={120}><td colSpan={7}>{purchases.isLoading ? <SmallSpinner /> : t('op.dash.purchases.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      )}
      {(runtime.isError || runtime.currentData && !model) && <QueryError error={runtime.error} what={t('op.dash.purchases.runtimeRead')} retrying={runtime.isFetching} onRetry={() => void runtime.refetch()} />}
      {/* SC-18 — the loaded stack, in the order the model holds it. A set of ids cannot answer the operator's
          question ("what is under what?"), and after L2 the order is a record the node keeps, not a guess. */}
      {!!model?.stack?.length && (
        <StatusText style={{ marginTop: 8 }} data-testid="ops-stack">
          {/* Item 214: WHY each layer is there — by hand, or by a track — was in the answer and on no screen. */}
          {t('ops.stack', { list: model.stack.map((l, i) => `${i + 1}. ${typeof l.name === 'string' ? l.name : l.patch_id} (${
            l.reason === 'base' ? t('ops.stack.base')
              : l.reason === 'manual' ? t('op.dash.branches.loadedby.manual')
                : l.reason?.startsWith('subscription:') ? t('op.dash.branches.loadedby.track', { track: l.reason.slice('subscription:'.length) })
                  : l.reason?.startsWith('chat:') ? t('ops.stack.livetest') : l.reason
          })`).join('  ·  ') })}
          {model.stack.some((l) => l.journal === false) && <div>{t('ops.stack.nojournal', { n: model.stack.filter((l) => l.journal === false).length })}</div>}
        </StatusText>
      )}
      {model && !model.available && <StatusText style={{ marginTop: 8 }}>{t('op.runtime.unavailable', { error: model.error ?? t('op.runtime.noapi') })}</StatusText>}

      {/* ---------------------------------------------------------------- knowledge tracks (branches) */}
      <SubTitle $mt={56}><Tip tech={tech('branch')}>{t('op.dash.branches.title')}</Tip></SubTitle>
      <Description>{t('op.dash.branches.desc')}</Description>
      {(branches.isError || branches.currentData && !branchData) && <QueryError error={branches.error} what={t('op.error.what.branches')} retrying={branches.isFetching} onRetry={() => void branches.refetch()} />}
      {branches.isLoading || !branches.currentData && !branches.isError ? <CenterProgress /> : !branchData ? null : (
        <BranchGrid>
          {branchData.branches.map((b) => (
            <TrackCard key={b.name} branch={b} subscribed={branchData.mine.includes(b.name)} currency={currency} address={address} />
          ))}
          {branchData.branches.length === 0 && <span style={{ color: '#8d8d8f', fontSize: 14 }}>{t('op.dash.branches.empty')}</span>}
        </BranchGrid>
      )}

      <MiniForm onSubmit={onCreateBranch}>
        {creationError && <Alert $tone="error" role="alert">{creationError}</Alert>}
        {createdName && <Alert $tone="success" role="status">{t('op.dash.branch.created', { name: createdName })}</Alert>}
        <fieldset disabled={creationBusy || !auth.isOwner || !branchData || !inventory} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <strong style={{ fontSize: 14 }}>{t('op.dash.branch.create')}</strong>
        <TextField label={t('op.dash.branch.name')} placeholder="law/KR" value={bName} onChange={(e) => setBName(e.target.value)} required />
        <TextField label={t('op.dash.branch.desc')} placeholder={t('op.dash.branch.desc.ph')} value={bDesc} onChange={(e) => setBDesc(e.target.value)} />
        <Stack $gap={8}>
          <FieldLabel title={t('op.tech.context')}>{t('op.dash.branch.ctx')}</FieldLabel>
          {ctx.map((c, i) => (
            <ContextRow key={i}>
              <TextField placeholder={t('op.dash.branch.ctx.k')} value={c.k} onChange={(e) => setCtx(ctx.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
              <TextField placeholder={t('op.dash.branch.ctx.v')} value={c.v} onChange={(e) => setCtx(ctx.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
              <Button type="button" size="small" variant="text" color="default" onClick={() => setCtx(ctx.filter((_, j) => j !== i))} disabled={ctx.length === 1}>{t('op.remove')}</Button>
            </ContextRow>
          ))}
          <div><Button type="button" size="small" variant="text" onClick={() => setCtx([...ctx, { k: '', v: '' }])}>{t('op.dash.branch.ctx.add')}</Button></div>
        </Stack>
        {listedMine.length > 0 && (
          <Stack $gap={6}>
            <FieldLabel>{t('op.dash.branch.initial')}</FieldLabel>
            {listedMine.map((e) => (
              <Checkbox key={e.anchor.id} label={<span>{e.anchor.name || e.anchor.id} <span style={{ color: '#8d8d8f' }}>· {e.anchor.id}</span></span>} checked={bPatches.includes(e.anchor.id)}
                onChange={(ev) => setBPatches(ev.target.checked ? [...bPatches, e.anchor.id] : bPatches.filter((x) => x !== e.anchor.id))} />
            ))}
          </Stack>
        )}
        <div><Button type="submit" loading={creationBusy || createState.isLoading} loadingText={t('op.dash.branch.creating')}>{t('op.dash.branch.submit')}</Button></div>
        </fieldset>
      </MiniForm>

      <TrackAdditionForm branches={ownedBranches} available={!!branchData} />
      </>)}
    </PageWrapper>
  );
}
