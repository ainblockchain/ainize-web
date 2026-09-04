import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { api, useCancelTeachJobMutation, useRecheckTeachJobMutation, useTeachJobQuery } from '@/api/api';
import type { TeachJob, TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { StyledLink } from '@/components/ui/Misc';
import { basketFilename } from '@/lib/teachDataset';
import { BuiltOnLines } from '@/components/teach/BuiltOn';
import { ACTIVE, cardStatusKey, etaText, failedKey, isFullJob, mapTeachError } from './teachUtil';

const Card = styled.section<{ $tone: 'busy' | 'ok' | 'warn' | 'bad' | 'muted' }>`
  flex: none; padding: 14px 16px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px;
  border-left: 4px solid ${(p) => (p.$tone === 'ok' ? p.theme.color.SUCCESS : p.$tone === 'warn' ? p.theme.color.WARNING : p.$tone === 'bad' ? p.theme.color.ERROR : p.$tone === 'muted' ? p.theme.color.LIGHT_GREY : p.theme.color.PRIMARY)};
  display: flex; flex-direction: column; gap: 10px; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.DARK_GREY}; min-width: 0;
`;
const Head = styled.div`
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  h3 { margin: 0; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  button.x { margin-left: auto; background: none; border: 0; font-size: 12px; color: ${(p) => p.theme.color.GREY}; cursor: pointer; &:hover { color: ${(p) => p.theme.color.BLACK}; } }
`;
const State = styled.span<{ $tone: string }>`
  display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; white-space: nowrap;
  color: ${(p) => (p.$tone === 'ok' ? '#1e6b36' : p.$tone === 'warn' ? '#8a4b00' : p.$tone === 'bad' ? '#a0102c' : p.$tone === 'muted' ? '#555' : '#5b1ca8')};
  background: ${(p) => (p.$tone === 'ok' ? '#e6f4ea' : p.$tone === 'warn' ? '#fff3e0' : p.$tone === 'bad' ? '#fde8ec' : p.$tone === 'muted' ? '#f2f2f2' : '#f5eefc')};
`;
const Bar = styled.div`height: 6px; border-radius: 3px; background: #eee; overflow: hidden; span { display: block; height: 100%; background: ${(p) => p.theme.color.PRIMARY}; transition: width 0.4s ease; }`;
const Checks = styled.ul`margin: 0; padding: 0 0 0 18px; font-size: 12px; color: ${(p) => p.theme.color.DARK_GREY}; li { margin: 2px 0; }`;
const FactsWrap = styled.div`max-width: 100%; overflow-x: auto;`;
const Facts = styled.table`
  width: 100%; border-collapse: collapse; font-size: 12px;
  th { text-align: left; font-weight: 600; color: ${(p) => p.theme.color.GREY}; padding: 4px 8px 4px 0; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; }
  td { padding: 6px 8px 6px 0; vertical-align: top; border-bottom: 1px solid #f0f0f0; word-break: break-word; max-width: 260px; }
  td.q { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  .ok { color: #1e6b36; font-weight: 700; } .no { color: #a0102c; font-weight: 700; }
  .ans { color: ${(p) => p.theme.color.GREY}; display: block; white-space: pre-wrap; max-height: 60px; overflow: hidden; }
`;
const Actions = styled.div`display: flex; flex-wrap: wrap; gap: 8px; align-items: center;`;
const Tip = styled.p`margin: 0; font-size: 11px; color: ${(p) => p.theme.color.GREY};`;
/** Collapsed technical error (§3: no trainer internals in the visitor sentence; the raw text stays available for a bug report). */
const Details = styled.details`
  font-size: 11px; color: ${(p) => p.theme.color.GREY};
  summary { cursor: pointer; user-select: none; }
  pre { margin: 6px 0 0; padding: 8px 10px; max-height: 140px; overflow: auto; background: #f7f7f7; border-radius: 4px; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; color: #555; }
`;

export interface LessonCardProps {
  jobId: string;
  policy: TeachPolicy | undefined;
  nodeAddress?: string;
  teacherAddress?: string;
  onTry: (job: TeachJob) => void;
  onPublish: (job: TeachJob) => void;
  onKeep: (job: TeachJob) => void;
  onImprove: (job: TeachJob) => void;
  onHide: () => void;
}

const toneOf = (j: TeachJob): 'busy' | 'ok' | 'warn' | 'bad' | 'muted' => {
  if (['READY', 'ANNOUNCED'].includes(j.status)) return 'ok';
  if (['NEEDS_MORE', 'PENDING_REVIEW'].includes(j.status)) return 'warn';
  if (['FAILED', 'REJECTED'].includes(j.status)) return 'bad';
  if (['CANCELLED', 'EXPIRED'].includes(j.status)) return 'muted';
  return 'busy';
};

/** §5.8 — the "Your lesson" card at the top of the transcript: polls the job every 5 s while it moves, then offers Try / Publish / Keep. */
export function LessonCard({ jobId, policy, nodeAddress, teacherAddress, onTry, onPublish, onKeep, onImprove, onHide }: LessonCardProps) {
  const { t } = useT();
  const dispatch = useDispatch();
  const [poll, setPoll] = useState(5000);
  const { data, error } = useTeachJobQuery(jobId, { pollingInterval: poll });
  const [cancel, { isLoading: cancelling }] = useCancelTeachJobMutation();
  const [recheck, { isLoading: rechecking }] = useRecheckTeachJobMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const job = data?.job;
  const full = isFullJob(job) ? job : null;
  const status = job?.status;
  const lastStatus = useRef<string | undefined>(undefined);
  const cardRef = useRef<HTMLElement>(null);

  // 5 s while the lesson moves, 30 s afterwards (review → announced, verification); refresh the picker once a draft exists.
  // On every status change bring the card into view: it is the first block of a transcript that auto-scrolls to the
  // newest reply, so a lesson queued after a long answer would otherwise turn READY out of sight.
  useEffect(() => {
    if (!status) return;
    setPoll(ACTIVE.has(status) ? 5000 : 30_000);
    if (lastStatus.current !== status) {
      lastStatus.current = status;
      if (['READY', 'NEEDS_MORE', 'ANNOUNCED', 'CANCELLED', 'EXPIRED', 'PENDING_REVIEW'].includes(status)) dispatch(api.util.invalidateTags(['Chat', 'Teach']));
      const el = cardRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [status, dispatch]);

  if (error && !data) return <Card $tone="bad" data-testid="lesson-card" data-status="error"><Alert $tone="error" role="alert">{mapTeachError(error, t)}</Alert></Card>;
  if (!job) return null;
  if (!full) return (
    <Card $tone="muted" data-testid="lesson-card" data-status={job.status}>
      <Head><h3>{t('teach.card.title', { name: jobId.slice(0, 8) })}</h3><button type="button" className="x" onClick={onHide}>{t('teach.card.hide')}</button></Head>
      <span>{t('teach.card.not_yours', { status: t(cardStatusKey(job.status)) })}</span>
    </Card>
  );

  const j = full;
  const c = j.checks;
  const p = j.progress;
  const tone = toneOf(j);
  const name = (j.name ?? '').replace(/^Lesson:\s*/, '') || j.facts[0]?.prompt || j.id.slice(0, 8);
  const gated = !!c && (!c.ok || !c.executed);
  const publishOff = policy?.publish === 'never';
  const stub = policy?.backend === 'stub';
  /** checks were SIMULATED (no model server): never say "in the live model". A stub node with a live model measured
   *  them for real — only the training was fake, which is `stub` alone. Read it off the node's own flags rather than
   *  off the prose of `note`: the wording of that sentence is not an API. */
  const simulated = !!c?.simulated || !!policy?.simulated_checks;
  const doCancel = async () => { setActionError(null); try { await cancel(j.id).unwrap(); } catch (e) { setActionError(mapTeachError(e, t)); } };
  const doRecheck = async () => { setActionError(null); try { await recheck(j.id).unwrap(); } catch (e) { setActionError(mapTeachError(e, t)); } };
  const eta = etaText(j.eta_s, policy, t);
  const warming = stub ? t('teach.card.starting') : t('teach.card.loading');

  let body: React.ReactNode = null;
  switch (j.status) {
    case 'QUEUED':
      body = j.blocked === 'slot' ? t('teach.card.blocked') : j.blocked === 'lock' ? t('teach.card.lock') : <>{t('teach.card.queued', { n: j.position ?? 0 }, j.position ?? 0)}{eta ? ` · ${eta}` : ''}</>;
      break;
    case 'PREFLIGHT': case 'LOADING':
      body = warming; break;
    case 'TRAINING':
      body = !p || p.step === 0 ? warming : (
        <>
          {t('teach.card.training', { step: p.step, max: p.max_steps, hits: p.hits, total: p.total })}
          <Bar aria-hidden><span style={{ width: `${Math.min(100, Math.round((p.step / Math.max(1, p.max_steps)) * 100))}%` }} /></Bar>
        </>
      );
      break;
    case 'EXPORTED':
      body = j.blocked === 'runtime' ? t('teach.card.runtime') : j.blocked === 'lock' ? t('teach.card.lock') : t('teach.card.checking'); break;
    case 'CHECKING':
      body = t('teach.card.checking'); break;
    case 'READY':
      body = c && !c.executed
        ? <Alert $tone="warning">{t('teach.card.ready_unchecked')} <Button size="small" onClick={() => { void doRecheck(); }} loading={rechecking} style={{ marginLeft: 8 }}>{t('teach.card.check_again')}</Button></Alert>
        : <b style={{ color: '#1e6b36' }}>{t(simulated || stub ? 'teach.card.ready_sim' : 'teach.card.ready', { hits: c?.taught.hits ?? 0, total: c?.taught.total ?? 0 })}</b>;
      break;
    case 'NEEDS_MORE':
      body = t('teach.card.needs_more', { hits: c?.taught.hits ?? 0, total: c?.taught.total ?? 0 }); break;
    case 'FAILED': {
      const key = failedKey(j.error);
      body = (
        <>
          {t(key)}
          {j.error && key !== 'teach.card.failed_known' && (
            <Details data-testid="lesson-error-details">
              <summary>{t('teach.card.details')}</summary>
              <pre>{j.error}</pre>
            </Details>
          )}
        </>
      );
      break;
    }
    case 'CANCELLED': body = t('teach.card.cancelled'); break;
    case 'EXPIRED': body = t('teach.card.expired'); break;
    case 'PENDING_REVIEW': body = t('teach.card.pending_review'); break;
    case 'ANNOUNCED': body = t('teach.card.announced'); break;
    case 'REJECTED': body = t('teach.card.rejected', { reason: j.reject_reason ?? '' }); break;
    default: body = t(cardStatusKey(j.status, j.publish_status));
  }

  const showChecks = c && c.executed && ['READY', 'NEEDS_MORE', 'PENDING_REVIEW', 'ANNOUNCED', 'REJECTED'].includes(j.status);
  /**
   * Item 17 — the card used to print "2 of 2 correct" while training and "0 of 2" as the verdict, both bare, one after
   * the other, with nothing saying they measure different things. The two lines are now labelled (practice vs the live
   * model) and, when they actually disagree, the card says so instead of leaving it to read like a product bug.
   */
  const practiceGap = !!c?.executed && !!p && p.total > 0 && ['READY', 'NEEDS_MORE'].includes(j.status)
    && (p.hits !== c.taught.hits || p.total !== c.taught.total);
  const showFacts = ['READY', 'NEEDS_MORE', 'PENDING_REVIEW', 'ANNOUNCED', 'REJECTED'].includes(j.status) && j.facts.some((f) => f.after_answer !== undefined || f.hit !== undefined);
  const pageLink = j.patch_id && nodeAddress ? `/${encodeURIComponent(nodeAddress)}/${encodeURIComponent(j.patch_id)}` : null;

  return (
    <Card ref={cardRef} $tone={tone} data-testid="lesson-card" data-status={j.status} aria-live="polite">
      <Head>
        <h3>{t('teach.card.title', { name })}</h3>
        <State $tone={tone} data-testid="lesson-status">{t(cardStatusKey(j.status, j.publish_status))}</State>
        <span style={{ fontSize: 11, color: '#8d8d8f' }}>{t('teach.card.facts', { n: j.facts.length })}</span>
        <button type="button" className="x" onClick={onHide}>{t('teach.card.hide')}</button>
      </Head>
      <div data-testid="lesson-body">{body}</div>
      {/* v2 §5.9: the chat basket really did become a file — say so, and link to it (the receipt the owner asked for). */}
      {j.dataset?.id && j.dataset.source === 'chat' && (
        <Tip data-testid="freeze-note">
          {t('teach.basket.freeze_note', { n: j.dataset.rows, filename: basketFilename(j.created_at) })}{' '}
          <StyledLink to={`/teach/dataset/${j.dataset.id}`}>{t('teach.basket.view')}</StyledLink>
        </Tip>
      )}
      {/* never a whole-dataset claim from a sampled check (v2 §5.12); counts are per QUESTION, from `facts` */}
      {showChecks && c?.taught.sampled && (
        <Tip data-testid="lesson-sampled">{t('teach.res.checked_sample', {
          k: j.facts.filter((f) => f.hit !== undefined).length, n: j.facts.length, hits: j.facts.filter((f) => f.hit === true).length,
        })}</Tip>
      )}
      {/* SC-7 — the same three sentences the file door's result screen gives, in the card the chat door ends on. */}
      {!!j.bases?.length && <Tip><BuiltOnLines j={j} /></Tip>}
      {practiceGap && <Tip data-testid="practice-gap">{t('teach.card.practice_gap', { phits: p!.hits, ptotal: p!.total })}</Tip>}
      {(simulated || stub) && showChecks && <Tip data-testid="lesson-simulated">{t(simulated ? 'teach.card.simulated' : 'teach.card.stub_only')}</Tip>}
      {c?.reverted_and_reapplied && <Tip>{t('teach.card.revert_note')}</Tip>}
      {showChecks && (
        <Checks>
          {c.parent_regression.total > 0 && <li>{t('teach.card.check_parent', { m: c.parent_regression.hit, n: c.parent_regression.total })}</li>}
          {/* SC-14 `merge.result`: a combined knowledge is scored per source, so a merge that keeps 95 % overall by
              losing one parent entirely cannot read as a pass (design §9 step 4). */}
          {!!j.merge && !!c.merge_check?.length && (() => {
            const src = (id: string) => c.merge_check!.find((x) => x.source === id);
            const res = c.merge_check!.find((x) => x.kind === 'resolved');
            const nameOf = (id: string) => j.bases?.find((b) => b.patch_id === id)?.name ?? id;
            return (
              <li data-testid="lesson-merge-check">{t('merge.result', {
                A: nameOf(j.merge!.a), B: nameOf(j.merge!.b),
                m: src(j.merge!.a)?.hit ?? 0, n: src(j.merge!.a)?.total ?? 0,
                p: src(j.merge!.b)?.hit ?? 0, q: src(j.merge!.b)?.total ?? 0,
                r: res?.hit ?? 0, s: res?.total ?? 0,
              })}</li>
            );
          })()}
          <li>{t('teach.card.check_locality', { m: c.locality.same, n: c.locality.total })}</li>
          {c.heldout.total > 0 && <li>{t('teach.card.check_heldout', { m: c.heldout.hits, n: c.heldout.total })}</li>}
        </Checks>
      )}
      {showFacts && (
        <FactsWrap>
          <Facts>
            <thead><tr><th>{t('teach.drawer.question')}</th><th>{t('teach.card.before')}</th><th>{t('teach.card.after')}</th><th>{t('teach.card.other')}</th></tr></thead>
            <tbody>
              {j.facts.map((f, i) => (
                <tr key={i}>
                  <td className="q">{f.prompt}<span className="ans">→ {f.answer}</span></td>
                  <td><span className="ans">{f.base_answer?.trim() || '—'}</span></td>
                  <td>{f.hit === undefined ? '—' : <span className={f.hit ? 'ok' : 'no'}>{f.hit ? '✓' : '✗'}</span>}<span className="ans">{f.after_answer?.trim() || ''}</span></td>
                  <td>{f.alt_prompt ? (f.heldout_hit === undefined ? '—' : <span className={f.heldout_hit ? 'ok' : 'no'}>{f.heldout_hit ? '✓' : '✗'}</span>) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </Facts>
        </FactsWrap>
      )}
      {j.status === 'READY' && gated && c?.executed && <Alert $tone="warning" data-testid="publish-gated">{t('teach.card.publish_gated')}</Alert>}
      {j.status === 'READY' && publishOff && <Alert $tone="info">{t('teach.pub.off')}</Alert>}
      {actionError && <Alert $tone="error" role="alert">{actionError}</Alert>}
      <Actions>
        {ACTIVE.has(j.status) && <Button size="small" color="secondary" onClick={() => { void doCancel(); }} loading={cancelling} data-testid="lesson-cancel">{t('teach.card.cancel')}</Button>}
        {['READY', 'NEEDS_MORE'].includes(j.status) && j.draft_id && <Button size="small" variant="contained" onClick={() => onTry(j)} data-testid="lesson-try">{t('teach.card.try')}</Button>}
        {j.status === 'READY' && <Button size="small" onClick={() => onPublish(j)} disabled={gated || publishOff} data-testid="lesson-publish">{t('teach.card.publish')}</Button>}
        {['READY', 'NEEDS_MORE', 'REJECTED'].includes(j.status) && <Button size="small" onClick={() => onKeep(j)} data-testid="lesson-keep">{t('teach.card.keep')}</Button>}
        {['NEEDS_MORE', 'FAILED'].includes(j.status) && <Button size="small" onClick={() => onImprove(j)} data-testid="lesson-improve">{t('teach.card.improve')}</Button>}
        {pageLink && <StyledLink to={pageLink} style={{ fontSize: 12 }}>{t('teach.card.page_link')} →</StyledLink>}
        {['PENDING_REVIEW', 'ANNOUNCED'].includes(j.status) && teacherAddress && <StyledLink to={`/teacher/${teacherAddress}`} style={{ fontSize: 12 }}>{t('teach.pub.link_earnings')} →</StyledLink>}
      </Actions>
      {ACTIVE.has(j.status) && !stub && <Tip>{t('teach.card.timing_tip')}</Tip>}
      {['READY', 'NEEDS_MORE'].includes(j.status) && <Tip>{t('teach.card.expiry')}</Tip>}
    </Card>
  );
}
