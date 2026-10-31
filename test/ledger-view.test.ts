import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerView, ledgerVerification, ledgerGraph, ledgerNames, ledgerSourceUrl } from '../src/lib/ledgerView';
import { ledgerRecord, ledgerFixture, ledgerNode, ledgerGraphFixture } from './fixtures/ledger';

test('ledger views reject another filter, duplicate records and malformed summary bodies instead of inventing an empty result', () => {
  const valid = ledgerFixture([ledgerNode()]);
  assert.ok(ledgerView(valid, 'node')); assert.equal(ledgerView(valid, 'price'), null);
  assert.ok(ledgerView(ledgerFixture(), 'price'));
  for (const body of [
    ledgerRecord('anchor', { id: 'id', name: 'name', author: 'author', contributors: {} }),
    ledgerRecord('attest', { patch_id: 'id', verifier: 'peer', verified_on: 'hash-only' }),
    ledgerRecord('settle', { patch_id: 'id', buyer: 'buyer', seller: 'seller', currency: 'AIN', amount: '2', royalty: { other: 'not money' } }),
    ledgerRecord('subscribe', { node: 'peer', branch: 'track', action: 'unknown' }),
  ]) assert.equal(ledgerView(ledgerFixture([body]), ''), null);
  assert.equal(ledgerView(ledgerFixture([ledgerNode(), ledgerNode()]), ''), null);
});

test('latest ledger names win regardless of supplied order and address case', () => {
  const older = ledgerRecord('node', { address: 'PEER', name: 'Old name', roles: [], endpoint: null }, 'old', 1);
  const newer = ledgerRecord('node', { address: 'peer', name: 'New name', roles: [], endpoint: null }, 'new', 2);
  const view = ledgerView(ledgerFixture([older, newer]), 'node'); assert.ok(view);
  assert.deepEqual(view.records.map(r => r.hash), ['new', 'old']);
  assert.equal(ledgerNames([older, newer]).get('peer'), 'New name');
});

test('verification distinguishes completed invalid records from unavailable or contradictory replies', () => {
  assert.deepEqual(ledgerVerification({ valid: false, checked: 7, errors: ['broken signature'] }), { valid: false, checked: 7, errors: ['broken signature'] });
  for (const reply of [{}, { valid: true, checked: 7, errors: ['broken signature'] }, { valid: false, checked: 7, errors: [] }, { valid: true, checked: -1, errors: [] }]) assert.equal(ledgerVerification(reply), null);
});

test('knowledge graph accepts missing public relatives but rejects cycles, duplicate nodes and invalid destinations', () => {
  const graph = ledgerGraphFixture();
  assert.ok(ledgerGraph({ ...graph, edges: [{ from: 'chosen/id', to: 'unavailable', type: 'extends' }] }));
  assert.equal(ledgerGraph({ ...graph, edges: [{ from: 'chosen/id', to: 'chosen/id', type: 'extends' }] }), null);
  assert.equal(ledgerGraph({ ...graph, nodes: [...graph.nodes, ...graph.nodes] }), null);
  assert.equal(ledgerGraph({ ...graph, nodes: [{ ...graph.nodes[0], author: 'organization-slug' }] }), null);
  assert.equal(ledgerGraph({ ...graph, nodes: [{}] }), null);
});

test('ledger source links preserve base paths and encode the exact app reference without invented providers', () => {
  assert.equal(ledgerSourceUrl('https://chain.example/base/', '/apps/a b?x'), 'https://chain.example/base/get_value?ref=%2Fapps%2Fa+b%3Fx');
  for (const provider of [undefined, 'javascript:alert(1)', 'https://user:secret@chain.example', 'https://chain.example?query=1']) assert.equal(ledgerSourceUrl(provider, '/app'), null);
});
