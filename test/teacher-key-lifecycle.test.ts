import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { addressOf, authHeaderV2, captureTeacherKey, currentTeacherKey, forgetTeacherKey, KEY_STORAGE, keyIsPersisted, onTeacherKeyChange, saveTeacherKey, type TeacherKey } from '../src/lib/teacherKey';
import { createTeacherFetch, DATASET_SHA_HEADER, SIGN_MARKER } from '../src/lib/teacherFetch';

// Fixed fixture keys only. No browser profile, server, or user credentials are used.
const key = (n: number): TeacherKey => {
  const privateKey = n.toString(16).padStart(64, '0');
  return { privateKey, address: addressOf(privateKey), created_at: 1 };
};
const a = key(1), b = key(2);
const saved = ['window', 'localStorage'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
let values: Map<string, string>;
let events: EventTarget;
let blockedRead = false, blockedWrite = false, blockedRemove = false;
beforeEach(() => {
  values = new Map(); events = new EventTarget();
  blockedRead = blockedWrite = blockedRemove = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(name: string) { if (blockedRead) throw new Error('blocked'); return values.get(name) ?? null; },
    setItem(name: string, value: string) { if (blockedWrite) throw new Error('quota'); values.set(name, value); },
    removeItem(name: string) { if (blockedRemove) throw new Error('blocked'); values.delete(name); },
  } });
  forgetTeacherKey();
});
afterEach(() => {
  blockedRead = blockedWrite = blockedRemove = false;
  forgetTeacherKey();
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});
const storageEvent = (key: string | null) => events.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: localStorage }));

test('external removal, malformed storage and key replacement cannot revive a previous key', () => {
  saveTeacherKey(a);
  values.delete(KEY_STORAGE);
  assert.equal(currentTeacherKey(), null);
  saveTeacherKey(a);
  values.set(KEY_STORAGE, 'broken');
  assert.equal(currentTeacherKey(), null);
  saveTeacherKey(a);
  values.set(KEY_STORAGE, JSON.stringify(b));
  assert.equal(currentTeacherKey()?.address, b.address);
  blockedRead = true;
  assert.equal(currentTeacherKey()?.address, b.address, 'fallback is the latest observed key');
});

test('failed writes keep the chosen key and never claim an older stored key is the backup', () => {
  saveTeacherKey(a);
  blockedWrite = true;
  saveTeacherKey(b);
  assert.equal(currentTeacherKey()?.address, b.address);
  assert.equal(keyIsPersisted(), false);
  values.delete(KEY_STORAGE);
  assert.equal(currentTeacherKey(), null, 'a subsequent external removal wins');
});

test('blocked storage permits a temporary key but forgetting it does not restore stale storage', () => {
  saveTeacherKey(a);
  blockedRead = blockedWrite = true;
  saveTeacherKey(b);
  assert.equal(currentTeacherKey()?.address, b.address);
  assert.equal(keyIsPersisted(), false);
  blockedRead = false;
  assert.equal(currentTeacherKey()?.address, b.address);
  blockedRemove = true;
  forgetTeacherKey();
  assert.equal(currentTeacherKey(), null);
  assert.equal(keyIsPersisted(), false);
});

test('subscriptions reflect other-tab changes and clear(), ignore unrelated keys, and unsubscribe', () => {
  let calls = 0;
  const unsubscribe = onTeacherKeyChange(() => { calls++; });
  saveTeacherKey(a);
  assert.equal(calls, 1);
  values.set(KEY_STORAGE, JSON.stringify(b)); storageEvent(KEY_STORAGE);
  assert.equal(calls, 2);
  assert.equal(currentTeacherKey()?.address, b.address);
  storageEvent('unrelated'); assert.equal(calls, 2);
  values.clear(); storageEvent(null);
  assert.equal(currentTeacherKey(), null); assert.equal(calls, 3);
  unsubscribe(); saveTeacherKey(a); storageEvent(KEY_STORAGE);
  assert.equal(calls, 3);
});

test('in-flight identity guard rejects removal and a switch away and back', () => {
  saveTeacherKey(a); const captured = captureTeacherKey();
  saveTeacherKey(b); saveTeacherKey(a);
  assert.throws(captured.assertCurrent, /Teaching key changed/);
  const next = captureTeacherKey(); forgetTeacherKey();
  assert.throws(next.assertCurrent, /Teaching key changed/);
});

const request = (identity = a.address.toLowerCase(), headers: Record<string, string> = {}) => new Request('https://fixture.invalid/api/teach/jobs?mine=1', { headers: { [SIGN_MARKER]: identity, ...headers } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { resolve, promise };
}

test('a key switch during node discovery sends no request under either key', async () => {
  saveTeacherKey(a); const node = deferred<string | null>(); let sent = 0;
  const fetcher = createTeacherFetch(() => node.promise, async () => { sent++; return new Response('{}'); });
  const pending = fetcher(request());
  saveTeacherKey(b); node.resolve(b.address);
  await assert.rejects(pending, /Teaching key changed/);
  assert.equal(sent, 0);
});

test('a stale cache request cannot be signed by the current key', async () => {
  saveTeacherKey(b); let sent = 0;
  const fetcher = createTeacherFetch(async () => b.address, async () => { sent++; return new Response('{}'); });
  await assert.rejects(fetcher(request()), /Teaching key changed/);
  assert.equal(sent, 0);
});

test('a response arriving after removal is rejected instead of updating the old view', async () => {
  saveTeacherKey(a); const response = deferred<Response>(); const started = deferred<void>();
  const fetcher = createTeacherFetch(async () => b.address, async () => { started.resolve(); return response.promise; });
  const pending = fetcher(request()); await started.promise;
  forgetTeacherKey(); response.resolve(new Response('{}'));
  await assert.rejects(pending, /Teaching key changed/);
});

test('request-bound signature keeps route, query and multipart digest; internal identity never reaches server', async () => {
  saveTeacherKey(a); let sent: Request | undefined;
  const fetcher = createTeacherFetch(async () => b.address, async input => { sent = input as Request; return new Response('{}'); });
  const req = new Request('https://fixture.invalid/api/teach/datasets?mode=upload', { method: 'POST', body: 'fixture-body', headers: { [SIGN_MARKER]: a.address.toLowerCase(), [DATASET_SHA_HEADER]: 'fixture-digest' } });
  await fetcher(req);
  assert.ok(sent); assert.equal(sent.headers.has(SIGN_MARKER), false);
  const signature = sent.headers.get('x-ainize-auth')!;
  const timestamp = Number(signature.split(':')[1]);
  assert.equal(signature, authHeaderV2(a.privateKey, a.address, { node: b.address, method: 'POST', path: '/api/teach/datasets?mode=upload', body: 'fixture-digest' }, timestamp));
  assert.equal(await sent.text(), 'fixture-body');
});

test('node discovery failure stops signed requests; anonymous requests cannot retain an injected old signature', async () => {
  let sent: Request | undefined;
  const fetcher = createTeacherFetch(async () => null, async input => { sent = input as Request; return new Response('{}'); });
  saveTeacherKey(a);
  await assert.rejects(fetcher(request()), /Cannot verify the node identity/);
  assert.equal(sent, undefined);
  forgetTeacherKey(); await fetcher(request('', { 'x-ainize-auth': 'stale-header' }));
  assert.ok(sent); assert.equal(sent.headers.has('x-ainize-auth'), false);
});
