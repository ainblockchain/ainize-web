import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router';
import { ThemeProvider } from 'styled-components';
import { api } from '../src/api/api';
import { theme } from '../src/theme/theme';
import { LocaleProvider } from '../src/i18n';
import { AuthProvider } from '../src/auth/AuthContext';
import { createTeacherKey, forgetTeacherKey } from '../src/lib/teacherKey';
import TeachMinePage from '../src/screens/TeachMinePage';
import SigningPage from '../src/screens/SigningPage';
import AppsPage from '../src/screens/AppsPage';
import SearchPage from '../src/screens/SearchPage';

// Real RTK hooks render cached server responses. No fetch, browser identity, or production mutations.
const makeStore = (preloadedState?: any) => configureStore({
  reducer: { [api.reducerPath]: api.reducer },
  middleware: (gdm) => gdm().concat(api.middleware),
  ...(preloadedState ? { preloadedState } : {}),
});
const stores: ReturnType<typeof makeStore>[] = [];
afterEach(() => { forgetTeacherKey(); for (const store of stores.splice(0)) store.dispatch(api.util.resetApiState()); });
type Fixture = { name: string; arg?: unknown; value?: unknown; status?: 'pending' | 'rejected' };
function render(page: typeof TeachMinePage | typeof SigningPage | typeof AppsPage | typeof SearchPage, fixtures: Fixture[], path = '/train/mine') {
  const seed = makeStore(); stores.push(seed);
  seed.dispatch(api.util.upsertQueryEntries(fixtures.map(({ name, value, arg }) => ({ endpointName: name, arg, value })) as any));
  const state = seed.getState();
  const queries = { ...state[api.reducerPath].queries };
  for (const [key, entry] of Object.entries(queries)) {
    const fixture = fixtures.find((f) => f.name === entry?.endpointName);
    if (fixture?.status) queries[key] = { ...entry, status: fixture.status, error: fixture.status === 'rejected' ? { status: 503, data: 'unavailable' } : undefined } as any;
  }
  const store = makeStore({ [api.reducerPath]: { ...state[api.reducerPath], queries } }); stores.push(store);
  return renderToStaticMarkup(createElement(Provider, { store, children:
    createElement(MemoryRouter, { initialEntries: [path] },
      createElement(ThemeProvider, { theme },
        createElement(LocaleProvider, null,
          createElement(AuthProvider, null, createElement(page))))) }));
}
const signedOut: Fixture[] = [
  { name: 'me', value: { signedIn: false } },
  { name: 'googleSession', value: { configured: false } },
  { name: 'ssoStatus', value: { configured: true } },
];
const policy: Fixture = { name: 'teachPolicy', value: { enabled: false, trainer: 'paused' } };
const lists = (datasets: Fixture, jobs: Fixture) => [...signedOut, policy, datasets, jobs];
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

test('public sign-in leads with the AIN account and keeps wallets available in a closed section', () => {
  const html = render(SigningPage, signedOut, '/signing?next=%2Fapps%3Fq%3Ddemo%23results');
  assert.ok(html.indexOf('data-testid="sso-signin"') < html.indexOf('data-testid="wallet-options"'));
  const details = html.match(/<details[^>]*data-testid="wallet-options"[^>]*>/)?.[0];
  assert.ok(details);
  assert.doesNotMatch(details, /\bopen=/);
  assert.match(html, /next=%2Fapps%3Fq%3Ddemo%23results/);
  assert.doesNotMatch(html, /connect and manage your nodes/);
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
  assert.match(html, /data-testid="signin-continue"/);
  assert.doesNotMatch(html, /data-testid="sso-signin"/);
  assert.match(html, /Connect a wallet/);
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
const appsArg = { principal: 'sso:viewer', orgs: ['studio'] };
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
  const html = render(AppsPage, [...appAccount, appsFixture([webApp]), { name: 'projectDeployments', arg: 'web', value: { deployments: [{ id: 'previous', status: 'ready', outputUrl: 'https://active.example.test' }] } }], '/apps');
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
