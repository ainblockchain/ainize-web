import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useAnnounceMutation, useApplyMutation, useChallengeMutation, useDeletePatchMutation, usePatchQuery, useRemoveMutation, useRuntimeQuery,
  useUpdatePatchMutation, useVerifyMutation,
} from '@/api/api';
import type { PatchAnchor } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, Select, TextArea, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, KeyValue, Mono, PageWrapper, StatusChip, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { CheckItem, Checklist, ExternalAnchor, ExternalRow, ExternalTitle, MonoBox, Muted, Row, SectionBody, SmallSpinner, Stack, isInFlight } from '@/components/operator/common';
import { bytes, dateTime, num, price, scoreText, shortAddr, shortHash } from '@/utils/format';

const ProjectName = styled.h1`margin: 0; font-size: 28px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: break-all;`;
const SaveRow = styled.div`margin-top: 16px; display: flex; align-items: center; gap: 12px;`;
const DeleteDesc = styled.p`margin: 12px 0 16px; font-size: 14px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; max-width: 72ch;`;
const Textarea = styled.textarea`
  width: 100%; min-height: 220px; padding: 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.5; resize: vertical;
  &:focus { outline: none; border-color: #8b3eeb; } &:disabled { background: #fafafa; color: #8d8d8f; }
`;
const Snippet = styled.textarea`
  width: 100%; min-height: 64px; padding: 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; resize: none; background: #fafafa;
`;

