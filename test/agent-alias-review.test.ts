import test from 'node:test';
import assert from 'node:assert/strict';
import { readAgentAliasReview, agentAliasChangeConfirmed, changeReviewedAlias, AgentAliasChangeError, type AgentAliasReview } from '../src/lib/agentAliasChange';
const review: AgentAliasReview = { id: 'agent', kind: 'linked', owner: 'sso:owner', actor: 'sso:owner', registry: 'https://node.example', revision: 'a'.repeat(64), alias: 'old', state: 'active' };
const change = { id: 'agent', expected: review, alias: 'chosen' };
const after = { ...review, revision: 'b'.repeat(64), alias: change.alias };
const receipt = { id: review.id, alias: after.alias, applied: { expected: review, alias: after.alias }, review: after };
const reason = (name: string) => (e: unknown) => e instanceof AgentAliasChangeError && e.reason === name;
test('alias review rejects incomplete, malformed and self-referencing addresses instead of inventing an empty state', () => {
  assert.deepEqual(readAgentAliasReview({ review }), review);
  for (const patch of [{ state: undefined }, { state: 'none' }, { state: 'invalid' }, { alias: undefined }, { alias: 'BAD' }, { alias: review.id }, { actor: '' }, { kind: 'other' }, { owner: '' }, { revision: 'bad' }, { registry: '' }, { extra: true }]) assert.equal(readAgentAliasReview({ review: { ...review, ...patch } }), null);
});
test('save receipt must match the exact address, reviewed target and before/after identity', () => {
  assert.deepEqual(agentAliasChangeConfirmed(receipt, change), after);
  for (const raw of [null, {}, { id: 'agent', alias: 'chosen' }, { ...receipt, alias: 'other' }, { ...receipt, id: 'other' },
    { ...receipt, applied: { expected: review, alias: 'other' } }, { ...receipt, applied: { expected: { ...review, alias: 'other' }, alias: after.alias } },
    ...[{ id: 'other' }, { owner: 'other' }, { actor: 'other' }, { registry: 'https://other.example' }, { kind: 'hosted' }, { revision: review.revision }, { alias: 'other' }].map(patch => ({ ...receipt, review: { ...after, ...patch } }))]) assert.equal(agentAliasChangeConfirmed(raw, change), null);
  assert.equal(agentAliasChangeConfirmed({ ...receipt, review: { ...after, state: 'unverified' } }, change), null);
  const removed = { ...receipt, alias: null, applied: { expected: review, alias: null }, review: { ...after, alias: null, state: 'none' } };
  assert.equal(agentAliasChangeConfirmed(removed, change), null);
  assert.deepEqual(agentAliasChangeConfirmed(removed, { ...change, alias: null }), removed.review);
});
test('preflight prevents writes after account, resource or address changes, unavailable reads and departure', async () => {
  for (const patch of [{ id: 'other' }, { actor: 'other' }, { kind: 'hosted' }, { owner: 'other' }, { registry: 'other' }, { alias: 'other' }, { revision: 'c'.repeat(64) }]) {
    await assert.rejects(changeReviewedAlias(change, { current: () => true, read: async () => ({ review: { ...review, ...patch } }), send: async () => assert.fail('no write') }), reason('changed'));
  }
  await assert.rejects(changeReviewedAlias(change, { current: () => true, read: async () => { throw new Error('offline'); }, send: async () => assert.fail('no write') }), reason('read_failed'));
  let current = true;
  assert.equal(await changeReviewedAlias(change, { current: () => current, read: async () => { current = false; return { review }; }, send: async () => assert.fail('no write') }), null);
});
test('only a confirmed reply permits navigation data; unknown writes never retry', async () => {
  let calls = 0;
  assert.deepEqual(await changeReviewedAlias(change, { current: () => true, read: async () => ({ review }), send: async body => { calls++; assert.deepEqual(body, change); return receipt; } }), after);
  assert.equal(calls, 1);
  for (const result of [null, {}, { id: 'agent', alias: 'chosen' }]) {
    let writes = 0;
    await assert.rejects(changeReviewedAlias(change, { current: () => true, read: async () => ({ review }), send: async () => { writes++; return result; } }), reason('unconfirmed'));
    assert.equal(writes, 1);
  }
  for (const error of [{ status: 503 }, { status: 'FETCH_ERROR' }, { status: 409, data: { error: { code: 'unknown_conflict' } } }]) {
    let writes = 0;
    await assert.rejects(changeReviewedAlias(change, { current: () => true, read: async () => ({ review }), send: async () => { writes++; throw error; } }), reason('unconfirmed'));
    assert.equal(writes, 1);
  }
});
test('only explicit pre-write refusal codes allow another attempt; departure after success cannot navigate', async () => {
  for (const code of ['alias_taken', 'review_changed', 'not_owner']) {
    const error = { status: 409, data: { error: { code } } };
    await assert.rejects(changeReviewedAlias(change, { current: () => true, read: async () => ({ review }), send: async () => { throw error; } }), e => e === error);
  }
  let current = true;
  assert.equal(await changeReviewedAlias(change, { current: () => current, read: async () => ({ review }), send: async () => { current = false; return receipt; } }), null);
});
test('actual RTK alias transport includes reviewed state and invalidates catalogues only on matching set/delete receipts', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'), { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request; let reads = 0, writes = 0;
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); assert.equal(new URL(req.url).pathname, '/api/agents/agent/alias');
    if (req.method === 'GET') { reads++; return Response.json({ review }); }
    const remove = req.method === 'DELETE';
    assert.deepEqual(await req.json(), remove ? { expected: review } : { alias: change.alias, expected: review });
    writes++;
    if (writes % 2 === 1) return Response.json({ id: 'agent', alias: remove ? null : change.alias });
    return Response.json(remove ? { ...receipt, alias: null, applied: { expected: review, alias: null }, review: { ...after, alias: null, state: 'none' } } : receipt);
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const query = store.dispatch(api.endpoints.agentAliasReview.initiate({ id: review.id, identity: review.actor }));
  try {
    await query.unwrap();
    for (const remove of [false, true]) {
      const before = reads;
      for (let n = 0; n < 2; n++) {
        if (remove) await store.dispatch(api.endpoints.clearAgentAlias.initiate({ id: review.id, expected: review })).unwrap();
        else await store.dispatch(api.endpoints.setAgentAlias.initiate(change)).unwrap();
        await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, before + n);
      }
    }
    assert.equal(writes, 4);
  } finally { query.unsubscribe(); store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});

test('a legacy alias requires explicit connection; its matching text alone is not an active address', async () => {
  const legacy: AgentAliasReview = { ...review, state: 'unverified' };
  assert.deepEqual(readAgentAliasReview({ review: legacy }), legacy);
  const reconnect = { id: legacy.id, expected: legacy, alias: legacy.alias };
  const confirmed = { id: legacy.id, alias: legacy.alias, applied: { expected: legacy, alias: legacy.alias }, review: { ...legacy, state: 'active', revision: 'b'.repeat(64) } };
  assert.equal(agentAliasChangeConfirmed({ ...confirmed, review: legacy }, reconnect), null);
  assert.deepEqual(await changeReviewedAlias(reconnect, { current: () => true, read: async () => ({ review: legacy }), send: async body => { assert.deepEqual(body, reconnect); return confirmed; } }), confirmed.review);
});
