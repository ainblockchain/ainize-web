import styled from 'styled-components';
import type { TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import type { Basket } from '@/lib/teachStore';
import { MAX_FACTS } from '@/lib/teachStore';
import { policyLine } from './teachUtil';

const Panel = styled.section`
  display: flex; flex-direction: column; gap: 10px; padding: 14px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-top: 3px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 4px;
`;
const Head = styled.div`
  display: flex; align-items: center; gap: 8px;
  h2 { margin: 0; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; flex: 1; }
  button.link { background: none; border: 0; padding: 0; font: inherit; font-size: 12px; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; } }
`;
const Policy = styled.p<{ $ok: boolean }>`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => (p.$ok ? p.theme.color.SUCCESS : p.theme.color.WARNING)};`;
const Hint = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;
const List = styled.ol`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Item = styled.li`
  position: relative; padding: 10px 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fafafa; font-size: 13px; line-height: 1.5;
  .q { color: ${(p) => p.theme.color.BLACK}; font-weight: 600; word-break: break-word; }
  .a { color: ${(p) => p.theme.color.DARK_GREY}; word-break: break-word; b { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 600; } }
  .alt { color: ${(p) => p.theme.color.GREY}; font-size: 12px; word-break: break-word; }
  button { position: absolute; top: 6px; right: 6px; background: none; border: 0; font-size: 12px; color: ${(p) => p.theme.color.GREY}; cursor: pointer; &:hover { color: ${(p) => p.theme.color.ERROR}; } }
`;
const KeyChip = styled.div`
  font-size: 11px; color: ${(p) => p.theme.color.GREY}; font-variant-numeric: tabular-nums; code { font-family: ${(p) => p.theme.font.mono}; }
`;

export interface LessonBasketProps {
  basket: Basket;
  policy: TeachPolicy | undefined;
  /** names of the knowledge currently loaded (the lesson's context) */
  stackNames: string[];
  expanded: boolean;
  onToggle: () => void;
  onRemove: (id: string) => void;
  onBuildsOn: (v: boolean) => void;
  onTrain: () => void;
  onOpenMine: () => void;
  /** "Teaching as {name} · {short}" when this browser already has a key */
  keyLabel?: string;
}

/** §5.5 — the corrections collected for the current knowledge stack; persists in localStorage across reloads. */
export function LessonBasket({ basket, policy, stackNames, expanded, onToggle, onRemove, onBuildsOn, onTrain, onOpenMine, keyLabel }: LessonBasketProps) {
  const { t } = useT();
  const n = basket.facts.length;
  const pol = policyLine(policy, t);
  const canTrain = n > 0 && pol.ok;
  return (
    <Panel aria-label={t('teach.basket.title', { n })} data-testid="lesson-basket">
      <Head>
        <h2>{t('teach.basket.title', { n })}</h2>
        <button type="button" className="link" onClick={onOpenMine} data-testid="open-mine">{t('teach.basket.mine_link')}</button>
        <button type="button" className="link" onClick={onToggle} aria-expanded={expanded}>{expanded ? t('teach.basket.collapse') : t('teach.basket.expand')}</button>
      </Head>
      {expanded && (
        <>
          {pol.text && <Policy $ok={pol.ok} role="status" data-testid="teach-policy">{pol.text}</Policy>}
          {n === 0 ? <Hint>{t('teach.basket.empty')}</Hint> : (
            <List>
              {basket.facts.map((f, i) => (
                <Item key={f.id} data-testid="basket-item">
                  <div className="q">{i + 1}. {f.prompt}</div>
                  <div className="a">{t('teach.basket.answer_label')}: <b>{f.answer}</b></div>
                  {f.alt_prompt && <div className="alt">{t('teach.basket.alt_label')}: {f.alt_prompt}</div>}
                  <button type="button" onClick={() => onRemove(f.id)} aria-label={`${t('teach.basket.remove')} ${i + 1}`}>{t('teach.basket.remove')} ×</button>
                </Item>
              ))}
            </List>
          )}
          <Hint>{stackNames.length ? t('teach.basket.stack', { names: stackNames.join(', ') }) : t('teach.basket.stack_none')}</Hint>
          {stackNames.length > 0 && (
            <Checkbox checked={basket.builds_on} onChange={(e) => onBuildsOn(e.target.checked)} label={<span style={{ fontSize: 13 }}>{t('teach.basket.builds_on')}</span>} />
          )}
          {n >= MAX_FACTS && <Alert $tone="info">{t('teach.drawer.v_full')}</Alert>}
          <Button variant="contained" fullWidth disabled={!canTrain} onClick={onTrain} data-testid="train-lesson">{t('teach.basket.train')}</Button>
          {keyLabel && <KeyChip title={t('teach.key.address')}>{keyLabel}</KeyChip>}
        </>
      )}
    </Panel>
  );
}
