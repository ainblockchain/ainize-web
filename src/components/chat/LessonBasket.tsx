import { useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import type { TeachDatasetRow, TeachPolicy } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import { DatasetTable } from '@/components/teach/DatasetTable';
import { basketFilename, canonicalJsonl, downloadBytes } from '@/lib/teachDataset';
import type { Basket } from '@/lib/teachStore';
import { MAX_FACTS } from '@/lib/teachStore';
import { Sheet } from './Sheet';
import { policyLine } from './teachUtil';

/**
 * The chat door's basket, which is a DATASET DRAFT before "Teach" is ever pressed (design §5.9) — the owner's
 * "대화형은 파일형의 전단계" rendered as UI instead of hidden as an internal detail. It says how many questions it holds,
 * shows them in the same preview table the file door uses, downloads as the exact canonical `.jsonl` the node would
 * write, and lets a question be taken out again. Pressing Teach freezes it into a file and the pipeline continues
 * identically — the v1 training call is untouched.
 */
const Panel = styled.section`
  display: flex; flex-direction: column; gap: 10px; padding: 14px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-top: 3px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 4px;
`;
const Head = styled.div`
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  h2 { margin: 0; font-size: 14px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; flex: 1; }
  button.link { background: none; border: 0; padding: 0; font: inherit; font-size: 12px; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; } }
`;
const Tools = styled.div`
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
  button, a { background: none; border: 0; padding: 0; font: inherit; font-size: 12px; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; text-decoration: none; &:hover { text-decoration: underline; } }
  button:disabled { color: ${(p) => p.theme.color.GREY}; cursor: not-allowed; text-decoration: none; }
`;
const Policy = styled.p<{ $ok: boolean }>`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => (p.$ok ? p.theme.color.SUCCESS : p.theme.color.WARNING)};`;
const Hint = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;
const List = styled.ol`margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px;`;
const Item = styled.li`
  position: relative; padding: 10px 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fafafa; font-size: 13px; line-height: 1.5;
  .q { color: ${(p) => p.theme.color.BLACK}; font-weight: 600; word-break: break-word; padding-right: 56px; }
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

/** §5.5 / v2 §5.9 — the corrections collected for the current knowledge stack; persists in localStorage across reloads. */
export function LessonBasket({ basket, policy, stackNames, expanded, onToggle, onRemove, onBuildsOn, onTrain, onOpenMine, keyLabel }: LessonBasketProps) {
  const { t } = useT();
  const [viewing, setViewing] = useState(false);
  const n = basket.facts.length;
  /** the design's string is "{n} questions"; one question is the only case where that reads wrong */
  const heading = n === 1 ? t('teach.basket.title_one') : t('teach.basket.title_ds', { n });
  const pol = policyLine(policy, t);
  const canTrain = n > 0 && pol.ok;
  const rows: TeachDatasetRow[] = basket.facts.map((f, i) => ({
    index: i, line: i + 1, status: 'ok',
    prompt: f.prompt, answer: f.answer, ...(f.alt_prompt ? { alt_prompt: f.alt_prompt } : {}),
  }));
  const download = () => downloadBytes(basketFilename(), canonicalJsonl(basket.facts.map((f) => ({ prompt: f.prompt, answer: f.answer, ...(f.alt_prompt ? { alt_prompt: f.alt_prompt } : {}) }))));

  return (
    <Panel aria-label={heading} data-testid="lesson-basket">
      <Head>
        <h2>{heading}</h2>
        <button type="button" className="link" onClick={onOpenMine} data-testid="open-mine">{t('teach.basket.mine_link')}</button>
        <button type="button" className="link" onClick={onToggle} aria-expanded={expanded}>{expanded ? t('teach.basket.collapse') : t('teach.basket.expand')}</button>
      </Head>
      {expanded && (
        <>
          <Hint>{t('teach.basket.sub_ds')}</Hint>
          {pol.text && <Policy $ok={pol.ok} role="status" data-testid="teach-policy">{pol.text}</Policy>}
          {n === 0 ? <Hint>{t('teach.basket.empty_ds')}</Hint> : (
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
          <Tools>
            <button type="button" onClick={() => setViewing(true)} disabled={n === 0} data-testid="basket-view">{t('teach.basket.view')}</button>
            <button type="button" onClick={download} disabled={n === 0} data-testid="basket-download">{t('teach.basket.download')}</button>
            <Link to="/teach/upload" data-testid="basket-upload-link">{t('teach.basket.upload_link')}</Link>
          </Tools>
          <Hint>{t('teach.basket.add_more')}</Hint>
          <Hint>{stackNames.length ? t('teach.basket.stack', { names: stackNames.join(', ') }) : t('teach.basket.stack_none')}</Hint>
          {stackNames.length > 0 && (
            <Checkbox checked={basket.builds_on} onChange={(e) => onBuildsOn(e.target.checked)} label={<span style={{ fontSize: 13 }}>{t('teach.basket.builds_on')}</span>} />
          )}
          {n >= MAX_FACTS && <Alert $tone="info">{t('teach.drawer.v_full')}</Alert>}
          <Button variant="contained" fullWidth disabled={!canTrain} onClick={onTrain} data-testid="train-lesson">{t('teach.basket.train_ds', { n })}</Button>
          {keyLabel && <KeyChip title={t('teach.key.address')}>{keyLabel}</KeyChip>}
        </>
      )}
      {viewing && (
        <Sheet title={t('teach.basket.view_title')} sub={heading} onClose={() => setViewing(false)} width={720} testId="basket-sheet">
          <DatasetTable rows={rows} limits={policy?.limits} onRemove={(r) => { const f = basket.facts[r.index ?? -1]; if (f) onRemove(f.id); }} />
          <Button onClick={download} data-testid="basket-sheet-download">{t('teach.basket.download')}</Button>
        </Sheet>
      )}
    </Panel>
  );
}
