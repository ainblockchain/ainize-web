import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareAccountChain, chainSetupContext, readChainSetup, reconcileChainSetup, chainSetupSelection, chainSetupLink, ChainSetupActionError } from '../src/lib/accountChainSetup';
const context = { node: '0x' + 'a'.repeat(40), provider: 'https://rpc.test', chain_id: 0, app: '/apps/knowledge' };
const id = 'b'.repeat(32);
const operation = (state = 'verified') => ({ version: 1, id, context, actor: context.node, state, created_at: 1, updated_at: 2, created: false, tx: null, admin: null, error: null });
const exactDeps = { actor: context.node, retain: async (_id: string) => {}, readRequest: async (_id: string): Promise<unknown> => status(operation(), true) };
const status = (op: unknown = null, valid = false) => ({ version: 1, capabilities: { exact_request_status: true, reviewed_selection: true }, context, verification: { valid, errors: valid ? [] : ['Missing rule'] }, read_error: null, operation: op });
test('setup status rejects wrong chain, malformed verification and mismatched receipts', () => {
  assert.ok(readChainSetup(status(), context));
  for (const value of [{ ...status(), capabilities: undefined }, { ...status(), context: { ...context, chain_id: 1 } }, { ...status(), verification: { valid: true, errors: ['missing'] } }, status({ ...operation(), context: { ...context, provider: 'https://other.test' } }), status({ ...operation(), state: 'done' }), status({ ...operation(), created: 'yes' })]) assert.equal(readChainSetup(value, context), null);
});
test('setup preflight refuses changed retry selection and departed accounts without posting', async () => {
  await assert.rejects(prepareAccountChain(context, null, { ...exactDeps, current: () => true, requestId: () => id, read: async () => status(operation('unconfirmed')), write: async () => assert.fail('no selection') }), e => e instanceof ChainSetupActionError && e.code === 'changed');
  let current = true;
  assert.equal(await prepareAccountChain(context, null, { ...exactDeps, current: () => current, requestId: () => id, read: async () => { current = false; return status(); }, write: async () => assert.fail('departed') }), null);
});
test('one setup write uses the exact reviewed chain and reads its result without any staking option', async () => {
  let reads = 0, writes = 0;
  const result = await prepareAccountChain(context, null, { ...exactDeps, current: () => true, requestId: () => id, read: async () => { reads++; return status(); }, readRequest: async requested => { reads++; assert.equal(requested, id); return status(operation(), true); }, write: async body => {
    writes++; assert.deepEqual(body, { request_id: id, expected: context, expected_request: null }); return status(operation(), true);
  } });
  assert.equal(result?.verification?.valid, true); assert.equal(writes, 1); assert.equal(reads, 2);
});
test('lost setup replies recover from server records and never resend; missing receipts remain unconfirmed', async () => {
  for (const recorded of [true, false]) {
    let reads = 0, writes = 0;
    const action = prepareAccountChain(context, null, { ...exactDeps, current: () => true, requestId: () => id, read: async () => { reads++; return status(); }, readRequest: async requested => { assert.equal(requested, id); return recorded ? status(operation('unconfirmed')) : status(); }, write: async () => { writes++; throw new Error('lost'); } });
    if (recorded) assert.equal((await action)?.operation?.state, 'unconfirmed');
    else await assert.rejects(action, e => e instanceof ChainSetupActionError && e.code === 'unconfirmed');
    assert.equal(writes, 1);
  }
});
test('already verified rules do not submit another setup', async () => {
  const result = await prepareAccountChain(context, null, { ...exactDeps, current: () => true, requestId: () => id, read: async () => status(null, true), write: async () => assert.fail('already ready') });
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
    return Response.json(req.method === 'POST' || url.pathname.endsWith('/' + id) ? status(operation(), true) : status());
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    await store.dispatch(api.endpoints.chainSetupStatus.initiate({ identity: 'operator', context }, { subscribe: false })).unwrap();
    await store.dispatch(api.endpoints.reviewedChainSetup.initiate({ request_id: id, expected: context, expected_request: null })).unwrap();
    const receipt = await store.dispatch(api.endpoints.chainSetupRequest.initiate({ identity: 'operator', context, id }, { subscribe: false })).unwrap();
    assert.equal(readChainSetup(receipt, context, id)?.operation?.id, id);
    assert.deepEqual(calls, ['GET /api/chain/setup', 'POST /api/chain/setup/requests', 'GET /api/chain/setup/requests/' + id]);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});

test('setup retry binds the exact previous request in the server admission body', async () => {
  const retry = 'c'.repeat(32); let reads = 0;
  await prepareAccountChain(context, retry, { ...exactDeps, current: () => true, requestId: () => id,
    read: async () => status(++reads === 1 ? { ...operation('unconfirmed'), id: retry } : operation()),
    write: async body => { assert.deepEqual(body, { request_id: id, expected: context, expected_request: retry, retry_of: retry }); return status(operation()); },
  });
});


test('setup context uses the SDK provider origin and rejects credential-bearing or unsupported URLs', () => {
  const info: any = { node: { address: context.node, chain_id: 0 }, ledger: { kind: 'ain', provider: 'https://rpc.test/custom/path', app: '/apps/knowledge' } };
  assert.deepEqual(chainSetupContext(info), context);
  for (const provider of ['https://user:secret@rpc.test', 'file:///tmp/rpc', 'invalid']) assert.equal(chainSetupContext({ ...info, ledger: { ...info.ledger, provider } }), null);
});

