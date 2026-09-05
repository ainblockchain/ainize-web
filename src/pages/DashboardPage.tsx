import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useAddToBranchMutation, useBranchesQuery, useCreateBranchMutation, useEventsQuery, useInfoQuery, useLedgerQuery, useMeQuery, useMyPatchesQuery,
  useMyPurchasesQuery, useRuntimeQuery, useWalletQuery,
} from '@/api/api';
import type { CatalogEntry } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Input, Select, TextField } from '@/components/ui/Form';
import { LogIcon, ManageIcon, OpenWindowIcon } from '@/components/ui/Icons';
import { CenterProgress, Empty, Pagination, PageWrapper, SelectBox, StatusChip, SubTitle, Tabs, Title, TitleRow, Description } from '@/components/ui/Misc';
import { SubText, Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { IconButton, LiveTestIcon, QueryError, Row, SmallSpinner, Stack, StatusText, Tip, isInFlight, useMoney } from '@/components/operator/common';
import { TrackCard } from '@/components/operator/TrackCard';
import { useLoadChain } from '@/components/detail/LoadChain';
import { num, shortAddr, shortHash } from '@/utils/format';

/**
 * Item 335 — the console showed verification as no work at all: a node with 203 attestations on the record read
 * "No knowledge yet — register your first one", Account said "Roles: verifier" and nothing anywhere answered what
 * the node did this week, what came back, or what it earned for it. Every fact here is read from the public record
 * (`attest` records this node signed) and from the wallet's own verification rows — nothing is estimated, and the
 * things this build genuinely does not measure (GPU seconds, bytes held for verification alone) are not invented.
 */
const VerifyCard = styled.div`
  display: flex; flex-wrap: wrap; gap: 16px 32px; padding: 18px 22px; margin-bottom: 24px;
  background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const VerifyStat = styled.div`
  display: flex; flex-direction: column; min-width: 92px;
  b { font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; color: ${(p) => p.theme.color.BLACK}; }
  b.bad { color: ${(p) => p.theme.color.ERROR}; }
  span { margin-top: 3px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
`;
const VerifyNote = styled.div`flex: 1 1 100%; font-size: 12px; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;`;

const NameLink = styled(Link)`
  font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { text-decoration: underline; }
`;
const IconLink = styled(Link)`
  display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-radius: 4px; &:hover { background: #f5eefc; }
`;
const BranchGrid = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;`;
const MiniForm = styled.form`
  margin-top: 16px; padding: 16px 20px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; display: flex; flex-direction: column; gap: 14px; max-width: 640px;
`;
const ContextRow = styled.div`display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: end;`;
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
/** Needs-attention order: what the operator has to act on, then what is merely on sale, then what is over. */
const STATUS_ORDER = ['DRAFT', 'ANNOUNCED', 'VERIFYING', 'CHALLENGED', 'LISTED', 'SUPERSEDED', 'RETIRED', 'REJECTED'];
const statusRank = (s: string) => { const i = STATUS_ORDER.indexOf(s); return i < 0 ? STATUS_ORDER.length : i; };
const recency = (e: CatalogEntry) => e.listed_at ?? e.anchor.created_at ?? 0;
const NODELOG_SEEN = 'ainize.nodelog.seen';

/** Teaching tab (spec §5.13) is code-split: most operators open My knowledge far more often than the teach queue. */
const TeachingTab = lazy(() => import('@/components/operator/TeachingTab'));

/** The verification block (item 335) — rendered only for a node that has actually written attestations. */
function VerificationWork({ address }: { address: string }) {
  const { t, tech, help } = useT();
  const money = useMoney();
  const attests = useLedgerQuery({ kind: 'attest', limit: 5000 });
  const wallet = useWalletQuery();
  // `wallet.network` is the ledger's network name ("local"), never a currency — the unit comes from /api/info.
  const { data: nodeInfo } = useInfoQuery();
  const mine = useMemo(() => {
    const rows = (attests.data?.records ?? []).map((r) => r.body as { patch_id?: string; verifier?: string; passed?: boolean; verified_on?: string })
      .filter((b) => (b.verifier ?? '').toLowerCase() === address.toLowerCase());
    return {
      total: rows.length,
      passed: rows.filter((b) => b.passed !== false).length,
      failed: rows.filter((b) => b.passed === false).length,
      hashOnly: rows.filter((b) => b.verified_on === 'hash-only').length,
      knowledges: new Set(rows.map((b) => b.patch_id ?? '')).size,
    };
  }, [attests.data, address]);
  const network = useMemo(() => {
    const rows = (attests.data?.records ?? []).map((r) => r.body as { passed?: boolean });
    return { total: rows.length, failed: rows.filter((b) => b.passed === false).length };
  }, [attests.data]);
  if (!mine.total) return null;
  const earned = wallet.data?.verification_total ?? '0';
  const currency = nodeInfo?.currency ?? '';
  return (
    <VerifyCard data-testid="dash-verification">
      <VerifyStat><b>{num(mine.total)}</b><span title={`${help('signedResult')} (${tech('signedResult')})`}>{t('op.dash.verify.attested')}</span></VerifyStat>
      <VerifyStat><b>{num(mine.passed)}</b><span>{t('op.dash.verify.passed')}</span></VerifyStat>
      <VerifyStat><b className={mine.failed ? 'bad' : undefined}>{num(mine.failed)}</b><span>{t('op.dash.verify.failed')}</span></VerifyStat>
      <VerifyStat><b>{num(mine.hashOnly)}</b><span title={t('op.dash.verify.hash_help')}>{t('op.dash.verify.hash')}</span></VerifyStat>
      <VerifyStat><b>{num(mine.knowledges)}</b><span>{t('op.dash.verify.knowledges')}</span></VerifyStat>
      <VerifyStat><b>{money.revenue(earned, currency)}</b><span title={t('op.dash.verify.earned_help')}>{t('op.dash.verify.earned')}</span></VerifyStat>
      <VerifyNote>{t('op.dash.verify.network', { total: num(network.total), failed: num(network.failed) })} {t('op.dash.verify.note')}</VerifyNote>
    </VerifyCard>
  );
}

export default function DashboardPage() {
  const { t, term, help, tech } = useT();
  useTitle(t('op.dash.title'));
  const money = useMoney();
  const { address } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: 'knowledge' | 'teaching' = params.get('tab') === 'teaching' ? 'teaching' : 'knowledge';
  const setTab = (id: string) => { const next = new URLSearchParams(params); if (id === 'teaching') next.set('tab', 'teaching'); else next.delete('tab'); setParams(next, { replace: true }); };
  const { data: info } = useInfoQuery();
  const { data: me } = useMeQuery();
  const currency = info?.currency ?? '';
  const [inFlight, setInFlight] = useState(false);
  const patches = useMyPatchesQuery(undefined, { pollingInterval: inFlight ? 5000 : 0 });
  const items = patches.data?.items ?? [];
  const anyInFlight = items.some((e) => isInFlight(e.status));
  if (anyInFlight !== inFlight) setInFlight(anyInFlight);

  const purchases = useMyPurchasesQuery();
  const runtime = useRuntimeQuery();
  /**
   * SC-15 — this is the table where a bought add-on is loaded, so it is where the base has to be offered: a bare
   * apply answered `needs_base` with a code, on the one screen whose whole job is turning a purchase into a model
   * that knows something.
   */
  const chain = useLoadChain((id) => purchases.data?.items.find((x) => x.patch_id === id)?.entry?.anchor.name || id);
  const branches = useBranchesQuery();
  const [createBranch, createState] = useCreateBranchMutation();
  const [addToBranch, addState] = useAddToBranchMutation();

  // create branch mini form
  const [bName, setBName] = useState('');
  const [bDesc, setBDesc] = useState('');
  const [ctx, setCtx] = useState<{ k: string; v: string }[]>([{ k: 'jurisdiction', v: '' }]);
  const [bPatches, setBPatches] = useState<string[]>([]);
  const [addBranch, setAddBranch] = useState('');
  const [addPatch, setAddPatch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const listedMine = useMemo(() => items.filter((e) => e.status === 'LISTED'), [items]);
  const ownedBranches = useMemo(() => (branches.data?.branches ?? []).filter((b) => b.owner === address), [branches.data, address]);

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

  const matched = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hit = (e: CatalogEntry) => !needle || [e.anchor.id, e.anchor.name, e.anchor.model.id_M, e.anchor.benchmark.schema, e.anchor.branch]
      .some((v) => (v ?? '').toLowerCase().includes(needle));
    const list = items.filter((e) => (statusFilter === 'all' || e.status === statusFilter) && hit(e));
    const by = {
      // Within one status the newest first: an operator scanning drafts wants the one they just made.
      status: (a: CatalogEntry, b: CatalogEntry) => statusRank(a.status) - statusRank(b.status) || recency(b) - recency(a),
      new: (a: CatalogEntry, b: CatalogEntry) => recency(b) - recency(a),
      name: (a: CatalogEntry, b: CatalogEntry) => (a.anchor.name || a.anchor.id).localeCompare(b.anchor.name || b.anchor.id) || a.anchor.id.localeCompare(b.anchor.id),
      sales: (a: CatalogEntry, b: CatalogEntry) => b.downloads - a.downloads || recency(b) - recency(a),
    }[sort];
    return [...list].sort(by);
  }, [items, q, statusFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = useMemo(() => matched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [matched, currentPage]);
  const narrowed = statusFilter !== 'all' || !!q.trim();
  const clearFilters = () => { setQ(''); setStatusFilter('all'); resetPage(); };

  // ---------------------------------------------------------------- finding 133: what the node log has to say
  const [logSeen] = useState(() => { try { return Number(localStorage.getItem(NODELOG_SEEN)) || 0; } catch { return 0; } });
  const recentEvents = useEventsQuery({ limit: 200 });
  const unseenBad = (recentEvents.data?.events ?? []).filter((e) => (e.level === 'warn' || e.level === 'error') && e.ts > logSeen).length;

  const onCreateBranch = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const context: Record<string, string> = {};
    for (const c of ctx) if (c.k.trim()) context[c.k.trim()] = c.v.trim();
    try {
      await createBranch({ name: bName.trim(), description: bDesc.trim(), context, patch_ids: bPatches }).unwrap();
      setBName(''); setBDesc(''); setBPatches([]); setCtx([{ k: 'jurisdiction', v: '' }]);
    } catch (err) { setActionError(errorMessage(err)); }
  };
  const onAddToBranch = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    try { await addToBranch({ name: addBranch, patch_id: addPatch }).unwrap(); setAddPatch(''); } catch (err) { setActionError(errorMessage(err)); }
  };
  const run = async (fn: () => Promise<unknown>) => { setActionError(null); try { await fn(); } catch (err) { setActionError(errorMessage(err)); } };

  const salesText = (e: CatalogEntry) => t('op.dash.sales.cell', { n: num(e.downloads), revenue: money.revenue(e.revenue, e.anchor.currency || currency) });
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
      {patches.isError && <QueryError error={patches.error} what={t('op.error.what.patches')} retrying={patches.isFetching} onRetry={() => void patches.refetch()} />}
      {patches.isLoading ? <CenterProgress /> : patches.isError ? null : (<>
        {/* Finding 31: search, narrow, order and count — the list stopped fitting on a screen long ago. */}
        {items.length > PAGE_SIZE / 2 && (
          <Toolbar>
            <FilterGroup>
              <span className="label">{t('op.dash.filter.status')}</span>
              <FilterChip type="button" $active={statusFilter === 'all'} onClick={() => { setStatusFilter('all'); resetPage(); }}>{t('op.dash.filter.all', { n: items.length })}</FilterChip>
              {statusCounts.map(([s, n]) => (
                <FilterChip key={s} type="button" $active={statusFilter === s} onClick={() => { setStatusFilter(statusFilter === s ? 'all' : s); resetPage(); }}>
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
                      <NameLink to={`/${author}/${a.id}`}>{a.name || a.id}</NameLink>
                      {/* Finding 31: with 28 rows called "O69 grace period" the id is the identity, not a footnote —
                          it reads in the mono face, at full length, and one click selects the whole of it. */}
                      <SubText title={a.id}><IdText>{a.id}</IdText> · {a.model.id_M} · {t('units.facts', { n: num(a.benchmark.queries) })}</SubText>
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
                      <IconButton aria-label={t('op.dash.col.logs')} title={t('op.dash.col.logs')} onClick={() => navigate(`/project/${author}/${a.id}/logs`)}><LogIcon /></IconButton>
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
                      <IconButton aria-label={t('op.dash.col.manage')} title={t('op.dash.col.manage')} onClick={() => navigate(`/project/${author}/${a.id}`)}><ManageIcon /></IconButton>
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
      {purchases.isError && <QueryError error={purchases.error} what={t('op.error.what.purchases')} retrying={purchases.isFetching} onRetry={() => void purchases.refetch()} />}
      {!purchases.isError && (
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
            {(purchases.data?.items ?? []).map((p) => {
              const author = p.entry?.anchor.author;
              const cur = p.entry?.anchor.currency ?? currency;
              const busy = chain.busy && chain.busyId === p.patch_id;
              return (
                <TableRow key={p.patch_id}>
                  <TableData $align="left" $padding="8px 0 8px 32px" $maxWidth="320px">
                    {author ? <NameLink to={`/${author}/${p.patch_id}`}>{p.entry?.anchor.name ?? p.patch_id}</NameLink> : <strong>{p.patch_id}</strong>}
                    <SubText>{p.entry ? p.patch_id : shortHash(p.sha256, 16)}</SubText>
                  </TableData>
                  <TableData title={money.note(cur)} data-testid="purchase-paid">
                    {money.fmt(p.amount, cur)}
                    {schemeText(p.scheme, cur) && <SubText style={{ display: 'inline' }}> ({schemeText(p.scheme, cur)})</SubText>}
                    {originText(p.origin) && <SubText style={{ display: 'block' }}>{originText(p.origin)}</SubText>}
                    {/* Item 280: the settle record has carried the split all along, and the buyer was shown a tx hash. */}
                    {(p.payees?.length ?? 0) > 0 && (
                      <SubText style={{ display: 'block' }} data-testid="purchase-payees">{t('op.dash.purchases.paid_to', {
                        who: p.payees!.map((x) => t('op.dash.purchases.paid_to.line', { name: x.name ?? shortAddr(x.address, 6), amount: money.revenue(x.amount, cur) })).join(' · '),
                      })}</SubText>
                    )}
                  </TableData>
                  <TableData $mono title={p.tx_hash}>{shortHash(p.tx_hash, 12)}</TableData>
                  <TableData $mono title={p.path ?? ''}>{p.path ? `…/${p.path.split('/').slice(-1)[0].slice(0, 18)}` : '—'}</TableData>
                  <TableData>{p.applied ? <span style={{ color: '#44a45f', fontWeight: 600 }}>{t('op.yes')}</span> : t('op.no')}</TableData>
                  <TableData>
                    <Row $gap={6} $justify="center">
                      <Button size="small" title={help('apply')} disabled={!runtime.data?.available || busy || p.applied} loading={busy && !p.applied} onClick={() => { setActionError(null); void chain.load(p.patch_id); }}>{term('apply')}</Button>
                      <Button size="small" color="secondary" title={help('remove')} disabled={!runtime.data?.available || busy || !p.applied} loading={busy && p.applied} onClick={() => { setActionError(null); void chain.unload(p.patch_id); }}>{term('remove')}</Button>
                    </Row>
                  </TableData>
                  <TableData>
                    <IconLink to={`/chat/${encodeURIComponent(p.patch_id)}`} aria-label={t('op.livetest')} title={`${t('op.livetest')} — ${t('op.livetest.hint')}`}><LiveTestIcon /></IconLink>
                  </TableData>
                </TableRow>
              );
            })}
            {(purchases.data?.items ?? []).length === 0 && <TableRowEmpty $height={120}><td colSpan={7}>{purchases.isLoading ? <SmallSpinner /> : t('op.dash.purchases.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      )}
      {/* SC-18 — the loaded stack, in the order the model holds it. A set of ids cannot answer the operator's
          question ("what is under what?"), and after L2 the order is a record the node keeps, not a guess. */}
      {!!runtime.data?.stack?.length && (
        <StatusText style={{ marginTop: 8 }} data-testid="ops-stack">
          {t('ops.stack', { list: runtime.data.stack.map((l, i) => `${i + 1}. ${l.name ?? l.patch_id}${l.reason === 'base' ? ` (${t('ops.stack.base')})` : ''}`).join('  ·  ') })}
          {runtime.data.stack.some((l) => !l.journal) && <div>{t('ops.stack.nojournal', { n: runtime.data.stack.filter((l) => !l.journal).length })}</div>}
        </StatusText>
      )}
      {runtime.data && !runtime.data.available && <StatusText style={{ marginTop: 8 }}>{t('op.runtime.unavailable', { error: runtime.data.error ?? t('op.runtime.noapi') })}</StatusText>}

      {/* ---------------------------------------------------------------- knowledge tracks (branches) */}
      <SubTitle $mt={56}><Tip tech={tech('branch')}>{t('op.dash.branches.title')}</Tip></SubTitle>
      <Description>{t('op.dash.branches.desc')}</Description>
      {branches.isError && <QueryError error={branches.error} what={t('op.error.what.branches')} retrying={branches.isFetching} onRetry={() => void branches.refetch()} />}
      {branches.isLoading ? <CenterProgress /> : branches.isError ? null : (
        <BranchGrid>
          {(branches.data?.branches ?? []).map((b) => (
            <TrackCard key={b.name} branch={b} subscribed={!!branches.data?.mine.includes(b.name)} currency={currency} address={address} />
          ))}
          {(branches.data?.branches ?? []).length === 0 && <span style={{ color: '#8d8d8f', fontSize: 14 }}>{t('op.dash.branches.empty')}</span>}
        </BranchGrid>
      )}

      <MiniForm onSubmit={onCreateBranch}>
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
        <div><Button type="submit" loading={createState.isLoading} loadingText={t('op.dash.branch.creating')}>{t('op.dash.branch.submit')}</Button></div>
      </MiniForm>

      {ownedBranches.length > 0 && (
        <MiniForm onSubmit={onAddToBranch}>
          <strong style={{ fontSize: 14 }}>{t('op.dash.branch.addto')}</strong>
          <ContextRow style={{ gridTemplateColumns: '1fr 1fr auto' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldLabel>{t('op.dash.branch.pick')}</FieldLabel>
              <Select value={addBranch} onChange={(e) => setAddBranch(e.target.value)} required>
                <option value="">{t('op.select')}</option>
                {ownedBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
              </Select>
            </label>
            <TextField label={t('op.dash.branch.patchid')} placeholder="krx-all-2761" value={addPatch} onChange={(e) => setAddPatch(e.target.value)} required />
            <Button type="submit" loading={addState.isLoading}>{t('op.add')}</Button>
          </ContextRow>
          <span style={{ fontSize: 12, color: '#8d8d8f' }}>{t('op.dash.branch.owner_note')}</span>
        </MiniForm>
      )}
      </>)}
    </PageWrapper>
  );
}
