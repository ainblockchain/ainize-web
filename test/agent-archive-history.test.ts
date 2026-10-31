import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveOperationBlocking, archiveOperationHistoryUrl, readArchiveOperationHistory, readArchiveOperationRecord } from '../src/lib/agentArchiveOperation';
import { archiveContext as context, archiveOperationJob as job } from './fixtures/agentArchiveOperation';
import { archivedAgent } from './fixtures/agentArchive';

const envelope = (operations: unknown[] = [job()]) => ({ format: 1, ...context, operations });
test('history recovers restore and removed-archive deletion evidence without browser storage or archive lookup', () => {
  const deletion = { ...job(), id: 'b'.repeat(32), action: 'delete', result: { deleted: job().archiveId }, createdAt: job().createdAt + 1 };
  const history = readArchiveOperationHistory(envelope([job(), deletion]), context)!;
  assert.equal(history.operations.length, 2);
  assert.deepEqual(history.operations.map(row => row.action), ['delete', 'restore']);
  assert.match(archiveOperationHistoryUrl(context), /expected_owner=sso%3Aviewer&expected_node=0x/);
  history.operations[0].agentId = 'changed';
  assert.equal(deletion.agentId, 'saved-agent', 'the server snapshot is not mutable through parsed history');
});
test('an absent, malformed, foreign or duplicate list never means no requests', () => {
  assert.deepEqual(readArchiveOperationHistory(envelope([]), context)?.operations, []);
  for (const raw of [undefined, {}, { ...envelope(), format: 2 }, { ...envelope(), owner: 'other' }, { ...envelope(), node: 'other' },
    envelope([job(), job()]), envelope([null]), envelope([{ ...job(), owner: 'other' }]), envelope([{ ...job(), node: 'other' }]),
    envelope(Array.from({ length: 1001 }, (_, i) => ({ ...job(), id: i.toString(16).padStart(32, '0') })))]) {
    assert.equal(readArchiveOperationHistory(raw, context), null);
  }
});
test('history validates target and completion evidence independently of the missing browser intent', () => {
  for (const patch of [{ id: 'bad' }, { archiveId: 'bad' }, { agentId: '../other' }, { action: 'run' }, { version: 0 },
    { version: Number.MAX_SAFE_INTEGER }, { restoredAt: -1 }, { createdAt: 0 }, { updatedAt: 1 }, { state: 'ready' },
    { result: { ...job().result, archiveId: 'archive_' + 'f'.repeat(24) } }, { result: { ...job().result, version: 6 } },
    { result: { ...job().result, agentId: 'other' } }, { result: { ...job().result, commit: 'main' } }, { error: { status: 500, code: 'failed', message: 'Failed' } },
    { action: 'delete', result: { deleted: 'another' } }]) {
    assert.equal(readArchiveOperationRecord({ ...job(), ...patch }, context), null, JSON.stringify(patch));
  }
});
test('only valid unresolved records block the same archive or agent, and terminal receipts never claim a current runtime', () => {
  for (const state of ['running', 'interrupted', 'unknown'] as const) {
    const row = { ...job(undefined, state), error: state === 'unknown' ? { status: 502, code: 'archive_operation_unknown', message: 'Inspect' } : null };
    const history = readArchiveOperationHistory(envelope([row]), context)!;
    assert.equal(archiveOperationBlocking(history, archivedAgent())?.id, row.id);
    assert.ok(archiveOperationBlocking(history, { ...archivedAgent(), id: 'archive_' + 'e'.repeat(24) }));
    assert.ok(archiveOperationBlocking(history, { ...archivedAgent(), agent: 'other' }));
    assert.equal(archiveOperationBlocking(history, { ...archivedAgent(), agent: 'other', id: 'archive_' + 'e'.repeat(24) }), undefined);
    assert.equal(readArchiveOperationHistory(envelope([{ ...row, result: job().result }]), context), null);
  }
  for (const row of [job(), { ...job(undefined, 'refused'), error: { status: 409, code: 'archive_operation_cancelled', message: 'Cancelled' } }]) {
    const history = readArchiveOperationHistory(envelope([row]), context)!;
    assert.equal(archiveOperationBlocking(history, archivedAgent()), undefined);
  }
});
