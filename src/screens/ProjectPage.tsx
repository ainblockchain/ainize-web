/**
 * `/projects/:id` — one project and its deployments, the Vercel-shaped rows: a status dot (grey pulsing while queued
 * or building, green ready, red error), the commit, the kind the repo's ainize.json resolved to, who pushed, how
 * long it took, *Inspect* (the log, inline) and *Visit* (the URL it produced). The list and an open log of a
 * running deployment poll every two seconds until it settles; nothing else polls.
 *
 * Owner only — the node answers 404 to anyone else, and so does this page.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import styled, { keyframes } from 'styled-components';
import { useDeleteProjectMutation, useDeploymentLogQuery, useProjectDeploymentsQuery, useProjectQuery } from '@/api/api';
import { durationLabel, projectApiErrorOf, shortSha, statusToneOf, type Deployment, type DeploymentStatus, type ProjectStatus } from '@/api/projects';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, ExternalLink, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const pulse = keyframes`0%,100% { opacity: 1; } 50% { opacity: .35; }`;
const Dot = styled.span<{ $tone: 'ok' | 'warn' | 'busy' | 'muted' }>`
  display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: ${(p) => (p.$tone === 'ok' ? '#2fa84f' : p.$tone === 'warn' ? '#d6453d' : p.$tone === 'busy' ? '#9aa0a6' : '#cfd3d8')};
`;
const BusyDot = styled(Dot)`animation: ${pulse} 1.2s ease-in-out infinite;`;
const Rows = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;`;
const Row = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px;
`;
const Head = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px;`;
const Meta = styled.span`color: #666; font-size: 13px;`;
const Spacer = styled.span`flex: 1;`;
const Chip = styled.span<{ $tone: 'ok' | 'warn' | 'busy' | 'muted' }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px;
  background: ${(p) => (p.$tone === 'ok' ? '#e8f6ec' : p.$tone === 'warn' ? '#fdeeee' : '#f1f2f5')};
  color: ${(p) => (p.$tone === 'ok' ? '#227a3c' : p.$tone === 'warn' ? '#a33030' : '#555')};
`;
const Log = styled.pre`
  margin: 0; padding: 12px 14px; border-radius: 8px; background: #0f1419; color: #d7dde3; font-size: 12.5px; line-height: 1.5;
  max-height: 480px; overflow: auto; white-space: pre-wrap; word-break: break-word;
`;
const HeadActions = styled.div`display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 4px 0 12px;`;

const isLive = (s: DeploymentStatus | ProjectStatus) => s === 'queued' || s === 'building';
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : '');

function StatusDot({ status }: { status: DeploymentStatus | ProjectStatus }) {
  const tone = statusToneOf(status);
  return tone === 'busy' ? <BusyDot $tone={tone} /> : <Dot $tone={tone} />;
}

function DeploymentLog({ deployment }: { deployment: Deployment }) {
  const { t } = useT();
  const { data, isLoading } = useDeploymentLogQuery(deployment.id, { pollingInterval: isLive(deployment.status) ? 2000 : 0 });
  if (isLoading && !data) return <Log>{t('projects.page.log_empty')}</Log>;
  return <Log>{data?.length ? data : t('projects.page.log_empty')}</Log>;
}

function DeploymentRow({ d, branch }: { d: Deployment; branch: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(d.status === 'error');
  const tone = statusToneOf(d.status);
  return (
    <Row>
      <Head>
        <StatusDot status={d.status} />
        <Chip $tone={tone}>{t(`projects.status.${d.status}`)}</Chip>
        <Mono title={d.sha}>{shortSha(d.sha)}</Mono>
        <Meta>{branch}</Meta>
        {d.kind && <Chip $tone="muted">{t(`projects.kind.${d.kind}`)}</Chip>}
        {d.pusher && <Meta>{t('projects.page.by', { who: d.pusher.email ?? d.pusher.subject })}</Meta>}
        <Spacer />
        <Meta>{when(d.createdAt)}</Meta>
        {d.ms !== null && <Meta>{durationLabel(d.ms)}</Meta>}
        {d.exitCode !== undefined && d.exitCode !== 0 && <Meta>{t('projects.page.exit', { code: d.exitCode })}</Meta>}
        <Button size="small" onClick={() => setOpen((v) => !v)}>{open ? t('projects.page.hide_log') : t('projects.page.inspect')}</Button>
        {d.status === 'ready' && d.outputUrl && <ExternalLink href={d.outputUrl} target="_blank" rel="noreferrer">{t('projects.page.visit')} ↗</ExternalLink>}
      </Head>
      {d.status === 'queued' && <Meta>{t('projects.page.pending_hint')}</Meta>}
      {d.error && <Alert $tone="error" style={{ padding: '8px 12px' }}>{d.error}</Alert>}
      {open && <DeploymentLog deployment={d} />}
    </Row>
  );
}

export default function ProjectPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const project = useProjectQuery(id);
  const live = !!project.data && isLive(project.data.status);
  const deployments = useProjectDeploymentsQuery(id, { pollingInterval: live ? 2000 : 15_000 });
  useTitle(project.data ? `${project.data.org}/${project.data.repoName}` : t('projects.page.title'));
  // The project row's status follows its newest deployment; re-read it as soon as the list says it settled.
  const newest = deployments.data?.deployments[0]?.status;
  useEffect(() => { if (newest && project.data && newest !== project.data.status) void project.refetch(); }, [newest, project]);
  const [remove, { isLoading: removing }] = useDeleteProjectMutation();
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => deployments.data?.deployments ?? [], [deployments.data]);

  if (project.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!project.data) {
    const why = projectApiErrorOf(project.error);
    return <PageWrapper><TitleRow><Title>{t('projects.page.title')}</Title></TitleRow><Empty>{why.code === 'not_found' || why.status === 404 ? t('projects.page.not_found') : (why.message ?? t(`projects.api.${why.code}`))}</Empty></PageWrapper>;
  }
  const p = project.data;

  const del = async () => {
    if (!window.confirm(t('projects.page.delete_confirm', { name: p.name }))) return;
    setError(null);
    try { await remove(p.id).unwrap(); navigate('/me/projects', { replace: true }); }
    catch (err) { const e = projectApiErrorOf(err); setError(e.message ?? t(`projects.api.${e.code}`)); }
  };

  return (
    <PageWrapper>
      <TitleRow>
        <Title style={{ display: 'flex', alignItems: 'center', gap: 12 }}><StatusDot status={p.status} />{p.org}/{p.repoName}</Title>
        <Chip $tone={statusToneOf(p.status)}>{t(`projects.status.${p.status}`)}</Chip>
      </TitleRow>
      <Description>{p.name !== p.repoName ? p.name : ''}</Description>
      <KeyValue>
        <dt>{t('projects.page.repo')}</dt><dd><ExternalLink href={p.repo} target="_blank" rel="noreferrer">{p.repo}</ExternalLink></dd>
        <dt>{t('projects.page.branch')}</dt><dd><Mono>{p.branch}</Mono></dd>
        <dt>{t('projects.page.kind')}</dt><dd>{p.kind ? t(`projects.kind.${p.kind}`) : <Meta>{t('projects.page.kind_pending')}</Meta>}</dd>
        <dt>URL</dt><dd><Mono>{p.url}</Mono> <CopyButton text={p.url} /></dd>
      </KeyValue>
      <HeadActions>
        <StyledLink to="/me/projects">← {t('projects.mine.title')}</StyledLink>
        <Spacer />
        <Button size="small" color="secondary" loading={removing} onClick={del}>{t('projects.page.delete')}</Button>
      </HeadActions>
      {error && <Alert $tone="error">{error}</Alert>}
      <SubTitle>{t('projects.page.deployments')}</SubTitle>
      {rows.length === 0
        ? <Empty>{t('projects.page.no_deployments', { branch: p.branch })}</Empty>
        : <Rows>{rows.map((d) => <DeploymentRow key={d.id} d={d} branch={p.branch} />)}</Rows>}
    </PageWrapper>
  );
}
