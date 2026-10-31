import test from 'node:test';
import assert from 'node:assert/strict';
import { readAgentSharingReview, sameAgentSharingReview, agentSharingConfirmed, saveReviewedSharing, AgentSharingError, type AgentSharingReview } from '../src/lib/agentSharing';
const review: AgentSharingReview = { id: 'agent', kind: 'linked', owner: 'sso:owner', actor: 'sso:owner', registry: 'https://node.example', revision: 'a'.repeat(64), visibility: 'private', orgId: null };
const change = { visibility: 'org' as const, orgId: 'chosen-org' };
const after: AgentSharingReview = { ...review, ...change, revision: 'b'.repeat(64) };
const receipt = { review: after, applied: { expected: review, ...change }, agent: { agentId: review.id, registryIssuer: review.registry, ownerRef: { subject: review.owner, issuer: review.registry }, visibility: change.visibility, orgRef: { subject: change.orgId } } };
const reason = (value: string) => (error: unknown) => error instanceof AgentSharingError && error.reason === value;

test('sharing review refuses missing identity/permission fields and never defaults an unknown visibility to public', () => {
  assert.deepEqual(readAgentSharingReview({ review }), review);
  for (const patch of [{ visibility: undefined }, { visibility: 'unknown' }, { actor: '' }, { owner: '' }, { kind: 'config' }, { revision: 'bad' }, { orgId: 'stray' }, { visibility: 'org', orgId: null }, { extra: true }]) assert.equal(readAgentSharingReview({ review: { ...review, ...patch } }), null);
  assert.equal(sameAgentSharingReview({ ...review, actor: 'other' }, review), false);
});

test('sharing success must identify reviewed before state, exact selection and consistent after/ref state', () => {
  assert.deepEqual(agentSharingConfirmed(receipt, review, change), after);
  const variants = [null, {}, { agent: receipt.agent }, { ...receipt, applied: { ...receipt.applied, orgId: 'other' } },
    ...[{ id: 'other' }, { owner: 'other' }, { actor: 'other' }, { registry: 'https://other.example' }, { kind: 'hosted' }, { revision: review.revision }, { visibility: 'private', orgId: null }].map(patch => ({ ...receipt, review: { ...after, ...patch } })),
    ...[{ agentId: 'other' }, { ownerRef: { subject: review.owner, issuer: 'https://other.example' } }, { visibility: 'public' }, { orgRef: { subject: 'other' } }].map(patch => ({ ...receipt, agent: { ...receipt.agent, ...patch } })),
    { ...receipt, applied: { ...receipt.applied, expected: { ...review, revision: 'c'.repeat(64) } } },
  ];
  for (const result of variants) assert.equal(agentSharingConfirmed(result, review, change), null);
});

test('fresh preflight binds one save to the full review and returns only the confirmed new settings', async () => {
  const calls: string[] = [];
  const result = await saveReviewedSharing(review, change, { current: () => true, read: async () => { calls.push('read'); return { review }; }, send: async body => { calls.push('write'); assert.deepEqual(body, { id: review.id, expected: review, ...change }); return receipt; } });
  assert.deepEqual(result, after); assert.deepEqual(calls, ['read', 'write']);
});

test('changed or unavailable preflight and departure before write cannot mutate sharing', async () => {
  for (const patch of [{ actor: 'other' }, { revision: 'c'.repeat(64) }, { owner: 'other' }, { kind: 'hosted' }, { registry: 'https://other.example' }, { visibility: 'public' }]) {
    await assert.rejects(saveReviewedSharing(review, change, { current: () => true, read: async () => ({ review: { ...review, ...patch } }), send: async () => assert.fail('no write') }), reason('changed'));
  }
  await assert.rejects(saveReviewedSharing(review, change, { current: () => true, read: async () => { throw new Error('unavailable'); }, send: async () => assert.fail('no write') }), /unavailable/);
  let current = true;
  assert.equal(await saveReviewedSharing(review, change, { current: () => current, read: async () => { current = false; return { review }; }, send: async () => assert.fail('no write') }), null);
});

test('lost or contradictory writes are unconfirmed, with no retry; recognized refusals retain their code', async () => {
  for (const error of [{ status: 503 }, { status: 'FETCH_ERROR' }, { status: 409, data: { error: { code: 'unexpected' } } }]) {
    let writes = 0;
    await assert.rejects(saveReviewedSharing(review, change, { current: () => true, read: async () => ({ review }), send: async () => { writes++; throw error; } }), reason('unconfirmed'));
    assert.equal(writes, 1);
  }
  await assert.rejects(saveReviewedSharing(review, change, { current: () => true, read: async () => ({ review }), send: async () => ({}) }), reason('unconfirmed'));
  const refused = { status: 409, data: { error: { code: 'review_changed' } } };
  await assert.rejects(saveReviewedSharing(review, change, { current: () => true, read: async () => ({ review }), send: async () => { throw refused; } }), error => error === refused);
});

test('departure after a verified write cannot apply feedback to another view', async () => {
  let current = true;
  assert.equal(await saveReviewedSharing(review, change, { current: () => current, read: async () => ({ review }), send: async () => { current = false; return receipt; } }), null);
});

test('actual sharing transport sends the full review and preserves uncertain cache state', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'), { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request; let reads = 0, writes = 0;
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init); assert.equal(new URL(req.url).pathname, '/api/shared-agents/agent/visibility');
    if (req.method === 'GET') { reads++; return Response.json({ review }); }
    assert.equal(req.method, 'PUT'); assert.deepEqual(await req.json(), { expected: review, ...change });
    writes++; return Response.json(writes === 1 ? { agent: {} } : receipt);
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const query = store.dispatch(api.endpoints.agentVisibility.initiate({ id: review.id, identity: review.actor }));
  try {
    await query.unwrap(); await store.dispatch(api.endpoints.setAgentVisibility.initiate({ id: review.id, expected: review, ...change })).unwrap();
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, 1);
    await store.dispatch(api.endpoints.setAgentVisibility.initiate({ id: review.id, expected: review, ...change })).unwrap();
    await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(reads, 2); assert.equal(writes, 2);
  } finally { query.unsubscribe(); store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
