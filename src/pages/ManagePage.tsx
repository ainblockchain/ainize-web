import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useAnnounceMutation, useApplyMutation, useCatalogQuery, useChallengeMutation, useDeletePatchMutation, usePatchQuery, useRemoveMutation,
  useRetireMutation, useRuntimeQuery, useUpdatePatchMutation, useVerifyMutation,
} from '@/api/api';
import type { PatchAnchor } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, Select, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, KeyValue, Mono, PageWrapper, StatusChip, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { CheckItem, Checklist, DevBox, ExternalAnchor, ExternalRow, ExternalTitle, MonoBox, Muted, Row, SectionBody, SmallSpinner, Stack, Tip, isInFlight, useMoney } from '@/components/operator/common';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';
import { bytes, dateTime, num, scoreText, shortAddr, shortHash } from '@/utils/format';

const ProjectName = styled.h1`margin: 0; font-size: 28px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: break-all;`;
const SaveRow = styled.div`margin-top: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;`;
const DeleteDesc = styled.p`margin: 12px 0 16px; font-size: 14px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; max-width: 72ch;`;
const Textarea = styled.textarea`
  width: 100%; min-height: 220px; padding: 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.5; resize: vertical;
  &:focus { outline: none; border-color: #8b3eeb; } &:disabled { background: #fafafa; color: #8d8d8f; }
`;
const Snippet = styled.textarea`
  width: 100%; min-height: 64px; padding: 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; resize: none; background: #fafafa;
`;
const FieldLabel = styled.span`font-size: 12px; color: #8d8d8f; font-weight: 500;`;
/** Item 150: what publishing retires, as a list — a four-column table put the sales and the status off a phone screen. */
const RetireList = styled.ul`
  margin: 0; padding: 0; list-style: none; border-top: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const RetireRow = styled.li`
  display: flex; flex-wrap: wrap; gap: 4px 16px; justify-content: space-between; align-items: baseline;
  padding: 12px 2px; border-bottom: 1px solid #f4f4f4;
