import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Routes, Route } from 'react-router';
import { ThemeProvider } from 'styled-components';
import { api } from '../src/api/api';
import { theme } from '../src/theme/theme';
import { LocaleProvider } from '../src/i18n';
import { AuthProvider } from '../src/auth/AuthContext';
import { createTeacherKey, forgetTeacherKey, currentTeacherKey } from '../src/lib/teacherKey';
import TeachDatasetPage from '../src/screens/TeachDatasetPage';
import TeachSettingsPage from '../src/screens/TeachSettingsPage';
import TeachMinePage from '../src/screens/TeachMinePage';
import SigningPage from '../src/screens/SigningPage';
import AuthorizePage from '../src/screens/AuthorizePage';
import AppsPage from '../src/screens/AppsPage';
import SearchPage from '../src/screens/SearchPage';
import ChatPage from '../src/screens/ChatPage';
import { BASKET_PREFIX, chatStorageOwner } from '../src/lib/teachStore';
import { loadComposerDraft, loadStack, loadTurns, saveComposerDraft, saveStack, saveTurns } from '../src/components/chat/util';
import MyAgentsPage from '../src/screens/MyAgentsPage';
import AinCodePage from '../src/screens/AinCodePage';
import AgentCreatePage from '../src/screens/AgentCreatePage';
import AgentLinkPage from '../src/screens/AgentLinkPage';
import { AinftBenefitsPanel } from '../src/screens/agent/AinftBenefitsPanel';
import { AinftRewardsPanel } from '../src/screens/agent/AinftRewardsPanel';
import { AinftCompanionPanel } from '../src/screens/agent/AinftCompanionPanel';
import { AinftBindingPanel } from '../src/screens/agent/AinftBindingPanel';
import { HostedAgentOwnerPanel } from '../src/screens/agent/HostedAgentOwnerPanel';
import { AgentPage } from '../src/screens/AgentPage';
import { AgentHistoryPanel } from '../src/screens/agent/AgentHistoryPanel';
import { AgentPreviewHistory } from '../src/screens/agent/AgentPreviewHistory';
import { A2UISurface } from '../src/components/a2ui/A2UISurface';
import { readSurface as readUiSurface } from '../src/components/a2ui/surface';
import OrgPage from '../src/screens/org/OrgPage';
import OrgsPage from '../src/screens/org/OrgsPage';
import OrgSettingsPage from '../src/screens/org/OrgSettingsPage';
import OrgJoinPage from '../src/screens/org/OrgJoinPage';
import OrgCreatePage from '../src/screens/org/OrgCreatePage';
import ExplorePage from '../src/screens/ExplorePage';
import MyProjectsPage from '../src/screens/MyProjectsPage';
import { ProjectByNamePage, ProjectConsole } from '../src/screens/ProjectPage';
import OrgRepositoriesPage from '../src/screens/OrgRepositoriesPage';
import ProjectEnvVars from '../src/components/ProjectEnvVars';
import ProjectDomains from '../src/components/ProjectDomains';
import type { Deployment, Project } from '../src/api/projects';
import { SignOutNotice } from '../src/components/ui/SignOutNotice';
import { Header } from '../src/components/ui/Header';
import MyPage from '../src/screens/MyPage';
import { ModelPlaygroundPanel } from '../src/screens/models/ModelPlaygroundPanel';
import { CopyButton } from '../src/components/ui/Misc';
import { CodeBlock as DocsCodeBlock } from '../src/components/docs/CodeBlock';
import BenchmarkPage from '../src/screens/BenchmarkPage';
import TeacherPage from '../src/screens/TeacherPage';
import VerifierPage from '../src/screens/VerifierPage';
import KnowledgeByIdPage from '../src/screens/KnowledgeByIdPage';
import { teacherProfile, verifierProfile, providerAddress } from './fixtures/providerProfiles';
import TrackPage from '../src/screens/TrackPage';
import { trackName, trackEntry, trackBranches, trackHistory } from './fixtures/track';
import NetworkPage, { NetworkRouteResult } from '../src/screens/NetworkPage';
import { matchedRoute, unmatchedRoute, routeCondition } from './fixtures/networkRoute';
import { networkInfoFixture, networkNodesFixture, networkLedgerFixture } from './fixtures/networkView';
import LedgerPage, { LedgerContent } from '../src/screens/LedgerPage';
import { ledgerFixture, ledgerNode, ledgerRecord, ledgerGraphFixture } from './fixtures/ledger';

// Real RTK hooks render cached server responses. No fetch, browser identity, or production mutations.
const makeStore = (preloadedState?: any) => configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (gdm) => gdm().concat(api.middleware),
  ...(preloadedState ? { preloadedState } : {}),
});
const stores: ReturnType<typeof makeStore>[] = [];
afterEach(() => { forgetTeacherKey(); for (const store of stores.splice(0)) store.dispatch(api.util.resetApiState()); });
type Fixture = { name: string; arg?: unknown; value?: unknown; status?: 'pending' | 'rejected'; errorStatus?: number; errorData?: unknown };
function render(page: () => any, fixtures: Fixture[], path = '/train/mine', route?: string) {
  const seed = makeStore(); stores.push(seed);
  seed.dispatch(api.util.upsertQueryEntries(fixtures.map(({ name, value, arg }) => ({ endpointName: name, arg, value })) as any));
  const state = seed.getState();
  const queries = { ...state[api.reducerPath].queries };
  for (const [key, entry] of Object.entries(queries)) {
    const fixture = fixtures.find((f) => f.name === entry?.endpointName && JSON.stringify(f.arg) === JSON.stringify(entry?.originalArgs));
    if (fixture?.status) queries[key] = { ...entry, status: fixture.status, error: fixture.status === 'rejected' ? { status: fixture.errorStatus ?? 503, data: fixture.errorData ?? 'unavailable' } : undefined } as any;
  }
  const store = makeStore({ [api.reducerPath]: { ...state[api.reducerPath], queries } }); stores.push(store);
  return renderToStaticMarkup(createElement(Provider, { store, children:
    createElement(MemoryRouter, { initialEntries: [path] },
      createElement(ThemeProvider, { theme },
        createElement(LocaleProvider, null,
          createElement(AuthProvider, null, route ? createElement(Routes, null, createElement(Route, { path: route, element: createElement(page) })) : createElement(page))))) }));
}
const signedOut: Fixture[] = [
  { name: 'me', value: { signedIn: false } },
  { name: 'googleSession', value: { configured: false } },
  { name: 'ssoStatus', value: { configured: true } },
];
const policy: Fixture = { name: 'teachPolicy', value: { enabled: false, trainer: 'paused' } };

const ledgerFixtures: Fixture[] = [
  { name: 'ledger', arg: { kind: undefined, limit: 1000 }, value: ledgerFixture([ledgerNode()]) },
  { name: 'ledgerVerify', value: { valid: true, checked: 1, errors: [] } },
  { name: 'graph', value: ledgerGraphFixture() },
];
test('ledger filters do not show another filter cache or claim no records during loading', () => {
  const html = render(() => createElement(LedgerContent, { kind: 'price', onKindChange() {} }), [...signedOut, ...ledgerFixtures], '/ledger');
  assert.match(html, /ledger-loading/);
  assert.doesNotMatch(html, /Selected node record|No &quot;Price change&quot; records yet/);
  const mismatch = render(() => createElement(LedgerContent, { kind: 'price', onKindChange() {} }), [...signedOut, ...ledgerFixtures,
    { name: 'ledger', arg: { kind: 'price', limit: 1000 }, value: ledgerFixture([ledgerNode()]) },
  ], '/ledger');
  assert.match(mismatch, /offline-retry/); assert.doesNotMatch(mismatch, /Selected node record/);
});

test('failed ledger refresh hides cached rows while the independent graph remains available', () => {
  const html = render(LedgerPage, [...signedOut, ...ledgerFixtures.filter(f => f.name !== 'ledger'),
    { ...ledgerFixtures[0], status: 'rejected' },
  ], '/ledger');
  assert.match(html, /offline-retry/); assert.match(html, /Selected graph knowledge/);
  assert.doesNotMatch(html, /Selected node record|No records yet\./);
});

