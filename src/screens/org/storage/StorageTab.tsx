/**
 * Organization settings → Storage (src/api/projectStorage.ts) — Vercel's Storage page for one organization:
 *
 *   Stores               one card per store — status dot, name (→ the store's page), kind, engine, size, the projects
 *                        connected to it, the last backup; polled while one is provisioning, restoring or deleting.
 *   Create store         (write) Vercel's "Create Database": the name checked as it is typed (the node's rule), the
 *                        kind, the engine (Postgres 16 · Postgres 16 + pgvector · Blob), memory / CPUs within the
 *                        node's limits, Postgres extensions, the daily backup hour; on success the store's page opens.
 *   Backups to AinDrive  (admin) the organization's drive id (pre-filled when the node names a default) and Connect
 *                        AinDrive: OAuth on AinDrive, back through AindriveCallbackPage; the node keeps and refreshes the
 *                        grant. Or a refresh token pasted (never shown again). Reconnect when the grant died; Clear.
 *   Deleted stores       stores that are gone, with the backups they left and where those are on the drive.
 *
 * Any member reads; the node refuses the rest and its refusals are shown as they come back. A node without managed
 * storage (503 `storage_off`), an organization the operator did not allow (403) and a node from before storage (404)
 * each get one sentence instead of the page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useClearOrgBackupTargetMutation, useConnectOrgBackupTargetMutation, useCreateStoreMutation, useOrgStoresQuery, useSetOrgBackupTargetMutation } from '@/api/api';
import { roleAtLeast, type OrgProfile } from '@/api/organizations';
import {
  AINDRIVE_CONNECT_ORG_KEY, BACKUP_TZ, bytesLabel, defaultEngineOf, driveBackupUrl, engineKindOf, storageApiErrorOf, STORE_ENGINES, STORE_KINDS, storeIsBusy, storeNameProblem, unwrapUncached,
  type OrgStoresResponse, type Store, type StoreEngine, type StoreKind,
} from '@/api/projectStorage';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select } from '@/components/ui/Form';
import { ExternalLink, Mono, StyledLink } from '@/components/ui/Misc';
import { Actions, Card, Cards, Chip, Dialog, Grid, Help, KindChip, Meta, Name, Panel, Row, Spacer, StatusChip, StatusDot, storageErrorText, useForgetMutationArgs, when } from '@/components/storage/common';
import { useT } from '@/i18n';
import { storePath } from '@/lib/reservedRoutes';

/** `1g`, `512m`, `1.5g` — what `docker run --memory` takes and the node accepts. */
export const MEMORY = /^\d+(\.\d+)?[mMgG]$/;
/** `4g` → bytes, for the limit check (null when it cannot be read). */
export function memoryBytes(v: string): number | null {
  const m = /^(\d+(?:\.\d+)?)([mMgG])$/.exec(v.trim());
  if (!m) return null;
  return Number(m[1]) * (m[2]!.toLowerCase() === 'g' ? 1024 ** 3 : 1024 ** 2);
}

function StoreRowCard({ store }: { store: Store }) {
  const { t } = useT();
  const n = store.attachedProjects.length;
  return (
    <Card data-testid={`org-store-${store.id}`}>
      <Row>
        <StatusDot status={store.status} />
        <StyledLink to={storePath(store.orgId, store.id)}><Name>{store.name}</Name></StyledLink>
        <KindChip kind={store.kind} />
        <Spacer />
        <StatusChip status={store.status} />
      </Row>
      <Row>
        <Meta>{t(`storage.engine.${store.engine}`)}</Meta>
        <Meta>· {store.usage ? bytesLabel(store.usage.bytes) : '—'}</Meta>
        <Meta>· {t('storage.org.projects', { n }, n)}</Meta>
        <Meta>· {store.lastBackup ? t('storage.org.last_backup', { when: when(store.lastBackup.startedAt) }) : t('storage.backups.none_yet')}</Meta>
        {store.warning && <Chip $tone="warn">{t(`storage.warning.${store.warning}`)}</Chip>}
      </Row>
      {store.status === 'error' && store.error && <Alert $tone="error">{store.error}</Alert>}
    </Card>
  );
}

