import { useState } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, HelperText, Input, Textarea } from '@/components/ui/Form';
import { Sheet, SheetFooter, SheetNote } from './Sheet';
import { suggestPhrasings } from './teachUtil';

const Said = styled.div`
  padding: 10px 12px; border-radius: 4px; background: #fafafa; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.DARK_GREY};
  white-space: pre-wrap; word-break: break-word; max-height: 160px; overflow-y: auto;
`;
const AltRow = styled.div`display: flex; gap: 8px; align-items: flex-end; > label { flex: 1; }`;
const Count = styled.span<{ $over: boolean }>`font-variant-numeric: tabular-nums; color: ${(p) => (p.$over ? p.theme.color.ERROR : p.theme.color.GREY)};`;

export interface TeachDrawerProps {
  question: string;
  modelAnswer: string;
  /** the basket already holds this node's per-lesson maximum */
  full: boolean;
  /** `limits.facts_per_job` — the sentence names the node's number, not a constant */
  max: number;
  limits?: { prompt_max: number; answer_max: number };
  onAdd: (c: { prompt: string; answer: string; alt_prompt?: string; model_answer?: string }) => void;
  onClose: () => void;
}

/** §5.4 — opened from "Teach the right answer" under a reply; question prefilled, the model's answer read-only. */
export function TeachDrawer({ question, modelAnswer, full, max, limits, onAdd, onClose }: TeachDrawerProps) {
  const { t, locale } = useT();
  const promptMax = limits?.prompt_max ?? 400;
  const answerMax = limits?.answer_max ?? 200;
  const [prompt, setPrompt] = useState(question);
  const [answer, setAnswer] = useState('');
  const [alt, setAlt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState(0);

  const submit = () => {
    const a = answer.trim().replace(/\s+/g, ' ');
    const p = prompt.trim();
    if (!a) { setError(t('teach.drawer.v_answer')); return; }
    if (a.length > answerMax) { setError(t('teach.drawer.v_long')); return; }
    if (!p || p.length > promptMax) { setError(t('teach.drawer.v_question_long')); return; }
    if (full) { setError(t('teach.drawer.v_full', { n: max })); return; }
    onAdd({ prompt: p, answer: a, ...(alt.trim() ? { alt_prompt: alt.trim().slice(0, promptMax) } : {}), ...(modelAnswer ? { model_answer: modelAnswer } : {}) });
  };
  const suggest = () => {
    const list = suggestPhrasings(prompt, locale);
    if (!list.length) return;
    setAlt(list[suggestion % list.length]);
    setSuggestion((n) => n + 1);
  };

  return (
    <Sheet title={t('teach.drawer.title')} sub={t('teach.drawer.sub')} onClose={onClose} side width={520} testId="teach-drawer">
      <Field>
        <FieldLabel>{t('teach.drawer.question')}</FieldLabel>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} maxLength={promptMax + 50} aria-label={t('teach.drawer.question')} />
        <HelperText $error={prompt.length > promptMax}><Count $over={prompt.length > promptMax}>{prompt.length}/{promptMax}</Count></HelperText>
      </Field>
      <Field as="div">
        <FieldLabel>{t('teach.drawer.model_said')}</FieldLabel>
        <Said aria-readonly="true">{modelAnswer.trim() || t('teach.drawer.model_none')}</Said>
      </Field>
      <Field>
        <FieldLabel>{t('teach.drawer.answer')}</FieldLabel>
        <Input value={answer} onChange={(e) => { setAnswer(e.target.value); setError(null); }} placeholder={t('teach.drawer.answer_ph')} maxLength={answerMax + 50} autoFocus
          aria-label={t('teach.drawer.answer')} data-testid="teach-answer" onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        <HelperText $error={answer.length > answerMax}><Count $over={answer.length > answerMax}>{answer.length}/{answerMax}</Count></HelperText>
      </Field>
      <AltRow>
        <Field>
          <FieldLabel>{t('teach.drawer.alt')}</FieldLabel>
          <Input value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={promptMax} aria-label={t('teach.drawer.alt')} data-testid="teach-alt" />
          <HelperText>{t('teach.drawer.alt_hint')}</HelperText>
        </Field>
        <Button size="small" color="secondary" type="button" onClick={suggest}>{t('teach.drawer.suggest')}</Button>
      </AltRow>
      {full && <Alert $tone="warning">{t('teach.drawer.v_full', { n: max })}</Alert>}
      {error && <Alert $tone="error" role="alert">{error}</Alert>}
      <SheetFooter>
        <SheetNote style={{ marginRight: 'auto' }}>{t('teach.drawer.storage')}</SheetNote>
        <Button variant="contained" type="button" onClick={submit} disabled={full} data-testid="teach-add">{t('teach.drawer.add')}</Button>
      </SheetFooter>
    </Sheet>
  );
}
