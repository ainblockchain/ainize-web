import { useState } from 'react';
import type { DatasetParseOptions, TeachDataset, TeachDatasetFormat } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Checkbox, SelectField } from '@/components/ui/Form';
import { Sheet, SheetFooter, SheetNote } from '@/components/chat/Sheet';

/**
 * "Wrong columns or separator?" (design §5.4). The node re-reads the bytes it already has — nothing is uploaded
 * again — and answers with a fresh report, a new revision and a new fingerprint.
 */
const FORMATS: TeachDatasetFormat[] = ['jsonl', 'json', 'csv', 'tsv', 'txt'];
const DELIMITERS: { value: string; label: string }[] = [
  { value: ',', label: ',' }, { value: '\\t', label: 'tab' }, { value: ';', label: ';' }, { value: '|', label: '|' },
];
const ENCODINGS = ['utf-8', 'euc-kr', 'utf-16le', 'utf-16be', 'latin1'];

export function ReparseSheet({ dataset, saving, onApply, onClose }: {
  dataset: TeachDataset; saving?: boolean; onApply: (opts: DatasetParseOptions) => void; onClose: () => void;
}) {
  const { t } = useT();
  const [format, setFormat] = useState<string>(dataset.format ?? '');
  const [delimiter, setDelimiter] = useState<string>('');
  const [hasHeader, setHasHeader] = useState<boolean>(dataset.has_header ?? true);
  const [encoding, setEncoding] = useState<string>('');

  return (
    <Sheet title={t('teach.rows.reparse')} sub={t('teach.rows.reparse_sub')} onClose={onClose} width={480} testId="reparse-sheet">
      <SelectField label={t('teach.rows.reparse_format')} value={format} onChange={(e) => setFormat(e.target.value)} data-testid="reparse-format">
        <option value="">{t('teach.rows.reparse_auto')}</option>
        {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
      </SelectField>
      <SelectField label={t('teach.rows.reparse_delim')} value={delimiter} onChange={(e) => setDelimiter(e.target.value)}>
        <option value="">{t('teach.rows.reparse_auto')}</option>
        {DELIMITERS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
      </SelectField>
      <SelectField label={t('teach.rows.reparse_encoding')} value={encoding} onChange={(e) => setEncoding(e.target.value)}>
        <option value="">{t('teach.rows.reparse_auto')}</option>
        {ENCODINGS.map((e) => <option key={e} value={e}>{e}</option>)}
      </SelectField>
      <Checkbox checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} label={<span style={{ fontSize: 13 }}>{t('teach.rows.reparse_header')}</span>} />
      <SheetFooter>
        <SheetNote style={{ marginRight: 'auto' }}>{t('teach.rows.reparse_sub')}</SheetNote>
        <Button type="button" onClick={onClose}>{t('teach.rows.cancel_edit')}</Button>
        <Button
          type="button" variant="contained" loading={saving} data-testid="reparse-go"
          onClick={() => onApply({
            ...(format ? { format: format as TeachDatasetFormat } : {}),
            ...(delimiter ? { delimiter } : {}),
            ...(encoding ? { encoding } : {}),
            has_header: hasHeader,
          })}
        >{t('teach.rows.reparse_go')}</Button>
      </SheetFooter>
    </Sheet>
  );
}
