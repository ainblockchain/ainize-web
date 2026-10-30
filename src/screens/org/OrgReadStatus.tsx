import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress } from '@/components/ui/Misc';
import { useT } from '@/i18n';

/** A failed read must not appear as an empty organization or an endless spinner. */
export function OrgReadStatus({ query, valid }: {
  query: { currentData?: unknown; isFetching: boolean; isError: boolean; refetch: () => unknown };
  valid: boolean;
}) {
  const { t } = useT();
  if (query.isFetching && !query.currentData) return <div role="status" data-testid="org-read-loading"><CenterProgress /></div>;
  if (query.isError || !valid) return <Alert role="alert" $tone="error" data-testid="org-read-error">
    {t('org.read_failed')} <Button size="small" variant="text" disabled={query.isFetching} onClick={() => query.refetch()}>{t('orgs.retry')}</Button>
  </Alert>;
  return null;
}
