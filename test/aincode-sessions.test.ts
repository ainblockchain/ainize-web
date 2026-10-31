/** The AinCode page's grouping: organization workspaces first, then personal; repository → sessions, newest first. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupOverview, misplaced, parseOverview, repoKey, type AinCodeOverview } from '../src/api/aincodeSessions';

const overview: AinCodeOverview = {
  workspaces: [
    { kind: 'personal', base: '/code', running: true, newSessionUrl: '/code/_workspaces/choose?to=personal' },
    { kind: 'organization', org: { id: 'comcom', name: 'ComCom', role: 'write' }, base: '/code/org/comcom', running: false, newSessionUrl: '/code/_workspaces/choose?to=comcom' },
  ],
  sessions: [
    { workspace: 'personal', id: 'ses_a', title: 'soulfiction', directory: '/home/aincode/agents', workingDirectory: '/home/aincode/projects/ainspace-soulfiction', repo: { org: 'comcom', name: 'ainspace-soulfiction', aindriveUrl: 'https://aindrive.ainetwork.ai/comcom/git/ainspace-soulfiction', projectPageUrl: 'https://ainize.ai/comcom/ainspace-soulfiction' }, branch: 'main', updatedAt: 30, status: 'working', openUrl: '/code/L2hvbWUvYWluY29kZS9hZ2VudHM/session/ses_a' },
    { workspace: 'personal', id: 'ses_b', title: 'notes', directory: '/home/aincode/projects/notes', workingDirectory: '/home/aincode/projects/notes', updatedAt: 10, status: 'idle', openUrl: '/code/L2hvbWUvYWluY29kZS9wcm9qZWN0cy9ub3Rlcw/session/ses_b' },
    { workspace: 'comcom', id: 'ses_c', title: 'ainspace fix', directory: '/home/aincode/repositories/ainspace', workingDirectory: '/home/aincode/repositories/ainspace', repo: { org: 'comcom', name: 'ainspace', aindriveUrl: 'https://aindrive.ainetwork.ai/comcom/git/ainspace' }, updatedAt: 20, status: 'unknown', openUrl: '/code/org/comcom/L2hvbWUvYWluY29kZS9yZXBvc2l0b3JpZXMvYWluc3BhY2U/session/ses_c' },
  ],
};

test('organization workspaces come first, then personal; sessions grouped by repository', () => {
  const g = groupOverview(overview);
  assert.deepEqual(g.map((w) => w.key), ['comcom', 'personal']);
  assert.deepEqual(g[1].repos.map((r) => [r.label, r.href, r.sessions.map((s) => s.id)]), [
    ['ainspace-soulfiction', 'https://ainize.ai/comcom/ainspace-soulfiction', ['ses_a']],
    ['notes', undefined, ['ses_b']],
  ]);
  assert.equal(g[1].working, 1);
  assert.equal(g[0].repos[0].href, 'https://aindrive.ainetwork.ai/comcom/git/ainspace', 'no project page: AIN Drive');
});

test('a personal session on an organization repository is flagged; malformed lists are rejected', () => {
  assert.equal(misplaced(overview.sessions[0]), true);
  assert.equal(misplaced(overview.sessions[1]), false);
  assert.equal(repoKey(overview.sessions[1]).label, 'notes');
  const parsed = parseOverview({ workspaces: overview.workspaces, sessions: [...overview.sessions, { id: 'x', openUrl: 'https://evil.example/' }] });
  assert.equal(parsed, null, 'invalid rows must not silently disappear from the list');
  assert.equal(parseOverview({}), null);
  assert.deepEqual(parseOverview(overview), overview);
});

test('incomplete workspaces, orphaned sessions and duplicate rows cannot crash or misrepresent a list', () => {
  for (const workspaces of [
    [{ ...overview.workspaces[1], org: undefined }],
    [{ ...overview.workspaces[0], newSessionUrl: undefined }],
    [overview.workspaces[0], overview.workspaces[0]],
    [],
  ]) assert.equal(parseOverview({ ...overview, workspaces }), null);
  for (const changes of [
    { workingDirectory: undefined }, { updatedAt: 'yesterday' }, { status: 'unexpected' },
    { openUrl: '/code-elsewhere' }, { openUrl: '//evil.example/code' },
    { openUrl: '/code/../other' }, { openUrl: '/code/%2e%2e/other' },
    { repo: { ...overview.sessions[0].repo, projectPageUrl: 'javascript:alert(1)' } },
  ]) assert.equal(parseOverview({ ...overview, sessions: [{ ...overview.sessions[0], ...changes }] }), null);
  assert.equal(parseOverview({ ...overview, sessions: [overview.sessions[0], overview.sessions[0]] }), null);
  assert.deepEqual(parseOverview({ workspaces: [], sessions: [] }), { workspaces: [], sessions: [] });
});

test('session links must match the displayed workspace, directory and exact session', () => {
  const original = overview.sessions[0];
  for (const change of [
    { openUrl: original.openUrl.replace('/code/', '/code/org/comcom/') },
    { openUrl: original.openUrl.replace('ses_a', 'ses_b') },
    { openUrl: overview.sessions[1].openUrl.replace('ses_b', 'ses_a') },
    { openUrl: original.openUrl + '?redirect=other' },
    { openUrl: original.openUrl + '#other' },
    { directory: '/different/root' }, { id: '..', openUrl: original.openUrl.replace('ses_a', '..') },
    { updatedAt: -1 }, { updatedAt: 9e15 },
  ]) assert.equal(parseOverview({ ...overview, sessions: [{ ...original, ...change }] }), null, JSON.stringify(change));
  assert.ok(parseOverview({ ...overview, sessions: [{ ...original, workingDirectory: '/project/subfolder' }] }), 'session root and working folder can differ');
  const directory = '/프로젝트/미술 작업';
  assert.ok(parseOverview({ ...overview, sessions: [{ ...original, directory, openUrl: '/code/' + Buffer.from(directory).toString('base64url') + '/session/ses_a' }] }));
});

test('workspace entry links cannot silently select another workspace or accept conflicting selectors', () => {
  const original = overview.workspaces[1];
  for (const change of [
    { base: '/code' }, { base: '/code/org/other' },
    { newSessionUrl: '/code/_workspaces/choose?to=personal' },
    { newSessionUrl: '/code/_workspaces/choose?to=comcom&to=personal' },
    { newSessionUrl: '/code/_workspaces/choose?to=comcom&redirect=other' },
    { newSessionUrl: '/code/_workspaces/choose?to=comcom#other' },
    { org: { ...original.org, id: '..' } },
    { org: { ...original.org, id: '\ud800' } },
  ]) assert.equal(parseOverview({ workspaces: [{ ...original, ...change }], sessions: [] }), null);
});

test('session sorting is deterministic when timestamps tie without changing the supplied list', () => {
  const a = { ...overview.sessions[1], id: 'session-a', updatedAt: 50 }, b = { ...a, id: 'session-b' };
  const input = { workspaces: [overview.workspaces[0]], sessions: [b, a] };
  assert.deepEqual(groupOverview(input)[0].repos[0].sessions.map(s => s.id), ['session-a', 'session-b']);
  assert.deepEqual(input.sessions.map(s => s.id), ['session-b', 'session-a']);
});

test('actual session-list query refuses a cross-workspace destination rather than rendering an actionable result', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { aincodeApi } = await import('../src/api/aincodeOverview');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  let invalid = false, calls = 0;
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); calls++;
    assert.equal(req.method, 'GET'); assert.equal(new URL(req.url).pathname, '/code/_aincode/sessions');
    return Response.json(invalid ? { ...overview, sessions: [{ ...overview.sessions[0], openUrl: overview.sessions[0].openUrl.replace('/code/', '/code/org/comcom/') }] } : overview);
  };
  const store = configureStore({ reducer: { [aincodeApi.reducerPath]: aincodeApi.reducer }, middleware: gdm => gdm().concat(aincodeApi.middleware) });
  const query = store.dispatch(aincodeApi.endpoints.aincodeOverview.initiate('account'));
  try {
    assert.deepEqual(await query.unwrap(), overview);
    invalid = true;
    await assert.rejects(query.refetch().unwrap());
    assert.equal(aincodeApi.endpoints.aincodeOverview.select('account')(store.getState()).isError, true);
    assert.equal(aincodeApi.endpoints.aincodeOverview.select('other-account')(store.getState()).data, undefined);
    assert.equal(calls, 2);
  } finally { query.unsubscribe(); store.dispatch(aincodeApi.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
