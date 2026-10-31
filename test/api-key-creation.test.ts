import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeKeyCreation, inspectKeyCreation, keyCreationReceipt, keyCreationStorageKey, readKeyCreation, submitKeyCreation,
  type KeyCreation, type KeyCreationIO } from '../src/lib/apiKeyCreation';

const context = { node: '0x' + 'a'.repeat(40), owner: 'sso:fixture' };
const key = { key_id: 'deadbeef' + '1'.repeat(56), prefix: 'deadbeef', label: 'laptop', org_id: null, disabled: false, issuedAt: 1 };
const intent = (): KeyCreation => ({ version: 1, id: '1'.repeat(32), context, label: 'laptop', orgId: null, requestedAt: 100, action: 'create', receipt: null });
const receipt = (extra: Record<string, unknown> = {}) => ({ version: 1, ...context, request_id: intent().id, label: 'laptop', org_id: null, status: 'issued', key, ...extra });
function fixture() {
  const values = new Map<string, string>(), calls: string[] = [];
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const io: KeyCreationIO = { storage, current: () => true,
    load: async operation => { calls.push('GET'); assert.equal(operation.id, intent().id); return receipt(); },
    submit: async operation => {
      calls.push(operation.action === 'cancel' ? 'CANCEL' : 'POST');
      assert.deepEqual(readKeyCreation(storage, context), operation, 'intent is saved before transmission');
      return receipt({ api_key: 'ainize-sk-' + 'A'.repeat(32) });
    },
  };
  return { values, calls, storage, io };
}

test('creation retains exact selection before POST and stores only metadata until explicitly acknowledged', async () => {
  const f = fixture();
  f.io.candidate = (_, value) => { assert.ok((value as { api_key: string }).api_key); f.calls.push('candidate'); };
  f.io.confirmed = () => { assert.equal(readKeyCreation(f.storage, context)?.receipt?.status, 'issued'); f.calls.push('confirmed'); };
  const result = await submitKeyCreation(f.io, intent(), 'start');
  assert.equal(result.status, 'issued'); assert.deepEqual(f.calls, ['POST', 'candidate', 'confirmed']);
  assert.ok(!JSON.stringify([...f.values]).includes('ainize-sk-'));
  acknowledgeKeyCreation(f.storage, result.operation); assert.equal(readKeyCreation(f.storage, context), null);
});

test('lost or malformed response reads the original request, never issues a replacement', async () => {
  for (const response of ['throw', {}, receipt({ node: '0x' + 'b'.repeat(40) })]) {
    const f = fixture();
    f.io.submit = async () => { f.calls.push('POST'); if (response === 'throw') throw new Error('lost'); return response; };
    const result = await submitKeyCreation(f.io, intent(), 'start');
    assert.equal(result.status, 'issued'); assert.deepEqual(f.calls, ['POST', 'GET']);
    await inspectKeyCreation(f.io, readKeyCreation(f.storage, context)!);
    assert.deepEqual(f.calls, ['POST', 'GET', 'GET']);
  }
});

test('not_found cannot clear an uncertain request and an explicit retry preserves its ID and selection', async () => {
  const f = fixture();
  f.io.submit = async operation => { f.calls.push('POST'); assert.equal(operation.id, intent().id); throw new Error('lost'); };
  f.io.load = async () => { f.calls.push('GET'); return receipt({ status: 'not_found', key: null }); };
  const result = await submitKeyCreation(f.io, intent(), 'start');
  assert.equal(result.status, 'not_found');
  assert.throws(() => acknowledgeKeyCreation(f.storage, result.operation), /unconfirmed/);
  await assert.rejects(submitKeyCreation(f.io, { ...intent(), id: '2'.repeat(32) }, 'start'), /pending/);
  await submitKeyCreation(f.io, result.operation, 'retry');
  assert.equal(f.calls.filter(call => call === 'POST').length, 2);
});

test('cancel intent survives lost response and cannot turn into another issue retry', async () => {
  const f = fixture(); f.io.submit = async () => { throw new Error('lost'); }; f.io.load = async () => null;
  const initial = await submitKeyCreation(f.io, intent(), 'start');
  const cancelled = await submitKeyCreation(f.io, initial.operation, 'cancel');
  assert.equal(cancelled.status, 'unknown'); assert.equal(cancelled.operation.action, 'cancel');
  await assert.rejects(submitKeyCreation(f.io, cancelled.operation, 'retry'), /pending/);
  f.io.submit = async op => { assert.equal(op.action, 'cancel'); return receipt({ status: 'cancelled', key: null }); };
  assert.equal((await submitKeyCreation(f.io, cancelled.operation, 'cancel')).status, 'cancelled');
});

test('if issuance wins the cancellation race, the UI gets its exact issued key, never a cancellation claim', async () => {
  const f = fixture(); f.io.submit = async () => { throw new Error('lost'); }; f.io.load = async () => null;
  const initial = await submitKeyCreation(f.io, intent(), 'start');
  f.io.submit = async op => { assert.equal(op.action, 'cancel'); return receipt(); };
  const result = await submitKeyCreation(f.io, initial.operation, 'cancel');
  assert.equal(result.status, 'issued'); assert.equal(result.operation.receipt?.key?.key_id, key.key_id);
});

