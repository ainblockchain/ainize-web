import { KeyRevocationNotice } from '../src/components/KeyRevocationNotice';
import { KeyCreationNotice } from '../src/components/KeyCreationNotice';
import { issuedKeyScope } from '../src/screens/models/issuedKeyMemory';
import { PurchaseReviewSheet } from '../src/components/detail/PurchaseReview';
import { reconciliationFixture } from './purchase-reconciliation-fixture';
import { RequestKnowledgeFeedback } from '../src/components/chat/RequestKnowledge';
import { demandFixture } from './knowledge-demand-fixture';
import { purchaseReviewFixture, purchaseRequestFixture } from './purchase-review-fixture';
const purchaseSheetProps = () => ({ review: null, request: null, busy: false, error: null, submitted: false, verified: false,
  onConfirm() {}, onRefresh() {}, onInspect() {}, onClose() {}, onDone() {} });
import { purchaseFixture } from './fixtures/purchase';
import { TrackAdditionSheet } from '../src/components/operator/TrackAdditionForm';
import { additionFixture } from './track-addition-fixture';
import { runtimeReviewFixture } from './fixtures/runtimeReview';
import { RuntimeApplyReview } from '../src/components/detail/RuntimeApplyReview';
import { ManagePublication } from '../src/components/operator/ManagePublication';
import PatchPage, { Verification, PurchaseTimeline } from '../src/screens/PatchPage';
import { CollectKnowledge } from '../src/components/detail/CollectKnowledge';
import { PatchListItem, useVerificationLabel } from '../src/components/public/PatchListItem';
import { ManageDraftConflict } from '../src/components/operator/ManageDraftConflict';
import { manageDraftEditor } from '../src/lib/manageDraft';
import ManagePage from '../src/screens/ManagePage';
import { manageFixture } from './fixtures/manageKnowledge';
import { AccountOwners, AccountBindings } from '../src/components/operator/AccountAccess';
import { AccountPeers } from '../src/components/operator/AccountPeers';
import { AccountRuntime } from '../src/components/operator/AccountRuntime';
import { TrackActionFeedback, TrackCard } from '../src/components/operator/TrackCard';
import { TrackReviewSheet } from '../src/components/operator/TrackReviewSheet';
import { trackReviewFixture } from './track-review-fixture';
import { AccountSettings } from '../src/components/operator/AccountSettings';
import AccountPage from '../src/screens/AccountPage';
import { newPatchDraftKey } from '../src/lib/newPatchDraft';
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
import { ProjectByNamePage, ProjectConsole, ProjectRunInput, ProjectRunPanel, RuntimeLogView } from '../src/screens/ProjectPage';
import OrgRepositoriesPage from '../src/screens/OrgRepositoriesPage';
import ProjectEnvVars, { DeployWatch, MissingEnvBanner } from '../src/components/ProjectEnvVars';
import ProjectDomains from '../src/components/ProjectDomains';
import type { Deployment, Project } from '../src/api/projects';
import { SignOutNotice } from '../src/components/ui/SignOutNotice';
import { Header } from '../src/components/ui/Header';
import MyPage from '../src/screens/MyPage';
import ModelsPage from '../src/screens/ModelsPage';
import ModelDetailPage from '../src/screens/ModelDetailPage';
import { ModelPlaygroundPanel } from '../src/screens/models/ModelPlaygroundPanel';
import { CopyButton, SelectBox } from '../src/components/ui/Misc';
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

import LogsPage from '../src/screens/LogsPage';
import { NodeLogs } from '../src/screens/NodeLogsPage';
import { EventLog } from '../src/components/operator/EventLog';
import { trackAuthor } from './fixtures/track';
import { VerificationWork } from '../src/components/operator/VerificationWork';
import { DashboardContent } from '../src/screens/DashboardPage';
import { RuntimeOperationStatus } from '../src/components/detail/RuntimeOperationStatus';
import { VerificationAction, VerificationResult } from '../src/components/detail/VerificationAction';
import { prepareRuntimeOperation } from '../src/lib/runtimeOperation';
import { dashboardEntry, dashboardAttest, verificationPayment } from './fixtures/dashboard';
import { BenchmarkCoverage } from '../src/components/detail/BenchmarkCoverage';
import { PatchListItem } from '../src/components/public/PatchListItem';
import { KnowledgePicker } from '../src/components/chat/KnowledgePicker';
import NewPatchPage from '../src/screens/NewPatchPage';
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

const verificationFixtures: Fixture[] = [
  { name: 'ledger', arg: { kind: 'attest', limit: 5000 }, value: ledgerFixture([dashboardAttest()]) },
  { name: 'wallet', arg: { identity: '' }, value: { verification: [] } },
];
test('verification failures cannot look like zero work or zero earnings and recover independently', () => {
  const html = render(() => createElement(VerificationWork, { address: trackAuthor }), [...signedOut, ...verificationFixtures.map(f => ({ ...f, status: 'rejected' as const }))], '/dashboard');
  assert.equal((html.match(/data-testid="query-retry"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Verifications signed|No verification payment records|0 AIN/);
  const loaded = render(() => createElement(VerificationWork, { address: trackAuthor }), [...signedOut, ...verificationFixtures.map(f => f.name === 'wallet' ? { ...f, status: 'rejected' as const } : f)], '/dashboard');
  assert.match(loaded, /Verifications signed/); assert.match(loaded, /query-retry/);
  assert.doesNotMatch(loaded, /No verification payment records/);
});

test('verification card labels the returned window rather than all-time totals and retains zero-work payment records', () => {
  const fixture = ledgerFixture([]); fixture.info.records = 20000;
  const html = render(() => createElement(VerificationWork, { address: trackAuthor }), [...signedOut,
    { ...verificationFixtures[0], value: fixture },
    { ...verificationFixtures[1], value: { verification_total: '9999', verification: [verificationPayment('2', 'AIN', 'pending'), verificationPayment('3', 'USDC', 'paid', 'seller_reported')] } },
  ], '/dashboard');
  assert.match(html, /window of up to 5,000/); assert.match(html, /20,000 records across all kinds/);
  assert.match(html, /2 AIN/); assert.match(html, /Payment pending/); assert.match(html, /3 USDC/); assert.match(html, /Reported by seller/);
  assert.doesNotMatch(html, /9999|Across the whole record|Every number here is read from signed/);
});

test('verification money waits for the current account and does not infer empty values from a legacy response', () => {
  const stale = render(() => createElement(VerificationWork, { address: trackAuthor }), [...signedOut, verificationFixtures[0],
    { name: 'wallet', value: { verification: [verificationPayment('88')] } },
    { name: 'wallet', arg: { identity: 'another-owner' }, value: { verification: [verificationPayment('99')] } },
  ], '/dashboard');
  assert.doesNotMatch(stale, /88 AIN|99 AIN|No verification payment records/);
  const malformed = render(() => createElement(VerificationWork, { address: trackAuthor }), [...signedOut, verificationFixtures[0], { ...verificationFixtures[1], value: { verification_total: '0' } }], '/dashboard');
  assert.match(malformed, /query-retry/); assert.doesNotMatch(malformed, /No verification payment records/);
});

const inventoryFixtures: Fixture[] = [
  { name: 'myPatches', arg: { identity: '' }, value: { items: [dashboardEntry('selected/a?#')] } },
  { name: 'myPurchases', value: { items: [] } },
  { name: 'branches', value: { branches: [], mine: [] } },
  { name: 'runtime', value: { available: false } },
];
test('small inventories retain search and sorting, show paid sales and encode exact action destinations', () => {
  const html = render(DashboardContent, [...signedOut, ...inventoryFixtures], '/dashboard');
  assert.match(html, /dash-search/); assert.match(html, /Most sales/);
  assert.match(html, /4 declared questions/);
  const entry = dashboardEntry('legacy');
  const legacy = render(DashboardContent, [...signedOut, ...inventoryFixtures.map(f => f.name === 'myPatches' ? { ...f, value: { items: [{ ...entry, anchor: { ...entry.anchor, benchmark: { schema: 'qa', queries: [{ prompt: 'Q', expect: 'A' }, { prompt: 'Q2', expect: 'A2' }] } } }] } } : f)], '/dashboard');
  assert.match(legacy, /2 declared questions/);
  assert.match(html, /href="\/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\/selected%2Fa%3F%23"/);
  assert.match(html, /data-testid="dash-sales"[^>]*>1 ·/);
  assert.doesNotMatch(html, /data-testid="dash-sales"[^>]*>100 ·/);
});

test('inventory failures and foreign account caches do not masquerade as an empty collection', () => {
  const html = render(DashboardContent, [...signedOut, ...inventoryFixtures.map(f => f.name === 'myPatches' ? { ...f, status: 'rejected' as const } : f)], '/dashboard');
  assert.match(html, /query-retry/); assert.doesNotMatch(html, /data-testid="dash-sales"/);
  const foreign = render(DashboardContent, [...signedOut, ...inventoryFixtures.map(f => f.name === 'myPatches' ? { ...f, arg: { identity: 'other' } } : f)], '/dashboard');
  assert.doesNotMatch(foreign, /data-testid="dash-sales"|No knowledge yet/);
  const malformed = render(DashboardContent, [...signedOut, ...inventoryFixtures.map(f => f.name === 'myPatches' ? { ...f, value: { items: [{}] } } : f)], '/dashboard');
  assert.match(malformed, /query-retry/); assert.doesNotMatch(malformed, /data-testid="dash-sales"/);
});

const logRow = { seq: 1, ts: 100, level: 'warn' as const, kind: 'verify', patch_id: 'selected', message: 'Selected event message', data: null };
const logPath = `/project/${trackAuthor}/selected/logs`;
const logRoute = '/project/:author/:patchId/logs';
const knowledgeLogs: Fixture[] = [
  { name: 'patch', arg: 'selected', value: { anchor: { id: 'selected', author: trackAuthor } } },
  { name: 'patchEvents', arg: { id: 'selected', limit: 100, identity: '' }, value: { events: [logRow] } },
  { name: 'patchRecords', arg: 'selected', value: { records: [] } },
];

test('knowledge log outages are retryable and only an explicit 404 claims missing knowledge', () => {
  for (const status of [503, 403]) {
    const html = render(LogsPage, [...signedOut, ...knowledgeLogs.map(f => f.name === 'patch' ? { ...f, status: 'rejected' as const, errorStatus: status } : f)], logPath, logRoute);
    assert.match(html, /query-retry/); assert.doesNotMatch(html, /logs-notfound|Selected event message|No events for this knowledge/);
  }
  const missing = render(LogsPage, [...signedOut, { ...knowledgeLogs[0], status: 'rejected', errorStatus: 404 }], logPath, logRoute);
  assert.match(missing, /logs-notfound/); assert.doesNotMatch(missing, /event-log/);
});

test('knowledge log event and timeline failures do not present cached rows or healthy empty results', () => {
  const html = render(LogsPage, [...signedOut, ...knowledgeLogs.map(f => f.name === 'patch' ? f : { ...f, status: 'rejected' as const })], logPath, logRoute);
  assert.equal((html.match(/data-testid="query-retry"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Selected event message|No events for this knowledge|No public records returned/);
  const malformed = render(LogsPage, [...signedOut, ...knowledgeLogs, { ...knowledgeLogs[1], value: { events: [{ ...logRow, patch_id: 'other' }] } }], logPath, logRoute);
  assert.match(malformed, /query-retry/); assert.doesNotMatch(malformed, /Selected event message/);
});

test('knowledge log links resolve the returned author and an empty timeline does not invent a draft status', () => {
  const html = render(LogsPage, [...signedOut, ...knowledgeLogs], '/project/wrong-author/selected/logs', logRoute);
  assert.match(html, new RegExp(`href="/project/${trackAuthor}/selected"`));
  assert.match(html, /Selected event message/); assert.match(html, /No public records returned by this node/);
  assert.doesNotMatch(html, /still a local draft|href="\/project\/wrong-author/);
  const loading = render(LogsPage, [...signedOut, { ...knowledgeLogs[0], status: 'pending', value: undefined }], logPath, logRoute);
  assert.doesNotMatch(loading, /logs-notfound|event-log/);
});

test('node logs hide failed cached rows and retain filter and polling recovery controls', () => {
  const html = render(() => createElement(NodeLogs, { identity: '' }), [...signedOut,
    { name: 'events', arg: { limit: 200, identity: '' }, value: { events: [logRow] }, status: 'rejected' },
  ], '/logs');
  assert.match(html, /query-retry/); assert.match(html, /Follow/); assert.match(html, /All kinds/);
  assert.doesNotMatch(html, /Selected event message|nodelog-summary|Nothing logged yet/);
});

test('node logs do not reuse another account or window cache and only summarize a valid response', () => {
  const fixtures: Fixture[] = [...signedOut,
    { name: 'events', arg: { limit: 200, identity: 'old-owner' }, value: { events: [logRow] } },
    { name: 'events', arg: { limit: 100, identity: '' }, value: { events: [logRow] } },
  ];
  const loading = render(() => createElement(NodeLogs, { identity: '' }), fixtures, '/logs');
  assert.doesNotMatch(loading, /Selected event message|nodelog-summary|Nothing logged yet/);
  const valid = render(() => createElement(NodeLogs, { identity: '' }), [...signedOut,
    { name: 'events', arg: { limit: 200, identity: '' }, value: { events: [logRow] } },
  ], '/logs');
  assert.match(valid, /nodelog-summary/); assert.match(valid, /href="\/patch\/selected"/);
  assert.match(valid, /Selected event message/);
});

test('event details use native keyboard disclosures and window expansion is disabled during an active read', () => {
  const html = render(() => createElement(EventLog, { rows: [{ ...logRow, data: { detail: 'Structured details' } }, { ...logRow, seq: 2, message: 'No details' }], loading: false, fetching: true, onOlder() {}, empty: 'Empty', footer: 'Window' }), signedOut, '/logs');
  assert.equal((html.match(/<details/g) ?? []).length, 1);
  assert.equal((html.match(/<summary/g) ?? []).length, 1);
  assert.match(html, /Structured details/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Expand log window/);
});

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
  for (const label of ['Retirement', 'Price change', 'Trade dispute', 'Payout']) assert.match(html, new RegExp(`<option[^>]*>${label}</option>`));
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

test('shared filters expose one native selection control instead of invisible focusable option buttons', () => {
  const html = render(() => createElement(SelectBox, { label: 'Record kind', value: 'price', options: [{ value: '', label: 'All records' }, { value: 'price', label: 'Price change' }], onChange() {} }), signedOut);
  assert.match(html, /<select[^>]*aria-label="Record kind"/);
  assert.match(html, /<option value="price" selected="">Price change<\/option>/);
  assert.doesNotMatch(html, /role="listbox"|role="option"|<button/);
});

test('missing or disabled filter choices cannot silently select the first available option', () => {
  const options = [{ value: 'first', label: 'First option' }, { value: 'blocked', label: 'Unavailable choice', disabled: true }];
  const missing = render(() => createElement(SelectBox, { value: 'removed', options, onChange() {} }), signedOut);
  assert.match(missing, /<option value="removed" disabled="" selected="">Selected option unavailable<\/option>/);
  assert.doesNotMatch(missing, /<option value="first" selected/);
  const empty = render(() => createElement(SelectBox, { value: '', options: [], onChange() {} }), signedOut);
  assert.match(empty, /<select[^>]*disabled=""/);
  const blocked = render(() => createElement(SelectBox, { value: 'blocked', options: [options[1]], onChange() {} }), signedOut);
  assert.match(blocked, /<select[^>]*disabled=""/);
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

function renderNewBenchmark(text: string) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => key === newPatchDraftKey('', null) ? JSON.stringify({ benchText: text }) : null } });
  try { return render(NewPatchPage, [...signedOut, { name: 'catalog', arg: { limit: 200 }, value: { items: [] } }, { name: 'branches', value: { branches: [], mine: [] } }], '/new-patch'); }
  finally { if (original) Object.defineProperty(globalThis, 'sessionStorage', original); else delete (globalThis as any).sessionStorage; }
}

test('restored invalid benchmark JSON stays visible and cannot be overwritten by stale plain fields', () => {
  for (const text of ['{broken', 'null', '[]', JSON.stringify({ schema: 'selected', queries: 8, format: ['chat'], samples: [null] })]) {
    const html = renderNewBenchmark(text);
    assert.match(html, /benchmark-editor-error/); assert.match(html, /<fieldset[^>]*disabled=""/);
    assert.ok(html.includes(text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));
  }
});

test('benchmark form renders every restored sample and keeps legacy case counts read-only', () => {
  const samples = Array.from({ length: 8 }, (_, i) => ({ prompt: `Question ${i}`, expect: `Answer ${i}`, source: `parent-${i}` }));
  const html = renderNewBenchmark(JSON.stringify({ schema: 'chosen', queries: 8, format: ['chat'], samples }));
  assert.match(html, /value="Question 7"/); assert.match(html, /parent-7/);
  assert.doesNotMatch(html, /benchmark-editor-error|new-facts-check/);
  const legacy = renderNewBenchmark(JSON.stringify({ schema: 'legacy', queries: samples, format: 'chat' }));
  assert.match(legacy, /value="Question 7"/); assert.match(legacy, /readOnly=""/i);
  assert.match(legacy, /Count of the embedded question list/); assert.doesNotMatch(legacy, /benchmark-editor-error/);
  const separate = renderNewBenchmark(JSON.stringify({ schema: 'legacy', queries: samples, format: 'chat', samples: [samples[0]] }));
  assert.match(separate, /This list and samples stay separate/);
});

const newSource = (id: string) => ({ anchor: {
  id, name: 'Exact source outside catalog', description: 'Original description', model: { id_M: 'Exact source model' }, price: '2.5',
  license: 'CC-BY-4.0', benchmark: { schema: 'chosen', queries: 8, format: ['chat'], samples: Array.from({ length: 8 }, (_, i) => ({ prompt: `Source case ${i}`, expect: `Answer ${i}`, source: `metadata-${i}` })) },
} });
const newFormFixtures: Fixture[] = [{ name: 'catalog', arg: { limit: 200 }, value: { items: [] } }, { name: 'branches', value: { branches: [], mine: [] } }];
test('new version resolves the exact source beyond the catalog and initializes all cases and license', () => {
  const html = render(NewPatchPage, [...signedOut, ...newFormFixtures, { name: 'patch', arg: 'outside/catalog', value: newSource('outside/catalog') }], '/new-patch?from=outside%2Fcatalog');
  assert.match(html, /value="Exact source outside catalog"/); assert.match(html, /value="Exact source model"/);
  assert.match(html, /value="Source case 7"/); assert.match(html, /metadata-7/);
  assert.match(html, /value="CC-BY-4.0" selected=""/); assert.match(html, /value="outside\/catalog"/);
});
test('new version waits for its source and keeps failed or mismatched reads out of the editor', () => {
  for (const fixture of [
    { status: 'pending' as const }, { status: 'rejected' as const }, { status: 'rejected' as const, errorStatus: 404 },
    { value: newSource('different') }, { value: { anchor: null } },
  ]) {
    const html = render(NewPatchPage, [...signedOut, ...newFormFixtures, { name: 'patch', arg: 'chosen', ...fixture }], '/new-patch?from=chosen');
    assert.doesNotMatch(html, /<form|Exact source outside catalog/);
    assert.match(html, fixture.status === 'pending' ? /new-patch-source-loading/ : /new-patch-source-error/);
    if (fixture.status !== 'pending') assert.match(html, /Try again/);
    if (fixture.errorStatus === 404) assert.match(html, /Source chosen was not found/);
    else assert.doesNotMatch(html, /was not found/);
  }
});
test('new knowledge restores only the current account and source draft', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const entries = new Map([
    ['ainize.new-patch.form', JSON.stringify({ name: 'Unscoped legacy secret' })],
    [newPatchDraftKey(accountIdentity, null), JSON.stringify({ name: 'Current account new draft' })],
    [newPatchDraftKey(accountIdentity, 'chosen'), JSON.stringify({ name: 'Current account source draft' })],
    [newPatchDraftKey('another-account', 'chosen'), JSON.stringify({ name: 'Another account secret' })],
  ]);
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => entries.get(key) ?? null } });
  try {
    const plain = render(NewPatchPage, [...appAccount, ...newFormFixtures], '/new-patch');
    assert.match(plain, /Current account new draft/); assert.doesNotMatch(plain, /Current account source draft|Unscoped legacy secret|Another account secret/);
    const version = render(NewPatchPage, [...appAccount, ...newFormFixtures, { name: 'patch', arg: 'chosen', value: newSource('chosen') }], '/new-patch?from=chosen');
    assert.match(version, /Current account source draft/); assert.doesNotMatch(version, /Current account new draft|Unscoped legacy secret|Another account secret/);
    const out = render(NewPatchPage, [...signedOut, ...newFormFixtures], '/new-patch');
    assert.doesNotMatch(out, /Current account|Unscoped legacy secret|Another account secret/);
  } finally { if (original) Object.defineProperty(globalThis, 'sessionStorage', original); else delete (globalThis as any).sessionStorage; }
});

