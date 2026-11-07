/**
 * The project console's Issues tab: this project's failed deployments and runs grouped by cause (src/api/issues.ts),
 * with the same rows and detail the organization page draws. Whoever may see the project sees them; whoever may
 * operate it may resolve or ignore.
 */
import { useMemo, useState } from 'react';
import { useProjectIssuesQuery } from '@/api/api';
import { issueProblemOf, parseIssueList, type IssueStatus } from '@/api/issues';
import { IssueList } from '@/components/issues/IssueList';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Tabs } from '@/components/ui/Misc';
import { useT } from '@/i18n';

type Filter = IssueStatus | 'all';
const FILTERS: Filter[] = ['unresolved', 'resolved', 'ignored', 'all'];

export function ProjectIssuesTab({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const { t } = useT();
  const [filter, setFilter] = useState<Filter>('unresolved');
  const q = useProjectIssuesQuery({ id: projectId, status: filter }, { pollingInterval: 15_000 });
  const { issues } = useMemo(() => parseIssueList(q.data), [q.data]);
  if (q.isLoading && !q.data) return <CenterProgress />;
  const err = q.error as { status?: number; data?: { error?: { code?: string } } } | undefined;
  if (err) return <Alert $tone={err.status === 404 ? 'info' : 'error'} data-testid="project-issues-problem">{t(issueProblemOf(typeof err.status === 'number' ? err.status : undefined, err.data?.error?.code))}</Alert>;
  return (
    <div data-testid="project-issues">
      <Tabs value={filter} onChange={(v) => setFilter(v as Filter)} tabs={FILTERS.map((f) => ({ id: f, label: t(`issues.tab.${f}`) }))} />
      <div style={{ marginTop: 12 }}>
        <IssueList issues={issues} canWrite={canWrite} emptyKey={`issues.empty.${filter}`} />
      </div>
    </div>
  );
}
