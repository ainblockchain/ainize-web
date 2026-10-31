import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeRuntimeKnowledge, LoadKnowledgeError, runtimeRefusal, runtimeBaseMismatch, runtimeGuardFailure } from '../src/lib/loadKnowledge';
import { createNodeActionTask } from '../src/lib/accountNodeActions';
import { manageFixture } from './fixtures/manageKnowledge';

const node = '0x' + 'ab'.repeat(20), subject = '0x' + 'bc'.repeat(20);
const p = () => manageFixture();
const layer = (patch_id = 'chosen', sha256 = p().anchor.patch_sha256) => ({ patch_id, sha256, position: 0, applied_at: 100, reason: 'manual' });
const runtime = (stack: ReturnType<typeof layer>[] = []) => ({ available: true, hook: true, applied: stack.map(l => l.patch_id), stack });
const access = { signedIn: true, isOwner: true, address: node, subject };
const ack = (stack = [layer()]) => ({ result: 'loaded', order: ['chosen'], loaded: ['chosen'], stack });
const code = (v: string) => (e: unknown) => e instanceof LoadKnowledgeError && e.code === v;
const noWrite = async () => { assert.fail('must not mutate'); };
const deps = (overrides = {}) => ({ current: () => true, node, subject, readAccess: async (): Promise<unknown> => access, read: async (): Promise<unknown> => p(), runtime: async (): Promise<unknown> => runtime(), write: noWrite as () => Promise<unknown>, ...overrides });

