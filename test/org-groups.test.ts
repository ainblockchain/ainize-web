import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orgGroups, missingGroupSelections, sameOrgGroup, saveSelectedOrgGroup, confirmGroupDeletion, OrgGroupError } from '../src/lib/orgGroups';

const group = { id: 'g1', name: 'Original', members: ['sso:one', 'sso:two'], agents: ['agent-a'] };
const draft = { name: 'Edited', members: ['sso:one'], agents: ['agent-b'] };
const current = () => true;
const errorCode = (code: OrgGroupError['code']) => (e: unknown) => e instanceof OrgGroupError && e.code === code;

test('group reads distinguish empty from malformed rows and never discard invalid or duplicate entries', () => {
  assert.deepEqual(orgGroups({ groups: [] }), []);
  assert.deepEqual(orgGroups({ groups: [group] }), [group]);
  for (const raw of [{}, { groups: [{}] }, { groups: [group, group] }, { groups: [{ ...group, members: ['sso:one', 'sso:one'] }] }, { groups: [{ ...group, agents: 'oops' }] }]) assert.equal(orgGroups(raw), null);
});

test('group comparison ignores order but detects withdrawn groups, and unavailable selections remain explicit', () => {
  assert.equal(sameOrgGroup({ ...group, members: [...group.members].reverse() }, group), true);
  assert.equal(sameOrgGroup(undefined, group), false);
  assert.equal(sameOrgGroup({ ...group, name: 'Changed' }, group), false);
  assert.deepEqual(missingGroupSelections(['present', 'withdrawn'], ['present', 'replacement']), ['withdrawn']);
});

test('save rechecks the exact group and blocks a changed or deleted result from the fresh read', async () => {
  let writes = 0;
  for (const groups of [[], [{ ...group, name: 'Changed by colleague' }], [{ ...group, members: [] }]]) {
    await assert.rejects(saveSelectedOrgGroup(group, draft, { read: async () => ({ groups }), save: async () => { writes++; }, isCurrent: current }), errorCode('changed'));
  }
  await assert.rejects(saveSelectedOrgGroup(group, draft, { read: async () => ({}), save: async () => { writes++; }, isCurrent: current }), errorCode('read_failed'));
  assert.equal(writes, 0);
});

test('group saves require the chosen id and exact saved membership before closing the editor', async () => {
  const saved = { id: group.id, ...draft };
  assert.deepEqual(await saveSelectedOrgGroup(group, draft, { read: async () => ({ groups: [group] }), save: async () => ({ group: saved }), isCurrent: current }), saved);
  for (const answer of [{}, { group: { ...saved, id: 'other' } }, { group: { ...saved, members: [] } }, { group: { ...saved, agents: ['replacement'] } }]) {
    await assert.rejects(saveSelectedOrgGroup(group, draft, { read: async () => ({ groups: [group] }), save: async () => answer, isCurrent: current }), errorCode('unconfirmed'));
  }
  assert.throws(() => confirmGroupDeletion({ deleted: 'other' }, group.id), errorCode('unconfirmed'));
  confirmGroupDeletion({ deleted: group.id }, group.id);
});

test('departure before the refreshed group arrives stops the write, and a late save cannot close the next view', async () => {
  let active = true, writes = 0;
  assert.equal(await saveSelectedOrgGroup(group, draft, {
    read: async () => { active = false; return { groups: [group] }; }, save: async () => { writes++; }, isCurrent: () => active,
  }), null);
  assert.equal(writes, 0);
  active = true;
  assert.equal(await saveSelectedOrgGroup(group, draft, {
    read: async () => ({ groups: [group] }), save: async () => { writes++; active = false; return { group: { id: group.id, ...draft } }; }, isCurrent: () => active,
  }), null);
  assert.equal(writes, 1);
});

test('group list uses the management endpoint, scopes account caches, and refreshes after writes', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  const requests: { method: string; path: string; body?: unknown }[] = [];
  let saved = { ...group };
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); }
  };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url);
    assert.equal(url.search, '');
    assert.ok(url.pathname.startsWith('/api/orgs/studio/groups'));
    const body = req.method === 'GET' ? undefined : await req.json();
    requests.push({ method: req.method, path: url.pathname, body });
    if (body) { assert.equal(body.identity, undefined); saved = { id: group.id, ...body }; return Response.json({ group: saved }); }
    return Response.json({ groups: [saved] });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const scope = { id: 'studio', identity: 'first-account' };
  const subscription = store.dispatch(api.endpoints.orgGroups.initiate(scope));
  try {
    await subscription.unwrap();
    assert.equal(api.endpoints.orgGroups.select({ ...scope, identity: 'second-account' })(store.getState()).data, undefined);
    await store.dispatch(api.endpoints.updateOrgGroup.initiate({ id: 'studio', groupId: group.id, ...draft })).unwrap();
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    assert.deepEqual(api.endpoints.orgGroups.select(scope)(store.getState()).data, { groups: [{ id: group.id, ...draft }] });
    assert.deepEqual(requests.map(r => r.method), ['GET', 'PUT', 'GET']);
    assert.equal(requests[0].path, '/api/orgs/studio/groups');
    assert.equal(requests[1].path, '/api/orgs/studio/groups/g1');
  } finally {
    subscription.unsubscribe(); store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest;
  }
});