test('failed verification cannot retain a valid badge and failed graphs cannot look empty or spin forever', () => {
  const html = render(LedgerPage, [...signedOut, ledgerFixtures[0],
    { ...ledgerFixtures[1], status: 'rejected' }, { ...ledgerFixtures[2], status: 'rejected' },
  ], '/ledger');
  assert.equal((html.match(/data-testid="offline-retry"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /valid · 1 checked|Selected graph knowledge|No knowledge registered on the public record yet|ledger-graph-loading/);
  assert.match(html, /Unavailable/);
});

test('ledger lists current protocol kinds with useful price, retirement, dispute and payout summaries', () => {
  const records = [ledgerRecord('price', { patch_id: 'price-id', price: '7', currency: 'AIN' }),
    ledgerRecord('retire', { patch_id: 'retire-id', reason: 'Superseded dataset' }),
    ledgerRecord('dispute', { patch_id: 'dispute-id', role: 'answer', author: 'peer', reason: 'Answer to claim' }),
    ledgerRecord('payout', { patch_id: 'payout-id', to: 'recipient', amount: '3', currency: 'USDC' })];
  const html = render(LedgerPage, [...signedOut, ...ledgerFixtures.filter(f => f.name !== 'ledger'),
    { name: 'ledger', arg: { kind: undefined, limit: 1000 }, value: ledgerFixture(records) },
  ], '/ledger');
  for (const label of ['Retirement', 'Price change', 'Trade dispute', 'Payout']) assert.match(html, new RegExp(`role="option"[^>]*>${label}</button>`));
  assert.match(html, /price-id price changed to 7 AIN/);
  assert.match(html, /retire-id retired from sale · Superseded dataset/);
  assert.match(html, /dispute-id dispute response/); assert.match(html, /payout-id payout · 3 USDC/);
});

test('filtered ledger windows distinguish matching rows from the whole ledger count', () => {
  const data = ledgerFixture([ledgerRecord('price', { patch_id: 'id', price: '7', currency: 'AIN' })]); data.info.records = 2000;
  const html = render(() => createElement(LedgerContent, { kind: 'price', onKindChange() {} }), [...signedOut, ...ledgerFixtures.filter(f => f.name !== 'ledger'),
    { name: 'ledger', arg: { kind: 'price', limit: 1000 }, value: data },
  ], '/ledger');
  assert.match(html, /Showing 1 recent Price change records \(up to 1,000\)/);
  assert.match(html, /ledger total of 2,000 includes all kinds/);
});

test('graph links preserve exact knowledge ids and explain unavailable relationships', () => {
  const graph = ledgerGraphFixture(); graph.edges.push({ from: 'chosen/id', to: 'unavailable', type: 'extends' });
  const html = render(LedgerPage, [...signedOut, ...ledgerFixtures.filter(f => f.name !== 'graph'), { name: 'graph', value: graph }], '/ledger');
  assert.match(html, new RegExp(`href="/0x${'a'.repeat(40)}/chosen%2Fid"`));
  assert.match(html, /1 relationships could not be drawn/);
});

test('routing results link to the chosen track and exact knowledge id, not the track owner', () => {
  const html = render(() => createElement(NetworkRouteResult, { routed: matchedRoute(), input: routeCondition }), signedOut, '/network');
  assert.match(html, /href="\/tracks\/finance\/chosen"/);
  assert.match(html, /href="\/patch\/chosen%2Fid"/);
  assert.doesNotMatch(html, new RegExp(`href="/0x${'b'.repeat(40)}/`));
  assert.match(html, /href="https:\/\/serving.example\/base\/api\/info"/);
});

test('routing distinguishes no match and no current knowledge from a node serving a track', () => {
  const missing = render(() => createElement(NetworkRouteResult, { routed: unmatchedRoute(), input: { key: 'jurisdiction', value: 'US' } }), signedOut, '/network');
  assert.match(missing, /No track matches jurisdiction=US/);
  const empty = matchedRoute(); empty.current = [];
  const html = render(() => createElement(NetworkRouteResult, { routed: empty, input: routeCondition }), signedOut, '/network');
  assert.match(html, /no currently available knowledge/);
  assert.doesNotMatch(html, /serving the whole track/);
});

test('network page does not recommend subscribing to an arbitrary first track before routing', () => {
  const html = render(NetworkPage, [...signedOut,
    { name: 'info', value: networkInfoFixture() },
    { name: 'branches', value: trackBranches() },
    { name: 'nodes', value: { self: 'self', peers: [], nodes: [] } },
    { name: 'catalogSnapshot', value: { items: [] } },
    { name: 'ledger', arg: { limit: 5000 }, value: { info: { records: 0 }, records: [] } },
  ], '/network');
  assert.match(html, /Find nodes/);
  assert.match(html, /jurisdiction=KR/);
  assert.doesNotMatch(html, /ainize branch subscribe|law\/KR/);
});

const networkFixtures: Fixture[] = [
  { name: 'info', value: networkInfoFixture() },
  { name: 'nodes', value: networkNodesFixture() },
  { name: 'branches', value: { branches: [], mine: [] } },
  { name: 'ledger', arg: { limit: 5000 }, value: networkLedgerFixture() },
];
test('network peer failures and pending reads do not claim an empty connected network', () => {
  for (const fixture of [
    { name: 'nodes', status: 'pending' as const },
    { name: 'nodes', status: 'rejected' as const, value: networkNodesFixture() },
    { name: 'nodes', value: { self: 'self', nodes: [{}], peers: [] } },
  ]) {
    const html = render(NetworkPage, [...signedOut, ...networkFixtures.filter(f => f.name !== 'nodes'), fixture], '/network');
    assert.doesNotMatch(html, /No connected nodes\.|Node peer/);
    assert.match(html, fixture.status === 'pending' ? /network-nodes-loading/ : /offline-retry/);
  }
});

test('network ledger errors hide retained counts while successful partial windows show paid sales and their scope', () => {
  const failed = render(NetworkPage, [...signedOut, ...networkFixtures.filter(f => f.name !== 'ledger'),
    { name: 'ledger', arg: { limit: 5000 }, value: networkLedgerFixture(), status: 'rejected' },
  ], '/network');
  assert.match(failed, /offline-retry/);
  assert.doesNotMatch(failed, /no activity in loaded records|data-testid="net-record"|network-record-window/);
  const valid = render(NetworkPage, [...signedOut, ...networkFixtures], '/network');
  assert.match(valid, /4 loaded public records out of 9,000 ledger records/);
  assert.match(valid, /1 sold · 0 listed/);
  assert.match(valid, /1 attestation records/);
  assert.doesNotMatch(valid, /3 sold|1 verified|on the record since/);
});

test('failed or malformed network track lists provide retry instead of an endless spinner or empty list', () => {
  for (const fixture of [
    { name: 'branches', status: 'rejected' as const },
    { name: 'branches', value: { branches: [{}], mine: [] } },
  ]) {
    const html = render(NetworkPage, [...signedOut, ...networkFixtures.filter(f => f.name !== 'branches'), fixture], '/network');
    assert.match(html, /offline-retry/);
    assert.doesNotMatch(html, /network-tracks-loading/);
  }
});

test('a failed top-level network refresh cannot retain the old node status and routing controls', () => {
  const html = render(NetworkPage, [...signedOut, ...networkFixtures.filter(f => f.name !== 'info'),
    { name: 'info', value: networkInfoFixture(), status: 'rejected' },
  ], '/network');
  assert.match(html, /offline-retry/);
  assert.doesNotMatch(html, /Node self|Find nodes/);
});

test('network freshness requires all current versions, rather than reporting the newest of a partial subset', () => {
  const fixtures = [...signedOut, ...networkFixtures.filter(f => f.name !== 'branches'), { name: 'branches', value: trackBranches(['selected', 'missing']) }];
  (fixtures.at(-1)!.value as ReturnType<typeof trackBranches>).branches[0].current = ['selected', 'missing'];
  const html = render(NetworkPage, [...fixtures, { name: 'catalogSnapshot', value: { items: [trackEntry('selected')] } }], '/network');
  assert.match(html, /<td[^>]*>Unavailable<\/td>/);
  assert.match(html, /href="\/patch\/missing"/);
});

const trackFixtures: Fixture[] = [
  { name: 'branches', value: trackBranches() },
  { name: 'ledger', arg: { kind: 'subscribe', limit: 2000 }, value: trackHistory },
];
test('track loading and read failures cannot claim zero sales or missing knowledge', () => {
  for (const status of ['pending', 'rejected'] as const) {
    const html = render(TrackPage, [...signedOut, ...trackFixtures, { name: 'trackCatalog', arg: trackName, status }], `/tracks/${trackName}`, '/tracks/*');
    assert.doesNotMatch(html, /no sales yet|not in the public catalog/);
    assert.match(html, status === 'pending' ? /data-testid="track-catalog-loading"/ : /data-testid="offline-retry"/);
    assert.match(html, /href="\/patch\/selected"/);
  }
  const other = render(TrackPage, [...signedOut, ...trackFixtures, { name: 'trackCatalog', arg: 'other', value: { name: 'other', items: [trackEntry('other')] } }], `/tracks/${trackName}`, '/tracks/*');
  assert.doesNotMatch(other, /Knowledge other|no sales yet/);
});

test('track views show available sales separately by currency and label limited subscription history', () => {
  const ain = trackEntry('ain'), usdc = trackEntry('usdc'); usdc.anchor = { ...usdc.anchor, currency: 'USDC' }; usdc.revenue = '3';
  const html = render(TrackPage, [...signedOut, ...trackFixtures.filter(f => f.name !== 'branches'),
    { name: 'branches', value: trackBranches(['ain', 'usdc', 'missing']) },
    { name: 'trackCatalog', arg: trackName, value: { name: trackName, items: [ain, usdc] } },
  ], `/tracks/${trackName}`, '/tracks/*');
  assert.match(html, /Sales for 2 of 3 knowledge records/);
  assert.match(html, /2 AIN/); assert.match(html, /3 USDC/);
  assert.doesNotMatch(html, /5 AIN|ever joined/);
  assert.match(html, /Within the latest 1 network subscription records/);
  assert.match(html, /href="\/network#tracks"/);
  assert.match(html, /href="\/patch\/missing"/);
});

test('failed or malformed track lists show retry instead of a false not-found and stale branch details', () => {
  for (const fixture of [{ name: 'branches', value: trackBranches(), status: 'rejected' as const }, { name: 'branches', value: { branches: [{}], mine: [] } }]) {
    const html = render(TrackPage, [...signedOut, fixture], `/tracks/${trackName}`, '/tracks/*');
    assert.match(html, /data-testid="offline-retry"/);
    assert.doesNotMatch(html, /No such track|Selected track|Follow this track/);
  }
  const missing = render(TrackPage, [...signedOut, { name: 'branches', value: { branches: [], mine: [] } }], '/tracks/missing', '/tracks/*');
  assert.match(missing, /No such track/);
});

test('track subscription guidance includes recurring fees separately from knowledge purchases', () => {
  const paid = trackBranches(); Object.assign(paid.branches[0], { terms: { price: '9', currency: 'USDC', period_days: 30 } });
  const html = render(TrackPage, [...signedOut, ...trackFixtures.filter(f => f.name !== 'branches'), { name: 'branches', value: paid },
    { name: 'trackCatalog', arg: trackName, value: { name: trackName, items: [trackEntry('selected', { list_price: '7' })] } },
  ], `/tracks/${trackName}`, '/tracks/*');
  assert.match(html, /9 USDC every 30 days, in addition to knowledge purchases/);
  assert.match(html, /7 AIN/);
  assert.doesNotMatch(html, /100 sale\(s\)|100 ·/);
  assert.doesNotMatch(html, /No track subscription fee/);
});

test('shared copy controls cannot copy empty values or accidentally submit surrounding forms', () => {
  const empty = render(() => createElement(CopyButton, { text: ' \n' }), signedOut);
  assert.match(empty, /<button[^>]*type="button"[^>]*disabled=""/);
  const filled = render(() => createElement(CopyButton, { text: 'selected value' }), signedOut);
  assert.match(filled, /Copy to clipboard/);
  assert.doesNotMatch(filled, /disabled=""|>Copied</);
  const docs = render(() => createElement(DocsCodeBlock, { code: '', lang: 'bash' }), signedOut);
  assert.match(docs, /<button[^>]*type="button"[^>]*disabled=""/);
});

test('benchmark outages and malformed responses offer retry instead of claiming the topic does not exist', () => {
  for (const fixture of [
    { name: 'benchmark', arg: 'chosen', status: 'rejected' as const },
    { name: 'benchmark', arg: 'chosen', value: { schema: 'other', items: [] } },
    { name: 'benchmark', arg: 'chosen', value: { schema: 'chosen', items: [{}] } },
  ]) {
    const html = render(BenchmarkPage, [...signedOut, fixture], '/benchmarks/chosen', '/benchmarks/:schema');
    assert.match(html, /data-testid="offline-retry"/);
    assert.doesNotMatch(html, /No knowledge is registered|No knowledge on this topic yet|data-testid="bench-row"/);
  }
  const missing = render(BenchmarkPage, [...signedOut, { name: 'benchmark', arg: 'chosen', status: 'rejected', errorStatus: 404 }], '/benchmarks/chosen', '/benchmarks/:schema');
  assert.match(missing, /No knowledge is registered/);
  assert.doesNotMatch(missing, /data-testid="offline-retry"/);
});

test('a new benchmark route does not show another topic cached results or claim an empty result while loading', () => {
  const html = render(BenchmarkPage, [...signedOut, { name: 'benchmark', arg: 'previous', value: { schema: 'Previous topic', items: [] } }], '/benchmarks/chosen', '/benchmarks/:schema');
  assert.doesNotMatch(html, /Previous topic|No knowledge on this topic yet|No knowledge is registered/);
  const empty = render(BenchmarkPage, [...signedOut, { name: 'benchmark', arg: 'chosen', value: { schema: 'chosen', items: [] } }], '/benchmarks/chosen', '/benchmarks/:schema');
  assert.match(empty, /No knowledge on this topic yet/);
});

test('valid benchmark entries retain their chosen author/id destination and comparison values', () => {
  const item = { anchor: { id: 'knowledge-id', author: 'chosen-author', name: 'Selected knowledge', created_at: 1, rows: 10, size_bytes: 20, price: '0', model: { id_M: 'base' }, benchmark: { schema: 'chosen', queries: 3, format: ['chat'] } },
    status: 'VERIFIED', attestations: [], passed: 2, quorum: 2, quorum_ok: true, downloads: 1 };
  const html = render(BenchmarkPage, [...signedOut, { name: 'benchmark', arg: 'chosen', value: { schema: 'chosen', items: [item] } }], '/benchmarks/chosen', '/benchmarks/:schema');
  assert.match(html, /data-testid="bench-row"/);
  assert.match(html, /href="\/chosen-author\/knowledge-id"/);
  assert.match(html, /Selected knowledge/);
  assert.doesNotMatch(html, /data-testid="offline-retry"/);
});

test('provider detail reads isolate addresses and show recovery for outages and malformed histories', () => {
  for (const [Page, endpoint, profile] of [[TeacherPage, 'teacher', teacherProfile()], [VerifierPage, 'verifier', verifierProfile()]] as const) {
    const route = `/${endpoint}/:address`, path = `/${endpoint}/${providerAddress}`;
    for (const fixture of [
      { name: endpoint, arg: providerAddress, value: profile, status: 'rejected' as const },
      { name: endpoint, arg: providerAddress, value: { ...profile, address: `0x${'b'.repeat(40)}` } },
      { name: endpoint, arg: providerAddress, value: {} },
    ]) {
      const html = render(Page, [...signedOut, fixture], path, route);
      assert.match(html, /data-testid="offline-retry"/);
      assert.doesNotMatch(html, /Selected teacher|Selected verifier|No knowledge published|No sales yet/);
    }
    const changed = render(Page, [...signedOut, { name: endpoint, arg: `0x${'b'.repeat(40)}`, value: profile }], path, route);
    assert.doesNotMatch(changed, /Selected teacher|Selected verifier|No knowledge published|No sales yet/);
  }
});

test('provider knowledge names link to the exact id lookup rather than an organization or search', () => {
  const teacher = teacherProfile();
  teacher.lessons.push({ id: 'chosen/id', name: 'Chosen lesson', status: 'VERIFIED', verified: true, downloads: 0, revenue: '0' });
  const verifier = verifierProfile(); verifier.attested = 1;
  verifier.items.push({ patch_id: 'chosen/id', name: 'Chosen lesson', status: 'VERIFIED', passed: true, verified_on: 'model', score: {}, created_at: 1, recheck: false, samples_run: null, samples_available: null, duration_ms: null, challenged_after: false });
  for (const [Page, endpoint, profile] of [[TeacherPage, 'teacher', teacher], [VerifierPage, 'verifier', verifier]] as const) {
    const html = render(Page, [...signedOut, { name: endpoint, arg: providerAddress, value: profile }], `/${endpoint}/${providerAddress}`, `/${endpoint}/:address`);
    assert.match(html, /href="\/patch\/chosen%2Fid"/);
    assert.doesNotMatch(html, /href="\/chosen\/id"|href="\/explore\?q=/);
  }
});

test('id-only knowledge lookup offers recovery for failed or mismatched data and preserves true 404 behavior', () => {
  for (const fixture of [{ name: 'patch', arg: 'chosen', status: 'rejected' as const }, { name: 'patch', arg: 'chosen', value: { anchor: { id: 'other', author: providerAddress } } }]) {
    const html = render(KnowledgeByIdPage, [...signedOut, fixture], '/patch/chosen', '/patch/:patchId');
    assert.match(html, /data-testid="offline-retry"/);
    assert.doesNotMatch(html, /This knowledge could not be found/);
  }
  const missing = render(KnowledgeByIdPage, [...signedOut, { name: 'patch', arg: 'chosen', status: 'rejected', errorStatus: 404 }], '/patch/chosen', '/patch/:patchId');
  assert.match(missing, /This knowledge could not be found/);
});
const lists = (datasets: Fixture, jobs: Fixture) => [...signedOut, policy, ...[datasets, jobs].map(f => ({ ...f, arg: currentTeacherKey()?.address.toLowerCase() ?? '' }))];
const dsEmpty: Fixture = { name: 'teachDatasets', value: { items: [] } };
const jobsEmpty: Fixture = { name: 'myTeachJobs', value: { items: [] } };

test('a failed dataset or history request is retryable and never claims the collection is empty', () => {
  createTeacherKey();
  for (const failed of ['teachDatasets', 'myTeachJobs']) {
    const html = render(TeachMinePage, lists(
      failed === 'teachDatasets' ? { name: failed, status: 'rejected' } : dsEmpty,
      failed === 'myTeachJobs' ? { name: failed, status: 'rejected' } : jobsEmpty,
    ));
    assert.match(html, /role="alert"/);
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /data-testid="mine-empty"/);
  }
});

test('an empty dataset response waits for history before declaring an empty collection', () => {
  createTeacherKey();
  const loading = render(TeachMinePage, lists(dsEmpty, { name: 'myTeachJobs', status: 'pending' }));
  assert.match(loading, /data-testid="mine-loading"/);
  assert.doesNotMatch(loading, /data-testid="mine-empty"/);
  assert.match(render(TeachMinePage, lists(dsEmpty, jobsEmpty)), /data-testid="mine-empty"/);
});

test('completed lessons remain reachable after their source dataset is removed', () => {
  createTeacherKey();
  const job = { id: 'retained-lesson', name: 'Retained lesson', status: 'READY', facts: [], dataset: { id: 'removed-source' }, publish_status: 'none', created_at: 1, updated_at: 1 };
  const html = render(TeachMinePage, lists(dsEmpty, { name: 'myTeachJobs', value: { items: [job] } }));
  assert.match(html, /Retained lesson/);
  assert.match(html, /href="\/train\/lesson\/retained-lesson"/);
  assert.doesNotMatch(html, /data-testid="mine-empty"/);
});

test('a failed refresh retains previous history while reporting the error', () => {
  createTeacherKey();
  const html = render(TeachMinePage, lists(dsEmpty, { name: 'myTeachJobs', status: 'rejected', value: { items: [{ id: 'previous', name: 'Previous lesson', status: 'READY', facts: [] }] } }));
  assert.match(html, /Previous lesson/);
  assert.match(html, /data-testid="mine-jobs-error"/);
  assert.doesNotMatch(html, /data-testid="mine-empty"/);
});

test('ordinary sign-in goes directly to AIN and retains the requested page without showing wallet controls', () => {
  const html = render(SigningPage, signedOut, '/signing?next=%2Fapps%3Fq%3Ddemo%23results');
  assert.match(html, /data-testid="signin-redirect"/);
  assert.match(html, /href="\/api\/auth\/sso\/start\?next=%2Fapps%3Fq%3Ddemo%23results"/);
  assert.doesNotMatch(html, /data-testid="wallet-options"|data-testid="ain-wallet-signin"/);
});

test('wallet-only nodes and explicit node enrollment keep the wallet section expanded', () => {
  for (const [fixtures, path] of [
    [[...signedOut.filter((f) => f.name !== 'ssoStatus'), { name: 'ssoStatus', value: { configured: false } }], '/signing'],
    [signedOut, '/signing?token=test-invitation'],
  ] as [Fixture[], string][]) {
    const html = render(SigningPage, fixtures, path);
    assert.match(html, /<details[^>]*open=""[^>]*data-testid="wallet-options"/);
  }
});

test('signed-in account visitors can continue without being forced into wallet login', () => {
  const html = render(SigningPage, [...signedOut.filter((f) => f.name !== 'me'), { name: 'me', value: { sso: { sub: 'test-user', name: 'Test user', principal: 'sso:test-user' } } }], '/signing?next=%2Fapps');
  assert.match(html, /data-testid="signin-redirect"/);
  assert.match(html, /href="\/apps"/);
  assert.doesNotMatch(html, /data-testid="wallet-options"|data-testid="sso-signin"/);
});

test('sign-in waits for configured options instead of flashing a wallet-only page', () => {
  const html = render(SigningPage, [...signedOut.filter((f) => f.name !== 'ssoStatus'), { name: 'ssoStatus', status: 'pending' }], '/signing');
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, /data-testid="wallet-options"/);
  assert.doesNotMatch(html, /data-testid="sso-signin"/);
});

test('unavailable AIN sign-in options show a retry and retain the wallet fallback', () => {
  const html = render(SigningPage, [...signedOut.filter((f) => f.name !== 'ssoStatus'), { name: 'ssoStatus', status: 'rejected' }], '/signing');
  assert.match(html, /Could not load AIN account sign-in options/);
  assert.match(html, /Try again/);
  assert.match(html, /data-testid="wallet-options"/);
});

const appAccount: Fixture[] = [
  ...signedOut.filter((f) => f.name !== 'me'),
  { name: 'me', value: { sso: { sub: 'viewer', principal: 'sso:viewer', orgs: [{ id: 'studio', slug: 'studio' }] } } },
];
const appsArg = { principal: JSON.stringify([null, 'sso:viewer', null, null]), orgs: ['studio'] };
const webApp = { id: 'web', name: 'Storefront', org: 'studio', repoName: 'mono', sourcePath: 'packages/web', kind: 'nextjs', branch: 'main', status: 'ready', updatedAt: Date.now(), lastDeployment: { id: 'newest', status: 'ready', outputUrl: 'https://newest.example.test' }, activeDeploymentId: 'previous' };
const appsFixture = (projects: unknown[], failedSources: string[] = []): Fixture => ({ name: 'accessibleApps', arg: appsArg, value: { projects, failedSources } });

test('signed-out Apps never renders organization-specific cached results', () => {
  const html = render(AppsPage, [...signedOut, appsFixture([webApp])], '/apps');
  assert.match(html, /Sign in with AIN/);
  assert.doesNotMatch(html, /Storefront|studio\/mono/);
});

test('Apps shows only app kinds and preserves the selected monorepo folder', () => {
  const html = render(AppsPage, [...appAccount, appsFixture([webApp, { ...webApp, id: 'script', kind: 'script', name: 'Hidden script' }, { ...webApp, id: 'agent', kind: 'agent', name: 'Hidden agent' }])], '/apps');
  assert.match(html, /Storefront/);
  assert.match(html, /href="\/studio\/mono\?project=packages%2Fweb"/);
  assert.doesNotMatch(html, /Hidden script|Hidden agent/);
});

test('App Open uses the active deployment after rollback, not the newest successful build', () => {
  const html = render(AppsPage, [...appAccount, appsFixture([webApp]), { name: 'projectDeployments', arg: { id: 'web', identity: appsArg.principal }, value: { deployments: [{ id: 'previous', status: 'ready', outputUrl: 'https://active.example.test' }] } }], '/apps');
  assert.match(html, /href="https:\/\/active.example.test"/);
  assert.doesNotMatch(html, /href="https:\/\/newest.example.test"/);
});

test('partial Apps results remain visible and are identified as incomplete', () => {
  const html = render(AppsPage, [...appAccount, appsFixture([webApp], ['other-team'])], '/apps');
  assert.match(html, /Storefront/);
  assert.match(html, /data-testid="apps-partial"/);
  assert.match(html, /Try again/);
  const empty = render(AppsPage, [...appAccount, appsFixture([], ['other-team'])], '/apps');
  assert.match(empty, /Other apps may be missing/);
  assert.doesNotMatch(empty, /Deploy your first app/);
});

test('failed app refresh preserves previous results and tells the visitor they are previous', () => {
  const html = render(AppsPage, [...appAccount, { ...appsFixture([webApp]), status: 'rejected' }], '/apps');
  assert.match(html, /Storefront/);
  assert.match(html, /Showing the previous results/);
});

test('search retains partial app matches while reporting the incomplete source', () => {
  const html = render(SearchPage, [...appAccount, appsFixture([webApp], ['other-team']),
    { name: 'models', value: {} }, { name: 'networkModels', value: {} }, { name: 'agents', value: { agents: [] } },
    { name: 'catalog', arg: { q: 'Storefront', status: 'VERIFIED,ANNOUNCED,VERIFYING,CHALLENGED', limit: 8 }, value: { items: [], total: 0 } },
  ], '/search?q=Storefront');
  assert.match(html, /Storefront/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Try again/);
});

const accountIdentity = JSON.stringify([null, 'sso:viewer', null, null]);
const accountOrgs: Fixture = { name: 'myOrgs', arg: accountIdentity, value: { signed_in: true, orgs: [] } };
const noKeys: Fixture = { name: 'apiKeys', arg: accountIdentity, value: { keys: [] } };

test('account keys do not claim empty during loading or failure and failed refresh preserves the list', () => {
  for (const status of ['pending', 'rejected'] as const) {
    const html = render(MyPage, [...appAccount, accountOrgs, { ...noKeys, value: undefined, status }], '/me');
    assert.doesNotMatch(html, /No keys yet/);
    if (status === 'rejected') {
      assert.match(html, /data-testid="me-keys-error"/);
      assert.match(html, /Try again/);
    }
  }
  const html = render(MyPage, [...appAccount, accountOrgs, { ...noKeys, status: 'rejected', value: { keys: [{ prefix: 'fixture-prefix', label: 'Existing account key', issuedAt: 1 }] } }], '/me');
  assert.match(html, /Existing account key/);
  assert.match(html, /data-testid="me-keys-error"/);
  assert.doesNotMatch(html, /No keys yet/);
  assert.match(render(MyPage, [...appAccount, accountOrgs, noKeys], '/me'), /No keys yet/);
});

test('an SSO account sees its linked nodes without another wallet login', () => {
  const html = render(MyPage, [...appAccount, accountOrgs, noKeys, { name: 'myNodes', arg: accountIdentity, value: { nodes: [{ address: '0x123', name: 'My AIN node' }] } }], '/me');
  assert.match(html, /My AIN node/);
  assert.match(html, /href="\/my-nodes"/);
  assert.doesNotMatch(html, /Connect that wallet to see your nodes|wallet=1/);
});

test('account key, organization and node caches cannot be borrowed from another identity', () => {
  const wallet = '0x1111111111111111111111111111111111111111';
  const current = JSON.stringify([wallet, null, null, null]);
  const html = render(MyPage, [
    ...signedOut.filter((f) => f.name !== 'me'), { name: 'me', value: { signedIn: true, subject: wallet } },
    { ...noKeys, arg: 'previous-account', value: { keys: [{ prefix: 'old-key', label: 'Previous secret label', issuedAt: 1 }] } },
    { ...accountOrgs, arg: 'previous-account', value: { signed_in: true, orgs: [{ id: 'private-org', name: 'Previous private organization' }] } },
    { name: 'myNodes', arg: 'other-wallet', value: { nodes: [{ address: 'other-wallet', name: 'Previous private node' }] } },
    { name: 'apiKeys', arg: current, status: 'pending' },
    { name: 'myOrgs', arg: current, status: 'pending' },
    { name: 'myNodes', arg: current, status: 'pending' },
  ], '/me');
  assert.doesNotMatch(html, /Previous secret label|Previous private organization|Previous private node/);
  assert.doesNotMatch(html, /No keys yet|None yet\. A node appears/);
});

test('failed wallet node lookup shows recovery while retaining cached current-wallet nodes', () => {
  const wallet = '0x1111111111111111111111111111111111111111';
  const current = JSON.stringify([wallet, null, null, null]);
  const html = render(MyPage, [
    ...signedOut.filter((f) => f.name !== 'me'), { name: 'me', value: { signedIn: true, subject: wallet } },
    { ...noKeys, arg: current }, { ...accountOrgs, arg: current },
    { name: 'myNodes', arg: current, status: 'rejected', value: { nodes: [{ address: wallet, name: 'Current wallet node' }] } },
  ], '/me');
  assert.match(html, /data-testid="me-nodes-error"/);
  assert.match(html, /Current wallet node/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /None yet\. A node appears/);
});

const Playground = () => createElement(ModelPlaygroundPanel, {
  model: { id: 'fixture-model', modality: 'decision', name: 'Fixture model' } as any,
  signInNext: '/models/fixture-model',
});
test('model key management goes to the personal account, and list failure has recovery', () => {
  const html = render(Playground, [...appAccount, { ...noKeys, value: { keys: [{ prefix: 'fixture-prefix', label: 'Existing key' }] } }], '/models/fixture-model');
  assert.match(html, /href="\/me"[^>]*>Manage your keys/);
  assert.doesNotMatch(html, /href="\/account"/);
  const failed = render(Playground, [...appAccount, { ...noKeys, status: 'rejected', value: undefined }], '/models/fixture-model');
  assert.match(failed, /role="alert"/);
  assert.match(failed, /Try again/);
});


test('explicit wallet connection links open wallet controls for an already signed-in AIN account', () => {
  const html = render(SigningPage, appAccount, '/signing?next=%2Fme&wallet=1');
  assert.match(html, /<details[^>]*open=""[^>]*data-testid="wallet-options"/);
  assert.match(html, /data-testid="ain-wallet-signin"/);
  assert.match(html, /data-testid="signin-continue"/);
});


test('a failed sign-in stays on a recovery screen rather than immediately restarting authentication', () => {
  const html = render(SigningPage, signedOut, '/signing?next=%2Fapps&sso_error=account_suspended');
  assert.doesNotMatch(html, /data-testid="signin-redirect"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /href="\/api\/auth\/sso\/start\?next=%2Fapps"/);
});

function assertAccountDevice(kind: 'cli' | 'node') {
  const request = { name: 'deviceRequest', arg: 'terminal-code', value: { kind, status: 'pending', delegate: '0x' + '1'.repeat(40), label: 'My laptop', name: 'Ainize', node: '0x' + '2'.repeat(40), expires: Date.now() + 60000, message: 'wallet message' } };
  const html = render(AuthorizePage, [...signedOut.filter((f) => f.name !== 'me'), { name: 'me', value: { sso: { sub: 'account', principal: 'sso:account', name: 'Test account' } } }, request], '/authorize?code=terminal-code');
  assert.match(html, /data-testid="authorize-account"/);
  assert.match(html, /Test account/);
  assert.match(html, kind === 'cli' ? /Sign in this device/ : /Connect node/);
  assert.doesNotMatch(html, /authorize-message|wallet=1|Approve and sign|disabled="" data-testid="authorize-approve"/);
  const loggedOut = render(AuthorizePage, [...signedOut, request], '/authorize?code=terminal-code');
  assert.match(loggedOut, /data-testid="authorize-login"/);
  assert.match(loggedOut, /href="\/api\/auth\/sso\/start\?next=%2Fauthorize%3Fcode%3Dterminal-code"/);
  assert.doesNotMatch(loggedOut, /wallet=1|authorize-message/);
}
test('terminal login uses AIN account approval without wallet controls', () => assertAccountDevice('cli'));
test('node connection uses AIN account approval without wallet controls', () => assertAccountDevice('node'));

test('a temporary terminal request failure offers retry instead of claiming the link is invalid', () => {
  const html = render(AuthorizePage, [...signedOut, { name: 'deviceRequest', arg: 'offline-code', status: 'rejected' }], '/authorize?code=offline-code');
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /That is not a link this node issued/);
});


