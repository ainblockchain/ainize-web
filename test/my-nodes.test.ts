import test from 'node:test';
import assert from 'node:assert/strict';
import { readMyNodes, disconnectMyNode, NodeLinkActionError } from '../src/lib/myNodes';
const address = '0x' + 'a'.repeat(40), hub = '0x' + 'b'.repeat(40), owner = 'sso:alice', revision = 'c'.repeat(64);
const row = { address, name: 'Node A', roles: [], ledger: null, version: 'test', agents: [], seen: true, last_seen: 1, connected_at: 1, is_this_hub: false, operable: false, can_unlink: true, revision };
const list = (nodes: unknown[] = [row]) => ({ nodes, hub: 'https://node.test', hub_address: hub, owner });
const selected = { address, revision, hubAddress: hub };

test('node inventories reject wrong owner, duplicate addresses, malformed rows and foreign operator links', () => {
  assert.equal(readMyNodes(list(), owner)?.reviewed, true);
  assert.equal(readMyNodes(list(), 'sso:bob'), null);
  for (const nodes of [[row, row], [null], [{ ...row, roles: {} }], [{ ...row, operable: true }], [{ ...row, is_this_hub: true }], [{ ...row, revision: 'bad' }]]) assert.equal(readMyNodes(list(nodes), owner), null);
  assert.equal(readMyNodes({ nodes: [row], hub: 'https://node.test' }, owner)?.reviewed, false);
});
test('disconnect revalidates the selected connection and confirms exact receipt and resulting list', async () => {
  let reads = 0, writes = 0;
  const result = await disconnectMyNode(selected, owner, { current: () => true, read: async () => ++reads === 1 ? list() : list([]), write: async input => {
    writes++; assert.deepEqual(input, { address, expected_revision: revision }); return { ok: true, address, revision };
  } });
  assert.deepEqual(result, { address }); assert.equal(reads, 2); assert.equal(writes, 1);
});
test('changed connections and departed accounts cannot send a disconnect', async () => {
  for (const value of [list([{ ...row, revision: 'd'.repeat(64) }]), list([]), { ...list(), hub_address: '0x' + 'e'.repeat(40) }]) {
    await assert.rejects(disconnectMyNode(selected, owner, { current: () => true, read: async () => value, write: async () => assert.fail('must not write') }), e => e instanceof NodeLinkActionError);
  }
  let current = true;
  assert.equal(await disconnectMyNode(selected, owner, { current: () => current, read: async () => { current = false; return list(); }, write: async () => assert.fail('departed') }), null);
});
test('lost or mismatched outcomes never claim success or automatically resend', async () => {
  for (const reply of [{ ok: true }, { ok: true, address: hub, revision }, { ok: true, address, revision: 'd'.repeat(64) }]) {
    let writes = 0;
    await assert.rejects(disconnectMyNode(selected, owner, { current: () => true, read: async () => list(), write: async () => { writes++; return reply; } }), e => e instanceof NodeLinkActionError && e.code === 'unconfirmed');
    assert.equal(writes, 1);
  }
  await assert.rejects(disconnectMyNode(selected, owner, { current: () => true, read: async () => list(), write: async () => ({ ok: true, address, revision }) }), e => e instanceof NodeLinkActionError && e.code === 'unconfirmed');
});

test('disconnect accepts an intrinsic operator row after unlinking without claiming that the node stopped', async () => {
  let reads = 0;
  const local = { ...row, address: hub, is_this_hub: true, operable: true };
  const result = await disconnectMyNode({ ...selected, address: hub }, owner, {
    current: () => true,
    read: async () => ++reads === 1 ? list([local]) : list([{ ...local, can_unlink: false, revision: null }]),
    write: async () => ({ ok: true, address: hub, revision }),
  });
  assert.deepEqual(result, { address: hub });
});
test('lost disconnect response is unconfirmed once and account departure suppresses readback results', async () => {
  let reads = 0, writes = 0;
  await assert.rejects(disconnectMyNode(selected, owner, {
    current: () => true, read: async () => { reads++; return list(); },
    write: async () => { writes++; throw new Error('connection lost'); },
  }), e => e instanceof NodeLinkActionError && e.code === 'unconfirmed');
  assert.equal(writes, 1); assert.equal(reads, 1);
  let current = true;
  assert.equal(await disconnectMyNode(selected, owner, { current: () => current, read: async () => list(), write: async () => { current = false; return { ok: true, address, revision }; } }), null);
});
test('actual disconnect endpoint sends the selected address and reviewed revision in one DELETE', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); }
  };
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++; const request = new Request(input, init);
    assert.equal(new URL(request.url).pathname, '/api/my/nodes/' + address);
    assert.equal(request.method, 'DELETE');
    assert.deepEqual(await request.json(), { expected_revision: revision });
    return Response.json({ ok: true, address, revision });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    assert.deepEqual(await store.dispatch(api.endpoints.unlinkNode.initiate({ address, expected_revision: revision })).unwrap(), { ok: true, address, revision });
    assert.equal(calls, 1);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
