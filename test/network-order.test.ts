import test from 'node:test';
import assert from 'node:assert/strict';
import { networkEntryKey, orderNetworkEntries, uniqueNetworkWarnings } from '../src/utils/networkOrder';

test('heartbeat response order does not move node rows', () => {
  const a = { address: '0xA', info: { name: 'ain-kpi-gpu-2' }, last_seen: 1 };
  const b = { address: '0xB', info: { name: 'ain-kpi-gpu-10' }, last_seen: 2 };
  assert.deepEqual(orderNetworkEntries([b, a]).map(networkEntryKey), orderNetworkEntries([a, b]).map(networkEntryKey));
  assert.equal(orderNetworkEntries([b, a])[0], a);
});
test('relay-only warnings have distinct stable keys without endpoints', () => {
  const rows = [{ endpoint: null, name: 'ain-kpi-gpu-1', ledger: 'ain' }, { endpoint: null, name: 'ain-kpi-gpu-2', ledger: 'ain' }];
  assert.equal(new Set(rows.map(networkEntryKey)).size, 2);
  assert.deepEqual(uniqueNetworkWarnings([...rows, rows[0]]), rows);
});
