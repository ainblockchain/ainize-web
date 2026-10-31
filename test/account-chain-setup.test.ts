import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAccountChain, chainSetupContext, readChainSetup, ChainSetupActionError } from '../src/lib/accountChainSetup';
const context = { node: '0x' + 'a'.repeat(40), provider: 'https://rpc.test', chain_id: 0, app: '/apps/knowledge' };
const id = 'b'.repeat(32);
const operation = (state = 'verified') => ({ version: 1, id, context, actor: context.node, state, created_at: 1, updated_at: 2, created: false, tx: null, admin: null, error: null });
const status = (op: unknown = null, valid = false) => ({ version: 1, capabilities: { exact_request_status: true, reviewed_selection: true }, context, verification: { valid, errors: valid ? [] : ['Missing rule'] }, read_error: null, operation: op });
test('setup status rejects wrong chain, malformed verification and mismatched receipts', () => {
  assert.ok(readChainSetup(status(), context));
  for (const value of [{ ...status(), capabilities: undefined }, { ...status(), context: { ...context, chain_id: 1 } }, { ...status(), verification: { valid: true, errors: ['missing'] } }, status({ ...operation(), context: { ...context, provider: 'https://other.test' } }), status({ ...operation(), state: 'done' }), status({ ...operation(), created: 'yes' })]) assert.equal(readChainSetup(value, context), null);
});
test('setup preflight refuses changed retry selection and departed accounts without posting', async () => {
  await assert.rejects(prepareAccountChain(context, null, { current: () => true, requestId: () => id, read: async () => status(operation('unconfirmed')), write: async () => assert.fail('no selection') }), e => e instanceof ChainSetupActionError && e.code === 'changed');
  let current = true;
  assert.equal(await prepareAccountChain(context, null, { current: () => current, requestId: () => id, read: async () => { current = false; return status(); }, write: async () => assert.fail('departed') }), null);
});
test('one setup write uses the exact reviewed chain and reads its result without any staking option', async () => {
  let reads = 0, writes = 0;
  const result = await prepareAccountChain(context, null, { current: () => true, requestId: () => id, read: async () => ++reads === 1 ? status() : status(operation(), true), write: async body => {
    writes++; assert.deepEqual(body, { request_id: id, expected: context, expected_request: null }); return status(operation(), true);
  } });
  assert.equal(result?.verification?.valid, true); assert.equal(writes, 1); assert.equal(reads, 2);
});
test('lost setup replies recover from server records and never resend; missing receipts remain unconfirmed', async () => {
  for (const recorded of [true, false]) {
    let reads = 0, writes = 0;
    const action = prepareAccountChain(context, null, { current: () => true, requestId: () => id, read: async () => ++reads === 1 || !recorded ? status() : status(operation('unconfirmed')), write: async () => { writes++; throw new Error('lost'); } });
    if (recorded) assert.equal((await action)?.operation?.state, 'unconfirmed');
    else await assert.rejects(action, e => e instanceof ChainSetupActionError && e.code === 'unconfirmed');
    assert.equal(writes, 1);
  }
});
test('already verified rules do not submit another setup', async () => {
  const result = await prepareAccountChain(context, null, { current: () => true, requestId: () => id, read: async () => status(null, true), write: async () => assert.fail('already ready') });
  assert.equal(result?.verification?.valid, true);
});
test('actual setup endpoints read status and send only the reviewed request to the durable route', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request, calls: string[] = [];
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), url = new URL(req.url); calls.push(req.method + ' ' + url.pathname);
    assert.equal(url.search, '');
    if (req.method === 'POST') assert.deepEqual(await req.json(), { request_id: id, expected: context, expected_request: null });
    return Response.json(req.method === 'POST' ? status(operation(), true) : status());
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    await store.dispatch(api.endpoints.chainSetupStatus.initiate({ identity: 'operator', context }, { subscribe: false })).unwrap();
    await store.dispatch(api.endpoints.reviewedChainSetup.initiate({ request_id: id, expected: context, expected_request: null })).unwrap();
    assert.deepEqual(calls, ['GET /api/chain/setup', 'POST /api/chain/setup/requests']);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});

test('setup retry binds the exact previous request in the server admission body', async () => {
  const retry = 'c'.repeat(32); let reads = 0;
  await prepareAccountChain(context, retry, { current: () => true, requestId: () => id,
    read: async () => status(++reads === 1 ? { ...operation('unconfirmed'), id: retry } : operation()),
    write: async body => { assert.deepEqual(body, { request_id: id, expected: context, expected_request: retry, retry_of: retry }); return status(operation()); },
  });
});


test('setup context uses the SDK provider origin and rejects credential-bearing or unsupported URLs', () => {
  const info: any = { node: { address: context.node, chain_id: 0 }, ledger: { kind: 'ain', provider: 'https://rpc.test/custom/path', app: '/apps/knowledge' } };
  assert.deepEqual(chainSetupContext(info), context);
  for (const provider of ['https://user:secret@rpc.test', 'file:///tmp/rpc', 'invalid']) assert.equal(chainSetupContext({ ...info, ledger: { ...info.ledger, provider } }), null);
});
