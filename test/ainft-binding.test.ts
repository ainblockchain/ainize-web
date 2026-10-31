import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAinftBinding } from '../src/lib/ainftBinding';

const binding = { agentId: 'chosen', chainId: 0, objectId: '0x' + 'b'.repeat(40), tokenId: '42', release: 3, verifiedAt: 1000 };
test('AINFT reads distinguish no binding from malformed or another agent response', () => {
  assert.equal(parseAinftBinding({ binding: null }, 'chosen'), null);
  for (const value of [{}, { binding: {} }, { binding: { ...binding, agentId: 'other' } }, { binding: { ...binding, chainId: 2 } }, { binding: { ...binding, communityVersion: -1 } }, { binding: { ...binding, community: { appId: 'x', symbol: {} } } }]) {
    assert.equal(parseAinftBinding(value, 'chosen'), undefined);
  }
  assert.deepEqual(parseAinftBinding({ binding }, 'chosen'), { ...binding, communityVersion: 0, community: null });
  assert.deepEqual(parseAinftBinding({ binding: { ...binding, communityVersion: 2, community: { appId: 'studio', symbol: 'POINT' } } }, 'chosen')?.community, { appId: 'studio', symbol: 'POINT' });
});

test('binding writes refresh subscribed views and never send browser account cache keys', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { ainftBindingApi: api } = await import('../src/api/ainftBinding');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  const writes: Record<string, unknown>[] = [];
  let current: typeof binding & { communityVersion?: number; community?: { appId: string; symbol: string } | null } | null = null;
  let badSave = false;
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); }
  };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    assert.ok(path.startsWith('/api/hosted-agents/chosen/ainft-'));
    assert.equal(new URL(request.url).search, '');
    if (request.method === 'POST') {
      const body = await request.json(); writes.push(body);
      assert.equal(body.identity, undefined);
      if (badSave) return Response.json({ binding: { ...binding, agentId: 'another-agent' } });
      if (path.endsWith('/ainft-community')) current = { ...binding, communityVersion: body.expectedVersion + 1, community: body.community };
      else current = { ...binding };
    }
    return Response.json({ binding: current });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: (gdm) => gdm().concat(api.middleware) });
  const scope = { id: 'chosen', identity: 'account-one' };
  const read = store.dispatch(api.endpoints.ainftBinding.initiate(scope));
  try {
    assert.deepEqual(await read.unwrap(), { binding: null });
    assert.equal(api.endpoints.ainftBinding.select({ ...scope, identity: 'other-account' })(store.getState()).data, undefined);
    const body = { chainId: 0 as const, objectId: binding.objectId, tokenId: binding.tokenId, address: '0x' + 'a'.repeat(40) };
    await store.dispatch(api.endpoints.saveAinftBinding.initiate({ ...scope, body })).unwrap();
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    assert.equal(api.endpoints.ainftBinding.select(scope)(store.getState()).data?.binding?.tokenId, '42');
    await store.dispatch(api.endpoints.saveAinftCommunity.initiate({ ...scope, body: { expectedVersion: 0, community: { appId: 'studio', symbol: 'POINT' } } })).unwrap();
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    assert.equal(api.endpoints.ainftBinding.select(scope)(store.getState()).data?.binding?.community?.appId, 'studio');
    assert.equal(writes.length, 2);
    badSave = true;
    await assert.rejects(store.dispatch(api.endpoints.saveAinftBinding.initiate({ ...scope, body })).unwrap());
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    assert.equal(api.endpoints.ainftBinding.select(scope)(store.getState()).data?.binding?.agentId, 'chosen');
  } finally {
    read.unsubscribe(); store.dispatch(api.util.resetApiState());
    globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest;
  }
});
