import styled from 'styled-components';
import { useT } from '@/i18n';

/**
 * The five steps every lesson goes through, whichever door it came in by (design §5.1, §5.13).
 * Below 600 px the labels collapse to "Step 2 of 5 · Check" plus a five-segment bar; the labels survive as
 * `aria-label`s, so a screen reader gets the same list at every width and nothing scrolls sideways.
 */
const LABELS = ['teach.step.data', 'teach.step.check', 'teach.step.settings', 'teach.step.train', 'teach.step.result'] as const;

const Wrap = styled.nav`
  display: flex; flex-direction: column; gap: 8px; width: 100%;
`;
const Row = styled.ol`
  display: flex; align-items: center; gap: 8px; margin: 0; padding: 0; list-style: none; flex-wrap: wrap;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: none; }
`;
const Item = styled.li<{ $state: 'done' | 'now' | 'todo' }>`
  display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: ${(p) => (p.$state === 'now' ? 700 : 500)};
  color: ${(p) => (p.$state === 'todo' ? p.theme.color.GREY : p.$state === 'now' ? p.theme.color.PRIMARY : p.theme.color.DARK_GREY)};
  b { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 11px; font-size: 12px;
    color: ${(p) => (p.$state === 'todo' ? p.theme.color.GREY : '#fff')};
    background: ${(p) => (p.$state === 'todo' ? '#eee' : p.$state === 'now' ? p.theme.color.PRIMARY : p.theme.color.SUCCESS)}; }
  &::after { content: '›'; margin-left: 4px; color: ${(p) => p.theme.color.LIGHT_GREY}; }
  &:last-child::after { content: ''; }
`;
const Small = styled.p`
  display: none; margin: 0; font-size: 13px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY};
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: block; }
`;
const Bar = styled.div`
  display: none; gap: 4px;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { display: flex; }
  span { flex: 1; height: 4px; border-radius: 2px; background: #eee; }
  span[data-done='1'] { background: ${(p) => p.theme.color.PRIMARY}; }
`;

export function Stepper({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  const { t } = useT();
  return (
    <Wrap aria-label={t('teach.step.of', { n: current, label: t(LABELS[current - 1]) })} data-testid="teach-stepper">
      <Row>
        {LABELS.map((key, i) => (
          <Item key={key} $state={i + 1 < current ? 'done' : i + 1 === current ? 'now' : 'todo'} aria-current={i + 1 === current ? 'step' : undefined}>
            <b aria-hidden>{i + 1}</b>{t(key)}
          </Item>
        ))}
      </Row>
      <Small data-testid="teach-step-small">{t('teach.step.of', { n: current, label: t(LABELS[current - 1]) })}</Small>
      <Bar aria-hidden>{LABELS.map((key, i) => <span key={key} data-done={i + 1 <= current ? '1' : '0'} />)}</Bar>
    </Wrap>
  );
}

/** The static "these five steps are the same" strip on the entry screen — no step is current there. */
export function StepStrip() {
  const { t } = useT();
  return (
    <Row aria-label={t('teach.entry.steps')} style={{ display: 'flex' }}>
      {LABELS.map((key, i) => (
        <Item key={key} $state="todo"><b aria-hidden>{i + 1}</b>{t(key)}</Item>
      ))}
    </Row>
  );
}
