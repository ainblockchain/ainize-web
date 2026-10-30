/**
 * `/me/projects` — the person's projects (`GET /api/projects` answers with the caller's own), each a line to its page.
 */
import { useLocation, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useMyProjectsQuery } from '@/api/api';
import { statusToneOf } from '@/api/projects';
import { projectPath } from '@/lib/reservedRoutes';
import { Button } from '@/components/ui/Button';
import { CenterProgress, Empty, Mono, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { useAuth } from '@/auth/AuthContext';
import { signInHref } from '@/lib/uiNavigation';
import { Alert } from '@/components/ui/Form';

const List = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;`;
const Item = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 14px 16px;
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px; overflow-wrap: anywhere; & > * { min-width: 0; }
`;
const Dot = styled.span<{ $tone: 'ok' | 'warn' | 'busy' | 'muted' }>`
  display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: ${(p) => (p.$tone === 'ok' ? '#2fa84f' : p.$tone === 'warn' ? '#d6453d' : p.$tone === 'busy' ? '#9aa0a6' : '#cfd3d8')};
`;
const Meta = styled.span`color: #666; font-size: 13px;`;
const Actions = styled.div`display: flex; gap: 12px; margin: 4px 0 20px;`;

export default function MyProjectsPage() {
  const { t } = useT();
  useTitle(t('projects.mine.title'));
  const navigate = useNavigate();
  const auth = useAuth();
  const location = useLocation();
  const query = useMyProjectsQuery(auth.cacheIdentity, { skip: !auth.isSignedIn || auth.loading, pollingInterval: 15_000 });
  const { currentData: data, isFetching, isError } = query;
  const valid = Array.isArray(data?.projects);
  const rows = valid ? data.projects : [];
  const waiting = auth.loading || (!data && isFetching);
  if (waiting) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!auth.isSignedIn) return <PageWrapper><StyledLink to={signInHref(location)}>{t('projects.runs.sign_in_button')}</StyledLink></PageWrapper>;
  return (
    <PageWrapper>
      <TitleRow><Title>{t('projects.mine.title')}</Title></TitleRow>
      <Actions><Button variant="contained" onClick={() => navigate('/projects/new')}>{t('projects.mine.new')}</Button></Actions>
      {isError || !valid ? <Alert role="alert" $tone="error">{t('projects.page.load_failed')} <Button loading={isFetching} onClick={() => void query.refetch()}>{t('projects.page.retry')}</Button></Alert> : rows.length === 0 ? <Empty>{t('projects.mine.empty')}</Empty> : (
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
