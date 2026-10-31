import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeKeyRevocation, inspectKeyRevocation, keyRevocationStorageKey, readKeyRevocation, submitKeyRevocation,
  type KeyRevocation, type KeyRevocationIO } from '../src/lib/apiKeyRevocation';

const context = { node: '0x' + 'a'.repeat(40), owner: 'sso:fixture' };
const key = { key_id: 'deadbeef' + '1'.repeat(56), prefix: 'deadbeef', label: 'fixture key', org_id: null, disabled: false, issuedAt: 1 };
const intent = (): KeyRevocation => ({ version: 1, id: '1'.repeat(32), context, key: { ...key }, requestedAt: 100, state: 'pending' });
const snapshot = (keys = [key]) => ({ version: 1, ...context, complete: true, keys });
const receipt = () => ({ version: 1, ...context, revoked: true, key_id: key.key_id, prefix: key.prefix });
function fixture() {
  const values = new Map<string, string>();
  const calls: string[] = [];
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, v); },
    removeItem: (k: string) => { values.delete(k); },
  };
  const io: KeyRevocationIO = { storage, current: () => true,
    load: async () => { calls.push('GET'); return snapshot(); },
    revoke: async (id, actor) => {
      calls.push('DELETE'); assert.equal(id, key.key_id); assert.deepEqual(actor, context);
      assert.equal(readKeyRevocation(storage, context)?.key.key_id, id, 'the exact target is durable before sending');
      return receipt();
    },
  };
  return { values, calls, storage, io };
}

test('exact target is saved before DELETE and confirmation survives reload until acknowledged', async () => {
  const f = fixture();
  f.io.retained = (saved) => { assert.deepEqual(readKeyRevocation(f.storage, context), saved); f.calls.push('retained'); };
  const result = await submitKeyRevocation(f.io, intent());
  assert.deepEqual(f.calls, ['GET', 'retained', 'DELETE']);
  assert.equal(result.status, 'confirmed');
  assert.equal(readKeyRevocation(f.storage, context)?.state, 'confirmed');
  acknowledgeKeyRevocation(f.storage, result.operation);
  assert.equal(readKeyRevocation(f.storage, context), null);
  assert.ok(!JSON.stringify([...f.values]).includes('ainize-sk-'));
});

test('lost DELETE response plus confirmed absence completes without another DELETE', async () => {
  const f = fixture(); let removed = false;
  f.io.load = async () => { f.calls.push('GET'); return snapshot(removed ? [] : [key]); };
  f.io.revoke = async () => { f.calls.push('DELETE'); removed = true; throw new Error('lost response'); };
  assert.equal((await submitKeyRevocation(f.io, intent())).status, 'confirmed');
  assert.deepEqual(f.calls, ['GET', 'DELETE', 'GET']);
});

test('lost response with a still-present key is retained and only an explicit retry sends another DELETE', async () => {
  const f = fixture();
  f.io.revoke = async () => { f.calls.push('DELETE'); throw new Error('connection lost'); };
  const first = await submitKeyRevocation(f.io, intent());
  assert.equal(first.status, 'present');
  assert.equal(readKeyRevocation(f.storage, context)?.state, 'pending');
  assert.throws(() => acknowledgeKeyRevocation(f.storage, first.operation), /unconfirmed/);
  const recovered = await inspectKeyRevocation(f.io, readKeyRevocation(f.storage, context)!);
  assert.equal(recovered.status, 'present');
  assert.equal(f.calls.filter(call => call === 'DELETE').length, 1);
  f.io.revoke = async () => { f.calls.push('DELETE'); return receipt(); };
  assert.equal((await submitKeyRevocation(f.io, recovered.operation, true)).status, 'confirmed');
  assert.equal(f.calls.filter(call => call === 'DELETE').length, 2);
});

test('malformed or wrong-account readback remains unknown, never empty or confirmed', async () => {
  for (const invalid of [null, {}, { ...snapshot([]), owner: 'other' }, { ...snapshot([]), complete: false }]) {
    const f = fixture(); let after = false;
    f.io.load = async () => after ? invalid : snapshot();
    f.io.revoke = async () => { after = true; throw new Error('lost'); };
    assert.equal((await submitKeyRevocation(f.io, intent())).status, 'unknown');
    assert.equal(readKeyRevocation(f.storage, context)?.state, 'pending');
  }
});

test('unwritable, unverifiable and corrupt storage prevent any mutation', async () => {
  for (const breakStorage of [
    (f: ReturnType<typeof fixture>) => { f.storage.setItem = () => { throw new Error('blocked'); }; },
    (f: ReturnType<typeof fixture>) => { f.storage.setItem = () => undefined; },
    (f: ReturnType<typeof fixture>) => { f.values.set(keyRevocationStorageKey(context), '{bad'); },
  ]) {
    const f = fixture(); breakStorage(f);
    await assert.rejects(submitKeyRevocation(f.io, intent()), /storage/);
    assert.ok(!f.calls.includes('DELETE'));
  }
});

