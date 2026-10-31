import { runtimeReviewFixture } from './fixtures/runtimeReview';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimRuntimeOperation, clearRuntimeOperation, followRuntimeOperation, parseRuntimeJob, prepareRuntimeOperation,
  readRuntimeOperation, runtimeOperationKey, runtimeOperationRequest, saveRuntimeJob, RuntimeOperationError,
  type RuntimeJob, type RuntimePhase, type OperationStorage } from '../src/lib/runtimeOperation';
import { confirmRuntimeKnowledge, LoadKnowledgeError } from '../src/lib/loadKnowledge';
import { manageFixture } from './fixtures/manageKnowledge';

const now = 1_800_000_000_000;
const node = '0x' + 'ab'.repeat(20), subject = '0x' + 'bc'.repeat(20);
const owner = runtimeOperationKey('account-one', node);
const cap = { instance: 'a'.repeat(32), server_time: now, request_window_ms: 600_000, apply_preview: true };
const operation = () => prepareRuntimeOperation(owner, manageFixture().anchor, 'load', false, [], cap, 'b'.repeat(32), runtimeReviewFixture());
const code = (code: string) => (e: unknown) => e instanceof RuntimeOperationError && e.code === code;
const memory = () => {
  const values = new Map<string, string>();
  const storage: OperationStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v); }, removeItem: k => { values.delete(k); } };
  return { storage, values };
};
const job = (state: RuntimeJob['state'] = 'queued'): RuntimeJob => ({
  id: operation().request.request_id, instance: cap.instance, patch_id: operation().target.id, kind: 'apply', state,
  queued_at: now, started_at: state === 'queued' ? null : now + 1,
  finished_at: ['done', 'failed'].includes(state) ? now + 2 : null,
  result: state === 'done' ? 'loaded' : null, error: state === 'failed' ? 'needs_base: base' : null,
  ...(state === 'done' ? { outcome: { result: 'loaded', stack: [], order: ['chosen'], loaded: ['chosen'] } } : {}),
  ...(state === 'failed' ? { status: 409, details: { missing: ['base'] } } : {}),
});
const deps = (overrides = {}) => ({ current: () => true, read: async (): Promise<unknown> => ({ job: job('done') }),
  save: (_job: RuntimeJob) => {}, phase: (_phase: RuntimePhase) => {}, wait: async () => {}, ...overrides });

test('unsupported nodes never produce an operation identity; saved targets exclude benchmark content', () => {
  for (const c of [null, {}, { ...cap, instance: 'old' }, { ...cap, request_window_ms: 0 }, { ...cap, server_time: NaN }]) {
    assert.throws(() => prepareRuntimeOperation(owner, manageFixture().anchor, 'load', false, [], c, 'b'.repeat(32)), code('unsupported'));
  }
  const op = operation();
  assert.equal('benchmark' in op.target, false);
  assert.deepEqual(runtimeOperationRequest(op), { id: 'chosen', kind: 'load', body: { async: true, ...op.request, with_base: false, expected_preview: op.review!.revision } });
  assert.deepEqual(runtimeOperationRequest({ ...op, kind: 'unload', withBase: true }).body, { async: true, ...op.request, cascade: false, require_recorded: true });
  assert.throws(() => prepareRuntimeOperation(owner, manageFixture().anchor, 'unload', false, [], cap, 'b'.repeat(32)), code('unsupported'));
  assert.equal(prepareRuntimeOperation(owner, manageFixture().anchor, 'unload', false, [], { ...cap, recorded_remove: true }, 'b'.repeat(32)).kind, 'unload');
});

test('reload restores the exact request and baseline, isolated by account and node', () => {
  const { storage } = memory(), op = operation();
  claimRuntimeOperation(storage, op);
  assert.deepEqual(readRuntimeOperation(storage, owner), JSON.parse(JSON.stringify(op)));
  for (const key of [runtimeOperationKey('other-account', node), runtimeOperationKey('account-one', subject)]) assert.equal(readRuntimeOperation(storage, key), null);
  assert.throws(() => claimRuntimeOperation(storage, { ...op, kind: 'unload' }), code('pending'));
  const latest = saveRuntimeJob(storage, op, job('running'));
  assert.equal(readRuntimeOperation(storage, owner)?.job?.state, 'running');
  assert.equal(latest.request.request_id, op.request.request_id);
  clearRuntimeOperation(storage, { ...op, request: { ...op.request, request_id: `${now}-${'c'.repeat(32)}` } });
  assert.notEqual(readRuntimeOperation(storage, owner), null);
  clearRuntimeOperation(storage, op); assert.equal(readRuntimeOperation(storage, owner), null);
});

test('corrupt and unavailable storage fail closed instead of replacing an unknown request', () => {
  const { storage, values } = memory();
  for (const raw of ['{broken', JSON.stringify({ ...operation(), owner: 'foreign' }), JSON.stringify({ ...operation(), before: [{}] })]) {
    values.set(owner, raw);
    assert.throws(() => readRuntimeOperation(storage, owner), code('storage'));
    assert.throws(() => claimRuntimeOperation(storage, operation()), code('storage'));
    assert.equal(values.get(owner), raw);
  }
  values.clear();
  assert.throws(() => claimRuntimeOperation({ ...storage, setItem() { throw new Error('quota'); } }, operation()), code('storage'));
});

