/**
 * One store as the project's Storage tab shows it — the Vercel store card: status dot, name, kind, `<host>:<port>`,
 * the binding and prefix it answers under, the environment variable NAMES it sets (copyable), and the actions:
 * **Show values** (a reveal the node logs; masked here, `.env.local` copied whole, hidden again after a minute),
 * **Open in Storage →** (the store's own page) and **Disconnect** (with the redeploy that removes the env, followed
 * until it is ready).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDisconnectStoreMutation, useRevealStoreEnvMutation } from '@/api/api';
import { connectionStringOf, maskEnvValue, type RevealedEnv, type Store } from '@/api/projectStorage';
import { type Project, type Queued } from '@/api/projects';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox } from '@/components/ui/Form';
import { CopyButton, Mono, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { storePath } from '@/lib/reservedRoutes';
import { Actions, Card, Chip, EnvChip, EnvChips, Help, KindChip, Meta, Name, Pre, Row, Spacer, StatusDot, storageErrorText } from './common';

/** How long revealed values stay on the screen. */
export const REVEAL_VISIBLE_MS = 60_000;

/** The revealed set: each secret-bearing value masked, the whole `.env.local` behind one Copy. */
export function RevealedEnvView({ revealed, kind, onHide }: { revealed: RevealedEnv; kind: Store['kind']; onHide: () => void }) {
  const { t } = useT();
  const [left, setLeft] = useState(REVEAL_VISIBLE_MS / 1000);
  // the caller's onHide is usually an inline arrow — kept in a ref so the countdown is not restarted by every render
  const hide = useRef(onHide);
  hide.current = onHide;
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((REVEAL_VISIBLE_MS - (Date.now() - started)) / 1000));
      setLeft(remaining);
      if (remaining <= 0) { clearInterval(tick); hide.current(); }
    }, 1000);
    return () => clearInterval(tick);
  }, [revealed]);
  const primary = connectionStringOf(kind, revealed.env);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Row>
        <Meta>{t('storage.env.revealed_for', { s: left })}</Meta>
        <Spacer />
        {primary && <CopyButton text={primary} label={t('storage.env.copy_url')} />}
        <CopyButton text={revealed.dotenv} label={t('storage.env.copy_dotenv')} />
        <Button size="small" variant="text" onClick={onHide}>{t('storage.env.hide')}</Button>
      </Row>
      <Pre aria-label=".env.local">{Object.entries(revealed.env).map(([k, v]) => `${k}=${maskEnvValue(k, v)}`).join('\n')}</Pre>
      <Help>{t('storage.env.masked_help')}</Help>
    </div>
  );
}

export default function StoreCard({ store, project, binding, envPrefix, database, envNames, canManage, declared, onDisconnected }: {
  store: Store;
  project?: Project;
  binding?: string;
  envPrefix?: string;
  database?: string;
  envNames?: string[];
  canManage: boolean;
  /** `false`: connected, but ainize.json does not declare this binding (the hint is shown). */
  declared?: boolean;
  onDisconnected?: (q: Queued | null) => void;
}) {
  const { t } = useT();
  const navigate = useNavigate();
  const [reveal, revealing] = useRevealStoreEnvMutation();
  const [disconnect, disconnecting] = useDisconnectStoreMutation();
  const [revealed, setRevealed] = useState<RevealedEnv | null>(null);
  const [redeploy, setRedeploy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const names = envNames ?? store.connectionNames;
  const deploys = !!project?.lastDeploymentId;

  const show = async () => {
    setErr(null);
    try { setRevealed(await reveal({ sid: store.id, projectId: project?.id }).unwrap()); }
    catch (e) { setErr(storageErrorText(t, e)); }
  };
  const remove = async () => {
    if (!project) return;
    if (!window.confirm(t('storage.disconnect.confirm', { name: store.name, project: `${project.org}/${project.repoName}` }))) return;
    setErr(null);
    try { const r = await disconnect({ sid: store.id, projectId: project.id, redeploy: deploys && redeploy }).unwrap(); onDisconnected?.(r.redeploy); }
    catch (e) { setErr(storageErrorText(t, e)); }
  };

  return (
    <Card data-testid={`store-card-${store.id}`}>
      <Row>
        <StatusDot status={store.status} />
        <StyledLink to={storePath(store.orgId, store.id)}><Name>{store.name}</Name></StyledLink>
        <KindChip kind={store.kind} />
        <Chip $tone="muted">{t(`storage.status.${store.status}`)}</Chip>
        <Meta><Mono>{store.host}:{store.port}</Mono></Meta>
        {store.warning && <Chip $tone="warn">{t(`storage.warning.${store.warning}`)}</Chip>}
      </Row>
      {(binding || envPrefix || database) && (
        <Row>
          {binding && <Meta>{t('storage.card.binding')}: <Mono>{binding}</Mono></Meta>}
          {envPrefix && <Meta>{t('storage.card.prefix')}: <Mono>{envPrefix}_*</Mono></Meta>}
          {database && store.kind === 'postgres' && <Meta>{t('storage.card.database')}: <Mono>{database}</Mono></Meta>}
          {declared === false && <Chip $tone="warn">{t('storage.card.undeclared')}</Chip>}
        </Row>
      )}
      {store.status === 'error' && store.error && <Alert $tone="error">{store.error}</Alert>}
      {names.length > 0 && (
        <div>
          <Row style={{ marginBottom: 6 }}><Meta>{t('storage.card.env_names')}</Meta><Spacer /><CopyButton text={names.join('\n')} label={t('storage.card.copy_names')} /></Row>
          <EnvChips aria-label={t('storage.card.env_names')}>{names.map((n) => <EnvChip key={n}>{n}</EnvChip>)}</EnvChips>
        </div>
      )}
      {revealed && <RevealedEnvView revealed={revealed} kind={store.kind} onHide={() => setRevealed(null)} />}
      {err && <Alert $tone="error">{err}</Alert>}
      <Actions>
        {canManage && !revealed && <Button size="small" loading={revealing.isLoading} onClick={show} disabled={store.status !== 'ready' && store.status !== 'stopped'} title={t('storage.env.reveal_help')}>{t('storage.env.show')}</Button>}
        <Button size="small" variant="text" onClick={() => navigate(storePath(store.orgId, store.id))}>{t('storage.card.open')}</Button>
        <Spacer />
        {canManage && project && (
          <>
            {deploys && <Checkbox label={t('storage.disconnect.redeploy')} checked={redeploy} onChange={(e) => setRedeploy(e.target.checked)} />}
            <Button size="small" color="secondary" loading={disconnecting.isLoading} onClick={remove}>{t('storage.disconnect')}</Button>
          </>
        )}
      </Actions>
      {canManage && <Help>{t('storage.env.reveal_help')}</Help>}
    </Card>
  );
}
