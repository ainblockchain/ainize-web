/**
 * The Sentry-style issue list and the detail panel, shared by the organization's `/org/:id/issues` page and the
 * project console's Issues tab (src/api/issues.ts). A row is one cause: kind, title, where, last/first seen, the
 * count and the last day as a sparkline; Resolve / Ignore sit on the row for whoever may write. Clicking a row opens
 * the detail: the timeline of events (newest first) and where to look next (the deployment, the run, the agent).
 */
import { useState } from 'react';
import styled from 'styled-components';
import { useIssueQuery, useSetIssueStatusMutation } from '@/api/api';
import { relativeTime } from '@/api/projects';
import { issueKindKey, issueLink, parseIssue, sparklinePoints, type Issue, type IssueStatus } from '@/api/issues';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Empty, Mono, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';

const Table = styled.div`display: flex; flex-direction: column; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; overflow: hidden; background: #fff;`;
const HeadRow = styled.div`
  display: grid; grid-template-columns: minmax(0, 1fr) 150px 70px 110px; gap: 12px; padding: 8px 16px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  background: #fafafa; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  @media (max-width: 720px) { grid-template-columns: minmax(0, 1fr) 70px; & > :nth-child(2), & > :nth-child(4) { display: none; } }
`;
const Row = styled.div<{ $open?: boolean }>`
  display: grid; grid-template-columns: minmax(0, 1fr) 150px 70px 110px; gap: 12px; align-items: center; padding: 12px 16px; cursor: pointer;
  border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: ${(p) => (p.$open ? p.theme.color.PALE_GREY : '#fff')};
  &:last-child { border-bottom: 0; }
  &:hover { background: ${(p) => (p.$open ? p.theme.color.PALE_GREY : '#fafafa')}; }
  @media (max-width: 720px) { grid-template-columns: minmax(0, 1fr) 70px; & > :nth-child(2), & > :nth-child(4) { display: none; } }
`;
const Main = styled.div`min-width: 0; display: flex; flex-direction: column; gap: 3px;`;
const TitleLine = styled.div`display: flex; gap: 8px; align-items: center; min-width: 0;`;
const IssueTitle = styled.span`font-weight: 600; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Culprit = styled.span`font-size: 12px; color: ${(p) => p.theme.color.GREY}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;`;
const Kind = styled.span<{ $tone: 'red' | 'amber' | 'grey' }>`
  flex: none; font-size: 11px; padding: 1px 7px; border-radius: 999px; white-space: nowrap;
  background: ${(p) => (p.$tone === 'red' ? '#fde8e8' : p.$tone === 'amber' ? '#fff4e0' : '#f1f2f5')}; color: ${(p) => (p.$tone === 'red' ? '#a12b2b' : p.$tone === 'amber' ? '#8a5a00' : '#555')};
`;
const Seen = styled.div`font-size: 12px; color: ${(p) => p.theme.color.GREY}; display: flex; flex-direction: column; gap: 2px;`;
const Count = styled.div`font-size: 14px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums;`;
const Spark = styled.svg`display: block; width: 96px; height: 24px; overflow: visible;`;
const Detail = styled.section`border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-top: 0; border-radius: 0 0 10px 10px; background: #fff; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;`;
const Actions = styled.div`display: flex; gap: 8px; flex-wrap: wrap; align-items: center;`;
const Meta = styled.dl`display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0; font-size: 13px; dt { color: ${(p) => p.theme.color.GREY}; } dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }`;
const Timeline = styled.ol`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow: auto;`;
const Event = styled.li`display: grid; grid-template-columns: 150px 1fr; gap: 12px; font-size: 13px; padding: 6px 0; border-top: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; &:first-child { border-top: 0; } time { color: ${(p) => p.theme.color.GREY}; white-space: nowrap; } pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }`;

const toneOf = (issue: Issue): 'red' | 'amber' | 'grey' => (issue.status !== 'unresolved' ? 'grey' : issue.kind === 'deploy_failed' || issue.kind === 'site_down' || issue.kind === 'model_down' || issue.kind === 'container_down' ? 'red' : 'amber');
const when = (ms: number) => new Date(ms).toLocaleString();

export function Sparkline({ hourly, tone }: { hourly: number[]; tone: 'red' | 'amber' | 'grey' }) {
  const color = tone === 'red' ? '#d14343' : tone === 'amber' ? '#c57b00' : '#9a9a9c';
  return (
    <Spark viewBox="0 0 96 24" aria-hidden="true" data-testid="issue-sparkline">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" points={sparklinePoints(hourly)} />
    </Spark>
  );
}

function StatusButtons({ issue, canWrite }: { issue: Issue; canWrite: boolean }) {
  const { t } = useT();
  const [setStatus, state] = useSetIssueStatusMutation();
  if (!canWrite) return null;
  const set = (status: IssueStatus) => (e: React.MouseEvent) => { e.stopPropagation(); void setStatus({ id: issue.id, status }); };
  return (
    <Actions onClick={(e) => e.stopPropagation()}>
      {issue.status !== 'resolved' && <Button size="small" variant="contained" onClick={set('resolved')} loading={state.isLoading} data-testid="issue-resolve">{t('issues.resolve')}</Button>}
      {issue.status === 'unresolved' && <Button size="small" onClick={set('ignored')} loading={state.isLoading} data-testid="issue-ignore">{t('issues.ignore')}</Button>}
      {issue.status !== 'unresolved' && <Button size="small" onClick={set('unresolved')} loading={state.isLoading} data-testid="issue-reopen">{t('issues.reopen')}</Button>}
    </Actions>
  );
}

