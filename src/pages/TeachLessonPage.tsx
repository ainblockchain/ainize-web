import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import {
  useCancelTeachJobMutation, useInfoQuery, useRecheckTeachJobMutation, useRetrainTeachJobMutation,
  useTeachJobEventsQuery, useTeachJobQuery, useTeachPolicyQuery,
} from '@/api/api';
import type { TeachEffort, TeachJob } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import { KeepPrivateSheet } from '@/components/chat/KeepPrivateSheet';
import { PublishSheet } from '@/components/chat/PublishSheet';
import { ACTIVE, failedKey, isFullJob, mapTeachError } from '@/components/chat/teachUtil';
import { LiveTestBox } from '@/components/teach/LiveTestBox';
import { StageRail } from '@/components/teach/StageRail';
import { Stepper } from '@/components/teach/Stepper';
import { elapsedText, etaLine, nextEffort, stageOf } from '@/components/teach/util';
import { signedDownload } from '@/lib/teachDataset';
import { currentTeacherKey } from '@/lib/teacherKey';

/**
 * `/teach/lesson/:jobId` — steps 4 and 5 on one route (design §5.6, §5.7).
 *
 * While the lesson moves this is the progress screen: the stage rail, a REAL `step / max_steps` bar (never a computed
 * percentage), the per-question hit counter, honest elapsed time and — only under §10's three conditions — a time left.
 * When it stops moving the same route becomes the result: what it learned, what it did not, what it did to unrelated
 * answers, a live test against the private draft, and the three things a visitor can do next.
 */
const Panel = styled.section`
  display: flex; flex-direction: column; gap: 12px; padding: 16px; margin-top: 16px; border-radius: 8px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 16px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p { margin: 0; font-size: 13.5px; line-height: 1.6; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
const Bar = styled.div`
  height: 10px; border-radius: 5px; background: #eee; overflow: hidden;
  span { display: block; height: 100%; background: ${(p) => p.theme.color.PRIMARY}; transition: width 0.4s ease; }
