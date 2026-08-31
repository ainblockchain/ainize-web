import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useAddToBranchMutation, useApplyMutation, useBranchesQuery, useCreateBranchMutation, useInfoQuery, useMyPatchesQuery, useMyPurchasesQuery,
  useRemoveMutation, useRuntimeQuery, useSubscribeMutation,
} from '@/api/api';
import type { CatalogEntry } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Select, TextField } from '@/components/ui/Form';
import { LogIcon, ManageIcon, OpenWindowIcon } from '@/components/ui/Icons';
import { CenterProgress, PageWrapper, StatusChip, SubTitle, Title, TitleRow, Description } from '@/components/ui/Misc';
import { SubText, Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { IconButton, Row, SmallSpinner, Stack, StatusText, isInFlight } from '@/components/operator/common';
import { dateTime, num, price, shortAddr, shortHash } from '@/utils/format';

const NameLink = styled(Link)`
  font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { text-decoration: underline; }
`;
const HEADERS = ['Name', 'Status', 'Verifications', 'Sales', 'Logs', 'Gateway', 'Manage'];
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

export default function DashboardPage() {
  const { address } = useAuth();
  const navigate = useNavigate();
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

  const salesText = (e: CatalogEntry) => `${num(e.downloads)} · ${Number(e.revenue) > 0 ? price(e.revenue, e.anchor.currency || currency) : `0 ${e.anchor.currency || currency}`}`;

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>Dashboard</Title>
        <Button variant="outlined" color="primary" onClick={() => navigate('/new-patch')}>Add new patch</Button>
      </TitleRow>
      {actionError && <Alert $tone="error" style={{ marginBottom: 16 }}>{actionError}</Alert>}

      {/* ---------------------------------------------------------------- my patches */}
      {patches.isLoading ? <CenterProgress /> : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                {HEADERS.map((h, i) => <TableHead key={h} $align={i === 0 ? 'left' : 'center'} $padding={i === 0 ? '0 0 0 32px' : undefined}>{h}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => {
                const a = e.anchor;
                const author = a.author;
                return (
                  <TableRow key={a.id}>
                    <TableData $align="left" $padding="8px 0 8px 32px" $maxWidth="360px">
                      <NameLink to={`/${author}/${a.id}`}>{a.id}</NameLink>
                      <SubText title={a.name}>{a.model.id_M} · {a.benchmark.schema}</SubText>
                    </TableData>
                    <TableData>
                      <StatusText style={{ justifyContent: 'center' }}>
                        {isInFlight(e.status) && e.status !== 'CHALLENGED' && <SmallSpinner />}
                        <StatusChip status={e.status} />
                      </StatusText>
                    </TableData>
                    <TableData>{e.passed}/{e.quorum}</TableData>
                    <TableData title="downloads · revenue">{salesText(e)}</TableData>
                    <TableData>
                      <IconButton aria-label="logs" onClick={() => navigate(`/project/${author}/${a.id}/logs`)}><LogIcon /></IconButton>
                    </TableData>
                    <TableData>
                      {a.gateway_url ? (
                        <a href={a.gateway_url} target="_blank" rel="noopener noreferrer" aria-label="x402 gateway" title={a.gateway_url} style={{ display: 'inline-flex', padding: 6 }}><OpenWindowIcon /></a>
                      ) : <span style={{ color: '#dadada' }}>—</span>}
                    </TableData>
                    <TableData>
                      <IconButton aria-label="manage" onClick={() => navigate(`/project/${author}/${a.id}`)}><ManageIcon /></IconButton>
                    </TableData>
                  </TableRow>
                );
              })}
              {items.length === 0 && <TableRowEmpty $height={160}><td colSpan={HEADERS.length}>No patches yet — add your first knowledge patch.</td></TableRowEmpty>}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {/* ---------------------------------------------------------------- purchases */}
      <SubTitle $mt={56}>Purchases</SubTitle>
      <Description>Patches this node bought through the HTTP 402 flow. Bodies are stored locally and can be applied to the serving runtime.</Description>
      <TableWrapper style={{ marginTop: 16 }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead $align="left" $padding="0 0 0 32px">Patch</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Tx</TableHead>
              <TableHead>Downloaded</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Runtime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(purchases.data?.items ?? []).map((p) => {
              const author = p.entry?.anchor.author;
              const busy = (applyState.isLoading && applyState.originalArgs === p.patch_id) || (removeState.isLoading && removeState.originalArgs === p.patch_id);
              return (
                <TableRow key={p.patch_id}>
                  <TableData $align="left" $padding="8px 0 8px 32px" $maxWidth="320px">
                    {author ? <NameLink to={`/${author}/${p.patch_id}`}>{p.patch_id}</NameLink> : <strong>{p.patch_id}</strong>}
                    <SubText>{p.entry?.anchor.name ?? shortHash(p.sha256, 16)}</SubText>
                  </TableData>
                  <TableData>{price(p.amount, p.entry?.anchor.currency ?? currency)} <SubText style={{ display: 'inline' }}>({p.scheme})</SubText></TableData>
                  <TableData $mono title={p.tx_hash}>{shortHash(p.tx_hash, 12)}</TableData>
                  <TableData $mono title={p.path ?? ''}>{p.path ? `…/${p.path.split('/').slice(-1)[0].slice(0, 18)}` : '—'}</TableData>
                  <TableData>{p.applied ? <span style={{ color: '#44a45f', fontWeight: 600 }}>yes</span> : 'no'}</TableData>
                  <TableData>
                    <Row $gap={6} $justify="center">
                      <Button size="small" disabled={!runtime.data?.available || busy || p.applied} loading={busy && !p.applied} onClick={() => run(() => apply(p.patch_id).unwrap())}>Apply</Button>
                      <Button size="small" color="secondary" disabled={!runtime.data?.available || busy || !p.applied} loading={busy && p.applied} onClick={() => run(() => remove(p.patch_id).unwrap())}>Remove</Button>
                    </Row>
                  </TableData>
                </TableRow>
              );
            })}
            {(purchases.data?.items ?? []).length === 0 && <TableRowEmpty $height={120}><td colSpan={6}>No purchases yet — explore the catalog and buy a listed patch.</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>
      {runtime.data && !runtime.data.available && <StatusText style={{ marginTop: 8 }}>Runtime unavailable: {runtime.data.error ?? 'no serving API'} — apply/remove disabled.</StatusText>}

      {/* ---------------------------------------------------------------- branches */}
      <SubTitle $mt={56}>Subscriptions &amp; branches</SubTitle>
      <Description>
        Branches keep contradictory knowledge in parallel (e.g. law/KR vs law/US). Subscribing makes this node acquire and apply every patch of the branch; the gateway routes requests by branch context.
      </Description>
      {branches.isLoading ? <CenterProgress /> : (
        <BranchGrid>
          {(branches.data?.branches ?? []).map((b) => {
            const mine = branches.data?.mine.includes(b.name);
            const busy = subState.isLoading && subState.originalArgs?.name === b.name;
            return (
              <BranchCard key={b.name}>
                <Row $justify="space-between">
                  <strong>{b.name}</strong>
                  {mine && <Tag>subscribed</Tag>}
                </Row>
                <span style={{ fontSize: 13, color: '#8d8d8f' }}>{b.description || 'no description'}</span>
                <Row $gap={6}>{Object.entries(b.context).map(([k, v]) => <Tag key={k}>{k}={v}</Tag>)}{Object.keys(b.context).length === 0 && <Tag>no context</Tag>}</Row>
                <span style={{ fontSize: 12, color: '#8d8d8f' }}>{b.patch_ids.length} patch(es) · {b.subscribers.length} subscriber(s) · owner {shortAddr(b.owner)}</span>
                <Row $gap={8}>
                  {mine
                    ? <Button size="small" color="secondary" loading={busy} onClick={() => run(() => subscribe({ name: b.name, action: 'unsubscribe' }).unwrap())}>Unsubscribe</Button>
                    : <Button size="small" loading={busy} onClick={() => run(() => subscribe({ name: b.name, action: 'subscribe' }).unwrap())}>Subscribe</Button>}
                </Row>
              </BranchCard>
            );
          })}
          {(branches.data?.branches ?? []).length === 0 && <span style={{ color: '#8d8d8f', fontSize: 14 }}>No branches yet.</span>}
        </BranchGrid>
      )}

      <MiniForm onSubmit={onCreateBranch}>
        <strong style={{ fontSize: 14 }}>Create a branch</strong>
        <TextField label="Name" placeholder="law/KR" value={bName} onChange={(e) => setBName(e.target.value)} required />
        <TextField label="Description" placeholder="대한민국 관할 법률 지식 브랜치" value={bDesc} onChange={(e) => setBDesc(e.target.value)} />
        <Stack $gap={8}>
          <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}>Context attributes (used by the gateway router)</span>
          {ctx.map((c, i) => (
            <ContextRow key={i}>
              <TextField placeholder="key (e.g. jurisdiction)" value={c.k} onChange={(e) => setCtx(ctx.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} />
              <TextField placeholder="value (e.g. KR)" value={c.v} onChange={(e) => setCtx(ctx.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} />
              <Button type="button" size="small" variant="text" color="default" onClick={() => setCtx(ctx.filter((_, j) => j !== i))} disabled={ctx.length === 1}>Remove</Button>
            </ContextRow>
          ))}
          <div><Button type="button" size="small" variant="text" onClick={() => setCtx([...ctx, { k: '', v: '' }])}>+ attribute</Button></div>
        </Stack>
        {listedMine.length > 0 && (
          <Stack $gap={6}>
            <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}>Initial patches (your listed patches)</span>
            {listedMine.map((e) => (
              <Checkbox key={e.anchor.id} label={<span>{e.anchor.id} <span style={{ color: '#8d8d8f' }}>· {e.anchor.name}</span></span>} checked={bPatches.includes(e.anchor.id)}
                onChange={(ev) => setBPatches(ev.target.checked ? [...bPatches, e.anchor.id] : bPatches.filter((x) => x !== e.anchor.id))} />
            ))}
          </Stack>
        )}
        <div><Button type="submit" loading={createState.isLoading} loadingText="Creating…">Create branch</Button></div>
      </MiniForm>

      {ownedBranches.length > 0 && (
        <MiniForm onSubmit={onAddToBranch}>
          <strong style={{ fontSize: 14 }}>Add a patch to one of your branches</strong>
          <ContextRow style={{ gridTemplateColumns: '1fr 1fr auto' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}>Branch</span>
              <Select value={addBranch} onChange={(e) => setAddBranch(e.target.value)} required>
                <option value="">select…</option>
                {ownedBranches.map((b) => <option key={b.name} value={b.name}>{b.name}</option>)}
              </Select>
            </label>
            <TextField label="Patch id" placeholder="krx-all-2761" value={addPatch} onChange={(e) => setAddPatch(e.target.value)} required />
            <Button type="submit" loading={addState.isLoading}>Add</Button>
          </ContextRow>
          <span style={{ fontSize: 12, color: '#8d8d8f' }}>Latest branch write wins on the ledger — only the branch owner can add patches. {dateTime(Date.now()).slice(0, 0)}</span>
        </MiniForm>
      )}
    </PageWrapper>
  );
}
