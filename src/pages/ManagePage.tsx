import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useAnnounceMutation, useCatalogQuery, useChallengeMutation, useDeletePatchMutation, usePatchQuery,
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
import { useLoadChain } from '@/components/detail/LoadChain';
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
/** Finding 32: the consequences of a permanent act, in the same shape the subscribe sheet already uses for its own. */
const Consequences = styled.ul`
  margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK};
`;

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
  /**
   * SC-15 — an add-on is loaded with what it was trained on top of, and unloading something with a knowledge on top
   * of it says which one. The bare apply this page used to send answered `needs_base` with a code and no way out.
   */
  const chain = useLoadChain((id) => catalog.data?.items.find((e) => e.anchor.id === id)?.anchor.name || id);
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
  /**
   * Item 150 + finding 32: publishing is the permanent, public, paid act, and it used to be one unguarded click
   * whenever it happened to retire nothing. Every publish crosses this sheet now; the typed id below is kept only
   * for the publish that ALSO retires knowledge somebody is buying right now.
   */
  const [publishOpen, setPublishOpen] = useState(false);
  const [retireText, setRetireText] = useState('');
  /** Finding 33: "Verifying…" with no sense of how long it has been holding this node's model. */
  const [verifyStart, setVerifyStart] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (verifyStart === null) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [verifyStart]);
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
  /**
   * Finding 167 — the badge was `ic-certified.svg`, declared 12×12, so a reader saw a tick barely larger than the
   * full stop beside it; and its href was the x402 gateway, which answers a browser with a 402 payment-requirements
   * JSON body rather than a page. It is a real badge with an intrinsic width now, pointing at the knowledge page —
   * a page a person can read, and where the Buy button lives. The gateway keeps its own row, for agents.
   */
  const snippet = useMemo(() => {
    if (!p) return '';
    const alt = t('op.manage.badge.alt', { name: p.anchor.name || p.anchor.id });
    return `[![${alt}](${window.location.origin}/static/images/badge-knowledge.svg)](${window.location.origin}/${p.anchor.author}/${p.anchor.id})`;
  }, [p, t]);

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

  /**
   * Finding 33 — what "Verify now" really spends. The stake it was accused of hiding no longer exists: the node
   * ignores `verifier.stake` and says so in its own log (server.ts), nothing is escrowed, transferred or slashed.
   * What IS spent is this node's model for minutes, and its signature on a permanent public record. And when the
   * run cannot execute — no matching model server, or no sample questions — it degrades to an integrity check that
   * does not count toward a quorum, which the operator has to know BEFORE clicking, not from the results table.
   * The three conditions below are exactly the ones verifier.ts:51 uses to choose between the two.
   */
  const sampleCount = a.benchmark.samples?.length ?? 0;
  const canExecute = !!runtime.data?.available && !!runtime.data.model && a.model.id_M.startsWith(runtime.data.model) && sampleCount > 0;
  const elapsed = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const doVerify = () => {
    setVerifyStart(Date.now());
    void run(() => verify(a.id).unwrap(), t('op.manage.verified_ok')).finally(() => setVerifyStart(null));
  };

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
      {/* Finding 167: the row that carries the real shareable link was plain text, while the only CopyButton on the
          page sat on the broken snippet. It is the one URL a publisher pastes anywhere, so it is copyable. */}
      <ExternalRow>
        <ExternalTitle>{t('op.manage.page')}</ExternalTitle>
        <ExternalAnchor href={patchPage} $disabled={isDraft}>{patchPage}</ExternalAnchor>
        {!isDraft && <CopyButton text={patchPage} label={t('common.copy')} />}
      </ExternalRow>
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
      {/* Item 154: "Registered · awaiting verification" for ever, with the reason only in the VERIFIERS' logs. This
          is what the publisher's own node knows: how long, who it asked, what each of them serves. */}
      {p.stalled && (
        <Alert $tone="warning" style={{ marginTop: 16 }} data-testid="manage-stalled">
          <b>{t('op.manage.stalled.title', { minutes: p.stalled.waited_minutes, counted: p.stalled.counted, quorum: p.stalled.quorum })}</b>
          <div style={{ marginTop: 6 }}>{p.stalled.reason}</div>
          {p.stalled.verifiers.length > 0 && (
            <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
              {p.stalled.verifiers.map((v) => (
                <li key={v.endpoint}>
                  {t('op.manage.stalled.verifier', {
                    who: v.name ?? v.endpoint,
                    model: v.model ?? t('op.manage.stalled.no_model'),
                    state: t(`op.manage.stalled.att.${v.attested}`),
                  })}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
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
            {/* Finding 32: no publish is one click any more — the sheet lists what becomes permanent first. */}
            <Button variant="contained" disabled={!p.has_body || !a.benchmark.schema} loading={announceState.isLoading} loadingText={t('op.manage.announcing')}
              data-testid="announce"
              onClick={() => { setRetireText(''); setPublishOpen(true); }}>{t('op.manage.announce')}</Button>
            <Muted title={t('op.tech.announce')}>{t('op.manage.announce.note')}</Muted>
          </SaveRow>
        </SectionBody>
      )}
      {!isDraft && (
        <SectionBody>
          {/* Finding 33: both buttons ran without saying what they spend. What each costs is beside it now. */}
          {canVerify && (
            <Stack $gap={8} style={{ maxWidth: '72ch' }}>
              <Row $gap={12}>
                <Button loading={verifyState.isLoading} loadingText={t('op.manage.verifying')} onClick={doVerify} data-testid="verify-now">{t('op.manage.verify_now')}</Button>
                {verifyState.isLoading && verifyStart !== null && (
                  <Muted data-testid="verify-elapsed">{t('op.manage.verify.elapsed', { elapsed: elapsed(Date.now() - verifyStart) })}</Muted>
                )}
              </Row>
              <Muted data-testid="verify-cost">{canExecute ? t('op.manage.verify.cost.run', { n: sampleCount }) : t('op.manage.verify.cost.hash')}</Muted>
            </Stack>
          )}
          <Row $gap={12}>
            {alreadyAttested && <Muted>{t('op.manage.already')}</Muted>}
            {isMine && !alreadyAttested && <Muted data-testid="self-verify-note">{t('op.manage.self_verify')}</Muted>}
          </Row>
          <Stack $gap={8} style={{ marginTop: 16, maxWidth: 560 }}>
            <TextField label={t('op.manage.challenge')} placeholder={t('op.manage.challenge.ph')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <Muted data-testid="challenge-cost">{t('op.manage.challenge.cost')}</Muted>
            <div><Button color="secondary" size="small" disabled={!reason.trim()} loading={challengeState.isLoading} onClick={() => run(() => challenge({ id: a.id, reason }).unwrap(), t('op.manage.challenge.ok'))}>{t('op.manage.challenge.button')}</Button></div>
          </Stack>
        </SectionBody>
      )}

      {/* Item 150 + finding 32 — every publish crosses this sheet: what becomes permanent, and (when there is one)
          what it retires. The typed id is asked for only when the publish also takes somebody's purchase off sale. */}
      {publishOpen && (
        <Sheet title={t('op.manage.publish.title', { name: a.name || a.id })} sub={t('op.manage.publish.sub')} onClose={() => setPublishOpen(false)} width={680} testId="publish-sheet">
          <strong style={{ fontSize: 14 }}>{t('op.manage.publish.sealed.title')}</strong>
          <KeyValue data-testid="publish-facts">
            <dt>{t('op.manage.publish.f.id')}</dt><dd><Mono>{a.id}</Mono></dd>
            <dt>{t('op.manage.publish.f.name')}</dt><dd>{a.name || a.id}</dd>
            <dt>{t('op.manage.publish.f.price')}</dt><dd title={money.note(a.currency)}>{money.fmt(a.price, a.currency)} · {billingLabel(a.billing)}</dd>
            <dt>{t('op.manage.publish.f.license')}</dt><dd>{a.license || <Muted>{t('op.manage.publish.f.license.none')}</Muted>}</dd>
            <dt>{t('op.manage.publish.f.bench')}</dt><dd>{t('op.manage.publish.f.bench.value', { schema: a.benchmark.schema, queries: num(a.benchmark.queries), samples: a.benchmark.samples?.length ?? 0 })}</dd>
            <dt>{t('op.manage.publish.f.file')}</dt><dd><Mono>{shortHash(a.patch_sha256, 24)}</Mono></dd>
            <dt>{t('op.manage.publish.f.payee')}</dt><dd><Mono title={a.author}>{shortAddr(a.author, 8)}</Mono></dd>
          </KeyValue>
          <Consequences>
            <li>{t('op.manage.publish.why.sealed')}</li>
            <li>{t('op.manage.publish.why.record')}</li>
            <li>{t('op.manage.publish.why.verify')}</li>
            <li>{t('op.manage.publish.why.file')}</li>
          </Consequences>

          {retires.length > 0 && (<>
            <strong style={{ fontSize: 14, marginTop: 8 }}>{t('op.manage.retire.title')}</strong>
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
          </>)}

          {error && <Alert $tone="error" role="alert">{error}</Alert>}
          <SheetFooter>
            <Button variant="text" color="default" onClick={() => setPublishOpen(false)}>{retires.length > 0 ? t('op.manage.retire.cancel') : t('op.manage.publish.cancel')}</Button>
            <Button variant="contained" color={retires.length > 0 ? 'secondary' : 'primary'}
              disabled={retires.length > 0 && retireText.trim() !== a.id}
              loading={announceState.isLoading} loadingText={t('op.manage.announcing')}
              data-testid="publish-confirm"
              onClick={() => run(async () => { await announce(a.id).unwrap(); setPublishOpen(false); }, t('op.manage.announced'))}>
              {retires.length > 0 ? t('op.manage.retire.confirm') : t('op.manage.publish.confirm')}
            </Button>
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
        <Button disabled={!runtime.data?.available || !p.has_body || p.applied} loading={chain.busy} loadingText={t('op.manage.runtime.loading')} onClick={() => { setError(null); setNotice(null); void chain.load(a.id); }}>{term('apply')}</Button>
        <Button color="secondary" disabled={!runtime.data?.available || !p.applied} loading={chain.busy} loadingText={t('op.manage.runtime.unloading')} onClick={() => { setError(null); setNotice(null); void chain.unload(a.id); }}>{term('remove')}</Button>
        <Muted>
          {p.applied ? t('op.manage.runtime.is_loaded') : t('op.manage.runtime.not_loaded')}
          {runtime.data && !runtime.data.available ? ` · ${t('op.runtime.unavailable', { error: runtime.data.error ?? t('op.runtime.noapi') })}` : runtime.data?.model ? ` · ${runtime.data.model}` : ''}
        </Muted>
        <StyledLink to={`/chat/${encodeURIComponent(a.id)}`} title={help('liveTest')}>{t('op.manage.runtime.try')} →</StyledLink>
      </SaveRow>
      {chain.notice && <Alert $tone="success" style={{ marginTop: 12 }} data-testid="apply-order">{chain.notice}</Alert>}
      {chain.error && <Alert $tone="error" style={{ marginTop: 12 }} data-testid="apply-error">{chain.error}</Alert>}
      {chain.dialog}

      {/* ------------------------------------------------------------ markdown snippet */}
      <SubTitle $mt={56}>{t('op.manage.badge.title')}</SubTitle>
      {/* Finding 167: the section used to render for drafts and rejected items too, under copy that promised
          "…so people and AI agents can buy it" about an address nobody could buy from yet. */}
      {p.status !== 'LISTED' ? (
        <SectionBody>
          <Description data-testid="badge-notyet">{t('op.manage.badge.notyet', { status: t(`status.${p.status}`) === `status.${p.status}` ? p.status : t(`status.${p.status}`) })}</Description>
        </SectionBody>
      ) : (
        <SectionBody>
          <Row $gap={12} style={{ marginBottom: 12 }}>
            <Muted>{t('op.manage.badge.preview')}</Muted>
            <img src="/static/images/badge-knowledge.svg" width={134} height={20} alt={t('op.manage.badge.alt', { name: a.name || a.id })} data-testid="badge-preview" />
          </Row>
          <Snippet readOnly value={snippet} />
          <Description style={{ marginTop: 8 }}>{t('op.manage.badge.desc')}</Description>
          <div style={{ marginTop: 12 }}><CopyButton text={snippet} label={t('common.copy')} /></div>

          <DevBox title={t('op.manage.badge.agents.title')} style={{ marginTop: 24 }}>
            <Muted style={{ display: 'block', marginBottom: 8 }}>{t('op.manage.badge.agents.desc')}</Muted>
            <MonoBox>{gateway}</MonoBox>
            <div style={{ marginTop: 12 }}><CopyButton text={gateway} label={t('common.copy')} /></div>
          </DevBox>
        </SectionBody>
      )}

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
      ) : (
        <>
          <DeleteDesc>{t('op.manage.delete.desc')}</DeleteDesc>
          <Button color="secondary" onClick={() => setConfirmMode(true)} data-testid="delete-draft">{t('op.manage.delete.button')}</Button>
          {/* Finding 32 (other half): a local, unpublished, unpaid draft demanded its full id typed out — more
              friction than the permanent, public, paid publish above it. A plain confirmation is the right weight. */}
          {confirmMode && (
            <Sheet title={t('op.manage.delete.sheet.title', { name: a.name || a.id })} onClose={() => setConfirmMode(false)} width={520} testId="delete-sheet">
              <Consequences>
                <li>{t('op.manage.delete.why.local')}</li>
                <li>{t('op.manage.delete.why.file')}</li>
                <li>{t('op.manage.delete.why.free')}</li>
              </Consequences>
              {error && <Alert $tone="error" role="alert">{error}</Alert>}
              <SheetFooter>
                <Button variant="text" color="default" onClick={() => setConfirmMode(false)}>{t('op.manage.delete.cancel')}</Button>
                <Button variant="contained" color="secondary" loading={delState.isLoading} loadingText={t('op.manage.delete.deleting')}
                  data-testid="delete-confirm"
                  onClick={() => run(async () => { await del(a.id).unwrap(); navigate('/dashboard'); })}>{t('op.manage.delete.confirm')}</Button>
              </SheetFooter>
            </Sheet>
          )}
        </>
      )}
      <MonoBox style={{ marginTop: 40 }}>
        <Link to={`/project/${a.author}/${a.id}/logs`} style={{ color: '#8b3eeb', textDecoration: 'none' }}>{t('op.manage.logs_link', { id: a.id })}</Link>
      </MonoBox>
    </PageWrapper>
  );
}