const legacyBenchmarkEntry = (id: string, count = 2): any => {
  const entry = dashboardEntry(id);
  return { ...entry, anchor: { ...entry.anchor, rows: 10, size_bytes: 20, benchmark: { schema: 'chosen', format: ['chat'], queries: Array.from({ length: count }, (_, i) => ({ prompt: `Question ${i}`, expect: `Answer ${i}` })) } },
    children: [], superseded_by: [], attestations: [], quorum_ok: true, sellable: true };
};

test('public cards and chat picker display legacy question counts without claiming guaranteed knowledge coverage', () => {
  const entry = legacyBenchmarkEntry('legacy');
  const card = render(() => createElement(PatchListItem, { entry }), signedOut, '/explore');
  assert.match(card, /2 declared questions/); assert.doesNotMatch(card, /2 facts|NaN|\[object Object\]/);
  const picker = render(() => createElement(KnowledgePicker, { items: [entry], selectedIds: ['legacy'], runtime: undefined, lock: null, onToggle() {}, onClear() {} }), signedOut, '/chat/legacy');
  assert.match(picker, /2 declared questions/); assert.doesNotMatch(picker, /2 facts|NaN|\[object Object\]/);
});

test('detail measurement text separates declared counts from reported measurements and never invents complete coverage', () => {
  for (const [tested, questions, expected] of [
    [null, 100, 'tested question count unavailable'], [3, 100, '3 reported test questions · 100 declared questions'],
    [3, 3, '3 reported test questions · 3 declared questions'], [3, 2, '3 reported test questions'],
  ] as const) {
    const html = render(() => createElement(BenchmarkCoverage, { score: 75, tested, questions }), signedOut, '/');
    assert.ok(html.includes(expected)); assert.doesNotMatch(html, /on all|all 100|NaN/);
  }
});

