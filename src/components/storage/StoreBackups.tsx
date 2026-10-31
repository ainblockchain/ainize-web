/**
 * The store page's Backups tab — Vercel's backups table: when, what started it, size, checksum, where the copy is
 * (the NAS, the organization's AinDrive with a link), and Restore… / Delete for an admin. **Back up now** (write),
 * the schedule and retention editor (write), the banners the node's state asks for (no drive target, a dump too large
 * for the drive, a token that stopped working), and **Undo restore** for seven days after an in-place restore.
 */
import { useState } from 'react';
import { useDeleteStoreBackupMutation, useRunStoreBackupMutation, useStoreBackupsQuery, useUndoRestoreMutation, useUpdateStoreMutation } from '@/api/api';
import { bytesLabel, nextBackupAt, type BackupSchedule, type RestoreResult, type StoreBackup, type StoreDetail } from '@/api/projectStorage';
import type { OrgRole } from '@/api/organizations';
import { roleAtLeast } from '@/api/organizations';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, Input, Select } from '@/components/ui/Form';
import { ExternalLink, Mono, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import RestoreDialog from './RestoreDialog';
import { driveBackupUrl } from '@/api/projectStorage';
import { Actions, Chip, Grid, Help, Meta, Panel, Row, SimpleTable, Spacer, shortSha, storageErrorText, when } from './common';

function DriveCell({ b, origin }: { b: StoreBackup; origin: string | null }) {
  const { t } = useT();
  if (!b.drive) return <Meta>{t('storage.backups.nas_only')}</Meta>;
  if ('error' in b.drive) return <Chip $tone="warn" title={b.drive.error}>{b.drive.error === 'too_large_for_drive' ? t('storage.backups.too_large') : t('storage.backups.drive_failed')}</Chip>;
  return <ExternalLink href={driveBackupUrl(b.drive.driveId, b.drive.path, origin ?? undefined)} target="_blank" rel="noreferrer">AinDrive ↗</ExternalLink>;
}

export default function StoreBackups({ store, orgId, role, onRestored }: { store: StoreDetail; orgId: string; role: OrgRole | null; onRestored?: (r: RestoreResult) => void }) {
  const { t } = useT();
  const write = roleAtLeast(role, 'write');
  const admin = roleAtLeast(role, 'admin');
  const q = useStoreBackupsQuery(store.id, { pollingInterval: 5000, skipPollingIfUnfocused: true });
  const [runBackup, running] = useRunStoreBackupMutation();
  const [del] = useDeleteStoreBackupMutation();
  const [update, updating] = useUpdateStoreMutation();
  const [undo, undoing] = useUndoRestoreMutation();
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<StoreBackup | null>(null);
  const settings = q.data?.schedule ?? store.backups;
  const [draft, setDraft] = useState<{ schedule: BackupSchedule; hour: number; retainDays: number; retainCount: number } | null>(null);
  const form = draft ?? { schedule: settings.schedule, hour: settings.hour, retainDays: settings.retainDays, retainCount: settings.retainCount };
  const rows = q.data?.backups ?? [];
  const inProgress = rows.some((b) => b.status === 'running');
  const drive = q.data?.drive;
  const next = nextBackupAt({ backups: settings });
  const undoable = store.restores.filter((r) => r.undoUntil > Date.now()).sort((a, b) => b.at - a.at)[0];

  const act = async (fn: () => Promise<unknown>, done?: string) => { setErr(null); setNote(null); try { await fn(); if (done) setNote(done); } catch (e) { setErr(storageErrorText(t, e)); } };

  return (
    <>
      {drive && !drive.configured && (
        <Alert $tone="warning">{t('storage.backups.drive_missing')} {admin && <StyledLink to={`/org/${encodeURIComponent(orgId)}/settings?tab=storage`}>{t('storage.org_link')}</StyledLink>}</Alert>
      )}
      {drive?.lastError && <Alert $tone="error">{t('storage.backups.drive_error', { error: drive.lastError })}</Alert>}
      {store.warning === 'drive_unauthorized' && <Alert $tone="error">{t('storage.warning.drive_unauthorized')}</Alert>}
      {undoable && admin && (
        <Alert $tone="info">
          <Row>
            <span>{t('storage.restore.undo_help', { db: undoable.database, keep: undoable.undoDatabase })}</span>
            <Spacer />
            <Button size="small" loading={undoing.isLoading} onClick={() => void act(() => undo({ sid: store.id }).unwrap(), t('storage.restore.undone'))}>{t('storage.restore.undo', { until: when(undoable.undoUntil) })}</Button>
          </Row>
        </Alert>
      )}
      <Panel>
        <Row>
          <h3>{t('storage.backups.title')}</h3>
          <Meta>{settings.schedule === 'off' ? t('storage.backups.schedule_off') : settings.schedule === 'hourly' ? t('storage.backups.schedule_hourly') : t('storage.backups.schedule', { hour: settings.hour })}{next ? ` · ${t('storage.backups.next', { when: when(next) })}` : ''}</Meta>
          <Spacer />
          {write && <Button size="small" variant="contained" loading={running.isLoading} disabled={inProgress || store.status !== 'ready'} onClick={() => void act(() => runBackup(store.id).unwrap())}>{inProgress ? t('storage.backups.running') : t('storage.backups.now')}</Button>}
        </Row>
        {settings.lastStatus === 'error' && settings.lastError && <Alert $tone="error">{t('storage.backups.last_failed', { error: settings.lastError })}</Alert>}
        {q.error && <Alert $tone="error">{storageErrorText(t, q.error)}</Alert>}
        {err && <Alert $tone="error">{err}</Alert>}
        {note && <Alert $tone="success">{note}</Alert>}
        {rows.length === 0 ? <Help>{t('storage.backups.empty')}</Help> : (
          <SimpleTable data-testid="store-backups">
            <thead><tr><th>{t('storage.backups.when')}</th><th>{t('storage.backups.trigger')}</th><th>{t('storage.backups.size')}</th><th>sha256</th><th>{t('storage.backups.where')}</th><th /></tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} data-testid={`backup-${b.id}`}>
                  <td title={b.id}>{when(b.startedAt)}{b.status !== 'ok' && <> <Chip $tone={b.status === 'running' ? 'busy' : 'warn'}>{t(`storage.backups.status.${b.status}`)}</Chip></>}{b.error && <Meta> {b.error}</Meta>}</td>
                  <td><Chip $tone="muted">{t(`storage.backups.kind.${b.trigger}`)}</Chip>{b.keepUntil && <Meta> {t('storage.backups.kept_until', { when: when(b.keepUntil) })}</Meta>}</td>
                  <td>{bytesLabel(b.bytes)}{b.files.length > 1 && <Meta> · {t('storage.backups.files', { n: b.files.length })}</Meta>}</td>
                  <td><Mono title={b.sha256 ?? undefined}>{shortSha(b.sha256)}</Mono></td>
                  <td>{b.local && <Chip $tone="ok">NAS</Chip>} <DriveCell b={b} origin={drive?.origin ?? null} /></td>
                  <td>
                    <Actions style={{ justifyContent: 'flex-end' }}>
                      {admin && b.status === 'ok' && <Button size="small" onClick={() => setRestoring(b)}>{t('storage.restore.cta')}</Button>}
                      {admin && b.status !== 'running' && <Button size="small" variant="text" color="secondary" onClick={() => { if (window.confirm(t('storage.backups.delete_confirm', { id: b.id }))) void act(() => del({ sid: store.id, backupId: b.id }).unwrap()); }}>{t('storage.backups.delete')}</Button>}
                    </Actions>
                  </td>
                </tr>
              ))}
            </tbody>
          </SimpleTable>
        )}
      </Panel>
      {restoring && <RestoreDialog store={store} backup={restoring} orgId={orgId} onClose={() => setRestoring(null)} onDone={(r) => { setRestoring(null); setNote(r.newStore ? t('storage.restore.started_new', { name: r.newStore.name }) : t('storage.restore.started_in_place')); onRestored?.(r); }} />}
      {write && (
        <Panel>
          <h3>{t('storage.backups.settings')}</h3>
          <Help>{t('storage.backups.settings_help')}</Help>
          <Grid>
            <Field>
              <FieldLabel htmlFor="bk-schedule">{t('storage.backups.schedule_label')}</FieldLabel>
              <Select id="bk-schedule" value={form.schedule} onChange={(e) => setDraft({ ...form, schedule: e.target.value as BackupSchedule })}>
                {(['daily', 'hourly', 'off'] as const).map((s) => <option key={s} value={s}>{t(`storage.backups.schedule_opt.${s}`)}</option>)}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="bk-hour">{t('storage.backups.hour')}</FieldLabel>
              <Input id="bk-hour" type="number" min={0} max={23} value={form.hour} disabled={form.schedule !== 'daily'} onChange={(e) => setDraft({ ...form, hour: Math.max(0, Math.min(23, Math.floor(Number(e.target.value) || 0))) })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bk-days">{t('storage.backups.retain_days')}</FieldLabel>
              <Input id="bk-days" type="number" min={1} max={3650} value={form.retainDays} onChange={(e) => setDraft({ ...form, retainDays: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="bk-count">{t('storage.backups.retain_count')}</FieldLabel>
              <Input id="bk-count" type="number" min={1} max={10000} value={form.retainCount} onChange={(e) => setDraft({ ...form, retainCount: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
            </Field>
          </Grid>
          <Actions>
            <Button size="small" variant="contained" loading={updating.isLoading} disabled={!draft} onClick={() => void act(async () => { await update({ sid: store.id, orgId, backups: form }).unwrap(); setDraft(null); }, t('storage.saved'))}>{t('storage.save')}</Button>
            {draft && <Button size="small" variant="text" onClick={() => setDraft(null)}>{t('storage.cancel')}</Button>}
          </Actions>
        </Panel>
      )}
    </>
  );
}