test('wrong node, actor, request, selection, key identity or disabled state cannot confirm issuance', () => {
  for (const extra of [{ owner: 'sso:other' }, { node: '0x' + 'b'.repeat(40) }, { request_id: '2'.repeat(32) }, { label: 'other' }, { org_id: 'other' },
    { key: { ...key, key_id: undefined } }, { key: { ...key, prefix: '11111111' } }, { key: { ...key, disabled: true } },
    { key: { ...key, org_id: 'other' } }, { status: 'cancelled' }, { status: 'disabled' }, { status: 'revoked' }]) {
    assert.equal(keyCreationReceipt(receipt(extra), intent()), null);
  }
});

test('storage failures, changed selection and a newer action prevent unrecorded or stale submissions', async () => {
  const f = fixture(); f.storage.setItem = () => {};
  await assert.rejects(submitKeyCreation(f.io, intent(), 'start'), /storage/); assert.deepEqual(f.calls, []);
  const g = fixture(); g.io.submit = async () => { throw new Error('lost'); }; g.io.load = async () => null;
  const result = await submitKeyCreation(g.io, intent(), 'start');
  await assert.rejects(submitKeyCreation(g.io, { ...result.operation, orgId: 'other' }, 'retry'), /pending/);
  await submitKeyCreation(g.io, result.operation, 'cancel');
  await assert.rejects(submitKeyCreation(g.io, result.operation, 'retry'), /pending/);
});

test('navigation after POST preserves receipt/candidate but a lost response never reads with another account', async () => {
  for (const lost of [true, false]) {
    const f = fixture(); let current = true, captured = false;
    f.io.current = () => current;
    f.io.candidate = () => { captured = true; };
    f.io.submit = async () => { current = false; if (lost) throw new Error('lost'); return receipt(); };
    const result = await submitKeyCreation(f.io, intent(), 'start');
    assert.equal(result.status, lost ? 'unknown' : 'issued'); assert.equal(captured, !lost); assert.deepEqual(f.calls, []);
    assert.ok(readKeyCreation(f.storage, context));
  }
});

test('terminal receipts can advance to revoked, never change key or resurrect a cancelled/revoked request', async () => {
  const f = fixture(); const first = await submitKeyCreation(f.io, intent(), 'start');
  f.io.load = async () => receipt({ key: { ...key, key_id: 'deadbeef' + '2'.repeat(56) } });
  assert.equal((await inspectKeyCreation(f.io, first.operation)).status, 'unknown');
  f.io.load = async () => receipt({ status: 'revoked', key: { ...key, disabled: true } });
  const revoked = await inspectKeyCreation(f.io, first.operation); assert.equal(revoked.status, 'revoked');
  f.io.load = async () => receipt();
  assert.equal((await inspectKeyCreation(f.io, revoked.operation)).status, 'unknown');
  const g = fixture(); g.io.submit = async () => receipt({ status: 'cancelled', key: null });
  const cancelled = await submitKeyCreation(g.io, intent(), 'start');
  assert.equal((await inspectKeyCreation(g.io, cancelled.operation)).status, 'unknown');
});

test('corrupt or mismatched local metadata is not silently deleted or overwritten', async () => {
  for (const value of ['{broken', JSON.stringify({ ...intent(), context: { ...context, owner: 'other' } }), JSON.stringify({ ...intent(), receipt: {} })]) {
    const f = fixture(); f.values.set(keyCreationStorageKey(context), value);
    assert.throws(() => readKeyCreation(f.storage, context), /storage/);
    await assert.rejects(submitKeyCreation(f.io, intent(), 'start'), /storage/);
    assert.deepEqual(f.calls, []); assert.equal(f.values.get(keyCreationStorageKey(context)), value);
  }
});

test('failure to save a terminal receipt preserves the candidate and original intent for read-only recovery', async () => {
  const f = fixture(); let candidate = false;
  const setItem = f.storage.setItem;
  f.io.submit = async () => { f.storage.setItem = () => { throw new Error('quota'); }; return receipt({ api_key: 'ainize-sk-' + 'A'.repeat(32) }); };
  f.io.candidate = () => { candidate = true; };
  await assert.rejects(submitKeyCreation(f.io, intent(), 'start'), /storage/);
  assert.equal(candidate, true); assert.equal(readKeyCreation(f.storage, context)?.receipt, null);
  f.storage.setItem = setItem;
  assert.equal((await inspectKeyCreation(f.io, readKeyCreation(f.storage, context)!)).status, 'issued');
  assert.deepEqual(f.calls, ['GET']);
});

test('a previously confirmed result disappearing from the node is uncertainty, not a fresh unissued request', async () => {
  const f = fixture(), first = await submitKeyCreation(f.io, intent(), 'start');
  f.io.load = async () => receipt({ status: 'not_found', key: null });
  const missing = await inspectKeyCreation(f.io, first.operation);
  assert.equal(missing.status, 'unknown'); assert.equal(missing.operation.receipt?.status, 'issued');
  await submitKeyCreation(f.io, missing.operation, 'retry');
  assert.equal(f.calls.filter(call => call === 'POST').length, 1);
});
