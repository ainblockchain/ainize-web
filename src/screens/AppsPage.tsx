import { Link, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { useAccessibleAppsQuery, useProjectDeploymentsQuery } from '@/api/api';
import { relativeTime, type Project } from '@/api/projects';
import { activeProjectUrl } from '@/lib/projectActions';
import { Alert } from '@/components/ui/Form';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { projectPath } from '@/lib/reservedRoutes';
import { appProjects } from '@/lib/appProjects';
import { Button } from '@/components/ui/Button';
import { CardGrid, CenterProgress, PageWrapper, StyledLink, SectionTitle } from '@/components/ui/Misc';

const Header = styled.div`
  display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;
`;
const Actions = styled.div`display: flex; align-items: center; flex-wrap: wrap; gap: 12px;`;
const Primary = styled(Link)`
  display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px;
  border-radius: 8px; color: white; background: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; font-weight: 600;
  &:hover { background: ${(p) => p.theme.color.HOVER}; }
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

export default function AppsPage() {
  const { t } = useT();
  const auth = useAuth();
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const apps = useAccessibleAppsQuery({ principal: auth.principal ?? '', orgs: auth.sso?.orgs.map((o) => o.slug) ?? [] },
    { skip: !auth.isSignedIn, pollingInterval: 15_000, refetchOnMountOrArgChange: true });
  const rows = appProjects(apps.currentData?.projects ?? [], q);
  const partial = apps.isError || !!apps.currentData?.failedSources?.length;
  const next = `/deployments${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  useTitle(t('apps.title'));
  return <PageWrapper>
    <SectionTitle>{t('nav.apps')}</SectionTitle>
    <Header>
      <p>{t('apps.vs_runs')} <StyledLink to="/runs">{t('nav.runs')}</StyledLink> · <StyledLink to="/docs/concepts/deployments-and-runs">{t('apps.vs_runs_doc')}</StyledLink></p>
      <Actions><StyledLink to="/docs/how-to/deploy-nextjs">{t('apps.guide')}</StyledLink><Primary to="/projects/new">{t('apps.new')}</Primary></Actions>
    </Header>
    {auth.loading ? <CenterProgress /> : !auth.isSignedIn ? <Notice>
      <h2>{t('apps.signin.title')}</h2><p>{t('apps.signin.body')}</p>
      <Primary to={`/signing?next=${encodeURIComponent(next)}`}>{t('apps.signin.action')}</Primary>
    </Notice> : apps.isError && !apps.currentData ? <Notice role="alert">
      <h2>{t('apps.error.title')}</h2><p>{t('apps.error.body')}</p><Button onClick={() => apps.refetch()}>{t('apps.retry')}</Button>
    </Notice> : !apps.currentData ? <CenterProgress /> : <>
      {partial && <Alert $tone="warning" role="alert" data-testid="apps-partial">{t(apps.isError ? 'apps.refresh_failed' : 'apps.partial')} <Button loading={apps.isFetching} onClick={() => void apps.refetch()}>{t('apps.retry')}</Button></Alert>}
      <Summary>{q ? t('apps.search_results', { q }) : t(partial ? 'apps.loaded_count' : 'apps.count', { n: rows.length })}</Summary>
      {!rows.length && partial ? <Notice><h2>{t('apps.partial_empty')}</h2><p>{t('apps.partial_hint')}</p></Notice> : !rows.length ? <Notice><h2>{t(q ? 'apps.search_none' : 'apps.empty.title', { q })}</h2>
        <p>{t(q ? 'apps.search_hint' : 'apps.empty.body')}</p>
        {q ? <StyledLink to="/deployments">{t('apps.all')}</StyledLink> : <Primary to="/projects/new">{t('apps.new')}</Primary>}
      </Notice> : <CardGrid aria-label={t('apps.title')}>
        {rows.map((p) => <AppCard key={p.id} project={p} />)}
      </CardGrid>}
    </>}
  </PageWrapper>;
}

/** Resolve a previous active deployment when the newest build failed or was rolled back. */
function AppCard({ project: p }: { project: Project }) {
  const { t } = useT();
  const knownUrl = activeProjectUrl(p);
  const needsHistory = !knownUrl && !!(p.activeDeploymentId || p.activeCommit);
  const history = useProjectDeploymentsQuery(p.id, { skip: !needsHistory, pollingInterval: needsHistory ? 15_000 : 0, refetchOnMountOrArgChange: true });
  const url = activeProjectUrl(p, history.currentData?.deployments ?? []);
  return (
    <Card>
      <Meta><span>{p.kind === 'nextjs' ? 'Next.js' : t('apps.service')}</span><Status $status={p.status}>{t(`projects.status.${p.status}`)}</Status></Meta>
      <h2><StyledLink to={projectPath(p)}>{p.name || p.repoName}</StyledLink></h2>
      <p>{p.org}/{p.repoName}{p.sourcePath ? ` · ${p.sourcePath}` : ''}</p>
      <p>{p.branch} · {relativeTime(p.updatedAt)}</p>
      <footer><StyledLink to={projectPath(p)}>{t('apps.project')}</StyledLink>
        {url && <a href={url} target="_blank" rel="noreferrer">{t('apps.open')} ↗</a>}
        {history.isError && <span>{t('apps.url_failed')} <Button size="small" onClick={() => void history.refetch()}>{t('apps.retry')}</Button></span>}
      </footer>
    </Card>
  );
}
