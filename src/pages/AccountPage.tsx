import { useEffect, useState, type FormEvent } from 'react';
import styled from 'styled-components';
import {
  errorMessage, useAddPeerMutation, useChainSetupMutation, useCompleteMutation, useInfoQuery, useMeQuery, useNodesQuery, useRemovePeerMutation, useRuntimeQuery,
  useSettingsQuery, useUpdateSettingsMutation, useWalletQuery,
} from '@/api/api';
import type { Settings } from '@/api/types';
import { useT } from '@/i18n';
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

export default function AccountPage() {
  const { t, term, help, tech } = useT();
  const money = useMoney();
  const elapsed = useElapsed();
  const { data: me } = useMeQuery();
  const { data: info } = useInfoQuery();
  const wallet = useWalletQuery();
  const nodes = useNodesQuery(undefined, { pollingInterval: 15_000 });
  const runtime = useRuntimeQuery();
  const settings = useSettingsQuery();
  const [updateSettings, settingsState] = useUpdateSettingsMutation();
  const [chainSetup, chainState] = useChainSetupMutation();
  const [addPeer, addState] = useAddPeerMutation();
  const [removePeer, removeState] = useRemovePeerMutation();
  const [complete, completeState] = useCompleteMutation();

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
  const roleLabel = (r: string) => { const k = `op.role.${r}`; const v = t(k); return v === k ? r : v; };
  const [peersBefore, peersAfter] = t('op.account.peers.desc', { link: '|' }).split('|');
  const [tryBefore, tryAfter] = t('op.account.runtime.try.desc', { link: '|' }).split('|');

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

      {/* ------------------------------------------------------------ wallet */}
      <SubTitle $mt={56}>{t('op.account.wallet')}</SubTitle>
      <Description>{isAin ? t('op.account.wallet.desc.ain') : t('op.account.wallet.desc.credit')}</Description>
      {wallet.isLoading ? <CenterProgress /> : wallet.data && (
        <>
          <Balance title={money.note(currency)}>{wallet.data.balance === null ? '—' : num(wallet.data.balance)}<span>{money.unit(currency)}</span></Balance>
          <Muted style={{ display: 'block' }} title={currency === 'AIN' ? tech('ain') : tech('credit')}>{money.note(currency)}</Muted>
          <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.wallet.summary', { purchases: wallet.data.purchases, sales: wallet.data.sales.length, royalties: wallet.data.royalties.length })}</Muted>
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
                    {wallet.data.sales.slice(0, 20).map((s) => (
                      <TableRow key={s.tx_hash}>
                        <TableData $align="left" $padding="0 8px">{s.patch_id}</TableData>
                        <TableData title={s.buyer}>{shortAddr(s.buyer)}</TableData>
                        <TableData title={money.note(s.currency)}>{money.fmt(s.amount, s.currency)}</TableData>
                        <TableData title={dateTime(s.created_at)}>{elapsed(s.created_at)}</TableData>
                      </TableRow>
                    ))}
                    {wallet.data.sales.length === 0 && <TableRowEmpty $height={72}><td colSpan={4}>{t('op.account.sales.empty')}</td></TableRowEmpty>}
                  </TableBody>
                </Table>
              </TableWrapper>
            </div>
            <div>
              <strong style={{ fontSize: 14 }}><Tip tech={tech('lineage')}>{t('op.account.royalties')}</Tip></strong>
              <TableWrapper style={{ marginTop: 8 }}>
                <Table>
                  <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">{t('op.account.royalties.col')}</TableHead><TableHead>{t('op.amount')}</TableHead><TableHead>{t('op.when')}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {wallet.data.royalties.slice(0, 20).map((r, i) => (
                      <TableRow key={`${r.patch_id}-${i}`}>
                        <TableData $align="left" $padding="0 8px">{r.patch_id}</TableData>
                        <TableData title={money.note(currency)}>{money.fmt(r.amount, currency)}</TableData>
                        <TableData title={dateTime(r.created_at)}>{elapsed(r.created_at)}</TableData>
                      </TableRow>
                    ))}
                    {wallet.data.royalties.length === 0 && <TableRowEmpty $height={72}><td colSpan={3}>{t('op.account.royalties.empty')}</td></TableRowEmpty>}
                  </TableBody>
                </Table>
              </TableWrapper>
            </div>
          </Grid>
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
