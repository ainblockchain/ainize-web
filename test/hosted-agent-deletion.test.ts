import test from 'node:test';
import assert from 'node:assert/strict';
import { agentDeletionRequest, agentDeletionComplete, agentCleanupProgress, createHostedAgentDeletion, type AgentDeletionReview } from '../src/lib/hostedAgentDeletion';
import { createAgentActionScope } from '../src/lib/agentActionScope';
const target = { id: 'agent', name: 'Agent', owner: 'alice' };
const review: AgentDeletionReview = { ...target, generation: 'registration-1', version: 3, actor: 'alice', registry: 'https://node.example', revision: 'a'.repeat(64), cleanupId: null };
const fresh = (r = review) => ({ agent: { id: r.id, name: r.name, owner: r.owner, version: r.version, can_delete: true, delete_review: r } });
const request = { id: target.id, expected: review };
const receipt = (r = review) => ({ deleted: r.id, cleanup: 'complete', operationId: r.cleanupId ?? 'operation-1', removed: r, actor: r.actor, registry: r.registry });
const continued = { ...review, cleanupId: 'operation-1', revision: 'b'.repeat(64) };
const pending = (before = review, after = continued) => ({ status: 502, data: { error: { code: 'agent_cleanup_pending' }, pending: { expected: before, operationId: after.cleanupId, review: after } } });
const active = () => true, confirm = () => true;
const io = (send: (r: typeof request) => Promise<unknown>, r = review) => ({ read: async () => fresh(r), confirm, send, active });

test('fresh authorization pins actor, generation, version, registry and exact review', () => {
  assert.deepEqual(agentDeletionRequest(fresh(), target, 'alice'), request);
  for (const change of [{ id: 'other' }, { name: 'Other' }, { owner: 'bob' }, { can_delete: false }, { can_delete: undefined }, { version: 0 }, { version: '3' }])
    assert.equal(agentDeletionRequest({ agent: { ...fresh().agent, ...change } }, target, 'alice'), null);
  assert.equal(agentDeletionRequest(fresh(), target, 'bob'), null);
  for (const bad of [null, {}, { ...review, generation: '' }, { ...review, revision: 'opaque' }, { ...review, extra: true }])
    assert.equal(agentDeletionRequest({ agent: { ...fresh().agent, delete_review: bad } }, target, 'alice'), null);
});
test('success is an exact receipt, never an id-only acknowledgment', () => {
  assert.equal(agentDeletionComplete(receipt(), request), true);
  for (const raw of [null, [], {}, { deleted: target.id, cleanup: 'complete' }, { ...receipt(), deleted: 'other' }, { ...receipt(), actor: 'bob' },
    { ...receipt(), registry: 'https://other.example' }, { ...receipt(), removed: { ...review, generation: 'registration-2' } },
    { ...receipt(), operationId: '' }, { ...receipt(), cleanup: 'pending' }, { ...receipt(), archiveId: '' }])
    assert.equal(agentDeletionComplete(raw, request), false);
  assert.equal(agentDeletionComplete(receipt(), { id: target.id, expected: continued }), false);
  assert.equal(agentDeletionComplete(receipt(continued), { id: target.id, expected: continued }), true);
});
test('fresh-read failure or changed identity sends nothing and permits another read', async () => {
  const gate = createHostedAgentDeletion(), send = async () => assert.fail('must not send');
  await assert.rejects(gate.run(target, 'alice', { ...io(send), read: async () => ({}) }), /changed/);
  await assert.rejects(gate.run(target, 'alice', { ...io(send), read: async () => { throw new Error('offline'); } }), /offline/);
  assert.equal(gate.blocked(), false); assert.equal(gate.started(), false);
});
test('confirmation happens after reading, and cancellation or account departure dispatches nothing', async () => {
  for (const leave of [false, true]) {
    const gate = createHostedAgentDeletion(); let alive = true, read = false;
    assert.equal(await gate.run(target, 'alice', { read: async () => { read = true; return fresh(); }, confirm: r => {
      assert.equal(read, true); assert.deepEqual(r, review); alive = !leave; return leave;
    }, active: () => alive, send: async () => assert.fail('cancelled or departed') }), false);
    assert.equal(gate.started(), false);
  }
});
test('one synchronous gate covers preflight; departure cannot send', async () => {
  let resolve!: (v: unknown) => void, alive = true;
  const gate = createHostedAgentDeletion();
  const first = gate.run(target, 'alice', { ...io(async () => assert.fail('departed')), read: () => new Promise(r => { resolve = r; }), active: () => alive });
  assert.equal(await gate.run(target, 'alice', { ...io(async () => receipt()), read: async () => assert.fail('overlap') }), false);
  alive = false; resolve(fresh()); assert.equal(await first, false);
});
test('malformed acknowledgments, bare pending codes and lost replies lock repetition', async () => {
  for (const send of [async () => ({}), async () => ({ ...receipt(), deleted: 'other' }), async () => { throw new Error('lost'); },
    async () => { throw { status: 502, data: { error: { code: 'agent_cleanup_pending' } } }; }]) {
    const gate = createHostedAgentDeletion(); await assert.rejects(gate.run(target, 'alice', io(send)));
    assert.equal(gate.uncertain(), true); assert.equal(gate.started(), true);
    assert.equal(await gate.run(target, 'alice', { ...io(send), read: async () => assert.fail('unknown repeated') }), false);
  }
});
test('progress must bind both the reviewed registration and the cleanup operation', () => {
  assert.deepEqual(agentCleanupProgress(pending(), request), continued);
  for (const change of [{ generation: 'new' }, { actor: 'bob' }, { registry: 'https://other.example' }, { cleanupId: null }, { revision: review.revision }])
    assert.equal(agentCleanupProgress(pending(review, { ...continued, ...change }), request), null);
  assert.equal(agentCleanupProgress(pending({ ...review, revision: 'c'.repeat(64) }), request), null);
  assert.equal(agentCleanupProgress(pending(continued, { ...continued, cleanupId: 'different' })), null);
});
test('only the same registration and cleanup can resume after a panel remount', async () => {
  const scope = createAgentActionScope(), gate = scope.hostedDeletion;
  await assert.rejects(gate.run(target, 'alice', io(async () => { throw pending(); })));
  assert.equal(gate.blocked(), false); assert.equal(gate.started(), true);
  const remounted = scope.hostedDeletion; assert.equal(remounted, gate);
  for (const change of [{ generation: 'new' }, { cleanupId: 'different' }, { owner: 'bob' }, { version: 4 }]) {
    await assert.rejects(remounted.run(target, 'alice', io(async () => assert.fail('wrong cleanup'), { ...continued, ...change })), /changed/);
    assert.equal(gate.uncertain(), false);
  }
  const afterArchive = { ...continued, revision: 'c'.repeat(64) };
  assert.equal(await remounted.run(target, 'alice', io(async r => receipt(r.expected), afterArchive)), true);
  assert.equal(gate.confirmed(), true);
});
test('a pending receipt for another request never unlocks retry', async () => {
  const gate = createHostedAgentDeletion();
  await assert.rejects(gate.run(target, 'alice', io(async () => { throw pending({ ...review, actor: 'bob' }, { ...continued, actor: 'bob' }); })));
  assert.equal(gate.uncertain(), true);
});
test('stale-target refusal allows a fresh review without claiming deletion started', async () => {
  const gate = createHostedAgentDeletion();
  await assert.rejects(gate.run(target, 'alice', io(async () => { throw { status: 409, data: { error: { code: 'agent_changed' } } }; })));
  assert.equal(gate.blocked(), false); assert.equal(gate.started(), false);
});
test('confirmed deletion remains known after departure without navigating', async () => {
  const gate = createHostedAgentDeletion(); let current = true;
  assert.equal(await gate.run(target, 'alice', { ...io(async () => { current = false; return receipt(); }), active: () => current }), false);
  assert.equal(gate.confirmed(), true); assert.equal(gate.uncertain(), false);
});

