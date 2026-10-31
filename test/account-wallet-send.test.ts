import test from 'node:test';
import assert from 'node:assert/strict';
import { actOnWalletSend, readWalletSend, readWalletSendHistory, walletSendAmount, WalletSendActionError } from '../src/lib/accountWalletSend';
const context = { node: '0x' + 'a'.repeat(40), rpc_url: 'https://rpc.test/json-rpc', chain_id: 0, gas_price: 0 };
const id = 'b'.repeat(32), to = '0x' + 'c'.repeat(40), hash = '0x' + 'd'.repeat(64);
const op = (state: 'prepared' | 'submitted' | 'confirmed' = 'prepared') => ({ version: 1 as const, id, context, actor: context.node, to, amount: '0.125', currency: 'AIN' as const, tx_hash: hash, state, created_at: 1, updated_at: 2 });
const status = (operation: unknown = null) => ({ version: 1, context, operation, read_error: null });
const prepare = { kind: 'prepare' as const, request_id: id, to, amount: '0.125' };
test('wallet-send decimal input refuses JS coercion and six-place or large-number rounding', () => {
  assert.equal(walletSendAmount('0.125000'), '0.125'); assert.equal(walletSendAmount('0.000001'), '0.000001');
  for (const amount of [null, 1, '0', 'Infinity', '0x10', '1e2', '.5', '1.0000001', '9007199254740991.1']) assert.equal(walletSendAmount(amount), null);
});
test('receipt reader requires exact current node and context, precise amount and finality state, never a signed payload', () => {
  assert.ok(readWalletSend(status(op()), context));
  for (const receipt of [{ ...op(), amount: null }, { ...op(), amount: '0x10' }, { ...op(), amount: '0.125000' }, { ...op(), to: context.node }, { ...op(), state: 'sent' }, { ...op(), signature: 'secret' }, { ...op(), tx_hash: 'yes' }, { ...op(), context: { ...context, node: to } }]) assert.equal(readWalletSend(status(receipt), context), null);
  assert.equal(readWalletSend({ ...status(), context: { ...context, chain_id: 1 } }, context), null);
  assert.ok(readWalletSend(status({ ...op(), context: { ...context, chain_id: 1 } }), context), 'previous-chain unresolved intent remains visible for recovery');
});
test('prepare preserves the canonical string and explicitly reviewed context without submitting it', async () => {
  let reads = 0, writes = 0;
  const result = await actOnWalletSend(context, prepare, { current: () => true, read: async () => ++reads === 1 ? status() : status(op()), write: async (action, expected) => {
    writes++; assert.deepEqual(action, prepare); assert.deepEqual(expected, context); return { ok: true };
  } });
  assert.equal(result?.operation?.state, 'prepared'); assert.equal(writes, 1);
});
test('unresolved or changed selections and departed accounts do not start another send', async () => {
  const deps = { current: () => true, read: async () => status(op('submitted')), write: async () => assert.fail('no write') };
  await assert.rejects(actOnWalletSend(context, prepare, deps), e => e instanceof WalletSendActionError && e.code === 'changed');
  await assert.rejects(actOnWalletSend(context, { kind: 'submit', operation: op() }, deps), e => e instanceof WalletSendActionError && e.code === 'changed');
  let current = true;
  assert.equal(await actOnWalletSend(context, prepare, { ...deps, current: () => current, read: async () => { current = false; return status(); } }), null);
});
test('lost submit replies recover a stored pending or confirmed receipt with one write, never a second send', async () => {
  for (const state of ['submitted', 'confirmed'] as const) {
    let reads = 0, writes = 0;
    const result = await actOnWalletSend(context, { kind: 'submit', operation: op() }, { current: () => true, read: async () => status(op(++reads === 1 ? 'prepared' : state)), write: async () => { writes++; throw new Error('lost reply'); } });
    assert.equal(result?.operation?.state, state); assert.equal(writes, 1);
  }
});
test('unmatched post-write receipts cannot turn a request into a false success', async () => {
  let reads = 0, writes = 0;
  await assert.rejects(actOnWalletSend(context, { kind: 'submit', operation: op() }, { current: () => true, read: async () => status(++reads === 1 ? op() : { ...op('confirmed'), tx_hash: '0x' + 'e'.repeat(64) }), write: async () => { writes++; return status(op('confirmed')); } }), e => e instanceof WalletSendActionError && e.code === 'unconfirmed');
  assert.equal(writes, 1);
});
test('actual RTK endpoints use the journal and exact IDs; account/context stays in cache keys, never request data', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'); const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request, calls: string[] = [];
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url); calls.push(req.method + ' ' + url.pathname); assert.equal(url.search, '');
    if (req.method === 'POST' && url.pathname.endsWith('send-requests')) assert.deepEqual(await req.json(), { request_id: id, expected: context, to, amount: '0.125' });
    return Response.json(status());
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    await store.dispatch(api.endpoints.walletSendStatus.initiate({ identity: 'operator', context }, { subscribe: false })).unwrap();
    await store.dispatch(api.endpoints.prepareWalletSend.initiate({ request_id: id, expected: context, to, amount: '0.125' })).unwrap();
    await store.dispatch(api.endpoints.submitWalletSend.initiate(id)).unwrap();
    await store.dispatch(api.endpoints.cancelWalletSend.initiate(id)).unwrap();
    assert.deepEqual(calls, ['GET /api/me/wallet/send-requests', 'POST /api/me/wallet/send-requests', `POST /api/me/wallet/send-requests/${id}/submit`, `POST /api/me/wallet/send-requests/${id}/cancel`]);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});

