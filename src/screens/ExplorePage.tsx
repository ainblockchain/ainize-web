import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import styled from 'styled-components';
import { useAgentsQuery, useBranchesQuery, useCatalogQuery, useInfoQuery, useMyOrgsQuery, useOrgQuery, useSharedAgentsQuery, errorMessage } from '@/api/api';
import { agentSummaryFromOrgAgent, orgApiErrorOf, parseOrgList, parseOrgProfile } from '@/api/organizations';
import {
  agentListKey, agentSummaryFromRef, fallbackRows, parseSharedAgentsResponse, scopeForFilter, sharedAgentsUnsupported,
  type AgentListFilter,
} from '@/api/sharedAgents';
import { viewerPrincipals } from '@/api/linkedAgents';
import { useAuth } from '@/auth/AuthContext';
import { AgentListItem } from '@/components/public/AgentListItem';
import { PatchListItem, PriceUnitNote, TermsLegend } from '@/components/public/PatchListItem';
import { Shelves } from '@/components/public/Shelves';
import { Alert } from '@/components/ui/Form';
import { Description, Empty, PageWrapper, Pagination, SelectBox, Shimmer, StyledLink, SectionTitle, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { docsFromAgents, matchingSearchIds } from '@/lib/globalSearch';
import { exploreSelectionHref, readExploreSelection, EXPLORE_SORTS as SORTS, type ExploreSort as Sort, type ExploreKind as Kind } from '@/lib/exploreSelection';
import { signInHref } from '@/lib/uiNavigation';
import { num } from '@/utils/format';

// `built_on` and `trending` are the two orderings §10 of the lineage design defines: most built on (children on the
// ledger plus this node's derive intents) and doing well this week (3·sales + 2·builds-on + loads + ½·tests·hit-rate).
/**
 * A node sells two kinds of thing, and until now the browse page knew about one of them. Knowledge is memory a
 * model loads; an agent is a process that does the work. They are two lists rather than one merged one because
 * nothing knowledge is ordered or filtered by — model, topic, rows, price, verification — applies to an agent,
 * and a merged list would have to drop all of it to find a common shape.
 *
 * The axis lives in the URL (`?kind=agent`) so the two halves of the marketplace are linkable: the agents view is
 * a place a card, a docs page or a workspace invite can point at.
 */
// `fresh` is item 267's ordering: by the day the DATA is true of, not the day the file was registered.
/** Item 188: the subject chips are capped, and every taught lesson's own subject is one chip behind this prefix. */
const SCHEMA_CHIPS = 8;
const TAUGHT = 'taught/';
const ITEM_LIMIT = 10;
/**
 * "Current only" — everything a visitor could sensibly load today. SUPERSEDED and REJECTED are the two states that
 * are not, and on the demo node three of the four listings are superseded, so the default view was 75% dead rows.
 * Sent as the catalog's own `status` query param, so the filtering happens where the catalogue lives.
 */
const CURRENT_STATUS = 'VERIFIED,ANNOUNCED,VERIFYING,CHALLENGED';

const Filters = styled.div`
  display: flex; flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap; padding-bottom: 16px;
  &:empty { display: none; }
`;
const FilterGroup = styled.div`
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  span.label { font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-right: 2px; cursor: default; }
`;
const Chip = styled.button<{ $active: boolean }>`
  padding: 3px 12px; border-radius: 14px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap;
  border: 1px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$active ? p.theme.color.PALE_GREY : '#fff')};
  color: ${(p) => (p.$active ? p.theme.color.HOVER : p.theme.color.GREY)};
  transition: border-color 0.2s ease, background 0.2s ease;
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
`;
/** Finding 81: the first result was the 19th focusable element, behind every filter chip and every sort option. */
const Skip = styled.a`
  position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden;
  &:focus {
    position: static; width: auto; height: auto; display: inline-block; margin-bottom: 12px;
    padding: 8px 14px; border-radius: 4px; background: ${(p) => p.theme.color.PALE_GREY};
    color: ${(p) => p.theme.color.HOVER}; font-size: 13px; font-weight: 600; text-decoration: none;
  }
`;
const ResultsHead = styled.h2`
  margin: 0 0 6px; font-size: 15px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
`;
const Count = styled.div`
  font-size: 12px; color: ${(p) => p.theme.color.GREY}; padding-bottom: 12px;
`;
const Hidden = styled.div`
  margin-top: -6px; padding-bottom: 12px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
  button { padding: 0; border: 0; background: none; font: inherit; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; text-decoration: underline; }
`;
const Intro = styled(Description)`margin: 0 0 24px;`;
/** The doors to make more agents, beside the list they land in. Signed-in only: each one asks for an owner. */
const MakeRow = styled.div`display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px;`;
/** The list's name on the left, what you can do with it on the right; wraps under on a phone. */
const ResultBar = styled.div`display: flex; align-items: baseline; justify-content: space-between; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 12px;`;
const Divider = styled.span`width: 1px; height: 16px; background: ${(p) => p.theme.color.LIGHT_GREY}; margin: 0 6px;`;
const ScopeNote = styled.div`margin: -6px 0 12px; font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
/**
 * Finding 76 — a failing catalogue printed the raw exception ("Something went wrong: TypeError: Failed to fetch")
 * and offered nothing to do about it. The sentence says what actually happened on this network — a peer node is
 * unreachable — the technical text stays available for whoever wants it, and Try again re-runs the query.
 */
const Failure = styled(Alert)`
  display: flex; flex-direction: column; align-items: flex-start; gap: 10px;
  details { font-size: 12px; }
  summary { cursor: pointer; color: ${(p) => p.theme.color.GREY}; }
  code { display: block; margin-top: 6px; font-size: 12px; word-break: break-all; color: ${(p) => p.theme.color.DARK_GREY}; }
`;
const Retry = styled.button`
  padding: 7px 16px; border-radius: 4px; border: 1px solid ${(p) => p.theme.color.PRIMARY};
  background: #fff; font-size: 13px; font-weight: 600; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;
/** Finding 76: a list-shaped skeleton, so the page keeps its shape instead of collapsing to a lone spinner. */
const SkeletonRow = styled.div`
  padding: 16px 32px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff;
  display: flex; gap: 16px; align-items: flex-start;
  &:not(:last-child) { margin-bottom: 16px; }
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px; }
`;
const SkeletonCol = styled.div`flex: 1; display: flex; flex-direction: column; gap: 8px;`;

function ListSkeleton() {
  return (
    <div data-testid="explore-skeleton" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <SkeletonRow key={i}>
          <Shimmer $w="56px" $h="56px" />
          <SkeletonCol>
            <Shimmer $w="42%" $h="18px" />
            <Shimmer $w="28%" $h="12px" />
            <Shimmer $w="66%" $h="12px" />
            <Shimmer $w="80%" $h="12px" />
          </SkeletonCol>
        </SkeletonRow>
      ))}
    </div>
  );
}

