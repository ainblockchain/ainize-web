import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import styled from 'styled-components';
import {
  useCatalogQuery, usePatchTeachDatasetMutation, useReparseTeachDatasetMutation, useTeachDatasetQuery, useTeachDatasetRowsQuery,
  useTeachPolicyQuery, useTeachPreflightMutation,
} from '@/api/api';
import type { DatasetRowInput, PreflightFact, TeachDatasetRow } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, PageWrapper, Title, TitleRow } from '@/components/ui/Misc';
import { isQuotaError, mapTeachError } from '@/components/chat/teachUtil';
import { DatasetTable } from '@/components/teach/DatasetTable';
import { ReparseSheet } from '@/components/teach/ReparseSheet';
import { RowEditSheet } from '@/components/teach/RowEditSheet';
import { Stepper } from '@/components/teach/Stepper';
import { rowsPerJob, sourceLabel } from '@/components/teach/util';
import { saveKnown, saveSelection, shortSha, signedDownload } from '@/lib/teachDataset';

/**
 * `/teach/dataset/:dsId` — step 2 (design §5.4): the preview, the per-question validation and the live pre-flight.
 *
 * Two rules drive the whole screen. Nothing was silently dropped, so every source line that did not become a question
 * is counted here and inspectable; and the model-side status of a question is cleared the moment its text changes —
 * a green "already known" tick next to text the visitor just edited would be a lie.
 */
const PAGE = 50;

const Bar = styled.div`display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin: 12px 0 0; font-size: 13px;`;
const Pills = styled.p`
  margin: 12px 0 0; padding: 10px 12px; border-radius: 6px; background: ${(p) => p.theme.color.PALE_GREY};
  font-size: 13px; color: ${(p) => p.theme.color.DARK_GREY}; line-height: 1.6;
`;
const Note = styled.p`margin: 8px 0 0; font-size: 12.5px; line-height: 1.55; color: ${(p) => p.theme.color.GREY};`;
const Actions = styled.div`display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 18px 0;`;
const Pager = styled.div`
  display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 10px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
`;
const Dropped = styled.details`
  margin-top: 12px; font-size: 12.5px; color: ${(p) => p.theme.color.GREY};
  summary { cursor: pointer; }
  li { margin: 6px 0; word-break: break-word; }
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 11.5px; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
const Toast = styled.div`
  position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 60; display: flex; gap: 12px; align-items: center;
  padding: 10px 16px; border-radius: 24px; background: ${(p) => p.theme.color.BLACK}; color: #fff; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);
  max-width: calc(100vw - 32px);
  button { background: none; border: 0; color: ${(p) => p.theme.color.TERTIARY}; font: inherit; font-weight: 700; cursor: pointer; }
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
/**
 * Finding 53 — the bar is `position: sticky; bottom: 0` and nothing reserved room for it, so about one table row was
 * permanently underneath it at every scroll position, faded rather than hidden (which reads as disabled) with its
 * Edit / Remove buttons unreachable. It is opaque with a shadow above it now, and the page reserves its height.
 */
const Sticky = styled.div`
  position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end;
  padding: 12px 0; margin-top: 8px; background: #fff; box-shadow: 0 -6px 12px -6px rgba(48, 49, 51, 0.25);
`;
/** The room the sticky bar occupies, so the last row of the table can always be scrolled clear of it. */
const StickySpacer = styled.div`height: 72px; @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { height: 96px; }`;

