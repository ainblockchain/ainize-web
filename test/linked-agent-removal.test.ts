import test from 'node:test';
import assert from 'node:assert/strict';
import { createLinkedAgentRemoval, readLinkedAgentUnlinkReview, linkedAgentRemovalConfirmed, LinkedAgentRemovalError, type LinkedAgentUnlinkRequest } from '../src/lib/linkedAgentRemoval';
const actor = 'sso:owner';
const review = { id: 'agent', name: 'Stored name', owner: actor, revision: 'a'.repeat(64) };
const raw = { agent: { id: review.id, name: review.name, owner: actor, can_unlink: true, unlink_review: review } };
const request: LinkedAgentUnlinkRequest = { id: review.id, expected_actor: actor, expected: review };
const receipt = { deleted: review.id, registry: 'unlinked', actor, removed: review };
const target = { id: review.id, owner: actor };
const errorReason = (reason: string) => (error: unknown) => error instanceof LinkedAgentRemovalError && error.reason === reason;

test('unlink review requires permission, exact displayed identity and a valid comparison token', () => {
  assert.deepEqual(readLinkedAgentUnlinkReview(raw), review);
  for (const patch of [{ can_unlink: false }, { id: 'other' }, { owner: 'other' }, { name: 'Other' }, { unlink_review: { ...review, revision: '' } }, { unlink_review: { ...review, extra: true } }]) {
    assert.equal(readLinkedAgentUnlinkReview({ agent: { ...raw.agent, ...patch } }), null);
  }
  for (const value of [null, {}, { deleted: review.id }, { ...receipt, actor: 'other' }, { ...receipt, removed: { ...review, revision: 'b'.repeat(64) } }, { ...receipt, registry: 'pending' }]) assert.equal(linkedAgentRemovalConfirmed(value, request), false);
  assert.equal(linkedAgentRemovalConfirmed(receipt, request), true);
});

test('reads fresh detail before confirmation, then sends the reviewed actor and target exactly once', async () => {
  const controller = createLinkedAgentRemoval(), steps: string[] = [];
  assert.equal(await controller.run(target, actor, { current: () => true,
    read: async () => { steps.push('read'); return raw; }, confirm: value => { steps.push('confirm'); assert.deepEqual(value, review); return true; },
    send: async value => { steps.push('write'); assert.deepEqual(value, request); return receipt; },
  }), true);
  assert.deepEqual(steps, ['read', 'confirm', 'write']); assert.equal(controller.confirmed(), true); assert.equal(controller.uncertain(), false);
});

test('wrong target/owner and unsupported detail never open confirmation or send an unlink', async () => {
  for (const chosen of [{ id: 'other', owner: actor }, { id: review.id, owner: 'other' }, target]) {
    const controller = createLinkedAgentRemoval();
    await assert.rejects(controller.run(chosen, actor, { current: () => true, read: async () => chosen === target ? {} : raw,
      confirm: () => assert.fail('invalid review'), send: async () => assert.fail('invalid review'),
    }), errorReason(chosen === target ? 'unsupported' : 'changed'));
    assert.equal(controller.blocked(), false);
  }
});

test('decline or departure during read/confirmation cannot submit, and overlapping clicks share one read', async () => {
  for (const leave of ['read', 'confirm', 'decline']) {
    let current = true;
    const c = createLinkedAgentRemoval();
    assert.equal(await c.run(target, actor, { current: () => current, read: async () => { if (leave === 'read') current = false; return raw; },
      confirm: () => { if (leave === 'confirm') current = false; return leave !== 'decline'; }, send: async () => assert.fail('no write'),
    }), false);
  }
  const c = createLinkedAgentRemoval(); let finish!: (value: unknown) => void;
  const io = { current: () => true, read: () => new Promise(resolve => { finish = resolve; }), confirm: () => true, send: async () => receipt };
  const first = c.run(target, actor, io); assert.equal(await c.run(target, actor, io), false);
  finish(raw); assert.equal(await first, true);
});

test('lost, failed or mismatched acknowledgements block another unlink instead of claiming completion', async () => {
  for (const result of [undefined, { deleted: 'agent' }, { ...receipt, removed: { ...review, owner: 'other' } }, { ...receipt, actor: 'other' }]) {
    const c = createLinkedAgentRemoval(); let writes = 0;
    const io = { current: () => true, read: async () => raw, confirm: () => true, send: async () => { writes++; if (result === undefined) throw { status: 503 }; return result; } };
    await assert.rejects(c.run(target, actor, io));
    assert.equal(c.uncertain(), true); assert.equal(c.confirmed(), false); assert.equal(await c.run(target, actor, io), false); assert.equal(writes, 1);
  }
});

test('known pre-write refusals allow fresh review; unknown conflicts remain uncertain', async () => {
  for (const code of ['review_changed', 'not_found', 'not_owner', 'unexpected']) {
    const c = createLinkedAgentRemoval();
    await assert.rejects(c.run(target, actor, { current: () => true, read: async () => raw, confirm: () => true, send: async () => { throw { status: 409, data: { error: { code } } }; } }));
    assert.equal(c.uncertain(), code === 'unexpected');
  }
});

test('a confirmed reply after view departure records its outcome without triggering navigation', async () => {
  const c = createLinkedAgentRemoval(); let current = true;
  assert.equal(await c.run(target, actor, { current: () => current, read: async () => raw, confirm: () => true, send: async () => { current = false; return receipt; } }), false);
  assert.equal(c.confirmed(), true); assert.equal(c.uncertain(), false);
});

test('actual mutation sends the reviewed DELETE body and invalidates lists only for an exact acknowledgement', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'); const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  let reads = 0, writes = 0;
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); assert.equal(new URL(req.url).pathname, '/api/linked-agents/agent');
    if (req.method === 'GET') { reads++; return Response.json(raw); }
    assert.equal(req.method, 'DELETE'); assert.deepEqual(await req.json(), { expected_actor: actor, expected: review });
    writes++; return Response.json(writes === 1 ? { deleted: 'agent' } : receipt);
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const subscription = store.dispatch(api.endpoints.linkedAgent.initiate({ id: 'agent', identity: actor }));
  try {
    await subscription.unwrap(); await store.dispatch(api.endpoints.deleteLinkedAgent.initiate(request)).unwrap();
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, 1, 'uncertain response must not erase the active result through automatic refetch');
    await store.dispatch(api.endpoints.deleteLinkedAgent.initiate(request)).unwrap();
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, 2); assert.equal(writes, 2);
  } finally { subscription.unsubscribe(); store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
