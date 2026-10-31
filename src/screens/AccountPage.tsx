import { AccountPeers } from '@/components/operator/AccountPeers';
import { AccountRuntime } from '@/components/operator/AccountRuntime';
import { accountPeers } from '@/lib/accountNodeActions';
import { AccountSettings } from '@/components/operator/AccountSettings';
import { accountWallet, accountSales, accountPayouts, accountOwed, accountPayments, type OwedRow } from '@/lib/accountWallet';
import { useAuth } from '@/auth/AuthContext';
import { Fragment, useMemo, useState, type FormEvent } from 'react';
import styled from 'styled-components';
import {
  errorMessage, useChainSetupMutation, useInfoQuery, useMeQuery, useMyPatchesQuery, useNodesQuery, usePayoutsQuery,
  useSettingsQuery, useWalletQuery, useWalletSendMutation,
  useOwnersQuery, useAddOwnerMutation, useRemoveOwnerMutation, useBindingsQuery, useRemoveBindingMutation,
} from '@/api/api';
import type { NodeOwner } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { DevBox, MonoBox, Muted, Pre, QueryError, Row, Stack, Tip, useElapsed, useMoney } from '@/components/operator/common';
import { dateTime, num, shortAddr, shortHash } from '@/utils/format';
import { networkKindOf } from '@/utils/useNetwork';

