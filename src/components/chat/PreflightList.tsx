import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useCreateTeachJobMutation, useRetryTeachJobMutation, useTeachPreflightMutation } from '@/api/api';
import type { PreflightFact, PreflightResponse, TeachFactInput, TeachJob, TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Misc';
import type { Basket, Correction } from '@/lib/teachStore';
import { baseBlocked, type BaseCandidate } from './BasePicker';
import { Sheet, SheetFooter, SheetNote } from './Sheet';
import { effectiveBase, mapTeachError } from './teachUtil';

const List = styled.ol`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Row = styled.li<{ $tone: 'train' | 'skip' | 'bad' }>`
  padding: 10px 12px; border-radius: 4px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-left: 4px solid ${(p) => (p.$tone === 'train' ? p.theme.color.SUCCESS : p.$tone === 'skip' ? p.theme.color.GREY : p.theme.color.ERROR)};
  font-size: 13px; line-height: 1.5; background: #fff;
  .q { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  .a { color: ${(p) => p.theme.color.DARK_GREY}; b { color: ${(p) => p.theme.color.PRIMARY}; } }
  .s { margin-top: 4px; font-size: 12px; font-weight: 600; color: ${(p) => (p.$tone === 'train' ? p.theme.color.SUCCESS : p.$tone === 'skip' ? p.theme.color.GREY : p.theme.color.ERROR)}; }
  .m { margin-top: 2px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; white-space: pre-wrap; word-break: break-word; max-height: 72px; overflow: hidden; }
`;

const tone = (s: PreflightFact['status']) => (s === 'will_train' || s === 'base_conflict' ? 'train' : s === 'invalid' ? 'bad' : 'skip');

/** §5.7 result list (pure). SC-6 adds the two verdicts a base makes possible: it already answers this, or it answers it differently. */
export function PreflightList({ facts, result, baseName }: { facts: Correction[]; result: PreflightResponse; baseName?: string }) {
  const { t } = useT();
  const byIndex = new Map(result.facts.map((f) => [f.index, f]));
  return (
    <List data-testid="preflight-list">
      {facts.map((f, i) => {
        const r = byIndex.get(i);
        const status = r?.status ?? 'invalid';
        const who = baseName ?? r?.base_id ?? '';
        const label = status === 'will_train' ? t('teach.pre.will_train')
          : status === 'in_base' ? t('teach.pre.in_base', { name: who })
            : status === 'base_conflict' ? t('teach.pre.base_conflict', { name: who, answer: (r?.base_answer ?? '').slice(0, 120) })
              : status === 'already_known' ? t('teach.pre.known') : status === 'overlaps_listing' ? t('teach.pre.overlap', { name: r?.detail ?? '' }) : t('teach.pre.invalid', { detail: r?.detail ?? '' });
        return (
          <Row key={f.id} $tone={tone(status)} data-status={status}>
            <div className="q">{i + 1}. {f.prompt}</div>
            <div className="a">{t('teach.basket.answer_label')}: <b>{f.answer}</b></div>
            <div className="s">{label}</div>
            {r?.base_answer !== undefined && status !== 'base_conflict' && <div className="m">{t('teach.pre.model_said', { answer: r.base_answer.trim() || t('teach.drawer.model_none') })}</div>}
          </Row>
        );
      })}
    </List>
  );
}

export interface PreflightSheetProps {
  patchIds: string[];
  basket: Basket;
  policy: TeachPolicy;
  /** SC-1/SC-3: what the lesson could be built on; the chosen one is loaded for the probe and recorded as the base */
  baseCandidates?: BaseCandidate[];
  onBasket?: (fn: (b: Basket) => Basket) => void;
  contributorName?: string;
  /** finding 38 — the corrections this queue did NOT take, so the caller can leave them in the basket */
  onQueued: (job: TeachJob, left: { id: string; status: PreflightFact['status'] }[]) => void;
  onClose: () => void;
}

/** §5.7 — runs the pre-flight on open (≤ 30 s under a short model lock), then queues the trainable corrections. */
export function PreflightSheet({ patchIds, basket, policy, baseCandidates = [], onBasket, contributorName, onQueued, onClose }: PreflightSheetProps) {
  const { t } = useT();
  const [preflight, { data, error, isLoading }] = useTeachPreflightMutation();
  const [createJob, { isLoading: queueing }] = useCreateTeachJobMutation();
  const [retryJob, { isLoading: retrying }] = useRetryTeachJobMutation();
  const [queueError, setQueueError] = useState<string | null>(null);
  const started = useRef(false);
  const inputFacts: TeachFactInput[] = basket.facts.map((f) => ({ prompt: f.prompt, answer: f.answer, ...(f.alt_prompt ? { alt_prompt: f.alt_prompt } : {}) }));

  // SC-1: the probe runs with the BASE loaded and everything else as comparison — the same split the job records
  const marked = baseCandidates.map((c) => ({ ...c, blocked: !!baseBlocked(c, t) }));
  const base = policy.lineage ? effectiveBase(basket.base, marked) : null;
  const baseName = marked.find((c) => c.id === base)?.name;
  const contextIds = patchIds.filter((id) => id !== base);
  const run = () => { void preflight({ patch_ids: patchIds, ...(base ? { base_ids: [base], context_ids: contextIds } : {}), facts: inputFacts }); };
  useEffect(() => { if (!started.current) { started.current = true; run(); } });   // eslint-disable-line react-hooks/exhaustive-deps

  // a row the base answers differently is trainable — as a CHANGE to it — and only once the visitor says so (§12.1)
  const conflicts = (data?.facts ?? []).filter((f) => f.status === 'base_conflict');
  const trainable = (data?.facts ?? []).filter((f) => f.status === 'will_train' || f.status === 'base_conflict');
  const needsConfirm = conflicts.length > 0 && !basket.confirm_conflicts;
  const queue = async () => {
    if (!data || trainable.length === 0 || needsConfirm) return;
    setQueueError(null);
    const facts: TeachFactInput[] = trainable.map((r) => ({ ...inputFacts[r.index], ...(r.status === 'will_train' && r.base_answer !== undefined ? { base_answer: r.base_answer.slice(0, 4000) } : {}) }));
    try {
      const res = basket.retry_of
        ? await retryJob({ id: basket.retry_of, facts }).unwrap()
        : await createJob({
          patch_ids: patchIds, builds_on_context: !base && basket.builds_on && patchIds.length > 0, facts,
          ...(base ? { base_ids: [base], context_ids: contextIds, mode: 'extend' as const, ...(conflicts.length ? { confirm_conflicts: true } : {}) } : {}),
          contributor: contributorName ? { name: contributorName } : {},
        }).unwrap();
      // finding 38 — everything the pre-flight refused (already known, overlapping, invalid, answered by the base)
      const trained = new Set(trainable.map((r) => r.index));
      const byIndex = new Map((data.facts ?? []).map((f) => [f.index, f]));
      const left = basket.facts
        .map((f, i) => ({ id: f.id, status: byIndex.get(i)?.status ?? ('invalid' as PreflightFact['status']), index: i }))
        .filter((x) => !trained.has(x.index))
        .map(({ id, status }) => ({ id, status }));
      onQueued(res.job, left);
    } catch (e) { setQueueError(mapTeachError(e, t)); }
  };

  return (
    <Sheet title={t('teach.pre.title')} sub={t('teach.pre.running')} onClose={onClose} width={620} testId="preflight-sheet">
      {isLoading && <Spinner label={t('teach.pre.title')} />}
      {!!error && <Alert $tone="error" role="alert">{mapTeachError(error, t, { stage: 'preflight' })} <Button size="small" onClick={run} style={{ marginLeft: 8 }}>{t('teach.pre.retry')}</Button></Alert>}
      {data && <PreflightList facts={basket.facts} result={data} baseName={baseName} />}
      {data && conflicts.length > 0 && (
        <Alert $tone="warning" style={{ marginTop: 10 }} data-testid="preflight-conflicts">
          <Checkbox
            checked={!!basket.confirm_conflicts} onChange={(e) => onBasket?.((b) => ({ ...b, confirm_conflicts: e.target.checked }))}
            data-testid="confirm-changes"
            label={<span style={{ fontSize: 13 }}>{t('teach.pre.confirm_changes', { name: baseName ?? base ?? '', n: conflicts.length })}</span>}
          />
        </Alert>
      )}
      {data && trainable.length === 0 && <Alert $tone="info" role="status" data-testid="preflight-none">{t('teach.pre.none')}</Alert>}
      {data && needsConfirm && <SheetNote data-testid="confirm-needed">{t('teach.pre.confirm_needed', { name: baseName ?? base ?? '', n: conflicts.length })}</SheetNote>}
      {queueError && <Alert $tone="error" role="alert">{queueError}</Alert>}
      {data && (
        <SheetFooter>
          <SheetNote style={{ marginRight: 'auto' }} data-testid="preflight-quota">{t('teach.pre.quota', { n: data.quota.key_remaining, limit: policy.limits.jobs_per_key_per_day })}</SheetNote>
          <Button variant="contained" onClick={() => { void queue(); }} disabled={trainable.length === 0 || needsConfirm || data.quota.key_remaining <= 0} loading={queueing || retrying} loadingText={t('teach.pre.queueing')} data-testid="queue-training">
            {t('teach.pre.queue', { k: trainable.length }, trainable.length)}
          </Button>
        </SheetFooter>
      )}
    </Sheet>
  );
}
