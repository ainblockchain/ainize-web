/**
 * `/me/projects` — the person's projects (`GET /api/projects` answers with the caller's own), each a line to its page.
 * `?kind=script` shows the Runs (script projects) only, `?kind=deployment` the Deployments (everything else); the Runs
 * landing links here with the first.
 */
import { useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useMyProjectsQuery } from '@/api/api';
import { statusToneOf } from '@/api/projects';
import { filterProjects, projectFilterOf, type ProjectFilter } from '@/lib/appProjects';
import { projectPath } from '@/lib/reservedRoutes';
import { Button } from '@/components/ui/Button';
import { CenterProgress, Empty, Mono, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const List = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;`;
const Item = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 14px 16px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px;
`;
const Dot = styled.span<{ $tone: 'ok' | 'warn' | 'busy' | 'muted' }>`
  display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: ${(p) => (p.$tone === 'ok' ? '#2fa84f' : p.$tone === 'warn' ? '#d6453d' : p.$tone === 'busy' ? '#9aa0a6' : '#cfd3d8')};
`;
const Meta = styled.span`color: #666; font-size: 13px;`;
const Actions = styled.div`display: flex; gap: 12px; margin: 4px 0 20px; flex-wrap: wrap; align-items: center;`;
const Filter = styled.div`display: inline-flex; gap: 4px; margin-left: auto;`;

export default function MyProjectsPage() {
  const { t } = useT();
  useTitle(t('projects.mine.title'));
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const filter = projectFilterOf(sp.get('kind'));
  const setFilter = (f: ProjectFilter) => setSp((prev) => { const n = new URLSearchParams(prev); if (f === 'all') n.delete('kind'); else n.set('kind', f); return n; });
  const { data, isLoading } = useMyProjectsQuery(undefined, { pollingInterval: 15_000 });
  const all = data?.projects ?? [];
  const rows = filterProjects(all, filter);
  return (
    <PageWrapper>
      <TitleRow><Title>{t('projects.mine.title')}</Title></TitleRow>
      <Actions>
        <Button variant="contained" onClick={() => navigate('/projects/new')}>{t('projects.mine.new')}</Button>
        <Filter role="group" aria-label={t('projects.mine.filter')} data-testid="projects-filter">
          {(['all', 'deployment', 'script'] as const).map((f) => (
            <Button key={f} size="small" variant={filter === f ? 'contained' : undefined} aria-pressed={filter === f} onClick={() => setFilter(f)}>{t(`projects.mine.filter_${f}`)}</Button>
          ))}
        </Filter>
      </Actions>
      {isLoading && !data ? <CenterProgress /> : rows.length === 0 ? <Empty>{all.length === 0 ? t('projects.mine.empty') : t(filter === 'script' ? 'projects.mine.no_runs' : 'projects.mine.no_deployments')}</Empty> : (
        <List>
          {rows.map((p) => (
            <Item key={p.id}>
              <Dot $tone={statusToneOf(p.status)} />
              <StyledLink to={projectPath(p)}><strong>{p.org}/{p.repoName}</strong></StyledLink>
              <Meta><Mono>{p.branch}</Mono></Meta>
              {p.kind && <Meta>{t(`projects.kind.${p.kind}`)}</Meta>}
              <Meta>{t(`projects.status.${p.status}`)}</Meta>
            </Item>
          ))}
        </List>
      )}
    </PageWrapper>
  );
}