function CreateStoreDialog({ orgId, data, onClose }: { orgId: string; data: OrgStoresResponse; onClose: () => void }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [create, creating] = useCreateStoreMutation();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<StoreKind>('postgres');
  const [engine, setEngine] = useState<StoreEngine>(defaultEngineOf('postgres'));
  const [memory, setMemory] = useState('');
  const [cpus, setCpus] = useState('');
  const [extensions, setExtensions] = useState<string[]>([]);
  const [hour, setHour] = useState(4);
  const [err, setErr] = useState<string | null>(null);
  const trimmed = name.trim();
  const nameProblem = storeNameProblem(trimmed);
  const taken = data.stores.some((s) => s.name === trimmed);
  const { limits } = data;
  const memoryProblem = memory.trim() !== '' && (!MEMORY.test(memory.trim()) || (limits.memoryMax && (memoryBytes(memory) ?? 0) > (memoryBytes(limits.memoryMax) ?? Infinity)));
  const cpusProblem = cpus.trim() !== '' && (!(Number(cpus) > 0) || (limits.cpusMax !== null && Number(cpus) > limits.cpusMax));
  const full = limits.perOrg !== null && data.stores.length >= limits.perOrg;
  const extensionsOffered = kind === 'postgres' ? limits.extensions.filter((e) => e !== 'vector' || engine === 'postgres16-pgvector') : [];

  const submit = async () => {
    setErr(null);
    if (nameProblem || taken || memoryProblem || cpusProblem) return;
    try {
      const resources = { ...(memory.trim() ? { memory: memory.trim().toLowerCase() } : {}), ...(cpus.trim() ? { cpus: Number(cpus) } : {}) };
      const store = await create({
        orgId, name: trimmed, kind, engine,
        ...(Object.keys(resources).length ? { resources } : {}),
        ...(kind === 'postgres' && extensions.length ? { extensions } : {}),
        backups: { schedule: 'daily', hour },
      }).unwrap();
      if (store) navigate(storePath(store.orgId || orgId, store.id)); else onClose();
    } catch (e) {
      const code = storageApiErrorOf(e).code;
      setErr(code === 'name_taken' ? t('storage.err.name_taken') : storageErrorText(t, e));
    }
  };

  return (
    <Dialog aria-label={t('storage.create')} data-testid="create-store-dialog">
      <Row><h3>{t('storage.create.title')}</h3><Spacer /><Button size="small" variant="text" onClick={onClose}>{t('storage.cancel')}</Button></Row>
      {full && <Alert $tone="warning">{t('storage.err.too_many_stores')}</Alert>}
      <Row role="radiogroup" aria-label={t('storage.create.kind')}>
        {STORE_KINDS.map((k) => (
          <Checkbox key={k} type="radio" name="create-kind" checked={kind === k} onChange={() => { setKind(k); setEngine(defaultEngineOf(k)); setExtensions([]); }}
            label={<span><strong>{t(`storage.kind.${k}`)}</strong> <Meta>— {t(`storage.create.kind_help.${k}`)}</Meta></span>} />
        ))}
      </Row>
      <Grid>
        <Field>
          <FieldLabel htmlFor="create-store-name">{t('storage.create.name')}</FieldLabel>
          <Input id="create-store-name" value={name} placeholder={kind === 'postgres' ? 'app-db' : 'app-files'} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus
            onChange={(e) => setName(e.target.value)} aria-invalid={!!trimmed && (!!nameProblem || taken)} />
          <HelperText $error={!!trimmed && (!!nameProblem || taken)}>{trimmed && nameProblem ? t('storage.create.name_invalid') : taken ? t('storage.err.name_taken') : t('storage.create.name_help')}</HelperText>
        </Field>
        <Field>
          <FieldLabel htmlFor="create-store-engine">{t('storage.create.engine')}</FieldLabel>
          <Select id="create-store-engine" value={engine} onChange={(e) => { setEngine(e.target.value as StoreEngine); setExtensions([]); }}>
            {STORE_ENGINES.filter((e) => engineKindOf(e) === kind).map((e) => <option key={e} value={e}>{t(`storage.engine.${e}`)}</option>)}
          </Select>
          {trimmed && !nameProblem && <HelperText>{t('storage.create.host', { host: `${trimmed}.store.internal:${kind === 'postgres' ? 5432 : 9000}` })}</HelperText>}
        </Field>
        <Field>
          <FieldLabel htmlFor="create-store-memory">{t('storage.settings.memory')}</FieldLabel>
          <Input id="create-store-memory" value={memory} placeholder="1g" onChange={(e) => setMemory(e.target.value)} aria-invalid={!!memoryProblem} />
          <HelperText $error={!!memoryProblem}>{limits.memoryMax ? t('storage.create.memory_max', { max: limits.memoryMax }) : t('storage.create.memory_help')}</HelperText>
        </Field>
        <Field>
          <FieldLabel htmlFor="create-store-cpus">{t('storage.settings.cpus')}</FieldLabel>
          <Input id="create-store-cpus" type="number" min={0.25} step={0.25} value={cpus} placeholder="1" onChange={(e) => setCpus(e.target.value)} aria-invalid={!!cpusProblem} />
          <HelperText $error={!!cpusProblem}>{limits.cpusMax !== null ? t('storage.create.cpus_max', { max: limits.cpusMax }) : t('storage.create.memory_help')}</HelperText>
        </Field>
        <Field>
          <FieldLabel htmlFor="create-store-hour">{t('storage.backups.hour')}</FieldLabel>
          <Input id="create-store-hour" type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Math.max(0, Math.min(23, Math.floor(Number(e.target.value) || 0))))} />
          <HelperText>{t('storage.create.backup_help', { hour, tz: BACKUP_TZ })}</HelperText>
        </Field>
      </Grid>
      {extensionsOffered.length > 0 && (
        <Field role="group" aria-labelledby="create-store-extensions">
          <FieldLabel as="span" id="create-store-extensions">{t('storage.create.extensions')}</FieldLabel>
          <Row>{extensionsOffered.map((x) => <Checkbox key={x} label={<Mono>{x}</Mono>} checked={extensions.includes(x)} onChange={(e) => setExtensions((cur) => (e.target.checked ? [...cur, x] : cur.filter((y) => y !== x)))} />)}</Row>
        </Field>
      )}
      {err && <Alert $tone="error">{err}</Alert>}
      <Actions>
        <Button variant="contained" size="small" loading={creating.isLoading} disabled={!trimmed || !!nameProblem || taken || !!memoryProblem || !!cpusProblem || full} onClick={() => void submit()}>{t('storage.create')}</Button>
        <Help>{t('storage.create.after')}</Help>
      </Actions>
    </Dialog>
  );
}

