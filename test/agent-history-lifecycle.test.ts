import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewLifecycle } from '../src/lib/previewLifecycle';
import { agentHistorySelection, selectedPreviewRun } from '../src/lib/agentHistorySelection';
import type { AgentPreviewRun, AgentPull } from '../src/api/types';

const deferred = <T>() => { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; };

test('late preview creation cleans up after departure, without rendering a departed view', async () => {
  const created = deferred<{ id: string }>(); const removed: string[] = []; let shown = false; let calls = 0;
  const life = previewLifecycle({ create: () => { calls++; return created.promise; }, remove: async (id) => { removed.push(id); }, currentAccount: () => true, onCreated: () => { shown = true; }, onStopped: () => {} });
  const request = life.start(); await life.start(); life.dispose();
  created.resolve({ id: 'preview-original' }); await request;
  assert.equal(calls, 1); assert.equal(shown, false); assert.deepEqual(removed, ['preview-original']);
});

test('preview cleanup never writes under a new account and late create cannot render there', async () => {
  let current = true; const created = deferred<{ id: string }>(); let removed = false; let shown = false;
  const life = previewLifecycle({ create: () => created.promise, remove: async () => { removed = true; }, currentAccount: () => current, onCreated: () => { shown = true; }, onStopped: () => {} });
  const request = life.start(); current = false; life.dispose(); created.resolve({ id: 'private-preview' }); await request;
  assert.equal(removed, false); assert.equal(shown, false);
});

test('failed stop retains the preview and can retry without creating a replacement', async () => {
  let creates = 0; let removes = 0; let stops = 0;
  const life = previewLifecycle({ create: async () => { creates++; return { id: 'one' }; }, remove: async () => { removes++; if (removes === 1) throw new Error('offline'); }, currentAccount: () => true, onCreated: () => {}, onStopped: () => { stops++; } });
  await life.start(); await assert.rejects(life.stop(), /offline/); await life.start();
  assert.equal(creates, 1); assert.equal(stops, 0);
  await life.stop(); assert.equal(stops, 1); await life.start(); assert.equal(creates, 2);
});

test('stop and departure do not issue duplicate preview removal requests', async () => {
  let removes = 0; let stops = 0; const deleting = deferred<void>();
  const life = previewLifecycle({ create: async () => ({ id: 'one' }), remove: async () => { removes++; await deleting.promise; }, currentAccount: () => true, onCreated: () => {}, onStopped: () => { stops++; } });
  await life.start(); const request = life.stop(); life.dispose(); deleting.resolve(); await request;
  assert.equal(removes, 1); assert.equal(stops, 0);
});

test('confirmed expiration releases the old preview so Start creates a new one without deleting it again', async () => {
  let creates = 0; let removes = 0; let stops = 0;
  const life = previewLifecycle({ create: async () => ({ id: `preview-${++creates}` }), remove: async () => { removes++; }, currentAccount: () => true, onCreated: () => {}, onStopped: () => { stops++; } });
  await life.start(); life.expired(); await life.start();
  assert.equal(creates, 2); assert.equal(removes, 0); assert.equal(stops, 1);
});

test('record selection never substitutes a different record after a poll or deletion', () => {
  const first = { id: 'first' } as AgentPreviewRun; const second = { id: 'second' } as AgentPreviewRun;
  assert.equal(selectedPreviewRun([first, second], null, 1).run, second);
  assert.deepEqual(selectedPreviewRun([first], 'second', 1), { id: 'second', run: null });
  assert.deepEqual(selectedPreviewRun([first, second], '', 0), { id: '', run: null });
  assert.equal(selectedPreviewRun([second, first], 'first', 0).run, first);
});

test('history waits for actual refs and reviews the proposal base with its imported pinned head', () => {
  const refs = { head: 'release', branches: [{ name: 'release', sha: 'live' }, { name: 'staging', sha: 'base' }, { name: 'proposal', sha: 'change' }], clone_url: 'https://example/repo.git' };
  const pull = { headAgent: 'my-fork', head: 'main', headCommit: 'pinned-sha', base: 'staging' } as AgentPull;
  assert.equal(agentHistorySelection(undefined, null, null).valid, false);
  assert.deepEqual(agentHistorySelection(refs, null, null), { head: 'release', ref: 'release', base: 'release', commit: 'live', baseCommit: 'live', valid: true, comparing: false });
  assert.deepEqual(agentHistorySelection(refs, null, pull), { head: 'release', ref: 'pinned-sha', base: 'staging', commit: 'pinned-sha', baseCommit: 'base', valid: true, comparing: true });
  assert.equal(agentHistorySelection(refs, 'proposal', null).commit, 'change');
  assert.equal(agentHistorySelection(refs, 'deleted-branch', null).valid, false);
  assert.equal(agentHistorySelection(refs, null, { ...pull, headCommit: undefined, head: 'release' }).valid, false);
});
