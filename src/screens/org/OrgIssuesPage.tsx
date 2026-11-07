/**
 * `/org/:id/issues` — the organization's issues (ainize-node project-issues.ts), laid out the way Sentry lays out
 * errors: status tabs with counts, one row per cause with where, when, how often and the last day's trend, Resolve /
 * Ignore on the row, the timeline under it. Members read; `write` changes a status. Polls every 15 seconds — this is
 * the page an operator leaves open.
 */
import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useOrgIssuesQuery, useOrgProjectsQuery, useOrgQuery } from '@/api/api';
import { isIssueStatus, issueProblemOf, parseIssueList, type IssueStatus } from '@/api/issues';
import { orgApiErrorOf, parseOrgProfile, roleAtLeast } from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { IssueList } from '@/components/issues/IssueList';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, PageWrapper, StyledLink, Tabs, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const Crumb = styled.div`font-size: 13px; margin-bottom: 6px;`;
const Body = styled.div`margin-top: 12px;`;

type Filter = IssueStatus | 'all';
const FILTERS: Filter[] = ['unresolved', 'resolved', 'ignored', 'all'];

export default function OrgIssuesPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useT();
  const auth = useAuth();
  const [sp, setSp] = useSearchParams();
  const asked = sp.get('status');
  const [filter, setFilterState] = useState<Filter>(asked === 'all' || isIssueStatus(asked) ? asked : 'unresolved');
  const setFilter = (f: Filter) => { setFilterState(f); setSp((prev) => { const n = new URLSearchParams(prev); if (f === 'unresolved') n.delete('status'); else n.set('status', f); return n; }, { replace: true }); };

  const orgQ = useOrgQuery(id, { skip: !auth.isSignedIn });
  const org = useMemo(() => parseOrgProfile(orgQ.data), [orgQ.data]);
  const issuesQ = useOrgIssuesQuery({ id, status: filter }, { skip: !auth.isSignedIn, pollingInterval: 15_000 });
  const projectsQ = useOrgProjectsQuery(id, { skip: !auth.isSignedIn });
  const { issues, counts } = useMemo(() => parseIssueList(issuesQ.data), [issuesQ.data]);
  const projectName = useMemo(() => { const m = new Map<string, string>(); for (const p of projectsQ.data?.projects ?? []) m.set(p.id, p.name); return (pid: string) => m.get(pid) ?? null; }, [projectsQ.data]);
  useTitle(`${t('issues.title')} · ${org?.name ?? id}`);

  if (auth.loading || (auth.isSignedIn && (orgQ.isLoading || (issuesQ.isLoading && !issuesQ.data)))) return <PageWrapper><CenterProgress /></PageWrapper>;
  const orgErr = orgQ.error ? orgApiErrorOf(orgQ.error) : null;
  const issuesErr = issuesQ.error as { status?: number; data?: { error?: { code?: string } } } | undefined;
  const problem = !auth.isSignedIn ? 'issues.problem.signin' : orgErr ? issueProblemOf(orgErr.status ?? undefined, orgErr.code) : issuesErr ? issueProblemOf(typeof issuesErr.status === 'number' ? issuesErr.status : undefined, issuesErr.data?.error?.code) : null;
  const canWrite = roleAtLeast(org?.my_role, 'write');

  return (
    <PageWrapper $wide>
      <Crumb><StyledLink to={`/org/${encodeURIComponent(id)}`} data-testid="issues-back">{t('issues.back_to_org')} {org?.name ?? id}</StyledLink></Crumb>
      <TitleRow><Title style={{ margin: 0 }}>{t('issues.title')}</Title></TitleRow>
      <Description style={{ marginTop: 4 }}>{t('issues.subtitle')}</Description>
      {problem && (
        <Alert $tone={problem === 'issues.problem.unavailable' ? 'info' : 'error'} data-testid="issues-problem">
          {t(problem)} {problem === 'issues.problem.failed' && <Button size="small" variant="text" onClick={() => void issuesQ.refetch()}>{t('issues.retry')}</Button>}
        </Alert>
      )}
      {!problem && (
        <>
          <Tabs value={filter} onChange={(v) => setFilter(v as Filter)} tabs={FILTERS.map((f) => ({ id: f, label: f === 'all' ? t('issues.tab.all') : `${t(`issues.tab.${f}`)} · ${counts[f]}` }))} />
          <Body>
            <IssueList issues={issues} canWrite={canWrite} emptyKey={`issues.empty.${filter}`} showProject={projectName} />
          </Body>
        </>
      )}
    </PageWrapper>
  );
}