function BackupTargetPanel({ orgId, data, admin }: { orgId: string; data: OrgStoresResponse; admin: boolean }) {
  const { t } = useT();
  const target = data.backupDrive;
  const [search, setSearch] = useSearchParams();
  const [setTarget, setting] = useSetOrgBackupTargetMutation();
  useForgetMutationArgs(setting);
  const [connect, connecting] = useConnectOrgBackupTargetMutation();
  const [clearTarget, clearing] = useClearOrgBackupTargetMutation();
  const [driveId, setDriveId] = useState(target.driveId ?? target.defaultDriveId ?? '');
  const [refreshToken, setRefreshToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [manual, setManual] = useState(false);
  const [editing, setEditing] = useState(!target.configured);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(search.get('aindrive') === 'connected' ? t('storage.org.target_connected', { drive: target.driveId ?? '' }) : null);
  useEffect(() => { setEditing(!target.configured); setDriveId(target.driveId ?? target.defaultDriveId ?? ''); }, [target.configured, target.driveId, target.defaultDriveId]);
  useEffect(() => {
    // the callback page sent us back here: say so once, then drop the marker from the address
    if (search.get('aindrive') !== 'connected') return;
    const next = new URLSearchParams(search); next.delete('aindrive'); setSearch(next, { replace: true });
  }, [search, setSearch]);
  const startConnect = async () => {
    setErr(null); setNote(null);
    try {
      const r = await connect({ orgId, driveId: driveId.trim() }).unwrap();
      try { sessionStorage.setItem(AINDRIVE_CONNECT_ORG_KEY, orgId); } catch { /* the callback falls back to the node's answer */ }
      window.location.assign(r.authorizeUrl);
    } catch (e) { setErr(storageErrorText(t, e)); }
  };
  const save = async () => {
    setErr(null); setNote(null);
    // the refresh token: out of the Redux store as soon as the node answers, and out of the hook (useForgetMutationArgs)
    try { const r = await unwrapUncached(setTarget({ orgId, driveId: driveId.trim(), refreshToken: refreshToken.trim(), clientId: clientId.trim() || undefined })); setRefreshToken(''); setManual(false); setNote(t('storage.org.target_saved', { drive: r.driveId })); }
    catch (e) { setErr(storageErrorText(t, e)); }
  };
  const clear = async () => {
    if (!window.confirm(t('storage.org.target_clear_confirm'))) return;
    setErr(null); setNote(null);
    try { await clearTarget({ orgId }).unwrap(); } catch (e) { setErr(storageErrorText(t, e)); }
  };
  const chip = !target.configured ? <Chip $tone="muted">{t('storage.org.target_none')}</Chip>
    : target.needsReconnect ? <Chip $tone="warn">{t('storage.org.target_reconnect_needed')}</Chip>
    : target.lastError ? <Chip $tone="warn">{t('storage.org.target_failing')}</Chip>
    : <Chip $tone="ok">{t('storage.org.target_ok')}</Chip>;
  return (
    <Panel data-testid="org-backup-target">
      <Row><h3>{t('storage.org.target')}</h3><Spacer />{chip}</Row>
      <Help>{t('storage.org.target_help')}</Help>
      {target.configured && (
        <Row>
          <Meta>{t('storage.org.drive')}: <Mono>{target.driveId}</Mono></Meta>
          {target.driveId && <ExternalLink href={driveBackupUrl(target.driveId, 'ainize-storage/x', target.origin ?? undefined)} target="_blank" rel="noreferrer">ainize-storage/ ↗</ExternalLink>}
          {target.lastOkAt && <Meta>· {t('storage.org.target_last_ok', { when: when(target.lastOkAt) })}</Meta>}
          {target.auth === 'grant' && !target.needsReconnect && target.refreshExpiresAt && <Meta>· {t('storage.org.target_grant_until', { when: when(target.refreshExpiresAt) })}</Meta>}
        </Row>
      )}
      {target.lastError && <Alert $tone="error">{t('storage.backups.drive_error', { error: target.lastError })}</Alert>}
      {target.configured && target.auth === 'token' && <Alert $tone="warning">{t('storage.org.target_token_legacy')}</Alert>}
      {!target.configured && !admin && <Alert $tone="warning">{t('storage.backups.drive_missing')}</Alert>}
      {admin && (editing || target.needsReconnect) && (
        <Grid>
          <Field>
            <FieldLabel htmlFor="target-drive">{t('storage.org.drive')}</FieldLabel>
            <Input id="target-drive" value={driveId} autoCapitalize="none" spellCheck={false} onChange={(e) => setDriveId(e.target.value)} />
            {target.defaultDriveId && <HelperText>{t('storage.org.drive_default', { drive: target.defaultDriveId })}</HelperText>}
          </Field>
          {manual && (
            <>
              <Field>
                <FieldLabel htmlFor="target-refresh">{t('storage.org.refresh_token')}</FieldLabel>
                <Input id="target-refresh" type="password" value={refreshToken} placeholder="aind_art_…" autoComplete="new-password" spellCheck={false} onChange={(e) => setRefreshToken(e.target.value)} />
                <HelperText>{t('storage.org.refresh_token_help')}</HelperText>
              </Field>
              <Field>
                <FieldLabel htmlFor="target-client">{t('storage.org.client_id')}</FieldLabel>
                <Input id="target-client" value={clientId} placeholder="aind_client_…" autoCapitalize="none" spellCheck={false} onChange={(e) => setClientId(e.target.value)} />
                <HelperText>{t('storage.org.client_id_help')}</HelperText>
              </Field>
            </>
          )}
        </Grid>
      )}
      {err && <Alert $tone="error">{err}</Alert>}
      {note && <Alert $tone="success">{note}</Alert>}
      {admin && (
        <Actions>
          {(editing || target.needsReconnect) && !manual && <Button size="small" variant="contained" loading={connecting.isLoading} disabled={!driveId.trim()} onClick={() => void startConnect()}>{target.configured ? t('storage.org.target_reconnect') : t('storage.org.target_connect')}</Button>}
          {(editing || target.needsReconnect) && manual && <Button size="small" variant="contained" loading={setting.isLoading} disabled={!driveId.trim() || refreshToken.trim().length < 8} onClick={() => void save()}>{t('storage.org.target_save')}</Button>}
          {(editing || target.needsReconnect) && <Button size="small" variant="text" onClick={() => { setManual(!manual); setRefreshToken(''); }}>{manual ? t('storage.org.target_use_connect') : t('storage.org.target_use_refresh')}</Button>}
          {!editing && !target.needsReconnect && <Button size="small" onClick={() => setEditing(true)}>{t('storage.org.target_change')}</Button>}
          {editing && target.configured && <Button size="small" variant="text" onClick={() => { setEditing(false); setManual(false); setRefreshToken(''); }}>{t('storage.cancel')}</Button>}
          {target.configured && <Button size="small" variant="text" color="secondary" loading={clearing.isLoading} onClick={() => void clear()}>{t('storage.org.target_clear')}</Button>}
        </Actions>
      )}
    </Panel>
  );
}

export default function StorageTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const write = roleAtLeast(org.my_role, 'write');
  const admin = roleAtLeast(org.my_role, 'admin');
  const [busy, setBusy] = useState(false);
  const q = useOrgStoresQuery(org.id, { pollingInterval: busy ? 3000 : 30_000, skipPollingIfUnfocused: true });
  const data = q.data;
  useEffect(() => { setBusy(!!data?.stores.some(storeIsBusy)); }, [data]);
  const [creating, setCreating] = useState(false);
  const deleted = useMemo(() => data?.deletedStores ?? [], [data]);

  if (q.isLoading && !data) return <Panel><Help>{t('storage.loading')}</Help></Panel>;
  if (q.error && !data) {
    const e = storageApiErrorOf(q.error);
    const text = e.code === 'not_found' ? t('storage.not_on_node') : storageErrorText(t, q.error);
    return <Panel data-testid="org-storage-off"><h2>{t('storage.title')}</h2><Alert $tone={e.code === 'storage_off' || e.code === 'storage_not_allowed' || e.code === 'not_found' ? 'info' : 'error'}>{text}</Alert>{e.code === 'storage_off' && <Help>{t('storage.off_help')}</Help>}</Panel>;
  }
  if (!data) return null;

  return (
    <div data-testid="org-storage">
      <Panel>
        <Row>
          <h2>{t('storage.title')}</h2>
          <Spacer />
          {write && !creating && <Button size="small" variant="contained" onClick={() => setCreating(true)}>{t('storage.create')}</Button>}
        </Row>
        <Help>{t('storage.lede')}</Help>
        {data.limits.perOrg !== null && <Meta>{t('storage.org.count', { n: data.stores.length, max: data.limits.perOrg })}</Meta>}
        {creating && <CreateStoreDialog orgId={org.id} data={data} onClose={() => setCreating(false)} />}
        {data.stores.length === 0
          ? <Help data-testid="org-storage-empty">{t('storage.org.empty')}</Help>
          : <Cards>{data.stores.map((s) => <StoreRowCard key={s.id} store={s} />)}</Cards>}
      </Panel>
      <BackupTargetPanel orgId={org.id} data={data} admin={admin} />
      {deleted.length > 0 && (
        <Panel data-testid="org-deleted-stores">
          <h3>{t('storage.org.deleted')}</h3>
          <Help>{t('storage.org.deleted_help')}</Help>
          {deleted.map((d) => (
            <Card key={d.storeId}>
              <Row><Name>{d.name ?? d.storeId}</Name><KindChip kind={d.kind} /><Meta><Mono>{d.storeId}</Mono></Meta></Row>
              {d.backups.length === 0 ? <Help>{t('storage.backups.empty')}</Help> : (
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                  {d.backups.map((b) => (
                    <li key={b.id}>
                      {when(b.startedAt)} · {t(`storage.backups.kind.${b.trigger}`)} · {bytesLabel(b.bytes)}{' '}
                      {b.drive && 'driveId' in b.drive ? <ExternalLink href={driveBackupUrl(b.drive.driveId, b.drive.path, data.backupDrive.origin ?? undefined)} target="_blank" rel="noreferrer"><Mono>{b.drive.path}</Mono> ↗</ExternalLink> : <Meta>{t('storage.backups.nas_only')}</Meta>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </Panel>
      )}
    </div>
  );
}