test('changing or removing a teaching key cannot render another key’s cached lesson history', () => {
  const previous = createTeacherKey().address.toLowerCase();
  const previousFixtures: Fixture[] = [
    ...signedOut, policy,
    { name: 'teachDatasets', arg: previous, value: { items: [] } },
    { name: 'myTeachJobs', arg: previous, value: { items: [{ id: 'private-a', name: 'Private lesson from A', status: 'READY', facts: [] }] } },
  ];
  assert.match(render(TeachMinePage, previousFixtures), /Private lesson from A/);
  createTeacherKey();
  const switched = render(TeachMinePage, previousFixtures);
  assert.doesNotMatch(switched, /Private lesson from A|private-a/);
  forgetTeacherKey();
  const forgotten = render(TeachMinePage, previousFixtures);
  assert.doesNotMatch(forgotten, /Private lesson from A|private-a/);
});


test('dataset preview and settings show loading or retryable errors without claiming a missing dataset', () => {
  const teacherIdentity = createTeacherKey().address.toLowerCase();
  const arg = { id: 'dataset-a', teacherIdentity };
  for (const [page, path, route] of [
    [TeachDatasetPage, '/train/dataset/dataset-a', '/train/dataset/:dsId'],
    [TeachSettingsPage, '/train/dataset/dataset-a/settings', '/train/dataset/:dsId/settings'],
  ] as const) {
    const loading = render(page, [...signedOut, policy, { name: 'teachDataset', arg, status: 'pending' }], path, route);
    assert.match(loading, /data-testid="dataset-loading"/);
    assert.doesNotMatch(loading, /role="alert"/);
    const failed = render(page, [...signedOut, policy, { name: 'teachDataset', arg, status: 'rejected' }], path, route);
    assert.match(failed, /role="alert"/);
    assert.match(failed, /Try again/);
    assert.doesNotMatch(failed, /That dataset could not be found/i);
  }
});


