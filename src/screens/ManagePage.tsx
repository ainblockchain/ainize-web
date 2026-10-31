import { ManagePublication } from '@/components/operator/ManagePublication';
import { AttestationCount } from '@/components/detail/AttestationCount';
import { challengeAvailability, requestManagedChallenge, ManageChallengeError, CHALLENGE_REASON_MIN } from '@/lib/manageChallenge';
import { changeManagedPrice, retireManagedKnowledge, deleteManagedDraft, ManageLifecycleError } from '@/lib/manageLifecycle';
import type { PatchDetail } from '@/api/types';
import { ManageDraftConflict } from '@/components/operator/ManageDraftConflict';
import { manageDraftEditor, receiveManageDraft, draftDirty, draftConflicts, resolveDraftGroup, saveManageDraft, ManageDraftError, type ManageDraftEditor, type ManageDraftValues, type DraftGroup } from '@/lib/manageDraft';
import { useActiveView } from '@/hooks/useActiveView';
import { managedKnowledge, managementMatchesAuthor, runManagedAction, ManagementSelectionError } from '@/lib/manageKnowledge';
import { knowledgePath, knowledgeLookupPath, isKnowledgeAuthor } from '@/lib/detailRoutes';
import { accountPeers, accountRuntime, createNodeActionTask } from '@/lib/accountNodeActions';
import { paidSales, dashboardInventory } from '@/lib/dashboardView';
import { benchmarkQuestionCount } from '@/lib/benchmarkQuestions';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import {
  errorMessage, useManagedCatalogQuery, useChallengeMutation, useDeletePatchMutation, useNodesQuery, useManagedPatchQuery, useMeQuery,
  useRetireMutation, useRuntimeQuery, useSetPriceMutation, useUpdatePatchMutation, useVerifyMutation,
} from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, Select, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, KeyValue, Mono, PageWrapper, StatusChip, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { SubText, Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { CheckItem, Checklist, DevBox, ExternalAnchor, ExternalRow, ExternalTitle, MonoBox, Muted, Row, SectionBody, SmallSpinner, Stack, Tip, QueryError, isInFlight, useMoney } from '@/components/operator/common';
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
/** Finding 32: the consequences of a permanent act, in the same shape the subscribe sheet already uses for its own. */
const Consequences = styled.ul`
  margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK};
`;

/** One node that holds a knowledge's file, and the reason the public record gives for it (item 367). */
interface Holder { address: string; name: string | null; why: 'author' | 'buyer' | 'verifier' | 'mirror'; last_seen: number; self: boolean }

export default function ManagePage() {
  const auth = useAuth();
  const { author = '', patchId = '' } = useParams();
  const { t } = useT();
  if (auth.loading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!auth.isOwner) return <PageWrapper><Description>{t('op.manage.owner_required')} <StyledLink to={knowledgePath(author, patchId)}>{t('op.manage.viewpage')}</StyledLink></Description></PageWrapper>;
  return <ManageView key={JSON.stringify([auth.cacheIdentity, author, patchId])} />;
}

function ManageView() {
  const { t, term, help, tech } = useT();
  const money = useMoney();
  const { author = '', patchId = '' } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const meQuery = useMeQuery();
  const { roles, address, cacheIdentity } = auth;
  const active = useActiveView();
  const current = () => active() && auth.isCurrentAccount();
  const [task] = useState(createNodeActionTask);
  const [busy, setBusy] = useState(false);
  useEffect(() => () => task.abandon(), [task]);
  const [poll, setPoll] = useState(false);
  const patch = useManagedPatchQuery({ id: patchId, identity: cacheIdentity }, { pollingInterval: poll ? 5000 : 0 });
  const p = !patch.isError ? managedKnowledge(patch.currentData, patchId) : null;
  const inFlight = !!p && isInFlight(p.status);
  useEffect(() => { setPoll(inFlight); }, [inFlight]);
  const runtime = useRuntimeQuery({ identity: cacheIdentity });
  const runtimeData = !runtime.isError ? accountRuntime(runtime.currentData) : null;
  // The retired items are knowledge this node already knows: their names, sales and revenue are on the catalogue.
  const catalog = useManagedCatalogQuery({ identity: cacheIdentity });
  const catalogItems = !catalog.isError ? dashboardInventory(catalog.currentData) : null;
  useTitle(p ? p.anchor.name || p.anchor.id : undefined);

  const [update, updateState] = useUpdatePatchMutation();
  const [verify, verifyState] = useVerifyMutation();
  const [challenge, challengeState] = useChallengeMutation();
  /**
   * SC-15 — an add-on is loaded with what it was trained on top of, and unloading something with a knowledge on top
   * of it says which one. The bare apply this page used to send answered `needs_base` with a code and no way out.
   */
  const chain = useLoadChain((id) => catalogItems?.find((e) => e.anchor.id === id)?.anchor.name || id, {
    onLoaded: () => { if (current()) setNotice(t('op.manage.runtime.loaded_ok')); },
    onUnloaded: () => { if (current()) setNotice(t('op.manage.runtime.unloaded_ok')); },
  });
  const [del, delState] = useDeletePatchMutation();
  const [retire, retireState] = useRetireMutation();
  /** Item 278: a published price was permanent — the only re-pricing was republishing, which supersedes your own item. */
  const [setPrice, setPriceState] = useSetPriceMutation();
  const [newPrice, setNewPrice] = useState('');
  const [priceReason, setPriceReason] = useState('');

  const [editor, setEditor] = useState<ManageDraftEditor | null>(() => p ? manageDraftEditor(p.anchor) : null);
  const form = editor ?? (p ? manageDraftEditor(p.anchor) : null);
  const dirty = !!form && draftDirty(form);
  const [draftFeedback, setDraftFeedback] = useState<{ group: DraftGroup; message: string; tone: 'success' | 'error' } | null>(null);
  const edit = (values: Partial<ManageDraftValues>) => {
    if (!form || task.pending() || !current()) return;
    setEditor({ ...form, draft: { ...form.draft, ...values } }); setError(null); setNotice(null); setDraftFeedback(null);
  };
  const [reason, setReason] = useState('');
  const [challengeFeedback, setChallengeFeedback] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [challengeNow, setChallengeNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setChallengeNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const challengeReady = p ? challengeAvailability(p, address, challengeNow) : { kind: 'read' as const };
  const [confirmMode, setConfirmMode] = useState<PatchDetail | null>(null);
  /**
   * Item 150 + finding 32: publishing is the permanent, public, paid act, and it used to be one unguarded click
   * whenever it happened to retire nothing. Every publish crosses this sheet now; the typed id below is kept only
   * for the publish that ALSO retires knowledge somebody is buying right now.
   */
  const [publishOpen, setPublishOpen] = useState<PatchDetail | null>(null);
  /** Finding 33: "Verifying…" with no sense of how long it has been holding this node's model. */
  const [verifyStart, setVerifyStart] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (verifyStart === null) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [verifyStart]);
  /** Item 148: the author's own takedown of a PUBLISHED knowledge — the exit `patch forget` was mistaken for. */
  const [downMode, setDownMode] = useState<PatchDetail | null>(null);
  const [downText, setDownText] = useState('');
  const [downReason, setDownReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lifecycleFeedback, setLifecycleFeedback] = useState<{ section: 'price' | 'retire'; message: string; tone: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (p && !busy && !patch.isFetching) setEditor(previous => receiveManageDraft(previous, p.anchor));
  }, [p, busy, patch.isFetching]);

  /**
   * Item 367 — replication is this product's answer to a seller going offline and its biggest leak at the same
   * time, and the seller could see neither side of it: the holder set exists in every manifest and on no screen.
   * `/api/nodes` already reports what each peer holds by sha256, and this page knows who bought and who verified,
   * so every holder can be named with the reason it has the file. A node holding it for no recorded reason is
   * called what it is — a mirror — rather than being left out.
   */
  const nodesQ = useNodesQuery({ identity: cacheIdentity }, { pollingInterval: 30_000 });
  const nodeData = !nodesQ.isError ? accountPeers(nodesQ.currentData) : null;
  const holders = useMemo(() => {
    const sha = p?.anchor.patch_sha256;
    if (!sha) return [] as Holder[];
    const buyers = new Set((p?.settlements ?? []).map((x) => x.buyer.toLowerCase()));
    const verifiers = new Set((p?.attestations ?? []).map((x) => x.verifier.toLowerCase()));
    const author = (p?.anchor.author ?? '').toLowerCase();
    const seen = new Map<string, Holder>();
    const add = (address: string, name: string | null, last_seen: number, blobs: string[]) => {
      if (!address || !blobs.includes(sha)) return;
      const low = address.toLowerCase();
      if (seen.has(low)) return;
      const why: Holder['why'] = low === author ? 'author' : buyers.has(low) ? 'buyer' : verifiers.has(low) ? 'verifier' : 'mirror';
      seen.set(low, { address, name, why, last_seen, self: !!nodeData && low === nodeData.self.toLowerCase() });
    };
    for (const n of nodeData?.nodes ?? []) add(n.address, n.name ?? null, n.last_seen, n.blobs ?? []);
    for (const pr of nodeData?.peers ?? []) add(pr.address ?? '', pr.info?.name ?? null, pr.last_seen, pr.info?.blobs ?? []);
    return [...seen.values()].sort((a, b) => (a.self === b.self ? 0 : a.self ? -1 : 1) || a.why.localeCompare(b.why));
  }, [p?.anchor.patch_sha256, p?.anchor.author, p?.settlements, p?.attestations, nodeData]);

  const isDraft = p?.status === 'DRAFT';
  const isVerifier = roles.includes('verifier');
  const alreadyAttested = !!p && !!address && p.attestations.some((a) => a.verifier.toLowerCase() === address.toLowerCase());
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
    return `[![${alt}](${window.location.origin}/static/images/badge-knowledge.svg)](${window.location.origin}/${encodeURIComponent(p.anchor.author)}/${encodeURIComponent(p.anchor.id)})`;
  }, [p, t]);

  const run = async (fn: (stillCurrent: () => boolean) => Promise<unknown>, ok?: string, onError?: (message: string) => void) => {
    if (task.pending() || chain.busy || !current()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const finished = await task.run(current, async stillCurrent => {
        return runManagedAction(patchId, author, { current: stillCurrent, read: () => patch.refetch().unwrap(), action: fn });
      });
      if (finished && current() && ok) setNotice(ok);
    } catch (err) {
      if (current()) {
        const message = err instanceof ManageChallengeError ? t(`op.manage.challenge.error.${err.code}`) : err instanceof ManageLifecycleError ? t(`op.manage.lifecycle.${err.code}`) : err instanceof ManageDraftError ? t(err.code === 'benchmark' ? `op.benchmark.issue.${err.benchmarkIssue}` : `op.manage.draft.error.${err.code}`) : err instanceof ManagementSelectionError ? t('op.manage.selection_changed') : errorMessage(err);
        if (onError) onError(message); else setError(message);
      }
    }
    finally { if (current()) setBusy(false); }
  };

  if (patch.isFetching && !patch.currentData) return <PageWrapper><CenterProgress /></PageWrapper>;
  const failedAction = error || (draftFeedback?.tone === 'error' ? draftFeedback.message : null) || (lifecycleFeedback?.tone === 'error' ? lifecycleFeedback.message : null) || (challengeFeedback?.tone === 'error' ? challengeFeedback.message : null);
  const missing = patch.isError && patch.error && 'status' in patch.error && patch.error.status === 404;
  if (missing && busy) return <PageWrapper><CenterProgress /><Description role="status">{t('op.manage.lifecycle.checking')}</Description></PageWrapper>;
  if (missing || p && !managementMatchesAuthor(p, author)) return <PageWrapper>{busy && <CenterProgress />}{failedAction && <Alert role="alert" $tone="error">{failedAction}</Alert>}<Title>{t('op.manage.notfound')}</Title><Description>{t(missing ? 'op.manage.notfound.desc' : 'op.manage.route_mismatch')} <StyledLink to="/dashboard">{t('op.manage.back')}</StyledLink></Description></PageWrapper>;
  if (!p || !form) return <PageWrapper>{failedAction && <Alert role="alert" $tone="error">{failedAction}</Alert>}<QueryError error={patch.error} what={t('op.knowledge')} onRetry={() => void patch.refetch()} retrying={patch.isFetching} /></PageWrapper>;
  if (!p.owned) {
    return (
      <PageWrapper>
        <Title>{p.anchor.name || p.anchor.id}</Title>
        <Description>{t('op.manage.notowned', { owner: p.anchor.author_name ?? shortAddr(p.anchor.author) })} <StyledLink to={knowledgePath(author, patchId)}>{t('op.manage.viewpage')}</StyledLink>.</Description>
      </PageWrapper>
    );
  }

  const a = p.anchor;
  const patchPage = `${window.location.origin}${knowledgePath(a.author, a.id)}`;
  const gateway = p.gateway_url ?? `${window.location.origin}/x402/patch/${encodeURIComponent(a.id)}`;
  const byId = new Map((catalogItems ?? []).map((e) => [e.anchor.id, e]));
  const billingLabel = (b: string) => { const k = `op.billing.${b}`; const v = t(k); return v === k ? b : v; };

  /**
   * Finding 33 — what "Verify now" really spends. The stake it was accused of hiding no longer exists: the node
   * ignores `verifier.stake` and says so in its own log (server.ts), nothing is escrowed, transferred or slashed.
   * What IS spent is this node's model for minutes, and its signature on a permanent public record. And when the
   * run cannot execute — no matching model server, or no sample questions — it degrades to an integrity check that
   * does not count toward a quorum, which the operator has to know BEFORE clicking, not from the results table.
   * The three conditions below are exactly the ones verifier.ts:51 uses to choose between the two.
   */
  const sampleCount = a.benchmark.samples?.length ?? 0;
  const canExecute = !!runtimeData?.available && !!runtimeData.model && a.model.id_M.startsWith(runtimeData.model) && sampleCount > 0;
  const elapsed = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const doVerify = () => {
    if (task.pending() || !current()) return;
    setVerifyStart(Date.now());
    void run(() => verify(a.id).unwrap(), t('op.manage.verified_ok')).finally(() => { if (current()) setVerifyStart(null); });
  };

  const doChallenge = () => {
    if (busy || task.pending() || !current() || challengeReady.kind !== 'ready' || reason.trim().length < CHALLENGE_REASON_MIN) return;
    setChallengeFeedback(null);
    void run(async stillCurrent => {
      const result = await requestManagedChallenge(p, address, auth.subject, reason, {
        current: stillCurrent, read: () => patch.refetch().unwrap(), readAccess: () => meQuery.refetch().unwrap(),
        write: text => challenge({ id: a.id, reason: text }).unwrap(),
      });
      if (result && stillCurrent()) { setReason(''); setChallengeFeedback({ tone: 'success', message: t('op.manage.challenge.ok') }); }
    }, undefined, message => setChallengeFeedback({ tone: 'error', message }));
  };

  const saveDraft = (group: DraftGroup) => {
    if (task.pending() || !current() || !draftDirty(form, group) || draftConflicts(form, a, group).length || !isDraft) return;
    setDraftFeedback(null);
    void run(async stillCurrent => {
      const result = await saveManageDraft(form, group, a.id, author, { current: stillCurrent, read: () => patch.refetch().unwrap(), write: patch => update({ id: a.id, patch }).unwrap() });
      if (result && stillCurrent()) {
        setEditor(resolveDraftGroup(form, result.detail.anchor, group, false));
        setDraftFeedback({ group, tone: 'success', message: t(group === 'fields' ? 'op.saved' : 'op.manage.bench.saved') });
      }
    }, undefined, message => setDraftFeedback({ group, tone: 'error', message }));
  };
  const resolve = (group: DraftGroup, keep: boolean) => { setEditor(resolveDraftGroup(form, a, group, keep)); setError(null); setNotice(null); setDraftFeedback(null); };
  const values = form.draft;

  return (
    <PageWrapper>
      <fieldset disabled={busy || chain.busy} aria-busy={busy || chain.busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <ProjectName>{a.name || a.id}</ProjectName>
      <Row $gap={10} style={{ marginTop: 8 }}><StatusChip status={p.status} /><Muted><Mono>{a.id}</Mono></Muted></Row>
      {/* Finding 167: the row that carries the real shareable link was plain text, while the only CopyButton on the
          page sat on the broken snippet. It is the one URL a publisher pastes anywhere, so it is copyable. */}
      <ExternalRow>
        <ExternalTitle>{t('op.manage.page')}</ExternalTitle>
        <ExternalAnchor href={patchPage} $disabled={isDraft}>{patchPage}</ExternalAnchor>
        {!isDraft && <CopyButton text={patchPage} label={t('common.copy')} />}
      </ExternalRow>
      <ExternalRow><ExternalTitle><Tip tech={`${t('op.term.gateway.help')} · ${tech('autoPay')}`}>{t('op.manage.gateway')}</Tip></ExternalTitle><ExternalAnchor href={gateway} target="_blank" rel="noopener noreferrer" $disabled={p.status !== 'VERIFIED'}>{gateway}</ExternalAnchor></ExternalRow>
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
          ? t('op.manage.file.present', { size: bytes(a.size_bytes), rows: t('units.rows', { n: num(a.rows) }), facts: t('units.facts', { n: num(benchmarkQuestionCount(a.benchmark.queries)) }) })
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
          </Checklist>
          <SaveRow>
            {/* Finding 32: no publish is one click any more — the sheet lists what becomes permanent first. */}
            <Button variant="contained" disabled={dirty || !p.has_body || !a.benchmark.schema}
              data-testid="announce"
              onClick={() => { setError(null); setPublishOpen(p); }}>{t('op.manage.announce')}</Button>
            {dirty && <Muted role="status">{t('op.manage.draft.before_publish')}</Muted>}
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
            <TextField label={t('op.manage.challenge')} placeholder={t('op.manage.challenge.ph')} value={reason} onChange={(e) => { setReason(e.target.value); setChallengeFeedback(null); }} disabled={busy} aria-describedby="challenge-rule" data-testid="challenge-reason" />
            <Muted id="challenge-rule">{t('op.manage.challenge.minimum', { n: reason.trim().length, min: CHALLENGE_REASON_MIN })}</Muted>
            <Muted data-testid="challenge-cost">{t('op.manage.challenge.cost')}</Muted>
            {challengeReady.kind !== 'ready' && <Muted role="status" data-testid="challenge-unavailable">{challengeReady.kind === 'cooldown' ? t('op.manage.challenge.until', { when: dateTime(challengeReady.until!) }) : t(`op.manage.challenge.error.${challengeReady.kind}`)}</Muted>}
            {(challengeReady.kind === 'read' || challengeFeedback?.tone === 'error') && <Button variant="text" size="small" disabled={busy || patch.isFetching} onClick={() => void patch.refetch()}>{t('op.manage.challenge.refresh')}</Button>}
            <div><Button color="secondary" size="small" disabled={busy || patch.isFetching || challengeReady.kind !== 'ready' || reason.trim().length < CHALLENGE_REASON_MIN} loading={challengeState.isLoading} onClick={doChallenge} data-testid="challenge-submit">{t('op.manage.challenge.button')}</Button></div>
            {challengeFeedback && <Alert role={challengeFeedback.tone === 'error' ? 'alert' : 'status'} $tone={challengeFeedback.tone}>{challengeFeedback.message}</Alert>}
          </Stack>
        </SectionBody>
      )}

      {publishOpen && <ManagePublication expected={publishOpen} busy={busy} run={run} readDetail={() => patch.refetch().unwrap()} onClose={() => setPublishOpen(null)} onPublished={() => { setPublishOpen(null); setNotice(t('op.manage.announced')); }} />}

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
                <TableData>{at.restarts_detected ?? '—'}</TableData>
                <TableData title={help('signedResult')}><AttestationCount entry={p} attestation={at} /></TableData>
                <TableData>{at.created_at ? dateTime(at.created_at) : '—'}</TableData>
              </TableRow>
            ))}
            {p.attestations.length === 0 && <TableRowEmpty $height={80}><td colSpan={7}>{t('op.manage.attest.empty')}</td></TableRowEmpty>}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ------------------------------------------------------------ who holds the file (item 367) */}
      <SubTitle $mt={40}>{t('op.manage.holders.title')}</SubTitle>
      <Description>{t('op.manage.holders.desc')}</Description>
      {nodesQ.isFetching && !nodesQ.currentData ? <CenterProgress /> : !nodeData ? <QueryError error={nodesQ.error} what={t('op.manage.holders.title')} onRetry={() => void nodesQ.refetch()} retrying={nodesQ.isFetching} /> : holders.length === 0 ? (
        <Description data-testid="holders-empty" style={{ marginTop: 8 }}>{t('op.manage.holders.empty')}</Description>
      ) : (
        <>
          <Description style={{ marginTop: 8 }} data-testid="holders-summary">
            <b>{t('op.manage.holders.count', { n: holders.length })}</b>{' — '}
            {t('op.manage.holders.split', {
              buyers: holders.filter((h) => h.why === 'buyer').length,
              verifiers: holders.filter((h) => h.why === 'verifier').length,
              mirrors: holders.filter((h) => h.why === 'mirror').length,
              authors: holders.filter((h) => h.why === 'author').length,
            })}
          </Description>
          <TableWrapper style={{ marginTop: 12 }}>
            <Table>
              <TableHeader><TableRow>
                <TableHead $align="left" $padding="0 8px">{t('op.manage.holders.node')}</TableHead>
                <TableHead $align="left">{t('op.manage.holders.why')}</TableHead>
                <TableHead $align="right" $padding="0 8px">{t('op.when')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {holders.map((h) => (
                  <TableRow key={h.address}>
                    <TableData $align="left" $padding="0 8px" title={h.address}>{h.name ?? shortAddr(h.address)}{h.self && <SubText>{t('op.manage.holders.self')}</SubText>}</TableData>
                    <TableData $align="left">{t(`op.manage.holders.why.${h.why}`)}</TableData>
                    <TableData $align="right" $padding="0 8px">{h.last_seen ? dateTime(h.last_seen) : '—'}</TableData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </>
      )}

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
                    <StyledLink to={c.author && isKnowledgeAuthor(c.author) ? knowledgePath(c.author, c.patch_id) : other ? knowledgePath(other.anchor.author, c.patch_id) : knowledgeLookupPath(c.patch_id)}>{c.patch_id}</StyledLink>
                    {copy && <Muted style={{ display: 'block' }} data-testid="conflict-copy">{t('op.manage.conflict.copy')}</Muted>}
                  </TableData>
                  <TableData>{c.same_author === false
                    ? (c.author_name || shortAddr(c.author ?? other?.anchor.author ?? '', 6))
                    : <Muted>{t('op.manage.conflict.mine')}</Muted>}</TableData>
                  <TableData>{t('units.rows', { n: num(c.overlap_rows) })}</TableData>
                  <TableData $color={c.lineage ? '#1e6b36' : c.same_schema ? '#e6173e' : '#8d8d8f'}>
                    {c.lineage ? t(c.lineage === 'parent' ? 'op.manage.conflict.base' : 'op.manage.conflict.addon') : c.same_schema ? t('op.yes') : t('op.no')}
                  </TableData>
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
      {!isDraft && <Description>{t(dirty ? 'op.manage.draft.sealed_with_edits' : 'op.manage.fields.sealed')}</Description>}
      {isDraft && <ManageDraftConflict editor={form} anchor={a} group="fields" onResolve={keep => resolve('fields', keep)} />}
      <SectionBody>
        <Stack $gap={18}>
          <TextField label={t('op.manage.fields.desc')} value={values.description} onChange={(e) => edit({ description: e.target.value })} readOnly={!isDraft} />
          <FormRow>
            <TextField label={t('op.manage.fields.price', { unit: money.unit(a.currency) })} helper={money.note(a.currency)} type="number" min={0} step="0.000001" value={values.price} onChange={(e) => edit({ price: e.target.value })} readOnly={!isDraft} />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <FieldLabel>{t('op.manage.fields.billing')}</FieldLabel>
              {/* Item 360: "pay per hour loaded" and "pay per use" were offered here and metered nowhere — a sale
                  settles the price once, per download. An anchor that already carries one keeps it (the record is
                  immutable) and is shown as it is; nothing new can be published under a model nobody charges. */}
              <Select value={values.billing} onChange={(e) => edit({ billing: e.target.value })} disabled={!isDraft} data-testid="billing-select">
                {[...new Set(['per_download', ...(values.billing === 'per_download' ? [] : [values.billing])])].map((b) => <option key={b} value={b} disabled={b !== 'per_download'}>{billingLabel(b)}</option>)}
              </Select>
              <Muted style={{ fontSize: 12 }}>{t('op.manage.billing.only')}</Muted>
            </label>
            <TextField label={t('op.manage.fields.branch')} placeholder="law/KR" value={values.branch} onChange={(e) => edit({ branch: e.target.value })} readOnly={!isDraft} />
            <TextField label={t('op.manage.fields.license')} placeholder="CC-BY-4.0" value={values.license} onChange={(e) => edit({ license: e.target.value })} readOnly={!isDraft} />
          </FormRow>
        </Stack>
        {isDraft && <SaveRow><Button disabled={!draftDirty(form, 'fields') || draftConflicts(form, a, 'fields').length > 0} loading={updateState.isLoading} loadingText={t('op.saving')} onClick={() => saveDraft('fields')}>{t('common.save')}</Button><Button variant="text" disabled={!draftDirty(form, 'fields')} onClick={() => resolve('fields', false)}>{t('op.manage.draft.use_server')}</Button><Muted>{t('op.manage.fields.current', { price: money.fmt(a.price, a.currency) })}</Muted></SaveRow>}
      </SectionBody>

      {draftFeedback?.group === 'fields' && <Alert role={draftFeedback.tone === 'error' ? 'alert' : 'status'} $tone={draftFeedback.tone} style={{ marginTop: 12 }}>{draftFeedback.message}</Alert>}

      {/* ------------------------------------------------------------ benchmark */}
      <SubTitle $mt={56}><Tip tech={tech('facts')}>{t('op.manage.bench.title')}</Tip></SubTitle>
      <Description>{t('op.manage.bench.desc')}</Description>
      {isDraft && <ManageDraftConflict editor={form} anchor={a} group="benchmark" onResolve={keep => resolve('benchmark', keep)} />}
      <SectionBody>
        <Textarea aria-label={t('op.manage.bench.title')} value={values.benchmark} onChange={(e) => edit({ benchmark: e.target.value })} readOnly={!isDraft} spellCheck={false} />
        <Row $gap={16} $wrap style={{ marginTop: 8 }}>
          <Muted title="sha256(canonical(benchmark))">{t('op.manage.bench.hash')} <Mono>{shortHash(a.benchmark_hash, 16)}</Mono></Muted>
          {isDraft && <Button size="small" disabled={!draftDirty(form, 'benchmark') || draftConflicts(form, a, 'benchmark').length > 0} loading={updateState.isLoading} onClick={() => saveDraft('benchmark')}>{t('op.manage.bench.save')}</Button>}
          {isDraft && <Button size="small" variant="text" disabled={!draftDirty(form, 'benchmark')} onClick={() => resolve('benchmark', false)}>{t('op.manage.draft.use_server')}</Button>}
        </Row>
      </SectionBody>

      {draftFeedback?.group === 'benchmark' && <Alert role={draftFeedback.tone === 'error' ? 'alert' : 'status'} $tone={draftFeedback.tone} style={{ marginTop: 12 }}>{draftFeedback.message}</Alert>}

      {/* ------------------------------------------------------------ lineage */}
      <SubTitle $mt={56}><Tip tech={tech('lineage')}>{t('op.manage.lineage.title')}</Tip></SubTitle>
      <KeyValue>
        <dt>{t('op.manage.lineage.parents')}</dt><dd>{p.lineage.parents.length ? p.lineage.parents.map((x) => <span key={x.id} style={{ marginRight: 12 }}><StyledLink to={knowledgePath(x.author, x.id)}>{x.name || x.id}</StyledLink> <StatusChip status={x.status} /></span>) : <Muted>{t('op.manage.lineage.root')}</Muted>}</dd>
        {/* Items 195, 318: a child was a name and a chip. What its price is, and what it has actually paid the
            creator of the base, is the whole of what an ancestor needs — and it was on no screen at all. */}
        <dt>{t('op.manage.lineage.children')}</dt><dd data-testid="lineage-children">{p.lineage.children.length ? p.lineage.children.map((x) => (
          <span key={x.id} style={{ marginRight: 12, display: 'inline-block' }}>
            <StyledLink to={knowledgePath(x.author, x.id)}>{x.name || x.id}</StyledLink> <StatusChip status={x.status} />
            {x.price !== undefined && <Muted> · {money.fmt(x.price, x.currency ?? a.currency)}{Number(x.price) < Number(a.price) ? ` (${t('op.manage.lineage.cheaper')})` : ''}</Muted>}
            {x.author_name && x.author !== a.author && <Muted> · {x.author_name}</Muted>}
            {!!x.sales && <Muted> · {t('op.manage.lineage.child_earned', { amount: money.fmt(x.earned ?? '0', a.currency), n: x.sales })}</Muted>}
          </span>
        )) : <Muted>{t('op.none')}</Muted>}</dd>
        {!!p.lineage.earned && <><dt>{t('op.manage.lineage.earned')}</dt><dd data-testid="lineage-earned">{p.lineage.earned.sales
          ? t('op.manage.lineage.earned.value', { amount: money.fmt(p.lineage.earned.amount, p.lineage.earned.currency), n: p.lineage.earned.sales })
          : <Muted>{t('op.manage.lineage.earned.none')}</Muted>}</dd></>}
        <dt>{t('op.manage.lineage.supersedes')}</dt><dd>{p.supersedes.length ? p.supersedes.join(', ') : <Muted>—</Muted>}</dd>
        <dt>{t('op.manage.lineage.superseded_by')}</dt><dd>{p.superseded_by.length ? p.superseded_by.join(', ') : <Muted>—</Muted>}</dd>
      </KeyValue>
      <Muted style={{ display: 'block', marginTop: 8 }} title={help('lineage')}>{t('op.manage.lineage.note')}</Muted>

      {/* ------------------------------------------------------------ runtime */}
      <SubTitle $mt={56}><Tip tech={`${tech('apply')} / ${tech('remove')}`}>{t('op.manage.runtime.title')}</Tip></SubTitle>
      <Description>{t('op.manage.runtime.desc')}</Description>
      {runtime.isFetching && !runtime.currentData ? <CenterProgress /> : !runtimeData && <QueryError error={runtime.error} what={t('op.manage.runtime.title')} onRetry={() => void runtime.refetch()} retrying={runtime.isFetching} />}
      <SaveRow>
        <Button data-testid="manage-load" disabled={!runtimeData?.available || !p.has_body || p.applied} loading={chain.busy} loadingText={t('op.manage.runtime.loading')} onClick={() => { if (task.pending() || !current()) return; setError(null); setNotice(null); void chain.load(a); }}>{term('apply')}</Button>
        <Button data-testid="manage-unload" color="secondary" disabled={!runtimeData?.available || !p.applied} loading={chain.busy} loadingText={t('op.manage.runtime.unloading')} onClick={() => { if (task.pending() || !current()) return; setError(null); setNotice(null); void chain.unload(a); }}>{term('remove')}</Button>
        <Muted>
          {p.applied ? t('op.manage.runtime.is_loaded') : t('op.manage.runtime.not_loaded')}
          {runtimeData && !runtimeData.available ? ` · ${t('op.runtime.unavailable', { error: runtimeData.error ?? t('op.runtime.noapi') })}` : runtimeData?.model ? ` · ${runtimeData.model}` : ''}
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
      {p.status !== 'VERIFIED' ? (
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
      {/*
        * Item 157 — a REJECTED knowledge had no way forward at all: this section kept the heading "Delete draft"
        * over a delete the node refuses, publishing under the same id is refused too ("patch id already exists"),
        * and nothing said what a publisher whose verification failed is supposed to do. The one thing that works is
        * a corrected version declaring this one as its origin, so that is what the page offers — with the failures
        * the verifiers actually reported one click away, above it.
        */}
      {p.status === 'REJECTED' ? (
        <>
          <SubTitle $mt={56}>{t('op.manage.rejected.title')}</SubTitle>
          <Description data-testid="rejected-next">{t('op.manage.rejected.desc')}</Description>
          <Description>{t('op.manage.rejected.id', { id: a.id })}</Description>
          <Row $gap={12} style={{ marginTop: 12 }}>
            <Button variant="contained" data-testid="rejected-republish" onClick={() => navigate(`/new-patch?from=${encodeURIComponent(a.id)}`)}>{t('op.manage.rejected.button')}</Button>
            <StyledLink to={`/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}?tab=verification`}>{t('op.manage.rejected.see')} →</StyledLink>
          </Row>
          <DevBox style={{ marginTop: 24 }}>
            <Muted style={{ display: 'block', marginBottom: 6 }}>{t('op.manage.rejected.cli')}</Muted>
            <MonoBox>{`ainize publish <file>.npz --id ${a.id}-v2 --parents ${a.id} --name "${(a.name || a.id).replace(/"/g, '\\"')}"`}</MonoBox>
          </DevBox>
        </>
      ) : (<>
      {/* Item 278 — the price was fixed for ever at announce: a seller who took the 0.1 default, or who wanted a
          launch discount, or to make an obsolete knowledge free, had no path but republishing (which supersedes
          their own item and restarts verification). A price is a record of its own now. */}
      {!isDraft && (
        <>
          <SubTitle $mt={56}>{t('op.manage.price.title')}</SubTitle>
          {p.status === 'RETIRED' || p.retired_at != null ? <Muted>{t('op.manage.price.retired')}</Muted> : (
            <Stack $gap={12} style={{ maxWidth: 560 }}>
              <Muted>{t('op.manage.price.desc', { price: money.fmt(a.price, a.currency) })}</Muted>
              {(p.price_history?.length ?? 0) > 0 && (
                <Muted data-testid="price-history">{t('op.manage.price.history', {
                  history: [money.fmt(p.list_price ?? a.price, a.currency), ...(p.price_history ?? []).map((h) => money.fmt(h.price, h.currency))].join(' → '),
                })}</Muted>
              )}
              <Row $gap={12} $wrap>
                <TextField label={t('op.manage.price.field', { currency: money.unit(a.currency) })} value={newPrice} onChange={(e) => { setNewPrice(e.target.value); setLifecycleFeedback(null); }} data-testid="price-field" style={{ maxWidth: 220 }} />
                <TextField label={t('op.manage.price.reason')} value={priceReason} maxLength={500} onChange={(e) => { setPriceReason(e.target.value); setLifecycleFeedback(null); }} data-testid="price-reason" />
              </Row>
              <Row>
                <Button color="secondary" data-testid="price-save" disabled={!/^\d+(\.\d+)?$/.test(newPrice.trim()) || newPrice.trim() === a.price}
                  loading={setPriceState.isLoading} loadingText={t('op.manage.price.working')}
                  onClick={() => { setLifecycleFeedback(null); void run(async stillCurrent => {
                    const result = await changeManagedPrice(p, newPrice, priceReason, { current: stillCurrent, read: () => patch.refetch().unwrap(), write: (price, reason) => setPrice({ id: a.id, price, reason }).unwrap() });
                    if (result && stillCurrent()) { setNewPrice(''); setPriceReason(''); setLifecycleFeedback({ section: 'price', tone: 'success', message: t('op.manage.price.done') }); }
                  }, undefined, message => setLifecycleFeedback({ section: 'price', tone: 'error', message })); }}>
                  {t('op.manage.price.button')}
                </Button>
              </Row>
            </Stack>
          )}
        </>
      )}

      {lifecycleFeedback?.section === 'price' && <Alert role={lifecycleFeedback.tone === 'error' ? 'alert' : 'status'} $tone={lifecycleFeedback.tone} style={{ marginTop: 12 }}>{lifecycleFeedback.message}</Alert>}

      <SubTitle $mt={56}>{isDraft ? t('op.manage.delete.title') : t('op.manage.takedown.title')}</SubTitle>
      {!isDraft ? (
        <>
          {p.status === 'RETIRED' || p.retired_at != null ? (
            <DeleteDesc data-testid="retired-note">
              {t('op.manage.takedown.already', { when: p.retired_at ? dateTime(p.retired_at) : '—' })}
              {p.retire_reason ? ` ${t('op.manage.takedown.already.reason', { reason: p.retire_reason })}` : ''}
            </DeleteDesc>
          ) : !downMode ? (
            <>
              <DeleteDesc>{t('op.manage.delete.sealed')} {t('op.manage.takedown.desc')}</DeleteDesc>
              <Button color="secondary" data-testid="takedown" onClick={() => { setDownText(''); setDownReason(''); setDownMode(p); setLifecycleFeedback(null); setError(null); }}>{t('op.manage.takedown.button')}</Button>
            </>
          ) : (
            <Stack $gap={16} style={{ maxWidth: 560 }}>
              <DeleteDesc style={{ margin: 0 }}>{t('op.manage.takedown.desc')}</DeleteDesc>
              {paidSales(p) === null ? <Muted>{t('op.manage.sales_unknown')}</Muted> : paidSales(p)! > 0 && <Muted>{t('op.manage.takedown.sales', { n: paidSales(p)! })}</Muted>}
              <TextField label={t('op.manage.takedown.reason')} placeholder={t('op.manage.takedown.reason.ph')} value={downReason} maxLength={500} onChange={(e) => { setDownReason(e.target.value); setLifecycleFeedback(null); }} data-testid="takedown-reason" />
              <TextField label={t('op.manage.takedown.type', { id: a.id })} value={downText} onChange={(e) => setDownText(e.target.value)} data-testid="takedown-type" />
              <Row $gap={12}>
                <Button variant="contained" color="secondary" disabled={downText.trim() !== a.id} loading={retireState.isLoading} loadingText={t('op.manage.takedown.working')}
                  data-testid="takedown-confirm"
                  onClick={() => { setLifecycleFeedback(null); void run(async stillCurrent => {
                    const result = await retireManagedKnowledge(downMode, downText, downReason, { current: stillCurrent, read: () => patch.refetch().unwrap(), write: reason => retire({ id: downMode.anchor.id, reason }).unwrap() });
                    if (result && stillCurrent()) { setDownMode(null); setLifecycleFeedback({ section: 'retire', tone: 'success', message: t('op.manage.takedown.done') }); }
                  }, undefined, message => setLifecycleFeedback({ section: 'retire', tone: 'error', message })); }}>{t('op.manage.takedown.confirm')}</Button>
                <Button variant="text" color="default" onClick={() => setDownMode(null)}>{t('op.manage.takedown.cancel')}</Button>
              </Row>
            </Stack>
          )}
          {lifecycleFeedback?.section === 'retire' && <Alert role={lifecycleFeedback.tone === 'error' ? 'alert' : 'status'} $tone={lifecycleFeedback.tone} style={{ marginTop: 12 }}>{lifecycleFeedback.message}</Alert>}
          <DevBox style={{ marginTop: 24 }}>
            <Muted style={{ display: 'block', marginBottom: 6 }}>{t('op.manage.dev.forget')}</Muted>
            <MonoBox>ainize patch forget {a.id}</MonoBox>
          </DevBox>
        </>
      ) : (
        <>
          <DeleteDesc>{t('op.manage.delete.desc')}</DeleteDesc>
          <Button color="secondary" onClick={() => { setConfirmMode(p); setError(null); }} data-testid="delete-draft">{t('op.manage.delete.button')}</Button>
          {/* Finding 32 (other half): a local, unpublished, unpaid draft demanded its full id typed out — more
              friction than the permanent, public, paid publish above it. A plain confirmation is the right weight. */}
          {confirmMode && (
            <Sheet title={t('op.manage.delete.sheet.title', { name: confirmMode.anchor.name || confirmMode.anchor.id })} onClose={() => setConfirmMode(null)} width={520} testId="delete-sheet">
              <Mono>{confirmMode.anchor.id}</Mono>
              <Consequences>
                <li>{t('op.manage.delete.why.local')}</li>
                <li>{t('op.manage.delete.why.file')}</li>
                <li>{t('op.manage.delete.why.free')}</li>
              </Consequences>
              {error && <Alert $tone="error" role="alert">{error}</Alert>}
              <SheetFooter>
                <Button variant="text" color="default" onClick={() => setConfirmMode(null)}>{t('op.manage.delete.cancel')}</Button>
                <Button variant="contained" color="secondary" loading={delState.isLoading} loadingText={t('op.manage.delete.deleting')}
                  data-testid="delete-confirm"
                  onClick={() => run(async stillCurrent => {
                    const result = await deleteManagedDraft(confirmMode, auth.subject, { current: stillCurrent, read: () => patch.refetch().unwrap(), write: () => del(confirmMode.anchor.id).unwrap(), readAccess: () => meQuery.refetch().unwrap() });
                    if (result && stillCurrent()) navigate('/dashboard');
                  })}>{t('op.manage.delete.confirm')}</Button>
              </SheetFooter>
            </Sheet>
          )}
        </>
      )}
      </>)}
      <MonoBox style={{ marginTop: 40 }}>
        <Link to={`/project/${encodeURIComponent(a.author)}/${encodeURIComponent(a.id)}/logs`} style={{ color: '#8b3eeb', textDecoration: 'none' }}>{t('op.manage.logs_link', { id: a.id })}</Link>
      </MonoBox>
      </fieldset>
    </PageWrapper>
  );
}