test('history reader rejects wrong pages, duplicate or unordered records, private payloads and malformed pagination', () => {
  const rows = [{ ...op(), id: 'e'.repeat(32), created_at: 2, updated_at: 2 }, op()];
  const page = { version: 1, context, cursor: null, items: rows, next_cursor: null };
  assert.ok(readWalletSendHistory(page, context, null));
  assert.ok(readWalletSendHistory({ ...page, next_cursor: 'older' }, context, null, 2));
  for (const wrong of [{ ...page, cursor: 'another-page' }, { ...page, items: [rows[0], rows[0]] }, { ...page, items: [...rows].reverse() }, { ...page, items: [{ ...op(), signature: 'private' }] }, { ...page, next_cursor: 'older' }, { ...page, items: [null] }, { ...page, context: { ...context, node: to } }]) assert.equal(readWalletSendHistory(wrong, context, null), null);
  assert.equal(readWalletSendHistory({ ...page, cursor: 'same', next_cursor: 'same' }, context, 'same', 2), null);
});
test('history and exact receipt RTK calls are GET-only and bind pagination / request ID without leaking cache identity', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'); const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request, calls: string[] = [];
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => { const req = new Request(input, init); assert.equal(req.method, 'GET'); calls.push(req.url); return Response.json({}); };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    await store.dispatch(api.endpoints.walletSendHistory.initiate({ identity: 'owner', context, cursor: 'saved_cursor' }, { subscribe: false })).unwrap();
    await store.dispatch(api.endpoints.walletSendRequest.initiate({ identity: 'owner', context, id }, { subscribe: false })).unwrap();
    const history = new URL(calls[0]), receipt = new URL(calls[1]);
    assert.equal(history.pathname, '/api/me/wallet/send-history'); assert.deepEqual([...history.searchParams], [['limit', '20'], ['cursor', 'saved_cursor']]);
    assert.equal(receipt.pathname, `/api/me/wallet/send-requests/${id}`); assert.equal(receipt.search, '');
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
test('fresh exact receipts synchronize the active request without promoting old history or another account', async () => {
  const { configureStore } = await import('@reduxjs/toolkit'); const { api } = await import('../src/api/api');
  const { syncWalletSendReceipt } = await import('../src/lib/walletSendCache');
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const scope = { identity: 'owner', context }, other = { identity: 'other-owner', context };
  try {
    await store.dispatch(api.util.upsertQueryData('walletSendStatus', scope, status(op('submitted'))));
    await store.dispatch(api.util.upsertQueryData('walletSendStatus', other, status(op('submitted'))));
    await store.dispatch(api.util.upsertQueryData('walletSendRequest', { ...scope, id }, status(op('submitted'))));
    syncWalletSendReceipt(store.dispatch, scope, status(op('confirmed')));
    assert.equal((api.endpoints.walletSendStatus.select(scope)(store.getState()).data as any).operation.state, 'confirmed');
    assert.equal((api.endpoints.walletSendRequest.select({ ...scope, id })(store.getState()).data as any).operation.state, 'confirmed');
    assert.equal((api.endpoints.walletSendStatus.select(other)(store.getState()).data as any).operation.state, 'submitted');
    syncWalletSendReceipt(store.dispatch, scope, status(op('prepared')));
    assert.equal((api.endpoints.walletSendStatus.select(scope)(store.getState()).data as any).operation.state, 'confirmed');
    assert.equal((api.endpoints.walletSendRequest.select({ ...scope, id })(store.getState()).data as any).operation.state, 'confirmed');
    const refreshed = { identity: 'refresh-owner', context };
    await store.dispatch(api.util.upsertQueryData('walletSendStatus', refreshed, status(op('prepared'))));
    syncWalletSendReceipt(store.dispatch, refreshed, status(op('prepared')), status(op('confirmed')));
    assert.equal((api.endpoints.walletSendStatus.select(refreshed)(store.getState()).data as any).operation.state, 'confirmed');
    const older = { ...op('confirmed'), id: 'e'.repeat(32) };
    syncWalletSendReceipt(store.dispatch, scope, status(older));
    assert.equal((api.endpoints.walletSendStatus.select(scope)(store.getState()).data as any).operation.id, id);
    syncWalletSendReceipt(store.dispatch, scope, { ...status(op('prepared')), context: { ...context, node: to } });
    assert.equal((api.endpoints.walletSendStatus.select(scope)(store.getState()).data as any).operation.state, 'confirmed');
  } finally { store.dispatch(api.util.resetApiState()); }
});