test('load checks target and acknowledges the exact file in fresh detail and runtime records', async () => {
  let reads = 0, states = 0, writes = 0;
  const result = await changeRuntimeKnowledge(p().anchor, 'load', false, deps({ read: async () => ({ ...p(), applied: reads++ > 0 }),
    runtime: async () => runtime(states++ ? [layer()] : []), write: async () => { writes++; return ack(); } }));
  assert.deepEqual(result, { order: ['chosen'], already: false, alias: null }); assert.equal(reads, 2); assert.equal(states, 2); assert.equal(writes, 1);
  assert.deepEqual(await changeRuntimeKnowledge(p().anchor, 'load', false, deps({ read: async () => ({ ...p(), applied: true }), runtime: async () => runtime([layer()]) })), { order: ['chosen'], already: true, alias: null });
});
test('unknown access, substituted artifacts and unavailable runtime never start an operation', async () => {
  for (const fresh of [{ ...access, isOwner: false }, { ...access, address: subject }, { ...access, subject: node }]) {
    await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ readAccess: async () => fresh })), code('access'));
  }
  for (const anchor of [{ ...p().anchor, patch_sha256: 'other' }, { ...p().anchor, author: node }, { ...p().anchor, base: { stack: [] } }]) {
    await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ read: async () => ({ ...p(), anchor }) })), code('changed'));
  }
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ runtime: async () => ({ ...runtime(), available: false }) })), code('unavailable'));
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ runtime: async () => ({ available: true, hook: true, applied: [] }) })), code('unavailable'));
});
test('unload refuses unrecorded targets and confirms other recorded layers remain', async () => {
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'unload', false, deps()), code('not_loaded'));
  const other = layer('other', 'other-sha'); let reads = 0, states = 0;
  const result = await changeRuntimeKnowledge(p().anchor, 'unload', false, deps({ read: async () => ({ ...p(), applied: reads++ === 0 }),
    runtime: async () => runtime(states++ ? [other] : [layer(), other]), write: async () => ({ result: 'removed', stack: [other] }) }));
  assert.deepEqual(result, { order: [], already: false, alias: null });
  reads = 0; states = 0;
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'unload', false, deps({ read: async () => ({ ...p(), applied: reads++ === 0 }),
    runtime: async () => runtime(states++ ? [] : [layer(), other]), write: async () => ({ result: 'removed', stack: [] }) })), code('unconfirmed'));
});
test('missing/wrong acknowledgements and fresh state cannot claim successful load', async () => {
  for (const reply of [{}, { result: 'ok' }, { ...ack(), order: ['other'] }, { ...ack(), loaded: ['unexpected'] }, { ...ack(), stack: [layer('other', 'other-sha')] }, { ...ack(), order: ['chosen', 'chosen'] }]) {
    await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ write: async () => reply })), code('unconfirmed'));
  }
  for (const after of [runtime(), { ...runtime([layer()]), available: false }, runtime([layer('chosen', 'wrong-sha')])]) {
    let reads = 0, states = 0;
    await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ read: async () => ({ ...p(), applied: reads++ > 0 }), runtime: async () => states++ ? after : runtime(), write: async () => ack() })), code('unconfirmed'));
  }
  let states = 0;
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ runtime: async () => runtime(states++ ? [layer()] : []), write: async () => ack() })), code('unconfirmed'));
});
test('equivalent bytes under another recorded id are reported as an alias, not as loading the selected id', async () => {
  let states = 0;
  assert.deepEqual(await changeRuntimeKnowledge(p().anchor, 'load', true, deps({ runtime: async () => runtime(states++ ? [layer('base')] : []),
    write: async () => ({ result: 'base loaded', order: ['base', 'chosen'], loaded: ['base'], stack: [layer('base')] }) })), { order: ['base', 'chosen'], already: false, alias: 'base' });
});
test('load-order notices need the same prerequisite order in the response and fresh records', async () => {
  const base = layer('base', 'base-sha');
  for (const after of [[base, layer()], [layer(), base], [layer()]]) {
    let reads = 0, states = 0;
    const work = changeRuntimeKnowledge(p().anchor, 'load', true, deps({ read: async () => ({ ...p(), applied: reads++ > 0 }),
      runtime: async () => runtime(states++ ? after : []), write: async () => ({ result: 'loaded', order: ['base', 'chosen'], loaded: ['base', 'chosen'], stack: [base, layer()] }) }));
    if (after[0].patch_id === 'base') assert.deepEqual(await work, { order: ['base', 'chosen'], already: false, alias: null });
    else await assert.rejects(work, code('unconfirmed'));
  }
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', true, deps({ write: async () => ({ ...ack(), order: ['nonexistent', 'chosen'] }) })), code('unconfirmed'));
});
test('documented prerequisite/dependent refusals are parsed narrowly and server/transport failures stay unconfirmed', async () => {
  const refusal = { status: 409, data: { error: 'needs_base: base required', missing: ['base'] } };
  assert.deepEqual(runtimeRefusal(refusal, 'needs_base'), ['base']);
  for (const changed of [{ ...refusal, status: 500 }, { ...refusal, data: { ...refusal.data, missing: [{}] } }, { ...refusal, data: { ...refusal.data, missing: ['base', 'base'] } }]) assert.equal(runtimeRefusal(changed, 'needs_base'), null);
  assert.equal(runtimeBaseMismatch({ status: 409, data: { error: 'base_mismatch: different rows' } }), true);
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ write: async () => { throw refusal; } })), e => e === refusal);
  for (const error of [{ status: 500 }, { status: 'FETCH_ERROR' }, new Error('response lost')]) {
    await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ write: async () => { throw error; } })), code('unconfirmed'));
  }
  const recovery = { status: 503, data: { error: 'runtime_restore_pending: previous operation' } };
  await assert.rejects(changeRuntimeKnowledge(p().anchor, 'load', false, deps({ write: async () => { throw recovery; } })), e => e === recovery);
});
test('departure suppresses later reads, writes and completion while a shared task rejects double clicks', async () => {
  for (const stage of ['access', 'read', 'runtime', 'write']) {
    let active = true, writes = 0;
    const result = await changeRuntimeKnowledge(p().anchor, 'load', false, deps({ current: () => active,
      readAccess: async () => { if (stage === 'access') active = false; return access; },
      read: async () => { if (stage === 'read') active = false; return p(); },
      runtime: async () => { if (stage === 'runtime') active = false; return runtime(); },
      write: async () => { writes++; active = false; return ack(); },
    }));
    assert.equal(result, null); assert.equal(writes, stage === 'write' ? 1 : 0);
  }
  const task = createNodeActionTask(); let finish!: () => void, writes = 0, reads = 0, states = 0;
  const pending = new Promise<void>(r => { finish = r; });
  const run = () => task.run(() => true, current => changeRuntimeKnowledge(p().anchor, 'load', false, deps({ current,
    read: async () => ({ ...p(), applied: reads++ > 0 }), runtime: async () => runtime(states++ ? [layer()] : []),
    write: async () => { writes++; await pending; return ack(); },
  })));
  const first = run(); assert.equal(await run(), null); finish(); assert.ok(await first); assert.equal(writes, 1);
});

test('execution-time guards distinguish refused removal, changed plans, order conflicts and unavailable restoration', () => {
  for (const [prefix, code] of [['not_loaded', 'not_loaded'], ['runtime_plan_changed', 'changed'], ['base_artifact_changed', 'changed'], ['runtime_stack_ambiguous', 'changed'], ['runtime_base_order', 'order'], ['runtime_unwind_unavailable', 'restore']]) {
    assert.equal(runtimeGuardFailure({ status: 409, data: { error: `${prefix}: details` } }), code);
    assert.equal(runtimeGuardFailure({ status: 500, data: { error: `${prefix}: details` } }), null);
  }
  assert.equal(runtimeGuardFailure({ status: 409, data: { error: 'unrelated failure' } }), null);
  for (const prefix of ['runtime_restore_pending', 'runtime_restore_snapshot', 'runtime_restore_failed']) {
    assert.equal(runtimeGuardFailure({ status: 503, data: { error: `${prefix}: details` } }), 'recovery');
    assert.equal(runtimeGuardFailure({ status: 500, data: { error: `${prefix}: details` } }), null);
  }
});
