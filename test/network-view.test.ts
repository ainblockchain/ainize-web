import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkInfo, networkNodes, networkRecords } from '../src/lib/networkView';
import { loadCatalogSnapshot } from '../src/lib/trackView';
import { trackEntry } from './fixtures/track';
import { networkInfoFixture, networkNodesFixture, networkLedgerFixture } from './fixtures/networkView';

test('network records expose the loaded window and exclude free and case-insensitive self trades from sales', () => {
  const view = networkRecords(networkLedgerFixture()); assert.ok(view);
  assert.equal(view.shown, 4); assert.equal(view.total, 9000); assert.equal(view.partial, true);
  assert.deepEqual(view.rows.get('peer'), { listed: 0, sold: 1, attested: 1, challenged: 0, since: 100 });
  assert.equal(view.rows.get('buyer')?.sold, 0);
  assert.equal(view.rows.get('absent'), undefined);
  const empty = networkRecords({ info: { records: 0 }, records: [] });
  assert.ok(empty); assert.equal(empty.rows.size, 0); assert.equal(empty.partial, false);
});

test('invalid ledger windows and known record bodies cannot turn into zero or fabricated activity', () => {
  const record = networkLedgerFixture().records[0];
  for (const value of [
    {}, { info: { records: 0 }, records: [record] },
    { info: { records: 2 }, records: [record, record] },
    { info: { records: 1 }, records: [{ ...record, body: { seller: 'peer', buyer: 'buyer', amount: 'unknown' } }] },
    { info: { records: 1 }, records: [{ ...record, kind: 'attest', body: {} }] },
  ]) assert.equal(networkRecords(value), null);
});

test('network read views accept real empty data but reject malformed nested runtime, peer, and health fields', () => {
  assert.ok(networkInfo(networkInfoFixture())); assert.ok(networkNodes(networkNodesFixture()));
  assert.ok(networkNodes({ self: 'self', nodes: [], peers: [] }));
  assert.equal(networkInfo({ ...networkInfoFixture(), runtime: {} }), null);
  assert.equal(networkInfo({ ...networkInfoFixture(), peer_status: {} }), null);
  const broken = networkNodesFixture(); (broken.nodes[0] as any).blobs = null;
  assert.equal(networkNodes(broken), null);
  assert.equal(networkNodes({ self: 'self', nodes: [], peers: [{}] }), null);
});

test('network freshness can use entries beyond the first 200 without accidentally filtering to a track', async () => {
  const items = Array.from({ length: 205 }, (_, i) => trackEntry(`entry-${i}`));
  const offsets: number[] = [];
  const result = await loadCatalogSnapshot(async path => {
    const url = new URL(path, 'https://fixture.invalid');
    assert.equal(url.searchParams.has('branch'), false);
    const offset = Number(url.searchParams.get('offset')); offsets.push(offset);
    return { data: { total: items.length, items: items.slice(offset, offset + 200) } };
  });
  assert.ok('data' in result);
  assert.deepEqual(offsets, [0, 200]);
  assert.equal(result.data.items.at(-1)?.anchor.id, 'entry-204');
});
