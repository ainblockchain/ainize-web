/**
 * The project console's Storage tab (src/api/projectStorage.ts): what `ainize.json` declares under `storage`, which
 * of those bindings are connected to an organization store and which are not (a deploy fails until they are), the
 * stores connected without a declaration, and — for writers — **Connect**. Each connected store is a `StoreCard`.
 *
 * Owner and organization members only, like the runtime log: anyone else is told so. A node without managed
 * storage (503 `storage_off`) and an organization the operator did not allow (403) each get their sentence; a node
 * from before storage (404) shows nothing more than that.
 */
import { useEffect, useState } from 'react';
import { useProjectStorageQuery } from '@/api/api';
import { storageAccessOf, type DeclaredBinding, type ProjectStorageResponse } from '@/api/projectStorage';
import type { Project, Queued } from '@/api/projects';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Mono, StyledLink } from '@/components/ui/Misc';
import { DeployWatch } from '@/components/ProjectEnvVars';
import { useT } from '@/i18n';
import ConnectStoreDialog from './ConnectStoreDialog';
import StoreCard from './StoreCard';
import { Actions, Cards, Chip, Help, Item, KindChip, List, Name, Panel, Row, Spacer, storageErrorText } from './common';

/** How often the tab asks again — a store someone else connects, or a provisioning one, shows up without a reload. */
export const PROJECT_STORAGE_POLL_MS = 10_000;

/** The storage query, shared by the tab and the banner over the tabs (RTK Query dedupes the request). */
export function useProjectStorage(project: Project) {
  const { isSignedIn } = useAuth();
  const skip = !isSignedIn || !project.canOperate;
  // a node without storage (503), from before it (404) or refusing this caller stops being asked every 10 s
  const [poll, setPoll] = useState(PROJECT_STORAGE_POLL_MS);
  const q = useProjectStorageQuery(project.id, { skip, pollingInterval: poll, skipPollingIfUnfocused: true });
  const access = storageAccessOf({ skip, isLoading: q.isLoading, data: q.data, error: q.error });
  useEffect(() => { setPoll(access === 'off' || access === 'hidden' ? 0 : PROJECT_STORAGE_POLL_MS); }, [access]);
  return { q, access };
}

function DeclaredRow({ binding, canManage, onConnect }: { binding: DeclaredBinding; canManage: boolean; onConnect: () => void }) {
  const { t } = useT();
  return (
    <Item>
      <Row>
        <Name>{binding.name}</Name>
        {binding.kind && <KindChip kind={binding.kind} />}
        {binding.env && <Chip $tone="muted">{binding.env}_*</Chip>}
        <Chip $tone={binding.required ? 'warn' : 'muted'}>{binding.required ? t('storage.binding.not_connected') : t('storage.binding.optional')}</Chip>
        <Spacer />
        {canManage && <Button size="small" variant="contained" onClick={onConnect}>{t('storage.connect')}</Button>}
      </Row>
      <Help>{binding.required ? t('storage.binding.missing', { kind: binding.kind ? t(`storage.kind.${binding.kind}`) : t('storage.kind.any') }) : t('storage.binding.optional_help')}</Help>
    </Item>
  );
}

