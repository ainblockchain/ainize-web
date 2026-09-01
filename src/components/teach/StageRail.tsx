import styled from 'styled-components';
import { useT } from '@/i18n';
import { STAGES, type Stage } from './util';

/**
 * The v1 state machine made visible (design §5.6): Waiting → Preparing → Warming up → Teaching → Double-checking → Done.
 * On a demo (stub) node "Warming up the model" becomes "Starting…" — nothing is warmed up because nothing is trained.
 */
const KEYS: Record<Stage, string> = {
  queued: 'teach.run.stage.queued', prep: 'teach.run.stage.prep', warm: 'teach.run.stage.warm',
  train: 'teach.run.stage.train', check: 'teach.run.stage.check', done: 'teach.run.stage.done',
};

const Rail = styled.ol`
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0; padding: 0; list-style: none;
`;
const Step = styled.li<{ $state: 'done' | 'now' | 'todo' }>`
  display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px;
  font-weight: ${(p) => (p.$state === 'now' ? 700 : 500)};
  color: ${(p) => (p.$state === 'todo' ? p.theme.color.GREY : p.$state === 'now' ? p.theme.color.PRIMARY : p.theme.color.DARK_GREY)};
  i { width: 9px; height: 9px; border-radius: 50%; font-style: normal; flex: none;
    background: ${(p) => (p.$state === 'todo' ? '#ddd' : p.$state === 'now' ? p.theme.color.PRIMARY : p.theme.color.SUCCESS)};
    ${(p) => p.$state === 'now' && 'animation: kmPulse 1.2s ease-in-out infinite;'} }
  &::after { content: '›'; color: ${(p) => p.theme.color.LIGHT_GREY}; }
  &:last-child::after { content: ''; }
`;

export function StageRail({ stage, stub }: { stage: Stage; stub?: boolean }) {
  const { t } = useT();
  const at = STAGES.indexOf(stage);
  return (
    <Rail data-testid="stage-rail" data-stage={stage}>
      {STAGES.map((s, i) => (
        <Step key={s} $state={i < at ? 'done' : i === at ? 'now' : 'todo'} aria-current={i === at ? 'step' : undefined}>
          <i aria-hidden />{t(s === 'warm' && stub ? 'teach.run.stage.start' : KEYS[s])}
        </Step>
      ))}
    </Rail>
  );
}