const privateLinked = { id: 'private-proxy', name: 'Private linked assistant', owner: 'sso:viewer', visibility: 'private', a2a_url: 'https://fixture.invalid/agents/private-proxy', card_url: 'https://fixture.invalid/agents/private-proxy/card' };
const agentLists: Fixture[] = [
  { name: 'agents', value: { agents: [] } },
  { name: 'manageableHostedAgents', arg: accountIdentity, value: { agents: [] } },
  { name: 'myLinkedAgents', arg: accountIdentity, value: { agents: [] } },
  { name: 'agentArchives', arg: { offset: 0, principal: accountIdentity }, value: { archives: [], total: 0, limit: 10, offset: 0 } },
];

test('My agents includes private linked agents and routes Open and Edit to that exact resource', () => {
  const fixtures = agentLists.map(f => f.name === 'myLinkedAgents' ? { ...f, value: { agents: [privateLinked] } } : f);
  const html = render(MyAgentsPage, [...appAccount, ...fixtures], '/me/agents');
  assert.match(html, /Private linked assistant/);
  assert.match(html, /href="\/agent\/private-proxy"/);
  assert.match(html, /href="\/agent\/private-proxy\/link"/);
  assert.match(html, /data-testid="my-agent-delete-private-proxy"/);
  assert.doesNotMatch(html, /data-testid="my-agents-empty"|What is not here is not there/);
});

test('My agents distinguishes pending, failed, partial and confirmed-empty lists', () => {
  for (const status of ['pending', 'rejected'] as const) {
    const fixtures = agentLists.map(f => f.name === 'myLinkedAgents' ? { ...f, value: undefined, status } : f);
    const html = render(MyAgentsPage, [...appAccount, ...fixtures], '/me/agents');
    assert.doesNotMatch(html, /data-testid="my-agents-empty"/);
    assert.match(html, status === 'pending' ? /data-testid="my-agents-loading"/ : /data-testid="my-agents-load-error"/);
    if (status === 'rejected') assert.match(html, /Try again/);
  }
  const partial = agentLists.map(f => f.name === 'manageableHostedAgents' ? { ...f, status: 'rejected' as const, value: undefined } : f.name === 'myLinkedAgents' ? { ...f, value: { agents: [privateLinked] } } : f);
  const html = render(MyAgentsPage, [...appAccount, ...partial], '/me/agents');
  assert.match(html, /Private linked assistant/); assert.match(html, /data-testid="my-agents-load-error"/);
  assert.doesNotMatch(html, /data-testid="my-agents-empty"/);
  assert.match(render(MyAgentsPage, [...appAccount, ...agentLists], '/me/agents'), /data-testid="my-agents-empty"/);
});

test('shared hosted agents expose edit but not deletion when the current membership cannot delete', () => {
  const fixtures = agentLists.map(f => f.name === 'manageableHostedAgents' ? { ...f, value: { agents: [{ id: 'team-agent', name: 'Team agent', owner: 'sso:someone-else', mode: 'prompt', visibility: 'org', org_id: 'studio', can_manage: true, can_delete: false }] } } : f);
  const html = render(MyAgentsPage, [...appAccount, ...fixtures], '/me/agents');
  assert.match(html, /href="\/agent\/team-agent\/edit"/);
  assert.doesNotMatch(html, /data-testid="my-agent-delete-team-agent"/);
});

test('private agent and archive caches cannot be shown to another account or a signed-out visitor', () => {
  const previousIdentity = JSON.stringify([null, 'sso:previous', null, null]);
  const privateFixtures: Fixture[] = [
    { name: 'manageableHostedAgents', arg: previousIdentity, value: { agents: [{ id: 'old-secret-agent', name: 'Previous account private agent', owner: 'sso:previous', mode: 'prompt', can_manage: true, can_delete: true }] } },
    { name: 'myLinkedAgents', arg: previousIdentity, value: { agents: [{ ...privateLinked, owner: 'sso:previous' }] } },
    { name: 'agentArchives', arg: { offset: 0, principal: previousIdentity }, value: { archives: [{ id: 'old-archive', name: 'Previous account archive', agent: 'old-agent', secretNames: [], bytes: 1, createdAt: 1 }], total: 1, offset: 0, limit: 10 } },
  ];
  for (const auth of [appAccount, signedOut]) {
    const html = render(MyAgentsPage, [...auth, { name: 'agents', value: { agents: [] } }, ...privateFixtures], '/me/agents');
    assert.doesNotMatch(html, /Previous account|old-secret-agent|private-proxy|old-archive/);
  }
});

test('AIN account navigation includes its supported node inventory without a wallet', () => {
  const html = render(Header, [...appAccount, accountOrgs], '/me');
  assert.match(html, /My nodes/);
});


