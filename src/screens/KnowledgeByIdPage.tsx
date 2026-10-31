import { Navigate, useLocation, useParams } from 'react-router';
import { usePatchQuery } from '@/api/api';
import { CenterProgress, PageWrapper } from '@/components/ui/Misc';
import { Offline } from '@/components/ui/Offline';
import { useT } from '@/i18n';
import { resolvedKnowledgePath } from '@/lib/detailRoutes';
import NotFoundPage from './NotFoundPage';

/** Lookup stays inside the already reserved /patch namespace, without claiming an organization slug. */
export default function KnowledgeByIdPage() {
  const { patchId = '' } = useParams();
  const { search, hash } = useLocation();
  const { t } = useT();
  const query = usePatchQuery(patchId);
  const destination = resolvedKnowledgePath(query.currentData, patchId);
  if (!query.currentData && query.isFetching) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (query.error && 'status' in query.error && query.error.status === 404) return <NotFoundPage message={t('knowledge.not_found')} />;
  if (query.isError || !destination) return <PageWrapper><Offline error={query.error} what={t('offline.what.knowledge')} retrying={query.isFetching} onRetry={() => { void query.refetch(); }} /></PageWrapper>;
  return <Navigate to={`${destination}${search}${hash}`} replace />;
}
