import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useCreateTeachJobMutation, useRetryTeachJobMutation, useTeachPreflightMutation } from '@/api/api';
import type { PreflightFact, PreflightResponse, TeachFactInput, TeachJob, TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Misc';
import type { Basket, Correction } from '@/lib/teachStore';
import { Sheet, SheetFooter, SheetNote } from './Sheet';
import { mapTeachError } from './teachUtil';

const List = styled.ol`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Row = styled.li<{ $tone: 'train' | 'skip' | 'bad' }>`
  padding: 10px 12px; border-radius: 4px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-left: 4px solid ${(p) => (p.$tone === 'train' ? p.theme.color.SUCCESS : p.$tone === 'skip' ? p.theme.color.GREY : p.theme.color.ERROR)};
  font-size: 13px; line-height: 1.5; background: #fff;
  .q { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  .a { color: ${(p) => p.theme.color.DARK_GREY}; b { color: ${(p) => p.theme.color.PRIMARY}; } }
  .s { margin-top: 4px; font-size: 12px; font-weight: 600; color: ${(p) => (p.$tone === 'train' ? p.theme.color.SUCCESS : p.$tone === 'skip' ? p.theme.color.GREY : p.theme.color.ERROR)}; }
  .m { margin-top: 2px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; white-space: pre-wrap; word-break: break-word; max-height: 72px; overflow: hidden; }
`;

const tone = (s: PreflightFact['status']) => (s === 'will_train' ? 'train' : s === 'invalid' ? 'bad' : 'skip');

/** §5.7 result list (pure). */
export function PreflightList({ facts, result }: { facts: Correction[]; result: PreflightResponse }) {
  const { t } = useT();
  const byIndex = new Map(result.facts.map((f) => [f.index, f]));
  return (
    <List data-testid="preflight-list">
      {facts.map((f, i) => {
        const r = byIndex.get(i);
        const status = r?.status ?? 'invalid';
        const label = status === 'will_train' ? t('teach.pre.will_train') : status === 'already_known' ? t('teach.pre.known') : status === 'overlaps_listing' ? t('teach.pre.overlap', { name: r?.detail ?? '' }) : t('teach.pre.invalid', { detail: r?.detail ?? '' });
        return (
          <Row key={f.id} $tone={tone(status)} data-status={status}>
            <div className="q">{i + 1}. {f.prompt}</div>
            <div className="a">{t('teach.basket.answer_label')}: <b>{f.answer}</b></div>
            <div className="s">{label}</div>
            {r?.base_answer !== undefined && <div className="m">{t('teach.pre.model_said', { answer: r.base_answer.trim() || t('teach.drawer.model_none') })}</div>}
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
  contributorName?: string;
  onQueued: (job: TeachJob) => void;
  onClose: () => void;
}

/** §5.7 — runs the pre-flight on open (≤ 30 s under a short model lock), then queues the trainable corrections. */
export function PreflightSheet({ patchIds, basket, policy, contributorName, onQueued, onClose }: PreflightSheetProps) {
  const { t } = useT();
  const [preflight, { data, error, isLoading }] = useTeachPreflightMutation();
  const [createJob, { isLoading: queueing }] = useCreateTeachJobMutation();
  const [retryJob, { isLoading: retrying }] = useRetryTeachJobMutation();
  const [queueError, setQueueError] = useState<string | null>(null);
  const started = useRef(false);
  const inputFacts: TeachFactInput[] = basket.facts.map((f) => ({ prompt: f.prompt, answer: f.answer, ...(f.alt_prompt ? { alt_prompt: f.alt_prompt } : {}) }));

  const run = () => { void preflight({ patch_ids: patchIds, facts: inputFacts }); };
  useEffect(() => { if (!started.current) { started.current = true; run(); } });   // eslint-disable-line react-hooks/exhaustive-deps

  const trainable = (data?.facts ?? []).filter((f) => f.status === 'will_train');
  const queue = async () => {
    if (!data || trainable.length === 0) return;
    setQueueError(null);
    const facts: TeachFactInput[] = trainable.map((r) => ({ ...inputFacts[r.index], ...(r.base_answer !== undefined ? { base_answer: r.base_answer.slice(0, 4000) } : {}) }));
    try {
      const res = basket.retry_of
        ? await retryJob({ id: basket.retry_of, facts }).unwrap()
        : await createJob({ patch_ids: patchIds, builds_on_context: basket.builds_on && patchIds.length > 0, facts, contributor: contributorName ? { name: contributorName } : {} }).unwrap();
      onQueued(res.job);
    } catch (e) { setQueueError(mapTeachError(e, t)); }
  };

  return (
    <Sheet title={t('teach.pre.title')} sub={t('teach.pre.running')} onClose={onClose} width={620} testId="preflight-sheet">
      {isLoading && <Spinner label={t('teach.pre.title')} />}
      {!!error && <Alert $tone="error" role="alert">{mapTeachError(error, t, { stage: 'preflight' })} <Button size="small" onClick={run} style={{ marginLeft: 8 }}>{t('teach.pre.retry')}</Button></Alert>}
      {data && <PreflightList facts={basket.facts} result={data} />}
      {data && trainable.length === 0 && <Alert $tone="info" role="status" data-testid="preflight-none">{t('teach.pre.none')}</Alert>}
      {queueError && <Alert $tone="error" role="alert">{queueError}</Alert>}
      {data && (
        <SheetFooter>
          <SheetNote style={{ marginRight: 'auto' }} data-testid="preflight-quota">{t('teach.pre.quota', { n: data.quota.key_remaining, limit: policy.limits.jobs_per_key_per_day })}</SheetNote>
          <Button variant="contained" onClick={() => { void queue(); }} disabled={trainable.length === 0 || data.quota.key_remaining <= 0} loading={queueing || retrying} loadingText={t('teach.pre.queueing')} data-testid="queue-training">
            {t('teach.pre.queue', { k: trainable.length })}
          </Button>
        </SheetFooter>
      )}
    </Sheet>
  );
}
