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
import { DEFAULT_FACTS_PER_JOB } from '@/lib/teachStore';
import { BasePicker, baseBlocked, type BaseCandidate } from './BasePicker';
import { Sheet } from './Sheet';
import { effectiveBase, policyLine } from './teachUtil';

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
/**
 * Finding 92 — "Remove ×" was `position: absolute` over a question that wrapped underneath it, so at 360 px the
 * button sat on top of the correction it deletes. The item is a two-column grid instead: the text can never run
 * under the control, and the control keeps a 32 px touch target of its own.
 */
const Item = styled.li`
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 10px; align-items: start;
  padding: 10px 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fafafa; font-size: 13px; line-height: 1.5;
  .q { grid-column: 1; color: ${(p) => p.theme.color.BLACK}; font-weight: 600; word-break: break-word; }
  .a { grid-column: 1; color: ${(p) => p.theme.color.DARK_GREY}; word-break: break-word; b { color: ${(p) => p.theme.color.PRIMARY}; font-weight: 600; } }
  .alt { grid-column: 1; color: ${(p) => p.theme.color.GREY}; font-size: 12px; word-break: break-word; }
  button { grid-column: 2; grid-row: 1; align-self: start; min-height: 32px; padding: 0 2px; background: none; border: 0; font: inherit; font-size: 12px; white-space: nowrap; color: ${(p) => p.theme.color.GREY}; cursor: pointer; &:hover { color: ${(p) => p.theme.color.ERROR}; } }
`;
const BaseRow = styled.div`
  display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fafafa;
  .line { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  b { font-size: 13px; color: ${(p) => p.theme.color.BLACK}; word-break: break-word; }
  button { background: none; border: 0; padding: 0; font: inherit; font-size: 12px; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; } }
  p { margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; word-break: break-word; }
  p.warn { color: ${(p) => p.theme.color.WARNING}; }
`;
const KeyChip = styled.div`
  font-size: 11px; color: ${(p) => p.theme.color.GREY}; font-variant-numeric: tabular-nums; code { font-family: ${(p) => p.theme.font.mono}; }
`;

export interface LessonBasketProps {
  basket: Basket;
  policy: TeachPolicy | undefined;
  /** names of the knowledge currently loaded (the lesson's context) */
  stackNames: string[];
  /** SC-1/SC-3: what this lesson could be built on — the loaded stack first, then this key's own knowledge */
  baseCandidates?: BaseCandidate[];
  onBase?: (id: string | null) => void;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (id: string) => void;
  onBuildsOn: (v: boolean) => void;
  onTrain: () => void;
  onOpenMine: () => void;
  /** "Teaching as {name} · {short}" when this browser already has a key */
  keyLabel?: string;
  /** this node's own display name — it is a payee in the split sentence under "builds on" (finding 300) */
  nodeName?: string;
}

