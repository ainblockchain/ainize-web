/**
 * Lessons that are running RIGHT NOW, all of them, under one teaching identity.
 *
 * Nothing showed this. `/teach/mine` lists datasets and folds each dataset's lessons underneath it, which is the
 * right shape for "what have I taught" and the wrong one for "what is happening": several lessons trained in
 * parallel under one key appear as unrelated rows inside unrelated cards, none of them refreshing, so the only way
 * to watch a run was to reload the page and read a status word. On this model a lesson takes hours, which is
 * exactly when a person wants to look.
 *
 * TWO RULES THIS PANEL KEEPS.
 *
 * **The bar is the real step count, or it is not a bar.** `progress.percent` is stage-weighted and monotonic and
 * the type that carries it says in as many words that no surface may present it as a time estimate. During `load`
 * and `baseline` there IS no step — and on a large lesson that is most of the run — so this shows an indeterminate
 * rail with the phase named and the clock running, rather than a number that would be invented.
 *
 * **A phase is named for what it is doing.** `baseline` is "asking your questions before training", which is the
 * honest description of a stretch that took 77 of one 200-question lesson's first 83 minutes and used to be
 * reported as "loading".
 */
import { useMemo } from 'react';
import styled, { keyframes } from 'styled-components';
import { Link } from 'react-router';
import { useT } from '@/i18n';
import { useSince, useTicker } from '@/components/chat/util';
import type { TeachJob } from '@/api/types';

/** Statuses that mean "this lesson is still going", so the panel polls and the clock ticks. */
export const ACTIVE_TEACH = new Set(['QUEUED', 'PREFLIGHT', 'LOADING', 'TRAINING', 'EXPORTED', 'CHECKING']);
export const isActiveTeach = (j: TeachJob) => ACTIVE_TEACH.has(j.status);

const Wrap = styled.section`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; padding: 14px 16px; margin-top: 16px;
  background: #fff;
`;
const Head = styled.div`display: flex; align-items: baseline; gap: 10px; margin-bottom: 10px;`;
const H = styled.h2`font-size: 15px; margin: 0;`;
const Sub = styled.span`font-size: 12.5px; color: ${(p) => p.theme.color.GREY};`;
const Rows = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px;`;
const Row = styled.li`display: flex; flex-direction: column; gap: 5px;`;
const Line = styled.div`
  display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; font-size: 13.5px;
  b { font-weight: 600; }
  span { color: ${(p) => p.theme.color.GREY}; font-size: 12.5px; }
  a { margin-left: auto; font-size: 12.5px; }
`;
const Chain = styled.span`
  font-size: 11.5px; word-break: break-all;
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 11px; background: #f4f4f5; border-radius: 3px; padding: 1px 5px; }
`;
const Rail = styled.div`height: 6px; border-radius: 3px; background: ${(p) => p.theme.color.LIGHT_GREY}; overflow: hidden;`;
const Fill = styled.div<{ $pct: number }>`
  height: 100%; width: ${({ $pct }) => $pct}%; background: ${(p) => p.theme.color.PRIMARY};
  transition: width .4s ease;
`;
const slide = keyframes`from { transform: translateX(-100%); } to { transform: translateX(320%); }`;
const Indeterminate = styled.div`
  height: 100%; width: 30%; background: ${(p) => p.theme.color.PRIMARY}; opacity: .65;
  animation: ${slide} 1.8s ease-in-out infinite;
  @media (prefers-reduced-motion: reduce) { animation: none; width: 100%; opacity: .3; }
`;

function phaseKey(j: TeachJob): string {
  if (j.status === 'QUEUED') return 'teach.live.phase_queued';
  if (j.status === 'PREFLIGHT') return 'teach.live.phase_preflight';
  if (j.status === 'CHECKING' || j.status === 'EXPORTED') return 'teach.live.phase_check';
  const p = j.progress?.phase;
  if (p === 'baseline') return 'teach.live.phase_baseline';
  if (p === 'train') return 'teach.live.phase_train';
  return 'teach.live.phase_load';
}

export function LiveLessons({ jobs, skewMs = 0 }: { jobs: TeachJob[]; skewMs?: number }) {
  const { t } = useT();
  const since = useSince(skewMs);
  const active = useMemo(() => jobs.filter(isActiveTeach), [jobs]);
  useTicker(active.length > 0);
  if (!active.length) return null;

  return (
    <Wrap data-testid="live-lessons">
      <Head>
        <H>{t('teach.live.title')}</H>
        <Sub>{t('teach.live.count', { n: active.length })}</Sub>
      </Head>
      <Rows>
        {active.map((j) => {
          const p = j.progress;
          const training = p?.phase === 'train' && (p?.max_steps ?? 0) > 0;
          const pct = training ? Math.min(100, Math.round((p!.step / p!.max_steps) * 100)) : 0;
          const started = p?.started_at;
          return (
            <Row key={j.id} data-testid={`live-${j.id}`}>
              <Line>
                <b>{(j.name ?? '').replace(/^Lesson:\s*/, '') || j.id.slice(0, 8)}</b>
                <span>{t(phaseKey(j))}</span>
                {training && <span>{t('teach.live.step', { step: p!.step, max: p!.max_steps })}</span>}
                {j.status === 'QUEUED' && typeof j.position === 'number' && <span>{t('teach.live.position', { n: j.position + 1 })}</span>}
                {started && <span>{since(started)}</span>}
                <Link to={`/teach/lesson/${j.id}`}>{t('teach.live.open')}</Link>
              </Line>
              <Rail>{training ? <Fill $pct={pct} /> : <Indeterminate />}</Rail>
              <Line>
                <span>{t('teach.live.rows', { n: p?.rows_total ?? j.facts.length })}</span>
                {/* `hits` is only meaningful once the model has been asked — before that it is 0 of 0 and says nothing. */}
                {training && (p?.total ?? 0) > 0 && <span>{t('teach.live.right', { hits: p!.hits, total: p!.total })}</span>}
                {j.blocked && <span>{t(`teach.live.blocked_${j.blocked}`, { d: j.blocked })}</span>}
                {/* The path is the point, not the tx: it is where anyone can read this run back. Shown in full,
                    because a truncated path cannot be pasted into a chain explorer, which is the only use it has. */}
                {j.chain && <Chain title={j.chain.tx_hash ?? undefined}>{t('teach.live.chain')} <code>{j.chain.path}</code></Chain>}
              </Line>
            </Row>
          );
        })}
      </Rows>
    </Wrap>
  );
}
