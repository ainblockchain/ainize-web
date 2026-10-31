/**
 * Connect a store to a project — Vercel's "Connect Project" sheet, in place: pick one of the organization's stores of
 * the right kind, or **Create new** (the name prefilled with the binding's, the kind fixed by ainize.json); the env
 * prefix (asked for from the second store of a kind); the database (Postgres, default `app`); a preview of the
 * variable names the app will get; and a redeploy so the values arrive now.
 *
 * Create new runs in two steps the node asks for: `POST /api/orgs/:id/stores` (the store comes back `provisioning`)
 * and, once it polls `ready`, `POST /api/stores/:sid/attachments`. The screen says which step it is on.
 */
import { useEffect, useMemo, useState } from 'react';
import { useConnectStoreMutation, useCreateStoreMutation, useStoreQuery } from '@/api/api';
import {
  databaseNameProblem, DEFAULT_DATABASE, defaultEngineOf, defaultStoreChoiceOf, engineKindOf, envNamesOf, envPrefixProblem, STORE_ENGINES, STORE_KINDS, storeEnvPrefixOf, storeNameProblem, wouldBeFirstOfKind,
  type AttachedStore, type DeclaredBinding, type OrgStoreSummary, type StoreEngine, type StoreKind,
} from '@/api/projectStorage';
import type { Project, Queued } from '@/api/projects';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select } from '@/components/ui/Form';
import { Mono } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { Actions, Dialog, EnvChip, EnvChips, Grid, Help, KindChip, Meta, Row, Spacer, StatusDot, storageErrorText } from './common';

type Mode = 'existing' | 'new';

