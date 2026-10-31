import test from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeArchiveOperation, archiveOperationBody, archiveOperationKey, archiveOperationUrl, cancelUnadmittedArchiveOperation,
  inspectArchiveOperation, readArchiveOperation, readArchiveOperationJob, submitArchiveOperation, type ArchiveOperation, type ArchiveOperationIO } from '../src/lib/agentArchiveOperation';
import { archivedAgent, archiveDetail, archiveReceipt } from './fixtures/agentArchive';
import { archiveContext as context, pendingArchiveOperation, archiveOperationJob as job } from './fixtures/agentArchiveOperation';
const id = 'a'.repeat(32);
function fixture() {
  const rows = new Map<string, string>(), calls: string[] = [];
  const storage = { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => { rows.set(k, v); }, removeItem: (k: string) => { rows.delete(k); } };
  const io: ArchiveOperationIO = { storage, current: () => true, readArchive: async () => archiveDetail(), retained: () => {},
    request: async (op, method) => { calls.push(method); assert.equal(readArchiveOperation(storage, context)?.id, op.id); return { operation: job(op) }; } };
  return { rows, storage, calls, io };
}
test('claim is durable before submit, and page reload observes the same request without another mutation', async () => {
  const f = fixture();
  const result = await submitArchiveOperation(f.io, context, id, archivedAgent(), 'restore');
  assert.equal(result.job?.state, 'done'); assert.deepEqual(f.calls, ['submit']);
  const reloaded = readArchiveOperation(f.storage, context)!;
  assert.equal((await inspectArchiveOperation(f.io, reloaded)).job?.state, 'done'); assert.deepEqual(f.calls, ['submit', 'read']);
  assert.match(archiveOperationUrl(result, true), /expected_owner=sso%3Aviewer/);
  assert.equal(archiveOperationBody(result).version, 5);
  assert.equal(readArchiveOperation(f.storage, { ...context, owner: 'another' }), null);
});
test('lost submission response uses GET only, and missing receipts remain saved without resubmission', async () => {
  const f = fixture(); f.io.request = async (op, method) => { f.calls.push(method); if (method === 'submit') throw new Error('lost'); return { operation: job(op) }; };
  assert.equal((await submitArchiveOperation(f.io, context, id, archivedAgent(), 'restore')).job?.state, 'done');
  assert.deepEqual(f.calls, ['submit', 'read']);
  const g = fixture(); g.io.request = async (_op, method) => { g.calls.push(method); throw new Error('missing'); };
  await assert.rejects(submitArchiveOperation(g.io, context, id, archivedAgent(), 'restore'), /unreachable/);
  assert.equal(readArchiveOperation(g.storage, context)?.id, id); assert.deepEqual(g.calls, ['submit', 'read']);
  await assert.rejects(inspectArchiveOperation(g.io, readArchiveOperation(g.storage, context)!), /unreachable/);
  assert.deepEqual(g.calls, ['submit', 'read', 'read']);
});
test('receipt identity binds node, owner, request, action, archive, version and actual mutation result', () => {
  const op = pendingArchiveOperation(); assert.ok(readArchiveOperationJob({ operation: job(op) }, op));
  for (const patch of [{ id: 'b'.repeat(32) }, { node: 'foreign' }, { owner: 'another' }, { action: 'delete' }, { archiveId: 'foreign' },
    { version: 6 }, { restoredAt: 1 }, { updatedAt: 1 }, { result: { ...archiveReceipt(), agentId: 'foreign' } }, { state: 'queued' }, { error: 'failed' }]) {
    assert.equal(readArchiveOperationJob({ operation: { ...job(op), ...patch } }, op), null);
  }
});
test('storage failure, existing intent, changed preflight and departure prevent mutation', async () => {
  const f = fixture(); f.storage.setItem = () => { throw new Error('blocked'); };
  await assert.rejects(submitArchiveOperation(f.io, context, id, archivedAgent(), 'restore'), /storage/); assert.deepEqual(f.calls, []);
  const g = fixture(); await submitArchiveOperation(g.io, context, id, archivedAgent(), 'restore');
  await assert.rejects(submitArchiveOperation(g.io, context, 'b'.repeat(32), archivedAgent(), 'restore'), /pending/); assert.equal(g.calls.length, 1);
  for (const changed of [true, false]) {
    const h = fixture(); let active = true; h.io.current = () => active;
    h.io.readArchive = async () => { if (!changed) active = false; return changed ? {} : archiveDetail(); };
    await assert.rejects(submitArchiveOperation(h.io, context, id, archivedAgent(), 'restore'), changed ? /changed/ : /departed/);
    assert.deepEqual(h.calls, []); assert.equal(h.rows.size, 0);
  }
});
test('deletion captures the reviewed target and requires an export plus its own exact durable receipt', async () => {
  const f = fixture();
  await assert.rejects(submitArchiveOperation(f.io, context, id, archivedAgent(), 'delete'), /changed/);
  assert.deepEqual(f.calls, []); assert.equal(f.rows.size, 0);
  const selected = { ...archivedAgent(), exportedAt: 1700000000100 }, original = structuredClone(selected);
  f.io.readArchive = async () => { selected.id = 'archive_' + 'f'.repeat(24); return archiveDetail(original); };
  f.io.request = async op => { assert.equal(op.review.record.id, original.id); return { operation: { ...job(op), result: { deleted: original.id } } }; };
  assert.equal((await submitArchiveOperation(f.io, context, id, selected, 'delete')).job?.state, 'done');
  const g = fixture(); g.io.readArchive = async () => archiveDetail(original);
  g.io.request = async op => ({ operation: { ...job(op), result: { deleted: 'another' } } });
  await assert.rejects(submitArchiveOperation(g.io, context, id, original, 'delete'), /unconfirmed/);
  assert.equal(readArchiveOperation(g.storage, context)?.job, undefined);
});
test('late receipt stays in the original account recovery record without showing another account a result', async () => {
  const f = fixture(); let active = true, retained = 0;
  f.io.current = () => active; f.io.retained = () => { retained++; };
  f.io.request = async op => { active = false; return { operation: job(op) }; };
  await submitArchiveOperation(f.io, context, id, archivedAgent(), 'restore');
  assert.equal(retained, 1, 'only the pre-submission saved intent was published');
  assert.equal(readArchiveOperation(f.storage, context)?.job?.state, 'done');
  assert.equal(readArchiveOperation(f.storage, { ...context, owner: 'another' }), null);
});
test('unknown/interrupted jobs cannot be acknowledged, while server-confirmed cancellation can close the saved intent', async () => {
  const f = fixture(), op = pendingArchiveOperation(); f.storage.setItem(archiveOperationKey(context), JSON.stringify(op));
  for (const state of ['running', 'interrupted', 'unknown']) {
    f.io.request = async () => ({ operation: { ...job(op, state), error: state === 'unknown' ? { status: 502, code: 'archive_operation_unknown', message: 'Inspect state' } : null } });
    await assert.rejects(acknowledgeArchiveOperation(f.io, op), /unconfirmed/);
    assert.ok(readArchiveOperation(f.storage, context));
  }
  f.io.request = async (_op, method) => { f.calls.push(method); return { operation: { ...job(op, 'refused'), error: { status: 409, code: 'archive_operation_cancelled', message: 'Cancelled before admission' } } }; };
  const cancelled = await cancelUnadmittedArchiveOperation(f.io, op);
  assert.equal(cancelled.job?.state, 'refused');
  await acknowledgeArchiveOperation(f.io, cancelled);
  assert.equal(readArchiveOperation(f.storage, context), null); assert.deepEqual(f.calls, ['cancel', 'read']);
});
test('a missing read or corrupt/foreign browser record never clears recovery evidence', async () => {
  const f = fixture(); const done = await submitArchiveOperation(f.io, context, id, archivedAgent(), 'restore');
  f.io.request = async () => { throw new Error('offline'); };
  await assert.rejects(acknowledgeArchiveOperation(f.io, done), /unreachable/); assert.ok(readArchiveOperation(f.storage, context));
  f.rows.set(archiveOperationKey(context), '{bad'); assert.throws(() => readArchiveOperation(f.storage, context), /storage/);
  f.rows.set(archiveOperationKey(context), JSON.stringify({ ...pendingArchiveOperation(), context: { ...context, owner: 'another' } }));
  assert.throws(() => readArchiveOperation(f.storage, context), /storage/);
});