test('sign-out exposes pending and retryable failure states without claiming success', () => {
  const Failure = () => createElement(SignOutNotice, { failed: true, pending: false, retry: () => undefined });
  const Pending = () => createElement(SignOutNotice, { failed: false, pending: true, retry: () => undefined });
  const failure = render(Failure, signedOut, '/');
  assert.match(failure, /role="alert"/);
  assert.match(failure, /Sign-out could not be completed/);
  assert.match(failure, /Try again/);
  assert.doesNotMatch(failure, /disabled=""/);
  const pending = render(Pending, signedOut, '/');
  assert.match(pending, /role="status"/);
  assert.match(pending, /Signing out/);
  assert.doesNotMatch(pending, /Sign-out could not be completed/);
});

const codeOverview = {
  workspaces: [{ kind: 'organization', org: { id: 'studio', name: 'Studio', role: 'write' }, base: '/code/org/studio', running: true, newSessionUrl: '/code/_workspaces/choose?to=studio' }],
  sessions: [{ workspace: 'studio', id: 'session-current', title: 'Current account session', directory: '/projects/demo', workingDirectory: '/projects/demo', updatedAt: 1, status: 'idle', openUrl: '/code/org/studio/demo/session/session-current' }],
};

test('AinCode shows exact session/workspace destinations without repeated title or introduction', () => {
  const html = render(AinCodePage, [...appAccount, { name: 'aincodeOverview', arg: accountIdentity, value: codeOverview }], '/aincode');
  assert.match(html, /href="\/code\/org\/studio\/demo\/session\/session-current"/);
  assert.match(html, /href="\/code\/_workspaces\/choose\?to=studio"/);
  assert.match(html, /Current account session/);
  assert.doesNotMatch(html, /Which workspace and which repository|AinCode sessions<\/h1>/);
});

test('AinCode distinguishes loading, failed, retained and empty workspace results', () => {
  for (const status of ['pending', 'rejected'] as const) {
    const html = render(AinCodePage, [...appAccount, { name: 'aincodeOverview', arg: accountIdentity, status }], '/aincode');
    assert.doesNotMatch(html, /No AinCode sessions yet/);
    assert.match(html, status === 'pending' ? /data-testid="aincode-loading"/ : /role="alert"/);
    if (status === 'rejected') assert.match(html, /Try again/);
  }
  const retained = render(AinCodePage, [...appAccount, { name: 'aincodeOverview', arg: accountIdentity, status: 'rejected', value: codeOverview }], '/aincode');
  assert.match(retained, /Current account session/); assert.match(retained, /Try again/);
  const empty = render(AinCodePage, [...appAccount, { name: 'aincodeOverview', arg: accountIdentity, value: { ...codeOverview, sessions: [] } }], '/aincode');
  assert.match(empty, /No AinCode sessions yet/);
  assert.match(empty, /href="\/code\/_workspaces\/choose\?to=studio"/);
  assert.doesNotMatch(empty, /href="\/code\/"/);
});

test('AinCode hides another account session cache and shows sign-in only when signed out', () => {
  const previous = { name: 'aincodeOverview', arg: 'previous-account', value: codeOverview };
  const current = render(AinCodePage, [...appAccount, previous], '/aincode');
  assert.doesNotMatch(current, /Current account session|No AinCode sessions yet/);
  assert.match(current, /data-testid="aincode-loading"/);
  const anonymous = render(AinCodePage, [...signedOut, previous], '/aincode');
  assert.doesNotMatch(anonymous, /Current account session/);
  assert.match(anonymous, /href="\/signing\?next=%2Faincode"/);
  for (const errorStatus of [401, 403]) {
    const denied = render(AinCodePage, [...appAccount, { name: 'aincodeOverview', arg: accountIdentity, value: codeOverview, status: 'rejected', errorStatus }], '/aincode');
    assert.doesNotMatch(denied, /Current account session|href="\/signing/);
    assert.match(denied, /Try again/);
  }
});

const orgScope = { id: 'studio', identity: accountIdentity };
const studio = { id: 'studio', name: 'Current studio', my_role: 'admin', members: [], agents: [], groups: [], domains: [], sso_org_ids: [] };
const orgFixture: Fixture = { name: 'org', arg: orgScope, value: { org: studio } };
const settings = (tab: string, fixtures: Fixture[]) => render(OrgSettingsPage, [...appAccount, orgFixture, ...fixtures], `/org/studio/settings?tab=${tab}`, '/org/:id/settings');

test('organization settings use the selected tab and current account role', () => {
  assert.match(settings('general', []), /data-testid="org-settings-general"/);
  assert.match(settings('groups', [{ name: 'orgGroups', arg: orgScope, value: { groups: [] } }]), /data-testid="org-settings-groups"/);
  const denied = render(OrgSettingsPage, [...appAccount, { ...orgFixture, value: { org: { ...studio, my_role: 'read' } } }], '/org/studio/settings?tab=members', '/org/:id/settings');
  assert.match(denied, /data-testid="org-settings-denied"/);
  assert.doesNotMatch(denied, /data-testid="org-settings-members"/);
  const writer = render(OrgSettingsPage, [...appAccount, { ...orgFixture, value: { org: { ...studio, my_role: 'write' } } }], '/org/studio/settings?tab=billing', '/org/:id/settings');
  assert.match(writer, /data-testid="org-settings-tab-denied"/);
  assert.doesNotMatch(writer, /data-testid="org-settings-billing"|data-testid="org-settings-groups"/);
});

test('unknown settings tabs do not silently open General or misreport a permission problem', () => {
  for (const tab of ['', 'missing']) {
    const html = settings(tab, []);
    assert.match(html, /This settings tab does not exist/);
    assert.doesNotMatch(html, /data-testid="org-settings-general"|data-testid="org-settings-groups"/);
  }
});

test('organization request and invite failures cannot claim there are no pending items', () => {
  for (const status of ['pending', 'rejected'] as const) {
    const html = settings('members', ['orgRequests', 'orgInvites'].map(name => ({ name, arg: orgScope, status })));
    assert.doesNotMatch(html, /No pending requests|No open invite/);
    assert.match(html, status === 'pending' ? /data-testid="org-read-loading"/ : /data-testid="org-read-error"/);
  }
  const empty = settings('members', [{ name: 'orgRequests', arg: orgScope, value: { requests: [] } }, { name: 'orgInvites', arg: orgScope, value: { invites: [] } }]);
  assert.match(empty, /No pending requests/);
  assert.doesNotMatch(empty, /data-testid="org-read-error"/);
  const malformed = settings('members', [{ name: 'orgRequests', arg: orgScope, value: { requests: [{}] } }, { name: 'orgInvites', arg: orgScope, value: { invites: [{}] } }]);
  assert.match(malformed, /data-testid="org-read-error"/);
  assert.doesNotMatch(malformed, /No pending requests|No open invite/);
});

test('open invitations exclude used and expired links, and legacy labels never enable a broken revoke button', () => {
  const now = Date.now();
  const invite = { id: `inv_${'a'.repeat(64)}`, token_prefix: 'active', role: 'read', email: null, created_at: now - 1000, expires_at: now + 60_000, used_by: null };
  const fixture = (invites: unknown[]) => [{ name: 'orgInvites', arg: orgScope, value: { invites } }, { name: 'orgRequests', arg: orgScope, value: { requests: [] } }];
  const active = settings('members', fixture([invite]));
  assert.match(active, /active…/);
  assert.match(active, /<button(?![^>]*disabled)[^>]*>Revoke<\/button>/);
  const old = settings('members', fixture([{ ...invite, id: undefined }]));
  assert.match(old, /<button[^>]*disabled=""[^>]*>Revoke<\/button>/);
  assert.match(old, /Refresh invitations/);
  const closed = settings('members', fixture([{ ...invite, used_by: 'sso:used' }, { ...invite, id: `inv_${'b'.repeat(64)}`, token_prefix: 'expire', expires_at: now - 1 }]));
  assert.match(closed, /No open invites/);
  assert.doesNotMatch(closed, /active…|expire…|>Revoke<\/button>/);
});

test('invalid invitation roles or expiry show recovery instead of guessed permissions or an empty list', () => {
  const invite = { id: `inv_${'a'.repeat(64)}`, token_prefix: 'active', role: 'read', created_at: 1, expires_at: Date.now() + 60_000, used_by: null };
  for (const patch of [{ role: 'unknown' }, { expires_at: null }, { used_by: 123 }]) {
    const html = settings('members', [{ name: 'orgInvites', arg: orgScope, value: { invites: [{ ...invite, ...patch }] } }, { name: 'orgRequests', arg: orgScope, value: { requests: [] } }]);
    assert.match(html, /data-testid="org-read-error"/);
    assert.doesNotMatch(html, /No open invites|active…|>Revoke<\/button>/);
  }
});

test('writers manage the full group endpoint even when the profile only includes their own groups', () => {
  const group = { id: 'another-group', name: 'Managed group outside my memberships', members: [], agents: [] };
  const html = render(OrgSettingsPage, [...appAccount,
    { ...orgFixture, value: { org: { ...studio, my_role: 'write', groups: [] } } },
    { name: 'orgGroups', arg: orgScope, value: { groups: [group] } },
  ], '/org/studio/settings?tab=groups', '/org/:id/settings');
  assert.match(html, /Managed group outside my memberships/);
  assert.match(html, /data-testid="org-group-another-group"/);
  assert.doesNotMatch(html, /No groups yet/);
});

test('group management never substitutes profile groups for failed, malformed or other-account group reads', () => {
  const group = { id: 'stale', name: 'Stale group must stay hidden', members: [], agents: [] };
  for (const fixture of [
    { name: 'orgGroups', arg: orgScope, status: 'pending' as const },
    { name: 'orgGroups', arg: orgScope, value: { groups: [group] }, status: 'rejected' as const },
    { name: 'orgGroups', arg: orgScope, value: { groups: [{ ...group, agents: 'broken' }] } },
    { name: 'orgGroups', arg: { ...orgScope, identity: 'other-account' }, value: { groups: [group] } },
  ]) {
    const html = settings('groups', [{ ...orgFixture, value: { org: { ...studio, groups: [group] } } }, fixture]);
    assert.doesNotMatch(html, /Stale group must stay hidden|No groups yet|data-testid="org-group-new"/);
    assert.match(html, /data-testid="org-read-(loading|error)"/);
  }
});

test('organization profile responses must match the bookmarked organization before showing content or settings', () => {
  for (const [Page, path, route] of [[OrgPage, '/org/studio', '/org/:id'], [OrgSettingsPage, '/org/studio/settings', '/org/:id/settings']] as const) {
    const html = render(Page, [...appAccount, { ...orgFixture, value: { org: { ...studio, id: 'other', name: 'Unrelated organization' } } }], path, route);
    assert.doesNotMatch(html, /Unrelated organization|data-testid="org-settings-general"/);
    assert.match(html, /data-testid="org-read-error"/);
  }
});

test('billing and security failed or malformed responses offer retry instead of endless loading', () => {
  for (const [tab, name] of [['billing', 'orgBilling'], ['security', 'orgSecurity']]) {
    for (const fixture of [{ name, arg: orgScope, status: 'rejected' as const }, { name, arg: orgScope, value: {} }]) {
      const html = settings(tab, [fixture]);
      assert.match(html, /data-testid="org-read-error"/);
      assert.match(html, /Try again/);
      assert.doesNotMatch(html, /data-testid="org-read-loading"/);
    }
  }
});

test('organization audit failures are separate from a successfully loaded security panel', () => {
  const html = settings('security', [
    { name: 'orgSecurity', arg: orgScope, value: { sso: { configured: true }, admins: [], domains: [] } },
    { name: 'orgAudit', arg: { ...orgScope, limit: 50 }, status: 'rejected' },
  ]);
  assert.match(html, /data-testid="org-settings-security"/);
  assert.match(html, /data-testid="org-read-error"/);
  assert.doesNotMatch(html, /No audit/);
});

test('organization details and settings never show another account cached profile', () => {
  const old = { ...orgFixture, arg: { ...orgScope, identity: 'other-account' }, value: { org: { ...studio, name: 'Former account secret organization' } } };
  for (const [Page, path, route] of [[OrgPage, '/org/studio', '/org/:id'], [OrgSettingsPage, '/org/studio/settings', '/org/:id/settings']] as const) {
    const html = render(Page, [...appAccount, old], path, route);
    assert.doesNotMatch(html, /Former account secret organization|data-testid="org-settings-general"|data-testid="org-agents-empty"/);
  }
  const signedOutSettings = render(OrgSettingsPage, [...signedOut, old], '/org/studio/settings?tab=members#pending', '/org/:id/settings');
  assert.match(signedOutSettings, /href="\/signing\?next=%2Forg%2Fstudio%2Fsettings%3Ftab%3Dmembers%23pending"/);
  assert.doesNotMatch(signedOutSettings, /not found/i);
});

test('join requests are only offered when the server allows them', () => {
  for (const can_request of [false, true]) {
    const html = render(OrgPage, [...appAccount, { name: 'org', arg: orgScope, status: 'rejected', errorStatus: 403, errorData: { error: { code: 'not_member' }, org: studio, can_request } }], '/org/studio', '/org/:id');
    assert.match(html, /data-testid="org-not-member"/);
    assert.equal(html.includes('data-testid="org-request-join"'), can_request);
  }
});

test('invite outages are retryable and do not render a stale acceptance button or claim expiry', () => {
  const peek = { org: { id: 'studio', name: 'Current studio' }, role: 'read' };
  const unavailable = render(OrgJoinPage, [...appAccount, { name: 'peekOrgInvite', arg: 'fixture-invite', value: peek, status: 'rejected' }], '/org/join/fixture-invite', '/org/join/:token');
  assert.match(unavailable, /Try again/);
  assert.doesNotMatch(unavailable, /data-testid="org-join-invalid"|data-testid="org-join-accept"/);
  const absent = render(OrgJoinPage, [...appAccount, { name: 'peekOrgInvite', arg: 'fixture-invite', status: 'rejected', errorStatus: 404 }], '/org/join/fixture-invite', '/org/join/:token');
  assert.match(absent, /data-testid="org-join-invalid"/);
  const otherToken = render(OrgJoinPage, [...appAccount, { name: 'peekOrgInvite', arg: 'old-invite', value: peek }], '/org/join/new-invite', '/org/join/:token');
  assert.doesNotMatch(otherToken, /Current studio|data-testid="org-join-accept"/);
});

test('organization creation blocks unavailable domain reads, keeps retry separate from submit, and excludes another account', () => {
  const available = { orgs: [], signed_in: true, email_domain: 'studio.example', domain_org: null };
  for (const fixture of [
    { name: 'myOrgs', arg: accountIdentity, status: 'pending' as const },
    { name: 'myOrgs', arg: accountIdentity, value: available, status: 'rejected' as const },
    { name: 'myOrgs', arg: accountIdentity, value: {} },
    { name: 'myOrgs', arg: 'different-account', value: available },
  ]) {
    const html = render(OrgCreatePage, [...appAccount, fixture], '/org/new');
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="org-new-submit"/);
    assert.doesNotMatch(html, /data-testid="org-new-claim"|Signed in with a wallet|studio\.example/);
    if (fixture.status === 'rejected' || fixture.value && fixture.arg === accountIdentity) {
      assert.match(html, /data-testid="org-read-error"/);
      assert.match(html, /<button[^>]*type="button"[^>]*>Try again<\/button>/);
    }
  }
});

