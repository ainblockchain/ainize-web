import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useAuth } from '@/auth/AuthContext';
import { useMyProjectsQuery } from '@/api/api';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { looksLikeSlug, orgPath } from '@/lib/reservedRoutes';
import { Button } from '@/components/ui/Button';
import { CardGrid, Description, Empty, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';

const Card = styled.section`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 12px;
  background: #fff; padding: 20px; margin-top: 20px; min-width: 0;
  h2 { font-size: 18px; margin: 0 0 12px; } p { line-height: 1.6; }
`;
/** One project, on huggingface.co's card grid. */
const ProjectCard = styled(Link)`
  display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; text-decoration: none; min-width: 0;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
  .nm { font-size: 14px; font-weight: 600; color: ${(p) => p.theme.color.BLACK}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .by { font-size: 12px; color: ${(p) => p.theme.color.GREY}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
const Results = styled(CardGrid)`margin-top: 16px;`;
const Actions = styled.div`display: flex; gap: 16px; flex-wrap: wrap; align-items: center;`;
const Form = styled.form`
  display: flex; gap: 12px; flex-wrap: wrap; align-items: end;
  label { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 160px; }
  input { font: inherit; padding: 10px 12px; border: 1px solid #bbb; border-radius: 8px; width: 100%; box-sizing: border-box; }
`;

export default function AppsPage() {
  const { t } = useT();
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState('');
  useTitle(t('apps.title'));
  /** `?q=` is how the header's search hands over its query ("See all apps"). Apps are the signed-in person's projects. */
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const mine = useMyProjectsQuery(undefined, { skip: !isSignedIn || !q });
  const needle = q.toLowerCase();
  const hits = (mine.data?.projects ?? []).filter((p) => `${p.name} ${p.org}/${p.repoName} ${p.kind ?? ''}`.toLowerCase().includes(needle));
  return <PageWrapper>
    <TitleRow><Title>{t('apps.title')}</Title></TitleRow>
    <Description>{t('apps.lede')}</Description>
    {q && (
      <section aria-label={t('apps.search_results', { q })} data-testid="apps-search">
        <h2 style={{ fontSize: 18, margin: '24px 0 0' }}>{t('apps.search_results', { q })}</h2>
        {!isSignedIn ? <Empty>{t('search.apps_signin')}</Empty>
          : mine.isLoading ? null
          : !hits.length ? <Empty>{t('apps.search_none', { q })}</Empty>
          : <Results>{hits.map((p) => (
              <ProjectCard key={p.id} to={`/${encodeURIComponent(p.org)}/${encodeURIComponent(p.repoName)}`} data-testid={`apps-hit-${p.id}`}>
                <span className="nm">{p.name || `${p.org}/${p.repoName}`}</span>
                <span className="by">{p.org}/{p.repoName}{p.kind ? ` · ${p.kind}` : ''}</span>
              </ProjectCard>
            ))}</Results>}
      </section>
    )}
    <Actions>
      <StyledLink to="/projects/new">{t('apps.connect')}</StyledLink>
      {isSignedIn && <StyledLink to="/me/projects">{t('apps.mine')}</StyledLink>}
      <StyledLink to="/docs/how-to/deploy-nextjs">{t('apps.guide')}</StyledLink>
    </Actions>
    <Card>
      <h2>{t('apps.team')}</h2>
      <p>{t('apps.team.lede')}</p>
      <Form onSubmit={(e) => { e.preventDefault(); if (looksLikeSlug(org.trim())) navigate(orgPath(org.trim())); }}>
        <label>{t('apps.org')}<input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="comcom" autoCapitalize="none" autoCorrect="off" /></label>
        <Button type="submit" disabled={!looksLikeSlug(org.trim())}>{t('apps.browse')}</Button>
      </Form>
    </Card>
    <Card>
      <h2>Next.js Hello World</h2>
      <p>{t('apps.example')}</p>
      <Actions>
        <StyledLink to="/comcom/nextjs-hello-world">{t('apps.project')}</StyledLink>
        <a href="https://aindrive.ainetwork.ai/comcom/git/nextjs-hello-world">{t('apps.source')}</a>
      </Actions>
    </Card>
  </PageWrapper>;
}