test('pending or confirmed journal cannot be silently replaced by another target', async () => {
  const f = fixture();
  await submitKeyRevocation(f.io, intent());
  const another = { ...intent(), id: '2'.repeat(32), key: { ...key, key_id: 'deadbeef' + '2'.repeat(56) } };
  await assert.rejects(submitKeyRevocation(f.io, another), /pending/);
  await assert.rejects(submitKeyRevocation(f.io, another, true), /pending/);
  assert.equal(readKeyRevocation(f.storage, context)?.id, intent().id);
  assert.equal(f.calls.filter(call => call === 'DELETE').length, 1);
});

test('changed key metadata or changed account before send never mutates anything', async () => {
  const f = fixture();
  f.io.load = async () => snapshot([{ ...key, label: 'changed' }]);
  await assert.rejects(submitKeyRevocation(f.io, intent()), /changed/);
  assert.equal(readKeyRevocation(f.storage, context), null);
  let current = true;
  f.io.current = () => current;
  f.io.load = async () => { current = false; return snapshot(); };
  await assert.rejects(submitKeyRevocation(f.io, intent()), /departed/);
  assert.ok(!f.calls.includes('DELETE'));
});

test('departure after send retains a lost outcome without starting a read under another account', async () => {
  const f = fixture(); let current = true;
  f.io.current = () => current;
  f.io.revoke = async () => { f.calls.push('DELETE'); current = false; throw new Error('lost'); };
  assert.equal((await submitKeyRevocation(f.io, intent())).status, 'unknown');
  assert.deepEqual(f.calls, ['GET', 'DELETE']);
  assert.equal(readKeyRevocation(f.storage, context)?.state, 'pending');
});

test('a matching receipt arriving after navigation is recorded without a further network request', async () => {
  const f = fixture(); let current = true;
  f.io.current = () => current;
  f.io.revoke = async () => { f.calls.push('DELETE'); current = false; return receipt(); };
  assert.equal((await submitKeyRevocation(f.io, intent())).status, 'confirmed');
  assert.deepEqual(f.calls, ['GET', 'DELETE']);
});

test('a wrong receipt cannot confirm the selected key; readback is still required', async () => {
  const f = fixture();
  f.io.revoke = async () => ({ ...receipt(), key_id: 'deadbeef' + '2'.repeat(56) });
  assert.equal((await submitKeyRevocation(f.io, intent())).status, 'present');
  assert.equal(readKeyRevocation(f.storage, context)?.state, 'pending');
});

test('an already absent key needs no DELETE and confirmed status can be closed', async () => {
  const f = fixture(); f.io.load = async () => { f.calls.push('GET'); return snapshot([]); };
  const result = await submitKeyRevocation(f.io, intent());
  assert.equal(result.status, 'confirmed');
  assert.deepEqual(f.calls, ['GET']);
  acknowledgeKeyRevocation(f.storage, result.operation);
});

test('storage and acknowledgement remain bound to the original actor and exact operation', async () => {
  const f = fixture();
  const confirmed = await submitKeyRevocation(f.io, intent());
  assert.equal(readKeyRevocation(f.storage, { ...context, owner: 'other' }), null);
  assert.equal(readKeyRevocation(f.storage, { ...context, node: '0x' + 'b'.repeat(40) }), null);
  assert.throws(() => acknowledgeKeyRevocation(f.storage, { ...confirmed.operation, id: '2'.repeat(32) }), /unconfirmed/);
  assert.equal(readKeyRevocation(f.storage, context)?.state, 'confirmed');
});

test('a late receipt cannot overwrite a different retained operation', async () => {
  const f = fixture();
  const replacement = { ...intent(), id: '2'.repeat(32) };
  f.io.revoke = async () => {
    f.values.set(keyRevocationStorageKey(context), JSON.stringify(replacement));
    return receipt();
  };
  await assert.rejects(submitKeyRevocation(f.io, intent()), /storage/);
  assert.equal(readKeyRevocation(f.storage, context)?.id, replacement.id);
  assert.equal(readKeyRevocation(f.storage, context)?.state, 'pending');
});

test('the persisted journal strips unexpected secret fields from a source summary', async () => {
  const f = fixture();
  const target = intent();
  Object.assign(target.key, { api_key: 'fake-secret-that-must-not-be-persisted' });
  await submitKeyRevocation(f.io, target);
  assert.ok(![...f.values.values()].join('').includes('fake-secret'));
});
