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
  display: grid; grid-template-columns: 1fr auto; gap: 6px 16px; align-items: center; font-size: 14px;
`;
const Name = styled.div`display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-weight: 600;`;
const Line = styled.div`grid-column: 1 / -1; display: flex; gap: 12px; flex-wrap: wrap; font-size: 13px; color: #666;`;
const Subject = styled.span`max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Quick = styled.div`display: flex; gap: 8px; align-items: center;`;
const Action = styled(Link)`
  font-size: 13px; font-weight: 600; padding: 5px 12px; border-radius: 4px; text-decoration: none; white-space: nowrap;
  border: 1px solid ${(p) => p.theme.color.PRIMARY}; color: ${(p) => p.theme.color.PRIMARY}; background: #fff;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;

export default function OrgRepositoriesPage() {
  const { t } = useT();
  const { org = '' } = useParams();
  const reserved = isReservedFirstSegment(org);
  const projectsQ = useOrgProjectsQuery(org, { skip: reserved, pollingInterval: 15_000 });
  const reposQ = useOrgRepositoriesQuery(org, { skip: reserved });
  const orgQ = useOrgQuery(org, { skip: reserved });
  const profile = parseOrgProfile(orgQ.data);
  useTitle(profile?.name ?? org);
  if (reserved) return <NotFoundPage />;
  if (projectsQ.isLoading && !projectsQ.data) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!projectsQ.data) {
    const why = projectApiErrorOf(projectsQ.error);
    return <PageWrapper><TitleRow><Title>{org}</Title></TitleRow><Empty>{why.code === 'not_found' ? t('projects.org.not_found') : (why.message ?? t(`projects.api.${why.code}`))}</Empty></PageWrapper>;
  }
  const slug = projectsQ.data.org;
  const repos = reposQ.data?.repositories ?? [];
  const rows = mergeOrgRepos(projectsQ.data.projects, repos);
  const driveUrl = reposQ.data?.driveUrl ?? null;
  const members = profile?.member_count ?? null;
  return (
    <PageWrapper $wide>
      <TitleRow><Title>{profile?.name ?? slug}</Title>{profile?.name && profile.name !== slug && <Chip>{slug}</Chip>}</TitleRow>
      <HeaderMeta>
        {typeof members === 'number' && <span>{t('projects.org.members', { n: members })}</span>}
        {profile && <StyledLink to={`/org/${encodeURIComponent(profile.id)}`}>{t('projects.org.org_page')}</StyledLink>}
        {driveUrl && <ExternalLink href={driveUrl} target="_blank" rel="noreferrer">{t('projects.org.drive')} ↗</ExternalLink>}
        <span>{t('projects.org.count', { n: rows.length })}</span>
      </HeaderMeta>
      {profile?.description && <Description>{profile.description}</Description>}
      {reposQ.isError && projectApiErrorOf(reposQ.error).code === 'aindrive_off' && <Description>{t('projects.org.no_aindrive')}</Description>}
      {rows.length === 0 ? <Empty>{t('projects.org.none')}</Empty> : (
        <List>
          {rows.map((r) => {
            const p = r.project;
            const last = p?.lastDeployment ?? null;
            const kind = p?.kind ?? p?.manifest?.kind ?? null;
            const sha = last?.sha || r.repo?.headSha || null;
            const subject = last?.subject ?? r.repo?.headSubject ?? null;
            const to = p ? projectPath(p) : null;
            const isScript = !p || kind === 'script' || kind === null;
            return (
              <Item key={r.name}>
                <Name>
                  <Dot $tone={p ? statusToneOf(p.status) : 'muted'} />
                  {to ? <StyledLink to={to}>{r.name}</StyledLink> : <span>{r.name}</span>}
                  {kind && <Chip>{t(`projects.kind.${kind}`)}</Chip>}
                  {!p && r.repo && !r.repo.hasManifest && <Chip title={t('projects.org.no_manifest_hint')}>{t('projects.org.no_manifest')}</Chip>}
                </Name>
                <Quick>
                  {to && isScript && <Action to={`${to}?tab=runs`}>▶ {t('projects.runs.run')}</Action>}
                  {to && !isScript && last?.status === 'ready' && last.outputUrl && <ExternalLink href={last.outputUrl} target="_blank" rel="noreferrer">{t('projects.page.visit')} ↗</ExternalLink>}
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