export default function ExplorePage({ fixedKind }: { fixedKind?: Kind }) {
  const { t, tech, help, term } = useT();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const selection = readExploreSelection(params, fixedKind);
  const { kind, sort, model, schema, branch, q, showAll, page, invalid } = selection;
  const auth = useAuth();
  const agentFilter = selection.scope;
  const privateScope = kind === 'agent' && agentFilter !== 'all';
  const signInRequired = privateScope && !auth.isSignedIn;
  const blocked = invalid || signInRequired || privateScope && auth.loading;
  useTitle(kind === 'agent' ? t('explore.title_agent') : t('explore.title'));
  const change = (values: Parameters<typeof exploreSelectionHref>[1], resetPage = true) => navigate(exploreSelectionHref(location, values, resetPage));
  const setSort = (value: Sort) => change({ sort: value === 'popular' ? null : value });
  const setModel = (value: string) => change({ model: value });
  const setSchema = (value: string) => change({ schema: value });
  const setBranch = (value: string) => change({ branch: value });
  const setShowAll = (value: boolean) => change({ versions: value ? 'all' : null });
  const setPage = (value: number) => change({ page: value === 1 ? null : String(value) }, false);
  const setAgentFilter = (scope: AgentListFilter) => change({ kind: 'agent', agents: scope === 'all' ? null : scope, ...(scope !== 'org' ? { org: null } : {}) });
  const { data: info } = useInfoQuery();
  const { data: tracks } = useBranchesQuery();
  // "is it answering" goes stale as it is rendered, so the list re-checks; the node caches the probe for 30 s.
  const { data: agentData, isLoading: agentsLoading, error: agentError } = useAgentsQuery(undefined, { skip: blocked || kind !== 'agent', pollingInterval: 60_000 });
  const allAgents = useMemo(() => agentData?.agents ?? [], [agentData]);
  // "Mine" asks the shared-agent registry. "My organization" asks the organization API — the one `/org` and
  // `/org/:id` read — so the organizations, their agents and their counts here are the same ones those pages show,
  // for every kind of sign-in (the registry's org scope answers only an AIN SSO session, for one organization).
  // Fetched whenever a signed-in person is on the agents tab, not only when the chip is picked: every chip carries its count.
  const scopesOn = kind === 'agent' && auth.isSignedIn && !auth.loading && !invalid;
  const shared = useSharedAgentsQuery({ identity: auth.cacheIdentity, scope: scopeForFilter('mine'), limit: 200 }, { skip: !scopesOn, pollingInterval: 60_000 });
  const sharedPage = useMemo(() => parseSharedAgentsResponse(shared.currentData), [shared.currentData]);
  const registryMissing = !!shared.error && sharedAgentsUnsupported(shared.error);
  const orgView = kind === 'agent' && agentFilter === 'org';
  const myOrgs = useMyOrgsQuery(auth.cacheIdentity, { skip: !scopesOn });
  const orgsLoading = !myOrgs.currentData && (myOrgs.isLoading || myOrgs.isFetching);
  const orgList = useMemo(() => parseOrgList(myOrgs.currentData), [myOrgs.currentData]);
  const orgsMissing = !!myOrgs.error && orgApiErrorOf(myOrgs.error).status === 404;
  const orgParam = selection.org;
  // An explicit organization URL must never silently select a different membership.
  const orgId = orgParam ?? (orgList.orgs.length === 1 ? orgList.orgs[0].id : null);
  const orgQuery = useOrgQuery({ id: orgId ?? '', identity: auth.cacheIdentity }, { skip: blocked || !orgView || !orgId, pollingInterval: 60_000 });
  const orgProfile = useMemo(() => parseOrgProfile(orgQuery.currentData), [orgQuery.currentData]);
  const setOrg = (id: string) => change({ kind: 'agent', agents: 'org', org: id });
  const principals = useMemo(() => viewerPrincipals(auth.subject, auth.sso?.principal, auth.sitePrincipal), [auth.subject, auth.sso?.principal, auth.sitePrincipal]);
  /** The rows for the chip in force: the registry's or the organization's when they answered, the public list (filtered where it can be) otherwise. */
  const scopedAgents = useMemo(() => {
    if (agentFilter === 'all') return allAgents;
    if (agentFilter === 'org') {
      if (orgsMissing) return [];
      return orgProfile?.agents.map(agentSummaryFromOrgAgent) ?? [];
    }
    if (sharedPage) return sharedPage.items.map((it) => agentSummaryFromRef(it.ref, info?.node?.endpoint ?? null));
    if (registryMissing) return fallbackRows(agentFilter, allAgents, principals);
    return [];
  }, [agentFilter, allAgents, sharedPage, registryMissing, orgsMissing, orgProfile, principals, info?.node?.endpoint]);
  const filters = { sort, model: model || undefined, schema: schema || undefined, branch: branch || undefined, q: q || undefined };
  const { currentData: data, isLoading, isFetching, error, refetch } = useCatalogQuery({ ...filters, status: showAll ? undefined : CURRENT_STATUS, limit: ITEM_LIMIT, offset: (page - 1) * ITEM_LIMIT }, { skip: blocked || kind !== 'knowledge' });
  // How many rows "Current only" is holding back, for exactly the model/topic/search in force — one cheap
  // page-of-one call for its `total`, never a node-wide count that would not match what is on screen.
  const { currentData: unfiltered } = useCatalogQuery({ ...filters, limit: 1 }, { skip: blocked || showAll || kind !== 'knowledge' });
  const hidden = showAll || !data || !unfiltered ? 0 : Math.max(0, unfiltered.total - data.total);

  /**
   * Finding 76 — the Model and Topic chips came straight off `data`, so a failed request took the filters off the
   * page along with the results and the reader lost even the ability to try a different one. The last facets this
   * node answered with are kept and rendered through the failure.
   */
  const facets = useRef<{ models: string[]; schemas: string[] }>({ models: [], schemas: [] });
  useEffect(() => { if (data) facets.current = { models: data.models, schemas: data.schemas }; }, [data]);
  const models = [...new Set([...(data?.models ?? facets.current.models), ...(model ? [model] : [])])];
  const knownSchemas = data?.schemas ?? facets.current.schemas;
  const schemas = [...new Set([...knownSchemas, ...(schema ? [schema] : [])])];
  /**
   * Item 188 — `createLessonDraft` gives every lesson its own benchmark schema (`taught/<name>-<hex>`, by design F15
   * so a lesson never supersedes its base), and this filter row printed one chip per schema with no cap: 136 of them
   * on node-u. Taught lessons collapse into one chip, the rest are capped, and the cap is a click away.
   */
  const [allSchemas, setAllSchemas] = useState(false);
  const taughtCount = knownSchemas.filter((x) => x.startsWith(TAUGHT)).length;
  const plainSchemas = schemas.filter((x) => !x.startsWith(TAUGHT));
  const shownSchemas = allSchemas ? plainSchemas : [...new Set([...plainSchemas.slice(0, SCHEMA_CHIPS), ...(schema && !schema.startsWith(TAUGHT) ? [schema] : [])])];
  const restSchemas = plainSchemas.length - shownSchemas.length;

  const sortOptions = useMemo(() => SORTS.map((s) => ({ value: s, label: t(`explore.sort.${s}`) })), [t]);
  const items = data?.items ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / ITEM_LIMIT));
  const current = page;
  const visible = items;
  /** A parent id is only an id until something on this page knows its name (findings 282, 200). */
  const nameOf = useMemo(() => {
    const m = new Map(items.map((e) => [e.anchor.id, e.anchor.name || e.anchor.id]));
    return (id: string) => m.get(id);
  }, [items]);
  /**
   * Finding 70 — the hero counts `listed` and said "1 verified knowledge"; this line counted every row the default
   * filter returned and said "4 knowledge", with all four badged Verified. The default view no longer contains
   * superseded rows, and the count says how many of what it IS showing carry the same word the hero uses, so the
   * two pages can be read against each other. Counted from the rows on screen, never from a node-wide total.
   */
  const verified = items.filter((e) => e.quorum_ok && e.sellable !== false).length;
  /**
   * The same search box serves both halves. The catalogue searches server-side because it is paged and can be
   * large; the agent list is a handful of rows a node declares in its own config, so it is filtered here — over
   * everything a reader can see on the row, which includes the skills the agent's card names.
   */
  const agents = useMemo(() => {
    const matches = matchingSearchIds(docsFromAgents(scopedAgents), q);
    return scopedAgents.filter((a) => matches.has(agentListKey(a)));
  }, [scopedAgents, q]);
  const scopedLoading = agentFilter === 'mine' ? !shared.currentData && shared.isFetching : agentFilter === 'org' ? orgsLoading || (!orgQuery.currentData && orgQuery.isFetching) : false;
  const scopedError = agentFilter === 'mine' ? (shared.error && !registryMissing ? shared.error : null)
    : agentFilter === 'org' ? (myOrgs.error && !orgsMissing ? myOrgs.error : orgQuery.error ?? null) : null;
  // "Mine" and "My organization" wait only on their own answer; the public list is theirs only when it stands in for one.
  const fromPublic = agentFilter === 'all' || (agentFilter === 'mine' && registryMissing);
  const listLoading = fromPublic ? agentsLoading : scopedLoading;
  const listError = fromPublic && !!agentError;
  const mineCount = sharedPage ? sharedPage.items.length : registryMissing ? fallbackRows('mine', allAgents, principals).length : null;
  const mineMore = !!sharedPage?.nextCursor;
  const noOrg = orgView && !orgsLoading && !!myOrgs.currentData && !myOrgs.error && orgList.orgs.length === 0;
  const countExact = !!data && items.length === data.total;

  const chooseOrg = orgView && !orgId && !orgsMissing && !orgsLoading && !myOrgs.error && orgList.orgs.length > 1;
  const branches = [...(tracks?.branches ?? []), ...(branch && !tracks?.branches.some(b => b.name === branch) ? [{ name: branch, description: '' }] : [])];
  if (invalid) return <PageWrapper><Alert role="alert" $tone="error" data-testid="explore-selection-invalid">{t('explore.selection.invalid')} <StyledLink to={kind === 'knowledge' ? '/train/knowledge' : '/explore?kind=agent'}>{t('explore.selection.reset')}</StyledLink></Alert></PageWrapper>;
  if (privateScope && auth.loading) return <PageWrapper><ListSkeleton /></PageWrapper>;
  if (signInRequired) return <PageWrapper><Empty data-testid="explore-signin-required">{t('explore.selection.signin')} <StyledLink to={signInHref(location)}>{t('nav.signin')}</StyledLink></Empty></PageWrapper>;

  return (
    <PageWrapper>
      <SectionTitle>{kind === 'agent' ? t('nav.agents') : t('train.knowledge')}</SectionTitle>
      {kind === 'knowledge' && <TitleRow><SelectBox options={sortOptions} value={sort} onChange={(v) => { setSort(v as Sort); }} label={t('common.sort_aria')} /></TitleRow>}
      {q && <Intro>{t('search.query', { q })}</Intro>}
      <Skip href="#explore-results">{t('explore.skip')}</Skip>

      {/* SC-17: what is selling, what is being built ON, what is new, and what people asked for here. */}
      {kind === 'knowledge' && !q.trim() && <Shelves />}

      <Filters>
        {/* Whose agents, in one row and one click: the public list, mine, then each organization by name — the names
            and counts `/org` shows. "Public", not "All": an organization's agents are not in that list. */}
        {kind === 'agent' && auth.isSignedIn && (
          <FilterGroup data-testid="agents-scope">
            <Chip $active={agentFilter === 'all'} onClick={() => { setAgentFilter('all'); }} data-testid="agents-filter-all">
              {t('explore.agents.filter.all')}{` · ${num(allAgents.length)}`}
            </Chip>
            <Chip $active={agentFilter === 'mine'} onClick={() => { setAgentFilter('mine'); }} data-testid="agents-filter-mine">
              {t('explore.agents.filter.mine')}{mineCount !== null ? ` · ${num(mineCount)}${mineMore ? '+' : ''}` : ''}
            </Chip>
            {orgsMissing ? (
              <Chip $active={agentFilter === 'org'} onClick={() => { setAgentFilter('org'); }} data-testid="agents-filter-org">{t('explore.agents.filter.org')}</Chip>
            ) : orgList.orgs.length > 0 && (
              <>
                <Divider aria-hidden="true" />
                <span className="label">{t('explore.agents.org_label')}</span>
                {orgList.orgs.map((o) => (
                  <Chip key={o.id} $active={agentFilter === 'org' && o.id === orgId} onClick={() => { setOrg(o.id); }} data-testid={`agents-org-${o.id}`}>
                    {o.name} · {num(o.agent_count)}
                  </Chip>
                ))}
              </>
            )}
          </FilterGroup>
        )}
        {kind === 'knowledge' && !!models.length && (
          <FilterGroup>
            <span className="label">{t('explore.filter.model')}</span>
            <Chip $active={!model} onClick={() => { setModel(''); }}>{t('explore.filter.all')}</Chip>
            {models.map((m) => <Chip key={m} $active={model === m} onClick={() => { setModel(model === m ? '' : m); }}>{m}</Chip>)}
          </FilterGroup>
        )}
        {kind === 'knowledge' && !!schemas.length && (
          <FilterGroup>
            <span className="label" title={`${t('explore.filter.schema_help')} (${tech('facts')})`}>{t('explore.filter.schema')}</span>
            <Chip $active={!schema} onClick={() => { setSchema(''); }}>{t('explore.filter.all')}</Chip>
            {shownSchemas.map((s) => <Chip key={s} $active={schema === s} onClick={() => { setSchema(schema === s ? '' : s); }}>{s}</Chip>)}
            {/* Item 188 — every taught lesson gets its own `taught/<slug>-<hex>` subject by design, so this row was
                136 chips on a teaching node and the first card sat 4,297 px down a 360 px screen. The subjects with
                the most knowledge come first, the rest are behind "more", and every lesson's subject is one chip. */}
            {(taughtCount > 0 || schema === `${TAUGHT}*`) && (
              <Chip $active={schema === `${TAUGHT}*`} onClick={() => { setSchema(schema === `${TAUGHT}*` ? '' : `${TAUGHT}*`); }} data-testid="schema-taught">
                {t('explore.filter.schema_taught', { n: num(taughtCount) })}
              </Chip>
            )}
            {schema.startsWith(TAUGHT) && schema !== `${TAUGHT}*` && <Chip $active onClick={() => setSchema('')}>{schema}</Chip>}
            {restSchemas > 0 && !allSchemas && (
              <Chip $active={false} onClick={() => setAllSchemas(true)} data-testid="schema-more">{t('explore.filter.schema_more', { n: num(restSchemas) })}</Chip>
            )}
          </FilterGroup>
        )}
        {/* Item 206: a track is how a returning consumer thinks about a catalogue ("today's KRX bake"), and it was
            the one axis of the API the browse page never offered. Only rendered when this node knows any. */}
        {kind === 'knowledge' && !!branches.length && (
          <FilterGroup>
            <span className="label" title={`${help('branch')} (${tech('branch')})`}>{t('explore.filter.track')}</span>
            <Chip $active={!branch} onClick={() => { setBranch(''); }}>{t('explore.filter.all')}</Chip>
            {branches.map((b) => <Chip key={b.name} $active={branch === b.name} title={b.description} onClick={() => { setBranch(branch === b.name ? '' : b.name); }}>{b.name}</Chip>)}
          </FilterGroup>
        )}
        {kind === 'knowledge' && (
          <FilterGroup>
            <span className="label" title={t('explore.filter.show_help')}>{t('explore.filter.show')}</span>
            <Chip $active={!showAll} onClick={() => { setShowAll(false); }}>{t('explore.filter.current')}</Chip>
            <Chip $active={showAll} onClick={() => { setShowAll(true); }}>{t('explore.filter.all_versions')}</Chip>
          </FilterGroup>
        )}
      </Filters>

      {kind === 'knowledge' && <ResultsHead id="explore-results" tabIndex={-1}>{t('explore.results')}</ResultsHead>}

      {kind === 'agent' && (
        <section id="explore-results" tabIndex={-1} aria-label={t('nav.agents')}>
          {auth.isSignedIn && (!orgView || !!orgId) && <ResultBar>
            {/* The doors to make more, beside the list they land in. Each asks for an owner, so signed-in only. */}
              <MakeRow data-testid="agents-make">
                {orgView && orgProfile && <StyledLink to={`/org/${encodeURIComponent(orgProfile.id)}`} data-testid="agents-org-page">{t('explore.agents.org_manage')} →</StyledLink>}
                <StyledLink to={orgView && orgId ? `/agent/new?org=${encodeURIComponent(orgId)}` : '/agent/new'}>{t('explore.agents.make.create')} →</StyledLink>
                <StyledLink to={orgView && orgId ? `/agent/link?org=${encodeURIComponent(orgId)}` : '/agent/link'}>{t('explore.agents.make.link')} →</StyledLink>
              </MakeRow>
          </ResultBar>}
          {orgView && orgsMissing && <ScopeNote data-testid="agents-org-unsupported">{t('explore.agents.org_unsupported')}</ScopeNote>}
          {listError && <Failure $tone="error" data-testid="agents-error">
            <span>{t('explore.agents.unreachable')}</span>
            <details><summary>{t('explore.error_detail')}</summary><code>{errorMessage(agentError)}</code></details>
          </Failure>}
          {scopedError && <Failure $tone="error" data-testid="agents-scope-error">
            <span>{t('explore.agents.unreachable')}</span>
            <Retry type="button" onClick={() => {
              if (agentFilter === 'mine') void shared.refetch();
              else { void myOrgs.refetch(); if (orgId) void orgQuery.refetch(); }
            }}>{t('orgs.retry')}</Retry>
            <details><summary>{t('explore.error_detail')}</summary><code>{errorMessage(scopedError)}</code></details>
          </Failure>}
          {chooseOrg && <Empty data-testid="agents-choose-org">{t('explore.selection.org')}</Empty>}
          {listLoading && <ListSkeleton />}
          {!chooseOrg && !(orgView && orgsMissing) && !listLoading && !listError && !scopedError && (
            <>
              {/* Keyed by node and id: two nodes may each run a `donga-desk`, and one key for both re-used one row's state for the other. */}
              <div>{agents.map((a) => <AgentListItem key={agentListKey(a)} agent={a} />)}</div>
              {agents.length === 0 && (
                <Empty data-testid={noOrg ? 'agents-org-none' : undefined}>
                  {q.trim() ? t('explore.agents.empty_search')
                    : noOrg ? <>{t('explore.agents.org_none')} <StyledLink to="/org">{t('orgs.title')} →</StyledLink></>
                    : agentFilter === 'mine' ? t('explore.agents.empty_mine')
                      : agentFilter === 'org' ? t('explore.agents.empty_org')
                        : t('explore.agents.empty')}
                </Empty>
              )}
            </>
          )}
        </section>
      )}

      {kind === 'knowledge' && error && (
        <Failure $tone="error" data-testid="explore-error">
          <span>{t('explore.unreachable')}</span>
          <Retry type="button" onClick={() => { void refetch(); }} data-testid="explore-retry">{t('explore.retry')}</Retry>
          <details>
            <summary>{t('explore.error_detail')}</summary>
            <code>{errorMessage(error)}</code>
          </details>
        </Failure>
      )}
      {kind === 'knowledge' && (isLoading || (isFetching && !data)) && <ListSkeleton />}
      {kind === 'knowledge' && !isLoading && data && (
        <>
          <Count data-testid="explore-count">
            {t('explore.count', { n: num(data.total) }, data.total)}
            {countExact && data.total > 0 && ` · ${verified === data.total ? t('explore.count_all_verified', { term: term('verified') }, data.total) : t('explore.count_verified', { n: num(verified), term: term('verified') }, verified)}`}
            {isFetching ? ` · ${t('explore.updating')}` : ''}
          </Count>
          {hidden > 0 && (
            <Hidden data-testid="explore-hidden" title={t('explore.filter.show_help')}>
              {t('explore.hidden', { n: num(hidden) }, hidden)}{' · '}
              <button type="button" onClick={() => { setShowAll(true); }}>{t('explore.hidden_show')}</button>
            </Hidden>
          )}
          {items.length > 0 && <TermsLegend title={help('liveTest')} />}
          {/* Finding 18: the price rides in each card's facts row on a phone, so its unit is explained once here
              instead of four times down the list. Desktop cards carry the note under their own price. */}
          <PriceUnitNote entries={visible} currency={info?.currency} data-testid="explore-price-note" />
          <div>
            {visible.map((e) => <PatchListItem key={e.anchor.id} entry={e} currency={info?.currency} nameOf={nameOf} />)}
          </div>
          {items.length === 0 && <Empty>{t(page > pageCount ? 'explore.selection.page_missing' : 'explore.empty')}{page > pageCount && <Retry onClick={() => setPage(1)}>{t('explore.selection.first_page')}</Retry>}</Empty>}
          {data.total > ITEM_LIMIT && <Pagination page={current} pageCount={pageCount} onChange={setPage} />}
        </>
      )}
    </PageWrapper>
  );
}