export default function ConnectStoreDialog({ project, orgId, binding, declared, orgStores, attached, onDone, onClose }: {
  project: Project;
  orgId: string | null;
  /** The ainize.json entry being connected, or null for a free connection (the binding is named here). */
  binding: DeclaredBinding | null;
  /** Everything ainize.json declares, in its order — which binding is the first of its kind follows it (`storesEnv`). */
  declared: DeclaredBinding[];
  orgStores: OrgStoreSummary[];
  attached: AttachedStore[];
  onDone: (q: Queued | null) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const fixedKind = binding?.kind ?? null;
  const candidates = useMemo(() => orgStores.filter((s) => (!fixedKind || s.kind === fixedKind) && !attached.some((a) => a.store.id === s.id)), [orgStores, fixedKind, attached]);
  const [mode, setMode] = useState<Mode>(candidates.length ? 'existing' : 'new');
  const [storeId, setStoreId] = useState<string>(defaultStoreChoiceOf(candidates, binding?.name ?? null));
  const [kind, setKind] = useState<StoreKind>(fixedKind ?? 'postgres');
  const [newName, setNewName] = useState(binding?.name ?? '');
  const [engine, setEngine] = useState<StoreEngine>(defaultEngineOf(fixedKind ?? 'postgres'));
  const [bindingName, setBindingName] = useState(binding?.name ?? '');
  const [prefix, setPrefix] = useState(binding?.env ?? '');
  const [database, setDatabase] = useState(DEFAULT_DATABASE);
  const [redeploy, setRedeploy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [createStore, creating] = useCreateStoreMutation();
  const [connect, connecting] = useConnectStoreMutation();
  const [pendingStoreId, setPendingStoreId] = useState<string | null>(null);
  const pending = useStoreQuery(pendingStoreId ?? '', { skip: !pendingStoreId, pollingInterval: 2000 });

  const chosen = candidates.find((s) => s.id === storeId) ?? null;
  const effectiveKind: StoreKind = mode === 'existing' ? (chosen?.kind ?? kind) : fixedKind ?? engineKindOf(engine);
  const effectiveBinding = (binding?.name ?? bindingName.trim()) || (mode === 'existing' ? chosen?.name ?? '' : newName.trim());
  const effectivePrefix = prefix.trim() || storeEnvPrefixOf(effectiveBinding || 'store');
  const firstOfKind = wouldBeFirstOfKind({ binding: effectiveBinding, kind: effectiveKind }, attached, declared);
  const preview = effectiveBinding ? envNamesOf(effectiveKind, effectivePrefix, firstOfKind) : [];
  const nameProblem = mode === 'new' ? storeNameProblem(newName.trim()) : null;
  const bindingProblem = binding ? null : storeNameProblem(effectiveBinding);
  const prefixProblem = envPrefixProblem(prefix.trim());
  const dbProblem = effectiveKind === 'postgres' ? databaseNameProblem(database.trim()) : null;
  const deploys = !!project.lastDeploymentId;
  const busy = creating.isLoading || connecting.isLoading || !!pendingStoreId;

  const attach = async (sid: string) => {
    const r = await connect({
      sid, projectId: project.id, orgId, binding: effectiveBinding, envPrefix: prefix.trim() || undefined,
      database: effectiveKind === 'postgres' && database.trim() !== DEFAULT_DATABASE ? database.trim() : undefined, redeploy: deploys && redeploy,
    }).unwrap();
    onDone(r.redeploy);
  };
  const submit = async () => {
    setErr(null);
    if (nameProblem || bindingProblem || prefixProblem || dbProblem) return;
    try {
      if (mode === 'existing') { if (chosen) await attach(chosen.id); return; }
      if (!orgId) { setErr(t('storage.err.storage_not_allowed')); return; }
      const created = await createStore({ orgId, name: newName.trim(), kind: effectiveKind, engine }).unwrap();
      if (!created) { setErr(t('storage.err.unknown')); return; }
      setPendingStoreId(created.id);
    } catch (e) { setErr(storageErrorText(t, e)); }
  };
  // the second step of Create new: connect as soon as the store is ready; stop on error
  useEffect(() => {
    const s = pending.data;
    if (!pendingStoreId || !s) return;
    if (s.status === 'ready') { setPendingStoreId(null); attach(s.id).catch((e) => setErr(storageErrorText(t, e))); }
    else if (s.status === 'error') { setPendingStoreId(null); setErr(s.error ?? t('storage.status.error')); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.data, pendingStoreId]);

  return (
    <Dialog aria-label={t('storage.connect.title')} data-testid="connect-store-dialog">
      <Row>
        <h3>{binding ? t('storage.connect.title_binding', { name: binding.name }) : t('storage.connect.title')}</h3>
        {fixedKind && <KindChip kind={fixedKind} />}
        <Spacer />
        <Button size="small" variant="text" onClick={onClose}>{t('storage.cancel')}</Button>
      </Row>
      <Row role="radiogroup" aria-label={t('storage.connect.source')}>
        <Checkbox label={t('storage.connect.existing')} type="radio" name="connect-mode" checked={mode === 'existing'} disabled={!candidates.length} onChange={() => setMode('existing')} />
        <Checkbox label={t('storage.connect.create_new')} type="radio" name="connect-mode" checked={mode === 'new'} onChange={() => setMode('new')} />
      </Row>
      {mode === 'existing' && (
        <Field>
          <FieldLabel htmlFor="connect-store">{t('storage.connect.pick')}</FieldLabel>
          <Select id="connect-store" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {!chosen && <option value="">—</option>}
            {candidates.map((s) => <option key={s.id} value={s.id} disabled={s.status !== 'ready'}>{s.name} — {t(`storage.kind.${s.kind}`)}{s.status !== 'ready' ? ` (${t(`storage.status.${s.status}`)})` : ''}</option>)}
          </Select>
          {chosen && <Row><StatusDot status={chosen.status} /><Meta>{t(`storage.status.${chosen.status}`)}</Meta></Row>}
          {!candidates.length && <HelperText>{t('storage.connect.none_of_kind')}</HelperText>}
        </Field>
      )}
      {mode === 'new' && (
        <Grid>
          <Field>
            <FieldLabel htmlFor="connect-new-name">{t('storage.create.name')}</FieldLabel>
            <Input id="connect-new-name" value={newName} placeholder={binding?.name ?? 'db'} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setNewName(e.target.value)} aria-invalid={!!newName && !!nameProblem} />
            <HelperText $error={!!newName && !!nameProblem}>{newName && nameProblem ? t('storage.create.name_invalid') : t('storage.create.name_help')}</HelperText>
          </Field>
          {!fixedKind && (
            <Field>
              <FieldLabel htmlFor="connect-new-kind">{t('storage.create.kind')}</FieldLabel>
              <Select id="connect-new-kind" value={kind} onChange={(e) => { const k = e.target.value as StoreKind; setKind(k); setEngine(defaultEngineOf(k)); }}>
                {STORE_KINDS.map((k) => <option key={k} value={k}>{t(`storage.kind.${k}`)}</option>)}
              </Select>
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="connect-new-engine">{t('storage.create.engine')}</FieldLabel>
            <Select id="connect-new-engine" value={engine} onChange={(e) => setEngine(e.target.value as StoreEngine)}>
              {STORE_ENGINES.filter((e) => engineKindOf(e) === (fixedKind ?? kind)).map((e) => <option key={e} value={e}>{t(`storage.engine.${e}`)}</option>)}
            </Select>
          </Field>
        </Grid>
      )}
      <Grid>
        {!binding && (
          <Field>
            <FieldLabel htmlFor="connect-binding">{t('storage.connect.binding')}</FieldLabel>
            <Input id="connect-binding" value={bindingName} placeholder={mode === 'existing' ? chosen?.name ?? 'db' : newName || 'db'} autoCapitalize="none" spellCheck={false} onChange={(e) => setBindingName(e.target.value)} />
            <HelperText>{t('storage.connect.binding_help')}</HelperText>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="connect-prefix">{t('storage.connect.prefix')}</FieldLabel>
          <Input id="connect-prefix" value={prefix} placeholder={storeEnvPrefixOf(effectiveBinding || 'store')} autoCapitalize="characters" spellCheck={false} onChange={(e) => setPrefix(e.target.value.toUpperCase())} aria-invalid={!!prefixProblem} />
          <HelperText $error={!!prefixProblem}>{prefixProblem ? t('storage.connect.prefix_invalid') : firstOfKind ? t('storage.connect.prefix_first') : t('storage.connect.prefix_second')}</HelperText>
        </Field>
        {effectiveKind === 'postgres' && (
          <Field>
            <FieldLabel htmlFor="connect-database">{t('storage.connect.database')}</FieldLabel>
            <Input id="connect-database" value={database} autoCapitalize="none" spellCheck={false} onChange={(e) => setDatabase(e.target.value)} aria-invalid={!!dbProblem} />
            <HelperText $error={!!dbProblem}>{dbProblem ? t('storage.connect.database_invalid') : t('storage.connect.database_help')}</HelperText>
          </Field>
        )}
      </Grid>
      {preview.length > 0 && (
        <div>
          <Meta>{t('storage.connect.preview')}</Meta>
          <EnvChips style={{ marginTop: 6 }}>{preview.map((n) => <EnvChip key={n}>{n}</EnvChip>)}</EnvChips>
        </div>
      )}
      {bindingProblem && effectiveBinding && <HelperText $error>{t('storage.create.name_invalid')}</HelperText>}
      {pendingStoreId && <Alert $tone="info" aria-live="polite">{t('storage.connect.creating', { name: newName.trim() })} <Mono>{pending.data?.status ?? '…'}</Mono></Alert>}
      {err && <Alert $tone="error">{err}</Alert>}
      <Actions>
        <Button variant="contained" size="small" loading={busy} onClick={() => void submit()} disabled={!effectiveBinding || !!nameProblem || !!bindingProblem || !!prefixProblem || !!dbProblem || (mode === 'existing' && chosen?.status !== 'ready')}>
          {mode === 'new' ? t('storage.connect.create_and_connect') : t('storage.connect')}
        </Button>
        {deploys ? <Checkbox label={t('storage.connect.redeploy')} checked={redeploy} onChange={(e) => setRedeploy(e.target.checked)} /> : <Help>{t('storage.connect.no_deployment')}</Help>}
      </Actions>
    </Dialog>
  );
}