`;
const Counters = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY};
  b { font-variant-numeric: tabular-nums; }
`;
const FactTable = styled.table`
  width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;
  th { text-align: left; font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.GREY}; padding: 6px 10px 6px 0; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; }
  td { padding: 8px 10px 8px 0; vertical-align: top; border-bottom: 1px solid #f0f0f0; word-break: break-word; overflow-wrap: anywhere; }
  td.q { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  @media (max-width: 720px) {
    thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    tr { display: block; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
    td { display: block; border: 0; padding: 2px 0; }
    td::before { content: attr(data-label) ': '; font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
    td.q::before { content: none; }
  }
`;
const Cards = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;`;
const Choice = styled.div<{ $primary?: boolean }>`
  display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 8px; background: #fff;
  border: 1px solid ${(p) => (p.$primary ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  b { font-size: 14px; color: ${(p) => p.theme.color.BLACK}; }
  span { font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.DARK_GREY}; flex: 1; }
`;
/** Demo node: publishing is still reachable, but as a labelled link under the cards — never the loudest button. */
const DemoPublish = styled.p`
  margin: 12px 0 0; font-size: 12.5px; line-height: 1.6; color: ${(p) => p.theme.color.GREY};
  button { background: none; border: 0; padding: 0; margin-left: 6px; font: inherit; color: ${(p) => p.theme.color.PRIMARY}; text-decoration: underline; cursor: pointer; }
  button:disabled { color: ${(p) => p.theme.color.GREY}; cursor: not-allowed; text-decoration: none; }
`;
const Log = styled.details`
  font-size: 12px; color: ${(p) => p.theme.color.GREY};
  summary { cursor: pointer; }
  pre { margin: 8px 0 0; padding: 8px 10px; max-height: 200px; overflow: auto; background: #f7f7f7; border-radius: 4px; font-size: 11.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
`;
const ShownNote = styled.p`margin: 0; font-size: 12.5px; color: ${(p) => p.theme.color.GREY}; a { color: ${(p) => p.theme.color.PRIMARY}; }`;
/** The learned / missed tables are sliced; the slice is stated on screen, never silent (design §5.12). */
const ROWS_SHOWN = 50;
const Confirm = styled.div`
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px; border-radius: 6px; background: #fff3e0; color: #8a4b00; font-size: 13px;
`;

export default function TeachLessonPage() {
  const { jobId = '' } = useParams<{ jobId: string }>();
  const { t } = useT();
  const navigate = useNavigate();
  const { data: policy } = useTeachPolicyQuery();
  const { data: info } = useInfoQuery();
  const [poll, setPoll] = useState(3000);
  const { data, error: jobError } = useTeachJobQuery(jobId, { pollingInterval: poll, skip: !jobId });
  const [cancel, { isLoading: cancelling }] = useCancelTeachJobMutation();
  const [recheck, { isLoading: rechecking }] = useRecheckTeachJobMutation();
  const [retrain, { isLoading: retraining }] = useRetrainTeachJobMutation();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [sheet, setSheet] = useState<'publish' | 'keep' | null>(null);
  const [tick, setTick] = useState(0);

  const job = data?.job;
  const full = isFullJob(job) ? job : null;
  const status = job?.status;
  const active = !!status && ACTIVE.has(status);
  useEffect(() => { setPoll(active ? 3000 : 30_000); }, [active]);
  useEffect(() => { if (!active) return; const h = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(h); }, [active]);
  const { data: events } = useTeachJobEventsQuery({ id: jobId }, { skip: !jobId || !full, pollingInterval: active ? 5000 : 0 });

  if (!job) {
    return (
      <PageWrapper data-testid="teach-lesson">
        <Stepper current={4} />
        {jobError ? <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{mapTeachError(jobError, t)}</Alert> : <CenterProgress />}
      </PageWrapper>
    );
  }
  if (!full) {
    return (
      <PageWrapper data-testid="teach-lesson">
        <Stepper current={4} />
        <Alert $tone="info" style={{ marginTop: 16 }}>{t('teach.card.not_yours', { status: job.status })}</Alert>
      </PageWrapper>
    );
  }

  const j: TeachJob = full;
  // The trainer's last two lines ("exported N memory entries…", "READY: taught …") only exist once the lesson has
  // STOPPED, so the log belongs to the result screen just as much as to the progress screen.
  const log = (
    <Log data-testid="event-log">
      <summary>{t('teach.run.log')}</summary>
      <pre>{events?.events?.length ? events.events.map((e) => `${new Date(e.ts).toLocaleTimeString()}  ${e.message}`).join('\n') : t('teach.run.log_empty')}</pre>
    </Log>
  );
  const p = j.progress;
  const c = j.checks;
  const stub = policy?.backend === 'stub';
  // Two different admissions, and conflating them is a lie in one direction or the other: `simulated` means the CHECKS
  // were made up (no model server); a stub node with a live model really measured them — only the TRAINING was fake.
  const simulated = !!c?.simulated;
  const demo = stub || simulated;
  const name = (j.name ?? '').replace(/^Lesson:\s*/, '') || j.dataset?.name || j.facts[0]?.prompt || j.id.slice(0, 8);
  const elapsed = j.started_at ? Math.round((Date.now() - j.started_at) / 1000) : (p?.elapsed_s ?? 0);
  const trained = j.facts.length;
  const rowsTotal = j.dataset?.rows ?? trained;

  const doCancel = () => void (async () => {
    setError(null);
    try { await cancel(j.id).unwrap(); setConfirm(false); } catch (e) { setError(mapTeachError(e, t)); }
  })();
  /**
   * "Change settings and re-train" must show the settings: the effort is bumped one step and pre-selected there, and
   * pressing Train on that screen is what sends POST …/retrain (same dataset, `parent_job` set). A lesson with no
   * dataset of its own has no settings screen to open, so it re-trains directly — the node writes it a dataset first.
   */
  const doRetrain = () => void (async () => {
    setError(null);
    const effort = nextEffort((j.training?.effort ?? 'balanced') as TeachEffort);
    if (j.dataset?.id && !j.dataset.deleted) { navigate(`/teach/dataset/${j.dataset.id}/settings?retrain=${encodeURIComponent(j.id)}&effort=${effort}`); return; }
    try {
      const out = await retrain({ id: j.id, training: { effort } }).unwrap();
      navigate(`/teach/lesson/${out.job.id}`);
    } catch (e) { setError(mapTeachError(e, t)); }
  })();

  // ------------------------------------------------------------------ step 4: progress
  if (active) {
    const stage = stageOf(j.status);
    const step = p?.step ?? 0;
    const maxSteps = p?.max_steps ?? j.training?.max_steps ?? 0;
    const frac = maxSteps > 0 ? Math.min(1, step / maxSteps) : 0;
    return (
      <PageWrapper data-testid="teach-lesson" data-status={j.status}>
        <Stepper current={4} />
        <TitleRow style={{ paddingTop: 16 }}><Title>{t('teach.run.title', { name })}</Title></TitleRow>
        <Panel>
          <StageRail stage={stage} stub={stub} />
          {j.status === 'QUEUED' && (
            <p data-testid="queue-line">{t('teach.run.stage.wait_rows', { n: j.position ?? 0, q: policy?.queue?.queued_rows ?? rowsTotal })}</p>
          )}
          {stage === 'train' && maxSteps > 0 && (
            <>
              <Bar role="progressbar" aria-valuemin={0} aria-valuemax={maxSteps} aria-valuenow={step} data-testid="train-bar"><span style={{ width: `${Math.round(frac * 100)}%` }} /></Bar>
              <Counters>
                <span data-testid="step-line">{t('teach.run.step', { step, max: maxSteps })}</span>
                <span data-testid="hits-line">{t('teach.run.hits', { hits: p?.hits ?? 0, total: p?.total ?? trained })}</span>
              </Counters>
            </>
          )}
          <Counters>
            <span data-testid="elapsed" data-tick={tick}>{t('teach.run.elapsed', { time: elapsedText(elapsed) })}</span>
            <span data-testid="eta">{etaLine(j, policy, t)}</span>
            <span>{t('teach.run.rows', { n: trained })}</span>
          </Counters>
          {!stub && <p>{t('teach.run.tip_spare')}</p>}
          <p>{t('teach.run.leave')}</p>
          {error && <Alert $tone="error" role="alert">{error}</Alert>}
          {confirm ? (
            <Confirm data-testid="cancel-confirm">
              <span>{t('teach.run.cancel_confirm')}</span>
              <Button size="small" color="secondary" onClick={doCancel} loading={cancelling} data-testid="cancel-yes">{t('teach.run.cancel_yes')}</Button>
              <Button size="small" onClick={() => setConfirm(false)}>{t('teach.run.cancel_no')}</Button>
            </Confirm>
          ) : (
            <div><Button size="small" color="secondary" onClick={() => setConfirm(true)} data-testid="cancel-training">{t('teach.run.cancel')}</Button></div>
          )}
          {log}
        </Panel>
      </PageWrapper>
    );
  }

  // ------------------------------------------------------------------ step 5: result
  // Question counts come from `facts`, which is index-aligned with the dataset — NOT from `checks.taught`, which counts
  // model probes (the head of the sample is asked twice, so 3 questions report 6 answers). A sampled check may leave
  // some questions unmeasured; they are counted as unmeasured, never as learned (§5.12).
  const learned = j.facts.filter((f) => f.hit === true);
  const missed = j.facts.filter((f) => f.hit === false);
  const totalQ = j.facts.length;
  const measured = learned.length + missed.length;
  const failedTone = ['FAILED', 'CANCELLED', 'EXPIRED', 'REJECTED'].includes(j.status);
  const teacherKey = currentTeacherKey();
  const gated = !!c && (!c.ok || !c.executed || !!c.skipped);
  const publishOff = policy?.publish === 'never';

  return (
    <PageWrapper data-testid="teach-lesson" data-status={j.status}>
      <Stepper current={5} />
      <TitleRow style={{ paddingTop: 16 }}>
        {/* A demo node trained nothing. "Your lesson is ready" in display type above a pale "no training happened"
            box is two sentences that cannot both be true, and the visitor reads the big one — so the headline
            itself says what this run was, and the admission comes first and in the warning tone. */}
        <Title data-testid="result-title">{demo && !failedTone ? t('teach.res.title_demo')
          : j.status === 'READY' || j.status === 'ANNOUNCED' || j.status === 'PENDING_REVIEW' ? t('teach.res.title')
            : failedTone ? t('teach.card.title', { name }) : t('teach.res.title_partial')}</Title>
      </TitleRow>
      {demo && !failedTone && <Alert $tone="warning" style={{ marginTop: 12 }} data-testid="simulated">{t(simulated ? 'teach.res.simulated' : 'teach.res.stub_only')}</Alert>}
      {failedTone ? (
        <Alert $tone="warning" style={{ marginTop: 12 }} data-testid="result-failed">
          {j.status === 'CANCELLED' ? t('teach.card.cancelled') : j.status === 'EXPIRED' ? t('teach.card.expired') : j.status === 'REJECTED' ? t('teach.pub.rejected', { reason: j.reject_reason ?? '' }) : t(failedKey(j.error))}
        </Alert>
      ) : (
        <Description data-testid="result-learned">
          {measured === 0 ? t('teach.card.ready_unchecked')
            : measured < totalQ ? t(simulated ? 'teach.res.checked_sample_demo' : 'teach.res.checked_sample', { k: measured, n: totalQ, hits: learned.length })
              : learned.length === totalQ ? t(simulated ? 'teach.res.learned_all_demo' : 'teach.res.learned_all', { total: totalQ })
                : t(simulated ? 'teach.res.learned_demo' : 'teach.res.learned', { hits: learned.length, total: totalQ })}
        </Description>
      )}
      {/* a deleted dataset keeps its line below, but neither control is rendered: both can now only answer 404 */}
      {j.dataset?.id && !j.dataset.deleted && (
        <Description>
          <Link to={`/teach/dataset/${j.dataset.id}`}>{t('teach.res.dataset_link', { name: j.dataset.name ?? '', n: j.dataset.rows })}</Link>
          {' · '}
          <button
            type="button" data-testid="download-dataset"
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: '#8b3eeb', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => void signedDownload(`/api/teach/datasets/${j.dataset?.id}/download`, `${j.dataset?.name ?? 'dataset'}.jsonl`).catch((e: Error) => setError(e.message))}
          >{t('teach.res.dataset_download')}</button>
        </Description>
      )}
      {/* the node drops questions the model already answers; without this line 24 of 40 simply vanish */}
      {!!j.preflight?.known && (
        <Description data-testid="skipped-known">{t('teach.res.skipped_known', { n: j.preflight.known, of: j.preflight.of })}</Description>
      )}
      {!!j.preflight?.overlaps && (
        <Description data-testid="skipped-overlap">{t('teach.res.skipped_overlap', { n: j.preflight.overlaps })}</Description>
      )}
      {j.dataset?.deleted && <Description data-testid="dataset-gone">{t('teach.data.gone')}</Description>}
      {error && <Alert $tone="error" role="alert" style={{ marginTop: 12 }}>{error}</Alert>}

      {/* A cancelled / failed / expired lesson has no result to report: the rows below would describe a lesson that
          does not exist, next to the sentence saying it was stopped. */}
      {!failedTone && !!learned.length && (
        <Panel data-testid="learned-block">
          <h2>{t('teach.res.learned_title')}</h2>
          <FactTable>
            <thead><tr><th>{t('teach.res.h.q')}</th><th>{t('teach.res.h.before')}</th><th>{t('teach.res.h.after')}</th><th>{t('teach.res.h.other')}</th></tr></thead>
            <tbody>
              {learned.slice(0, ROWS_SHOWN).map((f, i) => (
                <tr key={`l${i}`}>
                  <td className="q" data-label={t('teach.res.h.q')}>{f.prompt}</td>
                  <td data-label={t('teach.res.h.before')}>{f.base_answer ?? '—'}</td>
                  <td data-label={t('teach.res.h.after')}>{f.after_answer ?? f.answer}</td>
                  <td data-label={t('teach.res.h.other')}>{f.alt_prompt ? (f.heldout_hit ? '✓' : '—') : ''}</td>
                </tr>
              ))}
            </tbody>
          </FactTable>
          {learned.length > ROWS_SHOWN && <ShownNote data-testid="learned-shown">{t('teach.res.showing_first', { shown: ROWS_SHOWN, total: learned.length })}{j.dataset?.id && !j.dataset.deleted ? <> <Link to={`/teach/dataset/${j.dataset.id}`}>{t('teach.res.showing_all')}</Link></> : null}</ShownNote>}
        </Panel>
      )}
      {!failedTone && !!missed.length && (
        <Panel data-testid="missed-block">
          <h2>{t('teach.res.not_learned')}</h2>
          <p>{t('teach.res.partial_hint')}</p>
          <FactTable>
            <thead><tr><th>{t('teach.res.h.q')}</th><th>{t('teach.res.h.after')}</th></tr></thead>
            <tbody>
              {missed.slice(0, ROWS_SHOWN).map((f, i) => (
                <tr key={`m${i}`}><td className="q" data-label={t('teach.res.h.q')}>{f.prompt}</td><td data-label={t('teach.res.h.after')}>{f.after_answer ?? '—'}</td></tr>
              ))}
            </tbody>
          </FactTable>
          {missed.length > ROWS_SHOWN && <ShownNote data-testid="missed-shown">{t('teach.res.showing_first', { shown: ROWS_SHOWN, total: missed.length })}{j.dataset?.id && !j.dataset.deleted ? <> <Link to={`/teach/dataset/${j.dataset.id}`}>{t('teach.res.showing_all')}</Link></> : null}</ShownNote>}
        </Panel>
      )}

      {c && !failedTone && (
        <Panel data-testid="side-effects">
          <h2>{t('teach.res.side_title')}</h2>
          {c.skipped ? <p>{t('teach.res.side_off')}</p>
            : !c.executed ? <p>{t('teach.card.ready_unchecked')}</p>
              : c.locality.ok && c.parent_regression.ok
                // the "knowledge you had loaded" half is only true when this lesson was built on some (v1 LessonCard rule)
                ? <p data-testid="side-ok">{c.parent_regression.total > 0
                  ? t('teach.res.side_ok', { m: c.locality.same, n: c.locality.total, p: c.parent_regression.hit, q: c.parent_regression.total })
                  : t('teach.card.check_locality', { m: c.locality.same, n: c.locality.total })}</p>
                : <p data-testid="side-bad">{t('teach.res.side_bad', { n: Math.max(0, c.locality.total - c.locality.same) })}</p>}
          {c.executed && !c.skipped && !!c.locality.unstable && (
            <p style={{ fontSize: 12 }} data-testid="side-unstable">{t(c.locality.unstable === 1 ? 'teach.res.side_unstable_one' : 'teach.res.side_unstable', { n: c.locality.unstable })}</p>
          )}
          {(c.skipped || !c.executed) && (
            <div><Button size="small" onClick={() => void recheck(j.id).unwrap().catch((e: unknown) => setError(mapTeachError(e, t)))} loading={rechecking} data-testid="run-check-now">{t('teach.res.side_run')}</Button></div>
          )}
        </Panel>
      )}

      {j.draft_id && !failedTone && (
        <Panel data-testid="try-block">
          <h2>{t('teach.res.try_title')}</h2>
          <LiveTestBox draftId={j.draft_id} />
        </Panel>
      )}

      <Panel>
        <h2>{t('teach.res.next')}</h2>
        <Cards>
          {/* On a demo node the loudest button used to offer to put a placeholder file on a public marketplace under
              the visitor's name. Keeping it private is the honest first choice here; publishing stays reachable (this
              node exists to demonstrate the whole flow) but as a plain link that says what would be published. */}
          {!demo && (
            <Choice $primary>
              <b>{t('teach.res.publish_title')}</b>
              <span>{t('teach.res.publish_body', { share: Math.round((policy?.shares?.contributor ?? 0.7) * 100) })}</span>
              <Button
                variant="contained" onClick={() => setSheet('publish')} data-testid="go-publish"
                disabled={publishOff || gated || !teacherKey || j.status !== 'READY'}
              >{t('teach.card.publish')}</Button>
              {gated && <span style={{ fontSize: 12 }}>{t('teach.card.publish_gated')}</span>}
            </Choice>
          )}
          <Choice $primary={demo}>
            <b>{t('teach.res.keep_title')}</b>
            <span>{t('teach.res.keep_body')}</span>
            {/* a declined lesson still has its knowledge file, and `save()` only needs that — refusing here would
                contradict the sentence above it ("Your file is still available to download.") */}
            <Button variant={demo ? 'contained' : undefined} onClick={() => setSheet('keep')} disabled={!['READY', 'NEEDS_MORE', 'REJECTED'].includes(j.status)} data-testid="go-keep">{t('teach.card.keep')}</Button>
          </Choice>
          <Choice>
            <b>{t('teach.res.again_title')}</b>
            <span>{t('teach.res.again_body')}</span>
            <Button onClick={doRetrain} loading={retraining} data-testid="go-retrain">{t('teach.res.again_cta')}</Button>
          </Choice>
        </Cards>
        {demo && (
          <DemoPublish data-testid="publish-demo">
            <span>{t('teach.res.publish_demo')}</span>
            <button type="button" onClick={() => setSheet('publish')} data-testid="go-publish" disabled={publishOff || gated || !teacherKey || j.status !== 'READY'}>{t('teach.res.publish_demo_cta')}</button>
            {gated && <span>{t('teach.card.publish_gated')}</span>}
          </DemoPublish>
        )}
      </Panel>

      {/* the same log the progress screen shows: its last lines ("exported …", "READY: taught …") are written after
          the lesson stops, so this is the only screen they can ever be read on */}
      <Panel data-testid="result-log">{log}</Panel>

      {/* The sheet OWNS the success state — announced / in review, the public page, the earnings page. Closing it on
          success threw away the only confirmation the visitor ever gets that publishing worked (ChatPage keeps it). */}
      {sheet === 'publish' && policy && teacherKey && (
        <PublishSheet job={j} policy={policy} teacherKey={teacherKey} onClose={() => setSheet(null)} onPublished={() => undefined} />
      )}
      {sheet === 'keep' && policy && (
        <KeepPrivateSheet
          job={j} policy={policy} runtimeModel={info?.node.model} onClose={() => setSheet(null)}
          onPublishLater={() => setSheet('publish')} onDeleted={() => navigate('/teach/mine')}
        />
      )}
    </PageWrapper>
  );
}
