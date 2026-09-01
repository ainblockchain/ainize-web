import { useState } from 'react';
import type { DatasetRowInput, TeachDatasetRow } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, HelperText, Input, Textarea } from '@/components/ui/Form';
import { Sheet, SheetFooter, SheetNote } from '@/components/chat/Sheet';

/**
 * Edit one question, or add a new one (design §5.4, §5.13 — a full-width sheet, so nothing has to be typed into a
 * 40 px table cell on a phone). Saving replaces the question in the dataset, which bumps its revision and clears the
 * model-side status of that row: never a green tick next to text the visitor just changed.
 */
export interface RowEditSheetProps {
  row?: TeachDatasetRow;
  limits?: { prompt_max: number; answer_max: number };
  saving?: boolean;
  onSave: (row: DatasetRowInput) => void;
  onClose: () => void;
}

export function RowEditSheet({ row, limits, saving, onSave, onClose }: RowEditSheetProps) {
  const { t } = useT();
  const promptMax = limits?.prompt_max ?? 400;
  const answerMax = limits?.answer_max ?? 200;
  const [prompt, setPrompt] = useState(row?.prompt ?? '');
  const [answer, setAnswer] = useState(row?.answer ?? '');
  const [alt, setAlt] = useState(row?.alt_prompt ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const p = prompt.trim().replace(/\s+/g, ' ');
    const a = answer.trim().replace(/\s+/g, ' ');
    if (!p) { setError(t('teach.rows.bad.no_question')); return; }
    if (!a) { setError(t('teach.rows.bad.no_answer')); return; }
    if (p.length > promptMax) { setError(t('teach.rows.bad.question_long', { n: p.length, max: promptMax })); return; }
    if (a.length > answerMax) { setError(t('teach.rows.bad.answer_long', { n: a.length, max: answerMax })); return; }
    onSave({ prompt: p, answer: a, ...(alt.trim() ? { alt_prompt: alt.trim().slice(0, promptMax) } : {}) });
  };

  const title = row ? t('teach.rows.edit_cell', { field: t('teach.rows.h.q'), n: row.line }) : t('teach.rows.add');
  return (
    <Sheet title={title} onClose={onClose} width={560} testId="row-edit-sheet">
      <Field>
        <FieldLabel htmlFor="row-q">{t('teach.rows.h.q')}</FieldLabel>
        <Textarea id="row-q" rows={2} value={prompt} onChange={(e) => { setPrompt(e.target.value); setError(null); }} maxLength={promptMax + 50} data-testid="row-q" />
        <HelperText $error={prompt.length > promptMax}>{prompt.length}/{promptMax}</HelperText>
      </Field>
      <Field>
        <FieldLabel htmlFor="row-a">{t('teach.rows.h.a')}</FieldLabel>
        <Input id="row-a" value={answer} onChange={(e) => { setAnswer(e.target.value); setError(null); }} maxLength={answerMax + 50} data-testid="row-a" />
        <HelperText $error={answer.length > answerMax}>{answer.length}/{answerMax}</HelperText>
      </Field>
      <Field>
        <FieldLabel htmlFor="row-alt">{t('teach.rows.h.alt')}</FieldLabel>
        <Input id="row-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={promptMax} data-testid="row-alt" />
      </Field>
      {error && <Alert $tone="error" role="alert">{error}</Alert>}
      <SheetFooter>
        <SheetNote style={{ marginRight: 'auto' }}>{t('teach.up.privacy')}</SheetNote>
        <Button type="button" onClick={onClose}>{t('teach.rows.cancel_edit')}</Button>
        <Button type="button" variant="contained" onClick={submit} loading={saving} data-testid="row-save">{row ? t('teach.rows.save') : t('teach.rows.add_save')}</Button>
      </SheetFooter>
    </Sheet>
  );
}
