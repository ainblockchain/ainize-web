import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { apiKeyList, apiKeyPrefix, createdApiKey, revokedApiKey } from '../src/api/apiKeyEvidence';

// Deliberately fake and never submitted to any service.
const secret = 'ainize-sk-' + 'a'.repeat(32);
const prefix = createHash('sha256').update(secret).digest('hex').slice(0, 8);
const receipt = { api_key: secret, prefix, label: 'laptop', org_id: null };

test('creation matches the actual secret hash and the explicit name and organization', () => {
  assert.equal(apiKeyPrefix(secret), prefix);
  assert.equal(createdApiKey(receipt, 'laptop', null), secret);
  assert.equal(createdApiKey({ ...receipt, org_id: 'studio' }, 'laptop', 'studio'), secret);
  for (const change of [{ prefix: '00000000' }, { label: 'old-name' }, { org_id: 'studio' }, { org_id: undefined }, { api_key: 'not-a-key' }]) {
    assert.equal(createdApiKey({ ...receipt, ...change }, 'laptop', null), null);
  }
});

test('same-label older key receipt cannot be accepted for a newly returned secret', () => {
  const old = 'ainize-sk-' + 'b'.repeat(32);
  assert.equal(createdApiKey({ ...receipt, prefix: apiKeyPrefix(old) }, 'laptop', null), null);
});

test('key lists distinguish empty from malformed, duplicate identifiers and invalid summaries', () => {
  assert.deepEqual(apiKeyList({ keys: [] }), { keys: [] });
  const key = { prefix, label: 'laptop', issuedAt: 1, org_id: null, disabled: false };
  assert.deepEqual(apiKeyList({ keys: [key] }), { keys: [key] });
  for (const value of [null, [], {}, { keys: null }, { keys: [key, key] }, ...[
    { prefix: '' }, { key_id: '0'.repeat(64) }, { key_id: 'invalid' }, { label: {} }, { issuedAt: NaN }, { issuedAt: -1 }, { disabled: 'false' }, { org_id: '' },
  ].map((change) => ({ keys: [{ ...key, ...change }] }))]) assert.equal(apiKeyList(value), null);
});

test('revocation requires the selected hash identifier and a true acknowledgement', () => {
  assert.equal(revokedApiKey({ revoked: true, prefix }, prefix), true);
  for (const value of [null, {}, { revoked: true }, { revoked: false, prefix }, { revoked: true, prefix: '00000000' }]) {
    assert.equal(revokedApiKey(value, prefix), false);
  }
});

test('full identifiers distinguish colliding display prefixes and receipt targets', async () => {
  const { apiKeyId } = await import('../src/api/apiKeyEvidence');
  const one = 'deadbeef' + '1'.repeat(56), two = 'deadbeef' + '2'.repeat(56);
  const item = { prefix: 'deadbeef', issuedAt: 1, label: 'same' };
  const list = { keys: [{ ...item, key_id: one }, { ...item, key_id: two }] };
  assert.deepEqual(apiKeyList(list), list);
  assert.equal(apiKeyId(list.keys[1]!), two);
  assert.equal(apiKeyList({ keys: [list.keys[0], { ...item }] }), null);
  assert.equal(revokedApiKey({ revoked: true, prefix: 'deadbeef', key_id: one }, two), false);
  assert.equal(revokedApiKey({ revoked: true, prefix: 'deadbeef', key_id: two }, two), true);
});