test('domain membership is explicit opt-in and uses server identity metadata for every sign-in provider', () => {
  const html = render(OrgCreatePage, [...appAccount, { name: 'myOrgs', arg: accountIdentity,
    value: { orgs: [], signed_in: true, email_domain: 'studio.example', domain_org: null } }], '/org/new');
  assert.match(html, /Everyone who signs in with @studio\.example/);
  const checkbox = html.match(/<input[^>]*data-testid="org-new-claim"[^>]*>/)?.[0];
  assert.ok(checkbox);
  assert.doesNotMatch(checkbox, /checked=""/);
  assert.doesNotMatch(html.match(/<button[^>]*data-testid="org-new-submit"[^>]*>/)![0], /disabled=""/);
});

test('organizations without a domain stay creatable and do not misidentify the account as a wallet', () => {
  for (const [email_domain, domain_org] of [[null, null], ['studio.example', 'existing']] as const) {
    const html = render(OrgCreatePage, [...appAccount, { name: 'myOrgs', arg: accountIdentity,
      value: { orgs: [], signed_in: true, email_domain, domain_org } }], '/org/new');
    assert.doesNotMatch(html, /data-testid="org-new-claim"|Signed in with a wallet/);
    assert.doesNotMatch(html.match(/<button[^>]*data-testid="org-new-submit"[^>]*>/)![0], /disabled=""/);
  }
});

test('unknown invitation roles show recovery rather than an invented read permission and Join action', () => {
  const html = render(OrgJoinPage, [...appAccount, { name: 'peekOrgInvite', arg: 'fixture-invite',
    value: { org: { id: 'studio', name: 'Studio' }, role: 'unknown' } }], '/org/join/fixture-invite', '/org/join/:token');
  assert.match(html, /data-testid="org-read-error"/);
  assert.doesNotMatch(html, /data-testid="org-join-accept"|You are invited/);
});

test('malformed organization lists offer recovery rather than claiming no memberships', () => {
  const html = render(OrgsPage, [...appAccount, { name: 'myOrgs', arg: accountIdentity, value: {} }], '/org');
  assert.match(html, /data-testid="org-read-error"/);
  assert.doesNotMatch(html, /data-testid="orgs-empty"/);
});

test('an explicit organization agent URL does not fall back to a different organization', () => {
  const html = render(ExplorePage, [...appAccount,
    { name: 'myOrgs', arg: accountIdentity, value: { orgs: [studio], signed_in: true } }, orgFixture,
    { name: 'org', arg: { id: 'requested-org', identity: accountIdentity }, status: 'rejected', errorStatus: 403 },
    { name: 'agents', value: { agents: [] } },
  ], '/explore?kind=agent&agents=org&org=requested-org');
  assert.match(html, /href="\/agent\/new\?org=requested-org"/);
  assert.doesNotMatch(html, /href="\/agent\/new\?org=studio"|href="\/org\/studio"/);
  assert.match(html, /data-testid="agents-scope-error"/);
  assert.match(html, /Try again/);
});

const rootProject = { id: 'root-project', org: 'studio', repoName: 'mono', repo: 'https://aindrive.ainetwork.ai/studio/git/mono', name: 'Root-only project', branch: 'main', kind: 'service', status: 'ready', sourcePath: '', canOperate: true, canManage: true, createdAt: 1, updatedAt: 1 } as Project;
const folderProject = { ...rootProject, id: 'folder-project', sourcePath: 'worker', name: 'Selected worker project' };
const projectArg = { id: rootProject.id, identity: accountIdentity };
const byName: Fixture = { name: 'projectByName', arg: { org: 'studio', repo: 'mono', identity: accountIdentity }, value: rootProject };

test('explicit folder selection waits for its list and never renders the root on failure or absence', () => {
  const orgArg = { org: 'studio', identity: accountIdentity };
  for (const fixture of [
    { name: 'orgProjects', arg: orgArg, status: 'pending' as const },
    { name: 'orgProjects', arg: orgArg, status: 'rejected' as const },
    { name: 'orgProjects', arg: orgArg, value: { org: 'studio', projects: [rootProject] } },
  ]) {
    const html = render(ProjectByNamePage, [...appAccount, byName, fixture], '/studio/mono?project=worker', '/:org/:repo');
    assert.doesNotMatch(html, /Root-only project|Rotate webhook secret/);
    if (fixture.status !== 'pending') assert.match(html, /Try again/);
    if (!fixture.status) assert.match(html, /data-testid="project-selection-unavailable"/);
  }
});

test('folder selection reads and displays the selected project rather than root permissions and history', () => {
  const html = render(ProjectByNamePage, [...appAccount, byName,
    { name: 'orgProjects', arg: { org: 'studio', identity: accountIdentity }, value: { org: 'studio', projects: [rootProject, folderProject] } },
    { name: 'project', arg: { id: folderProject.id, identity: accountIdentity }, value: folderProject },
    { name: 'projectDeployments', arg: { id: folderProject.id, identity: accountIdentity }, value: { deployments: [] } },
  ], '/studio/mono?project=worker', '/:org/:repo');
  assert.match(html, /Selected worker project/);
  assert.doesNotMatch(html, /Root-only project/);
});

test('My projects distinguishes failed reads from empty and excludes another account cache', () => {
  for (const fixture of [{ name: 'myProjects', arg: accountIdentity, status: 'rejected' as const }, { name: 'myProjects', arg: accountIdentity, value: {} }]) {
    const html = render(MyProjectsPage, [...appAccount, fixture], '/me/projects');
    assert.match(html, /role="alert"/); assert.match(html, /Try again/);
    assert.doesNotMatch(html, /No projects yet/);
  }
  const old = render(MyProjectsPage, [...appAccount, { name: 'myProjects', arg: 'former-account', value: { projects: [{ ...rootProject, repoName: 'former-private-repo' }] } }], '/me/projects');
  assert.doesNotMatch(old, /former-private-repo|No projects yet/);
});

test('failed project permission refresh hides cached management controls', () => {
  const Page = () => createElement(ProjectConsole, { project: rootProject });
  const html = render(Page, [...appAccount, { name: 'project', arg: projectArg, value: rootProject, status: 'rejected', errorStatus: 403 }], '/studio/mono?tab=settings');
  assert.match(html, /role="alert"/); assert.match(html, /Try again/);
  assert.doesNotMatch(html, /Root-only project|Rotate webhook secret|domains.hostname/);
});

test('environment variable and domain denial cannot leave cached private editors active', () => {
  const Env = () => createElement(ProjectEnvVars, { project: rootProject });
  const env = render(Env, [...appAccount, { name: 'projectSecrets', arg: projectArg, value: { secrets: [{ name: 'PREVIOUS_SECRET' }], declared: [], missing: [] }, status: 'rejected', errorStatus: 403, errorData: { error: { code: 'not_writer' } } }], '/studio/mono?tab=settings');
  assert.doesNotMatch(env, /PREVIOUS_SECRET/);
  const failed = render(Env, [...appAccount, { name: 'projectSecrets', arg: projectArg, status: 'rejected' }], '/studio/mono?tab=settings');
  assert.match(failed, /Try again/);
  const Domains = () => createElement(ProjectDomains, { projectId: rootProject.id });
  const domains = render(Domains, [...appAccount, { name: 'projectDomains', arg: projectArg, value: { domains: [{ hostname: 'former-private.example', status: 'ready' }] }, status: 'rejected', errorStatus: 403 }], '/studio/mono?tab=settings');
  assert.doesNotMatch(domains, /former-private.example/);
  assert.match(domains, /Try again/);
  assert.match(domains, /<button[^>]*disabled=""/);
});

test('repository-list failures preserve known project rows without claiming the list is empty or complete', () => {
  const arg = { org: 'studio', identity: accountIdentity };
  for (const projects of [[], [rootProject]]) {
    const html = render(OrgRepositoriesPage, [...appAccount,
      { name: 'orgProjects', arg, value: { org: 'studio', projects } },
      { name: 'orgRepositories', arg, status: 'rejected' },
    ], '/studio', '/:org');
    assert.match(html, /Could not load repositories/); assert.match(html, /Try again/);
    if (projects.length) assert.match(html, /href="\/studio\/mono"/);
    assert.doesNotMatch(html, /No repositories/);
  }
});