const Balance = styled.div`font-size: 28px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; margin-top: 12px; span { font-size: 14px; font-weight: 400; color: ${(p) => p.theme.color.GREY}; margin-left: 8px; }`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); gap: 24px; margin-top: 16px;`;

/** How many rows of an accounting table are on screen before "show more" (item 94). */
const PAGE = 20;
const TableFoot = styled.div`
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin-top: 8px;
`;

/** One accounting table's footer: how much of it you are looking at, how to see the rest, and how to take it away. */
function Rows({ shown, total, onMore, onAll, onCsv, t }: {
  shown: number; total: number; onMore: () => void; onAll: () => void; onCsv: () => void;
  t: (k: string, v?: Record<string, string | number>) => string;
}) {
  if (!total) return null;
  return (
    <TableFoot>
      <Muted data-testid="rows-showing">{t('op.account.rows.showing', { shown: Math.min(shown, total), total })}</Muted>
      {shown < total && <Button size="small" variant="text" onClick={onMore}>{t('op.account.rows.more', { n: Math.min(PAGE, total - shown) })}</Button>}
      {shown < total && <Button size="small" variant="text" color="default" onClick={onAll}>{t('op.account.rows.all', { total })}</Button>}
      <Button size="small" variant="text" color="default" onClick={onCsv} data-testid="rows-csv">{t('op.account.rows.csv')}</Button>
    </TableFoot>
  );
}

/**
 * Hand the operator the whole table as a file — the wallet is the only screen that carries settlement history, and
 * reconciling it anywhere else was impossible (item 94). Excel reads the BOM as UTF-8, so Korean ids survive.
 */
function downloadCsv(name: string, rows: (string | number)[][]): void {
  const body = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** ISO-8601 in the CSV: a spreadsheet cannot sort "1d ago". */
const iso = (ts: number) => new Date(ts).toISOString();

/**
 * Who owns this node — the three kinds of claim, and the one kind this page may take back.
 *
 * It used to be a read-only list under the heading "who may sign in", because signing in and owning the node
 * were the same thing and neither could be changed from a browser. Both of those have stopped being true: anyone
 * may sign in, and an owner can now vouch for another address from here.
 *
 * What it still cannot do is remove the other two. The node's own key owns what the node published, and the
 * config file is the way back when every session is lost — a button that appeared to delete either would be
 * lying, since the address would still own the node on the next request.
 */
function Owners() {
  const { t } = useT();
  const auth = useAuth();
  const owners = useOwnersQuery({ identity: auth.cacheIdentity });
  const { isLoading } = owners;
  const data = !owners.isError ? owners.currentData : undefined;
  const [addOwner, addState] = useAddOwnerMutation();
  const [removeOwner, removeState] = useRemoveOwnerMutation();
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valid = /^0x[0-9a-fA-F]{40}$/.test(draft.trim());
  const busy = !data || owners.isFetching || addState.isLoading || removeState.isLoading;

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null); setError(null);
    try {
      const r = await addOwner({ address: draft.trim() }).unwrap();
      setNotice(r.already ? t('op.account.operators.already', { addr: shortAddr(draft.trim(), 6) }) : null);
      setDraft('');
    } catch (err) { setError(errorMessage(err)); }
  };
  const remove = async (address: string) => {
    setNotice(null); setError(null);
    try {
      const r = await removeOwner(address).unwrap();
      setNotice(t('op.account.operators.removed', { addr: shortAddr(address, 6), n: r.sessions_ended }));
    } catch (err) { setError(errorMessage(err)); }
  };

  const label = (o: NodeOwner) => o.source === 'node' ? t('op.account.operators.own')
    : o.source === 'config' ? t('op.account.operators.src_config')
    : t('op.account.operators.src_granted', { by: shortAddr(o.added_by, 6) || '—' });

  return (
    <>
      <SubTitle $mt={56}>{t('op.account.operators.title')}</SubTitle>
      <Description>{t('op.account.operators.desc')}</Description>
      {isLoading && <CenterProgress />}
      {owners.isError && <QueryError error={owners.error} what={t('op.account.operators.title')} onRetry={() => void owners.refetch()} retrying={owners.isFetching} />}
      <KeyValue data-testid="operators">
        {(data?.owners ?? []).map((o) => (
          <Fragment key={o.address}>
            <dt>{label(o)}</dt>
            <dd>
              <Mono>{o.address}</Mono> <CopyButton text={o.address} label={t('common.copy')} />
              {/* Offered only for a grant: the other two are not this page's to undo, and a button that removed a
                  row while the address kept owning the node would be worse than no button. */}
              {o.source === 'granted' && (
                <Button variant="text" size="small" type="button" disabled={busy} onClick={() => void remove(o.address)} style={{ marginLeft: 10 }}>
                  {t('op.account.operators.remove')}
                </Button>
              )}
            </dd>
          </Fragment>
        ))}
      </KeyValue>
      <Row as="form" onSubmit={add} style={{ marginTop: 14, alignItems: 'flex-end', gap: 10 }}>
        <TextField value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('op.account.operators.add_ph')} style={{ maxWidth: 420 }} />
        <Button type="submit" disabled={!valid || busy}>{t('op.account.operators.add')}</Button>
      </Row>
      {notice && <Muted style={{ display: 'block', marginTop: 10 }}>{notice}</Muted>}
      {error && <Alert $tone="error" role="alert" style={{ marginTop: 10 }}>{error}</Alert>}
      <Muted style={{ display: 'block', marginTop: 10 }}>{t('op.account.operators.how')}</Muted>
    </>
  );
}

/**
 * Every command line that acts as you, and ending one.
 *
 * A binding outlives a session on purpose — that is what stops `ainize login` from being something you do every
 * morning — so it has to be visible and it has to be revocable. Ending one closes the sessions that key already
 * collected, because a 30-day cookie would otherwise outlive the revocation by a month.
 *
 * This is yours, not the node's: it lists what acts as YOU, which is why it is shown to anyone signed in rather
 * than only to whoever owns the machine.
 */
function Bindings() {
  const { t } = useT();
  const auth = useAuth();
  const bindings = useBindingsQuery({ identity: auth.cacheIdentity });
  const { isLoading } = bindings;
  const data = !bindings.isError ? bindings.currentData : undefined;
  const [removeBinding, removeState] = useRemoveBindingMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = async (delegate: string) => {
    setNotice(null); setError(null);
    try {
      const r = await removeBinding(delegate).unwrap();
      setNotice(t('op.account.bindings.ended', { addr: shortAddr(delegate, 6), n: r.sessions_ended }));
    } catch (e) { setError(errorMessage(e)); }
  };
  const rows = data?.bindings ?? [];
  return (
    <>
      <SubTitle $mt={56}>{t('op.account.bindings.title')}</SubTitle>
      <Description>{t('op.account.bindings.desc')}</Description>
      {bindings.isError && <QueryError error={bindings.error} what={t('op.account.bindings.title')} onRetry={() => void bindings.refetch()} retrying={bindings.isFetching} />}
      {isLoading && <CenterProgress />}
      {!isLoading && !bindings.isError && rows.length === 0 && <Muted style={{ display: 'block' }}>{t('op.account.bindings.none')}</Muted>}
      <KeyValue data-testid="bindings">
        {rows.map((b) => (
          <Fragment key={b.delegate}>
            <dt>{b.label || shortAddr(b.delegate, 6)}</dt>
            <dd>
              <Mono>{b.delegate}</Mono>
              {/* Which of these is the one reading this page. Without it, ending the right key is guesswork, and
                  ending the wrong one signs you out of the terminal you were about to fix it from. */}
              {data?.via === b.delegate && <Muted style={{ marginLeft: 8 }}>({t('op.account.bindings.this')})</Muted>}
              <Muted style={{ marginLeft: 8 }}>
                {t('op.account.bindings.since', { when: dateTime(b.created_at) })}
                {' · '}
                {b.last_seen_at ? t('op.account.bindings.seen', { when: dateTime(b.last_seen_at) }) : t('op.account.bindings.never')}
              </Muted>
              <Button variant="text" size="small" type="button" disabled={removeState.isLoading} onClick={() => void end(b.delegate)} style={{ marginLeft: 10 }}>
                {t('op.account.bindings.end')}
              </Button>
            </dd>
          </Fragment>
        ))}
      </KeyValue>
      {notice && <Muted style={{ display: 'block', marginTop: 10 }}>{notice}</Muted>}
      {error && <Alert $tone="error" role="alert" style={{ marginTop: 10 }}>{error}</Alert>}
    </>
  );
}

export default function AccountPage() {
  const auth = useAuth();
  if (auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;
  return <AccountView key={auth.cacheIdentity} />;
}

function AccountView() {
  const auth = useAuth();
  const scope = { identity: auth.cacheIdentity };
  const { t, help, tech } = useT();
  useTitle(t('op.account.title'));
  const money = useMoney();
  const elapsed = useElapsed();
  const { data: me } = useMeQuery();
  const { currentData: info } = useInfoQuery(scope);
  const wallet = useWalletQuery(scope);
  const nodes = useNodesQuery(scope, { pollingInterval: 15_000 });
  const settings = useSettingsQuery(scope);
  const payouts = usePayoutsQuery({ limit: 500, identity: auth.cacheIdentity });
  const myPatches = useMyPatchesQuery(scope);
  const [chainSetup, chainState] = useChainSetupMutation();

  const [salesShown, setSalesShown] = useState(PAGE);
  const [royShown, setRoyShown] = useState(PAGE);
  const [owedShown, setOwedShown] = useState(PAGE);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Item 320: the only outward money action in the product. */
  const [walletSend, sendState] = useWalletSendMutation();
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const saved = settings.currentData?.settings;

  const run = async (fn: () => Promise<unknown>, ok?: string) => { setError(null); setNotice(null); try { await fn(); if (ok) setNotice(ok); } catch (err) { setError(errorMessage(err)); } };

  const walletView = !wallet.isError ? accountWallet(wallet.currentData, me?.address ?? '') : null;
  const currency = info?.currency ?? '';
  const payoutRows = !payouts.isError ? accountPayouts(payouts.currentData) : null;
  const isAin = info?.ledger.kind === 'ain';
  /**
   * Item 356: the largest number this screen shows was the one with no provenance. The kind is read off the
   * provider the node reports — by the shared rule in utils/useNetwork, which every AIN figure in the product now
   * uses, so the wallet total and a price on /explore can never disagree about which chain this is.
   */
  const netKind = info ? networkKindOf(info.ledger) : 'unknown';
  const netNote = t(`op.account.wallet.network.${netKind}`);

  const sales = walletView?.sales ?? [];
  const royalties = walletView?.royalties ?? [];
  // Item 315 — what this node owes, on the money screen instead of only under a tab about taught lessons.
  const owedView = useMemo(() => payoutRows ? accountOwed(sales, payoutRows, me?.address ?? '') : null, [sales, payoutRows, me?.address]);
  const owed = owedView?.rows ?? [];
  /**
   * Item 317 — the wallet's arithmetic did not close. Sales listed the gross settlement amount (3, 3, 98, 3 = 107)
   * under a balance that was 75.5 higher than it started, and the missing 31.5 — the creator share this node paid
   * upstream out of those same sales — appeared on no row anywhere. The split is in `royalty` on every settlement
   * the page already has, so each sale now says what stayed here and what left, and the totals under the table
   * reconcile with the balance above it. A seller can finally price a derivative instead of distrusting the wallet.
   */
  const nodeView = !nodes.isError ? accountPeers(nodes.currentData) : null;
  const nameOfAddress = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of nodeView?.nodes ?? []) if (n.name) m.set(n.address.toLowerCase(), n.name);
    for (const p of nodeView?.peers ?? []) if (p.info?.name && p.address) m.set(p.address.toLowerCase(), p.info.name);
    for (const e of myPatches.currentData?.items ?? []) {
      if (e.anchor.author_name) m.set(e.anchor.author.toLowerCase(), e.anchor.author_name);
      for (const c of e.anchor.contributors ?? []) { if (c.name) m.set(c.address.toLowerCase(), c.name); if (c.name && c.signer) m.set(c.signer.toLowerCase(), c.name); }
    }
    return (a: string) => m.get(a.toLowerCase());
  }, [nodeView, myPatches.currentData]);
  const saleSplit = useMemo(() => accountSales(sales, me?.address ?? ''), [sales, me?.address]);
  const royaltyGroups = accountPayments(royalties);
  const verificationGroups = accountPayments(walletView?.verification, 'verification');
  const paymentSummary = (groups: ReturnType<typeof accountPayments>) => !groups ? t('op.account.amounts.unavailable') : groups.length === 0 ? t('op.account.amounts.none') : groups.map(g =>
    `${money.revenue(g.amount, g.currency)} · ${t(`op.dash.verify.payment.${g.state}`)}${g.evidence ? ` · ${t(`op.dash.verify.evidence.${g.evidence}`)}` : ''}`).join(' / ');
  /** Why this address is owed anything, from the sold anchor itself: it verified, it provided data, or it is upstream. */
  const owedWhy = (r: OwedRow): string => {
    const e = (myPatches.currentData?.items ?? []).find((x) => x.anchor.id === r.patch_id);
    const low = r.address.toLowerCase();
    if (e?.verifiers?.some((v) => v.toLowerCase() === low)) return t('op.account.owed.why.verification', { id: r.patch_id });
    if ((e?.anchor.contributors ?? []).some((c) => c.address?.toLowerCase() === low)) return t('op.account.owed.why.provider', { id: r.patch_id });
    return t('op.account.owed.why.unknown', { id: r.patch_id });
  };
  const roleLabel = (r: string) => { const k = `op.role.${r}`; const v = t(k); return v === k ? r : v; };
  const [teachBefore, teachAfter] = t('op.account.teach.desc', { link: '|' }).split('|');

  return (
    <PageWrapper>
      <Title>{t('op.account.title')}</Title>
      <Description>{t('op.account.desc')}</Description>
      {error && <Alert $tone="error" style={{ marginTop: 16 }}>{error}</Alert>}
      {notice && <Alert $tone="success" style={{ marginTop: 16 }}>{notice}</Alert>}

      {/* ------------------------------------------------------------ identity */}
      <SubTitle $mt={48}>{t('op.account.identity')}</SubTitle>
      {!me || !info ? <CenterProgress /> : (
        <KeyValue>
          <dt>{t('op.name')}</dt><dd>{me.name}</dd>
          <dt><Tip tech={tech('node')}>{t('op.address')}</Tip></dt><dd><Mono>{me.address}</Mono> <CopyButton text={me.address} label={t('common.copy')} /></dd>
          <dt>{t('op.roles')}</dt><dd>{me.roles.map(roleLabel).join(', ')}</dd>
          <dt>{t('op.account.endpoint')}</dt><dd><Mono>{info.node.endpoint}</Mono></dd>
          <dt><Tip tech={tech('ledger')}>{t('op.account.ledger')}</Tip></dt>
          <dd>{info.ledger.kind === 'ain' ? <>{t('op.account.ledger.ain')} · <Mono>{info.ledger.provider}</Mono> · <Mono>{info.ledger.app}</Mono></> : t('op.account.ledger.local')}</dd>
          <dt>{t('op.account.height')}</dt><dd>{num(info.ledger.records)}{info.ledger.height ? <Muted title={t('op.tech.block_height_help')}> · {t('op.tech.block_height')} {num(info.ledger.height)}</Muted> : null}</dd>
          <dt><Tip tech={tech('verified')}>{t('op.account.quorum')}</Tip></dt><dd>{t('op.account.quorum.value', { n: info.quorum })}</dd>
          <dt>{t('op.account.version')}</dt><dd>{info.node.version}</dd>
        </KeyValue>
      )}

      {/* ------------------------------------------------------------ notifications & payout (persisted on the node) */}
      <AccountSettings address={me?.address ?? null} />

      {/* --------------------------------------------------- what acts as you, and who owns this node */}
      <Bindings />
      <Owners />

      {/* ------------------------------------------------------------ teaching (settings live on My knowledge → Teaching, spec §5.13) */}
      <SubTitle $mt={56}>{t('op.account.teach.title')}</SubTitle>
      <Description data-testid="account-teach">{teachBefore}<StyledLink to="/dashboard?tab=teaching">{t('op.account.teach.link')}</StyledLink>{teachAfter}</Description>

      {/* ------------------------------------------------------------ wallet */}
      <SubTitle $mt={56}>{t('op.account.wallet')}</SubTitle>
      <Description>{isAin ? t('op.account.wallet.desc.ain') : t('op.account.wallet.desc.credit')}</Description>
      {wallet.isFetching && !wallet.currentData ? <CenterProgress /> : !walletView || !saleSplit ? <QueryError error={wallet.error} what={t('op.account.wallet')} onRetry={() => void wallet.refetch()} retrying={wallet.isFetching} /> : (
        <>
          <Balance title={netNote}>{walletView.balance === null || !currency ? '—' : num(walletView.balance)}<span>{money.unit(currency)}</span></Balance>
          <Muted style={{ display: 'block' }} data-testid="wallet-network" title={currency === 'AIN' ? tech('ain') : tech('credit')}>
            {netNote}{isAin && info?.ledger.provider ? <> · <Mono>{info.ledger.provider}</Mono></> : null}
          </Muted>
          <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.wallet.summary', { purchases: walletView.purchases, sales: sales.length, royalties: royalties.length })}</Muted>
          {saleSplit.totals.filter(g => g.sharedTotal > 0).map(g => (
            <Muted style={{ display: 'block', marginTop: 2 }} data-testid="wallet-shared-out" key={g.currency}>
              {t('op.account.wallet.shared_out', { gross: money.revenue(g.grossTotal, g.currency), shared: money.revenue(g.sharedTotal, g.currency), net: money.revenue(g.netTotal, g.currency) })}
            </Muted>
          ))}
          {isAin && (
            <Row $gap={12} style={{ marginTop: 12 }}>
              <Button size="small" loading={chainState.isLoading} loadingText={t('op.account.chain.setting')} onClick={() => run(() => chainSetup().unwrap(), t('op.account.chain.done'))}>{t('op.account.chain.setup')}</Button>
              <Muted title={t('op.account.dev.chain')}>{t('op.account.chain.note')}</Muted>
            </Row>
          )}
          {/* Item 320: a balance with no action beside it. Earnings could leave this node only as purchases made
              through it — no send, no withdraw, no way to pay a collaborator. */}
          {isAin ? (
            <div style={{ marginTop: 16 }} data-testid="wallet-send">
              <strong style={{ fontSize: 14 }}>{t('op.account.send.title')}</strong>
              <Muted style={{ display: 'block', marginTop: 4 }}>{t('op.account.send.desc')}</Muted>
              <Row $gap={12} $wrap style={{ marginTop: 8, maxWidth: 620 }}>
                <TextField label={t('op.account.send.to')} value={sendTo} onChange={(e) => setSendTo(e.target.value)} data-testid="send-to" />
                <TextField label={t('op.account.send.amount', { currency: money.unit(currency) })} value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} data-testid="send-amount" style={{ maxWidth: 200 }} />
                <Button size="small" color="secondary" data-testid="send-go"
                  disabled={!/^0x[0-9a-fA-F]{40}$/.test(sendTo.trim()) || !(Number(sendAmount) > 0)}
                  loading={sendState.isLoading} loadingText={t('op.account.send.working')}
                  onClick={() => run(async () => { await walletSend({ to: sendTo.trim(), amount: Number(sendAmount) }).unwrap(); setSendTo(''); setSendAmount(''); }, t('op.account.send.done'))}>
                  {t('op.account.send.button')}
                </Button>
              </Row>
            </div>
          ) : (
            <Muted style={{ display: 'block', marginTop: 12 }} data-testid="wallet-local-note">
              {t('op.account.send.local')} <StyledLink to="/terms">{t('op.account.send.local_terms')}</StyledLink>
            </Muted>
          )}
          <Grid>
            <div>
              <strong style={{ fontSize: 14 }}>{t('op.account.sales')}</strong>
              {/* The public record left the top menu; this is the way back to it. Your sales are here, and
                  everybody's — including the ones you can audit against — are still public at /ledger. */}
              <Muted style={{ marginLeft: 8, fontSize: 12 }}>
                <StyledLink to="/ledger" title={help('ledger')}>{t('op.account.sales.public')}</StyledLink>
              </Muted>
              <TableWrapper style={{ marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">{t('op.knowledge')}</TableHead><TableHead>{t('op.buyer')}</TableHead><TableHead>{t('op.amount')}</TableHead><TableHead title={t('op.account.sales.yours_help')}>{t('op.account.sales.yours')}</TableHead><TableHead>{t('op.when')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sales.slice(0, salesShown).map((s) => {
                      const sp = saleSplit.split.get(s.tx_hash);
                      return (
                        <TableRow key={s.tx_hash}>
                          <TableData $align="left" $padding="0 8px">
                            {s.patch_id}
                            {!!sp?.unresolved && <div data-testid="sale-unresolved">{t('op.account.sales.unresolved', { amount: money.revenue(sp.unresolved, s.currency) })}</div>}
                            {/* Item 317: what left this sale, and to whom — the line that makes the balance add up. */}
                            {!!sp?.shared.length && (
                              <div style={{ fontSize: 11, color: '#8d8d8f' }} data-testid="sale-shared">
                                {t('op.account.sales.shared_with', { who: sp.shared.map((r) => `${nameOfAddress(r.address) ?? shortAddr(r.address, 6)} ${money.revenue(r.amount, s.currency)}`).join(' · ') })}
                              </div>
                            )}
                          </TableData>
                          <TableData title={s.buyer}>{nameOfAddress(s.buyer) ?? shortAddr(s.buyer)}</TableData>
                          <TableData title={money.note(s.currency)}>{money.fmt(s.amount, s.currency)}</TableData>
                          <TableData title={t('op.account.sales.yours_help')} data-testid="sale-yours">{money.revenue(sp?.mine ?? Number(s.amount), s.currency)}</TableData>
                          <TableData title={dateTime(s.created_at)}>{elapsed(s.created_at)}</TableData>
                        </TableRow>
                      );
                    })}
                    {saleSplit.totals.map(g => (
                      <TableRow data-testid="sales-total" key={g.currency}>
                        <TableData $align="left" $padding="0 8px" $weight={600}>{t('op.account.sales.total')}</TableData>
                        <TableData />
                        <TableData $weight={600}>{money.revenue(g.grossTotal, g.currency)}</TableData>
                        <TableData $weight={600}>{money.revenue(g.netTotal, g.currency)}</TableData>
                        <TableData />
                      </TableRow>
                    ))}
                    {sales.length === 0 && <TableRowEmpty $height={72}><td colSpan={5}>{t('op.account.sales.empty')}</td></TableRowEmpty>}
                  </TableBody>
                </Table>
              </TableWrapper>
              {/* Item 94: 20 of 244 rows, no count, no dates, no way to the rest — on the only screen that carries them. */}
              <Rows t={t} shown={salesShown} total={sales.length} onMore={() => setSalesShown((n) => n + PAGE)} onAll={() => setSalesShown(sales.length)}
                onCsv={() => downloadCsv(`ainize-sales-${me?.name ?? 'node'}.csv`, [
                  [t('op.when'), t('op.knowledge'), t('op.buyer'), t('op.amount'), t('op.account.sales.yours'), t('op.account.sales.shared_col'), t('op.account.sales.unresolved_col'), 'currency', 'scheme', 'tx_hash'],
                  ...sales.map((s) => [iso(s.created_at), s.patch_id, s.buyer, s.amount, saleSplit.split.get(s.tx_hash)?.mine ?? s.amount,
                    (saleSplit.split.get(s.tx_hash)?.shared ?? []).map((r) => `${r.address}:${r.amount}`).join(' '), saleSplit.split.get(s.tx_hash)?.unresolved ?? 0, s.currency, s.scheme, s.tx_hash]),
                ])} />
            </div>
            <div>
              <strong style={{ fontSize: 14 }}><Tip tech={tech('lineage')}>{t('op.account.royalties')}</Tip></strong>
              {/* Item 311: a settle record naming this address is the SELLER's promise, not a receipt. Every row now
                  carries the state this node can actually defend, and the three totals can be reconciled. */}
              <Muted style={{ display: 'block', marginTop: 6 }} data-testid="royalty-totals">{paymentSummary(royaltyGroups)}</Muted>
              <TableWrapper style={{ marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">{t('op.account.royalties.col')}</TableHead><TableHead>{t('op.account.royalties.for')}</TableHead><TableHead>{t('op.amount')}</TableHead><TableHead>{t('op.account.royalties.state')}</TableHead><TableHead>{t('op.when')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {royalties.slice(0, royShown).map((r, i) => (
                      <TableRow key={`${r.patch_id}-${i}`}>
                        <TableData $align="left" $padding="0 8px">{r.patch_id}</TableData>
                        <TableData>{t(r.kind === 'verification' ? 'op.account.royalties.for.verification' : r.kind === 'lineage' ? 'op.account.royalties.for.lineage' : 'op.account.royalties.for.unknown')}</TableData>
                        <TableData title={money.note(r.currency ?? '')}>{r.currency ? money.revenue(r.amount, r.currency) : `${num(r.amount)} · ${t('op.account.amounts.currency_unknown')}`}</TableData>
                        <TableData data-testid="royalty-state" title={[r.evidence ? t(r.evidence === 'record' ? 'op.account.royalties.evidence.record' : 'op.account.royalties.evidence.seller') : null, r.tx_hash, r.last_error].filter(Boolean).join(' · ') || undefined} $color={r.state === 'credited' || r.state === 'paid' ? '#2f7d43' : r.state === 'failed' ? '#b4232f' : '#8a4b00'}>
                          {r.state === 'unconfirmed' ? t('op.account.royalties.state.unconfirmed', { days: r.days ?? 0 })
                            : r.state ? t(`op.account.royalties.state.${r.state}`) : t('op.account.royalties.state.unknown')}
                        </TableData>
                        <TableData title={dateTime(r.created_at)}>{elapsed(r.created_at)}</TableData>
                      </TableRow>
                    ))}
                    {royalties.length === 0 && <TableRowEmpty $height={72}><td colSpan={5}>{t('op.account.royalties.empty')}</td></TableRowEmpty>}
                  </TableBody>
                </Table>
              </TableWrapper>
              <Rows t={t} shown={royShown} total={royalties.length} onMore={() => setRoyShown((n) => n + PAGE)} onAll={() => setRoyShown(royalties.length)}
                onCsv={() => downloadCsv(`ainize-creator-share-${me?.name ?? 'node'}.csv`, [
                  [t('op.when'), t('op.account.royalties.col'), t('op.account.royalties.for'), t('op.amount'), 'currency', t('op.account.royalties.state'), 'seller', 'buyer', 'tx_hash'],
                  ...royalties.map((r) => [iso(r.created_at), r.patch_id, r.kind ?? '', r.amount, r.currency ?? '', r.state ?? 'unconfirmed', r.seller ?? '', r.buyer ?? '', r.tx_hash ?? '']),
                ])} />
              <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.royalties.explain')}</Muted>
              {/* Item 316: the per-sale view that reconciles owed against paid existed at /teacher/<address> and
                  was reachable only from the teach flows — three surfaces, three totals, and the closest to right
                  could not be reached from the wallet. */}
              {me?.address && <Muted style={{ display: 'block', marginTop: 4 }}><StyledLink to={`/teacher/${me.address}`} data-testid="royalties-every-sale">{t('op.account.royalties.every_sale')}</StyledLink></Muted>}
              {/* Item 325: the fourth party in this economy — the one that only paid — can now see what it earned. */}
              <strong style={{ fontSize: 14, display: 'block', marginTop: 20 }}>{t('op.account.verification')}</strong>
              <Muted style={{ display: 'block', marginTop: 6 }} data-testid="verification-earned">{paymentSummary(verificationGroups)}</Muted>
            </div>
          </Grid>

          {/* ---------------------------------------------------------- what this node owes other people (item 315) */}
          <SubTitle $mt={40}>{t('op.account.owed')}</SubTitle>
          {saleSplit.totals.filter(g => g.unresolvedTotal > 0).map(g => <Muted key={g.currency} data-testid="owed-unresolved">{t('op.account.sales.unresolved', { amount: money.revenue(g.unresolvedTotal, g.currency) })}</Muted>)}
          <Description data-testid="owed-desc">{t('op.account.owed.window', { n: payoutRows?.length ?? '—' })}</Description>
          {payouts.isFetching && !payouts.currentData ? <CenterProgress /> : !owedView ? <QueryError error={payouts.error} what={t('op.account.owed')} onRetry={() => void payouts.refetch()} retrying={payouts.isFetching} /> : <>
          {owedView.totals.map(g => <Muted key={g.currency} style={{ display: 'block', marginTop: 6 }} data-testid="owed-totals">{t('op.account.owed.totals', {
            open: money.revenue(g.open, g.currency), credited: money.revenue(g.credited, g.currency), paid: money.revenue(g.paid, g.currency),
          })}</Muted>)}
          <TableWrapper style={{ marginTop: 8 }}>
            <Table>
              <TableHeader><TableRow>
                <TableHead $align="left" $padding="0 8px">{t('op.account.owed.to')}</TableHead><TableHead $align="left">{t('op.account.owed.why')}</TableHead>
                <TableHead>{t('op.amount')}</TableHead><TableHead>{t('op.account.owed.sales')}</TableHead>
                <TableHead>{t('op.account.royalties.state')}</TableHead><TableHead>{t('op.when')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {owed.slice(0, owedShown).map((r) => (
                  <TableRow key={r.key} data-testid="owed-row" data-state={r.state}>
                    <TableData $align="left" $padding="0 8px" title={r.address}>{shortAddr(r.address)}</TableData>
                    <TableData $align="left">{owedWhy(r)}</TableData>
                    <TableData title={money.note(r.currency)}>{money.revenue(r.amount, r.currency)}</TableData>
                    <TableData>{r.n}</TableData>
                    <TableData $color={r.state === 'credited' || r.state === 'paid' ? '#2f7d43' : r.state === 'failed' ? '#b4232f' : '#8a4b00'}>
                      {t(r.state === 'credited' ? 'op.account.owed.state.credited' : `op.teach.payouts.status.${r.state}`)}
                    </TableData>
                    <TableData title={dateTime(r.last)}>{elapsed(r.last)}</TableData>
                  </TableRow>
                ))}
                {owed.length === 0 && <TableRowEmpty $height={72}><td colSpan={6}>{t('op.account.owed.empty')}</td></TableRowEmpty>}
              </TableBody>
            </Table>
          </TableWrapper>
          <Rows t={t} shown={owedShown} total={owed.length} onMore={() => setOwedShown((n) => n + PAGE)} onAll={() => setOwedShown(owed.length)}
            onCsv={() => downloadCsv(`ainize-owed-${me?.name ?? 'node'}.csv`, [
              [t('op.account.owed.to'), t('op.account.owed.why'), t('op.amount'), 'currency', t('op.account.owed.sales'), t('op.account.royalties.state'), t('op.when')],
              ...owed.map((r) => [r.address, r.patch_id, r.amount, r.currency, r.n, r.state, iso(r.last)]),
            ])} />
          </>}
          <Muted style={{ display: 'block', marginTop: 8 }}>
            {t('op.account.owed.teaching')} <StyledLink to="/dashboard?tab=teaching">{t('op.account.owed.teaching.link')}</StyledLink>
          </Muted>
        </>
      )}

      <AccountPeers />
      <AccountRuntime />

      {/* ------------------------------------------------------------ operators & developers */}
      <SubTitle $mt={56}>{t('op.account.dev.title')}</SubTitle>
      <DevBox style={{ marginTop: 12 }}>
        <Stack $gap={10}>
          <Muted>{t('op.account.dev.retire')}</Muted>
          <MonoBox>ainize node retire</MonoBox>
          {isAin && <Muted>{t('op.account.dev.chain')}</Muted>}
          {info && (
            <>
              <Muted>{t('op.account.dev.raw')}</Muted>
              <Pre>{JSON.stringify({ address: me?.address, ledger: info.ledger, peers: info.peers, counts: info.counts, chain_head: shortHash(info.ledger.head ?? '', 20), settings: saved }, null, 2)}</Pre>
            </>
          )}
        </Stack>
      </DevBox>
    </PageWrapper>
  );
}