/** §5.5 / v2 §5.9 — the corrections collected for the current knowledge stack; persists in localStorage across reloads. */
export function LessonBasket({ basket, policy, stackNames, baseCandidates = [], onBase, expanded, onToggle, onRemove, onBuildsOn, onTrain, onOpenMine, keyLabel, nodeName }: LessonBasketProps) {
  const { t } = useT();
  const [viewing, setViewing] = useState(false);
  const [picking, setPicking] = useState(false);
  const n = basket.facts.length;
  // the per-lesson cap is the NODE's (design §D1); the shipped default only stands in while the policy loads
  const max = policy?.limits?.facts_per_job ?? DEFAULT_FACTS_PER_JOB;
  /** the design's string is "{n} questions"; one question is the only case where that reads wrong */
  const heading = n === 1 ? t('teach.basket.title_one') : t('teach.basket.title_ds', { n });
  const pol = policyLine(policy, t);
  const canTrain = n > 0 && pol.ok;
  const rows: TeachDatasetRow[] = basket.facts.map((f, i) => ({
    index: i, line: i + 1, status: 'ok',
    prompt: f.prompt, answer: f.answer, ...(f.alt_prompt ? { alt_prompt: f.alt_prompt } : {}),
  }));
  const download = () => downloadBytes(basketFilename(), canonicalJsonl(basket.facts.map((f) => ({ prompt: f.prompt, answer: f.answer, ...(f.alt_prompt ? { alt_prompt: f.alt_prompt } : {}) }))));

  // SC-1: what this lesson is built on, and what is only loaded beside it
  const lineage = policy?.lineage === true;
  const marked = baseCandidates.map((c) => ({ ...c, blocked: !!baseBlocked(c, t) }));
  const base = lineage ? effectiveBase(basket.base, marked) : null;
  const chosen = marked.find((c) => c.id === base);
  const baseName = chosen?.name ?? null;
  const baseRows = chosen?.rows ?? 0;
  const baseStatus = chosen && !['LISTED', 'ANNOUNCED', 'VERIFYING'].includes(chosen.status) ? chosen.status : null;
  const compareOnly = marked.filter((c) => c.loaded && c.id !== base).map((c) => c.name);
  // a loaded knowledge that CANNOT be built on says why here, where the visitor is deciding
  const blockedNote = !base ? (marked.filter((c) => c.loaded && c.blocked).map((c) => baseBlocked(c, t)).find(Boolean) ?? null) : null;
  const lineagePct = Math.round((policy?.shares?.lineage ?? 0) * 100);
  /**
   * Finding 300 — the v1 tick was eleven words that named neither a rate nor a person, and it is the creator's
   * biggest revenue decision. `royaltySplit` pays the lineage pool off the top and carves the contributor's share
   * out of what is left, so ticking it moves the teacher from 70 % to 49 % on this node's own numbers — say both,
   * name the creators being credited, and say that it lasts as long as the lesson sells.
   */
  const loadedCreators = [...new Set(marked.filter((c) => c.loaded).map((c) => c.author))].join(', ');
  const shareContributor = policy?.shares?.contributor ?? 0;
  const shareLineage = policy?.shares?.lineage ?? 0;
  const pct = (x: number) => Math.round(x * 1000) / 10;
  const buildsOnMoney = {
    names: stackNames.join(', '), creators: loadedCreators, node: nodeName ?? t('teach.pub.split_node'),
    lineage: pct(shareLineage), contributor: pct(shareContributor * (1 - shareLineage)),
    nodePct: pct(1 - shareLineage - shareContributor * (1 - shareLineage)),
  };
  const plainMoney = { node: nodeName ?? t('teach.pub.split_node'), contributor: pct(shareContributor), nodePct: pct(1 - shareContributor) };

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
                  <button type="button" onClick={() => onRemove(f.id)} aria-label={`${t('teach.basket.remove')} ${i + 1}`}>{t('teach.basket.remove')} ×</button>
                  <div className="a">{t('teach.basket.answer_label')}: <b>{f.answer}</b></div>
                  {f.alt_prompt && <div className="alt">{t('teach.basket.alt_label')}: {f.alt_prompt}</div>}
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
          {/*
            SC-1 — the base row replaces the "builds on what I loaded" checkbox on a node that has lineage: the
            knowledge this lesson is built ON is one choice, stated with its three consequences, and everything else
            that is loaded is named as comparison only. Where the flag is off, the v1 checkbox stays exactly as it was.
          */}
          {lineage ? (
            <BaseRow data-testid="basket-base">
              <div className="line">
                <b>{baseName ? t('teach.basket.base', { name: baseName }) : t('teach.basket.base_none')}</b>
                {onBase && baseCandidates.length > 0 && (
                  <button type="button" onClick={() => setPicking(true)} data-testid="basket-base-change">{base ? t('teach.basket.base_change') : t('teach.basket.base_choose')}</button>
                )}
              </div>
              {base && baseName && (
                <p data-testid="basket-base-why">{t('teach.basket.base_consequences', { name: baseName, lineage: lineagePct })}</p>
              )}
              {base && baseRows ? <p data-testid="basket-base-inherits">{t('teach.basket.inherits', { n: baseRows })}</p> : null}
              {baseStatus && <p className="warn" data-testid="basket-base-unlisted">{t('teach.basket.base_unlisted', { status: baseStatus })}</p>}
              {compareOnly.length > 0 && <p data-testid="basket-compare-only">{t('teach.basket.compare_only', { names: compareOnly.join(', ') })}</p>}
              {blockedNote && <p className="warn" data-testid="basket-base-blocked">{blockedNote}</p>}
            </BaseRow>
          ) : stackNames.length > 0 && (
            <BaseRow data-testid="basket-builds-on">
              <Checkbox checked={basket.builds_on} onChange={(e) => onBuildsOn(e.target.checked)} label={<span style={{ fontSize: 13 }}>{t('teach.basket.builds_on')}</span>} />
              {/* finding 300 — the rate, the people it pays and how long it lasts, from this node's own shares */}
              <p data-testid="builds-on-money">
                {basket.builds_on ? t('teach.basket.builds_on_money', buildsOnMoney) : t('teach.basket.builds_on_off', plainMoney)}
              </p>
              {/* on-top training has not shipped: the parent reaches the trainer as contrast samples only, so a
                  buyer of this lesson does not need the base loaded. Say so where the tick is made. */}
              <p data-testid="builds-on-standalone">{t('teach.basket.builds_on_standalone', { names: stackNames.join(', ') })}</p>
            </BaseRow>
          )}
          {n >= max && <Alert $tone="info">{t('teach.drawer.v_full', { n: max })}</Alert>}
          <Button variant="contained" fullWidth disabled={!canTrain} onClick={onTrain} data-testid="train-lesson">{t('teach.basket.train_ds', { n })}</Button>
          {keyLabel && <KeyChip title={t('teach.key.address')}>{keyLabel}</KeyChip>}
        </>
      )}
      {picking && onBase && (
        <BasePicker candidates={baseCandidates} value={base} onPick={onBase} onClose={() => setPicking(false)} />
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
