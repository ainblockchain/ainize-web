import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  useCatalogQuery, useCreateTeachJobMutation, useForkPatchMutation, usePatchTeachDatasetMutation, useRetrainTeachJobMutation,
  useTeachDatasetQuery, useTeachDatasetRowsQuery, useTeachPolicyQuery,
} from '@/api/api';
import type { TeachEffort } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, HelperText, TextField } from '@/components/ui/Form';
import { CenterProgress, Description, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import { BasePicker, baseBlocked, toCandidate } from '@/components/chat/BasePicker';
import { mapTeachError } from '@/components/chat/teachUtil';
import { EffortCards } from '@/components/teach/EffortCards';
import { Stepper } from '@/components/teach/Stepper';
import { effortLabelKey, effortTime, presetOf, rowsPerJob } from '@/components/teach/util';
import { clearKnown, loadKnownState, loadSelection, shortSha } from '@/lib/teachDataset';
import { rememberJob } from '@/lib/teachStore';
import { currentTeacherKey } from '@/lib/teacherKey';

/**
 * `/teach/dataset/:dsId/settings` — step 3 (design §5.5). Exactly four things a non-expert can judge: a name, how hard
 * to try, whether to measure side effects (locked on where publishing is possible, because it is the publish gate) and
 * whether to hold the "another way to ask" column out of training. Everything with a number in it — the per-lesson
 * question cap, the presets, the queue — comes from the node's policy; nothing here is hard-coded.
 */
const Block = styled.section`
  display: flex; flex-direction: column; gap: 10px; padding: 16px 0; border-bottom: 1px solid #f0f0f0;
  h2 { margin: 0; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p.hint { margin: 0; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.GREY}; }
`;
const Advanced = styled.details`
  margin-top: 12px; font-size: 12.5px; color: ${(p) => p.theme.color.GREY};
  summary { cursor: pointer; }
  p { margin: 8px 0 0; line-height: 1.55; }
`;
/**
 * Finding 53 — the bar is `position: sticky; bottom: 0` and the page reserved no room for it: at 1280x900 its top
 * edge was at 827 px and the side-effect checkbox at 837, underneath it; at 360 px it is 124 px tall (17 % of the
 * viewport) with the effort cards intersecting it, so a visitor could press Train having never seen the first of
 * three options. The page reserves its height, and below sm the summary drops to its own line so it stays short.
 */
const Sticky = styled.div`
  position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
  padding: 12px 0; margin-top: 8px; background: #fff; box-shadow: 0 -6px 12px -6px rgba(48, 49, 51, 0.25);
  p { margin: 0; font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) {
    gap: 8px; p { flex: 1 0 100%; font-size: 12px; }
    button { width: 100%; }
  }
`;
/** The room the sticky bar takes, so nothing on the page can only be reached under it. */
const StickySpacer = styled.div`height: 76px; @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { height: 128px; }`;

const EFFORTS = ['quick', 'balanced', 'thorough'] as const;

export default function TeachSettingsPage() {
  const { dsId = '' } = useParams<{ dsId: string }>();
  const { t } = useT();
  useTitle(t('teach.set.title'));
  const navigate = useNavigate();
  // "Change settings and re-train" lands here with the bumped effort pre-selected and the lesson it continues, so the
  // button keeps its promise: the visitor sees the settings before anything runs (design §5.7).
  const [params] = useSearchParams();
  const retrainOf = params.get('retrain') ?? '';
  const asked = params.get('effort');
  const { data: policy } = useTeachPolicyQuery();
  const { data: dsData, isLoading } = useTeachDatasetQuery(dsId, { skip: !dsId });
  const dataset = dsData?.dataset;
  const cap = rowsPerJob(policy);
  const selection = useMemo(() => loadSelection(dsId), [dsId]);
  // the questions this lesson will actually train: the visitor's pick, else the first `cap` accepted ones
  const trained = Math.min(selection?.length ?? dataset?.rows ?? 0, cap);
  const { data: page } = useTeachDatasetRowsQuery({ id: dsId, offset: 0, limit: 200, status: 'ok' }, { skip: !dsId });
  const altCount = useMemo(() => {
    const picked = page?.items?.filter((r) => r.index !== null && (!selection || selection.includes(r.index))) ?? [];
    return picked.slice(0, cap).filter((r) => !!r.alt_prompt).length;
  }, [page, selection, cap]);

  /**
   * SC-4 — *Start from*: the dataset door's answer to "왜 다른 사람 knowledge 위에서 하는게 없어". A base can be chosen
   * here, and its questions can be copied into this creator's own table first, so what they train on top of is
   * visible and editable rather than implied. `?on=` carries the choice back after the copy.
   */
  const onParam = params.get('on');
  const [base, setBase] = useState<string | null>(onParam);
  const [picking, setPicking] = useState(false);
  const [confirmChanges, setConfirmChanges] = useState(false);
  const [copying, setCopying] = useState(false);
  const lineage = policy?.lineage === true;
  const { data: catalog } = useCatalogQuery({ limit: 200 }, { skip: !lineage });
  const candidates = useMemo(() => (catalog?.items ?? []).map((e) => toCandidate(e, [])), [catalog]);
  const chosen = candidates.find((c) => c.id === base) ?? null;
  const blocked = chosen ? baseBlocked(chosen, t) : null;
  const inheritedHere = dataset?.parent_patch === base && (dataset?.inherited_rows ?? 0) > 0;
  const [forkPatch] = useForkPatchMutation();
  const [patchDataset] = usePatchTeachDatasetMutation();

  const [create, { isLoading: sending }] = useCreateTeachJobMutation();
  const [again, { isLoading: resending }] = useRetrainTeachJobMutation();
  const [name, setName] = useState('');
  const [effort, setEffort] = useState<TeachEffort>(EFFORTS.includes(asked as TeachEffort) ? (asked as TeachEffort) : 'balanced');
  const [side, setSide] = useState(true);
  const [useAlt, setUseAlt] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const teacher = currentTeacherKey();
  // measured on the preview screen, and only while it is still about THESE bytes (a new revision clears it)
  const measured = useMemo(() => loadKnownState(dsId, dataset?.revision ?? 0), [dsId, dataset?.revision]);
  const known = useMemo(
    () => (selection?.length ? measured.known.filter((k) => selection.includes(k.index)) : measured.known),
    [measured, selection],
  );
  /**
   * Finding 49 — did anyone actually run the check for THESE bytes? The button used to promise the dataset's row
   * count on the fast path (the path most people take), the progress screen repeated it, and the result then said
   * "It learned all 11 questions" plus "1 of your 12 was left out". Unmeasured questions get a hedged count and one
   * line saying what the worker does with the ones the model already answers.
   */
  const preflighted = measured.checked > 0;
  const publishable = policy?.publish !== 'never';
  const sideLocked = publishable;           // the side-effect check IS the publish gate (§12.6)
  const sideOn = sideLocked ? true : side;
  const altOn = altCount > 0 && useAlt;
  const preset = presetOf(policy, effort);
  const timeText = effortTime(policy, effort, trained, t);

  /**
   * "Start from its questions": the base's set is copied into a dataset of this creator's own (Story B) and this
   * dataset's questions are appended to it, so the next screen shows both — theirs, greyed and pointing home, and
   * mine. Nothing is trained here; the creator sees the merged table before deciding anything.
   */
  const copyFromBase = async () => {
    if (!chosen || !dataset) return;
    setError(null); setCopying(true);
    try {
      const fork = await forkPatch({ id: chosen.id, name: `${dataset.name} + ${chosen.name}`.slice(0, 80) }).unwrap();
      const mine = (page?.items ?? []).filter((r) => r.index !== null && r.prompt && r.answer && !r.from && !r.replaces)
        .map((r) => ({ prompt: r.prompt as string, answer: r.answer as string, ...(r.alt_prompt ? { alt_prompt: r.alt_prompt } : {}) }));
      if (mine.length) await patchDataset({ id: fork.dataset_id, rows_op: { op: 'append', rows: mine } }).unwrap();
      navigate(`/teach/dataset/${fork.dataset_id}?on=${encodeURIComponent(chosen.id)}`);
    } catch (e) { setError(mapTeachError(e, t)); } finally { setCopying(false); }
  };

  const start = async () => {
    setError(null);
    try {
      const body = {
        dataset_id: dsId,
        ...(selection?.length ? { selected_indexes: selection.slice(0, cap) } : {}),
        training: { effort, check_side_effects: sideOn, use_alt: altOn },
        ...(name.trim() ? { name: name.trim() } : {}),
      };
      const out = retrainOf
        ? await again({ id: retrainOf, ...body }).unwrap()
        : await create({
          patch_ids: [], builds_on_context: false, ...body,
          // SC-4: the base is recorded, its questions are kept as known answers, and an answer that differs from
          // its own is trained as a change to it only when the creator says so (§12.1 base_unresolved_conflicts)
          ...(lineage && base && !blocked ? { base_ids: [base], mode: inheritedHere ? ('fork' as const) : ('extend' as const), ...(confirmChanges ? { confirm_conflicts: true } : {}) } : {}),
          // what the preview measured in the live model, so the lesson can record the questions it leaves out (§5.5)
          ...(known.length ? { known } : {}),
          // the file door credits its teacher exactly like the chat door: without this the anchor is anonymous (§9.3)
          ...(teacher?.name ? { contributor: { name: teacher.name } } : {}),
        }).unwrap();
      clearKnown(dsId);
      rememberJob({ id: out.job.id, name: out.job.name, created_at: Date.now() });
      navigate(`/teach/lesson/${out.job.id}`);
    } catch (e) { setError(mapTeachError(e, t)); }
  };

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!dataset) {
    return (
      <PageWrapper data-testid="teach-settings">
        <Stepper current={3} />
        <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{t('teach.err.dataset_not_found')}</Alert>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper data-testid="teach-settings">
      <Stepper current={3} />
      <TitleRow style={{ paddingTop: 16 }}><Title>{t('teach.set.title')}</Title></TitleRow>
      <Description>{t('teach.set.sub')}</Description>
      <Description style={{ marginTop: 6 }} data-testid="settings-dataset">
        {t('teach.set.dataset', { name: dataset.name, n: dataset.rows, short: shortSha(dataset.sha256) })}
      </Description>

      {dataset.rows > cap && (
        <Alert $tone="info" style={{ marginTop: 12 }} data-testid="rows-cap">
          {t('teach.set.rows_cap', { max: cap, n: trained, total: dataset.rows })}
          {policy?.limits?.rows_per_job_source === 'default' ? ` ${t('teach.set.rows_cap_unmeasured')}` : ''}
        </Alert>
      )}

      {lineage && (
        <Block data-testid="start-from">
          <h2>{t('teach.settings.start_from')}</h2>
          <p className="hint">
            {chosen ? t('teach.basket.base', { name: chosen.name }) : t('teach.settings.scratch')}{' '}
            <Button size="small" onClick={() => setPicking(true)} data-testid="pick-base">{chosen ? t('teach.basket.base_change') : t('teach.basket.base_choose')}</Button>
          </p>
          {chosen && !blocked && (
            <p className="hint" data-testid="base-consequences">{t('teach.basket.base_consequences', { name: chosen.name, lineage: Math.round((policy?.shares?.lineage ?? 0) * 100) })}</p>
          )}
          {blocked && <Alert $tone="warning" data-testid="base-blocked">{blocked}</Alert>}
          {chosen && !blocked && (inheritedHere
            ? <p className="hint" data-testid="inherited-already">{t('teach.settings.inherited_already', { name: chosen.name, n: dataset.inherited_rows ?? 0 })}</p>
            : (
              <Button
                onClick={() => void copyFromBase()} loading={copying} loadingText={t('teach.settings.copying', { name: chosen.name })}
                disabled={!chosen.rows} data-testid="inherit-rows"
              >{t('teach.settings.inherit', { n: chosen.rows ?? 0 })}</Button>
            ))}
          {chosen && !blocked && !inheritedHere && (
            <Checkbox
              checked={confirmChanges} onChange={(e) => setConfirmChanges(e.target.checked)} data-testid="confirm-changes"
              label={<span style={{ fontSize: 13 }}>{t('teach.pre.confirm_changes', { name: chosen.name, n: 0 })}</span>}
            />
          )}
        </Block>
      )}

      <Block>
        <TextField
          label={t('teach.set.name')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
          placeholder={dataset.name} helper={t('teach.set.name_hint')} data-testid="lesson-name"
        />
      </Block>

      <Block>
        <h2>{t('teach.set.effort')}</h2>
        <p className="hint">{t('teach.set.effort_hint')}</p>
        <EffortCards value={effort} onChange={setEffort} policy={policy} rows={trained} />
      </Block>

      <Block>
        <h2>{t('teach.set.side')}</h2>
        <Checkbox
          checked={sideOn} disabled={sideLocked} onChange={(e) => setSide(e.target.checked)} data-testid="check-side"
          label={<span style={{ fontSize: 14 }}>{t('teach.set.side')}</span>}
        />
        <p className="hint">{t('teach.set.side_hint')}</p>
        {sideLocked && <HelperText>{t('teach.set.side_required')}</HelperText>}
      </Block>

      <Block>
        <h2>{t('teach.set.alt')}</h2>
        <Checkbox
          checked={altOn} disabled={altCount === 0} onChange={(e) => setUseAlt(e.target.checked)} data-testid="check-alt"
          label={<span style={{ fontSize: 14 }}>{t('teach.set.alt')}</span>}
        />
        <p className="hint">{altCount === 0 ? t('teach.set.alt_none') : t('teach.set.alt_hint', { n: altCount })}</p>
      </Block>

      <Advanced data-testid="advanced">
        <summary>{t('teach.set.advanced')}</summary>
        <p>{t('teach.set.advanced_body', { effort: t(effortLabelKey(effort)), steps: preset.max_steps, eval: preset.eval_every, lr: '2e-3' })}</p>
      </Advanced>

      {!!policy?.queue?.depth && (
        <Alert $tone="info" style={{ marginTop: 12 }} data-testid="queue-note">
          {t('teach.set.queue_rows', { n: policy.queue.depth, q: policy.queue.queued_rows ?? 0 })} {t('teach.set.queue_note')}
        </Alert>
      )}
      {/* finding 49 — the fast path skips the check, so say here what the worker will do with what it finds */}
      {!preflighted && (
        <Alert $tone="info" style={{ marginTop: 12 }} data-testid="unchecked-note">{t('teach.set.unchecked', { n: trained })}</Alert>
      )}
      {error && <Alert $tone="error" role="alert" style={{ marginTop: 12 }} data-testid="settings-error">{error}</Alert>}

      {picking && (
        <BasePicker candidates={candidates} value={base} onPick={(id) => setBase(id)} onClose={() => setPicking(false)} />
      )}

      <StickySpacer aria-hidden />
      <Sticky>
        <p data-testid="settings-summary">
          {t(preflighted ? 'teach.set.summary_short' : 'teach.set.summary_short_upto', {
            n: trained, effort: t(effortLabelKey(effort)),
            checks: sideOn ? t('teach.set.summary_checks_on') : t('teach.set.summary_checks_off'),
          })} · {timeText}
        </p>
        <Button variant="contained" size="large" onClick={() => void start()} loading={sending || resending} loadingText={t('teach.set.sending')} data-testid="train-lesson">
          {t(preflighted ? 'teach.set.train' : 'teach.set.train_upto', { n: trained })}
        </Button>
      </Sticky>
    </PageWrapper>
  );
}
