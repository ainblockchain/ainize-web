/**
 * `/runs` — the Runs landing, beside Deployments (`/deployments`, AppsPage): the person's script projects, those of
 * their organizations, and what a Run is. A Run is a `kind: script` project — a script that executes on demand
 * (the project page's Run panel), on a cron schedule, when a path on the AIN blockchain is written (an AIN DB
 * `_function` REST trigger — the Firestore-trigger model), or when a webhook URL is called (ainize-node "Runs"
 * contract). The Cloud Run Jobs / Cloud Scheduler / Cloud Functions-trigger equivalent, declared in `ainize.json`.
 */
import { Link, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { useAccessibleAppsQuery } from '@/api/api';
import { relativeTime, type Project } from '@/api/projects';
import { Alert } from '@/components/ui/Form';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { projectPath } from '@/lib/reservedRoutes';
import { runProjects } from '@/lib/appProjects';
import { withQuery } from '@/lib/uiNavigation';
import { Button } from '@/components/ui/Button';
import { CardGrid, CenterProgress, Mono, PageWrapper, StyledLink, Title } from '@/components/ui/Misc';

const Header = styled.div`
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;
  p { margin: 8px 0 0; color: #62616b; line-height: 1.6; max-width: 72ch; }
`;
const Actions = styled.div`display: flex; align-items: center; flex-wrap: wrap; gap: 12px;`;
const Primary = styled(Link)`
  display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px;
  border-radius: 8px; color: white; background: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; font-weight: 600;
  &:hover { background: ${(p) => p.theme.color.HOVER}; }
`;
const Ways = styled.section`
  margin: 0 0 24px; padding: 16px 20px; border: 1px solid #e5e1eb; border-radius: 12px; background: #faf9fc;
  h2 { margin: 0 0 8px; font-size: 15px; }
  ul { margin: 0; padding-left: 18px; color: #62616b; font-size: 13px; line-height: 1.7; }
  footer { margin-top: 10px; font-size: 13px; color: #62616b; }
`;
const Card = styled.article`
  min-width: 0; display: flex; flex-direction: column; gap: 14px; padding: 20px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 12px; background: white;
  h2 { font-size: 17px; margin: 0; overflow-wrap: anywhere; }
  p { margin: 0; font-size: 13px; color: #62616b; overflow-wrap: anywhere; }
  footer { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-top: auto; padding-top: 12px; border-top: 1px solid #eee; }
  footer a { min-height: 44px; display: inline-flex; align-items: center; }
`;
const Meta = styled.div`display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12px; color: #62616b;`;
const Status = styled.span<{ $status: string }>`
  display: inline-flex; align-items: center; gap: 6px;
  &::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: ${(p) => p.$status === 'ready' ? '#2f854b' : p.$status === 'error' ? '#c53636' : '#9a7626'}; }
`;
const Notice = styled.section`
  padding: 40px 24px; border: 1px solid #e5e1eb; border-radius: 12px; background: #faf9fc;
  h2 { margin: 0 0 10px; font-size: 20px; } p { margin: 0 0 24px; color: #62616b; line-height: 1.6; max-width: 65ch; }
`;
const Summary = styled.p`margin: 0 0 16px; color: #62616b; font-size: 14px;`;

export const RUNS_GUIDE = '/docs/how-to/run-scripts-on-a-schedule';
export const RUNS_EXAMPLE = `${RUNS_GUIDE}#the-triggers-key`;

export default function RunsPage() {
  const { t } = useT();
  const auth = useAuth();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const apps = useAccessibleAppsQuery({ principal: auth.principal ?? '', orgs: auth.sso?.orgs.map((o) => o.slug) ?? [] },
    { skip: !auth.isSignedIn, pollingInterval: 15_000, refetchOnMountOrArgChange: true });
  const rows = runProjects(apps.currentData?.projects ?? [], q);
  const partial = apps.isError || !!apps.currentData?.failedSources?.length;
  const next = `/runs${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  useTitle(t('runs.title'));
  return <PageWrapper>
    <Header>
      <div>
        <Title>{t('runs.title')}</Title>
        <p>{t('runs.lede')}</p>
        <p>{t('runs.vs_deployments')} <StyledLink to="/deployments">{t('runs.vs_deployments_link')}</StyledLink> · <StyledLink to="/docs/concepts/deployments-and-runs">{t('runs.vs_doc')}</StyledLink></p>
      </div>
      <Actions>
        <StyledLink to={RUNS_GUIDE} data-testid="runs-guide">{t('runs.guide')}</StyledLink>
        {auth.isSignedIn && <StyledLink to="/me/projects?kind=script" data-testid="runs-mine">{t('runs.mine')}</StyledLink>}
        <Primary to="/projects/new" title={t('runs.new_hint')} data-testid="runs-new">{t('runs.new')}</Primary>
      </Actions>
    </Header>
    <Ways aria-label={t('runs.how.title')}>
      <h2>{t('runs.how.title')}</h2>
      <ul>
        <li>{t('runs.how.manual')}</li>
        <li>{t('runs.how.schedule')}</li>
        <li>{t('runs.how.ain')}</li>
        <li>{t('runs.how.http')}</li>
      </ul>
      <footer>{t('runs.example')} <StyledLink to={RUNS_EXAMPLE}>{t('runs.example_link')}</StyledLink></footer>
    </Ways>
    {auth.loading ? <CenterProgress /> : !auth.isSignedIn ? <Notice>
      <h2>{t('runs.signin.title')}</h2><p>{t('runs.signin.body')}</p>
      <Primary to={`/signing?next=${encodeURIComponent(next)}`}>{t('apps.signin.action')}</Primary>
    </Notice> : apps.isError && !apps.currentData ? <Notice role="alert">
      <h2>{t('runs.error.title')}</h2><p>{t('runs.error.body')}</p><Button onClick={() => apps.refetch()}>{t('apps.retry')}</Button>
    </Notice> : !apps.currentData ? <CenterProgress /> : <>
      {partial && <Alert $tone="warning" role="alert" data-testid="runs-partial">{t(apps.isError ? 'runs.refresh_failed' : 'runs.partial')} <Button loading={apps.isFetching} onClick={() => void apps.refetch()}>{t('apps.retry')}</Button></Alert>}
      <Summary>{q ? t('runs.search_results', { q }) : t(partial ? 'runs.loaded_count' : 'runs.count', { n: rows.length })}</Summary>
      {!rows.length && partial ? <Notice><h2>{t('runs.partial_empty')}</h2><p>{t('runs.partial_hint')}</p></Notice> : !rows.length ? <Notice data-testid="runs-empty"><h2>{t(q ? 'runs.search_none' : 'runs.empty.title', { q })}</h2>
        <p>{q ? t('runs.search_hint') : t('runs.empty.body')}</p>
        {q ? <StyledLink to="/runs">{t('runs.all')}</StyledLink> : <Primary to="/projects/new">{t('runs.new')}</Primary>}
      </Notice> : <CardGrid aria-label={t('runs.title')}>
        {rows.map((p) => <RunCard key={p.id} project={p} />)}
      </CardGrid>}
    </>}
  </PageWrapper>;
}

function RunCard({ project: p }: { project: Project }) {
  const { t } = useT();
  const entry = p.entry ?? p.manifest?.entry ?? null;
  const last = p.lastDeployment?.createdAt ?? null;
  return (
    <Card data-testid="run-card">
      <Meta><span>{t('projects.kind.script')}{entry ? <> · <Mono>{entry}</Mono></> : null}</span><Status $status={p.status}>{t(`projects.status.${p.status}`)}</Status></Meta>
      <h2><StyledLink to={projectPath(p)}>{p.name || p.repoName}</StyledLink></h2>
      <p>{p.org}/{p.repoName}{p.sourcePath ? ` · ${p.sourcePath}` : ''}</p>
      <p>{p.branch} · {t('runs.last_run')}: {last ? relativeTime(last) : t('runs.never')}</p>
      <footer><StyledLink to={withQuery(projectPath(p), { tab: 'runs' })}>{t('runs.project')}</StyledLink></footer>
    </Card>
  );
}
