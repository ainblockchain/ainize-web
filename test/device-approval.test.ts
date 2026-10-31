import test from 'node:test';
import assert from 'node:assert/strict';
import { approveReviewedDevice, selectedDeviceCode, deviceReview, readDeviceRequest, DeviceApprovalError } from '../src/lib/deviceApproval';
import { createNodeActionTask } from '../src/lib/accountNodeActions';
const actor = 'sso:account';
const pending = () => ({ capabilities: { reviewed_approval: true as const }, kind: 'cli' as const, status: 'pending' as const, owner: null, delegate: '0x' + 'a'.repeat(40), node: '0x' + 'b'.repeat(40), label: 'My terminal', message: 'Exact reviewed message', name: 'My node', expires: Date.now() + 86400000, expires_at: Date.now() + 60000 });
const success = (p: ReturnType<typeof pending>, owner = actor) => ({ ...p, status: 'approved', owner });
const isError = (code: string) => (e: unknown) => e instanceof DeviceApprovalError && e.code === code;

test('device request and selector validation reject ambiguous, malformed and unsupported evidence', () => {
  const p = pending(); assert.ok(readDeviceRequest(p));
  for (const patch of [{ capabilities: undefined }, { kind: 'other' }, { node: 'wrong' }, { expires_at: undefined }, { status: 'approved', owner: null }, { status: 'pending', owner: actor }, { message: '' }]) assert.equal(readDeviceRequest({ ...p, ...patch }), null);
  for (const query of ['', 'code=', 'code=a&code=b', 'code=../other']) assert.equal(selectedDeviceCode(new URLSearchParams(query)), null);
  assert.equal(selectedDeviceCode(new URLSearchParams('code=good-code&next=keep')), 'good-code');
});

test('SSO approval posts one exact review and confirms the same actor via read-only status', async () => {
  const p = pending(), events: string[] = []; let posted = false;
  const result = await approveReviewedDevice(p, actor, { current: () => true,
    read: async () => { events.push('read'); return posted ? success(p) : p; },
    attempting: () => events.push('attempt'), write: async expected => { events.push('write'); assert.deepEqual(expected, deviceReview(p, actor)); posted = true; return { ok: true }; },
  });
  assert.deepEqual(events, ['read', 'attempt', 'write', 'read']); assert.equal(result?.owner, actor);
});

test('lost replies recover without another approval; acknowledgements and foreign owners never imply completion', async () => {
  for (const outcome of ['approved', 'pending', 'foreign', 'unavailable']) {
    const p = pending(); let writes = 0;
    const action = approveReviewedDevice(p, actor, { current: () => true, attempting() {}, write: async () => { writes++; throw new Error('lost'); },
      read: async () => !writes ? p : outcome === 'approved' ? success(p) : outcome === 'foreign' ? success(p, 'sso:other') : outcome === 'unavailable' ? null : p,
    });
    if (outcome === 'approved') assert.equal((await action)?.status, 'approved'); else await assert.rejects(action, isError('unconfirmed'));
    assert.equal(writes, 1);
  }
});

test('changed request, expiry or departure prevents approval and never opens a wallet unnecessarily', async () => {
  const p = pending();
  for (const changed of [{ ...p, delegate: '0x' + 'c'.repeat(40) }, { ...p, kind: 'node' }, { ...p, status: 'expired' }]) {
    await assert.rejects(approveReviewedDevice(p, actor, { current: () => true, read: async () => changed, attempting() {}, prove: async () => assert.fail('not reviewed'), write: async () => assert.fail('not reviewed') }), isError('changed'));
  }
  let current = true;
  assert.equal(await approveReviewedDevice(p, actor, { current: () => current, read: async () => { current = false; return p; }, attempting() {}, write: async () => assert.fail('departed') }), null);
});

test('wallet approval rechecks the exact request after signing and suppresses departed outcomes', async () => {
  const p = pending(); let reads = 0;
  await assert.rejects(approveReviewedDevice(p, actor, { current: () => true, read: async () => ++reads === 1 ? p : { ...p, message: 'replacement' }, attempting() {},
    prove: async message => { assert.equal(message, p.message); return 'signature'; }, write: async () => assert.fail('changed during prompt'),
  }), isError('changed'));
  let current = true;
  assert.equal(await approveReviewedDevice(p, actor, { current: () => current, read: async () => p, attempting() {}, prove: async () => { current = false; return 'signature'; }, write: async () => assert.fail('departed') }), null);
});

test('already approved exact requests are read-only, including collected terminal sessions', async () => {
  const p = pending();
  for (const status of ['approved', 'claimed']) {
    const result = await approveReviewedDevice(p, actor, { current: () => true, read: async () => ({ ...success(p), status }), attempting: () => assert.fail('already approved'), write: async () => assert.fail('must not approve again') });
    assert.equal(result?.status, status);
  }
});

test('one task covers preflight and wallet prompt; concurrent clicks cannot start a second approval', async () => {
  const p = pending(), task = createNodeActionTask(); let release!: () => void, reads = 0;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const first = task.run(() => true, current => approveReviewedDevice(p, actor, { current, read: async () => { reads++; await wait; return success(p); }, attempting() {}, write: async () => assert.fail('already approved') }));
  assert.equal(task.pending(), true);
  assert.equal(await task.run(() => true, async () => assert.fail('duplicate')), null);
  release(); await first; assert.equal(reads, 1); assert.equal(task.pending(), false);
});

test('actual device API uses the selected code and forwards reviewed fields without a replacement identity', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const p = pending(), nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request, calls: string[] = [];
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), path = new URL(req.url).pathname; calls.push(req.method + ' ' + path);
    if (req.method === 'POST') { assert.deepEqual(await req.json(), { code: 'selected-code', expected: deviceReview(p, actor) }); return Response.json({ ok: true }); }
    return Response.json(p);
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    assert.deepEqual(await store.dispatch(api.endpoints.deviceRequest.initiate('selected-code', { subscribe: false })).unwrap(), p);
    await store.dispatch(api.endpoints.approveAccountDevice.initiate({ code: 'selected-code', expected: deviceReview(p, actor) })).unwrap();
    assert.deepEqual(calls, ['GET /api/auth/device/selected-code', 'POST /api/auth/sso/device-approve']);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
