/**
 * `/org/:id/storage/:storeId` — one managed store (src/api/projectStorage.ts), modelled on Vercel's store page, four
 * tabs deep-linked through `?tab=`:
 *
 *   Overview   status, engine and image digest, host:port, size, who made it and when, the projects connected to it
 *              (each a link to its console), Stop / Start (admin), and Connect to a project (write).
 *   Data       the data browser — tables, rows and read-only SQL for Postgres; the bucket's objects for Blob.
 *   Backups    the backups table, Back up now, schedule and retention, restore (to a new store or in place) and undo.
 *   Settings   rename, resources (a recreate), Rotate credentials (admin — the connected projects redeploy), the
 *              store's own log, and the danger zone: Delete with the name typed, refused while projects are connected.
 *
 * The caller's role in the organization (`GET /api/orgs/:id`) decides what is offered; the node decides what is
 * allowed and its refusals are shown as they come back. Polled every 3 s while the store is provisioning, restoring,
 * deleting or busy with an operation, every 15 s otherwise.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  useConnectStoreMutation, useDeleteStoreMutation, useMyProjectsQuery, useOrgProjectsQuery, useOrgQuery, useOrgStoresQuery, useRotateStoreMutation, useStoreActionMutation, useStoreLogsQuery,
  useStoreQuery, useUpdateStoreMutation,
} from '@/api/api';
import { parseOrgProfile, roleAtLeast, type OrgRole } from '@/api/organizations';
import { attachedProjectStoragePath, bytesLabel, storeIsBusy, storeNameProblem, type StoreDetail } from '@/api/projectStorage';
import { relativeTime, type Project } from '@/api/projects';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Empty, KeyValue, Mono, PageWrapper, StyledLink, Tabs, Title, TitleRow } from '@/components/ui/Misc';
import StoreBackups from '@/components/storage/StoreBackups';
import StoreDataBrowser from '@/components/storage/StoreDataBrowser';
import { RevealedEnvView, useRevealedEnv } from '@/components/storage/StoreCard';
import { Actions, Chip, DangerPanel, EnvChip, EnvChips, Grid, Help, KindChip, Meta, Panel, Pre, Row, Spacer, StatusChip, storageErrorText, when } from '@/components/storage/common';
import { useT } from '@/i18n';
import { storePath } from '@/lib/reservedRoutes';
import { useTitle } from '@/utils/useTitle';

type Tab = 'overview' | 'data' | 'backups' | 'settings';
const TABS: Tab[] = ['overview', 'data', 'backups', 'settings'];
const Crumbs = styled.nav`font-size: 14px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: ${(p) => p.theme.color.GREY}; margin-bottom: 8px;`;

export default function StorePage() {
  const { id = '', storeId = '' } = useParams<{ id: string; storeId: string }>();
  const { t } = useT();
  const auth = useAuth();
  const [search, setSearch] = useSearchParams();
  const tab: Tab = TABS.includes(search.get('tab') as Tab) ? (search.get('tab') as Tab) : 'overview';
  const orgQ = useOrgQuery(id, { skip: !auth.isSignedIn });
  const org = useMemo(() => parseOrgProfile(orgQ.data), [orgQ.data]);
  const role: OrgRole | null = org?.my_role ?? null;
  const [busy, setBusy] = useState(false);
  const storeQ = useStoreQuery(storeId, { skip: !auth.isSignedIn, pollingInterval: busy ? 3000 : 15_000, skipPollingIfUnfocused: true });
  const store = storeQ.data ?? null;
  useEffect(() => { setBusy(!!store && storeIsBusy(store)); }, [store]);
  useTitle(store ? `${store.name} · ${t('storage.title')}` : t('storage.title'));

  if (auth.loading || (auth.isSignedIn && (orgQ.isLoading || storeQ.isLoading) && !store)) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!auth.isSignedIn) return <PageWrapper><TitleRow><Title>{t('storage.title')}</Title></TitleRow><Empty>{t('storage.sign_in')}</Empty></PageWrapper>;
  if (!store) {
    return (
      <PageWrapper>
        <TitleRow><Title>{t('storage.title')}</Title></TitleRow>
        <Empty data-testid="store-not-found">{storeQ.error ? storageErrorText(t, storeQ.error) : t('storage.err.not_found')} <StyledLink to={`/org/${encodeURIComponent(id)}/settings?tab=storage`}>{t('storage.org_link')}</StyledLink></Empty>
      </PageWrapper>
    );
  }
  const orgId = store.orgId || id;
  return (
    <PageWrapper>
      <Crumbs aria-label="breadcrumb">
        <StyledLink to={`/org/${encodeURIComponent(orgId)}`}>{org?.name ?? orgId}</StyledLink><span>/</span>
        <StyledLink to={`/org/${encodeURIComponent(orgId)}/settings?tab=storage`}>{t('storage.title')}</StyledLink><span>/</span>
        <span>{store.name}</span>
      </Crumbs>
      <TitleRow>
        <Title style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><Mono>{store.name}</Mono><KindChip kind={store.kind} /><StatusChip status={store.status} /></Title>
      </TitleRow>
      {store.status === 'error' && store.error && <Alert $tone="error">{store.error}</Alert>}
      {store.warning && <Alert $tone="warning">{t(`storage.warning.${store.warning}`)}</Alert>}
      {store.operation && <Alert $tone="info" aria-live="polite">{t(`storage.operation.${store.operation.kind}`)} · {relativeTime(store.operation.startedAt)}{store.operation.log.length > 0 && <Pre style={{ marginTop: 8, maxHeight: 160 }}>{store.operation.log.join('\n')}</Pre>}</Alert>}
      <Tabs value={tab} onChange={(v) => setSearch((prev) => { const n = new URLSearchParams(prev); if (v === 'overview') n.delete('tab'); else n.set('tab', v); return n; }, { replace: true })} tabs={TABS.map((k) => ({ id: k, label: t(`storage.tab.${k}`) }))} />
      {tab === 'overview' && <OverviewTab store={store} orgId={orgId} role={role} />}
      {tab === 'data' && <StoreDataBrowser store={store} canBrowse={roleAtLeast(role, 'write')} />}
      {tab === 'backups' && <StoreBackups store={store} orgId={orgId} role={role} />}
      {tab === 'settings' && <SettingsTab store={store} orgId={orgId} role={role} />}
    </PageWrapper>
  );
}

// ------------------------------------------------------------------------------------------------ Overview

function OverviewTab({ store, orgId, role }: { store: StoreDetail; orgId: string; role: OrgRole | null }) {
  const { t } = useT();
  const write = roleAtLeast(role, 'write');
  const admin = roleAtLeast(role, 'admin');
  const [action, acting] = useStoreActionMutation();
  const { revealed, show: reveal, hide, isLoading: revealing } = useRevealedEnv(store);
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); } catch (e) { setErr(storageErrorText(t, e)); } };
  return (
    <>
      <Panel data-testid="store-overview">
        <KeyValue style={{ margin: 0 }}>
          <dt>{t('storage.overview.status')}</dt><dd><StatusChip status={store.status} />{store.health && <Meta> · {t('storage.overview.health', { state: store.health.state, ready: store.health.ready === null ? '—' : store.health.ready ? t('storage.overview.health_ok') : t('storage.overview.health_bad') })}</Meta>}</dd>
          <dt>{t('storage.overview.engine')}</dt><dd>{t(`storage.engine.${store.engine}`)}{store.postgres?.extensions.length ? <Meta> · {store.postgres.extensions.join(', ')}</Meta> : null}</dd>
          <dt>{t('storage.overview.image')}</dt><dd><Mono title={store.image}>{store.image.length > 60 ? `${store.image.slice(0, 60)}…` : store.image || '—'}</Mono></dd>
          <dt>{t('storage.overview.host')}</dt><dd><Mono>{store.host}:{store.port}</Mono> <CopyButton text={`${store.host}:${store.port}`} /></dd>
          {store.kind === 'postgres' && <><dt>{t('storage.overview.databases')}</dt><dd>{(store.postgres?.databases ?? []).map((d) => <Mono key={d} style={{ marginRight: 8 }}>{d}</Mono>)}</dd></>}
          {store.kind === 'blob' && <><dt>{t('storage.overview.bucket')}</dt><dd><Mono>{store.blob?.bucket ?? 'app'}</Mono></dd></>}
          <dt>{t('storage.overview.resources')}</dt><dd>{store.resources.memory} · {store.resources.cpus} CPU</dd>
          <dt>{t('storage.overview.size')}</dt><dd>{store.usage ? <>{bytesLabel(store.usage.bytes)} <Meta>({relativeTime(store.usage.at)})</Meta></> : '—'}</dd>
          <dt>{t('storage.overview.backups')}</dt><dd>{store.lastBackup ? <>{when(store.lastBackup.startedAt)} <Chip $tone={store.lastBackup.status === 'ok' ? 'ok' : store.lastBackup.status === 'running' ? 'busy' : 'warn'}>{t(`storage.backups.status.${store.lastBackup.status}`)}</Chip></> : t('storage.backups.none_yet')}</dd>
          <dt>{t('storage.overview.created')}</dt><dd>{when(store.createdAt)} <Meta>· <Mono>{store.createdBy}</Mono></Meta></dd>
          <dt>{t('storage.overview.credentials')}</dt><dd>{t('storage.overview.credentials_version', { n: store.credentialsVersion })}</dd>
        </KeyValue>
        {err && <Alert $tone="error">{err}</Alert>}
        <Actions>
          {admin && store.status === 'ready' && <Button size="small" color="secondary" loading={acting.isLoading} onClick={() => { if (window.confirm(t('storage.overview.stop_confirm', { name: store.name }))) void act(() => action({ sid: store.id, orgId, action: 'stop' }).unwrap()); }}>{t('storage.overview.stop')}</Button>}
          {admin && store.status === 'stopped' && <Button size="small" variant="contained" loading={acting.isLoading} onClick={() => void act(() => action({ sid: store.id, orgId, action: 'start' }).unwrap())}>{t('storage.overview.start')}</Button>}
          {write && !revealed && <Button size="small" loading={revealing} disabled={store.status !== 'ready' && store.status !== 'stopped'} onClick={() => void act(reveal)} title={t('storage.env.reveal_help')}>{t('storage.env.show')}</Button>}
        </Actions>
        {revealed && <RevealedEnvView revealed={revealed} kind={store.kind} onHide={hide} />}
        <div>
          <Meta>{t('storage.card.env_names')}</Meta>
          <EnvChips style={{ marginTop: 6 }}>{store.connectionNames.map((n) => <EnvChip key={n}>{n}</EnvChip>)}</EnvChips>
        </div>
      </Panel>
      <Panel data-testid="store-projects">
        <h3>{t('storage.overview.projects', { n: store.attachments.length })}</h3>
        {store.attachments.length === 0 ? <Help>{t('storage.overview.projects_none')}</Help> : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {store.attachments.map((a) => (
              <li key={a.projectId}>
                <Row>
                  <StyledLink to={attachedProjectStoragePath(a.projectId)}><Mono>{a.org && a.repoName ? `${a.org}/${a.repoName}` : a.projectId}</Mono></StyledLink>
                  <Chip $tone="muted">{t('storage.card.binding')} <Mono>{a.binding}</Mono></Chip>
                  <Chip $tone="muted"><Mono>{a.envPrefix}_*</Mono></Chip>
                  {store.kind === 'postgres' && <Chip $tone="muted">db <Mono>{a.database}</Mono></Chip>}
                  {a.createdAt && <Meta>{relativeTime(a.createdAt)}</Meta>}
                </Row>
              </li>
            ))}
          </ul>
        )}
        {write && <ConnectProjectForm store={store} orgId={orgId} />}
      </Panel>
    </>
  );
}

/** Connect this store to one of the organization's projects (the project's own Storage tab does the same with ainize.json in view). */
function ConnectProjectForm({ store, orgId }: { store: StoreDetail; orgId: string }) {
  const { t } = useT();
  const orgProjects = useOrgProjectsQuery(orgId);
  const mine = useMyProjectsQuery();
  const [connect, connecting] = useConnectStoreMutation();
  const [projectId, setProjectId] = useState('');
  const [binding, setBinding] = useState('');
  const [redeploy, setRedeploy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const candidates = useMemo(() => {
    const seen = new Map<string, Project>();
    for (const p of [...(orgProjects.data?.projects ?? []), ...(mine.data?.projects ?? [])]) {
      const kind = p.kind ?? p.manifest?.kind ?? null;
      if ((kind === 'service' || kind === 'nextjs') && p.canOperate && !store.attachments.some((a) => a.projectId === p.id)) seen.set(p.id, p);
    }
    return [...seen.values()].sort((a, b) => `${a.org}/${a.repoName}`.localeCompare(`${b.org}/${b.repoName}`));
  }, [orgProjects.data, mine.data, store.attachments]);
  const chosen = candidates.find((p) => p.id === projectId) ?? null;
  const bindingProblem = binding.trim() ? storeNameProblem(binding.trim()) : null;
  const submit = async () => {
    if (!chosen) return;
    setErr(null); setDone(null);
    try {
      const r = await connect({ sid: store.id, projectId: chosen.id, orgId, binding: binding.trim() || undefined, redeploy: redeploy && !!chosen.lastDeploymentId }).unwrap();
      setDone(t('storage.overview.connected', { project: `${chosen.org}/${chosen.repoName}`, names: r.envNames.slice(0, 3).join(', ') }));
      setProjectId(''); setBinding('');
    } catch (e) { setErr(storageErrorText(t, e)); }
  };
  if (!candidates.length) return <Help>{t('storage.overview.no_candidates')}</Help>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h3 style={{ fontSize: 14 }}>{t('storage.connect')}</h3>
      <Grid>
        <Field>
          <FieldLabel htmlFor="connect-project">{t('storage.overview.project')}</FieldLabel>
          <Select id="connect-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">—</option>
            {candidates.map((p) => <option key={p.id} value={p.id}>{p.org}/{p.repoName}{p.sourcePath ? `/${p.sourcePath}` : ''}</option>)}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="connect-project-binding">{t('storage.connect.binding')}</FieldLabel>
          <Input id="connect-project-binding" value={binding} placeholder={store.name} autoCapitalize="none" spellCheck={false} onChange={(e) => setBinding(e.target.value)} aria-invalid={!!bindingProblem} />
          <HelperText $error={!!bindingProblem}>{bindingProblem ? t('storage.create.name_invalid') : t('storage.connect.binding_help')}</HelperText>
        </Field>
      </Grid>
      {err && <Alert $tone="error">{err}</Alert>}
      {done && <Alert $tone="success">{done}</Alert>}
      <Actions>
        <Button size="small" variant="contained" loading={connecting.isLoading} disabled={!chosen || !!bindingProblem || store.status !== 'ready'} onClick={() => void submit()}>{t('storage.connect')}</Button>
        {chosen?.lastDeploymentId && <Checkbox label={t('storage.connect.redeploy')} checked={redeploy} onChange={(e) => setRedeploy(e.target.checked)} />}
      </Actions>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ Settings

function SettingsTab({ store, orgId, role }: { store: StoreDetail; orgId: string; role: OrgRole | null }) {
  const { t } = useT();
  const navigate = useNavigate();
  const write = roleAtLeast(role, 'write');
  const admin = roleAtLeast(role, 'admin');
  const limits = useOrgStoresQuery(orgId).data?.limits;
  const [update, updating] = useUpdateStoreMutation();
  const [rotate, rotating] = useRotateStoreMutation();
  const [del, deleting] = useDeleteStoreMutation();
  const [name, setName] = useState(store.name);
  const [memory, setMemory] = useState(store.resources.memory);
  const [cpus, setCpus] = useState(String(store.resources.cpus));
  const [confirm, setConfirm] = useState('');
  const [skipBackup, setSkipBackup] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tail, setTail] = useState(200);
  const [showLogs, setShowLogs] = useState(false);
  const logs = useStoreLogsQuery({ sid: store.id, tail }, { skip: !showLogs || !write });
  useEffect(() => { setName(store.name); setMemory(store.resources.memory); setCpus(String(store.resources.cpus)); }, [store.name, store.resources.memory, store.resources.cpus]);
  const act = async (fn: () => Promise<unknown>, done?: string) => { setErr(null); setNote(null); try { await fn(); if (done) setNote(done); } catch (e) { setErr(storageErrorText(t, e)); } };
  const nameProblem = storeNameProblem(name.trim());
  const attached = store.attachments;
  const busy = storeIsBusy(store);

  return (
    <>
      {write && (
        <Panel data-testid="store-settings">
          <h3>{t('storage.settings.name')}</h3>
          <Row>
            <Input value={name} autoCapitalize="none" spellCheck={false} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 320 }} aria-label={t('storage.settings.name')} aria-invalid={!!nameProblem} />
            <Button size="small" loading={updating.isLoading} disabled={!!nameProblem || name.trim() === store.name || busy} onClick={() => void act(() => update({ sid: store.id, orgId, name: name.trim() }).unwrap(), t('storage.saved'))}>{t('storage.save')}</Button>
          </Row>
          <HelperText $error={!!nameProblem}>{nameProblem ? t('storage.create.name_invalid') : t('storage.settings.rename_help', { host: `${name.trim() || store.name}.store.internal` })}</HelperText>
        </Panel>
      )}
      {admin && (
        <Panel>
          <h3>{t('storage.settings.resources')}</h3>
          <Help>{t('storage.settings.resources_help')}{limits?.memoryMax ? ` ${t('storage.settings.resources_max', { memory: limits.memoryMax, cpus: limits.cpusMax ?? '—' })}` : ''}</Help>
          <Grid>
            <Field><FieldLabel htmlFor="st-memory">{t('storage.settings.memory')}</FieldLabel><Input id="st-memory" value={memory} placeholder="1g" onChange={(e) => setMemory(e.target.value)} /></Field>
            <Field><FieldLabel htmlFor="st-cpus">{t('storage.settings.cpus')}</FieldLabel><Input id="st-cpus" type="number" min={0.25} step={0.25} value={cpus} onChange={(e) => setCpus(e.target.value)} /></Field>
          </Grid>
          <Actions>
            <Button size="small" loading={updating.isLoading} disabled={busy || (memory === store.resources.memory && Number(cpus) === store.resources.cpus) || !/^\d+(\.\d+)?[mMgG]$/.test(memory.trim()) || !(Number(cpus) > 0)}
              onClick={() => { if (window.confirm(t('storage.settings.recreate_confirm', { name: store.name }))) void act(() => update({ sid: store.id, orgId, resources: { memory: memory.trim(), cpus: Number(cpus) } }).unwrap(), t('storage.settings.recreating')); }}>
              {t('storage.settings.apply_resources')}
            </Button>
          </Actions>
        </Panel>
      )}
      {admin && (
        <Panel>
          <h3>{t('storage.settings.rotate')}</h3>
          <Help>{t('storage.settings.rotate_help')}</Help>
          <Actions>
            <Button size="small" loading={rotating.isLoading} disabled={busy || store.status !== 'ready'} onClick={() => {
              if (!window.confirm(t('storage.settings.rotate_confirm', { n: attached.length }, attached.length))) return;
              void act(async () => { const r = await rotate({ sid: store.id, projectIds: attached.map((a) => a.projectId) }).unwrap(); setNote(t('storage.settings.rotated', { v: r.credentialsVersion, n: r.redeploys.length }, r.redeploys.length)); });
            }}>{t('storage.settings.rotate')}</Button>
            {attached.length > 0 && <Meta>{attached.map((a) => (a.org && a.repoName ? `${a.org}/${a.repoName}` : a.projectId)).join(', ')}</Meta>}
          </Actions>
        </Panel>
      )}
      {write && (
        <Panel>
          <Row>
            <h3>{t('storage.settings.logs')}</h3>
            <Spacer />
            <Select aria-label={t('projects.logs.tail')} value={String(tail)} onChange={(e) => setTail(Number(e.target.value))} style={{ width: 'auto' }}>{[100, 200, 500, 1000].map((n) => <option key={n} value={n}>{n}</option>)}</Select>
            <Button size="small" loading={logs.isFetching} onClick={() => { if (showLogs) void logs.refetch(); else setShowLogs(true); }}>{showLogs ? t('storage.data.refresh') : t('storage.settings.show_logs')}</Button>
          </Row>
          {logs.error && <Alert $tone="error">{storageErrorText(t, logs.error)}</Alert>}
          {logs.data && <Pre aria-live="polite">{logs.data.lines.length ? logs.data.lines.map((l) => l.text).join('\n') : t('storage.settings.logs_empty')}</Pre>}
        </Panel>
      )}
      {err && <Alert $tone="error">{err}</Alert>}
      {note && <Alert $tone="success">{note}</Alert>}
      {admin && (
        <DangerPanel data-testid="store-danger">
          <h3>{t('storage.settings.danger')}</h3>
          {attached.length > 0
            ? <Alert $tone="warning">{t('storage.delete.attached', { projects: attached.map((a) => (a.org && a.repoName ? `${a.org}/${a.repoName}` : a.projectId)).join(', ') })}</Alert>
            : <Help>{t('storage.delete.help')}</Help>}
          <Field>
            <FieldLabel htmlFor="st-confirm">{t('storage.confirm_name')}</FieldLabel>
            <Input id="st-confirm" value={confirm} placeholder={store.name} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => setConfirm(e.target.value)} style={{ maxWidth: 320 }} disabled={attached.length > 0} />
          </Field>
          <Checkbox label={t('storage.delete.skip_backup')} checked={skipBackup} disabled={attached.length > 0} onChange={(e) => setSkipBackup(e.target.checked)} />
          <Actions>
            <Button color="secondary" loading={deleting.isLoading} disabled={attached.length > 0 || confirm.trim() !== store.name || busy} onClick={() => {
              if (!window.confirm(t('storage.delete.confirm', { name: store.name }))) return;
              void act(async () => { await del({ sid: store.id, orgId, confirm: confirm.trim(), skipFinalBackup: skipBackup }).unwrap(); navigate(`/org/${encodeURIComponent(orgId)}/settings?tab=storage`); });
            }}>{t('storage.delete')}</Button>
          </Actions>
        </DangerPanel>
      )}
      {!write && <Panel><Help>{t('storage.settings.write_only')}</Help></Panel>}
      <Row><StyledLink to={storePath(orgId, store.id)}>← {store.name}</StyledLink></Row>
    </>
  );
}
