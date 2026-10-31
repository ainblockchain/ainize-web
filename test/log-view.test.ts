import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventRow } from '../src/api/types';
import { filterLogEvents, logCommand, logEvents, patchLogRecords } from '../src/lib/logView';
import { ledgerRecord } from './fixtures/ledger';

const event = (level: EventRow['level'], seq = 1): EventRow => ({ seq, ts: 100 + seq, level, kind: 'verify', patch_id: 'selected', message: 'Selected log', data: null });

test('severity floors agree with server logs and preserve the requested kind', () => {
  const rows = (['debug', 'info', 'warn', 'error'] as const).map(event);
  assert.deepEqual(filterLogEvents(rows, 'info').map(e => e.level), ['info', 'warn', 'error']);
  assert.deepEqual(filterLogEvents(rows, 'warn').map(e => e.level), ['warn', 'error']);
  assert.deepEqual(filterLogEvents(rows, 'all'), rows);
  assert.deepEqual(filterLogEvents(rows, 'all', 'missing'), []);
  assert.deepEqual(filterLogEvents(rows, 'missing'), []);
});

test('log reads distinguish valid empty windows from malformed, duplicate and foreign-resource rows', () => {
  assert.deepEqual(logEvents({ events: [] }), []);
  assert.deepEqual(logEvents({ events: [event('info', 1), event('error', 3)] }, 'selected')?.map(e => e.seq), [3, 1]);
  for (const events of [[event('info'), event('warn')], [{ ...event('info'), level: 'fatal' }], [{ ...event('info'), message: {} }], [{ ...event('info'), ts: -1 }]]) assert.equal(logEvents({ events }), null);
  assert.equal(logEvents({}), null);
  assert.equal(logEvents({ events: [event('info')] }, 'other'), null);
});

test('knowledge timelines accept only related validated records including both ends of version replacement', () => {
  const replacement = ledgerRecord('supersede', { old_patch_id: 'old', new_patch_id: 'new' });
  assert.equal(patchLogRecords({ records: [replacement] }, 'old')?.length, 1);
  assert.equal(patchLogRecords({ records: [replacement] }, 'new')?.length, 1);
  assert.equal(patchLogRecords({ records: [replacement] }, 'other'), null);
  assert.equal(patchLogRecords({ records: [{ ...replacement, body: null }] }, 'old'), null);
  assert.deepEqual(patchLogRecords({ records: [] }, 'old'), []);
});

test('terminal commands follow current polling and safely quote a literal event kind', () => {
  assert.equal(logCommand('all', 'all', false), 'ainize logs');
  assert.equal(logCommand('warn', 'verify', true), "ainize logs --follow --level warn --kind 'verify'");
  assert.equal(logCommand('info', "x';$(touch x)", false), `ainize logs --level info --kind 'x'"'"';$(touch x)'`);
});


test('account-specific event responses use separate caches without putting identity in request URLs', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  const paths: string[] = [];
  let owner = true;
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); }
  };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    assert.equal(request.method, 'GET'); assert.equal(url.searchParams.has('identity'), false);
    assert.equal(url.searchParams.get('limit'), '200'); paths.push(url.pathname);
    return Response.json({ events: [{ ...event('warn'), data: owner ? { private: 'operator detail' } : null }] });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    const ownerArgs = { limit: 200, identity: 'owner' }, publicArgs = { limit: 200, identity: '' };
    await store.dispatch(api.endpoints.events.initiate(ownerArgs, { subscribe: false })).unwrap();
    assert.equal(api.endpoints.events.select(publicArgs)(store.getState()).data, undefined);
    owner = false;
    const publicRows = await store.dispatch(api.endpoints.events.initiate(publicArgs, { subscribe: false })).unwrap();
    assert.equal(publicRows.events[0].data, null);
    const id = 'selected/a?#';
    await store.dispatch(api.endpoints.patchEvents.initiate({ ...ownerArgs, id }, { subscribe: false })).unwrap();
    assert.equal(api.endpoints.patchEvents.select({ ...publicArgs, id })(store.getState()).data, undefined);
    assert.deepEqual(paths, ['/api/events', '/api/events', '/api/patches/selected%2Fa%3F%23/events']);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
