import { readAgentArchiveSummary, reviewAgentArchive, readAgentArchiveRestore, agentArchiveDeleted,
  type AgentArchiveReview, type AgentArchiveSummary } from '../api/agentArchiveEvidence';
export interface ArchiveContext { node: string; owner: string }
export interface ArchiveOperation {
  format: 1; id: string; context: ArchiveContext; action: 'restore' | 'delete'; review: AgentArchiveReview; requestedAt: number;
  job?: ArchiveOperationJob;
}
export interface ArchiveOperationJob {
  format: 1; id: string; node: string; owner: string; action: 'restore' | 'delete'; archiveId: string; agentId: string;
  version: number; restoredAt: number | null; createdAt: number; updatedAt: number;
  state: 'running' | 'done' | 'refused' | 'unknown' | 'interrupted'; result: unknown;
  error: { status: number; code: string; message: string } | null;
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const time = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 8.64e15;
const idOk = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
export const archiveOperationKey = (context: ArchiveContext) => `ainize:archive-operation:v1:${encodeURIComponent(JSON.stringify([context.node, context.owner]))}`;
export const archiveOperationTarget = (op: ArchiveOperation) => ({ archiveId: op.review.record.id, agentId: op.review.record.agent,
  action: op.action, version: op.review.version, restoredAt: op.review.record.restoredAt });
export const archiveOperationBody = (op: ArchiveOperation) => ({ ...archiveOperationTarget(op), expected_owner: op.context.owner, expected_node: op.context.node });
export const archiveOperationUrl = (op: ArchiveOperation, read = false) => `/api/agent-archive-operations/${op.id}${read ? `?expected_owner=${encodeURIComponent(op.context.owner)}&expected_node=${encodeURIComponent(op.context.node)}` : ''}`;
/** Server records survive archive removal and do not need a fabricated archive summary. */
export function readArchiveOperationRecord(row: unknown, context: ArchiveContext): ArchiveOperationJob | null {
  if (!object(row) || row.format !== 1 || !idOk(row.id) || row.node !== context.node || row.owner !== context.owner
    || typeof row.archiveId !== 'string' || !/^archive_[a-f0-9]{24}$/.test(row.archiveId)
    || typeof row.agentId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(row.agentId)
    || !['restore', 'delete'].includes(row.action) || !Number.isSafeInteger(row.version) || row.version < 1 || row.version > Number.MAX_SAFE_INTEGER - 2
    || !(row.restoredAt === null || time(row.restoredAt))
    || !time(row.createdAt) || !time(row.updatedAt) || row.updatedAt < row.createdAt
    || !['running', 'done', 'refused', 'unknown', 'interrupted'].includes(row.state)) return null;
  if (row.state === 'done') {
    const target = { record: { id: row.archiveId, agent: row.agentId }, version: row.version };
    if (row.error !== null || (row.action === 'restore' ? !readAgentArchiveRestore(row.result, target) : !agentArchiveDeleted(row.result, row.archiveId))) return null;
  } else if (row.result !== null) return null;
  else if (row.state === 'running' || row.state === 'interrupted') { if (row.error !== null) return null; }
  else if (!object(row.error) || !Number.isInteger(row.error.status) || row.error.status < 400 || row.error.status > 599 || typeof row.error.code !== 'string' || typeof row.error.message !== 'string') return null;
  return structuredClone(row) as ArchiveOperationJob;
}
export function readArchiveOperationJob(raw: unknown, op: ArchiveOperation): ArchiveOperationJob | null {
  const row = readArchiveOperationRecord(object(raw) ? raw.operation : null, op.context);
  return row && row.id === op.id && Object.entries(archiveOperationTarget(op)).every(([key, value]) => row[key as keyof ArchiveOperationJob] === value) ? row : null;
}
export interface ArchiveOperationHistory { format: 1; node: string; owner: string; operations: ArchiveOperationJob[] }
export const archiveOperationHistoryUrl = (context: ArchiveContext) => `/api/agent-archive-operations?expected_owner=${encodeURIComponent(context.owner)}&expected_node=${encodeURIComponent(context.node)}`;
export function readArchiveOperationHistory(raw: unknown, context: ArchiveContext): ArchiveOperationHistory | null {
  if (!object(raw) || raw.format !== 1 || raw.node !== context.node || raw.owner !== context.owner
    || !Array.isArray(raw.operations) || raw.operations.length > 1000) return null;
  const rows = raw.operations.map(row => readArchiveOperationRecord(row, context));
  if (rows.some(row => !row) || new Set(rows.map(row => row!.id)).size !== rows.length) return null;
  return { format: 1, ...context, operations: (rows as ArchiveOperationJob[]).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id)) };
}
export const archiveOperationUnresolved = (job: ArchiveOperationJob) => ['running', 'unknown', 'interrupted'].includes(job.state);
export const archiveOperationBlocking = (history: ArchiveOperationHistory, record: AgentArchiveSummary) =>
  history.operations.find(job => archiveOperationUnresolved(job) && (job.archiveId === record.id || job.agentId === record.agent));