test('organization Visit links only use the active deployment, never an unrelated successful build', () => {
  const arg = { org: 'studio', identity: accountIdentity };
  const lastDeployment = { id: 'latest-build', sha: 'latest', status: 'ready', outputUrl: 'https://latest-build.example', createdAt: 1 } as Deployment;
  for (const activeDeploymentId of ['latest-build', 'rolled-back-build']) {
    const html = render(OrgRepositoriesPage, [...appAccount,
      { name: 'orgProjects', arg, value: { org: 'studio', projects: [{ ...rootProject, activeDeploymentId, lastDeployment }] } },
      { name: 'orgRepositories', arg, value: { repositories: [] } },
    ], '/studio', '/:org');
    assert.match(html, /href="\/studio\/mono"/, 'the project console is always reachable');
    if (activeDeploymentId === lastDeployment.id) assert.match(html, /href="https:\/\/latest-build.example"/);
    else assert.doesNotMatch(html, /href="https:\/\/latest-build.example"/);
  }
});

test('malformed project and repository lists show recovery instead of an empty list or another folder', () => {
  const arg = { org: 'studio', identity: accountIdentity };
  const folder = render(ProjectByNamePage, [...appAccount, byName,
    { name: 'orgProjects', arg, value: { org: 'studio', projects: {} } },
  ], '/studio/mono?project=worker', '/:org/:repo');
  assert.match(folder, /Try again/);
  assert.doesNotMatch(folder, /Root-only project|project-selection-unavailable/);
  for (const fixture of [
    { name: 'orgProjects', arg, value: { org: 'studio', projects: {} } },
    { name: 'orgRepositories', arg, value: { repositories: {} } },
  ]) {
    const html = render(OrgRepositoriesPage, [...appAccount,
      { name: 'orgProjects', arg, value: { org: 'studio', projects: [] } },
      fixture,
    ], '/studio', '/:org');
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /No repositories/);
  }
});

const chatTeachPolicy: Fixture = { name: 'teachPolicy', value: { enabled: true, trainer: 'ready', timing: { simulated: true }, queue: { depth: 0 }, limits: { facts_per_job: 8 }, shares: { contributor: 0.7, lineage: 0.3 }, model: { id_M: 'fixture' } } };
test('chat keeps unavailable selected knowledge visible and prevents an unintended base-model send', () => {
  const fixtures: Fixture[] = [...signedOut, chatTeachPolicy,
    { name: 'chatPatches', arg: '', value: { items: [], lessons: [], runtime: { available: true, model: 'fixture' }, lock: null } },
  ];
  const html = render(ChatPage, fixtures, '/chat/missing-knowledge?q=Keep+this+question', '/chat/:patchId');
  assert.match(html, /missing-knowledge/);
  assert.match(html, /Try again/);
  assert.match(html, /<textarea[^>]*disabled=""/);
  assert.match(html, /Keep this question/);
  const base = render(ChatPage, fixtures, '/chat?q=Keep+this+question', '/chat');
  assert.doesNotMatch(base, /<textarea[^>]*disabled=""/, 'explicitly opening the plain model still allows chat');
});

test('chat refresh failure is visible and disables sending even with a retained catalog', () => {
  const html = render(ChatPage, [...signedOut, chatTeachPolicy,
    { name: 'chatPatches', arg: '', value: { items: [], lessons: [], runtime: { available: true, model: 'fixture' }, lock: null }, status: 'rejected' },
  ], '/chat?q=Keep+this+question', '/chat');
  assert.match(html, /role="alert"/); assert.match(html, /Try again/);
  assert.match(html, /<textarea[^>]*disabled=""/);
  assert.doesNotMatch(html, /This node knows nothing/);
});

test('chat restores only this account draft and transcript and leaves another account storage intact', () => {
  const originals = ['localStorage', 'sessionStorage'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  for (const name of ['localStorage', 'sessionStorage']) {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, name, { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null,
    } });
  }
  try {
    const owner = chatStorageOwner(accountIdentity, '');
    const other = chatStorageOwner('another-account', '');
    const turn = { id: 'one', prompt: 'Current conversation', mode: 'base', thinking: false, status: 'error', error: 'Fixture error', patchIds: [] };
    saveTurns([turn, { ...turn, id: 'pending', status: 'pending' }], owner);
    saveTurns([{ ...turn, prompt: 'Other private conversation' }], other);
    saveComposerDraft('Current unsent question', owner);
    saveComposerDraft('Other private draft', other);
    saveStack(['one', 'two'], owner);
    localStorage.setItem(`${BASKET_PREFIX}legacy`, JSON.stringify({ facts: [{ prompt: 'Unowned legacy question', answer: 'Unowned legacy answer' }], builds_on: false }));
    sessionStorage.setItem('ainize.chat.turns', JSON.stringify([{ ...turn, prompt: 'Unowned legacy conversation' }]));
    assert.deepEqual(loadStack(other), []);
    assert.deepEqual(loadStack(owner), ['one', 'two']);
    assert.equal(loadTurns(owner).length, 1, 'pending calls are not restored');
    const catalog: Fixture = { name: 'chatPatches', arg: '', value: { items: [], lessons: [], runtime: { available: true, model: 'fixture' }, lock: null } };
    const html = render(ChatPage, [...appAccount, chatTeachPolicy, catalog], '/chat');
    assert.match(html, /Current conversation/); assert.match(html, /Current unsent question/);
    assert.match(html, /data-testid="legacy-draft-recovery"/);
    assert.match(html, /Download older drafts/);
    assert.doesNotMatch(html, /Other private|Unowned legacy question|Unowned legacy answer|Unowned legacy conversation/);
    const anonymous = render(ChatPage, [...signedOut, chatTeachPolicy, catalog], '/chat');
    assert.doesNotMatch(anonymous, /Current conversation|Current unsent question|Other private/);
    assert.equal(loadComposerDraft(other), 'Other private draft');
    assert.equal(loadTurns(other).length, 1);
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});


const editableHosted = { id: 'chosen', name: 'Chosen private draft', owner: 'sso:viewer', mode: 'prompt', model: 'chat', systemPrompt: 'Private prompt', can_manage: true };
const editorArg = { id: 'chosen', identity: accountIdentity };

test('agent editors never expose another account cached draft and preserve the full sign-in destination', () => {
  for (const [Page, endpoint, path] of [[AgentCreatePage, 'hostedAgent', '/agent/chosen/edit'], [AgentLinkPage, 'linkedAgent', '/agent/chosen/link']] as const) {
    const fixture = { name: endpoint, arg: { ...editorArg, identity: 'other-account' }, value: { agent: editableHosted } };
    const html = render(Page, [...appAccount, fixture], path, path.replace('/chosen/', '/:id/'));
    assert.doesNotMatch(html, /Chosen private draft|Private prompt|data-testid="agent-(?:create|link)-form"/);
    const signed = render(Page, [...signedOut, fixture], path + '?org=studio#section', path.replace('/chosen/', '/:id/'));
    assert.ok(signed.includes(encodeURIComponent(path + '?org=studio#section')), 'sign-in keeps the editor destination');
  }
});

test('agent edit refuses listing-only, denied, mismatched and failed reads with recovery', () => {
  for (const fixture of [
    { value: { agent: { ...editableHosted, can_manage: false } } },
    { value: { agent: { ...editableHosted, id: 'different' } } },
    { value: { agent: editableHosted }, status: 'rejected' as const },
  ]) {
    const html = render(AgentCreatePage, [...appAccount, { name: 'hostedAgent', arg: editorArg, ...fixture }], '/agent/chosen/edit', '/agent/:id/edit');
    assert.match(html, /agent-edit-unavailable/);
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /agent-create-form|Private prompt/);
  }
  const linked = render(AgentLinkPage, [...appAccount, { name: 'linkedAgent', arg: editorArg, value: { agent: { ...privateLinked, id: 'chosen', upstream: null } } }], '/agent/chosen/link', '/agent/:id/link');
  assert.match(linked, /agent-link-unavailable/);
  assert.match(linked, /Try again/);
  assert.doesNotMatch(linked, /agent-link-form/);
});

test('agent creation respects closed organization requests and failed organization reads', () => {
  const denied = { status: 'rejected' as const, errorStatus: 403, errorData: { error: { code: 'not_member' }, can_request: false, org: { id: 'studio', name: 'Studio' } } };
  const fixture = { name: 'org', arg: { id: 'studio', identity: accountIdentity }, ...denied };
  const html = render(AgentCreatePage, [...appAccount, fixture], '/agent/new?org=studio');
  assert.match(html, /agent-create-request-access/);
  assert.doesNotMatch(html, /agent-create-form|<input|<button/);
  const failed = render(AgentCreatePage, [...appAccount, { ...fixture, errorStatus: 503, errorData: 'unavailable' }], '/agent/new?org=studio');
  assert.match(failed, /Could not load organization information|Try again/);
  assert.doesNotMatch(failed, /agent-create-form/);
});

function renderAgent(fixtures: Fixture[], path = '/agent/chosen') {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://ainize.ai' } } });
  try { return render(AgentPage, fixtures, path, '/agent/:id'); }
  finally { if (before) Object.defineProperty(globalThis, 'window', before); else Reflect.deleteProperty(globalThis, 'window'); }
}
const detailAgent = { id: 'chosen', name: 'Chosen agent', description: 'Only this agent', protocols: [], skills: [], extensions: [], provider: null, documentation_url: null, a2a_url: 'https://ainize.ai/agents/chosen', card_url: 'https://ainize.ai/agents/chosen/card', reachable: true, last_checked: null, error: null, calls: 0, last_call_at: null, node: null };

test('agent detail offers explicit form discovery without unrelated hosted management panels', () => {
  const html = renderAgent([...appAccount, { name: 'agents', value: { agents: [detailAgent] } }]);
  assert.match(html, /Chosen agent|Ask agent for an input form/);
  assert.doesNotMatch(html, /hosted-agent-owner|agent-git-panel|ainft-binding/);
  const peer = renderAgent([...appAccount, { name: 'agents', value: { agents: [{ ...detailAgent, kind: 'prompt', owner: 'sso:viewer', node: { name: 'Peer', address: 'https://peer.example' } }] } }, { name: 'manageableHostedAgents', arg: accountIdentity, value: { agents: [{ ...editableHosted, can_delete: true }] } }], '/agent/chosen?node=https%3A%2F%2Fpeer.example');
  assert.match(peer, /Chosen agent|Ask agent for an input form/);
  assert.doesNotMatch(peer, /hosted-agent-owner|hosted-agent-edit|agent-git-panel/);
});

test('failed private-agent lookup offers retry, never false not-found or a cached private result', () => {
  const base: Fixture[] = [...appAccount, { name: 'agents', value: { agents: [] } }];
  const alias: Fixture = { name: 'agentAlias', arg: { name: 'chosen', identity: accountIdentity }, value: { id: 'chosen' } };
  const html = renderAgent([...base, { ...alias, status: 'rejected' }]);
  assert.match(html, /agent-detail-failed/); assert.match(html, /Try again/);
  assert.doesNotMatch(html, /No agent called|Only this agent/);
  const hosted = renderAgent([...base, alias, { name: 'hostedAgent', arg: editorArg, value: { agent: editableHosted }, status: 'rejected' }]);
  assert.match(hosted, /agent-detail-failed/);
  assert.doesNotMatch(hosted, /Chosen private draft|No agent called/);
});

test('another account private-agent lookup cache cannot resolve the selected route', () => {
  const html = renderAgent([...appAccount, { name: 'agents', value: { agents: [] } },
    { name: 'agentAlias', arg: { name: 'chosen', identity: 'other-account' }, value: { id: 'chosen' } },
    { name: 'hostedAgent', arg: { id: 'chosen', identity: 'other-account' }, value: { agent: editableHosted } }]);
  assert.doesNotMatch(html, /Chosen private draft|Private prompt|No agent called/);
});