`;
const RetireWhat = styled.div`min-width: 0; flex: 1 1 200px; font-size: 14px; display: flex; flex-direction: column; gap: 2px;`;
const RetireFacts = styled.div`flex: 0 0 auto; text-align: right; font-size: 13px; display: flex; flex-direction: column; gap: 2px; align-items: flex-end;`;

export default function ManagePage() {
  const { t, term, help, tech } = useT();
  const money = useMoney();
  const { author = '', patchId = '' } = useParams();
  const navigate = useNavigate();
  const { roles, address } = useAuth();
  const [poll, setPoll] = useState(false);
  const patch = usePatchQuery(patchId, { pollingInterval: poll ? 5000 : 0 });
  const p = patch.data;
  const inFlight = !!p && isInFlight(p.status);
  useEffect(() => { setPoll(inFlight); }, [inFlight]);
  const runtime = useRuntimeQuery();
  // The retired items are knowledge this node already knows: their names, sales and revenue are on the catalogue.
  const catalog = useCatalogQuery({ limit: 200, include_drafts: true });
  useTitle(p ? p.anchor.name || p.anchor.id : undefined);

  const [update, updateState] = useUpdatePatchMutation();
  const [announce, announceState] = useAnnounceMutation();
  const [verify, verifyState] = useVerifyMutation();
  const [challenge, challengeState] = useChallengeMutation();
  const [apply, applyState] = useApplyMutation();
  const [remove, removeState] = useRemoveMutation();
  const [del, delState] = useDeletePatchMutation();
  const [retire, retireState] = useRetireMutation();

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
  /** Item 150: publishing over your own listed knowledge retires it — the sheet that has to be crossed first. */
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireText, setRetireText] = useState('');
  /** Item 148: the author's own takedown of a PUBLISHED knowledge — the exit `patch forget` was mistaken for. */
  const [downMode, setDownMode] = useState(false);
  const [downText, setDownText] = useState('');
  const [downReason, setDownReason] = useState('');
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
  // Item 146: this is the author's own manage page — a "verify" here would be a self-attestation, which the node
  // now refuses to write and the catalogue never counts. The button is gone and the reason is on the page.
  const isMine = !!p && !!address && p.anchor.author.toLowerCase() === address.toLowerCase();
  const canVerify = isVerifier && !!p && !isDraft && !alreadyAttested && !isMine && p.status !== 'REJECTED';
  const snippet = useMemo(() => {
    if (!p) return '';
    const gw = p.gateway_url ?? `${window.location.origin}/x402/patch/${p.anchor.id}`;
    return `[![Ainize knowledge: ${p.anchor.id}](${window.location.origin}/static/images/ic-certified.svg)](${gw})`;
  }, [p]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null); setNotice(null);
    try { await fn(); if (ok) setNotice(ok); } catch (err) { setError(errorMessage(err)); }
  };

  if (patch.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (patch.isError || !p) {
    return (
      <PageWrapper>
        <Title>{t('op.manage.notfound')}</Title>
        <Description>{patch.error ? errorMessage(patch.error) : t('op.manage.notfound.desc')} <StyledLink to="/dashboard">{t('op.manage.back')}</StyledLink></Description>
      </PageWrapper>
    );
  }
  if (!p.owned) {
    return (
      <PageWrapper>
        <Title>{p.anchor.name || p.anchor.id}</Title>
        <Description>{t('op.manage.notowned', { owner: p.anchor.author_name ?? shortAddr(p.anchor.author) })} <StyledLink to={`/${author}/${patchId}`}>{t('op.manage.viewpage')}</StyledLink>.</Description>
      </PageWrapper>
    );
  }

  const a = p.anchor;
  const patchPage = `${window.location.origin}/${a.author}/${a.id}`;
  const gateway = p.gateway_url ?? `${window.location.origin}/x402/patch/${a.id}`;
  /**
   * What `announce` will actually retire. The node records `pending_supersede` from the same-schema overlaps that are
   * NOT cross-branch and are still LISTED / VERIFYING / ANNOUNCED (market.ts:499), and `reconcileSupersedes` turns
   * each one into a permanent `supersede` record the moment this anchor reaches quorum. The checklist used to count
   * every same-subject overlap — including the cross-branch ones that deliberately coexist — and the Publish button
   * ignored the count entirely.
   */
  const retires = p.conflicts.filter((c) => c.same_schema && !c.cross_branch && ['LISTED', 'VERIFYING', 'ANNOUNCED'].includes(c.status));
  const coexisting = p.conflicts.filter((c) => c.same_schema && c.cross_branch).length;
  const byId = new Map((catalog.data?.items ?? []).map((e) => [e.anchor.id, e]));
  const billingLabel = (b: string) => { const k = `op.billing.${b}`; const v = t(k); return v === k ? b : v; };

  // An attestation this node wrote on its own anchor and excluded from the count (item 146).
  const selfCheck = (at: { verifier: string }) => p.self_checks > 0 && at.verifier.toLowerCase() === a.author.toLowerCase();

  const saveFields = () => run(() => update({ id: a.id, patch: { description: desc, price: priceV, branch: branch || undefined, license: license || undefined, billing } }).unwrap(), t('op.saved'));
  const saveBench = () => {
    setBenchError(null);
    let parsed: PatchAnchor['benchmark'];
    try { parsed = JSON.parse(benchText); } catch (e) { setBenchError(t('op.manage.bench.invalid', { message: (e as Error).message })); return; }
    if (!parsed || typeof parsed.schema !== 'string' || !parsed.schema) { setBenchError(t('op.manage.bench.schema_required')); return; }
    void run(() => update({ id: a.id, patch: { benchmark: parsed } }).unwrap(), t('op.manage.bench.saved'));
  };

  return (
    <PageWrapper>
      <ProjectName>{a.name || a.id}</ProjectName>
      <Row $gap={10} style={{ marginTop: 8 }}><StatusChip status={p.status} /><Muted><Mono>{a.id}</Mono></Muted></Row>
      <ExternalRow><ExternalTitle>{t('op.manage.page')}</ExternalTitle><ExternalAnchor href={patchPage} $disabled={isDraft}>{patchPage}</ExternalAnchor></ExternalRow>
      <ExternalRow><ExternalTitle><Tip tech={`${t('op.term.gateway.help')} · ${tech('autoPay')}`}>{t('op.manage.gateway')}</Tip></ExternalTitle><ExternalAnchor href={gateway} target="_blank" rel="noopener noreferrer" $disabled={p.status !== 'LISTED'}>{gateway}</ExternalAnchor></ExternalRow>
      <ExternalRow><ExternalTitle>{term('liveTest')}</ExternalTitle><StyledLink to={`/chat/${encodeURIComponent(a.id)}`} title={help('liveTest')}>{t('op.manage.runtime.try')} →</StyledLink></ExternalRow>
      {error && <Alert $tone="error" style={{ marginTop: 16 }}>{error}</Alert>}
      {notice && <Alert $tone="success" style={{ marginTop: 16 }}>{notice}</Alert>}
      {/* Item 153/156: the author is told a challenge exists, who wrote it, why, and what happens next. */}
      {p.open_challenge && (
        <Alert $tone="warning" style={{ marginTop: 16 }} title={t('op.manage.challenged.title')} data-testid="challenged-banner">
          <b>{t('op.manage.challenged.title')}</b> — {t('op.manage.challenged.body', { who: p.open_challenge.challenger, when: dateTime(p.open_challenge.created_at), reason: p.open_challenge.reason })}
        </Alert>
      )}

      {/* ------------------------------------------------------------ status */}
      <SubTitle $mt={56}>{t('op.manage.status')}</SubTitle>
      <KeyValue>
        <dt><Tip tech={tech('verified')}>{t('op.manage.verifs')}</Tip></dt>
        <dd title={`${t('op.term.executed')}: ${t('op.term.executed.help')}\n${t('op.term.integrity')}: ${t('op.term.integrity.help')}`}>
          {t('op.manage.verifs.value', { passed: Math.min(p.passed, p.quorum), quorum: p.quorum, integrity: p.integrity_checks, n: p.attestations.length })}
          {p.self_checks > 0 && <> · {t('op.manage.verifs.self', { n: p.self_checks })}</>}
          {inFlight && <> <SmallSpinner style={{ verticalAlign: 'middle', marginLeft: 6 }} /></>}
        </dd>
        <dt>{t('op.manage.file')}</dt>
        <dd title={tech('rows')}>{p.has_body
          ? t('op.manage.file.present', { size: bytes(a.size_bytes), rows: t('units.rows', { n: num(a.rows) }), facts: t('units.facts', { n: num(a.benchmark.queries) }) })
          : <span style={{ color: '#e6173e' }}>{t('op.manage.file.missing')}</span>}</dd>
        <dt><Tip tech="sha256 of the .npz body">{t('op.manage.fingerprint')}</Tip></dt><dd><Mono>{a.patch_sha256}</Mono></dd>
        <dt>{t('op.manage.model')}</dt><dd>{a.model.id_M}{a.model.row_dim ? <Muted title={t('op.tech.row_dim_help')}> · {t('op.tech.row_dim')} {a.model.row_dim}</Muted> : ''}</dd>
        <dt>{t('op.manage.created')}</dt><dd>{dateTime(a.created_at)}</dd>
        {p.listed_at && <><dt>{t('op.manage.listed')}</dt><dd>{dateTime(p.listed_at)}</dd></>}
      </KeyValue>
      {isDraft && (
        <SectionBody>
          <strong style={{ fontSize: 14 }}>{t('op.manage.checklist')}</strong>
          <Checklist>
            <CheckItem ok={p.has_body}>{t('op.manage.check.body')}</CheckItem>
            <CheckItem ok={!!a.benchmark.schema}>{t('op.manage.check.schema', { schema: a.benchmark.schema || t('op.manage.check.schema.missing') })}</CheckItem>
            <CheckItem ok={(a.benchmark.samples?.length ?? 0) > 0}>{t('op.manage.check.samples', { n: a.benchmark.samples?.length ?? 0 })}</CheckItem>
            <CheckItem ok={!!a.description}>{t('op.manage.check.desc')}</CheckItem>
            <CheckItem ok={retires.length === 0}>
              <span data-testid="check-retire">{retires.length === 0 ? t('op.manage.check.conflict', { n: 0 }) : t('op.manage.check.conflict.retire', { n: retires.length }, retires.length)}</span>
            </CheckItem>
          </Checklist>
          {coexisting > 0 && <Muted style={{ display: 'block', marginTop: 8 }}>{t('op.manage.retire.crossbranch', { n: coexisting })}</Muted>}
          <SaveRow>
            <Button variant="contained" disabled={!p.has_body || !a.benchmark.schema} loading={announceState.isLoading} loadingText={t('op.manage.announcing')}
              data-testid="announce"
              onClick={() => { if (retires.length > 0) { setRetireText(''); setRetireOpen(true); } else void run(() => announce(a.id).unwrap(), t('op.manage.announced')); }}>{t('op.manage.announce')}</Button>
            <Muted title={t('op.tech.announce')}>{t('op.manage.announce.note')}</Muted>
          </SaveRow>
        </SectionBody>
      )}
      {!isDraft && (
        <SectionBody>
          <Row $gap={12}>
            {canVerify && <Button loading={verifyState.isLoading} loadingText={t('op.manage.verifying')} onClick={() => run(() => verify(a.id).unwrap(), t('op.manage.verified_ok'))}>{t('op.manage.verify_now')}</Button>}
            {alreadyAttested && <Muted>{t('op.manage.already')}</Muted>}
            {isMine && !alreadyAttested && <Muted data-testid="self-verify-note">{t('op.manage.self_verify')}</Muted>}
          </Row>
          <Stack $gap={8} style={{ marginTop: 16, maxWidth: 560 }}>
            <TextField label={t('op.manage.challenge')} placeholder={t('op.manage.challenge.ph')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div><Button color="secondary" size="small" disabled={!reason.trim()} loading={challengeState.isLoading} onClick={() => run(() => challenge({ id: a.id, reason }).unwrap(), t('op.manage.challenge.ok'))}>{t('op.manage.challenge.button')}</Button></div>
          </Stack>
        </SectionBody>
      )}

      {/* Item 150 — publishing retires your own listed knowledge; nothing is announced until this is crossed. */}
      {retireOpen && (
        <Sheet title={t('op.manage.retire.title')} onClose={() => setRetireOpen(false)} width={680} testId="retire-sheet">
          <span>{t('op.manage.retire.body', { schema: a.benchmark.schema, id: a.id })}</span>
          <RetireList>
            {retires.map((c) => {
              const e = byId.get(c.patch_id);
              return (
                <RetireRow key={c.patch_id} data-testid="retire-row" data-id={c.patch_id}>
                  <RetireWhat>
                    <Row $gap={8} $wrap><StyledLink to={`/${e?.anchor.author ?? a.author}/${c.patch_id}`}>{e?.anchor.name || c.patch_id}</StyledLink><StatusChip status={e?.status ?? c.status} /></Row>
                    <Muted><Mono>{c.patch_id}</Mono></Muted>
                    {e?.status === 'LISTED' && <Muted>{t('op.manage.retire.selling')}</Muted>}
                  </RetireWhat>
                  <RetireFacts>
                    <span data-testid="retire-sales">{t('op.manage.retire.col.sales')}: {e && e.downloads > 0
                      ? t('op.manage.retire.sold', { n: e.downloads, revenue: money.revenue(e.revenue, e.anchor.currency) })
                      : t('op.manage.retire.sold_none')}</span>
                    <Muted>{t('op.manage.retire.col.overlap')}: {t('units.rows', { n: num(c.overlap_rows) })}</Muted>
                  </RetireFacts>
                </RetireRow>
              );
            })}
          </RetireList>
          {coexisting > 0 && <Muted>{t('op.manage.retire.crossbranch', { n: coexisting })}</Muted>}
          <TextField label={t('op.manage.retire.type', { id: a.id })} value={retireText} onChange={(e) => setRetireText(e.target.value)} data-testid="retire-type" />
          {error && <Alert $tone="error" role="alert">{error}</Alert>}
          <SheetFooter>
            <Button variant="text" color="default" onClick={() => setRetireOpen(false)}>{t('op.manage.retire.cancel')}</Button>
            <Button variant="contained" color="secondary" disabled={retireText.trim() !== a.id} loading={announceState.isLoading} loadingText={t('op.manage.announcing')}
              data-testid="retire-confirm"
              onClick={() => run(async () => { await announce(a.id).unwrap(); setRetireOpen(false); }, t('op.manage.announced'))}>{t('op.manage.retire.confirm')}</Button>
          </SheetFooter>
        </Sheet>
      )}

      {/* ------------------------------------------------------------ verification results */}
      <SubTitle $mt={40}>{t('op.manage.attest.title')}</SubTitle>
      <Description>{t('op.manage.attest.desc')}</Description>
      <TableWrapper style={{ marginTop: 12 }}>
        <Table>
          <TableHeader><TableRow>
            <TableHead $align="left" $padding="0 8px">{t('op.manage.attest.verifier')}</TableHead>
            <TableHead>{t('op.manage.attest.result')}</TableHead>
            <TableHead><Tip tech={tech('accuracy')}>{t('op.manage.attest.score')}</Tip></TableHead>
            <TableHead><Tip tech="verified_on: vllm | hook | hash-only">{t('op.manage.attest.how')}</Tip></TableHead>
            <TableHead><Tip tech="restarts_detected — reversions detected & re-applied during verification">{t('op.manage.attest.restarts')}</Tip></TableHead>
            <TableHead><Tip tech={tech('signedResult')}>{t('op.manage.attest.counts')}</Tip></TableHead>
            <TableHead>{t('op.when')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {p.attestations.map((at) => (
              <TableRow key={at.verifier}>
                <TableData $align="left" $padding="0 8px" title={at.verifier}>{at.verifier_name ?? shortAddr(at.verifier)}</TableData>
                <TableData $color={at.passed ? '#44a45f' : '#e6173e'} $weight={600}>{at.passed ? t('op.manage.attest.pass') : t('op.manage.attest.fail')}</TableData>
                <TableData title={at.verified_on !== 'hash-only' ? JSON.stringify(at.score) : t('op.term.integrity')}>{at.verified_on !== 'hash-only' ? scoreText(at.score) : '—'}</TableData>
                <TableData title={at.verified_on}>{at.verified_on === 'hash-only' ? t('op.manage.attest.how.hash') : t('op.manage.attest.how.run', { engine: at.verified_on })}</TableData>
                <TableData>{at.restarts_detected ?? 0}</TableData>
                <TableData $color={selfCheck(at) ? '#8a4b00' : undefined} title={help('signedResult')}>{selfCheck(at) ? t('op.manage.attest.counts_self') : t('op.manage.attest.counts_yes')}</TableData>
                <TableData>{at.created_at ? dateTime(at.created_at) : '—'}</TableData>
              </TableRow>
            ))}
            {p.attestations.length === 0 && <TableRowEmpty $height={80}><td colSpan={7}>{t('op.manage.attest.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ------------------------------------------------------------ overlap check */}
      <SubTitle $mt={40}><Tip tech={tech('conflict')}>{t('op.manage.conflict.title')}</Tip></SubTitle>
      <Description>{t('op.manage.conflict.desc')}</Description>
      <TableWrapper style={{ marginTop: 12 }}>
        <Table>
          <TableHeader><TableRow>
            <TableHead $align="left" $padding="0 8px">{t('op.knowledge')}</TableHead>
            <TableHead>{t('op.manage.conflict.who')}</TableHead>
            <TableHead><Tip tech="overlap_rows (shared table addresses)">{t('op.manage.conflict.overlap')}</Tip></TableHead>
            <TableHead>{t('op.manage.conflict.same')}</TableHead>
            <TableHead>{t('op.status')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {p.conflicts.map((c) => {
              // Item 363: a byte-identical republish of your file by another node shows up here with every row
              // shared — say so in words, because "2,992 memory entries" and "yes" do not read as "this is my file".
              const other = byId.get(c.patch_id);
              const copy = !!other && other.anchor.patch_sha256 === a.patch_sha256 && c.same_author === false;
              return (
                <TableRow key={c.patch_id}>
                  <TableData $align="left" $padding="0 8px">
                    <StyledLink to={`/${c.author ?? other?.anchor.author ?? a.author}/${c.patch_id}`}>{c.patch_id}</StyledLink>
                    {copy && <Muted style={{ display: 'block' }} data-testid="conflict-copy">{t('op.manage.conflict.copy')}</Muted>}
                  </TableData>
                  <TableData>{c.same_author === false
                    ? (c.author_name || shortAddr(c.author ?? other?.anchor.author ?? '', 6))
                    : <Muted>{t('op.manage.conflict.mine')}</Muted>}</TableData>
                  <TableData>{t('units.rows', { n: num(c.overlap_rows) })}</TableData>
                  <TableData $color={c.same_schema ? '#e6173e' : '#8d8d8f'}>{c.same_schema ? t('op.yes') : t('op.no')}</TableData>
                  <TableData><StatusChip status={c.status} /></TableData>
                </TableRow>
              );
            })}
            {p.conflicts.length === 0 && <TableRowEmpty $height={80}><td colSpan={5}>{t('op.manage.conflict.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ------------------------------------------------------------ editable fields */}
      <SubTitle $mt={56}>{t('op.manage.fields.title')}</SubTitle>
      {!isDraft && <Description>{t('op.manage.fields.sealed')}</Description>}
      <SectionBody>
        <Stack $gap={18}>
          <TextField label={t('op.manage.fields.desc')} value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!isDraft} />
          <FormRow>
            <TextField label={t('op.manage.fields.price', { unit: money.unit(a.currency) })} helper={money.note(a.currency)} type="number" min={0} step="0.000001" value={priceV} onChange={(e) => setPriceV(e.target.value)} disabled={!isDraft} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldLabel>{t('op.manage.fields.billing')}</FieldLabel>
              <Select value={billing} onChange={(e) => setBilling(e.target.value as PatchAnchor['billing'])} disabled={!isDraft}>
                {(['per_download', 'per_apply_hour', 'per_hit'] as const).map((b) => <option key={b} value={b}>{billingLabel(b)}</option>)}
              </Select>
            </label>
            <TextField label={t('op.manage.fields.branch')} placeholder="law/KR" value={branch} onChange={(e) => setBranch(e.target.value)} disabled={!isDraft} />
            <TextField label={t('op.manage.fields.license')} placeholder="CC-BY-4.0" value={license} onChange={(e) => setLicense(e.target.value)} disabled={!isDraft} />
          </FormRow>
        </Stack>
        {isDraft && <SaveRow><Button loading={updateState.isLoading} loadingText={t('op.saving')} onClick={saveFields}>{t('common.save')}</Button><Muted>{t('op.manage.fields.current', { price: money.fmt(a.price, a.currency) })}</Muted></SaveRow>}
      </SectionBody>

      {/* ------------------------------------------------------------ benchmark */}
      <SubTitle $mt={56}><Tip tech={tech('facts')}>{t('op.manage.bench.title')}</Tip></SubTitle>
      <Description>{t('op.manage.bench.desc')}</Description>
      <SectionBody>
        <Textarea value={benchText} onChange={(e) => setBenchText(e.target.value)} disabled={!isDraft} spellCheck={false} />
        {benchError && <Alert $tone="error" style={{ marginTop: 8 }}>{benchError}</Alert>}
        <Row $gap={16} style={{ marginTop: 8 }}>
          <Muted title="sha256(canonical(benchmark))">{t('op.manage.bench.hash')} <Mono>{shortHash(a.benchmark_hash, 16)}</Mono></Muted>
          {isDraft && <Button size="small" loading={updateState.isLoading} onClick={saveBench}>{t('op.manage.bench.save')}</Button>}
        </Row>
      </SectionBody>

      {/* ------------------------------------------------------------ lineage */}
      <SubTitle $mt={56}><Tip tech={tech('lineage')}>{t('op.manage.lineage.title')}</Tip></SubTitle>
      <KeyValue>
        <dt>{t('op.manage.lineage.parents')}</dt><dd>{p.lineage.parents.length ? p.lineage.parents.map((x) => <span key={x.id} style={{ marginRight: 12 }}><StyledLink to={`/${x.author}/${x.id}`}>{x.name || x.id}</StyledLink> <StatusChip status={x.status} /></span>) : <Muted>{t('op.manage.lineage.root')}</Muted>}</dd>
        <dt>{t('op.manage.lineage.children')}</dt><dd>{p.lineage.children.length ? p.lineage.children.map((x) => <span key={x.id} style={{ marginRight: 12 }}><StyledLink to={`/${x.author}/${x.id}`}>{x.name || x.id}</StyledLink> <StatusChip status={x.status} /></span>) : <Muted>{t('op.none')}</Muted>}</dd>
        <dt>{t('op.manage.lineage.supersedes')}</dt><dd>{p.supersedes.length ? p.supersedes.join(', ') : <Muted>—</Muted>}</dd>
        <dt>{t('op.manage.lineage.superseded_by')}</dt><dd>{p.superseded_by.length ? p.superseded_by.join(', ') : <Muted>—</Muted>}</dd>
      </KeyValue>
      <Muted style={{ display: 'block', marginTop: 8 }} title={help('lineage')}>{t('op.manage.lineage.note')}</Muted>

      {/* ------------------------------------------------------------ runtime */}
      <SubTitle $mt={56}><Tip tech={`${tech('apply')} / ${tech('remove')}`}>{t('op.manage.runtime.title')}</Tip></SubTitle>
      <Description>{t('op.manage.runtime.desc')}</Description>
      <SaveRow>
        <Button disabled={!runtime.data?.available || !p.has_body || p.applied} loading={applyState.isLoading} loadingText={t('op.manage.runtime.loading')} onClick={() => run(() => apply(a.id).unwrap(), t('op.manage.runtime.loaded_ok'))}>{term('apply')}</Button>
        <Button color="secondary" disabled={!runtime.data?.available || !p.applied} loading={removeState.isLoading} loadingText={t('op.manage.runtime.unloading')} onClick={() => run(() => remove(a.id).unwrap(), t('op.manage.runtime.unloaded_ok'))}>{term('remove')}</Button>
        <Muted>
          {p.applied ? t('op.manage.runtime.is_loaded') : t('op.manage.runtime.not_loaded')}
          {runtime.data && !runtime.data.available ? ` · ${t('op.runtime.unavailable', { error: runtime.data.error ?? t('op.runtime.noapi') })}` : runtime.data?.model ? ` · ${runtime.data.model}` : ''}
        </Muted>
        <StyledLink to={`/chat/${encodeURIComponent(a.id)}`} title={help('liveTest')}>{t('op.manage.runtime.try')} →</StyledLink>
      </SaveRow>

      {/* ------------------------------------------------------------ markdown snippet */}
      <SubTitle $mt={56}>{t('op.manage.badge.title')}</SubTitle>
      <SectionBody>
        <Snippet readOnly value={snippet} />
        <Description style={{ marginTop: 8 }}>{t('op.manage.badge.desc')}</Description>
        <div style={{ marginTop: 12 }}><CopyButton text={snippet} label={t('common.copy')} /></div>
      </SectionBody>

      {/* ------------------------------------------------------------ delete (draft) / take off sale (published) */}
      <SubTitle $mt={56}>{isDraft ? t('op.manage.delete.title') : t('op.manage.takedown.title')}</SubTitle>
      {!isDraft ? (
        <>
          {p.status === 'RETIRED' ? (
            <DeleteDesc data-testid="retired-note">
              {t('op.manage.takedown.already', { when: p.retired_at ? dateTime(p.retired_at) : '—' })}
              {p.retire_reason ? ` ${t('op.manage.takedown.already.reason', { reason: p.retire_reason })}` : ''}
            </DeleteDesc>
          ) : !downMode ? (
            <>
              <DeleteDesc>{t('op.manage.delete.sealed')} {t('op.manage.takedown.desc')}</DeleteDesc>
              <Button color="secondary" data-testid="takedown" onClick={() => { setDownText(''); setDownReason(''); setDownMode(true); }}>{t('op.manage.takedown.button')}</Button>
            </>
          ) : (
            <Stack $gap={16} style={{ maxWidth: 560 }}>
              <DeleteDesc style={{ margin: 0 }}>{t('op.manage.takedown.desc')}</DeleteDesc>
              {p.downloads > 0 && <Muted>{t('op.manage.takedown.sales', { n: p.downloads })}</Muted>}
              <TextField label={t('op.manage.takedown.reason')} placeholder={t('op.manage.takedown.reason.ph')} value={downReason} onChange={(e) => setDownReason(e.target.value)} data-testid="takedown-reason" />
              <TextField label={t('op.manage.takedown.type', { id: a.id })} value={downText} onChange={(e) => setDownText(e.target.value)} data-testid="takedown-type" />
              <Row $gap={12}>
                <Button variant="contained" color="secondary" disabled={downText.trim() !== a.id} loading={retireState.isLoading} loadingText={t('op.manage.takedown.working')}
                  data-testid="takedown-confirm"
                  onClick={() => run(async () => { await retire({ id: a.id, reason: downReason.trim() || undefined }).unwrap(); setDownMode(false); }, t('op.manage.takedown.done'))}>{t('op.manage.takedown.confirm')}</Button>
                <Button variant="text" color="default" onClick={() => setDownMode(false)}>{t('op.manage.takedown.cancel')}</Button>
              </Row>
            </Stack>
          )}
          <DevBox style={{ marginTop: 24 }}>
            <Muted style={{ display: 'block', marginBottom: 6 }}>{t('op.manage.dev.forget')}</Muted>
            <MonoBox>ainize patch forget {a.id}</MonoBox>
          </DevBox>
        </>
      ) : !confirmMode ? (
        <>
          <DeleteDesc>{t('op.manage.delete.desc')}</DeleteDesc>
          <Button color="secondary" onClick={() => setConfirmMode(true)}>{t('op.manage.delete.button')}</Button>
        </>
      ) : (
        <Stack $gap={16} style={{ maxWidth: 480 }}>
          <TextField placeholder={t('op.manage.delete.type', { id: a.id })} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <div>
            <Button color="secondary" disabled={confirmText !== a.id} loading={delState.isLoading} loadingText={t('op.manage.delete.deleting')}
              onClick={() => run(async () => { await del(a.id).unwrap(); navigate('/dashboard'); })}>{t('op.manage.delete.confirm')}</Button>
          </div>
        </Stack>
      )}
      <MonoBox style={{ marginTop: 40 }}>
        <Link to={`/project/${a.author}/${a.id}/logs`} style={{ color: '#8b3eeb', textDecoration: 'none' }}>{t('op.manage.logs_link', { id: a.id })}</Link>
      </MonoBox>
    </PageWrapper>
  );
}