function parse(raw: unknown, context: ArchiveContext): ArchiveOperation {
  if (!object(raw) || raw.format !== 1 || !idOk(raw.id) || !object(raw.context) || raw.context.node !== context.node || raw.context.owner !== context.owner
    || !['restore', 'delete'].includes(raw.action) || !time(raw.requestedAt) || !object(raw.review)
    || !Number.isSafeInteger(raw.review.version) || raw.review.version < 1 || raw.review.version > Number.MAX_SAFE_INTEGER - 2) throw new Error('storage');
  const record = readAgentArchiveSummary(raw.review.record);
  if (!record) throw new Error('storage');
  const op: ArchiveOperation = { format: 1, id: raw.id, context: { ...context }, action: raw.action,
    requestedAt: raw.requestedAt, review: { record, version: raw.review.version } };
  if (raw.job !== undefined) { const job = readArchiveOperationJob({ operation: raw.job }, op); if (!job) throw new Error('storage'); op.job = job; }
  return op;
}
export function readArchiveOperation(storage: Storage, context: ArchiveContext): ArchiveOperation | null {
  try { const raw = storage.getItem(archiveOperationKey(context)); return raw === null ? null : parse(JSON.parse(raw), context); }
  catch { throw new Error('storage'); }
}
const same = (a: ArchiveOperation, b: ArchiveOperation) => a.id === b.id && a.requestedAt === b.requestedAt && JSON.stringify(archiveOperationBody(a)) === JSON.stringify(archiveOperationBody(b));
function save(storage: Storage, op: ArchiveOperation) {
  const clean = parse(op, op.context), key = archiveOperationKey(op.context);
  try { const raw = JSON.stringify(clean); storage.setItem(key, raw); if (storage.getItem(key) !== raw) throw new Error(); }
  catch { throw new Error('storage'); }
}
export interface ArchiveOperationIO {
  storage: Storage; current: () => boolean;
  readArchive: (record: AgentArchiveSummary) => Promise<unknown>;
  request: (op: ArchiveOperation, method: 'read' | 'submit' | 'cancel') => Promise<unknown>;
  retained: (op: ArchiveOperation) => void;
}
function requireSaved(io: ArchiveOperationIO, op: ArchiveOperation): ArchiveOperation {
  const saved = readArchiveOperation(io.storage, op.context);
  if (!saved || !same(saved, op)) throw new Error('storage');
  return saved;
}
async function receive(io: ArchiveOperationIO, op: ArchiveOperation, method: 'read' | 'submit' | 'cancel'): Promise<ArchiveOperation> {
  requireSaved(io, op);
  if (!io.current()) throw new Error('departed');
  let raw: unknown;
  try { raw = await io.request(op, method); }
  catch {
    // A missed reply cannot cause another mutation. Only a status read follows submission.
    if (method !== 'read' && io.current()) return receive(io, op, 'read');
    throw new Error('unreachable');
  }
  const job = readArchiveOperationJob(raw, op);
  if (!job) throw new Error('unconfirmed');
  requireSaved(io, op); // Protect a changed browser record even when this response arrives late.
  const next = { ...op, job }; save(io.storage, next);
  if (io.current()) io.retained(next);
  return next;
}
/** Every call is made under the same owner/node browser Web Lock. */
export async function submitArchiveOperation(io: ArchiveOperationIO, context: ArchiveContext, id: string, record: AgentArchiveSummary, action: ArchiveOperation['action']): Promise<ArchiveOperation> {
  if (!io.current()) throw new Error('departed');
  if (readArchiveOperation(io.storage, context)) throw new Error('pending');
  const selected = structuredClone(record), raw = await io.readArchive(selected);
  if (!io.current()) throw new Error('departed');
  const review = reviewAgentArchive(raw, selected, context.owner);
  if (!review || action === 'delete' && review.record.exportedAt === null) throw new Error('changed');
  if (readArchiveOperation(io.storage, context)) throw new Error('pending');
  const op: ArchiveOperation = { format: 1, id, context, action, review, requestedAt: Date.now() };
  save(io.storage, op); io.retained(op);
  return receive(io, op, 'submit');
}
export const inspectArchiveOperation = (io: ArchiveOperationIO, op: ArchiveOperation) => receive(io, op, 'read');
export const cancelUnadmittedArchiveOperation = (io: ArchiveOperationIO, op: ArchiveOperation) => receive(io, op, 'cancel');
export async function acknowledgeArchiveOperation(io: ArchiveOperationIO, op: ArchiveOperation): Promise<void> {
  const fresh = await inspectArchiveOperation(io, op);
  if (!io.current()) throw new Error('departed');
  if (!['done', 'refused'].includes(fresh.job?.state ?? '')) throw new Error('unconfirmed');
  requireSaved(io, fresh);
  try { const key = archiveOperationKey(op.context); io.storage.removeItem(key); if (io.storage.getItem(key) !== null) throw new Error(); }
  catch { throw new Error('storage'); }
}