export default function ProjectStorage({ project, onOpenDeployment }: { project: Project; onOpenDeployment?: (deploymentId: string) => void }) {
  const { t } = useT();
  const { isSignedIn } = useAuth();
  const { q, access } = useProjectStorage(project);
  const [connecting, setConnecting] = useState<DeclaredBinding | null | 'free'>(null);
  const [queued, setQueued] = useState<Queued | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const data: ProjectStorageResponse | undefined = q.data;

  if (!isSignedIn) {
    return <Panel><Help>{t('storage.sign_in')}</Help><Actions><Button variant="contained" onClick={() => { window.location.assign(`/signing?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); }}>{t('projects.runs.sign_in_button')}</Button></Actions></Panel>;
  }
  if (!project.canOperate) return <Panel><Help>{t('storage.not_member', { org: project.org })}</Help></Panel>;
  if (access === 'loading') return <Panel><Help>{t('storage.loading')}</Help></Panel>;
  if (access === 'off') {
    const code = q.error ? storageErrorText(t, q.error) : t('storage.err.storage_off');
    return <Panel><h2>{t('storage.title')}</h2><Alert $tone="info">{code}</Alert><Help>{t('storage.off_help')}</Help></Panel>;
  }
  if (access === 'hidden') return <Panel><h2>{t('storage.title')}</h2><Help>{t('storage.not_on_node')}</Help></Panel>;
  if (access === 'error' || !data) return <Panel><h2>{t('storage.title')}</h2><Alert $tone="error">{storageErrorText(t, q.error)}</Alert></Panel>;

  const canManage = data.canManage;
  const attachedByBinding = new Map(data.attached.map((a) => [a.binding, a]));
  const undeclared = data.attached.filter((a) => !data.declared.some((d) => d.name === a.binding));
  const onDone = (r: Queued | null) => {
    setConnecting(null);
    setNote(null);
    if (r) setQueued(r); else if (project.lastDeploymentId) setNote(t('storage.redeploy_pending'));
  };
  const orgSettings = data.orgId ? `/org/${encodeURIComponent(data.orgId)}/settings?tab=storage` : null;

  return (
    <Panel id="storage" aria-labelledby="storage-title" data-testid="project-storage">
      <Row>
        <h2 id="storage-title">{t('storage.title')}</h2>
        <Spacer />
        {orgSettings && <StyledLink to={orgSettings}>{t('storage.org_link')}</StyledLink>}
      </Row>
      <Help>{t('storage.project.lede')}</Help>

      <h3>{t('storage.project.declared')}</h3>
      {data.declared.length === 0 ? <Help>{t('storage.project.declared_none')} <Mono>{'"storage": ["db"]'}</Mono></Help> : (
        <List aria-label={t('storage.project.declared')}>
          {data.declared.map((d) => {
            const a = attachedByBinding.get(d.name);
            return a
              ? <Item key={d.name}><StoreCard store={a.store} project={project} binding={a.binding} envPrefix={a.envPrefix} database={a.database} envNames={a.envNames} canManage={canManage} onDisconnected={onDone} /></Item>
              : <DeclaredRow key={d.name} binding={d} canManage={canManage} onConnect={() => setConnecting(d)} />;
          })}
        </List>
      )}

      {undeclared.length > 0 && (
        <>
          <h3>{t('storage.project.undeclared')}</h3>
          <Help>{t('storage.project.undeclared_help')}</Help>
          <Cards>{undeclared.map((a) => <StoreCard key={a.store.id} store={a.store} project={project} binding={a.binding} envPrefix={a.envPrefix} database={a.database} envNames={a.envNames} canManage={canManage} declared={false} onDisconnected={onDone} />)}</Cards>
        </>
      )}

      {canManage && connecting === null && (
        <Actions>
          <Button size="small" onClick={() => setConnecting('free')}>{t('storage.project.connect_another')}</Button>
          <Help>{t('storage.project.connect_help')}</Help>
        </Actions>
      )}
      {canManage && connecting !== null && (
        <ConnectStoreDialog project={project} orgId={data.orgId} binding={connecting === 'free' ? null : connecting} orgStores={data.orgStores} attached={data.attached} onDone={onDone} onClose={() => setConnecting(null)} />
      )}
      {note && <Alert $tone="warning">{note}</Alert>}
      {queued && <DeployWatch key={queued.deploymentId} queued={queued} onOpen={onOpenDeployment} />}
    </Panel>
  );
}

/** The banner over the tabs: bindings ainize.json declares and nobody has connected. Shown to whoever can connect them. */
export function MissingStorageBanner({ project, onGo }: { project: Project; onGo: () => void }) {
  const { t } = useT();
  const { q, access } = useProjectStorage(project);
  // the list when the tab's query answered; the project view's count (members) until then
  const missing = access === 'writer' || access === 'reader' ? q.data?.missing ?? [] : [];
  const n = missing.length || (access === 'loading' && project.canOperate ? project.storage?.missing ?? 0 : 0);
  if (!n) return null;
  return (
    <Alert $tone="warning" role="status" style={{ margin: '8px 0' }} data-testid="missing-storage-banner">
      <Actions>
        <span>{t('storage.banner.missing', { n }, n)} {missing.length > 0 && <Mono>{missing.join(', ')}</Mono>}</span>
        <Spacer />
        <Button size="small" variant="contained" onClick={onGo}>{t('storage.banner.go')}</Button>
      </Actions>
    </Alert>
  );
}
