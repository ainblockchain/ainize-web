import { lazy, Suspense, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useAddToBranchMutation, useApplyMutation, useBranchesQuery, useCreateBranchMutation, useInfoQuery, useMyPatchesQuery, useMyPurchasesQuery,
  useRemoveMutation, useRuntimeQuery, useSubscribeMutation,
} from '@/api/api';
import type { CatalogEntry } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Select, TextField } from '@/components/ui/Form';
import { LogIcon, ManageIcon, OpenWindowIcon } from '@/components/ui/Icons';
import { CenterProgress, PageWrapper, StatusChip, SubTitle, Tabs, Title, TitleRow, Description } from '@/components/ui/Misc';
import { SubText, Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { IconButton, LiveTestIcon, Row, SmallSpinner, Stack, StatusText, Tip, isInFlight, useMoney } from '@/components/operator/common';
import { num, shortAddr, shortHash } from '@/utils/format';

const NameLink = styled(Link)`
  font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { text-decoration: underline; }
`;
const IconLink = styled(Link)`
  display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-radius: 4px; &:hover { background: #f5eefc; }
`;
const BranchCard = styled.div`
  padding: 16px 20px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; display: flex; flex-direction: column; gap: 8px;
`;
const BranchGrid = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;`;
const MiniForm = styled.form`
  margin-top: 16px; padding: 16px 20px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; display: flex; flex-direction: column; gap: 14px; max-width: 640px;
`;
const ContextRow = styled.div`display: grid; grid-template-columns: 1fr 1fr auto; gap: 12px; align-items: end;`;
const Tag = styled.span`
  display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; background: #f5eefc; color: #5b1ca8; font-family: ${(p) => p.theme.font.mono};
`;
const FieldLabel = styled.span`font-size: 12px; color: #8d8d8f; font-weight: 500;`;

/** Teaching tab (spec §5.13) is code-split: most operators open My knowledge far more often than the teach queue. */
const TeachingTab = lazy(() => import('@/components/operator/TeachingTab'));

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
  const currency = info?.currency ?? '';
  const [inFlight, setInFlight] = useState(false);
  const patches = useMyPatchesQuery(undefined, { pollingInterval: inFlight ? 5000 : 0 });
  const items = patches.data?.items ?? [];
  const anyInFlight = items.some((e) => isInFlight(e.status));
  if (anyInFlight !== inFlight) setInFlight(anyInFlight);

  const purchases = useMyPurchasesQuery();
  const runtime = useRuntimeQuery();
  const [apply, applyState] = useApplyMutation();
  const [remove, removeState] = useRemoveMutation();
  const branches = useBranchesQuery();
  const [subscribe, subState] = useSubscribeMutation();
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
  const schemeText = (scheme: string) => (scheme === 'ain-transfer' ? t('op.dash.purchases.scheme.ain') : scheme === 'local-credit' ? t('op.dash.purchases.scheme.credit') : scheme);

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
        {tab === 'knowledge' && <Button variant="outlined" color="primary" onClick={() => navigate('/new-patch')}>{t('op.dash.register')}</Button>}
      </TitleRow>
      <div style={{ marginBottom: 24 }}>
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'knowledge', label: t('op.dash.tab.knowledge') }, { id: 'teaching', label: t('op.dash.tab.teaching') }]} />
      </div>
      {tab === 'teaching' && <Suspense fallback={<CenterProgress />}><TeachingTab /></Suspense>}
      {tab === 'knowledge' && (<>
      {actionError && <Alert $tone="error" style={{ marginBottom: 16 }}>{actionError}</Alert>}

      {/* ---------------------------------------------------------------- my knowledge */}
      {patches.isLoading ? <CenterProgress /> : (
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
              {items.map((e) => {
                const a = e.anchor;
                const author = a.author;
                return (
                  <TableRow key={a.id}>
                    <TableData $align="left" $padding="8px 0 8px 32px" $maxWidth="360px">
                      <NameLink to={`/${author}/${a.id}`}>{a.name || a.id}</NameLink>
                      <SubText title={a.id}>{a.id} · {a.model.id_M} · {t('units.facts', { n: num(a.benchmark.queries) })}</SubText>
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
                    <TableData title={t('op.dash.sales.hint')}>{salesText(e)}</TableData>
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
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {/* ---------------------------------------------------------------- purchases */}
      <SubTitle $mt={56}>{t('op.dash.purchases.title')}</SubTitle>
      <Description title={tech('autoPay')}>{t('op.dash.purchases.desc')}</Description>
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
              const busy = (applyState.isLoading && applyState.originalArgs === p.patch_id) || (removeState.isLoading && removeState.originalArgs === p.patch_id);
              return (
                <TableRow key={p.patch_id}>
                  <TableData $align="left" $padding="8px 0 8px 32px" $maxWidth="320px">
                    {author ? <NameLink to={`/${author}/${p.patch_id}`}>{p.entry?.anchor.name ?? p.patch_id}</NameLink> : <strong>{p.patch_id}</strong>}
                    <SubText>{p.entry ? p.patch_id : shortHash(p.sha256, 16)}</SubText>
                  </TableData>
                  <TableData title={money.note(cur)}>{money.fmt(p.amount, cur)} <SubText style={{ display: 'inline' }}>({schemeText(p.scheme)})</SubText></TableData>
                  <TableData $mono title={p.tx_hash}>{shortHash(p.tx_hash, 12)}</TableData>
                  <TableData $mono title={p.path ?? ''}>{p.path ? `…/${p.path.split('/').slice(-1)[0].slice(0, 18)}` : '—'}</TableData>
                  <TableData>{p.applied ? <span style={{ color: '#44a45f', fontWeight: 600 }}>{t('op.yes')}</span> : t('op.no')}</TableData>
                  <TableData>
                    <Row $gap={6} $justify="center">
                      <Button size="small" title={help('apply')} disabled={!runtime.data?.available || busy || p.applied} loading={busy && !p.applied} onClick={() => run(() => apply(p.patch_id).unwrap())}>{term('apply')}</Button>
                      <Button size="small" color="secondary" title={help('remove')} disabled={!runtime.data?.available || busy || !p.applied} loading={busy && p.applied} onClick={() => run(() => remove(p.patch_id).unwrap())}>{term('remove')}</Button>
                    </Row>
                  </TableData>
                  <TableData>
                    <IconLink to={`/chat/${encodeURIComponent(p.patch_id)}`} aria-label={t('op.livetest')} title={`${t('op.livetest')} — ${t('op.livetest.hint')}`}><LiveTestIcon /></IconLink>
                  </TableData>
                </TableRow>
              );
            })}
            {(purchases.data?.items ?? []).length === 0 && <TableRowEmpty $height={120}><td colSpan={7}>{t('op.dash.purchases.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      {runtime.data && !runtime.data.available && <StatusText style={{ marginTop: 8 }}>{t('op.runtime.unavailable', { error: runtime.data.error ?? t('op.runtime.noapi') })}</StatusText>}

      {/* ---------------------------------------------------------------- knowledge tracks (branches) */}
      <SubTitle $mt={56}><Tip tech={tech('branch')}>{t('op.dash.branches.title')}</Tip></SubTitle>
      <Description>{t('op.dash.branches.desc')}</Description>
      {branches.isLoading ? <CenterProgress /> : (
        <BranchGrid>
          {(branches.data?.branches ?? []).map((b) => {
            const mine = branches.data?.mine.includes(b.name);
            const busy = subState.isLoading && subState.originalArgs?.name === b.name;
            return (
              <BranchCard key={b.name}>
                <Row $justify="space-between">
                  <strong>{b.name}</strong>
                  {mine && <Tag>{t('op.dash.branches.subscribed')}</Tag>}
                </Row>
                <span style={{ fontSize: 13, color: '#8d8d8f' }}>{b.description || t('op.dash.branches.nodesc')}</span>
                <Row $gap={6}>{Object.entries(b.context).map(([k, v]) => <Tag key={k}>{k}={v}</Tag>)}{Object.keys(b.context).length === 0 && <Tag>{t('op.dash.branches.noctx')}</Tag>}</Row>
                <span style={{ fontSize: 12, color: '#8d8d8f' }}>{t('op.dash.branches.meta', { patches: b.patch_ids.length, subs: b.subscribers.length, owner: shortAddr(b.owner) })}</span>
                <Row $gap={8}>
                  {mine
                    ? <Button size="small" color="secondary" loading={busy} onClick={() => run(() => subscribe({ name: b.name, action: 'unsubscribe' }).unwrap())}>{t('op.dash.branches.unsubscribe')}</Button>
                    : <Button size="small" loading={busy} onClick={() => run(() => subscribe({ name: b.name, action: 'subscribe' }).unwrap())}>{t('op.dash.branches.subscribe')}</Button>}
                </Row>
              </BranchCard>
            );
          })}
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