export default function ManagePage() {
  const { author = '', patchId = '' } = useParams();
  const navigate = useNavigate();
  const { roles, address } = useAuth();
  const [poll, setPoll] = useState(false);
  const patch = usePatchQuery(patchId, { pollingInterval: poll ? 5000 : 0 });
  const p = patch.data;
  const inFlight = !!p && isInFlight(p.status);
  useEffect(() => { setPoll(inFlight); }, [inFlight]);
  const runtime = useRuntimeQuery();

  const [update, updateState] = useUpdatePatchMutation();
  const [announce, announceState] = useAnnounceMutation();
  const [verify, verifyState] = useVerifyMutation();
  const [challenge, challengeState] = useChallengeMutation();
  const [apply, applyState] = useApplyMutation();
  const [remove, removeState] = useRemoveMutation();
  const [del, delState] = useDeletePatchMutation();

  // editable fields (drafts only)
  const [desc, setDesc] = useState('');
  const [priceV, setPriceV] = useState('');
  const [branch, setBranch] = useState('');
  const [license, setLicense] = useState('');
  const [billing, setBilling] = useState<PatchAnchor['billing']>('per_download');
  const [benchText, setBenchText] = useState('');
  const [benchError, setBenchError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmMode, setConfirmMode] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!p) return;
    setDesc(p.anchor.description ?? ''); setPriceV(p.anchor.price); setBranch(p.anchor.branch ?? ''); setLicense(p.anchor.license ?? ''); setBilling(p.anchor.billing);
    setBenchText(JSON.stringify(p.anchor.benchmark, null, 2));
  }, [p?.anchor.id, p?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDraft = p?.status === 'DRAFT';
  const isVerifier = roles.includes('verifier');
  const alreadyAttested = !!p && !!address && p.attestations.some((a) => a.verifier === address);
  const canVerify = isVerifier && !!p && !isDraft && !alreadyAttested && p.status !== 'REJECTED';
  const snippet = useMemo(() => {
    if (!p) return '';
    const gw = p.gateway_url ?? `${window.location.origin}/x402/patch/${p.anchor.id}`;
    return `[![Knowledge patch: ${p.anchor.id}](${window.location.origin}/static/images/ic-certified.svg)](${gw})`;
  }, [p]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null); setNotice(null);
    try { await fn(); if (ok) setNotice(ok); } catch (err) { setError(errorMessage(err)); }
  };

  if (patch.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (patch.isError || !p) {
    return (
      <PageWrapper>
        <Title>Patch not found</Title>
        <Description>{patch.error ? errorMessage(patch.error) : 'No patch with that id is known to this node.'} <StyledLink to="/dashboard">Back to dashboard</StyledLink></Description>
      </PageWrapper>
    );
  }
  if (!p.owned) {
    return (
      <PageWrapper>
        <Title>{p.anchor.id}</Title>
        <Description>This patch belongs to {shortAddr(p.anchor.author)} — only its author node can manage it. <StyledLink to={`/${author}/${patchId}`}>View the patch page</StyledLink>.</Description>
      </PageWrapper>
    );
  }

  const a = p.anchor;
  const patchPage = `${window.location.origin}/${a.author}/${a.id}`;
  const gateway = p.gateway_url ?? `${window.location.origin}/x402/patch/${a.id}`;

  const saveFields = () => run(() => update({ id: a.id, patch: { description: desc, price: priceV, branch: branch || undefined, license: license || undefined, billing } }).unwrap(), 'Saved.');
  const saveBench = () => {
    setBenchError(null);
    let parsed: PatchAnchor['benchmark'];
    try { parsed = JSON.parse(benchText); } catch (e) { setBenchError(`Invalid JSON: ${(e as Error).message}`); return; }
    if (!parsed || typeof parsed.schema !== 'string' || !parsed.schema) { setBenchError('benchmark.schema (string) is required'); return; }
    void run(() => update({ id: a.id, patch: { benchmark: parsed } }).unwrap(), 'Benchmark saved.');
  };

  return (
    <PageWrapper>
      <ProjectName>{a.id}</ProjectName>
      <Row $gap={10} style={{ marginTop: 8 }}><StatusChip status={p.status} /><Muted>{a.name}</Muted></Row>
      <ExternalRow><ExternalTitle>Patch page</ExternalTitle><ExternalAnchor href={patchPage} $disabled={isDraft}>{patchPage}</ExternalAnchor></ExternalRow>
      <ExternalRow><ExternalTitle>x402 gateway</ExternalTitle><ExternalAnchor href={gateway} target="_blank" rel="noopener noreferrer" $disabled={p.status !== 'LISTED'}>{gateway}</ExternalAnchor></ExternalRow>
      {error && <Alert $tone="error" style={{ marginTop: 16 }}>{error}</Alert>}
      {notice && <Alert $tone="success" style={{ marginTop: 16 }}>{notice}</Alert>}

      {/* ------------------------------------------------------------ status */}
      <SubTitle $mt={56}>Status</SubTitle>
      <KeyValue>
        <dt>Verifications</dt><dd>{p.passed}/{p.quorum} passed · {p.attestations.length} attestation(s){inFlight && <> <SmallSpinner style={{ verticalAlign: 'middle', marginLeft: 6 }} /></>}</dd>
        <dt>Body</dt><dd>{p.has_body ? <>present · {bytes(a.size_bytes)} · {num(a.rows)} rows</> : <span style={{ color: '#e6173e' }}>missing on this node</span>}</dd>
        <dt>sha256</dt><dd><Mono>{a.patch_sha256}</Mono></dd>
        <dt>Model</dt><dd>{a.model.id_M}{a.model.row_dim ? ` · row dim ${a.model.row_dim}` : ''}</dd>
        <dt>Created</dt><dd>{dateTime(a.created_at)}</dd>
        {p.listed_at && <><dt>Listed</dt><dd>{dateTime(p.listed_at)}</dd></>}
      </KeyValue>
      {isDraft && (
        <SectionBody>
          <strong style={{ fontSize: 14 }}>Pre-announce checklist</strong>
          <Checklist>
            <CheckItem ok={p.has_body}>Patch body present in the blob store</CheckItem>
            <CheckItem ok={!!a.benchmark.schema}>Benchmark schema set ({a.benchmark.schema || 'missing'})</CheckItem>
            <CheckItem ok={(a.benchmark.samples?.length ?? 0) > 0}>Inline benchmark samples ({a.benchmark.samples?.length ?? 0}) — verifiers with a runtime score them</CheckItem>
            <CheckItem ok={!!a.description}>Description written</CheckItem>
            <CheckItem ok={p.conflicts.length === 0 || p.conflicts.every((c) => !c.same_schema)}>No overlap with a listed patch of the same schema ({p.conflicts.filter((c) => c.same_schema).length} same-schema overlaps)</CheckItem>
          </Checklist>
          <SaveRow>
            <Button variant="contained" disabled={!p.has_body || !a.benchmark.schema} loading={announceState.isLoading} loadingText="Announcing…"
              onClick={() => run(() => announce(a.id).unwrap(), 'Announced — the anchor is on the ledger and verifiers were notified.')}>Announce to the network</Button>
            <Muted>DRAFT → ANNOUNCED: the anchor becomes immutable; the body stays on this node until bought.</Muted>
          </SaveRow>
        </SectionBody>
      )}
      {!isDraft && (
        <SectionBody>
          <Row $gap={12}>
            {canVerify && <Button loading={verifyState.isLoading} loadingText="Verifying…" onClick={() => run(() => verify(a.id).unwrap(), 'Attestation published.')}>Verify now (this node)</Button>}
            {alreadyAttested && <Muted>This node already attested this patch.</Muted>}
          </Row>
          <Stack $gap={8} style={{ marginTop: 16, maxWidth: 560 }}>
            <TextField label="Challenge (re-verification)" placeholder="reason — e.g. benchmark answers look stale after 2026-08 delisting" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div><Button color="secondary" size="small" disabled={!reason.trim()} loading={challengeState.isLoading} onClick={() => run(() => challenge({ id: a.id, reason }).unwrap(), 'Challenge recorded.')}>Open challenge</Button></div>
          </Stack>
        </SectionBody>
      )}

      {/* ------------------------------------------------------------ attestations */}
      <SubTitle $mt={40}>Attestations</SubTitle>
      <TableWrapper style={{ marginTop: 12 }}>
        <Table>
          <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">Verifier</TableHead><TableHead>Result</TableHead><TableHead>Score</TableHead><TableHead>Engine</TableHead><TableHead>Restarts</TableHead><TableHead>Stake</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
          <TableBody>
            {p.attestations.map((at) => (
              <TableRow key={at.verifier}>
                <TableData $align="left" $padding="0 8px" title={at.verifier}>{at.verifier_name ?? shortAddr(at.verifier)}</TableData>
                <TableData $color={at.passed ? '#44a45f' : '#e6173e'} $weight={600}>{at.passed ? 'PASS' : 'FAIL'}</TableData>
                <TableData title={JSON.stringify(at.score)}>{scoreText(at.score)}</TableData>
                <TableData>{at.verified_on}</TableData>
                <TableData>{at.restarts_detected ?? 0}</TableData>
                <TableData>{at.stake}</TableData>
                <TableData>{at.created_at ? dateTime(at.created_at) : '—'}</TableData>
              </TableRow>
            ))}
            {p.attestations.length === 0 && <TableRowEmpty $height={80}><td colSpan={7}>No attestations yet.</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ------------------------------------------------------------ conflicts */}
      <SubTitle $mt={40}>Conflicts (address-set overlap)</SubTitle>
      <Description>Two patches conflict when their row address sets intersect. Same-schema overlaps on a newer patch mark the older one as superseded once listed.</Description>
      <TableWrapper style={{ marginTop: 12 }}>
        <Table>
          <TableHeader><TableRow><TableHead $align="left" $padding="0 8px">Patch</TableHead><TableHead>Overlap rows</TableHead><TableHead>Same schema</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {p.conflicts.map((c) => (
              <TableRow key={c.patch_id}>
                <TableData $align="left" $padding="0 8px"><StyledLink to={`/${a.author}/${c.patch_id}`}>{c.patch_id}</StyledLink></TableData>
                <TableData>{num(c.overlap_rows)}</TableData>
                <TableData $color={c.same_schema ? '#e6173e' : '#8d8d8f'}>{c.same_schema ? 'yes' : 'no'}</TableData>
                <TableData><StatusChip status={c.status} /></TableData>
              </TableRow>
            ))}
            {p.conflicts.length === 0 && <TableRowEmpty $height={80}><td colSpan={4}>No overlapping patches among bodies held by this node.</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ------------------------------------------------------------ editable fields */}
      <SubTitle $mt={56}>Description &amp; pricing</SubTitle>
      {!isDraft && <Description>Anchors are immutable on the ledger — these fields were sealed when the patch was announced.</Description>}
      <SectionBody>
        <Stack $gap={18}>
          <TextField label="Description" value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!isDraft} />
          <FormRow>
            <TextField label={`Price (${a.currency})`} type="number" min={0} step="0.000001" value={priceV} onChange={(e) => setPriceV(e.target.value)} disabled={!isDraft} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#8d8d8f', fontWeight: 500 }}>Billing</span>
              <Select value={billing} onChange={(e) => setBilling(e.target.value as PatchAnchor['billing'])} disabled={!isDraft}>
                <option value="per_download">per download</option><option value="per_apply_hour">per apply-hour</option><option value="per_hit">per hit</option>
              </Select>
            </label>
            <TextField label="Branch" placeholder="law/KR" value={branch} onChange={(e) => setBranch(e.target.value)} disabled={!isDraft} />
            <TextField label="License" placeholder="CC-BY-4.0" value={license} onChange={(e) => setLicense(e.target.value)} disabled={!isDraft} />
          </FormRow>
        </Stack>
        {isDraft && <SaveRow><Button loading={updateState.isLoading} loadingText="Saving…" onClick={saveFields}>Save</Button><Muted>Current price: {price(a.price, a.currency)}</Muted></SaveRow>}
      </SectionBody>

      {/* ------------------------------------------------------------ benchmark */}
      <SubTitle $mt={56}>Benchmark</SubTitle>
      <Description>Queries, formats and the collateral (locality) bound verifiers must respect. Inline <code>samples</code> are what runtime verifiers execute on the live model.</Description>
      <SectionBody>
        <Textarea value={benchText} onChange={(e) => setBenchText(e.target.value)} disabled={!isDraft} spellCheck={false} />
        {benchError && <Alert $tone="error" style={{ marginTop: 8 }}>{benchError}</Alert>}
        <Row $gap={16} style={{ marginTop: 8 }}>
          <Muted>benchmark hash <Mono>{shortHash(a.benchmark_hash, 16)}</Mono></Muted>
          {isDraft && <Button size="small" loading={updateState.isLoading} onClick={saveBench}>Save benchmark</Button>}
        </Row>
      </SectionBody>

      {/* ------------------------------------------------------------ lineage */}
      <SubTitle $mt={56}>Lineage</SubTitle>
      <KeyValue>
        <dt>Parents</dt><dd>{p.lineage.parents.length ? p.lineage.parents.map((x) => <span key={x.id} style={{ marginRight: 12 }}><StyledLink to={`/${x.author}/${x.id}`}>{x.id}</StyledLink> <StatusChip status={x.status} /></span>) : <Muted>none (root patch)</Muted>}</dd>
        <dt>Children</dt><dd>{p.lineage.children.length ? p.lineage.children.map((x) => <span key={x.id} style={{ marginRight: 12 }}><StyledLink to={`/${x.author}/${x.id}`}>{x.id}</StyledLink> <StatusChip status={x.status} /></span>) : <Muted>none</Muted>}</dd>
        <dt>Supersedes</dt><dd>{p.supersedes.length ? p.supersedes.join(', ') : <Muted>—</Muted>}</dd>
        <dt>Superseded by</dt><dd>{p.superseded_by.length ? p.superseded_by.join(', ') : <Muted>—</Muted>}</dd>
      </KeyValue>
      <Muted style={{ display: 'block', marginTop: 8 }}>Sales of derived patches pay royalties up the lineage automatically.</Muted>

      {/* ------------------------------------------------------------ runtime */}
      <SubTitle $mt={56}>Runtime</SubTitle>
      <Description>Apply the rows to the serving model without a restart (and revert them just as fast). Requires the patch hook on this node.</Description>
      <SaveRow>
        <Button disabled={!runtime.data?.available || !p.has_body || p.applied} loading={applyState.isLoading} loadingText="Applying…" onClick={() => run(() => apply(a.id).unwrap(), 'Applied to the serving table.')}>Apply</Button>
        <Button color="secondary" disabled={!runtime.data?.available || !p.applied} loading={removeState.isLoading} loadingText="Removing…" onClick={() => run(() => remove(a.id).unwrap(), 'Original rows restored.')}>Remove</Button>
        <Muted>{p.applied ? 'currently applied' : 'not applied'}{runtime.data && !runtime.data.available ? ` · runtime unavailable: ${runtime.data.error ?? ''}` : runtime.data?.model ? ` · ${runtime.data.model}` : ''}</Muted>
      </SaveRow>

      {/* ------------------------------------------------------------ markdown snippet */}
      <SubTitle $mt={56}>Markdown button snippet</SubTitle>
      <SectionBody>
        <Snippet readOnly value={snippet} />
        <Description style={{ marginTop: 8 }}>Copy and paste the badge into a README — it links straight to this patch&apos;s x402 gateway so agents can buy it.</Description>
        <div style={{ marginTop: 12 }}><CopyButton text={snippet} /></div>
      </SectionBody>

      {/* ------------------------------------------------------------ delete */}
      <SubTitle $mt={56}>Delete draft</SubTitle>
      {!isDraft ? (
        <DeleteDesc>Announced patches cannot be deleted — their anchor is a permanent ledger record. You can stop serving the body by removing it from the blob store on this node (CLI: <Mono>ngram patch forget {a.id}</Mono>).</DeleteDesc>
      ) : !confirmMode ? (
        <>
          <DeleteDesc>Deleting a draft removes it from this node. Nothing has been announced to the network yet, so no ledger record exists.</DeleteDesc>
          <Button color="secondary" onClick={() => setConfirmMode(true)}>Delete</Button>
        </>
      ) : (
        <Stack $gap={16} style={{ maxWidth: 480 }}>
          <TextField placeholder={`Please type ${a.id} to proceed.`} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <div>
            <Button color="secondary" disabled={confirmText !== a.id} loading={delState.isLoading} loadingText="Deleting…"
              onClick={() => run(async () => { await del(a.id).unwrap(); navigate('/dashboard'); })}>Confirm to delete</Button>
          </div>
        </Stack>
      )}
      <MonoBox style={{ marginTop: 40 }}>
        <Link to={`/project/${a.author}/${a.id}/logs`} style={{ color: '#8b3eeb', textDecoration: 'none' }}>→ View logs &amp; ledger timeline for {a.id}</Link>
      </MonoBox>
    </PageWrapper>
  );
}
