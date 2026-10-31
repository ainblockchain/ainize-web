import { useMemo } from 'react';
import { useAccessibleAppsQuery, useAgentsQuery, useCatalogQuery, useModelsQuery, useNetworkModelsQuery } from '@/api/api';
import { networkModelCatalogue, readNetworkModelsResponse } from '@/api/networkModels';
import { modelsFetchState, readModelsResponse } from '@/api/models';
import { useAuth } from '@/auth/AuthContext';
import { docsFromAgents, docsFromCatalog, docsFromModels, docsFromProjects, searchDocs, type SearchKind } from './globalSearch';

/** The dropdown and results page use the same sources, scope and ranking. */
export function useSearchResults(query: string, enabled: boolean, perKind = 4) {
  const auth = useAuth();
  const active = enabled && !!query.trim();
  const models = useModelsQuery(undefined, { skip: !active });
  const network = useNetworkModelsQuery(undefined, { skip: !active });
  const agents = useAgentsQuery(undefined, { skip: !active });
  const apps = useAccessibleAppsQuery({ principal: auth.cacheIdentity, orgs: auth.sso?.orgs.map((o) => o.slug) ?? [] }, { skip: !active || !auth.isSignedIn });
  const catalog = useCatalogQuery({ q: query.trim(), status: 'VERIFIED,ANNOUNCED,VERIFYING,CHALLENGED', limit: perKind }, { skip: !active });
  const ownRead = useMemo(() => models.isError ? null : readModelsResponse(models.currentData), [models.currentData, models.isError]);
  const networkRead = useMemo(() => network.isError ? null : readNetworkModelsResponse(network.currentData, auth.address), [network.currentData, network.isError, auth.address]);
  const oldNetwork = modelsFetchState(network.error as Parameters<typeof modelsFetchState>[0]) === 'outdated';
  const modelFailure = !!(ownRead?.unsupported || networkRead?.unsupported) || (!models.isFetching && !ownRead) || (!network.isFetching && !networkRead && !oldNetwork);
  const groups = useMemo(() => {
    if (!active) return [];
    const result = searchDocs([
      ...docsFromProjects(auth.isSignedIn ? apps.currentData?.projects ?? [] : []),
      ...docsFromModels(networkModelCatalogue(ownRead?.models ?? [], networkRead?.models ?? [], auth.address)),
      ...docsFromAgents(agents.currentData?.agents ?? []),
    ], query, perKind);
    const knowledge = catalog.currentData;
    if (knowledge?.items.length) result.push({ kind: 'knowledge', hits: docsFromCatalog(knowledge.items).map((d) => ({ ...d, score: 0 })), total: knowledge.total });
    return result;
  }, [active, query, perKind, auth.isSignedIn, apps.currentData, ownRead, networkRead, auth.address, agents.currentData, catalog.currentData]);
  const failures: SearchKind[] = active ? [
    ...(auth.isSignedIn && (apps.isError || !!apps.currentData?.failedSources?.length) ? ['app' as const] : []),
    ...(modelFailure ? ['model' as const] : []),
    ...(agents.isError ? ['agent' as const] : []),
    ...(catalog.isError ? ['knowledge' as const] : []),
  ] : [];
  const loading = active && (models.isFetching || network.isFetching || agents.isFetching || catalog.isFetching || (auth.isSignedIn && apps.isFetching));
  const retry = () => {
    if (!active) return;
    void models.refetch(); void network.refetch(); void agents.refetch(); void catalog.refetch();
    if (auth.isSignedIn) void apps.refetch();
  };
  return { groups, failures, loading, retry };
}
