import { useEffect, useMemo, useState, type FormEvent } from 'react';
import styled from 'styled-components';
import {
  errorMessage, useAddPeerMutation, useChainSetupMutation, useCompleteMutation, useInfoQuery, useMeQuery, useMyPatchesQuery, useNodesQuery, usePayoutsQuery,
  useRemovePeerMutation, useRuntimeQuery, useSettingsQuery, useUpdateSettingsMutation, useWalletQuery,
} from '@/api/api';
import type { PayoutRow, Settings, Settlement } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { DevBox, MonoBox, Muted, Pre, RadioGroup, Row, Stack, Tip, useElapsed, useMoney } from '@/components/operator/common';
import { dateTime, num, shortAddr, shortHash } from '@/utils/format';

const Section = styled.div`margin-top: 16px;`;
const Balance = styled.div`font-size: 28px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; margin-top: 12px; span { font-size: 14px; font-weight: 400; color: ${(p) => p.theme.color.GREY}; margin-left: 8px; }`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px; margin-top: 16px;`;
const SettingsForm = styled.form`margin-top: 16px; display: flex; flex-direction: column; gap: 18px; max-width: 640px;`;

const NOTIF: Settings['notifications'][] = ['all', 'sales', 'none'];
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
 * What this node owes other people, folded per (payee, knowledge, state) — item 315. Two sources, and they never
 * overlap: an AIN sale writes a `payouts` row per payee and the transfer state lives there, while a local-credit
 * sale enqueues nothing at all because the share is already in the payee's balance the moment the record is
 * written. The old screen said the money was "pending until it runs on the AI Network", which on a local ledger
 * was true of nothing.
 */
interface OwedRow { key: string; address: string; patch_id: string; amount: number; currency: string; n: number; last: number; state: 'credited' | PayoutRow['status'] }
function owedRows(sales: Settlement[], payouts: PayoutRow[], me: string): OwedRow[] {
  const out = new Map<string, OwedRow>();
  const add = (address: string, patch_id: string, amount: number, currency: string, state: OwedRow['state'], at: number) => {
    if (!(amount > 0) || address.toLowerCase() === me.toLowerCase()) return;
    const key = `${address.toLowerCase()}|${patch_id}|${state}`;
    const cur = out.get(key);
    if (cur) { cur.amount += amount; cur.n += 1; cur.last = Math.max(cur.last, at); }
    else out.set(key, { key, address, patch_id, amount, currency, n: 1, last: at, state });
  };
  for (const s of sales) {
    if (s.scheme !== 'local-credit') continue;                       // an AIN sale is accounted by its payout rows
    for (const [address, amount] of Object.entries(s.royalty ?? {})) add(address, s.patch_id, Number(amount), s.currency, 'credited', s.created_at);
  }
  for (const p of payouts) add(p.address, p.patch_id, Number(p.amount), p.currency, p.status, p.updated_at || p.created_at);
  return [...out.values()].sort((a, b) => b.amount - a.amount);
}

export default function AccountPage() {
  const { t, term, help, tech } = useT();
  useTitle(t('op.account.title'));
  const money = useMoney();
  const elapsed = useElapsed();
  const { data: me } = useMeQuery();
  const { data: info } = useInfoQuery();
  const wallet = useWalletQuery();
  const nodes = useNodesQuery(undefined, { pollingInterval: 15_000 });
  const runtime = useRuntimeQuery();
  const settings = useSettingsQuery();
  const payouts = usePayoutsQuery({ limit: 500 });
  const myPatches = useMyPatchesQuery();
  const [updateSettings, settingsState] = useUpdateSettingsMutation();
  const [chainSetup, chainState] = useChainSetupMutation();
  const [addPeer, addState] = useAddPeerMutation();
  const [removePeer, removeState] = useRemovePeerMutation();
  const [complete, completeState] = useCompleteMutation();

  const [salesShown, setSalesShown] = useState(PAGE);
  const [royShown, setRoyShown] = useState(PAGE);
  const [owedShown, setOwedShown] = useState(PAGE);
  const [endpoint, setEndpoint] = useState('');
  const [prompt, setPrompt] = useState(() => t('op.account.try.default_prompt'));
  const [completion, setCompletion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // settings form — seeded from the node, saved back with PATCH /api/me/settings
  const [form, setForm] = useState<Settings>({ notifications: 'all', display_name: '', payout_address: '' });
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  useEffect(() => { if (settings.data) setForm(settings.data.settings); }, [settings.data]);
  const saved = settings.data?.settings;
  const dirty = !!saved && (saved.notifications !== form.notifications || saved.display_name !== form.display_name || saved.payout_address !== form.payout_address);
  const onSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsNotice(null); setSettingsError(null);
    if (!saved || !dirty) { setSettingsNotice(t('op.account.settings.unchanged')); return; }
    const patch: Partial<Settings> = {};
    if (saved.notifications !== form.notifications) patch.notifications = form.notifications;
    if (saved.display_name !== form.display_name) patch.display_name = form.display_name.trim();
    if (saved.payout_address !== form.payout_address) patch.payout_address = form.payout_address.trim();
    try { await updateSettings(patch).unwrap(); setSettingsNotice(t('op.account.settings.saved')); } catch (err) { setSettingsError(errorMessage(err)); }
  };

  const run = async (fn: () => Promise<unknown>, ok?: string) => { setError(null); setNotice(null); try { await fn(); if (ok) setNotice(ok); } catch (err) { setError(errorMessage(err)); } };
  const onAddPeer = (e: FormEvent) => { e.preventDefault(); if (!endpoint.trim()) return; void run(async () => { await addPeer({ endpoint: endpoint.trim().replace(/\/+$/, '') }).unwrap(); setEndpoint(''); }, t('op.account.peers.added')); };
  const onTry = () => { setCompletion(null); void run(async () => { const r = await complete({ prompt, max_tokens: 16 }).unwrap(); setCompletion(r.text); }); };

  const currency = info?.currency ?? wallet.data?.network ?? '';
  const isAin = info?.ledger.kind === 'ain';
  /**
   * Item 356: the largest number this screen shows was the one with no provenance. `price.ain_note` says "local dev
   * chain" for every AIN node whatever it is attached to, so the kind is read off the provider the node reports.
   */
  const netKind = !isAin ? 'credit'
    : !info?.ledger.provider ? 'unknown'
      : /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|\.local(:|\/|$)/.test(info.ledger.provider) ? 'local_chain'
        : /test/i.test(info.ledger.provider) ? 'testnet' : 'mainnet';
  const netNote = t(`op.account.wallet.network.${netKind}`);

  const sales = wallet.data?.sales ?? [];
  const royalties = wallet.data?.royalties ?? [];
  // Item 315 — what this node owes, on the money screen instead of only under a tab about taught lessons.
  const owed = useMemo(() => owedRows(sales, payouts.data?.items ?? [], me?.address ?? ''), [sales, payouts.data, me?.address]);
  const owedTotals = useMemo(() => ({
    open: owed.filter((r) => r.state === 'pending' || r.state === 'failed').reduce((n, r) => n + r.amount, 0),
    credited: owed.filter((r) => r.state === 'credited').reduce((n, r) => n + r.amount, 0),
    paid: owed.filter((r) => r.state === 'paid').reduce((n, r) => n + r.amount, 0),
  }), [owed]);
  /** Why this address is owed anything, from the sold anchor itself: it verified, it provided data, or it is upstream. */
  const owedWhy = (r: OwedRow): string => {
    const e = (myPatches.data?.items ?? []).find((x) => x.anchor.id === r.patch_id);
    const low = r.address.toLowerCase();
    if (e?.verifiers?.some((v) => v.toLowerCase() === low)) return t('op.account.owed.why.verification', { id: r.patch_id });
    if ((e?.anchor.contributors ?? []).some((c) => c.address?.toLowerCase() === low)) return t('op.account.owed.why.provider', { id: r.patch_id });
    return t('op.account.owed.why.lineage', { id: r.patch_id });
  };
  const roleLabel = (r: string) => { const k = `op.role.${r}`; const v = t(k); return v === k ? r : v; };
  const [peersBefore, peersAfter] = t('op.account.peers.desc', { link: '|' }).split('|');
  const [tryBefore, tryAfter] = t('op.account.runtime.try.desc', { link: '|' }).split('|');
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
      <SubTitle $mt={56}>{t('op.account.settings.title')}</SubTitle>
      <Description>{t('op.account.settings.desc')}</Description>
      {settings.isLoading ? <CenterProgress /> : settings.isError ? (
        <Alert $tone="warning" style={{ marginTop: 16 }}>{t('common.error', { message: errorMessage(settings.error) })}</Alert>
      ) : (
        <SettingsForm onSubmit={onSaveSettings}>
          <TextField label={t('op.account.display_name')} helper={t('op.account.display_name.helper')} value={form.display_name} maxLength={64} required onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          <TextField label={<Tip tech={tech('lineage')}>{t('op.account.payout')}</Tip>} helper={t('op.account.payout.helper')} value={form.payout_address} placeholder={me?.address} onChange={(e) => setForm({ ...form, payout_address: e.target.value })} />
          <div>
            <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}>{t('op.account.notif')}</span>
            <RadioGroup role="radiogroup" aria-label={t('op.account.notif')}>
              {NOTIF.map((o) => (
                <label key={o}><input type="radio" name="notifications" value={o} checked={form.notifications === o} onChange={() => setForm({ ...form, notifications: o })} />{t(`op.account.notif.${o}`)}</label>
              ))}
            </RadioGroup>
          </div>
          {settingsError && <Alert $tone="error">{settingsError}</Alert>}
          <Row $gap={12}>
            <Button type="submit" variant="contained" disabled={!dirty} loading={settingsState.isLoading} loadingText={t('op.saving')}>{t('op.account.settings.save')}</Button>
            {settingsNotice && !dirty && <Muted style={{ color: '#44a45f' }}>{settingsNotice}</Muted>}
          </Row>
        </SettingsForm>
      )}

      {/* ------------------------------------------------------------ teaching (settings live on My knowledge → Teaching, spec §5.13) */}
      <SubTitle $mt={56}>{t('op.account.teach.title')}</SubTitle>
      <Description data-testid="account-teach">{teachBefore}<StyledLink to="/dashboard?tab=teaching">{t('op.account.teach.link')}</StyledLink>{teachAfter}</Description>

      {/* ------------------------------------------------------------ wallet */}
      <SubTitle $mt={56}>{t('op.account.wallet')}</SubTitle>
      <Description>{isAin ? t('op.account.wallet.desc.ain') : t('op.account.wallet.desc.credit')}</Description>
      {wallet.isLoading ? <CenterProgress /> : wallet.data && (
        <>
          <Balance title={netNote}>{wallet.data.balance === null ? '—' : num(wallet.data.balance)}<span>{money.unit(currency)}</span></Balance>
          <Muted style={{ display: 'block' }} data-testid="wallet-network" title={currency === 'AIN' ? tech('ain') : tech('credit')}>
            {netNote}{isAin && info?.ledger.provider ? <> · <Mono>{info.ledger.provider}</Mono></> : null}
          </Muted>
          <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.wallet.summary', { purchases: wallet.data.purchases, sales: sales.length, royalties: royalties.length })}</Muted>
          {isAin && (
            <Row $gap={12} style={{ marginTop: 12 }}>
              <Button size="small" loading={chainState.isLoading} loadingText={t('op.account.chain.setting')} onClick={() => run(() => chainSetup().unwrap(), t('op.account.chain.done'))}>{t('op.account.chain.setup')}</Button>
              <Muted title={t('op.account.dev.chain')}>{t('op.account.chain.note')}</Muted>
            </Row>
          )}
          <Grid>
            <div>
              <strong style={{ fontSize: 14 }}>{t('op.account.sales')}</strong>
              <TableWrapper style={{ marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">{t('op.knowledge')}</TableHead><TableHead>{t('op.buyer')}</TableHead><TableHead>{t('op.amount')}</TableHead><TableHead>{t('op.when')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sales.slice(0, salesShown).map((s) => (
                      <TableRow key={s.tx_hash}>
                        <TableData $align="left" $padding="0 8px">{s.patch_id}</TableData>
                        <TableData title={s.buyer}>{shortAddr(s.buyer)}</TableData>
                        <TableData title={money.note(s.currency)}>{money.fmt(s.amount, s.currency)}</TableData>
                        <TableData title={dateTime(s.created_at)}>{elapsed(s.created_at)}</TableData>
                      </TableRow>
                    ))}
                    {sales.length === 0 && <TableRowEmpty $height={72}><td colSpan={4}>{t('op.account.sales.empty')}</td></TableRowEmpty>}
                  </TableBody>
                </Table>
              </TableWrapper>
              {/* Item 94: 20 of 244 rows, no count, no dates, no way to the rest — on the only screen that carries them. */}
              <Rows t={t} shown={salesShown} total={sales.length} onMore={() => setSalesShown((n) => n + PAGE)} onAll={() => setSalesShown(sales.length)}
                onCsv={() => downloadCsv(`ainize-sales-${me?.name ?? 'node'}.csv`, [
                  [t('op.when'), t('op.knowledge'), t('op.buyer'), t('op.amount'), 'currency', 'scheme', 'tx_hash'],
                  ...sales.map((s) => [iso(s.created_at), s.patch_id, s.buyer, s.amount, s.currency, s.scheme, s.tx_hash]),
                ])} />
            </div>
            <div>
              <strong style={{ fontSize: 14 }}><Tip tech={tech('lineage')}>{t('op.account.royalties')}</Tip></strong>
              {/* Item 311: a settle record naming this address is the SELLER's promise, not a receipt. Every row now
                  carries the state this node can actually defend, and the three totals can be reconciled. */}
              {wallet.data.royalty_totals && (
                <Muted style={{ display: 'block', marginTop: 6 }} data-testid="royalty-totals">{t('op.account.royalties.totals', {
                  owed: money.fmt(wallet.data.royalty_totals.owed, currency), credited: money.fmt(wallet.data.royalty_totals.credited, currency),
                  paid: money.fmt(wallet.data.royalty_totals.paid, currency), unconfirmed: money.fmt(wallet.data.royalty_totals.unconfirmed, currency),
                })}</Muted>
              )}
              <TableWrapper style={{ marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">{t('op.account.royalties.col')}</TableHead><TableHead>{t('op.account.royalties.for')}</TableHead><TableHead>{t('op.amount')}</TableHead><TableHead>{t('op.account.royalties.state')}</TableHead><TableHead>{t('op.when')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {royalties.slice(0, royShown).map((r, i) => (
                      <TableRow key={`${r.patch_id}-${i}`}>
                        <TableData $align="left" $padding="0 8px">{r.patch_id}</TableData>
                        <TableData>{t(r.kind === 'verification' ? 'op.account.royalties.for.verification' : 'op.account.royalties.for.lineage')}</TableData>
                        <TableData title={money.note(r.currency ?? currency)}>{money.fmt(r.amount, r.currency ?? currency)}</TableData>
                        <TableData data-testid="royalty-state" title={r.tx_hash ?? r.last_error ?? undefined} $color={r.state === 'credited' || r.state === 'paid' ? '#2f7d43' : r.state === 'failed' ? '#b4232f' : '#8a4b00'}>
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
                  ...royalties.map((r) => [iso(r.created_at), r.patch_id, r.kind ?? '', r.amount, r.currency ?? currency, r.state ?? 'unconfirmed', r.seller ?? '', r.buyer ?? '', r.tx_hash ?? '']),
                ])} />
              <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.royalties.explain')}</Muted>
              {/* Item 325: the fourth party in this economy — the one that only paid — can now see what it earned. */}
              <strong style={{ fontSize: 14, display: 'block', marginTop: 20 }}>{t('op.account.verification')}</strong>
              <Muted style={{ display: 'block', marginTop: 6 }} data-testid="verification-earned">{wallet.data.verification?.length
                ? t('op.account.verification.some', { n: wallet.data.verification.length, amount: money.fmt(wallet.data.verification_total ?? '0', currency) })
                : t('op.account.verification.none', { pct: Math.round((wallet.data.verifier_share ?? 0.05) * 100) })}</Muted>
            </div>
          </Grid>

          {/* ---------------------------------------------------------- what this node owes other people (item 315) */}
          <SubTitle $mt={40}>{t('op.account.owed')}</SubTitle>
          <Description data-testid="owed-desc">{isAin ? t('op.account.owed.desc.ain', { n: payouts.data?.max_attempts ?? 20 }) : t('op.account.owed.desc.local')}</Description>
          <Muted style={{ display: 'block', marginTop: 6 }} data-testid="owed-totals">{t('op.account.owed.totals', {
            open: money.revenue(owedTotals.open, currency), credited: money.revenue(owedTotals.credited, currency), paid: money.revenue(owedTotals.paid, currency),
          })}</Muted>
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
          <Muted style={{ display: 'block', marginTop: 8 }}>
            {t('op.account.owed.teaching')} <StyledLink to="/dashboard?tab=teaching">{t('op.account.owed.teaching.link')}</StyledLink>
          </Muted>
        </>
      )}

      {/* ------------------------------------------------------------ peers */}
      <SubTitle $mt={56}><Tip tech={tech('node')}>{t('op.account.peers')}</Tip></SubTitle>
      <Description>{peersBefore}<StyledLink to="/network">{t('op.account.peers.network')}</StyledLink>{peersAfter}</Description>
      <TableWrapper style={{ marginTop: 12 }}>
        <Table>
          <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">{t('op.account.peers.endpoint')}</TableHead><TableHead>{t('op.name')}</TableHead><TableHead>{t('op.address')}</TableHead><TableHead>{t('op.roles')}</TableHead><TableHead>{t('op.account.peers.lastseen')}</TableHead><TableHead>{t('op.account.peers.failures')}</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {(nodes.data?.peers ?? []).map((p) => (
              <TableRow key={p.endpoint}>
                <TableData $align="left" $padding="0 8px" $mono title={p.endpoint}>{p.endpoint}</TableData>
                <TableData>{p.info?.name ?? '—'}</TableData>
                <TableData title={p.address ?? ''}>{shortAddr(p.address)}</TableData>
                <TableData>{p.info?.roles.map(roleLabel).join(', ') ?? '—'}</TableData>
                <TableData>{p.last_seen ? elapsed(p.last_seen) : t('op.never')}</TableData>
                <TableData $color={p.failures > 0 ? '#e6173e' : undefined}>{p.failures}</TableData>
                <TableData><Button size="small" variant="text" color="secondary" loading={removeState.isLoading && removeState.originalArgs?.endpoint === p.endpoint} onClick={() => run(() => removePeer({ endpoint: p.endpoint }).unwrap(), t('op.account.peers.removed'))}>{t('op.remove')}</Button></TableData>
              </TableRow>
            ))}
            {(nodes.data?.peers ?? []).length === 0 && <TableRowEmpty $height={72}><td colSpan={7}>{t('op.account.peers.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      <form onSubmit={onAddPeer} style={{ marginTop: 16, maxWidth: 560 }}>
        <Row $gap={12} $align="flex-end">
          <TextField label={t('op.account.peers.add')} placeholder="http://127.0.0.1:3403" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
          <Button type="submit" loading={addState.isLoading}>{t('op.add')}</Button>
        </Row>
      </form>

      {/* ------------------------------------------------------------ runtime */}
      <SubTitle $mt={56}><Tip tech={tech('apply')}>{t('op.account.runtime')}</Tip></SubTitle>
      <Description>{t('op.account.runtime.desc')}</Description>
      {runtime.isLoading ? <CenterProgress /> : runtime.data && (
        <Section>
          <KeyValue>
            <dt>{t('op.status')}</dt><dd style={{ color: runtime.data.available ? '#44a45f' : '#e6173e', fontWeight: 600 }}>{runtime.data.available ? t('op.account.runtime.available') : `${t('op.account.runtime.unavailable')}${runtime.data.error ? ` — ${runtime.data.error}` : ''}`}</dd>
            <dt>{t('op.account.runtime.api')}</dt><dd><Mono>{runtime.data.api ?? '—'}</Mono></dd>
            <dt>{t('op.account.runtime.model')}</dt><dd>{runtime.data.model ?? '—'}</dd>
            <dt><Tip tech="patch hook (row read/write on the serving table)">{t('op.account.runtime.hook')}</Tip></dt><dd>{runtime.data.hook ? t('op.account.runtime.connected') : t('op.account.runtime.disconnected')}</dd>
            <dt>{t('op.account.runtime.loaded')}</dt><dd>{runtime.data.applied.length ? runtime.data.applied.map((a) => <span key={a.patch_id} style={{ marginRight: 12 }}>{a.patch_id} <Muted>({a.reason}, {elapsed(a.applied_at)})</Muted></span>) : <Muted>{t('op.none')}</Muted>}</dd>
          </KeyValue>
          <Stack $gap={12} style={{ marginTop: 20, maxWidth: 640 }}>
            <strong style={{ fontSize: 14 }}>{t('op.account.runtime.try')}</strong>
            <Muted>{tryBefore}<StyledLink to="/chat" title={help('liveTest')}>{term('liveTest')}</StyledLink>{tryAfter}</Muted>
            <Row $gap={12} $align="flex-end">
              <TextField label={t('op.account.runtime.prompt')} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <Button disabled={!runtime.data.model} loading={completeState.isLoading} loadingText={t('op.account.runtime.asking')} onClick={onTry}>{t('op.account.runtime.ask')}</Button>
            </Row>
            {completion !== null && <MonoBox><span style={{ color: '#8d8d8f' }}>{prompt}</span><strong>{completion}</strong></MonoBox>}
          </Stack>
        </Section>
      )}

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