test('scoped snapshots and receipts must identify the displayed account and node', async () => {
  const { apiKeyContext, apiKeySnapshot, apiKeyHash, apiKeyExpected } = await import('../src/api/apiKeyEvidence');
  const context = apiKeyContext('0x' + 'A'.repeat(40), 'sso:viewer')!;
  const metadata = { version: 1, ...context };
  assert.equal(apiKeyContext(null, 'sso:viewer'), null);
  assert.equal(apiKeyContext('invalid', 'sso:viewer'), null);
  assert.deepEqual(apiKeyExpected(context), { expected_node: '0x' + 'a'.repeat(40), expected_owner: 'sso:viewer' });
  assert.ok(apiKeySnapshot({ ...metadata, complete: true, keys: [] }, context));
  const created = { ...receipt, ...metadata, key_id: apiKeyHash(secret) };
  const revoked = { ...metadata, revoked: true, key_id: created.key_id, prefix };
  assert.equal(createdApiKey(created, 'laptop', null, context), secret);
  assert.equal(revokedApiKey(revoked, created.key_id, context), true);
  for (const wrong of [{ node: '0x' + 'b'.repeat(40) }, { owner: 'sso:other' }, { version: 0 }]) {
    assert.equal(apiKeySnapshot({ ...metadata, complete: true, keys: [], ...wrong }, context), null);
    assert.equal(createdApiKey({ ...created, ...wrong }, 'laptop', null, context), null);
    assert.equal(revokedApiKey({ ...revoked, ...wrong }, created.key_id, context), false);
  }
  for (const extra of [{ complete: false }, { keys: [{ prefix, label: 'laptop', issuedAt: 1 }] }]) {
    assert.equal(apiKeySnapshot({ ...metadata, complete: true, keys: [], ...extra }, context), null);
  }
});

test('held key status distinguishes disabled, revoked, unknown and a pre-creation list', async () => {
  const { apiKeyHash, heldApiKeyState } = await import('../src/api/apiKeyEvidence');
  const context = { owner: 'sso:viewer', node: '0x' + 'a'.repeat(40) };
  const item = { key_id: apiKeyHash(secret), prefix, label: 'laptop', issuedAt: 1, org_id: null, disabled: false };
  const snapshot = { version: 1, ...context, complete: true, keys: [item] };
  assert.equal(heldApiKeyState(secret, 100, snapshot, context, 99), 'ready');
  assert.equal(heldApiKeyState(secret, 100, { ...snapshot, keys: [{ ...item, disabled: true }] }, context, 110), 'disabled');
  assert.equal(heldApiKeyState(secret, 100, { ...snapshot, keys: [] }, context, 110), 'revoked');
  for (const startedAt of [99, 100, undefined, NaN]) {
    assert.equal(heldApiKeyState(secret, 100, { ...snapshot, keys: [] }, context, startedAt), 'checking');
  }
  for (const invalid of [null, {}, { ...snapshot, owner: 'sso:other' }, { ...snapshot, complete: false }]) {
    assert.equal(heldApiKeyState(secret, 100, invalid, context, 110), 'checking');
  }
});

test('model-call preflight refuses revoked, suspended, foreign and unconfirmed keys without retrying', async () => {
  const { apiKeyHash, confirmApiKeyForCall } = await import('../src/api/apiKeyEvidence');
  const context = { node: '0x' + 'a'.repeat(40), owner: 'sso:viewer' };
  const item = { key_id: apiKeyHash(secret), prefix, label: null, org_id: null, issuedAt: 1, disabled: false };
  const snapshot = { version: 1, complete: true, ...context, keys: [item] };
  let calls = 0;
  await confirmApiKeyForCall(secret, context, async () => { calls++; return snapshot; }, () => true);
  assert.equal(calls, 1);
  for (const value of [{ ...snapshot, keys: [] }, { ...snapshot, keys: [{ ...item, disabled: true }] }, { ...snapshot, owner: 'other' }, null]) {
    await assert.rejects(confirmApiKeyForCall(secret, context, async () => { calls++; return value; }, () => true), /key_unavailable/);
  }
  assert.equal(calls, 5, 'one read only for each explicit check');
  await assert.rejects(confirmApiKeyForCall(secret, context, async () => { throw new Error('lost response'); }, () => true), /key_unavailable/);
  let current = true;
  await assert.rejects(confirmApiKeyForCall(secret, context, async () => { current = false; return snapshot; }, () => current), { name: 'AbortError' });
  let queried = false;
  await assert.rejects(confirmApiKeyForCall(secret, context, async () => { queried = true; return snapshot; }, () => false), { name: 'AbortError' });
  assert.equal(queried, false);
});
