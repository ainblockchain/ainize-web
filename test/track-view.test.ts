import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTrackCatalog, trackBranches, trackCatalogView, trackHistory, trackSales, trackSubscribeCommand } from '../src/lib/trackView';
import { trackEntry, trackName, trackBranches as branches, trackHistory as history } from './fixtures/track';

test('track catalog loads beyond 200 entries including retired history and keeps the exact track query', async () => {
  const items = Array.from({ length: 405 }, (_, i) => trackEntry(`id-${i}`, { status: i === 404 ? 'RETIRED' : 'VERIFIED' }));
  const urls: URL[] = [];
  const name = 'finance/a & b?#';
  const result = await loadTrackCatalog(name, async path => {
    const url = new URL(path, 'https://example.test'); urls.push(url);
    const offset = Number(url.searchParams.get('offset'));
    return { data: { total: items.length, items: items.slice(offset, offset + 200) } };
  });
  assert.ok('data' in result);
  assert.equal(result.data.items.length, 405);
  assert.equal(result.data.items.at(-1)?.status, 'RETIRED');
  assert.deepEqual(urls.map(u => u.searchParams.get('offset')), ['0', '200', '400']);
  for (const url of urls) {
    assert.equal(url.searchParams.get('branch'), name);
    assert.ok(url.searchParams.get('status')?.split(',').includes('RETIRED'));
    assert.ok(!url.searchParams.get('status')?.split(',').includes('DRAFT'));
  }
});

test('failed, duplicate, changed or truncated later pages do not become a successful partial track total', async () => {
  const first = Array.from({ length: 200 }, (_, i) => trackEntry(String(i)));
  for (const reply of [
    { error: { status: 503, data: 'unavailable' } },
    { data: { total: 201, items: [] } },
    { data: { total: 201, items: [first[0]] } },
    { data: { total: 202, items: [trackEntry('200'), trackEntry('201')] } },
    { data: { total: 201, items: [{}] } },
  ]) {
    let calls = 0;
    const result = await loadTrackCatalog(trackName, async () => ++calls === 1 ? { data: { total: 201, items: first } } : reply);
    assert.ok('error' in result); assert.equal(calls, 2);
  }
  const controller = new AbortController(); let calls = 0;
  const result = await loadTrackCatalog(trackName, async () => { calls++; controller.abort(); return { data: { total: 201, items: first } }; }, controller.signal);
  assert.ok('error' in result); assert.equal(calls, 1);
});

test('track sales keep currencies separate and missing records explicit without including another track', () => {
  const ain = trackEntry('ain'), usdc = trackEntry('usdc'); usdc.anchor = { ...usdc.anchor, currency: 'USDC' }; usdc.revenue = '3';
  const view = trackSales(['ain', 'usdc', 'unknown'], [ain, usdc, trackEntry('other')]);
  assert.equal(view.found, 2); assert.equal(view.missing, 1);
  assert.deepEqual(view.totals, [{ currency: 'AIN', sales: 1, revenue: 2 }, { currency: 'USDC', sales: 1, revenue: 3 }]);
  assert.equal(trackCatalogView({ name: 'other', items: [] }, trackName), null);
  assert.equal(trackCatalogView({ name: trackName, items: [ain, ain] }, trackName), null);
});

test('invalid branch and subscription records require recovery, not fabricated current/empty states', () => {
  assert.ok(trackBranches(branches()));
  assert.equal(trackBranches({ ...branches(), branches: [{ ...branches().branches[0], current: ['other'] }] }), null);
  assert.equal(trackBranches({ branches: [{}], mine: [] }), null);
  assert.equal(trackHistory({ records: [{ ...history.records[0], body: { ...history.records[0].body, action: 'unknown' } }] }, trackName), null);
  assert.deepEqual(trackHistory(history, trackName), { rows: [{ id: 'subscription-1', node: history.records[0].body.node, ts: 1, left: false }], joined: 1, left: 0, window: 1 });
  assert.equal(trackHistory(history, 'another')?.rows.length, 0);
});

test('subscription snippets preserve spaces, apostrophes and shell metacharacters as one literal track argument', () => {
  assert.equal(trackSubscribeCommand('finance/daily'), 'ainize branch subscribe finance/daily');
  assert.equal(trackSubscribeCommand('daily $(echo wrong)'), "ainize branch subscribe 'daily $(echo wrong)'");
  assert.equal(trackSubscribeCommand("a'b"), "ainize branch subscribe 'a'\"'\"'b'");
  assert.equal(trackSubscribeCommand('--help'), 'ainize branch subscribe -- --help');
});

test('the RTK track endpoint caches only a complete track and refreshes all pages on invalidation', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  const items = Array.from({ length: 201 }, (_, i) => trackEntry(String(i)));
  const offsets: number[] = []; let unavailable = false;
  globalThis.Request = class extends NativeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); }
  };
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init), url = new URL(request.url);
    assert.equal(request.method, 'GET'); assert.equal(url.pathname, '/api/catalog');
    assert.equal(url.searchParams.get('branch'), trackName);
    const offset = Number(url.searchParams.get('offset')); offsets.push(offset);
    if (offset === 200 && unavailable) return Response.json({ error: 'unavailable' }, { status: 503 });
    return Response.json({ total: items.length, items: items.slice(offset, offset + 200) });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  const subscription = store.dispatch(api.endpoints.trackCatalog.initiate(trackName));
  try {
    assert.equal((await subscription.unwrap()).items.length, 201);
    assert.equal(api.endpoints.trackCatalog.select('other')(store.getState()).data, undefined);
    unavailable = true; store.dispatch(api.util.invalidateTags(['Branches']));
    await Promise.all(store.dispatch(api.util.getRunningQueriesThunk()));
    const result = api.endpoints.trackCatalog.select(trackName)(store.getState());
    assert.equal(result.isError, true);
    assert.deepEqual(offsets, [0, 200, 0, 200]);
    // The previous complete cache can remain for recovery; a failed 200-row prefix never replaces it.
    assert.equal(result.data?.items.length, 201);
  } finally {
    subscription.unsubscribe(); store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest;
  }
});
