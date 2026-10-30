import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAccessibleApps } from '../src/lib/accessibleApps.ts';
const app = (id: string) => ({ id, kind: 'nextjs' });
const fail = { error: { status: 503, data: 'unavailable' } } as const;

test('discovers server memberships as well as SSO hints and deduplicates app results', async () => {
  const requests: string[] = [];
  const result = await loadAccessibleApps(['token-team', 'token-team'], async (url) => {
    requests.push(url);
    if (url === 'api/orgs') return { data: { orgs: [{ id: 'wallet-team', my_role: 'member' }] } };
    if (url === 'api/projects') return { data: { projects: [app('own')] } };
    return { data: { projects: [app('shared'), app('own')] } };
  });
  assert.ok('data' in result);
  assert.deepEqual(result.data.projects.map((p) => p.id), ['own', 'shared']);
  assert.deepEqual(result.data.failedSources, []);
  assert.ok(requests.includes('api/orgs/wallet-team/projects'));
  assert.equal(requests.filter((p) => p === 'api/orgs/token-team/projects').length, 1);
});

test('a denied organization does not hide personal apps and successful team apps', async () => {
  const result = await loadAccessibleApps(['denied', 'allowed'], async (url) => {
    if (url === 'api/orgs') return { data: { orgs: [] } };
    if (url.includes('/denied/')) return { error: { status: 403, data: 'forbidden' } };
    return { data: { projects: [app(url === 'api/projects' ? 'own' : 'shared')] } };
  });
  assert.ok('data' in result);
  assert.deepEqual(result.data.projects.map((p) => p.id), ['own', 'shared']);
  assert.deepEqual(result.data.failedSources, ['denied']);
});

test('membership lookup failure keeps known sources but marks even empty results incomplete', async () => {
  const result = await loadAccessibleApps([], async (url) => url === 'api/orgs' ? fail : { data: { projects: [] } });
  assert.ok('data' in result);
  assert.deepEqual(result.data, { projects: [], failedSources: ['organizations'] });
});

test('when every project source fails the result is an error, not an empty list', async () => {
  const result = await loadAccessibleApps(['team'], async (url) => url === 'api/orgs' ? { data: { orgs: [] } } : fail);
  assert.ok('error' in result);
  assert.equal(result.error.status, 503);
});

test('malformed list responses are incomplete, never silently counted as successful empty sources', async () => {
  const result = await loadAccessibleApps(['team'], async (url) => {
    if (url === 'api/orgs') return { data: { orgs: [] } };
    return { data: url === 'api/projects' ? { projects: [app('own')] } : { message: 'unexpected response' } };
  });
  assert.ok('data' in result);
  assert.deepEqual(result.data.projects.map((p) => p.id), ['own']);
  assert.deepEqual(result.data.failedSources, ['team']);
});
