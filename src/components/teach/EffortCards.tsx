import styled from 'styled-components';
import type { TeachEffort, TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { EFFORTS, effortBodyKey, effortLabelKey, effortTime } from './util';

/**
 * "How hard should it try?" (design §5.5 / §D6). The presets change the number of training passes and nothing else the
 * visitor can see. The duration line is a function of the QUESTION COUNT, from one measured sample pool — never a
 * per-preset guess — and says "this node has not timed a lesson yet" until the pool exists (§10).
 */
const List = styled.div`display: flex; flex-direction: column; gap: 10px;`;
const Card = styled.label<{ $active: boolean }>`
  display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 12px; padding: 12px 14px; border-radius: 6px; cursor: pointer; min-width: 0;
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  input { margin-top: 3px; accent-color: #8b3eeb; width: 18px; height: 18px; }
  b { display: block; font-size: 14px; color: ${(p) => p.theme.color.BLACK}; }
  span.body { display: block; margin-top: 2px; font-size: 13px; line-height: 1.5; color: ${(p) => p.theme.color.DARK_GREY}; }
  span.time { display: block; margin-top: 4px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { min-height: 44px; }
`;

export function EffortCards({ value, onChange, policy, rows }: {
  value: TeachEffort; onChange: (e: TeachEffort) => void; policy: TeachPolicy | undefined; rows: number;
}) {
  const { t } = useT();
  return (
    <List role="radiogroup" aria-label={t('teach.set.effort')} data-testid="effort-cards">
      {EFFORTS.map((e) => (
        <Card key={e} $active={value === e} data-testid={`effort-${e}`}>
          <input type="radio" name="effort" value={e} checked={value === e} onChange={() => onChange(e)} aria-label={t(effortLabelKey(e))} />
          <span>
            <b>{t(effortLabelKey(e))}</b>
            <span className="body">{t(effortBodyKey(e))}</span>
            <span className="time" data-testid={`effort-time-${e}`}>{effortTime(policy, e, rows, t)}</span>
          </span>
        </Card>
      ))}
    </List>
  );
}