test('setup retains exact recovery before the only write and never re-reads latest afterward', async () => {
  const events: string[] = [];
  const result = await prepareAccountChain(context, null, { ...exactDeps, current: () => true, requestId: () => id,
    read: async () => { events.push('latest'); return status(); },
    retain: async selected => { assert.equal(selected, id); events.push('retain'); },
    write: async () => { events.push('write'); throw new Error('reply lost after admission'); },
    readRequest: async selected => { assert.equal(selected, id); events.push('exact'); return status(operation('unconfirmed')); },
  });
  assert.deepEqual(events, ['latest', 'retain', 'write', 'exact']);
  assert.equal(result?.operation?.id, id);
});

test('failed recovery retention or departure during retention cannot submit setup', async () => {
  for (const fails of [false, true]) {
    let current = true;
    const action = prepareAccountChain(context, null, { ...exactDeps, current: () => current, requestId: () => id,
      read: async () => status(), retain: async () => { if (fails) throw new Error('cannot retain'); current = false; },
      write: async () => assert.fail('must not submit'), readRequest: async () => assert.fail('must not inspect another view'),
    });
    if (fails) await assert.rejects(action, /cannot retain/); else assert.equal(await action, null);
  }
});

test('exact setup recovery rejects foreign IDs, actors, unavailable reads and conflicting terminal responses', async () => {
  for (const record of [status({ ...operation(), id: 'c'.repeat(32) }), status({ ...operation(), actor: '0x' + 'c'.repeat(40) }), null, status(operation('unconfirmed'))]) {
    let writes = 0;
    await assert.rejects(prepareAccountChain(context, null, { ...exactDeps, current: () => true, requestId: () => id,
      read: async () => status(), write: async () => { writes++; return status(operation(), true); }, readRequest: async () => record,
    }), e => e instanceof ChainSetupActionError && e.code === 'unconfirmed');
    assert.equal(writes, 1);
  }
});

test('running setup remains unresolved even when current rules are valid', async () => {
  await assert.rejects(prepareAccountChain(context, null, { ...exactDeps, current: () => true, requestId: () => id,
    read: async () => status(operation('running'), true), retain: () => assert.fail('no new request'), write: async () => assert.fail('running'),
  }), e => e instanceof ChainSetupActionError && e.code === 'changed');
});

test('receipt reconciliation preserves terminal journal and fresh rule failures without retaining unknown fields', () => {
  const previous = status(operation(), true), stale = status({ ...operation('running'), updated_at: 1 });
  const merged = reconcileChainSetup(previous, stale, context, id)!;
  assert.equal(merged.operation?.state, 'verified'); assert.equal(merged.verification?.valid, false);
  assert.deepEqual(merged.verification?.errors, ['Missing rule']);
  assert.equal(reconcileChainSetup(previous, status(operation('unconfirmed')), context, id), null);
  assert.equal(reconcileChainSetup(previous, status({ ...operation(), tx: 'different' }), context, id), null);
  assert.equal(reconcileChainSetup(previous, status({ ...operation(), created_at: 0 }), context, id), null);
  const raw = { ...previous, private: 'secret', operation: { ...operation(), secret: true } };
  const parsed = readChainSetup(raw, context, id)!;
  assert.doesNotMatch(JSON.stringify(parsed), /secret|private/);
  raw.operation.context = { ...context, chain_id: 4 }; raw.verification.errors.push('mutated');
  assert.equal(parsed.operation?.context.chain_id, 0); assert.deepEqual(parsed.verification?.errors, []);
});

test('setup URLs preserve other account selections and refuse ambiguous or malformed receipt IDs', () => {
  const params = new URLSearchParams('walletRequest=keep&q=hello');
  const link = chainSetupLink(params, id);
  assert.deepEqual(chainSetupSelection(new URLSearchParams(link.search)), { kind: 'request', id });
  assert.equal(link.pathname, '/account'); assert.equal(link.hash, '#chain-setup');
  assert.equal(chainSetupLink(new URLSearchParams(link.search), null).search, '?walletRequest=keep&q=hello');
  assert.equal(params.has('chainRequest'), false);
  for (const value of ['', 'invalid', id.toUpperCase(), id + '&chainRequest=' + id]) assert.equal(chainSetupSelection(new URLSearchParams('chainRequest=' + value)).kind, 'invalid');
  assert.equal(chainSetupSelection(params).kind, 'current');
  assert.throws(() => chainSetupLink(params, 'bad'));
});

test('real RTK exact-request cache scopes account and chain and cannot regress a terminal journal', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const arg = { identity: 'operator', context, id };
  try {
    await store.dispatch(api.util.upsertQueryData('chainSetupRequest', arg, status(operation(), true)));
    await store.dispatch(api.util.upsertQueryData('chainSetupRequest', arg, status({ ...operation('running'), updated_at: 1 })));
    const selected = api.endpoints.chainSetupRequest.select(arg)(store.getState()).data;
    assert.equal(readChainSetup(selected, context, id)?.operation?.state, 'verified');
    assert.equal(readChainSetup(selected, context, id)?.verification?.valid, false);
    for (const other of [{ ...arg, identity: 'other' }, { ...arg, context: { ...context, chain_id: 1 } }, { ...arg, id: 'c'.repeat(32) }]) assert.equal(api.endpoints.chainSetupRequest.select(other)(store.getState()).data, undefined);
    await store.dispatch(api.util.upsertQueryData('chainSetupRequest', arg, status(operation('unconfirmed'))));
    assert.equal(api.endpoints.chainSetupRequest.select(arg)(store.getState()).data, null);
  } finally { store.dispatch(api.util.resetApiState()); }
});