export function IssueDetail({ id, canWrite, onClose }: { id: string; canWrite: boolean; onClose: () => void }) {
  const { t } = useT();
  const q = useIssueQuery(id, { pollingInterval: 15_000 });
  const issue = q.data ? parseIssue((q.data as { issue?: unknown }).issue) : null;
  if (q.isLoading) return <Detail><CenterProgress /></Detail>;
  if (!issue) return <Detail><Alert $tone="error">{t('issues.problem.failed')}</Alert></Detail>;
  const link = issueLink(issue);
  // the node re-opened it (statusChangedBy null) after a person had resolved it: Sentry's regression
  const regression = issue.status === 'unresolved' && issue.statusChangedAt !== null && issue.statusChangedBy === null;
  return (
    <Detail data-testid="issue-detail" aria-label={issue.title}>
      <Actions>
        <StatusButtons issue={issue} canWrite={canWrite} />
        {link && <StyledLink to={link.to} data-testid="issue-open-link">{t(link.key)}</StyledLink>}
        {issue.projectId && (issue.kind === 'deploy_failed' || issue.kind === 'run_failed') && <StyledLink to={`/projects/${encodeURIComponent(issue.projectId)}?tab=logs`}>{t('issues.runtime_logs')}</StyledLink>}
        <Button size="small" variant="text" onClick={onClose} style={{ marginLeft: 'auto' }}>{t('issues.detail.close')}</Button>
      </Actions>
      {regression && <Alert $tone="warning">{t('issues.regression')}</Alert>}
      <Meta>
        <dt>{t('issues.detail.culprit')}</dt><dd><Mono>{issue.culprit || '—'}</Mono></dd>
        <dt>{t('issues.detail.fingerprint')}</dt><dd><Mono>{issue.fingerprint}</Mono></dd>
        <dt>{t('issues.first_seen', { when: '' }).trim()}</dt><dd>{when(issue.firstSeen)}</dd>
        <dt>{t('issues.last_seen', { when: '' }).trim()}</dt><dd>{when(issue.lastSeen)} · {t('issues.count', { n: issue.count })}</dd>
        {issue.statusChangedAt !== null && <><dt>{t(`issues.status.${issue.status}`)}</dt><dd>{issue.statusChangedBy ?? 'node'} · {when(issue.statusChangedAt)}</dd></>}
      </Meta>
      <div>
        <strong style={{ fontSize: 13 }}>{t('issues.detail.timeline')}</strong>
        <span style={{ fontSize: 12, marginLeft: 8, color: '#8d8d8f' }}>{t('issues.detail.timeline_hint', { n: 200 })}</span>
      </div>
      <Timeline data-testid="issue-timeline">
        {issue.events.map((e, i) => (
          <Event key={`${e.at}-${i}`}>
            <time dateTime={new Date(e.at).toISOString()} title={when(e.at)}>{when(e.at)}</time>
            <div>
              <pre>{e.message || '—'}</pre>
              {typeof e.meta.deploymentId === 'string' && issue.projectId && <StyledLink to={`/projects/${encodeURIComponent(issue.projectId)}?${issue.kind === 'run_failed' ? 'tab=runs&' : ''}open=${encodeURIComponent(e.meta.deploymentId)}`} style={{ fontSize: 12 }}><Mono>{e.meta.deploymentId}</Mono></StyledLink>}
            </div>
          </Event>
        ))}
      </Timeline>
    </Detail>
  );
}

export function IssueList({ issues, canWrite, emptyKey, showProject }: { issues: Issue[]; canWrite: boolean; emptyKey: string; showProject?: (projectId: string) => string | null }) {
  const { t } = useT();
  const [open, setOpen] = useState<string | null>(null);
  if (issues.length === 0) return <Empty data-testid="issues-empty">{t(emptyKey)}</Empty>;
  return (
    <div data-testid="issue-list">
      <Table>
        <HeadRow><span>{t('issues.col.issue')}</span><span>{t('issues.col.seen')}</span><span style={{ textAlign: 'right' }}>{t('issues.col.events')}</span><span>{t('issues.col.trend')}</span></HeadRow>
        {issues.map((issue) => {
          const tone = toneOf(issue);
          const project = issue.projectId && showProject ? showProject(issue.projectId) : null;
          return (
            <div key={issue.id}>
              <Row $open={open === issue.id} role="button" tabIndex={0} aria-expanded={open === issue.id} data-testid={`issue-${issue.id}`}
                onClick={() => setOpen(open === issue.id ? null : issue.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === issue.id ? null : issue.id); } }}>
                <Main>
                  <TitleLine><Kind $tone={tone}>{t(issueKindKey(issue.kind))}</Kind><IssueTitle title={issue.title}>{issue.title}</IssueTitle></TitleLine>
                  <Culprit title={issue.culprit}>{project ? `${project} · ` : ''}{issue.culprit || issue.fingerprint}</Culprit>
                  {open !== issue.id && <StatusButtons issue={issue} canWrite={canWrite} />}
                </Main>
                <Seen><span title={when(issue.lastSeen)}>{t('issues.last_seen', { when: relativeTime(issue.lastSeen) })}</span><span title={when(issue.firstSeen)}>{t('issues.first_seen', { when: relativeTime(issue.firstSeen) })}</span></Seen>
                <Count title={t('issues.count', { n: issue.count })}>{issue.count.toLocaleString()}</Count>
                <Sparkline hourly={issue.hourly} tone={tone} />
              </Row>
              {open === issue.id && <IssueDetail id={issue.id} canWrite={canWrite} onClose={() => setOpen(null)} />}
            </div>
          );
        })}
      </Table>
    </div>
  );
}
