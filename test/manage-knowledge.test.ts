import { test } from 'node:test';
import assert from 'node:assert/strict';
import { managedKnowledge, managementMatchesAuthor, runManagedAction, ManagementSelectionError } from '../src/lib/manageKnowledge';
import { createNodeActionTask } from '../src/lib/accountNodeActions';
import { manageFixture } from './fixtures/manageKnowledge';

test('management keeps the exact selected anchor and rejects unusable detail sections', () => {
  const p = manageFixture('folder/id?x#fragment');
  assert.equal(managedKnowledge(p, p.anchor.id), p);
  assert.equal(managedKnowledge(p, 'different'), null);
  assert.equal(managementMatchesAuthor(p, p.anchor.author.toUpperCase()), true);
  assert.equal(managementMatchesAuthor(p, '0x' + 'b'.repeat(40)), false);
  const legacy = { ...p, anchor: { ...p.anchor, benchmark: { schema: 'facts', queries: [{ prompt: 'Question?', expect: 'A' }] } } };
  assert.equal(managedKnowledge(legacy, p.anchor.id), legacy, 'signed legacy benchmark remains intact');
  for (const patch of [{ owned: 'true' }, { attestations: [null] }, { settlements: [{}] }, { lineage: { parents: [] } }, { conflicts: [{}] }, { supersedes: null }, { stalled: { verifiers: [null] } }, { price_history: [{}] }]) assert.equal(managedKnowledge({ ...p, ...patch }, p.anchor.id), null);
});

test('management writes are withheld for wrong, inaccessible or changed selected resources', async () => {
  const p = manageFixture();
  for (const raw of [null, { ...p, owned: false }, manageFixture('other'), { ...p, anchor: { ...p.anchor, author: '0x' + 'b'.repeat(40) } }]) {
    await assert.rejects(runManagedAction('chosen', p.anchor.author, { current: () => true, read: async () => raw, action: async () => { assert.fail('must not mutate a substituted resource'); } }), ManagementSelectionError);
  }
  await assert.rejects(runManagedAction('chosen', p.anchor.author, { current: () => true, read: async () => { throw new Error('unavailable'); }, action: async () => { assert.fail('must not write after a failed read'); } }), /unavailable/);
});

test('leaving during preflight cannot mutate and late completion cannot navigate the new view', async () => {
  const p = manageFixture(); let active = true;
  assert.equal(await runManagedAction('chosen', p.anchor.author, { current: () => active, read: async () => { active = false; return p; }, action: async () => { assert.fail('departed'); } }), null);
  active = true; let navigations = 0;
  assert.equal(await runManagedAction('chosen', p.anchor.author, { current: () => active, read: async () => p, action: async current => { active = false; if (current()) navigations++; } }), null);
  assert.equal(navigations, 0);
});

test('different management buttons share a synchronous task and can retry after a failed preflight', async () => {
  const p = manageFixture(), task = createNodeActionTask(); let writes = 0; let release!: (v: unknown) => void;
  const first = task.run(() => true, current => runManagedAction('chosen', p.anchor.author, { current, read: () => new Promise(resolve => { release = resolve; }), action: async () => { writes++; } }));
  assert.equal(await task.run(() => true, async () => { writes++; return true; }), null);
  release(null); await assert.rejects(first, ManagementSelectionError); assert.equal(writes, 0);
  assert.equal(await task.run(() => true, current => runManagedAction('chosen', p.anchor.author, { current, read: async () => p, action: async () => { writes++; } })), true);
  assert.equal(writes, 1);
});

test('management caches are account-specific while URLs retain only the selected resource', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const originalFetch = globalThis.fetch, OriginalRequest = globalThis.Request;
  const urls: string[] = [];
  globalThis.Request = class extends OriginalRequest { constructor(input: any, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } } as typeof Request;
  globalThis.fetch = async input => { const url = new URL((input as Request).url); urls.push(url.pathname + url.search); return new Response('{}', { headers: { 'Content-Type': 'application/json' } }); };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: g => g().concat(api.middleware) });
  try {
    const arg = { id: 'folder/id?x#hash', identity: 'first' };
    await store.dispatch(api.endpoints.managedPatch.initiate(arg, { subscribe: false })).unwrap();
    await store.dispatch(api.endpoints.managedCatalog.initiate({ identity: 'first' }, { subscribe: false })).unwrap();
    assert.equal(api.endpoints.managedPatch.select({ ...arg, identity: 'second' })(store.getState()).data, undefined);
    assert.equal(api.endpoints.managedCatalog.select({ identity: 'second' })(store.getState()).data, undefined);
    assert.deepEqual(urls, ['/api/patches/folder%2Fid%3Fx%23hash', '/api/catalog?limit=200&include_drafts=true']);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = originalFetch; globalThis.Request = OriginalRequest; }
});