test('actual DELETE transport sends reviewed identity and refreshes lists only for exact completion', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'), { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  let reads = 0, writes = 0;
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); assert.equal(new URL(req.url).pathname, '/api/hosted-agents/agent');
    if (req.method === 'GET') { reads++; return Response.json(fresh()); }
    assert.equal(req.method, 'DELETE'); assert.deepEqual(await req.json(), { expected: review });
    writes++;
    if (writes === 1) return Response.json({ deleted: target.id, cleanup: 'complete' });
    if (writes === 2) return Response.json(pending().data, { status: 502 });
    return Response.json(receipt());
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const subscription = store.dispatch(api.endpoints.hostedAgent.initiate({ id: target.id, identity: 'alice' }));
  try {
    await subscription.unwrap();
    await store.dispatch(api.endpoints.deleteHostedAgent.initiate(request)).unwrap();
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, 1);
    await assert.rejects(store.dispatch(api.endpoints.deleteHostedAgent.initiate(request)).unwrap());
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, 1);
    await store.dispatch(api.endpoints.deleteHostedAgent.initiate(request)).unwrap();
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, 2); assert.equal(writes, 3);
  } finally { subscription.unsubscribe(); store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});

test('an older node without a deletion review explains unsupported verification before confirmation', async () => {
  const gate = createHostedAgentDeletion();
  await assert.rejects(gate.run(target, 'alice', { ...io(async () => assert.fail('unreviewed write')),
    read: async () => ({ agent: { ...target, version: 3, can_delete: true } }), confirm: () => assert.fail('unreviewed confirmation') }), /unsupported/);
  assert.equal(gate.started(), false); assert.equal(gate.blocked(), false);
});
test('pending target remains pinned for list buttons until verified completion', async () => {
  const gate = createHostedAgentDeletion(); assert.equal(gate.pendingId(), null);
  await assert.rejects(gate.run(target, 'alice', io(async () => { throw pending(); })));
  assert.equal(gate.pendingId(), target.id);
  await gate.run(target, 'alice', io(async () => receipt(continued), continued));
  assert.equal(gate.pendingId(), null);
});
