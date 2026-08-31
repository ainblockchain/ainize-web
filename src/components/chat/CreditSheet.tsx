import { useState, type ChangeEvent } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, HelperText, Input, Textarea } from '@/components/ui/Form';
import { Mono } from '@/components/ui/Misc';
import { createTeacherKey, currentTeacherKey, isAddress, parseTeacherKeyBackup, saveTeacherKey, shortKey, teacherKeyBackup, teacherKeyBackupName, updateTeacherKey, type TeacherKey } from '@/lib/teacherKey';
import { Sheet, SheetFooter, SheetNote } from './Sheet';
import { downloadText } from './teachUtil';

const Address = styled.div`font-size: 12px; color: ${(p) => p.theme.color.GREY}; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;`;
const ImportBox = styled.div`display: flex; flex-direction: column; gap: 10px; padding: 12px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 4px; background: #fafafa;`;

/** Restore-a-key form (used by the credit sheet and the Your-knowledge panel). */
export function KeyImport({ onImported }: { onImported: (k: TeacherKey) => void }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apply = (raw: string) => {
    try { onImported(saveTeacherKey(parseTeacherKeyBackup(raw))); setError(null); setText(''); } catch (e) { setError(t('teach.key.import_bad', { message: (e as Error).message })); }
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => apply(String(r.result ?? '')); r.readAsText(f);
  };
  return (
    <ImportBox data-testid="key-import">
      <SheetNote>{t('teach.key.import_hint')}</SheetNote>
      <input type="file" accept=".json,.txt,application/json,text/plain" onChange={onFile} aria-label={t('teach.key.import')} />
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('teach.key.import_ph')} rows={3} aria-label={t('teach.key.import_ph')} />
      <div><Button size="small" onClick={() => apply(text)} disabled={!text.trim()}>{t('teach.key.import_do')}</Button></div>
      {error && <Alert $tone="error" role="alert">{error}</Alert>}
    </ImportBox>
  );
}

/** §5.6 — first "Train this lesson" only: the key is created on open (so the backup works even if the sheet is closed). */
export function CreditSheet({ onDone, onClose }: { onDone: (key: TeacherKey) => void; onClose: () => void }) {
  const { t } = useT();
  const [key, setKey] = useState<TeacherKey>(() => currentTeacherKey() ?? createTeacherKey());
  const [name, setName] = useState(key.name ?? '');
  const [payout, setPayout] = useState(key.payout_address ?? '');
  const [importing, setImporting] = useState(false);
  const [restored, setRestored] = useState<string | null>(null);
  const payoutBad = !!payout.trim() && !isAddress(payout.trim());

  const backup = () => downloadText(teacherKeyBackupName(key), teacherKeyBackup({ ...key, ...(name.trim() ? { name: name.trim() } : {}), ...(isAddress(payout.trim()) ? { payout_address: payout.trim() } : {}) }));
  const cont = () => {
    if (payoutBad) return;
    const k = updateTeacherKey({ name: name.trim().slice(0, 40), payout_address: payout.trim() || null }) ?? key;
    onDone(k);
  };
  return (
    <Sheet title={t('teach.key.title')} onClose={onClose} width={560} testId="credit-sheet">
      <p style={{ margin: 0 }}>{t('teach.key.body')}</p>
      <Address>{t('teach.key.address')}: <Mono title={key.address} data-testid="key-address">{key.address}</Mono></Address>
      <Field>
        <FieldLabel>{t('teach.key.name')}</FieldLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label={t('teach.key.name')} data-testid="key-name" />
      </Field>
      <Field>
        <FieldLabel>{t('teach.key.payout')}</FieldLabel>
        <Input value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="0x…" aria-label={t('teach.key.payout')} />
        {payoutBad && <HelperText $error>{t('teach.key.payout_invalid')}</HelperText>}
      </Field>
      <Alert $tone="warning">{t('teach.key.warn')}</Alert>
      {restored && <Alert $tone="success" role="status">{restored}</Alert>}
      {importing && <KeyImport onImported={(k) => { setKey(k); setName(k.name ?? ''); setPayout(k.payout_address ?? ''); setRestored(t('teach.key.import_ok', { short: shortKey(k.address) })); setImporting(false); }} />}
      <SheetFooter>
        <Button type="button" color="secondary" onClick={() => setImporting((v) => !v)} style={{ marginRight: 'auto' }}>{t('teach.key.import')}</Button>
        <Button type="button" onClick={backup} data-testid="key-backup">{t('teach.key.backup')}</Button>
        <Button type="button" variant="contained" onClick={cont} disabled={payoutBad} data-testid="key-continue">{t('teach.key.continue')}</Button>
      </SheetFooter>
    </Sheet>
  );
}
