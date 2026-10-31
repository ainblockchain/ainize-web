/**
 * `/aincode` — every AinCode session the signed-in person has, grouped by workspace (organization first, then
 * personal) and repository. A member once worked for hours in the personal workspace on an organization's project
 * without noticing; here each session says where it runs and what it works on, and a personal session on an
 * organization's repository is flagged. Data: the AinCode gateway's `GET /code/_aincode/sessions` (same origin).
 */
import { useState } from 'react';
import styled from 'styled-components';
import { groupOverview, misplaced, type AinCodeSession, type RepoGroup } from '@/api/aincodeSessions';
import { useAincodeOverviewQuery } from '@/api/aincodeOverview';
import { relativeTime } from '@/api/projects';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { CenterProgress, Empty, Mono, PageWrapper } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const Workspace = styled.section`margin: 20px 0 28px;`;
const WorkspaceHead = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;`;
const WorkspaceName = styled.h2`font-size: 17px; font-weight: 700; margin: 0; min-width: 0; overflow-wrap: anywhere;`;
const Meta = styled.span`font-size: 12px; color: #6b7280;`;
const Dot = styled.span<{ $tone: 'up' | 'down' | 'busy' }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$tone === 'busy' ? '#5b3df5' : p.$tone === 'up' ? '#1ea672' : '#c2c6cf')};
`;
const Spacer = styled.span`flex: 1;`;
const Repo = styled.details`border: 1px solid #e2e4ea; border-radius: 10px; background: #fff; margin-bottom: 10px; overflow: hidden;`;
const RepoHead = styled.summary`cursor: pointer; display: flex; &::before { content: "▸"; } details[open] > &::before { content: "▾"; } list-style: none; &::-webkit-details-marker { display: none; } align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 14px; background: #f8f9fb; border-bottom: 1px solid #eef0f4; font-weight: 600; font-size: 14px; overflow-wrap: anywhere; & > * { min-width: 0; }`;
const RepoLink = styled.a`color: inherit; text-decoration: none; &:hover { color: #5b3df5; text-decoration: underline; }`;
const Rows = styled.div`display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto auto; column-gap: 14px; row-gap: 0; align-items: center;
  @media (max-width: 720px) { grid-template-columns: minmax(0, 1fr) auto; }`;
const Cell = styled.div<{ $hideSmall?: boolean }>`padding: 9px 14px; font-size: 13px; border-top: 1px solid #f1f2f5; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  @media (max-width: 720px) { ${(p) => (p.$hideSmall ? 'display: none;' : '')} }`;
const HeadCell = styled(Cell)`font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: .03em; border-top: 0;`;
const Warn = styled.div`padding: 8px 14px; font-size: 12px; color: #92400e; background: #fffbeb; border-top: 1px solid #fde68a;`;
const LinkButton = styled.a`display: inline-block; padding: 5px 12px; border: 1px solid #5b3df5; border-radius: 8px; color: #5b3df5;
  font-size: 13px; font-weight: 600; text-decoration: none; &:hover { background: #f4f1ff; }`;
const MobileMeta = styled.div`display: none; @media (max-width: 720px) { display: flex; flex-wrap: wrap; gap: 4px 10px; margin-top: 4px; font-size: 11px; color: #6b7280; white-space: normal; overflow-wrap: anywhere; }`;
const Pager = styled.div`display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 14px; border-top: 1px solid #eef0f4;`;
const OpenLink = styled.a`flex-shrink: 0; min-height: 32px; display: inline-flex; align-items: center; font-size: 13px; font-weight: 600; color: #5b3df5; text-decoration: none; &:hover { text-decoration: underline; }`;

export default function AinCodePage() {
  const { t } = useT();
  const auth = useAuth();
  useTitle(t('aincode.title'));
  const query = useAincodeOverviewQuery(auth.cacheIdentity, { skip: auth.loading || !auth.isSignedIn, refetchOnMountOrArgChange: true });
  const unauthorized = query.isError && query.error && 'status' in query.error && [401, 403].includes(Number(query.error.status));
  const signedOut = !auth.loading && !auth.isSignedIn;
  const data = !auth.loading && auth.isSignedIn && !unauthorized ? query.currentData : undefined;
  const loading = auth.loading || (auth.isSignedIn && !data && query.isFetching);

  const actionable = !!data && !query.isError && !query.isFetching;

  return (
    <PageWrapper>
      {data && !query.isError && <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button size="small" variant="text" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('aincode.refresh')}</Button></div>}
      {loading && <div role="status" data-testid="aincode-loading"><CenterProgress /></div>}
      {signedOut && (
        <Empty>
          {t('aincode.signin')}{' '}
          <LinkButton href={`/signing?next=${encodeURIComponent('/aincode')}`}>{t('aincode.signin.cta')}</LinkButton>
        </Empty>
      )}
      {auth.isSignedIn && query.isError && (
        <Empty role="alert">{t('aincode.failed')} <Button size="small" variant="text" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('aincode.retry')}</Button></Empty>
      )}
      {data && !query.isError && !query.isFetching && data.workspaces.length === 0 && (
        <Empty data-testid="aincode-empty">{t('aincode.empty')} <LinkButton href="/code/">{t('aincode.start')}</LinkButton></Empty>
      )}
      {data && !actionable && <Meta role="status">{t('aincode.retained')}</Meta>}
      {data && groupOverview(data).map((g) => (
        <Workspace key={auth.cacheIdentity + g.key} data-testid={`aincode-workspace-${g.key}`}>
          <WorkspaceHead>
            <WorkspaceName>{g.workspace.kind === 'organization' ? t('aincode.workspace.org', { name: g.workspace.org!.name }) : t('aincode.workspace.personal')}</WorkspaceName>
            <Meta><Dot $tone={actionable && g.workspace.running ? 'up' : 'down'} />{!actionable ? t('aincode.status.unknown') : g.workspace.running ? t('aincode.workspace.running') : t('aincode.workspace.stopped')}</Meta>
            {actionable && g.workspace.running && g.working > 0 && <Meta>· {t('aincode.workspace.working', { n: String(g.working) })}</Meta>}
            <Spacer />
            {actionable ? <LinkButton href={g.workspace.newSessionUrl}>{t('aincode.newSession')}</LinkButton> : <Meta>{t('aincode.newSession')}</Meta>}
          </WorkspaceHead>
          {g.repos.length === 0 && <Meta>{t('aincode.empty')}</Meta>}
          {g.repos.map((r, index) => <AinCodeRepository key={r.key} group={r} personal={g.key === 'personal'} running={g.workspace.running} actionable={actionable} initiallyOpen={index === 0} />)}
        </Workspace>
      ))}
    </PageWrapper>
  );
}

