import { useAuth } from '@/auth/AuthContext';
/**
 * `/<org>` — an organization's repositories, the counterpart of the aindrive drive folder `repositories/`
 * (`https://aindrive.ainetwork.ai/d/<driveId>?path=repositories`), laid out like a GitHub organization page: the
 * header (slug, name and member count when the node's organization record knows them, a link to the drive), then
 * one row per repo — name (→ `/<org>/<repo>`), kind, the newest deployment's status dot and relative time, the
 * last push's sha and subject, and a Run / Visit / Open quick action.
 *
 * Two sources, merged by name (`mergeOrgRepos`): the projects bound on this node (`GET /api/orgs/:org/projects`)
 * and the drive's listing as aindrive gives it through the node (`GET /api/orgs/:org/repositories`, the node's
 * machine token). A repo aindrive has that no project is bound to reads "not deployed yet · push to deploy", so
 * the page matches the drive before a first push. Without a machine identity the node answers 503 and the page
 * shows the projects alone.
 */
import { Link, useParams } from 'react-router';
import styled from 'styled-components';
import { useOrgProjectsQuery, useOrgQuery, useOrgRepositoriesQuery } from '@/api/api';
import { parseOrgProfile } from '@/api/organizations';
import { mergeOrgRepos, projectApiErrorOf, relativeTime, shortSha, statusToneOf } from '@/api/projects';
import { CenterProgress, Description, Empty, ExternalLink, Mono, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { isReservedFirstSegment, projectPath } from '@/lib/reservedRoutes';
import { Alert } from '@/components/ui/Form';
import { Button } from '@/components/ui/Button';
import { withQuery } from '@/lib/uiNavigation';
import { activeProjectUrl, hasProjectRunTargets } from '@/lib/projectActions';
import { useTitle } from '@/utils/useTitle';
import NotFoundPage from './NotFoundPage';

type Tone = 'ok' | 'warn' | 'busy' | 'muted';
const Dot = styled.span<{ $tone: Tone }>`
  display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: ${(p) => (p.$tone === 'ok' ? '#2fa84f' : p.$tone === 'warn' ? '#d6453d' : p.$tone === 'busy' ? '#9aa0a6' : '#cfd3d8')};
`;
const Chip = styled.span`font-size: 12px; padding: 2px 8px; border-radius: 999px; background: #f1f2f5; color: #555; white-space: nowrap;`;
const HeaderMeta = styled.div`display: flex; gap: 14px; flex-wrap: wrap; align-items: center; font-size: 13px; color: #666; margin: -6px 0 18px;`;
const List = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;`;
const Item = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 14px 16px;
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; font-size: 14px;
  @media (max-width: 640px) { grid-template-columns: minmax(0, 1fr); }
`;
const Name = styled.div`min-width: 0; overflow-wrap: anywhere; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 600; a { min-width: 0; }`;
const Line = styled.div`grid-column: 1 / -1; display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: #666;`;
const Subject = styled.span`max-width: min(420px, 100%); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Quick = styled.div`display: flex; flex-wrap: wrap; gap: 8px; align-items: center;`;
const Action = styled(Link)`
  font-size: 13px; font-weight: 600; padding: 5px 12px; border-radius: 4px; text-decoration: none; white-space: nowrap;
  border: 1px solid ${(p) => p.theme.color.PRIMARY}; color: ${(p) => p.theme.color.PRIMARY}; background: #fff;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;

export default function OrgRepositoriesPage() {
  const { t } = useT();
  const { org = '' } = useParams();
  const auth = useAuth();
  const reserved = isReservedFirstSegment(org);
  const projectsQ = useOrgProjectsQuery({ org, identity: auth.cacheIdentity }, { skip: reserved, pollingInterval: 15_000 });
  const reposQ = useOrgRepositoriesQuery({ org, identity: auth.cacheIdentity }, { skip: reserved });
  const orgQ = useOrgQuery({ id: org, identity: auth.cacheIdentity }, { skip: reserved });
  const signedIn = auth.isSignedIn;
  const profile = orgQ.error ? null : parseOrgProfile(orgQ.currentData);
  const validProjects = typeof projectsQ.currentData?.org === 'string' && Array.isArray(projectsQ.currentData?.projects);
  const validRepos = Array.isArray(reposQ.currentData?.repositories);
  const reposFailed = reposQ.isError || (!reposQ.isFetching && !validRepos);
  useTitle(profile?.name ?? org);
  if (reserved) return <NotFoundPage />;
  if (projectsQ.isFetching && !projectsQ.currentData) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!validProjects || !projectsQ.currentData || (projectsQ.error && [401, 403, 404].includes(projectApiErrorOf(projectsQ.error).status ?? 0))) {
    const why = projectApiErrorOf(projectsQ.error);
    return <PageWrapper><TitleRow><Title>{org}</Title></TitleRow><Empty>{why.code === 'not_found' ? t('projects.org.not_found') : (why.message ?? t(`projects.api.${why.code}`))}</Empty><Button loading={projectsQ.isFetching} onClick={() => void projectsQ.refetch()}>{t('projects.page.retry')}</Button></PageWrapper>;
  }
  const slug = projectsQ.currentData.org;
  const repos = reposFailed ? [] : reposQ.currentData?.repositories ?? [];
  const rows = mergeOrgRepos(projectsQ.currentData.projects, repos);
  const driveUrl = reposFailed ? null : reposQ.currentData?.driveUrl ?? null;
  const members = profile?.member_count ?? null;
  const accessRequired = rows.length === 0 && reposQ.isError && projectApiErrorOf(reposQ.error).code === 'not_found';
  return (
    <PageWrapper $wide>
      <TitleRow><Title>{profile?.name ?? slug}</Title>{profile?.name && profile.name !== slug && <Chip>{slug}</Chip>}</TitleRow>
      <HeaderMeta>
        {typeof members === 'number' && <span>{t('projects.org.members', { n: members })}</span>}
        {profile && <StyledLink to={`/org/${encodeURIComponent(profile.id)}`}>{t('projects.org.org_page')}</StyledLink>}
        {driveUrl && <ExternalLink href={driveUrl} target="_blank" rel="noreferrer">{t('projects.org.drive')} ↗</ExternalLink>}
        {!accessRequired && validRepos && !reposFailed && !projectsQ.error && <span>{t('projects.org.count', { n: rows.length })}</span>}
      </HeaderMeta>
      {profile?.description && <Description>{profile.description}</Description>}
      {projectsQ.isError && <Alert role="alert" $tone="error">{t('projects.page.load_failed')} <Button loading={projectsQ.isFetching} onClick={() => void projectsQ.refetch()}>{t('projects.page.retry')}</Button></Alert>}
      {reposFailed && !accessRequired && <Alert role="alert" $tone="error">{t('projects.org.list_failed')} <Button loading={reposQ.isFetching} onClick={() => void reposQ.refetch()}>{t('projects.page.retry')}</Button></Alert>}
      {reposQ.isError && projectApiErrorOf(reposQ.error).code === 'aindrive_off' && <Description>{t('projects.org.no_aindrive')}</Description>}
      {accessRequired ? <Empty><p>{t(signedIn ? 'projects.org.members_only' : 'projects.org.signin_hint')}</p>{signedIn ? <StyledLink to="/org">{t('orgs.title')}</StyledLink> : <StyledLink to={`/signing?next=${encodeURIComponent(`/${org}`)}`}>{t('projects.org.signin')}</StyledLink>}</Empty> : rows.length === 0 && reposQ.isFetching ? <CenterProgress /> : rows.length === 0 ? (!reposFailed && !projectsQ.error && <Empty>{t('projects.org.none')}</Empty>) : (
        <List>
          {rows.map((r) => {
            const p = r.project;
            const last = p?.lastDeployment ?? null;
            const kind = p?.kind ?? p?.manifest?.kind ?? null;
            const sha = last?.sha || r.repo?.headSha || null;
            const subject = last?.subject ?? r.repo?.headSubject ?? null;
            const to = p ? projectPath(p) : null;
            const canRun = !!p && hasProjectRunTargets(p);
            const visitUrl = p ? activeProjectUrl(p) : null;
            return (
              <Item key={p ? `project:${p.id}` : `repo:${r.name}`}>
                <Name>
                  <Dot $tone={p ? statusToneOf(p.status) : 'muted'} />
                  {to ? <StyledLink to={to}>{r.name}</StyledLink> : <span>{r.name}</span>}
                  {kind && <Chip>{t(`projects.kind.${kind}`)}</Chip>}
                  {!p && r.repo && !r.repo.hasManifest && <Chip title={t('projects.org.no_manifest_hint')}>{t('projects.org.no_manifest')}</Chip>}
                </Name>
                <Quick>
                  {to && canRun && <Action to={withQuery(to, { tab: 'runs' })}>▶ {t('projects.runs.run')}</Action>}
                  {to && visitUrl && <ExternalLink href={visitUrl} target="_blank" rel="noreferrer">{t('projects.page.visit')} ↗</ExternalLink>}
                  {to && <Action to={to}>{t('projects.org.open')}</Action>}
                  {!to && r.repo && <ExternalLink href={r.repo.cloneUrl} target="_blank" rel="noreferrer">aindrive ↗</ExternalLink>}
                </Quick>
                <Line>
                  {p ? <span>{t(`projects.status.${p.status}`)}{last && ` · ${relativeTime(last.createdAt)}`}</span> : <span>{t('projects.org.not_deployed')} · {t('projects.org.push_to_deploy')}</span>}
                  {sha && <span><Mono title={sha}>{shortSha(sha)}</Mono>{subject && <> <Subject title={subject}>{subject}</Subject></>}</span>}
                  {p && <span><Mono>{p.branch}</Mono></span>}
                </Line>
              </Item>
            );
          })}
        </List>
      )}
    </PageWrapper>
  );
}