export default function TeachDatasetPage() {
  const { dsId = '' } = useParams<{ dsId: string }>();
  const { t } = useT();
  useTitle(t('teach.rows.title'));
  const navigate = useNavigate();
  const { search } = useLocation();          // a re-train carries `?retrain=<job>&effort=…` through to the settings screen
  const { data: policy } = useTeachPolicyQuery();
  const { data: dsData, isLoading, error: loadError } = useTeachDatasetQuery(dsId, { skip: !dsId });
  const [offset, setOffset] = useState(0);
  const [origin, setOrigin] = useState<'all' | 'mine' | 'inherited' | 'changed' | 'conflicts'>('all');
  const { data: page } = useTeachDatasetRowsQuery({ id: dsId, offset, limit: PAGE, origin }, { skip: !dsId });
  const { data: catalog } = useCatalogQuery({ limit: 200 }, { skip: !dsData?.dataset?.parent_patch });
  const [patch, { isLoading: patching }] = usePatchTeachDatasetMutation();
  const [reparse, { isLoading: reparsing }] = useReparseTeachDatasetMutation();
  const [preflight, { isLoading: checking }] = useTeachPreflightMutation();

  const [flight, setFlight] = useState<Record<number, PreflightFact>>({});
  /**
   * Finding 47 — how far through the dataset the live check has got. It used to be a per-pass `{checked, of}` reset
   * on every click, which is why pressing the button twice re-measured the same head and reported the same 24: the
   * screen now remembers the frontier and the second button resumes from it.
   */
  const [checked, setChecked] = useState(0);
  const [partial, setPartial] = useState(false);
  const [editing, setEditing] = useState<TeachDatasetRow | 'new' | null>(null);
  const [reparseOpen, setReparseOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ row: DatasetRowInput; label: string } | null>(null);
  /** a refused row that was dropped: it has nothing to put back, so it gets a plain line rather than an Undo toast */
  const [note, setNote] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dataset = dsData?.dataset;
  const summary = page?.summary ?? dataset?.summary;
  const rows = useMemo(() => page?.items ?? [], [page]);
  const cap = rowsPerJob(policy);
  /** finding 47 — the check's sample size and per-call batch, as this node reports them */
  const sampleRows = policy?.limits?.preflight_rows ?? 24;
  const perCall = policy?.limits?.preflight_per_call ?? 8;
  const overCap = !!dataset && dataset.rows > cap;
  const limits = policy?.limits;
  /**
   * This node answers the pre-flight itself instead of asking a serving model (stub backend, no model server). The
   * check is the evidence the visitor keeps or drops questions on, so every sentence about it says it was simulated
   * — before the button is pressed, in the result line, and on every quoted answer.
   */
  const simulated = policy?.simulated_checks === true;

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);
  // a fresh revision (edit / reparse) invalidates every model-side answer that was measured against the old text
  const revision = dataset?.revision;
  // …and every question index it was measured against: a replaced or removed question renumbers the file.
  useEffect(() => { setFlight({}); setChecked(0); setPartial(false); setSelected(new Set()); }, [revision]);

  const toast = (row: DatasetRowInput, label: string) => {
    setUndo({ row, label });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 8000);
  };

  const run = useCallback(async (fn: () => Promise<unknown>, ctx: { stage?: 'preflight' | 'remove' } = {}) => {
    setError(null);
    try { await fn(); } catch (e) { setError(mapTeachError(e, t, ctx)); }
  }, [t]);

  /**
   * Finding 48 — the rows that need fixing were the only rows that could not be removed: `onRemove` was gated on
   * `row.index !== null`, and a refused row (a contradiction, a missing answer, an unreadable line) has no index in
   * the stored questions. It has a source LINE, which the report carries and the node can now drop by
   * (`rows_op.drop_rejected`) — so Remove is offered on every row, and a contradiction reads as one either/or
   * choice. Only an accepted row can be undone: a refused one was never in the questions to put back.
   */
  const removeRow = (row: TeachDatasetRow) => {
    if (row.index === null) {
      void run(async () => {
        await patch({ id: dsId, rows_op: { op: 'drop_rejected', lines: [row.line] } }).unwrap();
        setFlight({});
        setUndo(null);
        setNote(t('teach.rows.removed_line', { line: row.line }));
      }, { stage: 'remove' });
      return;
    }
    const copy: DatasetRowInput = { prompt: row.prompt ?? '', answer: row.answer ?? '', ...(row.alt_prompt ? { alt_prompt: row.alt_prompt } : {}) };
    void run(async () => {
      await patch({ id: dsId, rows_op: { op: 'remove', indexes: [row.index as number] } }).unwrap();
      setFlight({});
      toast(copy, t('teach.rows.removed', { q: (row.prompt ?? '').slice(0, 40) }));
    }, { stage: 'remove' });
  };

  const saveRow = (input: DatasetRowInput) => {
    const target = editing;
    void run(async () => {
      if (target && target !== 'new' && target.index !== null) await patch({ id: dsId, rows_op: { op: 'replace', index: target.index, row: input } }).unwrap();
      else await patch({ id: dsId, rows_op: { op: 'append', rows: [input] } }).unwrap();
      setEditing(null);
      setFlight({});
    });
  };

  /**
   * Run the v1 pre-flight over a deterministic head of the dataset, in the node's own per-call batches.
   *
   * The pre-flight spends the same hourly free-try budget as the live test, so a big dataset can run out halfway. That
   * is not an error the visitor caused: the batches that DID land are kept, `sampled` says how far it got, and the
   * partial note explains it — losing 16 measured answers to a red box would be the worse outcome.
   */
  const check = (from = 0) => void run(async () => {
    const total = dataset?.rows ?? 0;
    const want = Math.min(from + sampleRows, total);
    const next: Record<number, PreflightFact> = { ...flight };
    let done = 0;
    let ranOut = false;
    for (let at = from; at < want; at += perCall) {
      try {
        const out = await preflight({ patch_ids: [], dataset_id: dsId, offset: at, limit: perCall }).unwrap();
        for (const f of out.facts) next[at + f.index] = f;
        done += out.facts.length;
        setFlight({ ...next });
        if (out.facts.length < perCall) break;   // the node ran out of rows before this window did
      } catch (e) {
        if (done && isQuotaError(e)) { ranOut = true; break; }
        throw e;
      }
    }
    setPartial(ranOut);
    // what has been measured overall, not just in this pass: "Checked 24 of 40" must become "48 of 40"… never
    setChecked((prev) => Math.min(total, Math.max(prev, from + done)));
  }, { stage: 'preflight' });

  const toggle = (index: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index);
    else if (next.size < cap) next.add(index);
    return next;
  });
  /** finding 52 — the whole page at once, up to the node's cap, instead of one click per question */
  const toggleAll = (on: boolean) => setSelected((prev) => {
    const next = new Set(prev);
    for (const r of rows) {
      if (r.index === null) continue;
      if (!on) next.delete(r.index);
      else if (next.size < cap) next.add(r.index);
    }
    return next;
  });
  /**
   * Finding 52 — opening the picker starts from the selection the node would have made (the first `cap` accepted
   * questions of this page's set), so the counter starts full and the visitor edits a real default instead of
   * building one from zero. Closing it goes back to that default.
   */
  const togglePicking = () => setPicking((on) => {
    if (on) { setSelected(new Set()); return false; }
    setSelected(new Set(rows.filter((r) => r.index !== null).map((r) => r.index as number).slice(0, cap)));
    return true;
  });

  /** "Keep this answer" on a contradictory question: the excluded copy is put back as the one to learn. */
  const keepAnswer = (row: TeachDatasetRow) => void run(() => patch({
    id: dsId,
    rows_op: { op: 'append', rows: [{ prompt: row.prompt ?? '', answer: row.answer ?? '', ...(row.alt_prompt ? { alt_prompt: row.alt_prompt } : {}) }] },
  }).unwrap());

  const goSettings = () => {
    saveSelection(dsId, picking && selected.size ? [...selected].sort((a, b) => a - b) : null);
    // What the pre-flight measured travels with the visitor: the settings screen must not promise to train a question
    // the worker is about to drop as already known, and the lesson has to record the ones it left out (design §5.5).
    saveKnown(dsId, revision ?? 1, Object.entries(flight)
      .filter(([, f]) => f.status === 'already_known')
      .map(([index, f]) => ({ index: Number(index), base_answer: f.base_answer ?? '' })), checked);
    navigate(`/teach/dataset/${dsId}/settings${search}`);
  };

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (loadError || !dataset) {
    return (
      <PageWrapper data-testid="teach-dataset">
        <Stepper current={2} />
        <Alert $tone="error" role="alert" style={{ marginTop: 16 }}>{loadError ? mapTeachError(loadError, t) : t('teach.err.dataset_not_found')}</Alert>
      </PageWrapper>
    );
  }

  const known = Object.values(flight).filter((f) => f.status === 'already_known').length;
  const willTrain = Object.values(flight).filter((f) => f.status === 'will_train').length;
  const bad = (summary?.conflicts ?? 0) + (summary?.too_long ?? 0) + (summary?.empty ?? 0) + (summary?.blocked ?? 0) + (summary?.not_parsed ?? 0);
  /** questions this dataset could teach at all; the lesson takes at most `cap` of them (finding 46) */
  const trainable = Math.max(0, dataset.rows - known);
  const origins = page?.origins ?? { mine: dataset.rows, inherited: 0, changed: 0, conflicts: summary?.conflicts ?? 0 };
  const inherited = origins.inherited + origins.changed;
  // "from {name}", not "from taught-krx-9f21": the id is the address, the name is what the creator recognises
  const baseName = catalog?.items.find((e) => e.anchor.id === dataset.parent_patch)?.anchor.name ?? dataset.parent_patch ?? '';
  const parsedRows = rows.filter((r) => r.status !== 'not_parsed');
  const droppedRows = rows.filter((r) => r.status === 'not_parsed');
  const total = page?.total ?? rows.length;
  const filename = dataset.source_name ?? `${dataset.name}.jsonl`;

  return (
    <PageWrapper $wide data-testid="teach-dataset">
      <Stepper current={2} />
      <TitleRow style={{ paddingTop: 16 }}><Title>{t('teach.rows.title')}</Title></TitleRow>
      {/* a set forked out of someone else's knowledge is `derived`, whose label reads "a lesson you already trained" —
          which is a claim about this visitor's own history that a copy of a stranger's questions cannot make. */}
      <Description>{t('teach.rows.sub', {
        n: dataset.rows,
        source: dataset.parent_patch ? t('teach.rows.source_copied', { name: baseName }) : sourceLabel(dataset.source, dataset.source === 'chat' ? filename : dataset.source_name, t),
      })}</Description>
      <Bar>
        <span>{t('teach.data.fingerprint', { short: shortSha(dataset.sha256) })}</span>
        {/* after an edit the stored questions are no longer the bytes the visitor uploaded — naming their file here
            (and numbering the rows as its lines) would be a claim about a file that no longer matches. */}
        <span data-testid="saved-note">{dataset.revision > 1 ? t('teach.rows.saved_note_edited') : t('teach.rows.saved_note', { filename })}</span>
      </Bar>

      {/*
        dataset-wide, always: a check that sampled 24 of 40 must not silently restate "40 will train" as "24".
        Finding 46 — but it must not promise 2,000 either: `rows_per_job` is what one lesson teaches, and the pill
        used to print the whole dataset one line above the banner saying only 200 of them are in this lesson. Both
        numbers, in the biggest and greenest sentence on the screen, so they cannot disagree.
      */}
      <Pills data-testid="row-counts">
        {trainable > cap
          ? t('teach.rows.counts_capped', { cap, train: trainable, rest: trainable - cap, known, dupe: summary?.duplicates ?? 0, bad })
          : t('teach.rows.counts', { train: trainable, known, dupe: summary?.duplicates ?? 0, bad })}
      </Pills>
      {!!summary?.fixed && <Note data-testid="fixed-note">{t('teach.rows.fixed', { n: summary.fixed })}</Note>}
      {/* item 5: an edit rewrites the set from its accepted rows, so the refused ones are carried and still counted —
          the table shows them, and this line says why numbers that look like "the current file" are not only that. */}
      {!!summary?.carried && <Note data-testid="carried-note">{t('teach.rows.carried_summary', { n: summary.carried })}</Note>}
      {/*
        item 15: a file that fell back to latin1 (or to any non-UTF-8 decoder) is the single most likely reason the
        questions below are mojibake, and it used to be a grey footnote sitting under a green "8 will train" pill.
      */}
      {!!dataset.encoding && dataset.encoding !== 'utf-8' && (
        dataset.encoding === 'latin1'
          ? <Alert $tone="warning" style={{ marginTop: 10 }} data-testid="encoding-note">{t('teach.rows.encoding_warn', { encoding: dataset.encoding })}</Alert>
          : <Note data-testid="encoding-note">{t('teach.up.encoding', { encoding: dataset.encoding })}</Note>
      )}
      {!!summary?.over_cap && <Note data-testid="over-cap-note">{t('teach.up.err_many', { n: (summary.accepted ?? 0) + summary.over_cap, max: policy?.limits?.dataset_max_rows ?? dataset.rows })}</Note>}
      {checked > 0 && (
        <Note data-testid="checked-note">
          {partial ? t(simulated ? 'teach.rows.checked_partial_sim' : 'teach.rows.checked_partial', { k: checked })
            : checked < dataset.rows ? t(simulated ? 'teach.rows.checked_sample_sim' : 'teach.rows.checked_sample', { k: checked, n: dataset.rows })
              : t(simulated ? 'teach.rows.checked_sim' : 'teach.rows.checked', { train: willTrain, n: dataset.rows })}
        </Note>
      )}
      {checked > 0 && willTrain === 0 && known > 0 && <Alert $tone="warning" style={{ marginTop: 10 }}>{t('teach.rows.none')}</Alert>}

      {/*
        Finding 52 — this banner used to concatenate two contradictory selection states: "The first 200 are
        selected; the rest stay in your dataset" immediately followed by "0 of 200 selected". Only one of them is
        ever true, so only one is ever shown — and turning the picker on now STARTS from the default first 200
        instead of from nothing, because an empty picker made the escape hatch cost 200 clicks and everyone took
        whatever arbitrary head the node picked.
      */}
      {overCap && (
        <Alert $tone="info" style={{ marginTop: 12 }} data-testid="cap-banner">
          {picking
            ? <span data-testid="cap-selected">{t('teach.rows.cap_selected', { n: selected.size, max: cap })} · {t('teach.rows.cap_rest', { rest: Math.max(0, dataset.rows - selected.size) })}</span>
            : t('teach.rows.cap', { max: cap })}{' '}
          <Button size="small" onClick={togglePicking} data-testid="cap-pick">{t(picking ? 'teach.rows.cap_default' : 'teach.rows.cap_pick', { max: cap })}</Button>
        </Alert>
      )}

      {error && <Alert $tone="error" role="alert" style={{ marginTop: 12 }} data-testid="dataset-error">{error}</Alert>}
      {note && <Alert $tone="success" role="status" style={{ marginTop: 12 }} data-testid="dataset-note">{note}</Alert>}

      {simulated && (
        <Alert $tone="warning" style={{ marginTop: 12 }} data-testid="checks-simulated">{t('teach.card.simulated')}</Alert>
      )}

      <Actions>
        {/*
          Finding 47 — a full-width primary button reading "Check what the model already knows" that measured the
          first 24 of a 40-row file and said so only in the result note. It names the sample it will take, and once
          it has taken one there is a second button that resumes from where it stopped instead of re-asking the
          same head. Both numbers come from the node (`limits.preflight_rows`), never from a literal.
        */}
        <Button variant="contained" onClick={() => check(0)} loading={checking} data-testid="run-check">
          {checking ? t(simulated ? 'teach.rows.checking_sim' : 'teach.rows.checking')
            : dataset.rows > sampleRows ? t(simulated ? 'teach.rows.check_first_sim' : 'teach.rows.check_first', { n: sampleRows })
              : t(simulated ? 'teach.rows.check_sim' : 'teach.rows.check')}
        </Button>
        {checked > 0 && checked < dataset.rows && !partial && (
          <Button onClick={() => check(checked)} loading={checking} data-testid="run-check-next">
            {t('teach.rows.check_next', { n: Math.min(sampleRows, dataset.rows - checked) })}
          </Button>
        )}
        <Button onClick={() => setEditing('new')} disabled={patching} data-testid="add-row">{t('teach.rows.add')}</Button>
        <Button onClick={() => void run(() => signedDownload(`/api/teach/datasets/${dsId}/download`, filename))} data-testid="download-dataset">{t('teach.rows.download')}</Button>
        {dataset.status === 'staged' && <Button color="secondary" onClick={() => setReparseOpen(true)} data-testid="open-reparse">{t('teach.rows.reparse')}</Button>}
      </Actions>

      {/*
        SC-5 — a set copied from someone else's knowledge is two things at once: their questions and mine. The chips
        count the WHOLE set (the node counts them, not this page), and the summary line is the sentence the publish
        sheet will repeat: adds x, changes y, keeps z of theirs.
      */}
      {inherited > 0 && (
        <>
          {/* two sentences from §4, and neither ends in a full stop: run together they read
              "…keeps 3 from X Inherited questions are trained again…" */}
          <Pills data-testid="inherit-summary">
            <span>{t('teach.rows.summary_inherit', { x: origins.mine, y: origins.changed, z: origins.inherited, name: baseName })}</span>
            <span style={{ display: 'block', marginTop: 4 }}>{t('teach.rows.inherited_note')}</span>
          </Pills>
          <Bar data-testid="origin-filters">
            {([['all', t('teach.rows.f_all')], ['mine', t('teach.rows.f_mine', { n: origins.mine })], ['inherited', t('teach.rows.f_inherited', { n: origins.inherited })],
              ['changed', t('teach.rows.f_changed', { n: origins.changed })], ['conflicts', t('teach.rows.f_conflicts', { n: origins.conflicts })]] as const).map(([key, label]) => (
                <Button
                  key={key} size="small" variant={origin === key ? 'contained' : 'outlined'}
                  onClick={() => { setOrigin(key); setOffset(0); }} data-testid={`origin-${key}`}
                >{label}</Button>
              ))}
          </Bar>
        </>
      )}

      <DatasetTable
        rows={parsedRows} limits={limits} preflight={flight} busy={patching} positions={dataset.revision > 1} simulated={simulated} baseName={baseName}
        selectable={picking} selected={selected} onToggle={toggle} onToggleAll={toggleAll}
        onEdit={(r) => setEditing(r)} onRemove={removeRow}
        onKeep={keepAnswer}
      />

      {total > PAGE && (
        <Pager>
          <Button size="small" onClick={() => setOffset(Math.max(0, offset - PAGE))} disabled={offset === 0}>{t('teach.rows.page_prev')}</Button>
          <span>{t('teach.rows.page', { from: offset + 1, to: Math.min(offset + PAGE, total), n: total })}</span>
          <Button size="small" onClick={() => setOffset(offset + PAGE)} disabled={offset + PAGE >= total}>{t('teach.rows.page_next')}</Button>
        </Pager>
      )}

      {!!summary?.not_parsed && (
        <Dropped data-testid="dropped">
          <summary>{t('teach.rows.dropped', { n: summary.not_parsed })} — {t('teach.rows.dropped_show')}</summary>
          <ul>
            {droppedRows.map((r) => <li key={`d${r.line}`}>{t('teach.rows.bad.parse', { line: r.line })} <code>{r.raw ?? ''}</code></li>)}
          </ul>
        </Dropped>
      )}

      <StickySpacer aria-hidden />
      <Sticky>
        <Button variant="contained" onClick={goSettings} disabled={dataset.rows === 0} data-testid="to-settings">{t('teach.rows.next')}</Button>
      </Sticky>

      {editing && (
        <RowEditSheet
          row={editing === 'new' ? undefined : editing} limits={limits} saving={patching}
          onSave={saveRow} onClose={() => setEditing(null)}
        />
      )}
      {reparseOpen && (
        <ReparseSheet
          dataset={dataset} saving={reparsing} onClose={() => setReparseOpen(false)}
          onApply={(opts) => void run(async () => { await reparse({ id: dsId, ...opts }).unwrap(); setReparseOpen(false); setFlight({}); })}
        />
      )}
      {undo && (
        <Toast role="status" data-testid="undo-toast">
          <span>{undo.label}</span>
          <button type="button" onClick={() => { const r = undo.row; setUndo(null); void run(() => patch({ id: dsId, rows_op: { op: 'append', rows: [r] } }).unwrap()); }} data-testid="undo">{t('teach.rows.undo')}</button>
        </Toast>
      )}
    </PageWrapper>
  );
}
