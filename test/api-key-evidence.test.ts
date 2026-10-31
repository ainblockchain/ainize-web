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
