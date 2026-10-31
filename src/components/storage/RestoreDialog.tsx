/**
 * Restore a backup (admin): **into a new store** (recommended — this store is left alone and a copy named
 * `<name>-r<date>` is created, to be connected where wanted) or **in place** (the current database is kept as
 * `<db>_prerestore_<ts>` for seven days and can be undone; connected projects see connection errors while it runs).
 * The store's name has to be typed to confirm, as on the delete.
 */
import { useState } from 'react';
import { useRestoreStoreMutation } from '@/api/api';
import { DEFAULT_DATABASE, restoreCopyNameOf, storeNameProblem, type RestoreResult, type StoreBackup, type StoreDetail } from '@/api/projectStorage';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select } from '@/components/ui/Form';
import { Mono } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { Actions, Dialog, Help, Row, Spacer, storageErrorText, when } from './common';

export default function RestoreDialog({ store, backup, orgId, onDone, onClose }: { store: StoreDetail; backup: StoreBackup; orgId: string; onDone: (r: RestoreResult) => void; onClose: () => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<'new' | 'in-place'>('new');
  const [newName, setNewName] = useState(restoreCopyNameOf(store.name));
  const databases = backup.files.length ? backup.files.map((f) => f.database) : store.postgres?.databases ?? [DEFAULT_DATABASE];
  const [database, setDatabase] = useState(databases[0] ?? DEFAULT_DATABASE);
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [restore, restoring] = useRestoreStoreMutation();
  const nameProblem = mode === 'new' ? storeNameProblem(newName.trim()) : null;
  const confirmed = confirm.trim() === store.name;
  const projects = store.attachments;
  const submit = async () => {
    setErr(null);
    try {
      const r = await restore({ sid: store.id, orgId, source: { backupId: backup.id }, mode, confirm: confirm.trim(), newName: mode === 'new' ? newName.trim() : undefined, database: store.kind === 'postgres' && mode === 'in-place' ? database : undefined }).unwrap();
      if (r) onDone(r); else setErr(t('storage.err.unknown'));
    } catch (e) { setErr(storageErrorText(t, e)); }
  };
  return (
    <Dialog aria-label={t('storage.restore.title')} data-testid="restore-dialog">
      <Row><h3>{t('storage.restore.title')}</h3><Spacer /><Button size="small" variant="text" onClick={onClose}>{t('storage.cancel')}</Button></Row>
      <Help>{t('storage.restore.source', { when: when(backup.startedAt), id: backup.id })}</Help>
      <div role="radiogroup" aria-label={t('storage.restore.mode')} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Checkbox type="radio" name="restore-mode" checked={mode === 'new'} onChange={() => setMode('new')} label={<span>{t('storage.restore.new', { name: store.name })}</span>} />
        <Checkbox type="radio" name="restore-mode" checked={mode === 'in-place'} onChange={() => setMode('in-place')} label={<span>{t('storage.restore.in_place', { db: database, n: projects.length }, projects.length)}</span>} />
      </div>
      {mode === 'new' && (
        <Field>
          <FieldLabel htmlFor="restore-new-name">{t('storage.restore.new_name')}</FieldLabel>
          <Input id="restore-new-name" value={newName} autoCapitalize="none" spellCheck={false} onChange={(e) => setNewName(e.target.value)} aria-invalid={!!nameProblem} />
          <HelperText $error={!!nameProblem}>{nameProblem ? t('storage.create.name_invalid') : t('storage.restore.new_name_help')}</HelperText>
        </Field>
      )}
      {mode === 'in-place' && store.kind === 'postgres' && databases.length > 1 && (
        <Field>
          <FieldLabel htmlFor="restore-database">{t('storage.connect.database')}</FieldLabel>
          <Select id="restore-database" value={database} onChange={(e) => setDatabase(e.target.value)}>{databases.map((d) => <option key={d} value={d}>{d}</option>)}</Select>
        </Field>
      )}
      {mode === 'in-place' && projects.length > 0 && (
        <Alert $tone="warning">{t('storage.restore.affects')} {projects.map((p) => <Mono key={p.projectId} style={{ marginRight: 8 }}>{p.org && p.repoName ? `${p.org}/${p.repoName}` : p.projectId}</Mono>)}</Alert>
      )}
      <Field>
        <FieldLabel htmlFor="restore-confirm">{t('storage.confirm_name')}</FieldLabel>
        <Input id="restore-confirm" value={confirm} placeholder={store.name} autoCapitalize="none" autoComplete="off" spellCheck={false} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      {err && <Alert $tone="error">{err}</Alert>}
      <Actions>
        <Button variant="contained" color={mode === 'in-place' ? 'secondary' : 'primary'} size="small" loading={restoring.isLoading} disabled={!confirmed || !!nameProblem} onClick={() => void submit()}>
          {mode === 'new' ? t('storage.restore.run_new') : t('storage.restore.run_in_place')}
        </Button>
      </Actions>
    </Dialog>
  );
}