test('late observers cannot downgrade terminal receipts or recreate closed tracking', () => {
  const { storage } = memory(), op = operation();
  claimRuntimeOperation(storage, op); saveRuntimeJob(storage, op, job('done'));
  saveRuntimeJob(storage, op, job('running'));
  assert.equal(readRuntimeOperation(storage, owner)?.job?.state, 'done');
  clearRuntimeOperation(storage, op);
  assert.throws(() => saveRuntimeJob(storage, op, job('running')), code('pending'));
  assert.equal(readRuntimeOperation(storage, owner), null);
});

test('one POST follows queued and running states to a structured terminal outcome', async () => {
  const phases: RuntimePhase[] = [], states: string[] = []; let posts = 0, reads = 0;
  const answer = await followRuntimeOperation(operation(), deps({
    submit: async () => { posts++; return { job: job('queued') }; },
    read: async () => ({ job: job(reads++ ? 'done' : 'running') }),
    save: (j: RuntimeJob) => states.push(j.state), phase: (s: RuntimePhase) => phases.push(s),
  }));
  assert.equal(posts, 1); assert.equal(reads, 2); assert.deepEqual(answer, job('done').outcome);
  assert.deepEqual(states, ['queued', 'running', 'done']);
  assert.deepEqual(phases, ['submitting', 'queued', 'running', 'confirming']);
});

test('a lost POST response recovers by GET without issuing another POST', async () => {
  let posts = 0, reads = 0;
  const result = await followRuntimeOperation(operation(), deps({ submit: async () => { posts++; throw new Error('response lost'); },
    read: async () => { reads++; return { job: job('done') }; } }));
  assert.deepEqual(result, job('done').outcome); assert.equal(posts, 1); assert.equal(reads, 1);
});

test('reload recovery is read-only and a locally saved done receipt survives server retention', async () => {
  let reads = 0;
  assert.deepEqual(await followRuntimeOperation(operation(), deps({ read: async () => { reads++; return { job: job('done') }; } })), job('done').outcome);
  assert.equal(reads, 1);
  assert.deepEqual(await followRuntimeOperation({ ...operation(), job: job('done') }, deps({ read: async () => { assert.fail('terminal receipt needs no server replay'); } })), job('done').outcome);
});

test('missing, offline, restarted or mismatched jobs never become success or replacement requests', async () => {
  for (const status of [404, 503, 'FETCH_ERROR']) {
    await assert.rejects(followRuntimeOperation(operation(), deps({ read: async () => { throw { status }; } })), code(status === 404 ? 'missing' : 'unreachable'));
  }
  for (const changed of [{ id: 'different' }, { instance: 'c'.repeat(32) }, { patch_id: 'other' }, { kind: 'remove' },
    { finished_at: null }, { result: 'different' }, { outcome: undefined }]) {
    assert.equal(parseRuntimeJob({ job: { ...job('done'), ...changed } }, operation()), null);
    await assert.rejects(followRuntimeOperation(operation(), deps({ read: async () => ({ job: { ...job('done'), ...changed } }) })), code('receipt'));
  }
});

test('failed jobs preserve actionable refusal details and are saved before being surfaced', async () => {
  let saved = false;
  await assert.rejects(followRuntimeOperation(operation(), deps({ read: async () => ({ job: job('failed') }), save: () => { saved = true; } })),
    e => { assert.equal(saved, true); assert.deepEqual(e, { status: 409, data: { error: 'needs_base: base', missing: ['base'] } }); return true; });
});

test('account or route departure suppresses polling, stored outcomes and late notices', async () => {
  for (const stage of ['before', 'submit', 'read', 'wait']) {
    let current = stage !== 'before', reads = 0, saves = 0;
    const result = await followRuntimeOperation(operation(), deps({ current: () => current,
      submit: async () => { if (stage === 'submit') current = false; return { job: job('queued') }; },
      read: async () => { reads++; if (stage === 'read') current = false; return { job: job('done') }; },
      wait: async () => { if (stage === 'wait') current = false; }, save: () => { saves++; },
    }));
    assert.equal(result, null); assert.equal(reads, stage === 'read' ? 1 : 0);
    assert.equal(saves, stage === 'read' || stage === 'wait' ? 1 : 0);
  }
});

test('resumed unload confirmation protects the original other layers instead of adopting a changed baseline', async () => {
  const target = manageFixture().anchor;
  const row = (id: string) => ({ patch_id: id, sha256: id === target.id ? target.patch_sha256 : id, position: 0, reason: 'manual', applied_at: now });
  const before = [row(target.id), row('other')] as any;
  const context = { current: () => true, node, subject,
    readAccess: async () => ({ signedIn: true, isOwner: true, address: node, subject }),
    read: async () => ({ ...manageFixture(), applied: false }),
    runtime: async () => ({ available: true, hook: true, applied: [], stack: [] }),
  };
  await assert.rejects(confirmRuntimeKnowledge(target, 'unload', false, before, { result: 'unloaded', stack: [] }, context),
    e => e instanceof LoadKnowledgeError && e.code === 'unconfirmed');
  assert.deepEqual(await confirmRuntimeKnowledge(target, 'unload', false, before, { result: 'unloaded', stack: [row('other')] }, {
    ...context, runtime: async () => ({ available: true, hook: true, applied: ['other'], stack: [row('other')] }),
  }), { order: [], already: false, alias: null });
});
