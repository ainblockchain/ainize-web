/**
 * `/aincode` — every AinCode session the signed-in person has, grouped by workspace (organization first, then
 * personal) and repository. A member once worked for hours in the personal workspace on an organization's project
 * without noticing; here each session says where it runs and what it works on, and a personal session on an
 * organization's repository is flagged. Data: the AinCode gateway's `GET /code/_aincode/sessions` (same origin).
 */
import { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { groupOverview, misplaced, parseOverview, type AinCodeOverview, type AinCodeSession } from '@/api/aincodeSessions';
import { relativeTime } from '@/api/projects';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { CenterProgress, Empty, Mono, PageWrapper, SectionTitle } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const Workspace = styled.section`margin: 20px 0 28px;`;
const WorkspaceHead = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px;`;
const WorkspaceName = styled.h2`font-size: 17px; font-weight: 700; margin: 0;`;
const Meta = styled.span`font-size: 12px; color: #6b7280;`;
const Dot = styled.span<{ $tone: 'up' | 'down' | 'busy' }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$tone === 'busy' ? '#5b3df5' : p.$tone === 'up' ? '#1ea672' : '#c2c6cf')};
`;
const Spacer = styled.span`flex: 1;`;
const Repo = styled.div`border: 1px solid #e2e4ea; border-radius: 10px; background: #fff; margin-bottom: 10px; overflow: hidden;`;
const RepoHead = styled.div`display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #f8f9fb; border-bottom: 1px solid #eef0f4; font-weight: 600; font-size: 14px;`;
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
const OpenLink = styled.a`font-size: 13px; font-weight: 600; color: #5b3df5; text-decoration: none; &:hover { text-decoration: underline; }`;

type State = { kind: 'loading' } | { kind: 'signedOut' } | { kind: 'error' } | { kind: 'ok'; data: AinCodeOverview };

export default function AinCodePage() {
  const { t } = useT();
  const auth = useAuth();
  useTitle(t('aincode.title'));
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/code/_aincode/sessions', { credentials: 'include', headers: { accept: 'application/json' } });
      if (res.status === 401) return setState({ kind: 'signedOut' });
      const data = res.ok ? parseOverview(await res.json()) : null;
      setState(data ? { kind: 'ok', data } : { kind: 'error' });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);
  useEffect(() => { void load(); }, [load, auth.isSignedIn]);

  const status = (s: AinCodeSession) => (
    <><Dot $tone={s.status === 'working' ? 'busy' : s.status === 'idle' ? 'up' : 'down'} />{t(`aincode.status.${s.status}`)}</>
  );

  return (
    <PageWrapper>
      <SectionTitle>{t('nav.aincode')}</SectionTitle>
      {state.kind === 'loading' && <CenterProgress />}
      {state.kind === 'signedOut' && (
        <Empty>
          {t('aincode.signin')}{' '}
          <LinkButton href={`/signing?next=${encodeURIComponent('/aincode')}`}>{t('aincode.signin.cta')}</LinkButton>
        </Empty>
      )}
      {state.kind === 'error' && (
        <Empty>{t('aincode.failed')} <Button size="small" variant="text" onClick={() => void load()}>{t('aincode.retry')}</Button></Empty>
      )}
      {state.kind === 'ok' && state.data.sessions.length === 0 && (
        <Empty>{t('aincode.empty')} <LinkButton href="/code/">{t('aincode.start')}</LinkButton></Empty>
      )}
      {state.kind === 'ok' && groupOverview(state.data).map((g) => (
        <Workspace key={g.key} data-testid={`aincode-workspace-${g.key}`}>
          <WorkspaceHead>
            <WorkspaceName>{g.workspace.kind === 'organization' ? t('aincode.workspace.org', { name: g.workspace.org!.name }) : t('aincode.workspace.personal')}</WorkspaceName>
            <Meta><Dot $tone={g.workspace.running ? 'up' : 'down'} />{g.workspace.running ? t('aincode.workspace.running') : t('aincode.workspace.stopped')}</Meta>
            {g.working > 0 && <Meta>· {t('aincode.workspace.working', { n: String(g.working) })}</Meta>}
            <Spacer />
            <LinkButton href={g.workspace.newSessionUrl}>{t('aincode.newSession')}</LinkButton>
          </WorkspaceHead>
          {g.repos.map((r) => (
            <Repo key={r.key} data-testid="aincode-repo">
              <RepoHead>
                {r.href ? <RepoLink href={r.href}>{r.label}</RepoLink> : <span>{r.label}</span>}
                {r.sessions[0].repo ? <Meta>· {r.sessions[0].repo.org}</Meta> : <Meta>· {t('aincode.repo.noRepo')}</Meta>}
              </RepoHead>
              {g.key === 'personal' && r.sessions.some(misplaced) && <Warn>{t('aincode.misplaced')}</Warn>}
              <Rows>
                <HeadCell>{t('aincode.col.session')}</HeadCell>
                <HeadCell $hideSmall>{t('aincode.col.status')}</HeadCell>
                <HeadCell $hideSmall>{t('aincode.col.branch')}</HeadCell>
                <HeadCell $hideSmall>{t('aincode.col.updated')}</HeadCell>
                <HeadCell />
                {r.sessions.map((s) => (
                  <Row key={s.id} s={s} status={status(s)} openLabel={t('aincode.open')} />
                ))}
              </Rows>
            </Repo>
          ))}
        </Workspace>
      ))}
    </PageWrapper>
  );
}

function Row({ s, status, openLabel }: { s: AinCodeSession; status: React.ReactNode; openLabel: string }) {
  return (
    <>
      <Cell title={s.workingDirectory}>{s.title || <Mono>{s.id}</Mono>}</Cell>
      <Cell $hideSmall>{status}</Cell>
      <Cell $hideSmall>{s.branch ? <Mono>{s.branch}</Mono> : '—'}</Cell>
      <Cell $hideSmall>{relativeTime(s.updatedAt)}</Cell>
      <Cell><OpenLink href={s.openUrl} data-testid="aincode-open">{openLabel}</OpenLink></Cell>
    </>
  );
}