const PAGE_SIZE = 5;
export function AinCodeRepository({ group, personal, running, actionable, initiallyOpen = false }: { group: RepoGroup; personal: boolean; running: boolean; actionable: boolean; initiallyOpen?: boolean }) {
  const { t } = useT(), [open, setOpen] = useState(initiallyOpen), [limit, setLimit] = useState(PAGE_SIZE);
  const visible = group.sessions.slice(0, limit), count = group.sessions.length;
  return <Repo open={open} onToggle={e => { setOpen(e.currentTarget.open); if (!e.currentTarget.open) setLimit(PAGE_SIZE); }} data-testid="aincode-repo">
    <RepoHead>
      <span>{group.label}</span>
      <Meta>{t('aincode.session_count', { n: String(count) })}</Meta>
      <Meta>{group.sessions[0]?.repo?.org ?? t('aincode.repo.noRepo')}</Meta>
    </RepoHead>
    {group.href && actionable && <div style={{ padding: '6px 14px' }}><RepoLink href={group.href}>{t(group.sessions[0]?.repo?.projectPageUrl ? 'aincode.open_project' : 'aincode.open_repository')}</RepoLink></div>}
    {!group.sessions[0]?.repo && <Meta style={{ display: 'block', padding: '6px 14px', overflowWrap: 'anywhere' }}>{group.sessions[0]?.workingDirectory}</Meta>}
    {personal && group.sessions.some(misplaced) && <Warn>{t('aincode.misplaced')}</Warn>}
    <Rows>
      <HeadCell>{t('aincode.col.session')}</HeadCell>
      <HeadCell $hideSmall>{t('aincode.col.status')}</HeadCell>
      <HeadCell $hideSmall>{t('aincode.col.branch')}</HeadCell>
      <HeadCell $hideSmall>{t('aincode.col.updated')}</HeadCell>
      <HeadCell />
      {visible.map(s => <Row key={s.id} s={s} running={running} actionable={actionable} />)}
    </Rows>
    {count > PAGE_SIZE && <Pager>
      <Meta>{t('aincode.visible_count', { shown: String(visible.length), total: String(count) })}</Meta>
      {visible.length < count && <Button size="small" variant="text" onClick={() => setLimit(n => n + PAGE_SIZE)}>{t('aincode.show_more')}</Button>}
      {limit > PAGE_SIZE && <Button size="small" variant="text" onClick={() => setLimit(PAGE_SIZE)}>{t('aincode.show_less')}</Button>}
    </Pager>}
  </Repo>;
}

function Row({ s, running, actionable }: { s: AinCodeSession; running: boolean; actionable: boolean }) {
  const { t } = useT();
  const state = running && actionable ? s.status : 'unknown';
  const status = <><Dot $tone={state === 'working' ? 'busy' : state === 'idle' ? 'up' : 'down'} />{t(`aincode.status.${state}`)}</>;
  return <>
    <Cell title={s.workingDirectory}>
      {s.title || <Mono>{s.id}</Mono>}
      <MobileMeta data-testid="aincode-mobile-meta"><span>{status}</span><span>{s.branch || '—'}</span><span>{relativeTime(s.updatedAt)}</span></MobileMeta>
    </Cell>
    <Cell $hideSmall>{status}</Cell>
    <Cell $hideSmall>{s.branch ? <Mono>{s.branch}</Mono> : '—'}</Cell>
    <Cell $hideSmall>{relativeTime(s.updatedAt)}</Cell>
    <Cell>{actionable ? <OpenLink href={s.openUrl} aria-label={t('aincode.open_named', { name: s.title || s.id })} data-testid="aincode-open">{t('aincode.open')}</OpenLink> : <Meta>{t('aincode.open')}</Meta>}</Cell>
  </>;
}