test('benchmark comparison accepts legacy cases and does not call unhashed or inconsistent metadata the same exam', () => {
  const legacy = legacyBenchmarkEntry('legacy');
  const first = { ...legacyBenchmarkEntry('first'), anchor: { ...legacyBenchmarkEntry('first').anchor, benchmark_hash: 'shared-hash' } };
  const differentCount = { ...legacyBenchmarkEntry('different', 3), anchor: { ...legacyBenchmarkEntry('different', 3).anchor, benchmark_hash: 'shared-hash' } };
  const html = render(BenchmarkPage, [...signedOut, { name: 'benchmark', arg: 'chosen', value: { schema: 'chosen', items: [legacy, first, differentCount] } }], '/benchmarks/chosen', '/benchmarks/:schema');
  assert.equal((html.match(/data-testid="bench-row"/g) ?? []).length, 3);
  assert.equal((html.match(/data-testid="bench-group"/g) ?? []).length, 3);
  assert.match(html, /Question set unconfirmed/); assert.match(html, /3 questions/);
  assert.doesNotMatch(html, /no-hash:|were scored on this same|offline-retry/);
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

const keyNode = '0x' + 'a'.repeat(40);
const appAccount: Fixture[] = [
  ...signedOut.filter((f) => f.name !== 'me'),
  { name: 'me', value: { address: keyNode, sso: { sub: 'viewer', principal: 'sso:viewer', orgs: [{ id: 'studio', slug: 'studio' }] } } },
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
  assert.match(html, /href="\/studio\/mono\?project=packages%2Fweb&amp;projectId=web"/);
  assert.doesNotMatch(html, /Hidden script|Hidden agent/);
});

test('App Open uses the active deployment after rollback, not the newest successful build', () => {
  const html = render(AppsPage, [...appAccount, appsFixture([webApp]), { name: 'projectDeployments', arg: { id: 'web', identity: appsArg.principal }, value: { deployments: [{ id: 'previous', projectId: 'web', trigger: 'push', status: 'ready', sha: 'a'.repeat(40), ref: 'main', createdAt: 1, logUrl: 'https://node.example/log', outputUrl: 'https://active.example.test', outputState: 'current' as const, visitUrl: 'https://active.example.test' }] } }], '/apps');
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

test('model search and see-all cards open the searched provider and type, including same-name modalities', () => {
  const peer = '0x' + 'b'.repeat(40);
  const query = 'shared south chat';
  const modelFixtures: Fixture[] = [
    { name: 'models', value: { data: [{ id: 'shared', modality: 'chat', available: true }] } },
    { name: 'networkModels', value: { data: [
      { id: 'shared', modality: 'chat', local: true, node: { address: keyNode, name: 'North provider' } },
      { id: 'shared', modality: 'chat', local: false, node: { address: peer, name: 'South provider' } },
      { id: 'shared', modality: 'image', local: false, node: { address: peer, name: 'South provider' } },
    ] } },
  ];
  const search = render(SearchPage, [...appAccount, ...modelFixtures, appsFixture([]), { name: 'agents', value: { agents: [] } },
    { name: 'catalog', arg: { q: query, status: 'VERIFIED,ANNOUNCED,VERIFYING,CHALLENGED', limit: 8 }, value: { items: [], total: 0 } },
  ], `/search?q=${encodeURIComponent(query)}`);
  const list = render(ModelsPage, [...appAccount, ...modelFixtures], `/models?q=${encodeURIComponent(query)}`);
  for (const html of [search, list]) {
    assert.ok(html.includes(`href="/models/shared?modality=chat&amp;node=${peer}"`));
    assert.doesNotMatch(html, /href="\/models\/shared\?modality=image|North provider/);
    assert.ok(!html.includes(`href="/models/shared?modality=chat&amp;node=${keyNode}"`));
  }
});

test('model search reports unreadable catalogues and removes failed cached provider matches', () => {
  for (const modelFixture of [
    { name: 'models', value: {} },
    { name: 'models', value: { data: [{ id: 'stale-model', modality: 'chat', available: true }] }, status: 'rejected' as const },
  ]) {
    const html = render(SearchPage, [...appAccount, appsFixture([]), modelFixture,
      { name: 'networkModels', value: { data: [{ id: 'stale-model', modality: 'chat', local: false, node: { address: '0x' + 'b'.repeat(40), name: 'Stale provider' } }] }, status: 'rejected' },
      { name: 'agents', value: { agents: [] } },
      { name: 'catalog', arg: { q: 'stale-model', status: 'VERIFIED,ANNOUNCED,VERIFYING,CHALLENGED', limit: 8 }, value: { items: [], total: 0 } },
    ], '/search?q=stale-model');
    assert.match(html, /role="alert"/);
    assert.match(html, /Try again/);
    assert.doesNotMatch(html, /href="\/models\/stale-model|Stale provider|No results/);
  }
});

const accountIdentity = JSON.stringify([null, 'sso:viewer', null, null]);
const accountOrgs: Fixture = { name: 'myOrgs', arg: accountIdentity, value: { signed_in: true, orgs: [] } };
const keyEvidence = { version: 1, complete: true, node: keyNode, owner: 'sso:viewer' };
const noKeys: Fixture = { name: 'apiKeys', arg: issuedKeyScope(accountIdentity, keyNode), value: { ...keyEvidence, keys: [] } };

test('account keys do not claim empty during loading or failure and failed refresh preserves the list', () => {
  for (const status of ['pending', 'rejected'] as const) {
    const html = render(MyPage, [...appAccount, accountOrgs, { ...noKeys, value: undefined, status }], '/me');
    assert.doesNotMatch(html, /No keys yet/);
    if (status === 'rejected') {
      assert.match(html, /data-testid="me-keys-error"/);
      assert.match(html, /Try again/);
    }
  }
  const html = render(MyPage, [...appAccount, accountOrgs, { ...noKeys, status: 'rejected', value: { ...keyEvidence, keys: [{ key_id: '1234abcd' + '0'.repeat(56), org_id: null, disabled: false, prefix: '1234abcd', label: 'Existing account key', issuedAt: 1 }] } }], '/me');
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
    ...signedOut.filter((f) => f.name !== 'me'), { name: 'me', value: { signedIn: true, subject: wallet, address: keyNode } },
    { ...noKeys, arg: 'previous-account', value: { keys: [{ prefix: 'old-key', label: 'Previous secret label', issuedAt: 1 }] } },
    { ...accountOrgs, arg: 'previous-account', value: { signed_in: true, orgs: [{ id: 'private-org', name: 'Previous private organization' }] } },
    { name: 'myNodes', arg: 'other-wallet', value: { nodes: [{ address: 'other-wallet', name: 'Previous private node' }] } },
    { name: 'apiKeys', arg: issuedKeyScope(current, keyNode), status: 'pending' },
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
    ...signedOut.filter((f) => f.name !== 'me'), { name: 'me', value: { signedIn: true, subject: wallet, address: keyNode } },
    { ...noKeys, arg: issuedKeyScope(current, keyNode), value: { ...keyEvidence, owner: wallet, keys: [] } }, { ...accountOrgs, arg: current },
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
  const html = render(Playground, [...appAccount, { ...noKeys, value: { ...keyEvidence, keys: [{ key_id: '1234abcd' + '0'.repeat(56), org_id: null, disabled: false, prefix: '1234abcd', issuedAt: 1, label: 'Existing key' }] } }], '/models/fixture-model');
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

test('ambiguous root and folder branches show choices without rendering arbitrary project controls', () => {
  const preview = { ...rootProject, id: 'root-preview', branch: 'preview' };
  const folderPreview = { ...folderProject, id: 'folder-preview', branch: 'preview' };
  for (const search of ['', '?project=worker']) {
    const html = render(ProjectByNamePage, [...appAccount,
      { name: 'orgProjects', arg: { org: 'studio', identity: accountIdentity }, value: { projects: [preview, folderProject, rootProject, folderPreview] } },
    ], `/studio/mono${search}`, '/:org/:repo');
    assert.match(html, /Choose the project folder and branch/);
    assert.match(html, /projectId=root-preview/); assert.match(html, /projectId=folder-preview/);
    assert.match(html, /mono · main/); assert.match(html, /mono\/worker · preview/);
    assert.doesNotMatch(html, /Root-only project|Selected worker project|Rotate webhook secret|>Redeploy/);
  }
});

test('exact project links open the selected branch even when sibling discovery fails', () => {
  const preview = { ...folderProject, id: 'folder-preview', branch: 'preview', name: 'Preview worker' };
  const html = render(ProjectByNamePage, [...appAccount,
    { name: 'orgProjects', arg: { org: 'studio', identity: accountIdentity }, status: 'rejected' },
    { name: 'project', arg: { id: preview.id, identity: accountIdentity }, value: preview },
    { name: 'projectDeployments', arg: { id: preview.id, identity: accountIdentity }, value: { deployments: [] } },
  ], '/studio/mono?project=worker&projectId=folder-preview', '/:org/:repo');
  assert.match(html, /Preview worker/); assert.match(html, /other projects in this repository/);
  assert.doesNotMatch(html, /Root-only project|Selected worker project/);
});

test('explicit ids cannot display a different repository, conflicting folder, malformed record or denied cached project', () => {
  const listed = { name: 'orgProjects', arg: { org: 'studio', identity: accountIdentity }, value: { projects: [rootProject, folderProject] } };
  for (const record of [{ ...folderProject, org: 'other' }, { ...folderProject, repoName: 'other' }, { ...folderProject, repo: null }]) {
    const html = render(ProjectByNamePage, [...appAccount, listed,
      { name: 'project', arg: { id: folderProject.id, identity: accountIdentity }, value: record },
    ], '/studio/mono?projectId=folder-project', '/:org/:repo');
    assert.match(html, /project-selection-unavailable/); assert.doesNotMatch(html, /Selected worker project|Root-only project/);
  }
  const denied = render(ProjectByNamePage, [...appAccount, listed,
    { name: 'project', arg: { id: folderProject.id, identity: accountIdentity }, value: folderProject, status: 'rejected', errorStatus: 403 },
  ], '/studio/mono?projectId=folder-project', '/:org/:repo');
  assert.match(denied, /role="alert"/); assert.doesNotMatch(denied, /Selected worker project|Root-only project/);
  for (const search of ['?projectId=folder-project&projectId=root-project', '?projectId=folder-project&project=other', '?project=&project=worker']) {
    const html = render(ProjectByNamePage, [...appAccount, listed,
      { name: 'project', arg: { id: folderProject.id, identity: accountIdentity }, value: folderProject },
    ], `/studio/mono${search}`, '/:org/:repo');
    assert.match(html, /project-selection-unavailable/); assert.doesNotMatch(html, /Selected worker project|Root-only project/);
  }
});

test('organization listing retains both root branches with distinct exact links', () => {
  const arg = { org: 'studio', identity: accountIdentity }, preview = { ...rootProject, id: 'root-preview', branch: 'preview' };
  const html = render(OrgRepositoriesPage, [...appAccount,
    { name: 'orgProjects', arg, value: { org: 'studio', projects: [rootProject, preview] } },
    { name: 'orgRepositories', arg, value: { repositories: [] } },
  ], '/studio', '/:org');
  assert.match(html, /projectId=root-project/); assert.match(html, /projectId=root-preview/);
  assert.match(html, />main</); assert.match(html, />preview</);
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
    if (projects.length) assert.match(html, /href="\/studio\/mono\?projectId=root-project"/);
    assert.doesNotMatch(html, /No repositories/);
  }
});

test('organization Visit links only use the active deployment, never an unrelated successful build', () => {
  const arg = { org: 'studio', identity: accountIdentity };
  const lastDeployment = { id: 'latest-build', projectId: rootProject.id, trigger: 'push', sha: 'latest', status: 'ready', outputUrl: 'https://latest-build.example', outputState: 'current', visitUrl: 'https://latest-build.example', createdAt: 1 } as Deployment;
  for (const activeDeploymentId of ['latest-build', 'rolled-back-build']) {
    const html = render(OrgRepositoriesPage, [...appAccount,
      { name: 'orgProjects', arg, value: { org: 'studio', projects: [{ ...rootProject, activeDeploymentId, lastDeployment }] } },
      { name: 'orgRepositories', arg, value: { repositories: [] } },
    ], '/studio', '/:org');
    assert.match(html, /href="\/studio\/mono\?projectId=root-project"/, 'the project console is always reachable');
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
test('multi-knowledge chat shows each declared count instead of a misleading combined facts total', () => {
  const items = [legacyBenchmarkEntry('first', 2), legacyBenchmarkEntry('second', 3)];
  const html = render(ChatPage, [...signedOut, chatTeachPolicy,
    { name: 'chatPatches', arg: '', value: { items, lessons: [], runtime: { available: true, model: 'model' }, lock: null, overlaps: [] } },
  ], '/chat/first,second', '/chat/:patchId');
  assert.match(html, /2 declared questions/); assert.match(html, /3 declared questions/);
  assert.doesNotMatch(html, /5 facts|5 declared questions|up to .* facts each/);
});

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

test('agent creation keeps an explicit missing selection instead of displaying the first available model', () => {
  const models: Fixture = { name: 'models', value: { data: [{ id: 'other-model', modality: 'chat', available: true }] } };
  const network: Fixture = { name: 'networkModels', value: { data: [] } };
  const html = render(AgentCreatePage, [...appAccount, models, network], '/agent/new?model=missing-model');
  assert.match(html, /<option[^>]*value="missing-model@0x[a-f0-9]+"[^>]*selected=""/);
  assert.doesNotMatch(html, /<option[^>]*value="other-model@0x[a-f0-9]+"[^>]*selected=""/);
  assert.match(html, /selected model is missing from the current list/);
  assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="agent-create-submit"/);
  const blank = render(AgentCreatePage, [...appAccount, models, network], '/agent/new');
  assert.match(blank, /<option[^>]*value=""[^>]*selected=""/);
  assert.doesNotMatch(blank, /<option[^>]*value="other-model@0x[a-f0-9]+"[^>]*selected=""/);
});

test('agent model links retain the exact peer and chat modality; local-qualified prefills stay selected', () => {
  const peer = '0x' + 'b'.repeat(40), ref = `chosen@${peer}`;
  const models: Fixture = { name: 'models', value: { data: [{ id: 'chosen', modality: 'chat', available: true }] } };
  const network: Fixture = { name: 'networkModels', value: { data: [{ id: 'chosen', modality: 'chat', node: { address: peer }, local: false }] } };
  const html = render(AgentCreatePage, [...appAccount, models, network], `/agent/new?model=${ref}`);
  assert.match(html, new RegExp(`<option[^>]*value="${ref}"[^>]*selected=""`));
  assert.ok(html.includes(`href="/models/chosen?modality=chat&amp;node=${peer}"`));
  assert.doesNotMatch(html, /href="\/models\/chosen%40/);
  const local = render(AgentCreatePage, [...appAccount, models, network], `/agent/new?model=chosen@${keyNode}`);
  assert.match(local, new RegExp(`<option[^>]*value="chosen@${keyNode}"[^>]*selected=""`));
  assert.ok(local.includes(`href="/models/chosen?modality=chat&amp;node=${keyNode}"`));
  assert.doesNotMatch(local, /selected model is missing/);
});

test('agent creation distinguishes failed cached catalogues from a confirmed empty list', () => {
  const models: Fixture = { name: 'models', value: { data: [{ id: 'old-model', modality: 'chat', available: true }] }, status: 'rejected' };
  for (const failed of [models, { name: 'models', value: {} }]) {
    const html = render(AgentCreatePage, [...appAccount, failed, { name: 'networkModels', value: { data: [] } }], '/agent/new');
    assert.match(html, /Some or all models could not be checked/);
    assert.match(html, /Reload models/);
    assert.doesNotMatch(html, /value="old-model"|There are no chat models to select/);
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="agent-create-submit"/);
  }
  const empty = render(AgentCreatePage, [...appAccount, { name: 'models', value: { data: [] } }, { name: 'networkModels', value: { data: [] } }], '/agent/new');
  assert.match(empty, /There are no chat models to select/);
  assert.doesNotMatch(empty, /Some or all models could not be checked/);
});

test('agent creation keeps registered configuration possible without claiming model health', () => {
  const html = render(AgentCreatePage, [...appAccount, { name: 'models', value: { data: [
    { id: 'down', modality: 'chat', available: false }, { id: 'stt', modality: 'transcription', available: false },
  ] } }, { name: 'networkModels', value: { data: [] } }], '/agent/new?model=down');
  assert.match(html, /<option[^>]*value="down@0x[a-f0-9]+"[^>]*selected=""/);
  assert.doesNotMatch(html, /<option[^>]*value="down@0x[a-f0-9]+"[^>]*disabled/);
  assert.match(html, /This model is not answering/);
  assert.match(html, /You can save the configuration/);
  assert.doesNotMatch(html, /You can still create the agent/);
  const peer = '0x' + 'b'.repeat(40);
  const unavailablePeer = render(AgentCreatePage, [...appAccount, { name: 'models', value: { data: [] } },
    { name: 'networkModels', value: { data: [{ id: 'down', modality: 'chat', node: { address: peer }, local: false, available: false }] } },
  ], `/agent/new?model=down@${peer}`);
  assert.match(unavailablePeer, /This provider is marked unavailable/);
  assert.match(unavailablePeer, /<button[^>]*disabled=""[^>]*data-testid="agent-create-submit"/);
  assert.doesNotMatch(unavailablePeer, /You can save the configuration/);
  assert.doesNotMatch(html, /<input(?=[^>]*disabled="")(?=[^>]*data-testid="agent-create-media-transcription")[^>]*>/);
  assert.match(html, /<input(?=[^>]*disabled="")(?=[^>]*data-testid="agent-create-media-image")[^>]*>/);
});

test('new agent choices require a confirmed local node address and offer recovery when it is missing', () => {
  const authWithoutNode = appAccount.map(f => f.name === 'me' ? { ...f, value: { sso: { sub: 'viewer', principal: 'sso:viewer', orgs: [] } } } : f);
  const html = render(AgentCreatePage, [...authWithoutNode,
    { name: 'models', value: { data: [{ id: 'chosen', modality: 'chat', available: true }] } },
    { name: 'networkModels', value: { data: [] } },
  ], '/agent/new');
  assert.match(html, /serving node address could not be confirmed/);
  assert.match(html, /Reload models/);
  assert.match(html, /<option[^>]*value="chosen"[^>]*disabled=""/);
  assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="agent-create-submit"/);
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

test('pending agent cleanup offers continuation without edit, sharing or creator mutation controls', () => {
  const html = render(() => createElement(HostedAgentOwnerPanel, { agentId: 'chosen', agentName: 'Agent', isCreator: true, cleanupPending: true }), appAccount);
  assert.match(html, /Resume deletion/); assert.match(html, /runtime cleanup is incomplete/);
  assert.doesNotMatch(html, /hosted-agent-edit|ainft-registration|ainft-community/);
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


const walletAddress = '0x' + 'aa'.repeat(20), recipientAddress = '0x' + 'bb'.repeat(20);
const accountSale = (currency: string, amount = '10') => ({ patch_id: 'Wallet selected item', tx_hash: currency, seller: walletAddress, buyer: recipientAddress, amount, currency, scheme: 'local-credit', created_at: 1, royalty: { [recipientAddress]: '2' }, royalty_unresolved: { missing: '1' } });
const accountWalletValue = () => ({ address: walletAddress, balance: 20, purchases: 0, sales: [accountSale('AIN'), accountSale('CREDIT', '100')],
  royalties: [{ patch_id: 'Royalty selected item', amount: '3', currency: 'AIN', state: 'paid', evidence: 'seller_reported', created_at: 1 }],
  royalty_totals: { owed: '99999', credited: '99999', paid: '99999', unconfirmed: '99999' },
  verification_total: '88888', verification: [{ amount: '4', currency: 'AIN', kind: 'verification', state: 'pending' }, { amount: '5', currency: 'CREDIT', kind: 'verification', state: 'paid', evidence: 'record' }],
});
function accountWalletFixtures(): Fixture[] {
  const scope = { identity: accountIdentity };
  return [...appAccount.map(f => f.name === 'me' ? { ...f, value: { ...(f.value as any), address: walletAddress, name: 'Selected node', roles: [] } } : f),
    { name: 'info', arg: scope, value: { currency: 'AIN', ledger: { kind: 'ain', records: 0 }, node: { endpoint: 'https://fixture.invalid', version: 'fixture' }, quorum: 1 } },
    { name: 'wallet', arg: scope, value: accountWalletValue() },
    { name: 'payouts', arg: { ...scope, limit: 500 }, value: { items: [] } },
    { name: 'owners', arg: scope, value: { owners: [] } }, { name: 'bindings', arg: scope, value: { bindings: [] } },
  ];
}
test('account wallet shows currency-separated sales and payment evidence rather than mixed server totals', () => {
  const html = render(AccountPage, accountWalletFixtures(), '/account');
  assert.equal((html.match(/data-testid="sales-total"/g) ?? []).length, 2);
  assert.equal((html.match(/data-testid="owed-totals"/g) ?? []).length, 2);
  assert.match(html, /Reported by seller/); assert.match(html, /Signed payout record/); assert.match(html, /Payment pending/);
  assert.match(html, /sale-unresolved/); assert.match(html, /owed-unresolved/);
  assert.doesNotMatch(html.replace(/<[^>]*>/g, ' '), /99999|88888|99,999|88,888/);
});
test('account wallet failures and wrong identities cannot display cached money or empty success', () => {
  for (const override of [{ status: 'rejected' as const }, { value: { ...accountWalletValue(), address: recipientAddress } }, { value: { ...accountWalletValue(), sales: [null] } }]) {
    const html = render(AccountPage, accountWalletFixtures().map(f => f.name === 'wallet' ? { ...f, ...override } : f), '/account');
    assert.match(html, /query-error/); assert.match(html, /query-retry/);
    assert.doesNotMatch(html, /Wallet selected item|Royalty selected item|sales-total|owed-totals/);
  }
});
test('a payout failure has its own recovery without turning the outgoing window into an empty list', () => {
  const html = render(AccountPage, accountWalletFixtures().map(f => f.name === 'payouts' ? { ...f, status: 'rejected' as const } : f), '/account');
  assert.match(html, /Wallet selected item/); assert.match(html, /query-error/); assert.doesNotMatch(html, /data-testid="owed-totals"|data-testid="owed-row"/);
});
test('account ignores another identity financial caches and unknown payment currency is not assumed', () => {
  const fixtures = accountWalletFixtures();
  const foreign = render(AccountPage, fixtures.map(f => ['wallet', 'payouts'].includes(f.name) ? { ...f, arg: { ...(f.arg as any), identity: 'another account' } } : f), '/account');
  assert.doesNotMatch(foreign, /Wallet selected item|Royalty selected item|sales-total/);
  const unknown = render(AccountPage, fixtures.map(f => f.name === 'wallet' ? { ...f, value: { ...accountWalletValue(), verification: undefined, royalties: [{ patch_id: 'Unknown currency', amount: '3', created_at: 1 }] } } : f), '/account');
  assert.match(unknown, /Currency or payment details are unavailable/); assert.match(unknown, /Kind unavailable/);
});


test('account settings starts from the actual saved values and keeps the payout destination read-only', () => {
  const settings = { display_name: 'Server chosen name', notifications: 'sales', payout_address: recipientAddress };
  const html = render(() => createElement(AccountSettings, { address: walletAddress }), [...appAccount, { name: 'settings', arg: { identity: accountIdentity }, value: { settings } }], '/account');
  assert.match(html, /value="Server chosen name"/); assert.match(html.match(/<input[^>]*value="sales"[^>]*>/)?.[0] ?? '', /checked=""/);
  assert.match(html, /account-payout-stale/); assert.match(html, new RegExp(walletAddress));
  assert.doesNotMatch(html, /name="payout_address"|value="stored legacy value"/);
  assert.match(html, /type="submit"[^>]*disabled=""|disabled=""[^>]*type="submit"/);
});
test('settings failed, malformed or foreign cached reads cannot turn into a blank editable default form', () => {
  const saved = { settings: { display_name: 'Foreign saved name', notifications: 'none', payout_address: '' } };
  for (const fixture of [
    { name: 'settings', arg: { identity: accountIdentity }, value: saved, status: 'rejected' as const },
    { name: 'settings', arg: { identity: accountIdentity }, value: { settings: { ...saved.settings, notifications: 'unknown' } } },
    { name: 'settings', arg: { identity: 'another account' }, value: saved },
  ]) {
    const html = render(() => createElement(AccountSettings, { address: walletAddress }), [...appAccount, fixture], '/account');
    assert.doesNotMatch(html, /account-settings-form|Foreign saved name/);
    if (fixture.arg.identity === accountIdentity) { assert.match(html, /query-error/); assert.match(html, /query-retry/); }
  }
});


const operatorPeerFixture = () => ({ self: 'self', nodes: [], peers: [{ endpoint: 'https://selected-peer.example', address: null, info: null, last_seen: 0, failures: 1 }] });
test('account peers distinguish a failed or malformed read from an empty list and explain blocking', () => {
  const fixture = { name: 'nodes', arg: { identity: accountIdentity }, value: operatorPeerFixture() };
  const good = render(AccountPeers, [...appAccount, fixture], '/account');
  assert.match(good, /https:\/\/selected-peer.example/); assert.match(good, /Block connection/);
  for (const override of [{ status: 'rejected' as const }, { value: { ...operatorPeerFixture(), peers: [null] } }]) {
    const html = render(AccountPeers, [...appAccount, { ...fixture, ...override }], '/account');
    assert.match(html, /query-error/); assert.match(html, /query-retry/); assert.doesNotMatch(html, /selected-peer.example|Block connection/);
  }
  const foreign = render(AccountPeers, [...appAccount, { ...fixture, arg: { identity: 'someone else' } }], '/account');
  assert.doesNotMatch(foreign, /selected-peer.example|Block connection/);
});
test('account runtime has failed-read recovery and disables inference when the model is unavailable', () => {
  const fixture = { name: 'runtime', arg: { identity: accountIdentity }, value: { available: true, hook: false, model: 'Exact runtime model', api: 'runtime endpoint', applied: [] } };
  const good = render(AccountRuntime, [...appAccount, fixture], '/account');
  assert.match(good, /Exact runtime model/); assert.match(good, /up to 16 tokens/); assert.match(good, /maxLength="2000"/i);
  const stopped = render(AccountRuntime, [...appAccount, { ...fixture, value: { ...fixture.value, available: false } }], '/account');
  assert.match(stopped, /<button[^>]*disabled=""[^>]*>Ask<\/button>/);
  for (const override of [{ status: 'rejected' as const }, { value: { ...fixture.value, applied: null } }]) {
    const html = render(AccountRuntime, [...appAccount, { ...fixture, ...override }], '/account');
    assert.match(html, /query-error/); assert.match(html, /query-retry/); assert.doesNotMatch(html, /Exact runtime model|runtime-answer/);
  }
});


const accessActor = '0x' + 'bb'.repeat(20), accessTarget = '0x' + 'cc'.repeat(20);
const accessIdentity = JSON.stringify([accessActor, null, null, null]);
const accessAuth: Fixture[] = [...signedOut.filter(f => f.name !== 'me'), { name: 'me', value: { signedIn: true, subject: accessActor, address: walletAddress, scheme: 'ain', isOwner: true, scope: ['owner'] } }];
const directVerificationCap: Fixture = { name: 'runtimeOperationCapabilities', arg: { identity: accessIdentity }, value: {
  instance: 'a'.repeat(32), server_time: 1_800_000_000_000, request_window_ms: 600_000, verification_jobs: true, verification_restoration: 1,
} };
const publicVerification = () => ({ ...manageFixture(), anchor: { ...manageFixture().anchor, author: accessTarget }, status: 'VERIFIED' as const, owned: false });
test('direct verification appears on a public foreign detail for an authorized supported node operator', () => {
  const html = render(() => createElement(VerificationAction, { detail: publicVerification() }), [...accessAuth, directVerificationCap]);
  assert.match(html, /data-testid="verification-begin"/); assert.match(html, />Verify</);
  assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*data-testid="verification-begin"/);
  assert.doesNotMatch(html, /verification-review|Start verification|stake|escrow/);
});
test('visitors, nonoperators, authors and private drafts have no direct verification action', () => {
  for (const fixtures of [signedOut, appAccount]) {
    const html = render(() => createElement(VerificationAction, { detail: publicVerification() }), fixtures);
    assert.doesNotMatch(html, /verification-begin|verification-action/);
  }
  const own = { ...publicVerification(), anchor: { ...publicVerification().anchor, author: walletAddress } };
  const html = render(() => createElement(VerificationAction, { detail: own }), [...accessAuth, directVerificationCap]);
  assert.doesNotMatch(html, /verification-begin/); assert.match(html, /verified by another node/);
  const draft = render(() => createElement(VerificationAction, { detail: manageFixture() }), [...accessAuth, directVerificationCap]);
  assert.doesNotMatch(draft, /verification-begin/);
});
test('direct verification keeps unsupported, failed and loading capabilities disabled with honest feedback', () => {
  for (const cap of [{ ...directVerificationCap, value: { ...directVerificationCap.value as object, verification_restoration: undefined } },
    { ...directVerificationCap, status: 'rejected' as const }, { ...directVerificationCap, status: 'pending' as const }]) {
    const html = render(() => createElement(VerificationAction, { detail: publicVerification() }), [...accessAuth, cap]);
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="verification-begin"/);
    if (cap.status === 'rejected') assert.match(html, /Could not check whether this node can verify/);
    else if (cap.status !== 'pending') assert.match(html, /does not support recoverable direct verification/);
  }
});
test('previous node attestations label a new decision as recheck instead of a first verification', () => {
  const d = publicVerification(); d.attestations = [{ verifier: walletAddress, sig: 'previous' } as any];
  const html = render(() => createElement(VerificationAction, { detail: d }), [...accessAuth, directVerificationCap]);
  assert.match(html, />Recheck</); assert.doesNotMatch(html, />Verify</);
});
test('verification feedback distinguishes model PASS, model FAIL and integrity-only outcomes', () => {
  for (const passed of [true, false]) for (const verified_on of ['model', 'hash-only']) {
    const html = render(() => createElement(VerificationResult, { attestation: { passed, verified_on, samples_run: 4, samples_available: 4 } as any }), signedOut);
    assert.match(html, new RegExp(`verification-result-${verified_on === 'hash-only' ? 'integrity' : 'model'}-${passed ? 'pass' : 'fail'}`));
    if (verified_on === 'hash-only') { assert.match(html, /no model measurement/); assert.doesNotMatch(html, /Model measurement:/); }
    else assert.match(html, new RegExp(`Model measurement: ${passed ? 'PASS' : 'FAIL'}`));
  }
  const legacy = render(() => createElement(VerificationResult, { attestation: { passed: true, verified_on: 'model' } as any }), signedOut);
  assert.match(legacy, /model measurement unconfirmed/); assert.doesNotMatch(legacy, /Model measurement: PASS/);
});
const ownerRow = (address: string, source = 'granted') => ({ address, source, added_at: 1, added_by: walletAddress, note: null });
const accessOwners = { owners: [ownerRow(walletAddress, 'node'), ownerRow(accessActor), ownerRow(accessTarget)] };
test('ownership controls exclude self and protected claims and identify the actual removable address', () => {
  const html = render(AccountOwners, [...accessAuth, { name: 'owners', arg: { identity: accessIdentity }, value: accessOwners }], '/account');
  assert.match(html, /You cannot remove your own ownership/);
  assert.match(html, new RegExp(`aria-label="Remove ${accessTarget}"`));
  assert.doesNotMatch(html, new RegExp(`aria-label="Remove (${walletAddress}|${accessActor})"`));
});
test('access lists distinguish invalid or foreign records from empty results', () => {
  const badOwners = render(AccountOwners, [...accessAuth, { name: 'owners', arg: { identity: accessIdentity }, value: { owners: [] } }], '/account');
  assert.match(badOwners, /query-error/); assert.match(badOwners, /query-retry/); assert.doesNotMatch(badOwners, /data-testid="operators"/);
  const binding = { delegate: accessTarget, owner: accessActor, label: 'Private terminal label', created_at: 1, last_seen_at: null };
  for (const override of [{ status: 'rejected' as const }, { value: { bindings: [{ ...binding, owner: walletAddress }], via: null } }]) {
    const html = render(AccountBindings, [...accessAuth, { name: 'bindings', arg: { identity: accessIdentity }, value: { bindings: [binding], via: null }, ...override }], '/account');
    assert.match(html, /query-error/); assert.doesNotMatch(html, /Private terminal label|data-testid="bindings"/);
  }
});
test('the current binding is marked case-insensitively and explains that ending it closes this login', () => {
  const binding = { delegate: accessTarget, owner: accessActor, label: 'Selected terminal', created_at: 1, last_seen_at: null };
  const html = render(AccountBindings, [...accessAuth, { name: 'bindings', arg: { identity: accessIdentity }, value: { bindings: [binding], via: accessTarget.toUpperCase().replace('0X', '0x') } }], '/account');
  assert.match(html, /this session/); assert.match(html, /Ending this connection also closes the current session/);
  assert.match(html, /End this login connection/);
});


function renderManage(fixtures: Fixture[], id = 'chosen', author = trackAuthor) {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'https://ainize.ai' } } });
  try { return render(ManagePage, fixtures, `/project/${encodeURIComponent(author)}/${encodeURIComponent(id)}`, '/project/:author/:patchId'); }
  finally { if (before) Object.defineProperty(globalThis, 'window', before); else Reflect.deleteProperty(globalThis, 'window'); }
}
const manageRead = (id = 'chosen'): Fixture => ({ name: 'managedPatch', arg: { id, identity: accessIdentity }, value: manageFixture(id) });
const manageAux: Fixture[] = [
  { name: 'managedCatalog', arg: { identity: accessIdentity }, value: { items: [] } },
  { name: 'nodes', arg: { identity: accessIdentity }, value: networkNodesFixture() },
  { name: 'runtime', arg: { identity: accessIdentity }, value: { available: false, hook: false, model: null, applied: [] } },
];
test('knowledge management requires node operator permission even for a node-owned resource', () => {
  for (const auth of [signedOut, accessAuth.map(f => f.name === 'me' ? { ...f, value: { ...f.value as object, isOwner: false } } : f)]) {
    const html = renderManage([...auth, manageRead(), ...manageAux]);
    assert.match(html, /Node operator access is required/); assert.doesNotMatch(html, /data-testid="announce"|delete-draft|price-save|billing-select/);
  }
});
test('management respects the full route and keeps failed reads distinct from missing knowledge', () => {
  const wrongAuthor = renderManage([...accessAuth, manageRead(), ...manageAux], 'chosen', accessTarget);
  assert.match(wrongAuthor, /author in this URL does not match/); assert.doesNotMatch(wrongAuthor, /data-testid="announce"/);
  for (const override of [{ status: 'rejected' as const }, { value: { ...manageFixture(), conflicts: [null] } }, { value: manageFixture('different') }]) {
    const html = renderManage([...accessAuth, { ...manageRead(), ...override }, ...manageAux]);
    assert.match(html, /query-error/); assert.match(html, /query-retry/); assert.doesNotMatch(html, /Knowledge not found|data-testid="announce"/);
  }
  const missing = renderManage([...accessAuth, { ...manageRead(), status: 'rejected', errorStatus: 404 }, ...manageAux]);
  assert.match(missing, /Knowledge not found/); assert.doesNotMatch(missing, /data-testid="announce"/);
});
test('knowledge management cannot reuse another account detail or the public unscoped cache', () => {
  const html = renderManage([...accessAuth, { ...manageRead(), arg: { id: 'chosen', identity: 'other account' } }, { name: 'patch', arg: 'chosen', value: manageFixture() }, ...manageAux]);
  assert.doesNotMatch(html, /Knowledge chosen|billing-select|delete-draft|data-testid="announce"/);
});
test('management links preserve encoded identifiers and unknown conflict authors use lookup', () => {
  const id = 'folder/item?x#hash'; const p = manageFixture(id);
  p.conflicts = [{ patch_id: 'external/id?x', status: 'VERIFIED', overlap_rows: 2, same_schema: true, same_author: false }] as any;
  p.lineage.parents = [{ id: 'base/id', author: accessTarget, name: 'Base item', status: 'VERIFIED' }];
  const html = renderManage([...accessAuth, { ...manageRead(id), value: p }, ...manageAux], id);
  assert.match(html, /data-testid="announce"/);
  assert.ok(html.includes(`/project/${trackAuthor}/folder%2Fitem%3Fx%23hash/logs`));
  assert.ok(html.includes('/patch/external%2Fid%3Fx'));
  assert.ok(html.includes(`/${accessTarget}/base%2Fid`));
  assert.ok(!html.includes(`/${trackAuthor}/external`));
});
test('management holders and runtime failures offer recovery instead of empty or cached controls', () => {
  const fixtures = manageAux.map(f => f.name === 'nodes' || f.name === 'runtime' ? { ...f, status: 'rejected' as const } : f);
  const html = renderManage([...accessAuth, manageRead(), ...fixtures]);
  assert.equal((html.match(/data-testid="query-retry"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /data-testid="holders-empty"/);
});


test('management editor starts with saved values and disables unchanged section saves', () => {
  const p = manageFixture(); p.anchor.description = 'Actual saved description'; p.anchor.branch = 'saved/branch'; p.anchor.license = 'CC-BY'; p.anchor.price = '12.50';
  const html = renderManage([...accessAuth, { ...manageRead(), value: p }, ...manageAux]);
  for (const value of ['Actual saved description', 'saved/branch', 'CC-BY', '12.50']) assert.ok(html.includes(`value="${value}"`));
  assert.match(html, /<button[^>]*disabled=""[^>]*>Save<\/button>/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Save benchmark<\/button>/);
  assert.doesNotMatch(html, /You have unsaved edits/);
});
test('management conflict view displays actual server values and both explicit resolutions', () => {
  const p = manageFixture(); p.anchor.license = 'Old license'; const editor = manageDraftEditor(p.anchor);
  editor.draft.description = 'My draft'; editor.draft.license = 'My license';
  const latest = { ...p.anchor, description: 'Current server description', license: '' };
  const html = render(() => createElement(ManageDraftConflict, { editor, anchor: latest, group: 'fields', onResolve: () => undefined }), signedOut);
  assert.match(html, /Current server description/); assert.match(html, /\(empty\)/);
  assert.match(html, /Use server values/); assert.match(html, /Keep my edits/); assert.match(html, /role="alert"/);
  const unchanged = render(() => createElement(ManageDraftConflict, { editor: manageDraftEditor(latest), anchor: latest, group: 'fields', onResolve: () => undefined }), signedOut);
  assert.doesNotMatch(unchanged, /manage-draft-conflict/);
});
test('published management values are readable and copyable without draft save controls', () => {
  const p = manageFixture(); p.status = 'VERIFIED'; p.anchor.description = 'Published description';
  const html = renderManage([...accessAuth, { ...manageRead(), value: p }, ...manageAux]);
  const description = html.match(/<input[^>]*value="Published description"[^>]*>/)?.[0];
  assert.ok(description); assert.match(description, /readonly=""/i); assert.doesNotMatch(description, /disabled=""/);
  assert.doesNotMatch(html, />Save benchmark<|data-testid="announce"/);
});


test('published price and retirement controls respect stored retirement and bound reason inputs', () => {
  const p = manageFixture(); p.status = 'VERIFIED';
  const active = renderManage([...accessAuth, { ...manageRead(), value: p }, ...manageAux]);
  assert.match(active, /data-testid="price-save"/); assert.match(active, /data-testid="takedown"/);
  const reason = active.match(/<input[^>]*data-testid="price-reason"[^>]*>/)?.[0];
  assert.ok(reason); assert.match(reason, /maxLength="500"/i);
  const retired = renderManage([...accessAuth, { ...manageRead(), value: { ...p, retired_at: 100, retire_reason: 'No longer offered', sellable: false } }, ...manageAux]);
  assert.match(retired, /No longer offered/); assert.doesNotMatch(retired, /data-testid="price-save"|data-testid="takedown"/);
});


test('management challenge explains the reason minimum and blocks unknown history', () => {
  const p = manageFixture(); p.status = 'VERIFIED';
  const html = renderManage([...accessAuth, { ...manageRead(), value: p }, ...manageAux]);
  assert.match(html, /at least 20 characters/); assert.match(html, /Currently 0/);
  assert.match(html, /Request history could not be confirmed/); assert.match(html, /Refresh request history/);
  assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="challenge-submit"/);
  assert.match(html, /aria-describedby="challenge-rule"/);
});
test('management challenge shows current-node pending requests and dismissed cooldown', () => {
  const p = manageFixture(); p.status = 'VERIFIED';
  const challenge = { patch_id: p.anchor.id, challenger: walletAddress, reason: 'An answer no longer agrees with the evidence', created_at: Date.now() - 2000 };
  const open = renderManage([...accessAuth, { ...manageRead(), value: { ...p, challenge_log: [{ challenge, state: 'open' }] } }, ...manageAux]);
  assert.match(open, /already has a pending request/); assert.match(open, /<button[^>]*disabled=""[^>]*data-testid="challenge-submit"/);
  const dismissed = renderManage([...accessAuth, { ...manageRead(), value: { ...p, challenge_log: [{ challenge, state: 'dismissed', answered_at: Date.now() - 1000 }] } }, ...manageAux]);
  assert.match(dismissed, /previous request was dismissed/); assert.match(dismissed, /You can request again after/);
  assert.match(dismissed, /<button[^>]*disabled=""[^>]*data-testid="challenge-submit"/);
});
test('other-node challenges do not block this node and private drafts have no challenge action', () => {
  const p = manageFixture(); p.status = 'VERIFIED';
  const html = renderManage([...accessAuth, { ...manageRead(), value: { ...p, challenge_log: [{ challenge: { patch_id: p.anchor.id, challenger: accessTarget, reason: 'A different node requested re-verification', created_at: 100 }, state: 'open' }] } }, ...manageAux]);
  assert.doesNotMatch(html, /challenge-unavailable/); assert.match(html, /data-testid="challenge-submit"/);
  const draft = renderManage([...accessAuth, manageRead(), ...manageAux]);
  assert.doesNotMatch(draft, /data-testid="challenge-submit"/);
});

const publicationProps = { expected: manageFixture(), busy: false, run: async () => undefined, readDetail: async () => ({}), onClose: () => undefined, onPublished: () => undefined };
const publicationFixture: Fixture = { name: 'announcePreview', arg: { id: 'chosen', identity: accessIdentity }, value: { anchor: { ...manageFixture().anchor, name: 'Authoritative server draft' }, revision: 'a'.repeat(64), retires: [], coexisting: 0 } };
test('publication review displays server contents and explicit zero replacements', () => {
  const html = render(() => createElement(ManagePublication, publicationProps), [...accessAuth, publicationFixture]);
  assert.match(html, /Authoritative server draft/); assert.match(html, /This publication does not replace existing knowledge/); assert.match(html, /data-testid="publish-confirm"/);
  assert.doesNotMatch(html, /data-testid="retire-type"/);
});
test('failed or unsupported publication preview cannot become zero replacements or an enabled publish action', () => {
  for (const fixture of [{ ...publicationFixture, status: 'rejected' as const, errorStatus: 404 }, { ...publicationFixture, value: {} }]) {
    const html = render(() => createElement(ManagePublication, publicationProps), [...accessAuth, fixture]);
    assert.match(html, /query-retry/); assert.doesNotMatch(html, /publish-no-replacements/);
    assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="publish-confirm"/);
  }
});
test('publication uses exact server replacement metadata outside the client catalog and asks for typed confirmation', () => {
  const fixture = { ...publicationFixture, value: { ...publicationFixture.value as any, retires: [{ patch_id: 'old/id?x', author: trackAuthor, name: 'Old knowledge beyond page 200', status: 'VERIFIED', overlap_rows: 8, price: '2', currency: 'AIN', paid_sales: null, revenue: null }] } };
  const html = render(() => createElement(ManagePublication, publicationProps), [...accessAuth, fixture]);
  assert.match(html, /Old knowledge beyond page 200/); assert.ok(html.includes(`/${trackAuthor}/old%2Fid%3Fx`));
  assert.match(html, /Sales information is unavailable/); assert.match(html, /data-testid="retire-type"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="publish-confirm"/);
});

function verificationDetail() {
  const p = manageFixture(); p.status = 'VERIFYING'; p.passed = 2; p.quorum = 2; p.quorum_ok = false;
  p.anchor.benchmark.samples = [{ prompt: 'Question', expect: 'Answer' }] as any;
  p.verifiers = [walletAddress, accessTarget]; p.executors = ['shared-engine']; p.executors_unknown = 0;
  p.attestations = [walletAddress, accessTarget].map(verifier => ({ verifier, patch_id: p.anchor.id, patch_sha256: p.anchor.patch_sha256,
    benchmark_hash: p.anchor.benchmark_hash, created_at: 100, passed: true, verified_on: 'vllm', score: { free_generation: '4/4' },
    executor: { api: 'https://model.test', model: 'model', instance: 'shared-engine' }, baseline: true, sig: 'fixture' } as any));
  return p;
}
test('public verification summary and both tables show a shared engine as one quorum unit', () => {
  const p = verificationDetail();
  const detail = render(() => createElement(Verification, { d: p }), signedOut);
  assert.match(detail, /Verification quorum/); assert.match(detail, />1\/2</);
  assert.match(detail, /data-testid="ver-executors"[^>]*>1</);
  assert.equal((detail.match(/data-kind="shared"/g) ?? []).length, 2);
  const management = renderManage([...accessAuth, { ...manageRead(), value: p }, ...manageAux]);
  assert.equal((management.match(/data-kind="shared"/g) ?? []).length, 2);
  assert.match(management, /Counts once with results from the same server/);
  const label = render(() => createElement('span', null, useVerificationLabel()(p)), signedOut);
  assert.match(label, /Verifying \(quorum 1\/2\)/); assert.doesNotMatch(label, /independent verifiers|\+1 more/);
});
test('public and management verification rows explain non-counting evidence', () => {
  const base = verificationDetail();
  for (const [patch, row, kind] of [
    [{}, { passed: false }, 'failed'], [{}, { baseline: false }, 'baseline'], [{}, { verified_on: 'hash-only' }, 'integrity'],
    [{ self_checks: 1 }, { verifier: base.anchor.author }, 'self'],
    [{ open_challenge: { patch_id: base.anchor.id, challenger: walletAddress, reason: 'New evidence', created_at: 100 } }, {}, 'stale'],
  ] as const) {
    const p = { ...base, ...patch, attestations: [{ ...base.attestations[0], ...row }] };
    const detail = render(() => createElement(Verification, { d: p }), signedOut);
    const management = renderManage([...accessAuth, { ...manageRead(), value: p }, ...manageAux]);
    assert.ok(detail.includes(`data-kind="${kind}"`)); assert.ok(management.includes(`data-kind="${kind}"`));
  }
});
test('legacy and file-only verification cannot be described as proven independent model runs', () => {
  const base = verificationDetail();
  const legacy = { ...base, passed: 1, executors: [], executors_unknown: 1, attestations: [{ ...base.attestations[0], executor: undefined }] };
  const detail = render(() => createElement(Verification, { d: legacy }), signedOut);
  assert.match(detail, /data-kind="legacy"/); assert.doesNotMatch(detail, /data-testid="ver-executors"/);
  const hash = { ...legacy, anchor: { ...base.anchor, benchmark: { ...base.anchor.benchmark, samples: [] } }, attestations: [{ ...legacy.attestations[0], verified_on: 'hash-only' }] };
  const fileOnly = render(() => createElement(Verification, { d: hash }), signedOut);
  assert.match(fileOnly, /data-kind="integrity_counted"/); assert.match(fileOnly, /file check only, no model run/);
  const unknown = render(() => createElement(Verification, { d: { ...base, executors: undefined, executors_unknown: undefined } }), signedOut);
  assert.match(unknown, /—\/2/); assert.match(unknown, /Contribution unconfirmed/);
});
test('retired and replaced listings are not falsely labelled as challenged', () => {
  const base = verificationDetail();
  for (const status of ['RETIRED', 'SUPERSEDED'] as const) {
    const p = { ...base, status, quorum_ok: true, sellable: false, executors: ['engine-1', 'engine-2'] };
    const label = render(() => createElement('span', null, useVerificationLabel()(p)), signedOut);
    assert.doesNotMatch(label, /challenged/);
  }
  const p = { ...base, open_challenge: { patch_id: base.anchor.id, challenger: walletAddress, reason: 'Check', created_at: 200 } };
  assert.match(render(() => createElement('span', null, useVerificationLabel()(p)), signedOut), /challenged, re-verification pending/);
});

function scoreDetail() {
  const p = verificationDetail(); p.children = []; p.anchor.benchmark.schema = 'chosen'; p.anchor.benchmark.format = ['qa'];
  p.attestations[0] = { ...p.attestations[0], verifier_name: 'Recent verifier', created_at: 200, score: { free_generation: '3/4', pre_apply: '1/4' } };
  p.attestations[1] = { ...p.attestations[1], verifier_name: 'Older verifier', created_at: 100, score: { free_generation: '4/4', pre_apply: '0/4' } };
  return p;
}
function renderScoreDetail(p: ReturnType<typeof scoreDetail>) {
  return render(() => createElement(PatchPage, { author: p.anchor.author, patchId: p.anchor.id }), [...signedOut, { name: 'patch', arg: p.anchor.id, value: p }], `/${p.anchor.author}/${p.anchor.id}?tab=verification`);
}
test('list, benchmark and detail use the same latest eligible score instead of array-last maximum', () => {
  const p = scoreDetail();
  const list = render(() => createElement(PatchListItem, { entry: p }), signedOut);
  const benchmark = render(BenchmarkPage, [...signedOut, { name: 'benchmark', arg: 'chosen', value: { schema: 'chosen', items: [p] } }], '/benchmarks/chosen', '/benchmarks/:schema');
  assert.match(list, /75%/); assert.match(list, /3\/4/); assert.doesNotMatch(list, /100%/);
  assert.match(benchmark, /75%/); assert.match(benchmark, /3\/4/); assert.doesNotMatch(benchmark, /100%/);
  const detail = renderScoreDetail(p);
  assert.match(detail, /1\/4 → 3\/4/); assert.match(detail, /Latest eligible check: Recent verifier/);
  assert.match(detail, /data-testid="score-source"/);
});
test('excluded or malformed scores disappear from representative accuracy while signed rows remain visible', () => {
  for (const changes of [{ baseline: false }, { score: { free_generation: '5/4' } }, { verified_on: 'hash-only' }]) {
    const p = scoreDetail(); p.attestations = [{ ...p.attestations[0], ...changes }];
    const list = render(() => createElement(PatchListItem, { entry: p }), signedOut);
    assert.doesNotMatch(list, /75%|125%/);
    const detail = renderScoreDetail(p);
    assert.match(detail, /No current score/); assert.doesNotMatch(detail, /data-testid="score-source"/);
    assert.match(detail, /Recent verifier/); // The signed result table remains available for inspection.
  }
});
test('a stale failed verification does not create a current failure chip or headline accuracy', () => {
  const p = scoreDetail(); p.attestations[0] = { ...p.attestations[0], passed: false };
  p.open_challenge = { patch_id: p.anchor.id, challenger: walletAddress, reason: 'New evidence requires re-verification', created_at: 300 };
  const detail = renderScoreDetail(p);
  assert.match(detail, /No current score/); assert.doesNotMatch(detail, /data-testid="failed-chip"/);
  assert.match(detail, /data-kind="stale"/);
});

test('account runtime displays server applied IDs with their own stack metadata', () => {
  const value = { available: true, hook: true, model: 'Actual server model', applied: ['parent/id', 'child'], stack: [
    { patch_id: 'parent/id', sha256: 'base-sha', position: 0, applied_at: 100, reason: 'manual' },
    { patch_id: 'child', sha256: 'child-sha', position: 1, applied_at: 200, reason: 'branch-specific' },
  ] };
  const fixture = { name: 'runtime', arg: { identity: accountIdentity }, value };
  const html = render(AccountRuntime, [...appAccount, fixture], '/account');
  assert.match(html, /Actual server model/); assert.match(html, /parent\/id/); assert.match(html, /branch-specific/);
  assert.doesNotMatch(html, /query-error/);
  const missing = render(AccountRuntime, [...appAccount, { ...fixture, value: { ...value, stack: undefined } }], '/account');
  assert.match(missing, /parent\/id/); assert.match(missing, /load reason and time unavailable/); assert.doesNotMatch(missing, /branch-specific|query-error/);
});
test('account runtime cannot pair applied IDs with another layer’s metadata', () => {
  const value = { available: true, hook: true, model: 'Hidden inconsistent model', applied: ['chosen'], stack: [{ patch_id: 'wrong', sha256: 'sha', applied_at: 100, position: 0, reason: 'Wrong layer reason' }] };
  const html = render(AccountRuntime, [...appAccount, { name: 'runtime', arg: { identity: accountIdentity }, value }], '/account');
  assert.match(html, /query-error/); assert.match(html, /query-retry/); assert.doesNotMatch(html, /Hidden inconsistent model|Wrong layer reason/);
});
test('knowledge management accepts a nonempty server runtime and enables the corresponding load or unload control', () => {
  const p = manageFixture(); p.status = 'VERIFIED';
  const runtime = { available: true, hook: true, model: p.anchor.model.id_M, applied: ['base'], stack: [{ patch_id: 'base', sha256: 'base-sha', applied_at: 100, position: 0, reason: 'manual' }] };
  const fixtures = [...accessAuth, { ...manageRead(), value: p }, ...manageAux.map(f => f.name === 'runtime' ? { ...f, value: runtime } : f)];
  const load = renderManage(fixtures).match(/<button[^>]*data-testid="manage-load"[^>]*>/)?.[0];
  assert.ok(load); assert.doesNotMatch(load, /disabled/);
  const unload = renderManage(fixtures.map(f => f.name === 'managedPatch' ? { ...f, value: { ...p, applied: true } } : f)).match(/<button[^>]*data-testid="manage-unload"[^>]*>/)?.[0];
  assert.ok(unload); assert.doesNotMatch(unload, /disabled/);
});

test('track receipts show fee-only spend, incomplete cleanup and legacy uncertainty without success styling', () => {
  const value = { ok: false, branch: 'selected', action: 'unsubscribe', acquired: [], failed: [], applied: [], removed: [], skipped: [], spent: [{ amount: '7', currency: 'CREDIT' }],
    receipt: { version: 1, subscribed: false, subscription_changed: true, runtime: { state: 'failed', error: 'retained dependency', pending: ['old-layer'], records: [] } } };
  const html = render(() => createElement(TrackActionFeedback, { outcome: value as any }), signedOut);
  assert.match(html, /data-confirmed="false"/); assert.match(html, /inactive/); assert.match(html, /Reported spend for this request/);
  assert.match(html, /retained dependency/); assert.match(html, /old-layer/); assert.doesNotMatch(html, /nothing new|were confirmed/);
  const legacy = render(() => createElement(TrackActionFeedback, { outcome: { ...value, receipt: undefined, ok: true } as any }), signedOut);
  assert.match(legacy, /data-confirmed="false"/); assert.match(legacy, /states are unconfirmed/);
  const tiny = render(() => createElement(TrackActionFeedback, { outcome: { ...value, spent: [{ amount: '0.00000003', currency: 'CREDIT' }] } as any }), signedOut);
  assert.match(tiny, /0\.00000003/);
});
test('track review shows fee-inclusive spend and model changes before subscribe or sync', () => {
  const review = trackReviewFixture();
  const props = { branch: 'selected', action: 'subscribe' as const, review, busy: false, error: null, onRetry() {}, onConfirm() {}, onClose() {} };
  const html = render(() => createElement(TrackReviewSheet, props), signedOut);
  assert.match(html, /Maximum spend for this request/); assert.match(html, /Included curation fee/); assert.match(html, /New knowledge/);
  assert.match(html, /Model layers: add 1/); assert.match(html, /automatically/); assert.match(html, /track-review-confirm/);
  assert.doesNotMatch(html.match(/<button[^>]*data-testid="track-review-confirm"[^>]*>/)![0], /disabled/);
  const sync = { ...review, action: 'sync' as const, quote: { ...review.quote, subscribed: true }, fee: { amount: '0', currency: 'CREDIT' }, total: [{ amount: '2', currency: 'CREDIT' }] };
  const text = render(() => createElement(TrackReviewSheet, { ...props, action: 'sync', review: sync }), signedOut);
  assert.match(text, /Review sync/); assert.match(text, /Sync · up to/); assert.doesNotMatch(text, /automatically, until you unsubscribe/);
});
test('missing, pending, failed and overlapping track reviews keep confirmation disabled', () => {
  const base = { branch: 'selected', action: 'sync' as const, review: trackReviewFixture(), busy: false, error: null as string | null, onRetry() {}, onConfirm() {}, onClose() {} };
  for (const props of [{ ...base, review: null }, { ...base, busy: true }, { ...base, error: 'price changed' },
    { ...base, review: { ...base.review, overlaps: [{ track_id: 'new', loaded_id: 'manual', loaded_reason: 'manual', rows: 2, estimated: false }] } }]) {
    const html = render(() => createElement(TrackReviewSheet, props), signedOut);
    assert.match(html.match(/<button[^>]*data-testid="track-review-confirm"[^>]*>/)![0], /disabled/);
  }
});
test('track cards cannot use another account’s quote or offer signed-out mutations', () => {
  const branch = trackBranches(['selected']).branches[0];
  const card = () => createElement(TrackCard, { branch, subscribed: false, currency: 'AIN', address: walletAddress });
  const foreign: Fixture = { name: 'trackQuote', arg: { name: branch.name, identity: 'other-account' }, value: { quote: { branch: branch.name, items: [{ plan: 'buy', price: '9876543', currency: 'AIN' }], total: [{ amount: '9876543', currency: 'AIN' }] } } };
  const html = render(card, [...signedOut, foreign], '/dashboard');
  assert.doesNotMatch(html, /9876543/);
  const button = html.match(/<button[^>]*data-testid="track-subscribe"[^>]*>/)?.[0]; assert.ok(button); assert.match(button, /disabled/);
});
test('track cards confirm current file aliases and keep failed, foreign or ID-only evidence unknown', () => {
  const branch = trackBranches(['new']).branches[0];
  const q = trackReviewFixture().quote; q.branch = q.subscription!.branch = branch.name; q.owner = q.subscription!.owner = branch.owner;
  const quote: Fixture = { name: 'trackQuote', arg: { name: branch.name, identity: accountIdentity }, value: { quote: q } };
  const fixture: Fixture = { name: 'runtime', arg: { identity: accountIdentity }, value: { available: true, hook: true, applied: ['physical-alias'], stack: [{ patch_id: 'physical-alias', sha256: 'file', reason: 'manual', applied_at: 1, position: 0 }] } };
  const card = () => createElement(TrackCard, { branch, subscribed: true, currency: 'AIN', address: walletAddress });
  const loaded = render(card, [...appAccount, quote, fixture], '/dashboard');
  assert.match(loaded, /Recorded as loaded on this node: 1 of 1 current track items/); assert.doesNotMatch(loaded, /no load record for/);
  for (const failure of [{ ...fixture, status: 'rejected' as const }, { ...fixture, arg: { identity: 'other account' } }, { ...fixture, value: { available: true, hook: true, applied: ['new'] } }]) {
    const unknown = render(card, [...appAccount, quote, failure], '/dashboard');
    assert.match(unknown, /current track files and model load records could not be confirmed/); assert.doesNotMatch(unknown, /Recorded as loaded|no load record for/);
  }
});
test('track cards label bounded settlement statistics and suppress stale or foreign history', () => {
  const branch = trackBranches(['new']).branches[0];
  const history = ledgerFixture([ledgerRecord('subscribe', { node: 'n', branch: branch.name, action: 'subscribe' }),
    ledgerRecord('settle', { patch_id: 'new', buyer: 'buyer', seller: 'seller', scheme: 'local-credit', tx_hash: 'tx', currency: 'CREDIT', amount: '0.00000001' })]);
  history.info.records = 9000;
  const ledger: Fixture = { name: 'ledger', arg: { limit: 5000, identity: accountIdentity }, value: history };
  const card = () => createElement(TrackCard, { branch, subscribed: true, currency: 'AIN', address: walletAddress });
  const html = render(card, [...appAccount, ledger], '/dashboard');
  assert.match(html, /latest 2 of 9000 records/); assert.match(html, /1 subscription records/); assert.match(html, /gross amount 0\.00000001/);
  assert.doesNotMatch(html, /ever joined|earned/);
  for (const failure of [{ ...ledger, status: 'rejected' as const }, { ...ledger, arg: { limit: 5000, identity: 'foreign' } }]) {
    const unknown = render(card, [...appAccount, failure], '/dashboard');
    assert.doesNotMatch(unknown, /9000|gross amount|1 subscription records/); assert.match(unknown, /track-stats-unknown/);
  }
});
test('dashboard track lists ignore foreign membership and malformed responses instead of rendering arbitrary cards', () => {
  const foreign = render(DashboardContent, [...signedOut, ...inventoryFixtures.filter(f => f.name !== 'branches'),
    { name: 'branches', arg: { identity: 'foreign' }, value: trackBranches() }], '/dashboard');
  assert.doesNotMatch(foreign, /data-testid="track-card"/);
  const malformed = render(DashboardContent, [...signedOut, ...inventoryFixtures.filter(f => f.name !== 'branches'),
    { name: 'branches', arg: { identity: '' }, value: { branches: [{ name: 'Wrong malformed track' }], mine: [] } }], '/dashboard');
  assert.doesNotMatch(malformed, /Wrong malformed track|data-testid="track-card"/); assert.match(malformed, /query-retry/);
});
test('track cards distinguish no runnable items from retirement and never invent paid coverage or a spending forecast', () => {
  const branch = trackBranches(['new']).branches[0]; branch.current = [];
  const q = trackReviewFixture().quote; q.branch = q.subscription!.branch = branch.name; q.owner = q.subscription!.owner = branch.owner;
  q.items[0].plan = 'blocked'; q.current = []; q.buy = []; q.subscription!.due = false; q.subscription!.paid_until = null;
  q.subscription!.run_rate.knowledge_added = 3; q.subscription!.run_rate.per_30_days = '987654321';
  const quote: Fixture = { name: 'trackQuote', arg: { name: branch.name, identity: accountIdentity }, value: { quote: q } };
  const runtime: Fixture = { name: 'runtime', arg: { identity: accountIdentity }, value: { available: true, hook: true, applied: [], stack: [] } };
  const html = render(() => createElement(TrackCard, { branch, subscribed: true, currency: 'AIN', address: 'another-node' }), [...appAccount, quote, runtime], '/dashboard');
  assert.match(html, /no current items to load/); assert.match(html, /Paid coverage is unconfirmed/); assert.match(html, /3 knowledge items added/);
  assert.doesNotMatch(html, /1970-01-01|987654321|0 of 0|retired/);
});

const runtimeStatusOperation = () => prepareRuntimeOperation('test-owner', manageFixture().anchor, 'load', false, [],
  { instance: 'a'.repeat(32), server_time: 1_800_000_000_000, request_window_ms: 600_000, apply_preview: true }, 'b'.repeat(32), runtimeReviewFixture());
const runtimeStatusProps = () => ({ operation: runtimeStatusOperation(), review: null, onRetry() {}, onReview() {}, onCloseReview() {}, onDismiss() {} });
test('runtime progress names the selected target and distinguishes queue, execution and confirmation', () => {
  for (const [phase, label] of [['submitting', 'Sending request'], ['checking', 'Checking existing operation'], ['queued', 'Waiting in queue'], ['running', 'Running'], ['confirming', 'Confirming current load records']] as const) {
    const html = render(() => createElement(RuntimeOperationStatus, { ...runtimeStatusProps(), phase, checking: true }), signedOut);
    assert.match(html, /Knowledge chosen/); assert.ok(html.includes(label)); assert.match(html, /role="status"/);
    assert.doesNotMatch(html, /runtime-operation-retry|runtime-operation-dismiss/);
  }
});
test('interrupted runtime tracking offers read-only recheck and explicit record review, without claiming success', () => {
  const html = render(() => createElement(RuntimeOperationStatus, { ...runtimeStatusProps(), phase: 'interrupted', checking: false, error: 'Original request retained after disconnect' }), signedOut);
  assert.match(html, /Result needs checking/); assert.match(html, /Original request retained after disconnect/); assert.match(html, /role="alert"/); assert.match(html, /Check operation again/); assert.match(html, /Review current records/);
  assert.match(html, /runtime-operation-retry/); assert.doesNotMatch(html, /runtime-operation-dismiss|Confirmed load record/);
});
test('closing runtime tracking requires a record review and says it does not cancel server work', () => {
  const row = { patch_id: 'original-id', name: 'Actual loaded layer', sha256: 'abcdef1234567890' } as any;
  const html = render(() => createElement(RuntimeOperationStatus, { ...runtimeStatusProps(), phase: 'interrupted', checking: false, review: [row] }), signedOut);
  assert.match(html, /runtime-operation-review-sheet/); assert.match(html, /does not cancel server work/);
  assert.match(html, /Actual loaded layer/); assert.match(html, /original-id/); assert.match(html, /abcdef123456/);
  assert.match(html, /Acknowledge records and close tracking/); assert.match(html, /runtime-operation-dismiss/);
});

test('runtime review lists exact targets and exposes file details before confirmation', () => {
  const review = runtimeReviewFixture();
  const html = render(() => createElement(RuntimeApplyReview, { review, busy: false, onClose() {}, onConfirm() {} }), signedOut);
  assert.match(html, /Review model changes/); assert.match(html, /Knowledge chosen/); assert.match(html, /fixture-sha/);
  assert.match(html, /Apply reviewed changes/); assert.match(html, /<details/); assert.doesNotMatch(html, /Already loaded/);
});
test('runtime review distinguishes an existing alias and keeps confirmation disabled during submission', () => {
  const review = runtimeReviewFixture();
  review.before = review.after = [{ patch_id: 'physical-alias', sha256: review.order[0].anchor.patch_sha256 }];
  review.order[0].physical_id = 'physical-alias'; review.order[0].action = 'reuse';
  const html = render(() => createElement(RuntimeApplyReview, { review, busy: true, onClose() {}, onConfirm() {} }), signedOut);
  assert.match(html, /Already loaded/); assert.match(html, /Same file · layer: physical-alias/); assert.match(html, /Keep 1 existing layers/);
  assert.match(html, /disabled=""/);
});

test('track creation requires current operator access and both validated current lists', () => {
  const data: Fixture[] = [
    { name: 'myPatches', arg: { identity: accessIdentity }, value: { items: [] } },
    { name: 'branches', arg: { identity: accessIdentity }, value: { branches: [], mine: [] } },
  ];
  const enabled = render(DashboardContent, [...accessAuth, ...data], '/dashboard');
  assert.match(enabled, /<fieldset style=/); assert.doesNotMatch(enabled, /<fieldset disabled/);
  for (const fixtures of [appAccount, [...accessAuth, data[0]], [...accessAuth, data[1]],
    [...accessAuth, data[0], { ...data[1], status: 'rejected' as const }]]) {
    const unavailable = render(DashboardContent, fixtures, '/dashboard');
    assert.match(unavailable, /<fieldset disabled/);
  }
});


test('track addition review identifies the chosen item, replacement effects and exact price', () => {
  const review = additionFixture();
  const html = render(() => createElement(TrackAdditionSheet, { review, busy: false, error: null, done: false, onClose() {}, onConfirm() {}, onRefresh() {} }), signedOut);
  assert.match(html, /law\/KR/); assert.match(html, /Selected knowledge/); assert.match(html, /new%2Fid%3F%23/);
  assert.match(html, /0.00000001 AIN/); assert.match(html, /Replaces: old/); assert.match(html, /Subscribers may buy and load/);
  assert.match(html, /data-testid="track-add-confirm"/);
});
test('track addition cannot confirm missing, failed, already-present or completed reviews', () => {
  const review = additionFixture();
  for (const props of [{ review: null, busy: true, error: null, done: false },
    { review, busy: false, error: 'Review changed', done: false }]) {
    const html = render(() => createElement(TrackAdditionSheet, { ...props, onClose() {}, onConfirm() {}, onRefresh() {} }), signedOut);
    const button = html.match(/<button[^>]*data-testid="track-add-confirm"[^>]*>/)?.[0]; assert.ok(button); assert.match(button, /disabled/);
  }
  for (const props of [{ review: { ...review, already: true, replaces: [] }, done: false }, { review, done: true }]) {
    const html = render(() => createElement(TrackAdditionSheet, { ...props, busy: false, error: null, onClose() {}, onConfirm() {}, onRefresh() {} }), signedOut);
    assert.doesNotMatch(html, /data-testid="track-add-confirm"/);
  }
});


test('purchase table shows exact receipt units, current file records and encoded destinations', () => {
  const row = purchaseFixture(); row.patch_id = row.entry.anchor.id = 'selected/a?#'; row.entry.anchor.currency = 'CREDIT';
  const data: Fixture[] = [{ name: 'myPurchases', arg: { identity: accessIdentity }, value: { items: [row] } },
    { name: 'runtime', arg: { identity: accessIdentity }, value: { available: true, hook: true, applied: ['alias'], stack: [{ patch_id: 'alias', sha256: 'file', reason: 'manual', applied_at: 1, position: 0 }] } }];
  const html = render(DashboardContent, [...accessAuth, ...data], '/dashboard');
  assert.match(html, /0.00000001 AIN/); assert.doesNotMatch(html, /999 CREDIT/); assert.match(html, /Recorded as alias/);
  assert.match(html, /href="[^"]*selected%2Fa%3F%23/);
});
test('purchase failures, old account caches and missing receipt evidence are not empty or paid claims', () => {
  const row = purchaseFixture(); delete row.payment;
  const own: Fixture = { name: 'myPurchases', arg: { identity: accessIdentity }, value: { items: [row] } };
  const missing = render(DashboardContent, [...accessAuth, own], '/dashboard');
  assert.match(missing, /Payment amount and currency are unconfirmed/); assert.doesNotMatch(missing, /999 (?:AIN|CREDIT)/);
  for (const fixture of [{ ...own, arg: { identity: 'previous-account' } }, { ...own, status: 'rejected' as const },
    { ...own, value: { items: [{}] } }]) {
    const html = render(DashboardContent, [...accessAuth, fixture], '/dashboard');
    assert.doesNotMatch(html, /data-testid="purchase-paid"/);
    assert.doesNotMatch(html, /No purchases yet/);
  }
});
test('changed purchased files retain inspection but do not offer a live test of different bytes', () => {
  const row = purchaseFixture(); row.entry.anchor.patch_sha256 = 'different';
  const html = render(DashboardContent, [...accessAuth, { name: 'myPurchases', arg: { identity: accessIdentity }, value: { items: [row] } }], '/dashboard');
  assert.match(html, /current item differs from the purchased file/); assert.doesNotMatch(html, /href="\/chat\/selected"/);
});

test('collection offers only the missing-file action and disables it for visitors', () => {
  const d = manageFixture();
  const page = () => createElement(CollectKnowledge, { target: d.anchor, hasBody: false });
  const visitor = render(page, signedOut);
  const button = visitor.match(/<button[^>]*data-testid="buy-collect"[^>]*>/)?.[0];
  assert.ok(button); assert.match(button, /disabled/);
  assert.doesNotMatch(visitor, /data-testid="buy-collected"|The payment is done/);
  const owner = render(page, accessAuth);
  assert.doesNotMatch(owner.match(/<button[^>]*data-testid="buy-collect"[^>]*>/)?.[0] ?? '', /disabled/);
  const held = render(() => createElement(CollectKnowledge, { target: d.anchor, hasBody: true }), accessAuth);
  assert.doesNotMatch(held, /buy-collect|buy-collected/);
});

test('purchase response uses separate exact units and refuses stale or unrelated outcomes', () => {
  const d = manageFixture();
  const receipt: any = { receipt_version: 1, node: walletAddress, patch_id: d.anchor.id, amount: '0.00000001', currency: 'AIN', scheme: 'ain-transfer', tx_hash: 'tx', path: '/file',
    manifest: { id: d.anchor.id, patch_sha256: d.anchor.patch_sha256, blob_urls: [] }, steps: [],
    purchases: [{ patch_id: 'base', amount: '2', currency: 'CREDIT', scheme: 'local-credit', tx_hash: 'base-tx' },
      { patch_id: d.anchor.id, amount: '0.00000001', currency: 'AIN', scheme: 'ain-transfer', tx_hash: 'tx' }],
    totals: [{ amount: '0.00000001', currency: 'AIN' }, { amount: '2', currency: 'CREDIT' }] };
  const html = render(() => createElement(PurchaseTimeline, { r: receipt, d }), accessAuth);
  assert.match(html, /reported charges: 0.00000001 AIN \+ 2 CREDIT/);
  assert.doesNotMatch(html, /Bought —|nothing was charged/);
  for (const r of [{ ...receipt, receipt_version: undefined }, { ...receipt, node: accessTarget }, { ...receipt, patch_id: 'other' }]) {
    const unknown = render(() => createElement(PurchaseTimeline, { r, d }), accessAuth);
    assert.match(unknown, /does not confirm the selected purchase/); assert.doesNotMatch(unknown, /reported charges:/);
  }
});

test('purchase review shows exact per-currency limits and the selected prerequisite actions', () => {
  const review = purchaseReviewFixture();
  const html = render(() => createElement(PurchaseReviewSheet, { ...purchaseSheetProps(), review }), signedOut);
  assert.match(html, /Maximum charge: 0.00000001 AIN \+ 2 CREDIT/); assert.match(html, /View 2 items/);
  assert.match(html, /Each item is paid separately/); assert.match(html, /Loading them into a model is a separate action/);
  assert.match(html, /purchase-review-confirm/);
});
test('purchase confirmation is unavailable before valid review or after submission', () => {
  for (const overrides of [{ review: null }, { error: 'Changed price' }, { busy: true }]) {
    const html = render(() => createElement(PurchaseReviewSheet, { ...purchaseSheetProps(), review: purchaseReviewFixture(), ...overrides }), signedOut);
    const button = html.match(/<button[^>]*data-testid="purchase-review-confirm"[^>]*>/)?.[0]; assert.ok(button); assert.match(button, /disabled/);
  }
  const { op, request } = purchaseRequestFixture(); request.state = 'running'; request.result = null;
  const submitted = render(() => createElement(PurchaseReviewSheet, { ...purchaseSheetProps(), review: op.review, request, submitted: true }), signedOut);
  assert.doesNotMatch(submitted, /purchase-review-confirm/); assert.match(submitted, /only reads records/);
});
test('partial purchase outcomes label completed charges without claiming overall success', () => {
  const { op, request } = purchaseRequestFixture(); request.result.state = 'incomplete';
  request.result.items[1] = { id: 'root', state: 'failed', error: 'Payment response lost' };
  request.result.confirmed_totals = [{ amount: '2', currency: 'CREDIT' }];
  const html = render(() => createElement(PurchaseReviewSheet, { ...purchaseSheetProps(), review: op.review, request, submitted: true }), signedOut);
  assert.match(html, /Confirmed charges for completed items: 2 CREDIT/); assert.match(html, /may already have been charged/);
  assert.match(html, /Completion unconfirmed/); assert.doesNotMatch(html, /storage of the selected files are confirmed/);
});
test('chat picker offers a purchase review and preserves small exact prices', () => {
  const row: any = { patch_id: 'selected', name: 'Selected knowledge', author: accessTarget, author_name: null,
    price: '0.00000001', currency: 'AIN', status: 'VERIFIED', rows: 1, queries: 1, reason: 'not_held', buyable: true, requests: 0, gateway_url: null };
  const html = render(() => createElement(KnowledgePicker, { items: [], selectedIds: [], runtime: undefined, lock: null,
    onToggle() {}, onClear() {}, elsewhere: [row], operator: true }), accessAuth, '/chat');
  assert.match(html, /0.00000001 AIN/); assert.match(html, /Review purchase/);
  assert.doesNotMatch(html, /Buy for 0 AIN/);
});

test('purchase reconciliation distinguishes evidence and offers collection only with confirmed access', () => {
  const { op, request, reconciliation } = reconciliationFixture(); request.state = 'interrupted'; request.result = null;
  reconciliation.state = 'incomplete';
  Object.assign(reconciliation.items[0], { state: 'paid_missing_file', has_body: false, can_collect: true });
  Object.assign(reconciliation.items[1], { state: 'unconfirmed', payment: null });
  const view = () => createElement(PurchaseReviewSheet, { ...purchaseSheetProps(), review: op.review, request, reconciliation, submitted: true });
  const html = render(view, accessAuth);
  assert.match(html, /Ledger settlement record/); assert.match(html, /Outcome unknown/);
  assert.match(html, /data-testid="collect-knowledge"/); assert.doesNotMatch(html, /purchase-review-confirm/);
  reconciliation.items[0].can_collect = false;
  const noAccess = render(view, accessAuth);
  assert.doesNotMatch(noAccess, /data-testid="collect-knowledge"/); assert.match(noAccess, /current download access is unconfirmed/);
});
test('recovered current status precedes a collapsed historical failure and no new confirmation', () => {
  const { op, request, reconciliation } = reconciliationFixture(); request.state = 'failed'; request.error = 'Old interrupted execution';
  const html = render(() => createElement(PurchaseReviewSheet, { ...purchaseSheetProps(), review: op.review, request, reconciliation, submitted: true, verified: true }), accessAuth);
  assert.match(html, /<details data-testid="purchase-recorded-history"><summary>View earlier execution result/);
  assert.ok(html.indexOf('purchase-reconciliation') < html.indexOf('purchase-recorded-history'));
  assert.match(html, /storage of the selected files are confirmed/); assert.doesNotMatch(html, /purchase-review-confirm/);
});

test('visitor demand counts are retained records rather than identifiable people', () => {
  const row: any = { patch_id: 'selected', name: 'Selected knowledge', author: accessTarget, author_name: null,
    price: '0.00000001', currency: 'AIN', status: 'VERIFIED', rows: 1, queries: 1, reason: 'not_held', buyable: true, requests: 601, gateway_url: null };
  const html = render(() => createElement(KnowledgePicker, { items: [], selectedIds: [], runtime: undefined, lock: null,
    onToggle() {}, onClear() {}, elsewhere: [row], operator: false }), signedOut, '/chat');
  assert.match(html, /601 retained requests/); assert.match(html, /Ask operator to add it/);
  assert.match(html, /does not purchase or load knowledge/); assert.doesNotMatch(html, /visitors have asked|Review purchase/);
  assert.match(html, /white-space:normal;max-width:100%/);
});
test('network demand confirmation does not claim the current person submitted it', () => {
  const status = { ...demandFixture(true), actor: null, scope: 'network' as const };
  const html = render(() => createElement(RequestKnowledgeFeedback, { status, requests: 999 }), signedOut);
  assert.match(html, /2 retained requests/); assert.match(html, /A request from this network is recorded/);
  assert.doesNotMatch(html, /Your request is recorded|999|visitors have asked/);
});
test('testable picker items retain small positive prices instead of rounding them to zero', () => {
  const entry = manageFixture('tiny-price'); entry.anchor.price = '0.00000001'; entry.anchor.currency = 'AIN';
  const html = render(() => createElement(KnowledgePicker, { items: [entry], selectedIds: [], runtime: undefined, lock: null,
    onToggle() {}, onClear() {} }), signedOut, '/chat');
  assert.match(html, /0.00000001 AIN/);
});

import BillingPage, { BillingSentStatus } from '../src/screens/BillingPage';
import { billingQuote, billingSubject, billingNode, billingHash } from './billing-safety-fixture';
const billingIdentity = JSON.stringify([billingSubject, null, null, null]);
const billingAuth: Fixture[] = [...signedOut.filter(f => f.name !== 'me'), { name: 'me', value: { signedIn: true, subject: billingSubject, address: billingNode } }];
const billingArg = { model: 'M', token: 'sAIN', identity: billingIdentity, amount: '1' };
const billingModels: Fixture = { name: 'models', value: { data: [{ id: 'M', modality: 'chat', available: true }] } };
test('billing renders only a current account quote and preserves complete login return parameters', () => {
  const fixtures = [...billingAuth, billingModels, { name: 'throughputQuote', arg: billingArg, value: billingQuote() }];
  assert.match(render(BillingPage, fixtures, '/billing?model=M&amount=1'), /data-testid="billing-now"/);
  const other = render(BillingPage, [...billingAuth, billingModels, { name: 'throughputQuote', arg: { ...billingArg, identity: 'previous' }, value: billingQuote() }], '/billing?model=M&amount=1');
  assert.doesNotMatch(other, /data-testid="billing-now"/);
  const anon = render(BillingPage, [...signedOut, billingModels, { name: 'throughputQuote', arg: { ...billingArg, identity: '' }, value: { ...billingQuote(), you: null } }], '/billing?model=M&amount=1&token=sAIN#deposit');
  assert.match(anon, /next=%2Fbilling%3Fmodel%3DM%26amount%3D1%26token%3DsAIN%23deposit/);
});
test('billing malformed, wrong-wallet and failed quotes do not become a spinner or stale success', () => {
  for (const fixture of [{ value: {} }, { value: { ...billingQuote(), you: { ...billingQuote().you, address: billingNode } } }, { value: billingQuote(), status: 'rejected' as const }]) {
    const html = render(BillingPage, [...billingAuth, billingModels, { name: 'throughputQuote', arg: billingArg, ...fixture }], '/billing?model=M&amount=1');
    assert.doesNotMatch(html, /data-testid="billing-now"/); assert.match(html, /Check again/);
  }
});
test('billing failed model lists differ from empty lists and invalid URL tokens require a choice', () => {
  for (const fixture of [{ value: {} }, { status: 'rejected' as const }]) {
    const html = render(BillingPage, [...billingAuth, { name: 'models', ...fixture }], '/billing');
    assert.match(html, /Could not verify the model list/); assert.doesNotMatch(html, /This node serves no chat model/);
  }
  assert.match(render(BillingPage, [...billingAuth, { name: 'models', value: { data: [] } }], '/billing'), /This node serves no chat model/);
  assert.match(render(BillingPage, [...billingAuth, billingModels], '/billing?token=invalid'), /token in this link is not supported/);
});
test('deposit credit feedback retains exact units without promising throughput refreshed', () => {
  const send = { txHash: billingHash, chain: { chain: 'base-sain', chainId: 8453, token: billingNode, symbol: 'sAIN' as const, decimals: 18, confirmations: 30 } };
  const confirmed = render(() => createElement(BillingSentStatus, { send, credited: true, sain: '0.000000000000000001', error: undefined }), signedOut);
  assert.match(confirmed, /0.000000000000000001 sAIN/); assert.doesNotMatch(confirmed, /numbers above are updated/);
  const failed = render(() => createElement(BillingSentStatus, { send, credited: false, sain: null, error: { status: 503 } }), signedOut);
  assert.match(failed, /Could not check/); assert.doesNotMatch(failed, /No node credit confirmed yet/);
});

test('model playground displays its runnable sample and key-dependent actions are unavailable without a key', () => {
  const chat = () => createElement(ModelPlaygroundPanel, { model: { id: 'selected-chat', modality: 'chat', available: true }, signInNext: '/models/selected-chat' });
  const html = render(chat, signedOut, '/models/selected-chat');
  assert.match(html, /Hello! Introduce yourself in one sentence/); assert.match(html, /API code for the selected model and current input/);
  for (const modality of ['embedding', 'speech', 'music'] as const) {
    const page = () => createElement(ModelPlaygroundPanel, { model: { id: 'selected', modality, available: true }, signInNext: '/models/selected' });
    const html = render(page, signedOut, '/models/selected');
    assert.match(html, /data-testid="models-key-required"/); assert.match(html, /<button(?=[^>]*data-testid="models-run")(?=[^>]*disabled)[^>]*>/);
    assert.doesNotMatch(html, /tries left this hour/);
  }
});
test('model page key creation clearly identifies a personal key and points organization management to the account', () => {
  const html = render(Playground, [...appAccount, noKeys], '/models/fixture-model');
  assert.match(html, /Create a personal key/);
});


test('malformed API key lists show recovery rather than crashing or claiming no keys', () => {
  for (const value of [{}, { keys: null }, { keys: [{}] }, { keys: [{ prefix: 'deadbeef', issuedAt: 1, label: {} }] }]) {
    for (const Page of [MyPage, Playground]) {
      const html = render(Page, [...appAccount, accountOrgs, { ...noKeys, value }], '/me');
      assert.match(html, /The key list could not be verified/);
      assert.doesNotMatch(html, /No keys yet/);
      assert.match(html, /Try again/);
    }
  }
});

test('a new node cannot borrow the previous node key list for the same account', () => {
  const html = render(MyPage, [
    ...appAccount.map((fixture) => fixture.name === 'me' ? { ...fixture, value: { ...(fixture.value as object), address: '0x' + 'b'.repeat(40) } } : fixture),
    accountOrgs, { ...noKeys, value: { keys: [{ prefix: 'deadbeef', issuedAt: 1, label: 'Old node key' }] } },
  ], '/me');
  assert.doesNotMatch(html, /Old node key|No keys yet/);
});


test('keys with colliding display prefixes remain independently visible and manageable', () => {
  const first = 'deadbeef' + '1'.repeat(56), second = 'deadbeef' + '2'.repeat(56);
  const html = render(MyPage, [...appAccount, accountOrgs, { ...noKeys, value: { ...keyEvidence, keys: [
    { key_id: first, prefix: 'deadbeef', label: 'One', issuedAt: 1, org_id: null, disabled: false },
    { key_id: second, prefix: 'deadbeef', label: 'Two', issuedAt: 2, org_id: null, disabled: true },
  ] } }], '/me');
  assert.match(html, /One/); assert.match(html, /Two/);
  assert.ok(html.includes(first)); assert.ok(html.includes(second));
  assert.doesNotMatch(html, /The key list could not be verified/);
});

test('a list for a different principal or node never enables account key actions', () => {
  for (const mismatch of [{ owner: 'sso:somebody-else' }, { node: '0x' + 'b'.repeat(40) }, { complete: false }]) {
    const html = render(MyPage, [...appAccount, accountOrgs, { ...noKeys, value: { ...keyEvidence, ...mismatch, keys: [] } }], '/me');
    assert.match(html, /The key list could not be verified/);
    assert.doesNotMatch(html, /No keys yet/);
  }
});


test('revocation recovery exposes read-only inspection, explicit retry and confirmed acknowledgement separately', () => {
  const target = { version: 1 as const, id: '1'.repeat(32), context: { owner: 'sso:viewer', node: keyNode },
    key: { key_id: 'deadbeef' + '1'.repeat(56), prefix: 'deadbeef', label: 'Recovery target', org_id: null, disabled: false, issuedAt: 1 },
    requestedAt: 100, state: 'pending' as const };
  for (const status of ['unknown', 'present', 'changed', 'confirmed'] as const) {
    const action: Parameters<typeof KeyRevocationNotice>[0]['action'] = {
      operation: { ...target, state: status === 'confirmed' ? 'confirmed' : 'pending' }, status,
      error: null, ready: true, running: false, blocked: false, inspect: async () => {}, reload() {},
      start: async () => {}, retry: async () => {}, acknowledge: async () => {},
    };
    const Page = () => createElement(KeyRevocationNotice, { action });
    const html = render(Page, appAccount, '/me');
    assert.match(html, /Recovery target/); assert.ok(html.includes(target.key.key_id));
    if (status === 'present') assert.match(html, /Retry revoking this key/);
    else assert.doesNotMatch(html, /Retry revoking this key/);
    if (status === 'confirmed') { assert.match(html, /Done — close record/); assert.doesNotMatch(html, /Check status/); }
    else { assert.match(html, /Check status/); assert.doesNotMatch(html, /Done — close record/); }
  }
});

test('storage failures offer recovery without presenting a completed revocation', () => {
  const action: Parameters<typeof KeyRevocationNotice>[0]['action'] = {
    operation: null, status: 'unknown', error: 'storage', ready: false, running: false, blocked: false,
    inspect: async () => {}, reload() {}, start: async () => {}, retry: async () => {}, acknowledge: async () => {},
  };
  const Page = () => createElement(KeyRevocationNotice, { action });
  const html = render(Page, appAccount, '/me');
  assert.match(html, /request record could not be safely saved or read/);
  assert.match(html, /Try again/);
  assert.doesNotMatch(html, /revocation is confirmed|Retry revoking this key|Done — close record/);
});

function creationAction(status: Parameters<typeof KeyCreationNotice>[0]['action']['status']): Parameters<typeof KeyCreationNotice>[0]['action'] {
  const key = { key_id: 'deadbeef' + '1'.repeat(56), prefix: 'deadbeef', label: 'Creation target', org_id: null, disabled: status !== 'issued', issuedAt: 1 };
  return {
    operation: { version: 1, id: '1'.repeat(32), context: { node: keyNode, owner: 'sso:viewer' }, label: 'Creation target', orgId: null,
      requestedAt: 1, action: 'create', receipt: status === 'cancelled' ? { status, key: null } : ['issued', 'disabled', 'revoked'].includes(status) ? { status: status as 'issued' | 'disabled' | 'revoked', key } : null },
    status, secretHeld: false, error: null, ready: true, running: false, blocked: false,
    inspect: async () => {}, start: async () => {}, retry: async () => {}, cancel: async () => {}, acknowledge: async () => {}, reload() {},
  };
}

test('creation recovery distinguishes absent/unknown from cancellation and never offers clearing an unresolved request', () => {
  for (const status of ['unknown', 'not_found', 'cancelled'] as const) {
    const action = creationAction(status), Page = () => createElement(KeyCreationNotice, { action });
    const html = render(Page, appAccount, '/me');
    assert.match(html, /Creation target/);
    if (status === 'cancelled') { assert.match(html, /Done — close record/); assert.doesNotMatch(html, /Retry same request/); }
    else { assert.match(html, /Check status/); assert.match(html, /Retry same request/); assert.match(html, /Cancel if unissued/); assert.doesNotMatch(html, /Done — close record/); }
    if (status === 'not_found') assert.match(html, /does not confirm cancellation/);
  }
});

test('issued-without-secret is explained as a distinct outcome with exact-key management', () => {
  for (const status of ['issued', 'disabled', 'revoked'] as const) {
    const action = creationAction(status), Page = () => createElement(KeyCreationNotice, { action });
    const html = render(Page, appAccount, '/me');
    assert.ok(html.includes(action.operation!.receipt!.key!.key_id));
    assert.match(html, /href="\/me"/); assert.match(html, /Done — close record/);
    assert.doesNotMatch(html, /Retry same request|Cancel if unissued/);
    if (status !== 'revoked') assert.match(html, /server cannot return it again/);
    else assert.doesNotMatch(html, /server cannot return it again/);
  }
});

test('an unresolved cancellation can be checked or retried as cancellation, never as issuance', () => {
  const action = creationAction('unknown'); action.operation!.action = 'cancel';
  const Page = () => createElement(KeyCreationNotice, { action }), html = render(Page, appAccount, '/me');
  assert.match(html, /Check status|Cancel if unissued/);
  assert.doesNotMatch(html, /Retry same request|Done — close record/);
});

const catalogPeer = '0x' + 'b'.repeat(40);
const catalogOwn = { id: 'selected-model', modality: 'chat', available: true };
const catalogRows = [
  { ...catalogOwn, ref: `selected-model@${keyNode}`, node: { address: keyNode, name: 'Local node' }, local: true },
  { ...catalogOwn, ref: `selected-model@${catalogPeer}`, node: { address: catalogPeer, name: 'Selected peer' }, local: false },
];
const modelCatalogFixtures: Fixture[] = [
  ...signedOut, { name: 'models', value: { data: [catalogOwn] } }, { name: 'networkModels', value: { data: catalogRows } },
  { name: 'modelDetail', arg: catalogOwn.id, value: { ...catalogOwn, agents: 0 } },
  { name: 'agentsByModel', arg: catalogOwn.id, value: { agents: [] } },
];

test('model detail lists and counts the selected provider including newly qualified agent models', () => {
  const rows = [
    { ...detailAgent, id: 'local-full', name: 'Qualified local agent', model: `${catalogOwn.id}@${keyNode}` },
    { ...detailAgent, id: 'local-auto', name: 'Existing automatic agent', model: catalogOwn.id },
    { ...detailAgent, id: 'remote-full', name: 'Remote host using this provider', model: `${catalogOwn.id}@${keyNode}`, node: { address: catalogPeer, name: 'Remote host' } },
    { ...detailAgent, id: 'remote-auto', name: 'Wrong remote automatic agent', model: catalogOwn.id, node: { address: catalogPeer, name: 'Remote host' } },
    { ...detailAgent, id: 'other', name: 'Wrong provider agent', model: `${catalogOwn.id}@${catalogPeer}` },
  ];
  const fixtures = modelCatalogFixtures.map(f => f.name === 'agentsByModel' ? { ...f, value: { agents: rows } }
    : f.name === 'modelDetail' ? { ...f, value: { ...catalogOwn, agents: 99 } } : f);
  const html = render(ModelDetailPage, fixtures, `/models/${catalogOwn.id}?node=${keyNode}&modality=chat`, '/models/:id');
  assert.match(html, /Qualified local agent|Existing automatic agent|Remote host using this provider/);
  assert.doesNotMatch(html, /Wrong remote automatic agent|Wrong provider agent/);
  assert.match(html, /data-testid="model-agent-count">3<\/dd>/);
});

test('failed or malformed model-agent lists cannot show old cards or a confirmed zero count', () => {
  for (const fixture of [
    { value: {} }, { value: { agents: [null] } },
    { value: { agents: [{ ...detailAgent, name: 'Stale agent card', model: catalogOwn.id }] }, status: 'rejected' as const },
  ]) {
    const html = render(ModelDetailPage, modelCatalogFixtures.map(f => f.name === 'agentsByModel' ? { ...f, ...fixture } : f),
      `/models/${catalogOwn.id}?node=${keyNode}&modality=chat`, '/models/:id');
    assert.match(html, /The agents for this model could not be confirmed/);
    assert.match(html, /Retry now/);
    assert.match(html, /data-testid="model-agent-count">—<\/dd>/);
    assert.doesNotMatch(html, /Stale agent card|data-testid="model-agents-empty"/);
  }
});

test('model lists show errors and retry for malformed responses instead of configuration tips or an empty catalogue', () => {
  const bad = render(ModelsPage, modelCatalogFixtures.map(f => ['models', 'networkModels'].includes(f.name) ? { ...f, value: {} } : f), '/models');
  assert.match(bad, /models-list-incomplete|Retry now/);
  assert.doesNotMatch(bad, /No models to display|backends|model-card-selected-model/);
  const empty = render(ModelsPage, modelCatalogFixtures.map(f => ['models', 'networkModels'].includes(f.name) ? { ...f, value: { data: [] } } : f), '/models');
  assert.match(empty, /No models to display/); assert.doesNotMatch(empty, /models-list-incomplete/);
});

test('model list refresh errors do not render cached providers as currently answering', () => {
  const failed = render(ModelsPage, modelCatalogFixtures.map(f => f.name === 'networkModels' ? { ...f, status: 'rejected' as const } : f), '/models');
  assert.match(failed, /models-list-incomplete/); assert.doesNotMatch(failed, /Selected peer/);
  assert.match(failed, /node=local/); assert.match(failed, /model-card-selected-model/);
});

test('provider-specific model pages cannot fall back after the selected provider disappears or its list fails', () => {
  for (const network of [{ value: { data: [catalogRows[0]] } }, { status: 'rejected' as const, value: { data: catalogRows } }, { value: {} }]) {
    const html = render(ModelDetailPage, modelCatalogFixtures.map(f => f.name === 'networkModels' ? { ...f, ...network } : f),
      `/models/selected-model?node=${catalogPeer}&modality=chat`, '/models/:id');
    assert.match(html, /model-detail-provider_missing/); assert.match(html, /Retry now/);
    assert.doesNotMatch(html, /data-testid="models-run"|model-create-agent/);
  }
});

test('a chosen peer uses its own availability and reference even when a local model has the same name', () => {
  const html = render(ModelDetailPage, modelCatalogFixtures.map(f => f.name === 'models' ? { ...f, value: { data: [{ ...catalogOwn, available: false }] } }
    : f.name === 'modelDetail' ? { ...f, value: { ...catalogOwn, available: false, agents: 0 } } : f),
    `/models/selected-model?node=${catalogPeer}&modality=chat`, '/models/:id');
  assert.match(html, /advertised by provider/); assert.match(html, /data-testid="models-run"/);
  assert.ok(html.includes(`selected-model@${catalogPeer}`));
  assert.doesNotMatch(html, /model-create-agent|This model’s backend is not answering/);
});

test('unsupported model types and incomplete search results never claim no models exist', () => {
  const future = render(ModelsPage, modelCatalogFixtures.map(f => f.name === 'models' ? { ...f, value: { data: [{ id: 'future', modality: 'video' }] } }
    : f.name === 'networkModels' ? { ...f, value: { data: [] } } : f), '/models');
  assert.match(future, /not supported by this screen/); assert.doesNotMatch(future, /No models to display/);
  const failed = render(ModelsPage, modelCatalogFixtures.map(f => f.name === 'networkModels' ? { ...f, status: 'rejected' as const } : f), '/models?q=missing');
  assert.match(failed, /models-list-incomplete/); assert.doesNotMatch(failed, /No model matches/);
});

test('an ambiguous model name requires an explicit type instead of choosing the first matching entry', () => {
  const html = render(ModelDetailPage, modelCatalogFixtures.map(f => f.name === 'networkModels' ? { ...f, value: { data: [catalogRows[1], { ...catalogRows[1], modality: 'image' }] } } : f),
    `/models/selected-model?node=${catalogPeer}`, '/models/:id');
  assert.match(html, /model-detail-ambiguous/); assert.doesNotMatch(html, /data-testid="models-run"/);
});

test('an unresolved or unavailable target does not enable Run while preserving its input', () => {
  for (const ready of [false, true]) {
    const Page = () => createElement(ModelPlaygroundPanel, { model: { ...catalogOwn, available: !ready }, signInNext: '/models/selected-model', targetReady: ready, confirmTarget: async () => {} });
    const html = render(Page, signedOut, '/models/selected-model');
    assert.match(html, /Hello! Introduce yourself in one sentence/);
    assert.match(html, /<button(?=[^>]*data-testid="models-run")(?=[^>]*disabled)[^>]*>/);
  }
});

test('an older model response with no availability probe is unknown, not a confirmed outage or a runnable model', () => {
  const fixtures = modelCatalogFixtures.map(f => f.name === 'models' ? { ...f, value: { data: [{ id: catalogOwn.id, modality: 'chat' }] } }
    : f.name === 'modelDetail' ? { ...f, value: { id: catalogOwn.id, modality: 'chat', agents: 0 } }
    : f.name === 'networkModels' ? { ...f, value: { data: [] } } : f);
  const html = render(ModelDetailPage, fixtures, '/models/selected-model?node=local&modality=chat', '/models/:id');
  assert.match(html, /availability unknown/); assert.doesNotMatch(html, /backend is not answering/);
  assert.match(html, /<button(?=[^>]*data-testid="models-run")(?=[^>]*disabled)[^>]*>/);
});

test('the AinCode link describes opening a workspace without claiming it selects this model', () => {
  const id = 'DeepSeek-V4.1-Flash-1017';
  const fixtures = modelCatalogFixtures.map(f => f.name === 'models' ? { ...f, value: { data: [{ ...catalogOwn, id }] } }
    : f.name === 'modelDetail' ? { ...f, arg: id, value: { ...catalogOwn, id, agents: 0 } }
    : f.name === 'networkModels' ? { ...f, value: { data: [] } } : f.name === 'agentsByModel' ? { ...f, arg: id } : f);
  const html = render(ModelDetailPage, fixtures, `/models/${id}?node=local&modality=chat`, '/models/:id');
  assert.match(html, /Go to an AinCode workspace/); assert.match(html, /does not carry this page/);
  assert.match(html, /href="\/code\/"[^>]*data-testid="model-harness-open"|data-testid="model-harness-open"[^>]*href="\/code\/"/);
  assert.doesNotMatch(html, /Every AinCode workspace|default model/);
});


test('a local model page copies a provider-qualified API call and never an automatic model reference', () => {
  const fixtures = modelCatalogFixtures.map(f => f.name === 'me' ? { ...f, value: { signedIn: false, address: keyNode } } : f);
  const html = render(ModelDetailPage, fixtures, `/models/${catalogOwn.id}?node=${keyNode}&modality=chat`, '/models/:id');
  assert.ok(html.includes(`${catalogOwn.id}@${keyNode}`));
  assert.doesNotMatch(html, /<button(?=[^>]*data-testid="models-run")(?=[^>]*disabled)[^>]*>/);
  assert.doesNotMatch(html, /<button(?=[^>]*data-testid="models-copy")(?=[^>]*disabled)[^>]*>/);
});

test('a local playground without a confirmed provider retains input but cannot run or copy an automatic call', () => {
  const Page = () => createElement(ModelPlaygroundPanel, { model: catalogOwn, callModel: catalogOwn.id,
    signInNext: '/models/selected-model', targetReady: true, confirmTarget: async () => {} });
  const html = render(Page, signedOut, '/models/selected-model');
  assert.match(html, /Hello! Introduce yourself in one sentence/);
  for (const id of ['models-run', 'models-copy']) assert.match(html, new RegExp(`<button(?=[^>]*data-testid="${id}")(?=[^>]*disabled)[^>]*>`));
  assert.match(html, /data-testid="models-snippet"[^>]*><\/pre>/);
});


test('a model page explains unknown local identity and exposes reload instead of unpinned execution', () => {
  const html = render(ModelDetailPage, modelCatalogFixtures, `/models/${catalogOwn.id}?node=${keyNode}&modality=chat`, '/models/:id');
  assert.match(html, /serving node address could not be confirmed/);
  assert.match(html, /Retry now/);
  for (const id of ['models-run', 'models-copy', 'model-create-agent']) assert.match(html, new RegExp(`<button(?=[^>]*data-testid="${id}")(?=[^>]*disabled)[^>]*>`));
});


test('billing never selects the first model or keeps a quote after the selected registration becomes unknown', () => {
  const quote: Fixture = { name: 'throughputQuote', arg: billingArg, value: billingQuote() };
  const unselected = render(BillingPage, [...billingAuth, billingModels, quote], '/billing?amount=1');
  assert.match(unselected, /<option value="" selected="">Choose a model<\/option>/);
  assert.doesNotMatch(unselected, /data-testid="billing-now"|data-testid="billing-deposit"/);
  for (const fixture of [{ value: {} }, { value: billingModels.value, status: 'rejected' as const }, { value: { data: [{ id: 'Different', modality: 'chat', available: true }] } }, { value: { data: [{ id: 'M', modality: 'image', available: true }] } }]) {
    const html = render(BillingPage, [...billingAuth, { name: 'models', ...fixture }, quote], '/billing?model=M&amount=1');
    assert.doesNotMatch(html, /data-testid="billing-now"|data-testid="billing-deposit"|data-testid="billing-no-models"/);
    assert.match(html, /not confirmed/); assert.match(html, /Check again/);
    assert.match(html, /<option value="M" disabled="" selected="">/);
  }
});

test('project model suggestions do not replace repository-defined defaults or restrict custom identifiers', () => {
  for (const value of [undefined, 'external/custom-model', '']) {
    const Page = () => createElement(ProjectRunInput, { name: 'model', spec: { default: 'repository/default' }, value, models: ['unrelated', 'unrelated'], onChange() {} });
    const html = render(Page, signedOut);
    assert.match(html, /<input[^>]*list="in-model-models"/);
    assert.ok(html.includes(`value="${value ?? 'repository/default'}"`));
    assert.doesNotMatch(html, /<select/);
    assert.equal((html.match(/<option value="unrelated"/g) ?? []).length, 1);
  }
  const Page = () => createElement(ProjectRunInput, { name: 'model', spec: { default: 'repository/default' }, models: [], onChange() {} });
  assert.match(render(Page, signedOut), /value="repository\/default"/);
});

test('project enum inputs show a real blank selection and retain invalid preset values instead of the first option', () => {
  for (const value of [undefined, 'removed']) {
    const Page = () => createElement(ProjectRunInput, { name: 'model', spec: { type: 'choice', required: true, options: ['first', 'second'] }, value, models: ['unrelated'], onChange() {} });
    const html = render(Page, signedOut);
    assert.doesNotMatch(html, /unrelated|<option value="first" selected/);
    if (value === undefined) assert.match(html, /<option value="" selected="">Choose a value/);
    else assert.match(html, /<option value="removed" disabled="" selected="">removed · not an available choice/);
  }
});

test('project boolean and numeric defaults are visible actual values including false and zero', () => {
  const Bool = () => createElement(ProjectRunInput, { name: 'enabled', spec: { type: 'boolean', default: false }, models: [], onChange() {} });
  assert.match(render(Bool, signedOut), /<option value="false" selected="">No/);
  const Number = () => createElement(ProjectRunInput, { name: 'count', spec: { type: 'number', default: 0 }, models: [], onChange() {} });
  assert.match(render(Number, signedOut), /<input[^>]*value="0"/);
});


test('a failed project source refresh cannot leave its cached run form enabled', () => {
  const manifest = { kind: 'script', entry: 'main.py', inputs: { model: { default: 'source-model' } }, examples: [], detected: 'ainize.json' };
  const project = { ...rootProject, kind: 'script', manifest } as Project;
  const Page = () => createElement(ProjectConsole, { project });
  const fixtures: Fixture[] = [...appAccount,
    { name: 'project', arg: projectArg, value: project },
    { name: 'projectDeployments', arg: projectArg, value: { deployments: [] } },
    { name: 'projectRuns', arg: projectArg, value: { runs: [] } },
    { name: 'projectSource', arg: { ...projectArg, target: 'head' }, value: { repoId: 'repo', target: 'head', sha: 'a'.repeat(40), sourcePath: '', manifest }, status: 'rejected' },
  ];
  const html = render(Page, fixtures, '/studio/mono?tab=runs');
  assert.doesNotMatch(html, /value="source-model"|value="main.py"/);
  assert.match(html, /<button[^>]*disabled[^>]*>▶ /);
});


const multiRunManifest = { kind: 'nextjs', inputs: { topOnly: { default: 'top-only' } }, examples: [{ name: 'Top-level preset', inputs: { topOnly: 'top' } }], detected: 'ainize.json',
  run: [{ entry: 'scripts/seed.ts', name: 'Seed database', inputs: { collection: { default: 'selected-collection' } }, examples: [{ name: 'Seed preset', inputs: { collection: 'seeded' } }] },
    { entry: 'scripts/check.ts', inputs: {}, examples: [] }] } as Project['manifest'];
const multiRunProject = { ...rootProject, repoId: 'selected-repo', kind: 'nextjs', manifest: multiRunManifest } as Project;
const multiRunSource = { repoId: 'selected-repo', sourcePath: '', target: 'head', sha: 'a'.repeat(40), manifest: multiRunManifest };
const multiRunFixtures: Fixture[] = [...appAccount,
  { name: 'project', arg: projectArg, value: multiRunProject },
  { name: 'projectSource', arg: { ...projectArg, target: 'head' }, value: multiRunSource },
  { name: 'projectDeployments', arg: projectArg, value: { deployments: [] } },
  { name: 'projectRuns', arg: projectArg, value: { runs: [] } },
];

test('an app Run tab shows its declared script and that script’s inputs and examples', () => {
  const Page = () => createElement(ProjectConsole, { project: multiRunProject });
  const html = render(Page, multiRunFixtures, '/studio/mono?tab=runs');
  assert.match(html, /Seed database · scripts\/seed.ts/); assert.match(html, /selected-collection|Seed preset/);
  assert.doesNotMatch(html, /top-only|Top-level preset|not a script project/);
  assert.doesNotMatch(html, /<button(?=[^>]*data-testid="project-run-submit")(?=[^>]*disabled)[^>]*>/);
});

test('explicit run selection uses empty overrides or shows a missing target, never a different script', () => {
  for (const entry of ['scripts/check.ts', 'removed.ts']) {
    const Page = () => createElement(ProjectRunPanel, { project: multiRunProject, draft: { target: 'head', sha: '', entry, answers: {}, env: '', timeoutMs: '' }, setDraft() {}, onStarted() {} });
    const html = render(Page, multiRunFixtures, '/studio/mono?tab=runs');
    assert.doesNotMatch(html, /selected-collection|Seed preset|top-only|Top-level preset/);
    if (entry === 'removed.ts') {
      assert.match(html, /selected run target is not declared/);
      assert.match(html, /<option value="removed.ts" disabled="" selected="">/);
      assert.match(html, /<button(?=[^>]*data-testid="project-run-submit")(?=[^>]*disabled)[^>]*>/);
    } else assert.match(html, /<option value="scripts\/check.ts" selected="">/);
  }
});

test('wrong or malformed source evidence cannot enable a Run with unrelated input defaults', () => {
  const Page = () => createElement(ProjectConsole, { project: multiRunProject });
  for (const value of [{ ...multiRunSource, repoId: 'wrong' }, { ...multiRunSource, sourcePath: 'other-folder' }, { ...multiRunSource, manifest: {} }]) {
    const html = render(Page, multiRunFixtures.map(f => f.name === 'projectSource' ? { ...f, value } : f), '/studio/mono?tab=runs');
    assert.match(html, /Could not confirm the run settings/); assert.match(html, /Try again/);
    assert.doesNotMatch(html, /selected-collection|Seed preset/);
    assert.match(html, /<button(?=[^>]*data-testid="project-run-submit")(?=[^>]*disabled)[^>]*>/);
  }
});

test('a confirmed commit with no declared scripts remains selectable but cannot launch an arbitrary file', () => {
  const Page = () => createElement(ProjectConsole, { project: multiRunProject });
  const html = render(Page, multiRunFixtures.map(f => f.name === 'projectSource' ? { ...f, value: { ...multiRunSource, manifest: { ...multiRunManifest, run: [] } } } : f), '/studio/mono?tab=runs');
  assert.match(html, /does not declare any run targets/);
  assert.match(html, /id="run-target"/);
  assert.match(html, /<button(?=[^>]*data-testid="project-run-submit")(?=[^>]*disabled)[^>]*>/);
});

test('malformed run history cannot claim there are no runs or render a foreign record', () => {
  const Page = () => createElement(ProjectConsole, { project: multiRunProject });
  for (const value of [{}, { runs: [null] }, { runs: [{ id: 'foreign-run', projectId: 'other-project' }] }]) {
    const html = render(Page, multiRunFixtures.map(f => f.name === 'projectRuns' ? { ...f, value } : f), '/studio/mono?tab=runs');
    assert.match(html, /Could not load.*history|Try again/);
    assert.doesNotMatch(html, /No runs yet|foreign-run/);
  }
});


test('run history opens its own output and log and never links to an internal worker endpoint', () => {
  const Page = () => createElement(ProjectConsole, { project: multiRunProject });
  const record = { id: 'selected-run', projectId: rootProject.id, trigger: 'run', kind: 'nextjs', status: 'ready', sha: 'a'.repeat(40), ref: 'main', entry: 'scripts/check.ts',
    pusher: null, createdAt: 1, startedAt: 2, finishedAt: 3, ms: 1, inputKeys: [], envKeys: [],
    outputUrl: 'https://output.example/selected-run', logUrl: 'https://wrong.example/unrelated-log',
    placement: { address: keyNode, local: false, endpoint: 'http://10.0.0.1:3400', reason: 'scheduler internals' } };
  const html = render(Page, multiRunFixtures.map(f => f.name === 'projectRuns' ? { ...f, value: { runs: [record] } } : f), '/studio/mono?tab=runs&open=selected-run');
  assert.match(html, /href="https:\/\/output.example\/selected-run"/);
  assert.match(html, /href="\/api\/deployments\/selected-run\/log"/);
  assert.match(html, /scripts\/check.ts/); assert.match(html, /Prepare another run of this commit/);
  assert.doesNotMatch(html, /10\.0\.0\.1|wrong\.example|scheduler internals|Run again with these inputs/);
});

const deploymentFixture = (id: string, createdAt = 1): Deployment => ({ id, projectId: rootProject.id, trigger: 'push', kind: 'service', status: 'ready', sha: 'a'.repeat(40), ref: 'refs/heads/main',
  pusher: null, createdAt, startedAt: null, finishedAt: null, ms: null, logUrl: 'https://wrong.example/unrelated-log' });
const deploymentHistoryFixtures = (project: Project, rows: Deployment[]): Fixture[] => [...appAccount,
  { name: 'project', arg: projectArg, value: project },
  { name: 'projectDeployments', arg: projectArg, value: { deployments: rows } },
  { name: 'projectRuns', arg: projectArg, value: { runs: [] } },
];

test('deployment reads cannot crash on malformed rows or advertise zero records, redeploy or stale Visit on failure', () => {
  const old = { ...deploymentFixture('cached'), outputUrl: 'https://stale.example/', outputState: 'current' as const, visitUrl: 'https://stale.example/' };
  const project = { ...rootProject, lastDeploymentId: old.id, activeDeploymentId: old.id, lastDeployment: old };
  const Page = () => createElement(ProjectConsole, { project });
  for (const value of [{}, { deployments: [null] }, { deployments: [{ ...old, projectId: 'foreign' }] }]) {
    const html = render(Page, deploymentHistoryFixtures(project, []).map(f => f.name === 'projectDeployments' ? { ...f, value } : f), '/studio/mono');
    assert.match(html, /Could not load the history/);
    assert.doesNotMatch(html, /No deployments|Redeploy|>Visit|0 deployments/);
  }
  const failed = render(Page, deploymentHistoryFixtures(project, [old]).map(f => f.name === 'projectDeployments' ? { ...f, status: 'rejected' } : f), '/studio/mono');
  assert.match(failed, /Could not load the history/); assert.doesNotMatch(failed, /Redeploy|>Visit/);
});

test('header and expanded row label their exact redeploy commit without promising a rollback', () => {
  const old = deploymentFixture('older', 1), newer = { ...deploymentFixture('newer', 2), sha: 'b'.repeat(40) };
  const project = { ...rootProject, lastDeploymentId: newer.id };
  const Page = () => createElement(ProjectConsole, { project });
  const html = render(Page, deploymentHistoryFixtures(project, [old, newer]), '/studio/mono?open=older');
  assert.match(html, /Redeploy bbbbbbb/); assert.match(html, /Redeploy aaaaaaa/);
  assert.doesNotMatch(html, /Roll back/);
  assert.match(html, /current project settings/);
});

test('a deployment deep link on page three expands that exact record', () => {
  const rows = Array.from({ length: 25 }, (_, i) => deploymentFixture(`build-${i}`, 25 - i));
  const Page = () => createElement(ProjectConsole, { project: rootProject });
  const html = render(Page, deploymentHistoryFixtures(rootProject, rows), '/studio/mono?open=build-24');
  assert.match(html, /href="\/api\/deployments\/build-24\/log"/);
  assert.doesNotMatch(html, /href="\/api\/deployments\/build-0\/log"/);
});

test('an explicit missing deployment is visible as unavailable rather than opening a substitute', () => {
  const Page = () => createElement(ProjectConsole, { project: rootProject });
  const html = render(Page, deploymentHistoryFixtures(rootProject, [deploymentFixture('different')]), '/studio/mono?open=removed');
  assert.match(html, /selected record is not in the current list/); assert.match(html, /removed/);
  assert.doesNotMatch(html, /href="\/api\/deployments\/different\/log"/);
});

test('log selection reads the pinned older record and derives its raw link from the same id', () => {
  const Page = () => createElement(ProjectConsole, { project: rootProject });
  const fixtures = [...deploymentHistoryFixtures(rootProject, [deploymentFixture('old', 1), deploymentFixture('new', 2)]),
    { name: 'deploymentLog', arg: { id: 'old', identity: accountIdentity }, value: 'selected older build log' },
    { name: 'deploymentLog', arg: { id: 'new', identity: accountIdentity }, value: 'unrelated newer build log' },
  ];
  const html = render(Page, fixtures, '/studio/mono?tab=logs&record=old');
  assert.match(html, /<option value="old" selected/); assert.match(html, /selected older build log/);
  assert.match(html, /href="\/api\/deployments\/old\/log"/);
  assert.doesNotMatch(html, /unrelated newer build log|wrong\.example/);
});

test('missing log selection never falls back to the newest log', () => {
  const Page = () => createElement(ProjectConsole, { project: rootProject });
  const html = render(Page, [...deploymentHistoryFixtures(rootProject, [deploymentFixture('new', 2)]),
    { name: 'deploymentLog', arg: { id: 'new', identity: accountIdentity }, value: 'must not display' },
  ], '/studio/mono?tab=logs&log=build&record=removed');
  assert.match(html, /<option value="removed" selected/);
  assert.match(html, /selected record is not in the current list/);
  assert.doesNotMatch(html, /must not display|href="\/api\/deployments\/new\/log"|Download/);
});

test('failed or malformed log reads hide cached content and download rather than looking empty or crashing', () => {
  const Page = () => createElement(ProjectConsole, { project: rootProject });
  for (const f of [
    { value: 'cached log must not display', status: 'rejected' as const },
    { value: { data: 'not text' } },
  ]) {
    const html = render(Page, [...deploymentHistoryFixtures(rootProject, [deploymentFixture('new', 2)]),
      { name: 'deploymentLog', arg: { id: 'new', identity: accountIdentity }, ...f },
    ], '/studio/mono?tab=logs&log=build');
    assert.match(html, /Could not load the log/);
    assert.doesNotMatch(html, /cached log must not display|Download|not text/);
  }
});

test('historical app records do not expose Visit links to the currently running version', () => {
  const old = { ...deploymentFixture('old', 1), outputUrl: 'https://live-app.example/', outputState: 'current' as const, visitUrl: 'https://live-app.example/' }, current = { ...deploymentFixture('current', 2), outputUrl: 'https://live-app.example/', outputState: 'current' as const, visitUrl: 'https://live-app.example/' };
  const project = { ...rootProject, activeDeploymentId: 'current', lastDeploymentId: 'current' };
  const Page = () => createElement(ProjectConsole, { project });
  const html = render(Page, deploymentHistoryFixtures(project, [old, current]), '/studio/mono?open=old');
  assert.match(html, /href="\/api\/deployments\/old\/log"/);
  assert.doesNotMatch(html, /href="https:\/\/live-app.example\/"/);
  const active = render(Page, deploymentHistoryFixtures(project, [old, current]), '/studio/mono?open=current');
  assert.match(active, /href="https:\/\/live-app.example\/"/);
});

test('App Open can use a matching embedded active record without waiting for an unnecessary history fetch', () => {
  const app = { ...webApp, activeDeploymentId: 'current', lastDeployment: { ...deploymentFixture('current'), projectId: 'web', outputUrl: 'https://known-active.example/', outputState: 'current' as const, visitUrl: 'https://known-active.example/' } };
  const html = render(AppsPage, [...appAccount, appsFixture([app])], '/apps');
  assert.match(html, /href="https:\/\/known-active.example\/"/);
});

test('App Open cannot reuse cached active history after failure or accept malformed history', () => {
  const row = { ...deploymentFixture('previous'), projectId: 'web', outputUrl: 'https://cached-active.example/', outputState: 'current' as const, visitUrl: 'https://cached-active.example/' };
  for (const fixture of [{ value: { deployments: [row] }, status: 'rejected' as const }, { value: {} }]) {
    const html = render(AppsPage, [...appAccount, appsFixture([webApp]),
      { name: 'projectDeployments', arg: { id: 'web', identity: appsArg.principal }, ...fixture },
    ], '/apps');
    assert.doesNotMatch(html, /href="https:\/\/cached-active.example\/"/);
    assert.match(html, /Try again/);
  }
});

test('an unconfirmed app address offers a refresh without an Open link even when a stored output URL exists', () => {
  const row = { ...deploymentFixture('previous'), projectId: 'web', outputState: 'unconfirmed' as const, outputUrl: 'https://unconfirmed.example/' };
  const html = render(AppsPage, [...appAccount, appsFixture([webApp]),
    { name: 'projectDeployments', arg: { id: 'web', identity: appsArg.principal }, value: { deployments: [row] } },
  ], '/apps');
  assert.match(html, /current runtime address could not be confirmed/); assert.match(html, /Try again/);
  assert.doesNotMatch(html, /href="https:\/\/unconfirmed.example\/"/);
});

test('an agent deployment opens its conversation page and an unconfirmed runtime offers recovery', () => {
  const current = { ...deploymentFixture('agent-build'), kind: 'agent' as const, outputState: 'current' as const,
    outputUrl: 'https://node.example/agents/project-agent', visitUrl: 'https://node.example/agent/project-agent' };
  const project = { ...rootProject, kind: 'agent' as const, activeDeploymentId: current.id };
  const Page = () => createElement(ProjectConsole, { project });
  const html = render(Page, deploymentHistoryFixtures(project, [current]), '/studio/mono?open=agent-build');
  assert.match(html, /Open agent/); assert.match(html, /href="https:\/\/node.example\/agent\/project-agent"/);
  assert.doesNotMatch(html, /href="https:\/\/node.example\/agents\/project-agent"/);
  const unavailable = { ...current, outputState: 'unconfirmed' as const, visitUrl: undefined };
  const missing = render(Page, deploymentHistoryFixtures(project, [unavailable]), '/studio/mono?open=agent-build');
  assert.match(missing, /current runtime address could not be confirmed/);
  assert.doesNotMatch(missing, /href="https:\/\/node.example\/agent\/project-agent"|>Open agent/);
});

const runtimeLogFixture = { projectId: rootProject.id, deploymentId: 'active-build', sha: 'a'.repeat(40), placement: 'peer', tail: 200,
  fetchedAt: 1, truncated: false, lines: [{ ts: null, stream: 'stdout', text: 'current running app output' }] };
const runtimeArg = { ...projectArg, tail: 200 };
const runtimeProject = { ...rootProject, activeDeploymentId: 'active-build', activeCommit: 'a'.repeat(40) };

test('runtime logs display validated placement, version and text from the selected project', () => {
  const Page = () => createElement(RuntimeLogView, { project: runtimeProject });
  const html = render(Page, [...appAccount, { name: 'projectRuntimeLogs', arg: runtimeArg, value: runtimeLogFixture }]);
  assert.match(html, /running on a deployment peer/); assert.match(html, /active-build/);
  assert.match(html, /current running app output/); assert.doesNotMatch(html, /No output yet/);
});

test('malformed or foreign runtime reads cannot look like an empty local log or enable downloads', () => {
  const Page = () => createElement(RuntimeLogView, { project: runtimeProject });
  for (const value of [{}, { ...runtimeLogFixture, projectId: 'other' }, { ...runtimeLogFixture, placement: 'unknown' },
    { ...runtimeLogFixture, tail: 500 }, { ...runtimeLogFixture, lines: [null] }]) {
    const html = render(Page, [...appAccount, { name: 'projectRuntimeLogs', arg: runtimeArg, value }]);
    assert.match(html, /did not return its logs/);
    assert.doesNotMatch(html, /current running app output|No output yet|running on this node|running on a deployment peer/);
    assert.match(html, /<button[^>]*disabled[^>]*>Download<\/button>/);
  }
});

test('runtime logs from another deployment version offer refresh and never display that output', () => {
  const Page = () => createElement(RuntimeLogView, { project: runtimeProject });
  for (const patch of [{ deploymentId: 'old-build' }, { sha: 'b'.repeat(40) }]) {
    const html = render(Page, [...appAccount, { name: 'projectRuntimeLogs', arg: runtimeArg, value: { ...runtimeLogFixture, ...patch } }]);
    assert.match(html, /different deployment version/); assert.match(html, /Refresh/);
    assert.doesNotMatch(html, /current running app output|No output yet/);
    assert.match(html, /<button[^>]*disabled[^>]*>Download<\/button>/);
  }
});

test('failed runtime refresh cannot reuse cached output and validated empty logs remain distinct', () => {
  const Page = () => createElement(RuntimeLogView, { project: runtimeProject });
  const failed = render(Page, [...appAccount, { name: 'projectRuntimeLogs', arg: runtimeArg, value: runtimeLogFixture, status: 'rejected' }]);
  assert.match(failed, /did not return its logs/); assert.doesNotMatch(failed, /current running app output|No output yet/);
  const empty = render(Page, [...appAccount, { name: 'projectRuntimeLogs', arg: runtimeArg, value: { ...runtimeLogFixture, lines: [] } }]);
  assert.match(empty, /No output yet/); assert.doesNotMatch(empty, /did not return its logs/);
});

test('malformed environment reads show recovery without an editable empty list or missing-variable claim', () => {
  const Page = () => createElement(ProjectEnvVars, { project: rootProject });
  const Banner = () => createElement(MissingEnvBanner, { project: rootProject, onGo() {} });
  for (const value of [{}, { secrets: [null], declared: [], missing: [] }, { secrets: [{ name: 'A', updatedAt: 1 }], declared: ['A'], missing: ['A'] }]) {
    const fixtures: Fixture[] = [...appAccount, { name: 'projectSecrets', arg: projectArg, value }];
    const html = render(Page, fixtures);
    assert.match(html, /Could not confirm the environment variable list/); assert.match(html, /Try again/);
    assert.doesNotMatch(html, /id="env-new-name"|id="env-new-value"/);
    assert.equal(render(Banner, fixtures), '');
  }
});

test('valid environment evidence preserves missing names and masks saved values', () => {
  const value = { secrets: [{ name: 'ALREADY_SET', updatedAt: 1, value: 'must-not-leak' }], declared: ['ALREADY_SET', 'REQUIRED_KEY'], missing: ['REQUIRED_KEY'] };
  const Page = () => createElement(ProjectEnvVars, { project: rootProject });
  const fixtures: Fixture[] = [...appAccount, { name: 'projectSecrets', arg: projectArg, value }];
  const html = render(Page, fixtures);
  assert.match(html, /ALREADY_SET|REQUIRED_KEY/); assert.match(html, /id="env-new-name"/);
  assert.doesNotMatch(html, /must-not-leak/);
  const Banner = () => createElement(MissingEnvBanner, { project: rootProject, onGo() {} });
  const banner = render(Banner, fixtures);
  assert.match(banner, /REQUIRED_KEY/); assert.doesNotMatch(banner, /ALREADY_SET|must-not-leak/);
});

const watchedReceipt = { deploymentId: 'watched-build', status: 'queued' as const };
test('deployment observer rejects foreign, wrong-id, run and malformed completion evidence', () => {
  const Page = () => createElement(DeployWatch, { projectId: rootProject.id, queued: watchedReceipt });
  const good = { ...deploymentFixture('watched-build'), trigger: 'redeploy' };
  const wrongKind = { ...good, trigger: 'push' };
  for (const value of [{}, wrongKind, { ...good, id: 'other-build' }, { ...good, projectId: 'other-project' }, { ...good, trigger: 'run' }, { ...good, status: 'unknown' }]) {
    const html = render(Page, [...appAccount, { name: 'deployment', arg: { id: 'watched-build', identity: accountIdentity }, value }]);
    assert.match(html, /Could not load the history/);
    assert.doesNotMatch(html, /This deployment completed|app runs with the new values|href="https:\/\/wrong/);
  }
});

test('deployment observer reports only its matching build and uses its own raw log link', () => {
  const Page = () => createElement(DeployWatch, { projectId: rootProject.id, queued: watchedReceipt });
  const html = render(Page, [...appAccount, { name: 'deployment', arg: { id: 'watched-build', identity: accountIdentity }, value: { ...deploymentFixture('watched-build'), trigger: 'redeploy' } }]);
  assert.match(html, /This deployment completed/);
  assert.match(html, /href="\/api\/deployments\/watched-build\/log"/);
  assert.doesNotMatch(html, /wrong\.example|app runs with the new values/);
});

test('failed deployment observation hides cached completion and an invalid receipt cannot claim success', () => {
  const Page = () => createElement(DeployWatch, { projectId: rootProject.id, queued: watchedReceipt });
  const failed = render(Page, [...appAccount, { name: 'deployment', arg: { id: 'watched-build', identity: accountIdentity }, value: { ...deploymentFixture('watched-build'), trigger: 'redeploy' }, status: 'rejected' }]);
  assert.match(failed, /Could not load the history/); assert.doesNotMatch(failed, /This deployment completed/);
  const BadReceipt = () => createElement(DeployWatch, { projectId: rootProject.id, queued: { deploymentId: 'watched-build', status: 'ready' } as any });
  const invalid = render(BadReceipt, appAccount);
  assert.match(invalid, /Could not confirm the redeploy request/); assert.doesNotMatch(invalid, /This deployment completed/);
});

test('read-only environment declarations never imply that a hidden value has actually been set', () => {
  const project = { ...rootProject, manifest: { kind: 'service', inputs: {}, examples: [], secrets: ['DECLARED_ONLY'] } } as Project;
  const Page = () => createElement(ProjectEnvVars, { project });
  const html = render(Page, [...appAccount, { name: 'projectSecrets', arg: projectArg, status: 'rejected', errorStatus: 403, errorData: { error: { code: 'not_writer' } } }]);
  assert.match(html, /DECLARED_ONLY/); assert.match(html, /Set status is private/);
  assert.doesNotMatch(html, /••••••|env-new-name/);
});

test('absent or malformed read-only declarations are unknown rather than an empty manifest', () => {
  for (const manifest of [undefined, { kind: 'service', secrets: {} }]) {
    const project = { ...rootProject, manifest } as Project;
    const Page = () => createElement(ProjectEnvVars, { project });
    const html = render(Page, [...appAccount, { name: 'projectSecrets', arg: projectArg, status: 'rejected', errorStatus: 403, errorData: { error: { code: 'not_writer' } } }]);
    assert.match(html, /declarations are not available yet/);
    assert.doesNotMatch(html, /declares no environment variables|env-new-name/);
  }
});

test('runtime permission states never expose cached log content', () => {
  const SignedOutPage = () => createElement(RuntimeLogView, { project: runtimeProject });
  const out = render(SignedOutPage, signedOut);
  assert.match(out, /Sign in to see the runtime logs/); assert.doesNotMatch(out, /Download|No output yet/);
  const DeniedPage = () => createElement(RuntimeLogView, { project: { ...runtimeProject, canOperate: false } });
  const denied = render(DeniedPage, [...appAccount, { name: 'projectRuntimeLogs', arg: runtimeArg, value: runtimeLogFixture }]);
  assert.match(denied, /Only a member/); assert.doesNotMatch(denied, /current running app output|Download/);
});

const appDomainFixture = (hostname = 'app.example.com', extra = {}) => ({ hostname, projectId: rootProject.id, token: `ainize-verification=${'a'.repeat(48)}`,
  status: 'pending', message: 'Add DNS records', createdAt: 1, checkedAt: null, ...extra });
const appDomainListFixture = (domains: unknown[]) => ({ domains, addresses: ['203.0.113.1', '2001:db8::1'], cname: 'ingress.example.com', managedBase: 'platform.com' });

test('malformed domain lists cannot expose foreign tokens, unsafe links or editable empty settings', () => {
  const Page = () => createElement(ProjectDomains, { projectId: rootProject.id });
  for (const value of [{}, appDomainListFixture([null]), appDomainListFixture([appDomainFixture('foreign.example.com', { projectId: 'other' })]),
    appDomainListFixture([appDomainFixture('https://unsafe.example.com')]), appDomainListFixture([appDomainFixture(), appDomainFixture()]),
    { ...appDomainListFixture([]), addresses: ['wrong-ip'] }, { ...appDomainListFixture([]), cname: 'javascript:alert(1)' }]) {
    const html = render(Page, [...appAccount, { name: 'projectDomains', arg: projectArg, value }]);
    assert.match(html, /Could not confirm the domain list/); assert.match(html, /Try again/);
    assert.doesNotMatch(html, /ainize-verification=|foreign\.example|No custom domains yet|Check configuration/);
    assert.match(html, /<button[^>]*disabled[^>]*>Add<\/button>/);
  }
});

test('DNS record values remain exact, labelled on mobile, and belong to the chosen hostname', () => {
  const Page = () => createElement(ProjectDomains, { projectId: rootProject.id });
  const html = render(Page, [...appAccount, { name: 'projectDomains', arg: projectArg, value: appDomainListFixture([appDomainFixture()]) }]);
  assert.match(html, /_ainize\.app\.example\.com/); assert.match(html, /203\.0\.113\.1/); assert.match(html, /2001:db8::1/);
  assert.match(html, /data-label="Type"/); assert.match(html, /data-label="Name"/); assert.match(html, /data-label="Value"/);
  assert.match(html, /Do not add both A\/AAAA and CNAME/); assert.doesNotMatch(html, /Visit site/);
});

test('only ready domains expose Visit, and automatic assignment does not claim DNS was verified', () => {
  const Page = () => createElement(ProjectDomains, { projectId: rootProject.id });
  const html = render(Page, [...appAccount, { name: 'projectDomains', arg: projectArg, value: appDomainListFixture([
    appDomainFixture('ready.example.com', { status: 'ready', checkedAt: 2 }),
    appDomainFixture('auto.platform.com', { status: 'verified', managed: true, checkedAt: 2 }),
  ]) }]);
  assert.match(html, /href="https:\/\/ready.example.com"/); assert.doesNotMatch(html, /href="https:\/\/auto.platform.com"/);
  assert.match(html, /automatic address is assigned/); assert.doesNotMatch(html, /DNS is verified/);
  assert.match(html, /\.platform\.com/);
});

test('failed automatic DNS inspection shows its actual failure and does not ask the user for ownership TXT', () => {
  const Page = () => createElement(ProjectDomains, { projectId: rootProject.id });
  const html = render(Page, [...appAccount, { name: 'projectDomains', arg: projectArg, value: appDomainListFixture([
    appDomainFixture('auto.platform.com', { managed: true, status: 'invalid', checkedAt: 2, message: 'Expected ingress address not found.' }),
  ]) }]);
  assert.match(html, /DNS for the automatic address could not be verified/); assert.match(html, /Expected ingress address not found/);
  assert.doesNotMatch(html, /_ainize\.|ownership TXT|DNS is verified|Visit site/);
});

test('missing DNS destinations do not produce an empty copy target or allow an unusable custom-domain addition', () => {
  const Page = () => createElement(ProjectDomains, { projectId: rootProject.id });
  const html = render(Page, [...appAccount, { name: 'projectDomains', arg: projectArg, value: { ...appDomainListFixture([]), addresses: [], cname: '' } }]);
  assert.match(html, /server did not provide a DNS target/); assert.doesNotMatch(html, /CNAME to this target/);
  assert.match(html, /<button[^>]*disabled[^>]*>Add<\/button>/);
});

test('signed-out domain settings do not display cached ownership proof or editable controls', () => {
  const Page = () => createElement(ProjectDomains, { projectId: rootProject.id });
  const html = render(Page, signedOut);
  assert.match(html, /Sign in to see domain settings/); assert.doesNotMatch(html, /ainize-verification|Check configuration|placeholder="app.example.com"/);
});


test('project sync is offered only for an explicitly linked GitHub source', () => {
  for (const upstreamRepo of [undefined, 'https://github.com/team/app', 'https://github.com/team/app/issues']) {
    const project = { ...rootProject, upstreamRepo };
    const Page = () => createElement(ProjectConsole, { project });
    const html = render(Page, deploymentHistoryFixtures(project, []), '/studio/mono');
    if (upstreamRepo === 'https://github.com/team/app') assert.match(html, /Sync from GitHub now/);
    else assert.doesNotMatch(html, /Sync from GitHub now/);
    assert.doesNotMatch(html, /starts within a minute/);
  }
});

test('project management controls wait for the current project and hide on failed or foreign reads', () => {
  const project = { ...rootProject, url: `https://node.example/svc/${rootProject.id}/`, hookUrl: `https://node.example/api/projects/${rootProject.id}/hook` };
  const Page = () => createElement(ProjectConsole, { project });
  const pending = render(Page, [...appAccount, { name: 'project', arg: projectArg, status: 'pending' }], '/studio/mono?tab=settings');
  assert.match(pending, /<button[^>]*disabled[^>]*>Rotate webhook secret/);
  for (const replacement of [{ value: { ...project, id: 'other' } }, { status: 'rejected' as const, value: project }]) {
    const html = render(Page, deploymentHistoryFixtures(project, []).map(f => f.name === 'project' ? { ...f, ...replacement } : f), '/studio/mono?tab=settings');
    assert.match(html, /role="alert"/); assert.doesNotMatch(html, /Rotate webhook secret|Delete project/);
  }
});

test('signed-out project views do not inherit private management buttons from supplied props', () => {
  const project = { ...rootProject, url: `https://node.example/svc/${rootProject.id}/`, upstreamRepo: 'https://github.com/team/app' };
  const Page = () => createElement(ProjectConsole, { project });
  const html = render(Page, signedOut, '/studio/mono?tab=settings');
  assert.doesNotMatch(html, /Rotate webhook secret|Delete project|Sync from GitHub now/);
});


test('pending deletion replaces normal project actions with cleanup status and owner continuation', () => {
  const project = { ...rootProject, deletionRequestedAt: 42, upstreamRepo: 'https://github.com/team/app' };
  const Page = () => createElement(ProjectConsole, { project });
  const html = render(Page, deploymentHistoryFixtures(project, [deploymentFixture('latest')]), '/studio/mono?tab=settings');
  assert.match(html, /Project deletion cleanup/); assert.match(html, /Resume deletion/);
  assert.doesNotMatch(html, /Rotate webhook secret|Sync from GitHub now|Environment variables|Add domain/);
  const viewer = { ...project, canManage: false, canOperate: false };
  const Viewer = () => createElement(ProjectConsole, { project: viewer });
  const denied = render(Viewer, deploymentHistoryFixtures(viewer, []), '/studio/mono');
  assert.doesNotMatch(denied, /Resume deletion/); assert.match(denied, /Project deletion cleanup/);
});


test('save-and-redeploy shows the reviewed commit and cannot edit against a missing or foreign deployment', () => {
  const project = { ...rootProject, kind: 'service', lastDeploymentId: 'reviewed-env' } as Project;
  const Page = () => createElement(ProjectEnvVars, { project });
  const secrets: Fixture = { name: 'projectSecrets', arg: projectArg, value: { secrets: [], declared: [], missing: [] } };
  const good = { ...deploymentFixture('reviewed-env'), sha: 'a'.repeat(40), trigger: 'push' };
  const html = render(Page, [...appAccount, secrets, { name: 'deployment', arg: { id: 'reviewed-env', identity: accountIdentity }, value: good }]);
  assert.match(html, /Redeploy aaaaaaa after saving/);
  assert.doesNotMatch(html, /<fieldset disabled/);
  for (const value of [{}, { ...good, projectId: 'foreign' }, { ...good, sha: '' }, { ...good, trigger: 'run' }]) {
    const invalid = render(Page, [...appAccount, secrets, { name: 'deployment', arg: { id: 'reviewed-env', identity: accountIdentity }, value }]);
    assert.match(invalid, /<fieldset disabled/);
    assert.match(invalid, /Confirm the deployment commit before saving/);
    assert.doesNotMatch(invalid, /Redeploy aaaaaaa after saving/);
  }
});


test('unreadable environment values show repair actions and a page banner, not healthy masks or an empty list', () => {
  const project = { ...rootProject, kind: 'script' } as Project;
  const value = { secrets: [{ name: 'BROKEN_TOKEN', updatedAt: 1 }], declared: ['BROKEN_TOKEN'], missing: [], unreadable: ['BROKEN_TOKEN'] };
  const fixtures: Fixture[] = [...appAccount, { name: 'projectSecrets', arg: projectArg, value }];
  const html = render(() => createElement(ProjectEnvVars, { project }), fixtures);
  assert.match(html, /Needs recovery/); assert.match(html, /Replace their values/);
  assert.match(html, /Edit/); assert.match(html, /Remove/); assert.doesNotMatch(html, /••••••/);
  const banner = render(() => createElement(MissingEnvBanner, { project, onGo() {} }), fixtures);
  assert.match(banner, /BROKEN_TOKEN/); assert.match(banner, /Set environment variables/);
});


test('recovery saves remain available while automatic redeploy is visibly disabled for an incomplete environment', () => {
  const project = { ...rootProject, kind: 'service', lastDeploymentId: 'recover-env' } as Project;
  const value = { secrets: [{ name: 'BROKEN_TOKEN', updatedAt: 1 }], declared: [], missing: [], unreadable: ['BROKEN_TOKEN'] };
  const html = render(() => createElement(ProjectEnvVars, { project }), [...appAccount,
    { name: 'projectSecrets', arg: projectArg, value },
    { name: 'deployment', arg: { id: 'recover-env', identity: accountIdentity }, value: { ...deploymentFixture('recover-env'), trigger: 'push', sha: 'a'.repeat(40) } },
  ]);
  assert.match(html, /During recovery, changes are saved without redeploying/);
  assert.doesNotMatch(html, /<fieldset disabled/);
  assert.match(html, /<input[^>]*type="checkbox"[^>]*disabled/);
  assert.doesNotMatch(html, /<input[^>]*checked=""[^>]*disabled|<input[^>]*disabled[^>]*checked=""/);
});
