import type { ArchiveOperation } from '../../src/lib/agentArchiveOperation';
import { archivedAgent, archiveReceipt } from './agentArchive';
export const archiveContext = { node: '0x' + 'a'.repeat(40), owner: 'sso:viewer' };
export const pendingArchiveOperation = (): ArchiveOperation => ({ format: 1, id: 'a'.repeat(32), context: archiveContext, action: 'restore', requestedAt: 1700000000000, review: { record: archivedAgent(), version: 5 } });
export const archiveOperationJob = (op = pendingArchiveOperation(), state = 'done') => ({ format: 1, id: op.id, node: op.context.node, owner: op.context.owner,
  archiveId: op.review.record.id, agentId: op.review.record.agent, version: op.review.version, restoredAt: op.review.record.restoredAt, action: op.action,
  state, createdAt: 1700000000000, updatedAt: 1700000000001, result: state === 'done' ? archiveReceipt() : null, error: null });
