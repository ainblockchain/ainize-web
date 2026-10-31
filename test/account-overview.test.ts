import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountNode, accountOverview, accountKnowledgeReferences, accountChainReady, accountBalanceCurrency } from '../src/lib/accountOverview';
import { networkKindOf } from '../src/lib/networkKind';
const address = '0x' + 'a'.repeat(40), other = '0x' + 'b'.repeat(40);
const overview = () => ({ node: { address, endpoint: 'https://node.test', version: 'test', chain_id: 1 }, ledger: { kind: 'ain', provider: 'https://mainnet-api.ainetwork.ai', records: 0 }, currency: 'AIN', quorum: 1 });
test('account metadata rejects foreign or malformed node identity instead of showing currency actions', () => {
  assert.deepEqual(accountNode({ address, name: 'Node', roles: [] }), { address, name: 'Node', roles: [] });
  assert.equal(accountNode({ address, name: 'Node', roles: [null] }), null);
  assert.equal(accountOverview(overview(), other), null);
  for (const invalid of [{ ...overview(), node: null }, { ...overview(), ledger: null }, { ...overview(), currency: 'other' }, { ...overview(), quorum: NaN }, { ...overview(), ledger: { kind: 'elsewhere', records: 0 } }]) assert.equal(accountOverview(invalid, address), null);
  const selected = accountOverview(overview(), address)!;
  assert.equal(accountChainReady(selected), true);
  for (const provider of [undefined, '', 'not a URL', 'https://name:secret@node.test']) assert.equal(accountChainReady({ ...selected, ledger: { ...selected.ledger, provider } }), false);
  assert.equal(accountChainReady({ ...selected, node: { ...selected.node, chain_id: undefined } }), false);
  assert.equal(accountChainReady({ ...selected, currency: 'USDC' }), true);
});
test('optional account knowledge labels reject incomplete or duplicate metadata without changing record IDs', () => {
  const row = { anchor: { id: 'selected', author: address, author_name: 'Selected creator', contributors: [{ address: other, name: 'Contributor' }] }, verifiers: [other] };
  assert.equal(accountKnowledgeReferences({ items: [row] })?.[0].id, 'selected');
  for (const items of [[null], [row, row], [{ ...row, verifiers: {} }], [{ ...row, anchor: { ...row.anchor, contributors: [null] } }]]) assert.equal(accountKnowledgeReferences({ items }), null);
});
test('network labels require the reported canonical endpoint and chain ID, never arbitrary URL text', () => {
  assert.equal(networkKindOf(), 'unknown');
  assert.equal(networkKindOf({ kind: 'other' }), 'unknown');
  assert.equal(networkKindOf({ kind: 'local' }), 'credit');
  assert.equal(networkKindOf({ kind: 'ain', provider: 'https://mainnet-api.ainetwork.ai' }, 1), 'mainnet');
  assert.equal(networkKindOf({ kind: 'ain', provider: 'https://testnet-api.ainetwork.ai' }, 0), 'testnet');
  for (const provider of ['https://mainnet-api.ainetwork.ai.evil.test', 'https://custom.example', 'http://localhost:8080', 'https://example.test/localhost', 'https://user@mainnet-api.ainetwork.ai', 'https://mainnet-api.ainetwork.ai:8080', 'not a URL']) assert.equal(networkKindOf({ kind: 'ain', provider }, 1), 'unknown');
  assert.equal(networkKindOf({ kind: 'ain', provider: 'https://mainnet-api.ainetwork.ai' }, 0), 'unknown');
  assert.equal(networkKindOf({ kind: 'ain', provider: 'https://testnet-api.ainetwork.ai' }, 1), 'unknown');
  assert.equal(networkKindOf({ kind: 'ain', provider: 'https://mainnet-api.ainetwork.ai' }), 'unknown');
});

test('native AIN wallet balance cannot be relabeled by marketplace USDC prices or a different provider', () => {
  const info = accountOverview({ ...overview(), currency: 'USDC' }, address)!;
  const wallet = { address, balance: 20, kind: 'ain', provider: info.ledger.provider } as any;
  assert.equal(accountBalanceCurrency(wallet, info), 'AIN');
  assert.equal(accountBalanceCurrency({ ...wallet, address: other }, info), null);
  assert.equal(accountBalanceCurrency({ ...wallet, provider: 'https://other.test' }, info), null);
  assert.equal(accountBalanceCurrency({ ...wallet, kind: 'local' }, info), null);
  assert.equal(accountBalanceCurrency(wallet, null), null);
});