const historyPage = () => createElement(AgentHistoryPanel, { agentId: 'chosen' });
const historyRefs = { head: 'release', branches: [{ name: 'release', sha: 'live' }, { name: 'proposal', sha: 'change' }], clone_url: 'https://example.invalid/chosen.git' };
const historyFixtures: Fixture[] = [
  ...appAccount,
  { name: 'agentRefs', arg: editorArg, value: historyRefs },
  { name: 'agentCommits', arg: { ...editorArg, ref: 'live', limit: 20 }, value: { commits: [{ sha: 'live', short: 'live', subject: 'Current private history', author: 'Viewer', at: 1, email: '', body: '' }], clone_url: historyRefs.clone_url } },
  { name: 'agentPulls', arg: editorArg, value: { pulls: [] } },
  { name: 'agentExecutions', arg: { ...editorArg, offset: 0, limit: 10 }, value: { executions: [], total: 0, limit: 10, offset: 0 } },
  { name: 'myAgentForks', arg: accountIdentity, value: { forks: [] } },
  { name: 'agentPreviewRuns', arg: { ...editorArg, offset: 0 }, value: { runs: [], total: 0, limit: 10, offset: 0 } },
];

test('agent history uses the real deployed branch and shows read failures with recovery', () => {
  const html = render(historyPage, historyFixtures);
  assert.match(html, /Current private history/);
  assert.match(html, /release/);
  const failed = render(historyPage, historyFixtures.map((fixture) => fixture.name === 'agentCommits' ? { ...fixture, status: 'rejected' as const } : fixture));
  assert.match(failed, /agent-history/); assert.match(failed, /Could not load this information/);
  assert.match(failed, /Try again/); assert.doesNotMatch(failed, /Current private history|No commits yet/);
});

test('unavailable branch inventory never guesses main or offers executable preview controls', () => {
  for (const status of ['pending', 'rejected'] as const) {
    const fixtures = historyFixtures.map((fixture) => fixture.name === 'agentRefs' ? { ...fixture, value: undefined, status } : fixture);
    const html = render(historyPage, fixtures);
    assert.doesNotMatch(html, /Current private history|No commits yet|Start preview/);
    assert.match(html, status === 'pending' ? /Loading history/ : /Try again/);
  }
});

test('another account cannot reuse agent history, forks, executions or preview records', () => {
  const old = historyFixtures.map((fixture) => fixture.arg === accountIdentity ? { ...fixture, arg: 'other-account' } : fixture.arg && typeof fixture.arg === 'object' && 'identity' in fixture.arg ? { ...fixture, arg: { ...fixture.arg, identity: 'other-account' } } : fixture);
  const html = render(historyPage, old);
  assert.doesNotMatch(html, /Current private history|example.invalid\/chosen.git/);
  assert.match(html, /Loading history/);
});

const previewRecord = { id: 'record-one', previewId: 'preview-one', agent: 'chosen', owner: 'sso:viewer', commit: '1234567890', model: 'test-model', request: { parts: [{ text: 'Current private input' }] }, output: JSON.stringify({ result: { parts: [{ text: 'Current private output' }] } }), outputBytes: 10, outputTruncated: false, status: 'ready', error: null, createdAt: 1, finishedAt: 2, exportedAt: 3 };
const previewsPage = () => createElement(AgentPreviewHistory, { agentId: 'chosen' });
const previewFixture = { name: 'agentPreviewRuns', arg: { ...editorArg, offset: 0 }, value: { runs: [previewRecord], total: 1, limit: 10, offset: 0 } };

test('preview records hide retained private results after read failure and expose retry', () => {
  const current = render(previewsPage, [...appAccount, previewFixture]);
  assert.match(current, /Current private input/); assert.match(current, /Current private output/);
  const failed = render(previewsPage, [...appAccount, { ...previewFixture, status: 'rejected' }]);
  assert.match(failed, /Could not load preview records/); assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /Current private input|Current private output|No records on this page/);
  const other = render(previewsPage, [...appAccount, { ...previewFixture, arg: { ...previewFixture.arg, identity: 'other-account' } }]);
  assert.doesNotMatch(other, /Current private input|Current private output/);
  assert.match(other, /Loading records/);
});


test('A2UI read-only fields are disabled and action-only buttons remain usable', () => {
  const surface = { surfaceId: 'form', data: { value: 'Existing input' }, components: new Map([
    ['root', { id: 'root', component: 'Column', children: ['input', 'button'] }],
    ['input', { id: 'input', component: 'TextField', label: 'Input', value: { path: '/value' } }],
    ['button', { id: 'button', component: 'Button', text: 'Refresh now', action: { event: { name: 'refresh', context: {} } } }],
  ]) };
  const passive = render(() => createElement(A2UISurface, { surface }), signedOut);
  assert.match(passive, /<input[^>]*disabled/); assert.match(passive, /<button[^>]*disabled/);
  const active = render(() => createElement(A2UISurface, { surface, onAction: () => {} }), signedOut);
  assert.doesNotMatch(active, /<input[^>]*disabled|<button[^>]*disabled/);
  assert.match(active, /Refresh now/);
  const busy = render(() => createElement(A2UISurface, { surface, onAction: () => {}, busy: true }), signedOut);
  assert.match(busy, /<button[^>]*disabled/);
});

test('A2UI multiple selections and scoped list values render the actual bound choices', () => {
  const surface = readUiSurface([{ kind: 'data', metadata: { mimeType: 'application/a2ui+json' }, data: [
    { createSurface: { surfaceId: 'form' } },
    { updateComponents: { surfaceId: 'form', components: [
      { id: 'root', component: 'Column', children: ['choices', 'list'] },
      { id: 'choices', component: 'ChoicePicker', variant: 'multipleSelection', label: 'Options', value: { path: '/selected' }, options: [{ label: 'First option', value: 'one' }, { label: 'Second option', value: 'two' }] },
      { id: 'list', component: 'List', children: { template: { dataPath: '/rows', componentId: 'row' } } },
      { id: 'row', component: 'TextField', label: 'Row', value: { path: 'name' } },
    ] } },
    { updateDataModel: { surfaceId: 'form', value: { selected: ['two'], rows: [{ name: 'First row value' }, { name: 'Second row value' }] } } },
  ] }])!;
  const html = render(() => createElement(A2UISurface, { surface, onAction: () => {} }), signedOut);
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 2);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);
  assert.match(html, /value="First row value"/); assert.match(html, /value="Second row value"/);
  assert.doesNotMatch(html, /unsupported ChoicePicker/);
});


test('agent detail retains the selected peer with colliding local ids and unavailable peer states', () => {
  const peer = { ...detailAgent, name: 'Selected remote agent', description: 'Only selected peer', node: { address: 'peer-one', name: 'Selected peer node' }, call_url: 'https://ainize.ai/api/sam/peer-one/a2a/chosen' };
  const wrong = { ...peer, name: 'Different remote agent', node: { address: 'peer-two', name: 'Different peer node' } };
  const fixtures: Fixture[] = [...appAccount, { name: 'agents', value: { agents: [detailAgent, wrong, peer] } }];
  const chosen = renderAgent(fixtures, '/agent/chosen?node=peer-one');
  assert.match(chosen, /Selected remote agent/); assert.match(chosen, /sam\/peer-one\/a2a\/chosen/);
  assert.doesNotMatch(chosen, /Chosen agent|Different remote agent|hosted-agent-owner/);
  assert.ok(!chosen.includes('https://ainize.ai/agents/chosen'), 'peer endpoints must not use the short local registration');
  const local = renderAgent(fixtures);
  assert.match(local, /Chosen agent/); assert.doesNotMatch(local, /Selected remote agent|Different remote agent/);
  for (const search of ['?node=missing', '?node=', '?node=peer-one&node=peer-two']) {
    const missing = renderAgent(fixtures, '/agent/chosen' + search);
    assert.match(missing, /agent-detail-unavailable|Try again/);
    assert.doesNotMatch(missing, /Ask agent for an input form|Chosen agent|Selected remote agent|Different remote agent/);
  }
});


test('agent list and full search keep same-id peer results separate and link to the exact node', () => {
  const base = { ...detailAgent, name: 'Gallery guide' };
  const rows = [base, { ...base, node: { address: 'peer-one', name: 'Seoul' } }, { ...base, node: { address: 'peer-two', name: 'Busan' } }];
  const fixtures: Fixture[] = [...signedOut, { name: 'agents', value: { agents: rows } }, { name: 'models', value: {} }, { name: 'networkModels', value: {} }];
  const list = render(ExplorePage, fixtures, '/explore?kind=agent');
  assert.equal((list.match(/data-testid="agent-row"/g) ?? []).length, 3);
  for (const href of ['/agent/chosen', '/agent/chosen?node=peer-one', '/agent/chosen?node=peer-two']) assert.ok(list.includes(`href="${href}"`));
  const selected = render(ExplorePage, fixtures, '/explore?kind=agent&q=Seoul');
  assert.equal((selected.match(/data-testid="agent-row"/g) ?? []).length, 1);
  assert.ok(selected.includes('href="/agent/chosen?node=peer-one"'));
  assert.ok(!selected.includes('href="/agent/chosen?node=peer-two"'));
  const search = render(SearchPage, fixtures, '/search?q=guide');
  for (const href of ['/agent/chosen', '/agent/chosen?node=peer-one', '/agent/chosen?node=peer-two']) assert.ok(search.includes(`href="${href}"`));
  assert.match(search, /Seoul/); assert.match(search, /Busan/);
});


test('AINFT binding reads show recovery, isolate accounts and distinguish explicit unbound agents', () => {
  const binding = { agentId: 'chosen', chainId: 0, objectId: '0x' + 'b'.repeat(40), tokenId: 'private-token', release: 3, verifiedAt: 1000, communityVersion: 0, community: null };
  const arg = { id: 'chosen', identity: accountIdentity };
  const Page = () => createElement(AinftBindingPanel, { agentId: 'chosen' });
  const current = render(Page, [...appAccount, { name: 'ainftBinding', arg, value: { binding } }]);
  assert.match(current, /Linked AINFT|private-token/);
  const failed = render(Page, [...appAccount, { name: 'ainftBinding', arg, value: { binding }, status: 'rejected' }]);
  assert.match(failed, /ainft-binding-failed/); assert.match(failed, /Try again/); assert.doesNotMatch(failed, /private-token/);
  const other = render(Page, [...appAccount, { name: 'ainftBinding', arg: { ...arg, identity: 'other-account' }, value: { binding } }]);
  assert.doesNotMatch(other, /private-token/); assert.match(other, /Checking AINFT connection/);
  const empty = render(Page, [...appAccount, { name: 'ainftBinding', arg, value: { binding: null } }]);
  assert.doesNotMatch(empty, /ainft-binding|Checking AINFT connection|Try again/);
});

test('agent editors and organization admins do not receive creator-only NFT registration controls', () => {
  for (const canAdminister of [false, true]) {
    const html = render(() => createElement(HostedAgentOwnerPanel, { agentId: 'chosen', agentName: 'Agent', canAdminister, isCreator: false }), appAccount);
    assert.match(html, /hosted-agent-edit/);
    assert.doesNotMatch(html, /ainft-registration|ainft-community/);
  }
  const owner = render(() => createElement(HostedAgentOwnerPanel, { agentId: 'chosen', agentName: 'Agent', isCreator: true }), appAccount);
  assert.match(owner, /ainft-registration/); assert.match(owner, /ainft-community/);
});


test('holder credit actions stay disabled while parent work runs and ordinary accounts see the holder sign-in path', () => {
  const props = { agentId: 'chosen', address: '0x' + 'a'.repeat(40), userId: 'holder-user', text: (_ko: string, en: string) => en, disabled: true };
  for (const Panel of [AinftBenefitsPanel, AinftRewardsPanel]) {
    const html = render(() => createElement(Panel, props), appAccount);
    assert.match(html, /<button[^>]*disabled=""/);
    assert.doesNotMatch(html, /Refund unused purchase|Buy one with credits|Connect this reward account/);
  }
  const workspace = render(() => createElement(AinftCompanionPanel, { agentId: 'chosen' }), appAccount);
  assert.match(workspace, /Sign in with the holder wallet/);
  assert.ok(workspace.includes('next=%2Fagent%2Fchosen'));
  assert.doesNotMatch(workspace, /Send message|Assign work|Train selected examples/);
});
