import { apiKeyContext, apiKeySnapshot, type ApiKeyContext } from '../api/apiKeyEvidence';
import type { ApiKeySummary } from '../api/types';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type KeyCreationReceipt = { status: 'issued' | 'disabled' | 'revoked'; key: Required<ApiKeySummary> } | { status: 'cancelled'; key: null };
export interface KeyCreation {
  version: 1;
  id: string;
  context: ApiKeyContext;
  label: string;
  orgId: string | null;
  requestedAt: number;
  action: 'create' | 'cancel';
  receipt: KeyCreationReceipt | null;
}
export type KeyCreationResult = { operation: KeyCreation; status: KeyCreationReceipt['status'] | 'not_found' | 'unknown' };
export const keyCreationStorageKey = (context: ApiKeyContext) => `ainize:key-creation:v1:${encodeURIComponent(context.node)}:${encodeURIComponent(context.owner)}`;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Receipts must name this request, actor and selection, including the full credential identifier. */
export function keyCreationReceipt(value: unknown, intent: KeyCreation): KeyCreationReceipt | 'not_found' | null {
  if (!record(value) || value.version !== 1 || value.node !== intent.context.node || value.owner !== intent.context.owner || value.request_id !== intent.id) return null;
  if (value.status === 'not_found') return value.key === null ? 'not_found' : null;
  if (value.label !== intent.label || value.org_id !== intent.orgId) return null;
  if (value.status === 'cancelled') return value.key === null ? { status: 'cancelled', key: null } : null;
  if (!['issued', 'disabled', 'revoked'].includes(String(value.status))) return null;
  const snapshot = apiKeySnapshot({ version: 1, ...intent.context, complete: true, keys: [value.key] }, intent.context);
  const key = snapshot?.keys[0];
  if (!key || key.label !== intent.label || key.org_id !== intent.orgId || key.disabled !== (value.status !== 'issued')) return null;
  return { status: value.status as 'issued' | 'disabled' | 'revoked', key: {
    key_id: key.key_id!, prefix: key.prefix, label: key.label, org_id: key.org_id!, issuedAt: key.issuedAt, disabled: key.disabled!,
  } };
}
function parse(value: unknown, context: ApiKeyContext): KeyCreation {
  const v = value as KeyCreation;
  const normalized = apiKeyContext(context.node, context.owner);
  if (!v || v.version !== 1 || !normalized || normalized.node !== context.node || normalized.owner !== context.owner
    || v.context?.node !== context.node || v.context?.owner !== context.owner
    || typeof v.id !== 'string' || !/^[a-f0-9]{32}$/.test(v.id)
    || typeof v.label !== 'string' || !v.label.trim() || v.label !== v.label.trim() || v.label.length > 60
    || !(v.orgId === null || (typeof v.orgId === 'string' && !!v.orgId && v.orgId.length <= 200))
    || !Number.isSafeInteger(v.requestedAt) || v.requestedAt < 0 || !['create', 'cancel'].includes(v.action)) throw new Error('storage');
  const receipt = v.receipt === null ? null : keyCreationReceipt({ ...v.receipt, version: 1, ...context, request_id: v.id, label: v.label, org_id: v.orgId }, v);
  if (v.receipt !== null && (!receipt || receipt === 'not_found')) throw new Error('storage');
  return { version: 1, id: v.id, context: { ...context }, label: v.label, orgId: v.orgId, requestedAt: v.requestedAt, action: v.action, receipt: receipt as KeyCreationReceipt | null };
}
const same = (a: KeyCreation, b: KeyCreation) => a.id === b.id && a.context.node === b.context.node && a.context.owner === b.context.owner
  && a.requestedAt === b.requestedAt && a.label === b.label && a.orgId === b.orgId && a.action === b.action;
export function readKeyCreation(storage: Storage, context: ApiKeyContext): KeyCreation | null {
  try { const raw = storage.getItem(keyCreationStorageKey(context)); return raw === null ? null : parse(JSON.parse(raw), context); }
  catch { throw new Error('storage'); }
}
function write(storage: Storage, operation: KeyCreation): KeyCreation {
  const clean = parse(operation, operation.context), raw = JSON.stringify(clean);
  try {
    storage.setItem(keyCreationStorageKey(clean.context), raw);
    if (storage.getItem(keyCreationStorageKey(clean.context)) !== raw) throw new Error('storage');
  } catch { throw new Error('storage'); }
  return clean;
}
function saved(storage: Storage, operation: KeyCreation): KeyCreation {
  const value = readKeyCreation(storage, operation.context);
  if (!value || !same(value, operation)) throw new Error('pending');
  return value;
}
export function acknowledgeKeyCreation(storage: Storage, operation: KeyCreation): void {
  if (!saved(storage, operation).receipt) throw new Error('unconfirmed');
  try {
    storage.removeItem(keyCreationStorageKey(operation.context));
    if (storage.getItem(keyCreationStorageKey(operation.context)) !== null) throw new Error('storage');
  } catch { throw new Error('storage'); }
}
export interface KeyCreationIO {
  storage: Storage;
  current: () => boolean;
  load: (operation: KeyCreation) => Promise<unknown>;
  submit: (operation: KeyCreation) => Promise<unknown>;
  retained?: (operation: KeyCreation) => void;
  /** Preserve a possible secret in account-scoped tab memory, never in this metadata journal. */
  candidate?: (operation: KeyCreation, value: unknown) => void;
  /** Only runs after a fully validated, durably recorded receipt. */
  confirmed?: (operation: KeyCreation, receipt: KeyCreationReceipt) => void;
}
function accept(io: KeyCreationIO, operation: KeyCreation, value: unknown): KeyCreationResult {
  const previous = saved(io.storage, operation);
  const receipt = keyCreationReceipt(value, operation);
  if (!receipt || receipt === 'not_found') return { operation: previous, status: previous.receipt ? 'unknown' : receipt ?? 'unknown' };
  // The server's terminal history may advance (issued -> disabled/revoked), never change its key or un-cancel.
  if (previous.receipt && (previous.receipt.status === 'cancelled' ? receipt.status !== 'cancelled'
    : receipt.status === 'cancelled' || receipt.key?.key_id !== previous.receipt.key.key_id
      || (previous.receipt.status === 'revoked' && receipt.status !== 'revoked'))) return { operation: previous, status: 'unknown' };
  const next = write(io.storage, { ...previous, receipt });
  io.retained?.(next);
  io.confirmed?.(next, receipt);
  return { operation: next, status: receipt.status };
}
/** Reload and recovery only read; a missing result is not permission to issue again or forget intent. */
export async function inspectKeyCreation(io: KeyCreationIO, operation: KeyCreation): Promise<KeyCreationResult> {
  const previous = saved(io.storage, operation);
  if (!io.current()) return { operation: previous, status: 'unknown' };
  let response: unknown;
  try { response = await io.load(previous); } catch { return { operation: previous, status: 'unknown' }; }
  if (!io.current()) return { operation: previous, status: 'unknown' };
  return accept(io, previous, response);
}
/** Caller holds the account/node lock. Only an explicit user action may call this function. */
export async function submitKeyCreation(io: KeyCreationIO, operation: KeyCreation, mode: 'start' | 'retry' | 'cancel'): Promise<KeyCreationResult> {
  if (!io.current()) throw new Error('departed');
  let next: KeyCreation;
  if (mode === 'start') {
    if (readKeyCreation(io.storage, operation.context)) throw new Error('pending');
    if (operation.receipt || operation.action !== 'create') throw new Error('pending');
    next = write(io.storage, operation);
  } else {
    next = saved(io.storage, operation);
    if (next.receipt) return inspectKeyCreation(io, next);
    if (mode === 'retry' && next.action !== 'create') throw new Error('pending');
    if (mode === 'cancel') next = write(io.storage, { ...next, action: 'cancel' });
  }
  io.retained?.(next);
  if (!io.current()) throw new Error('departed');
  let response: unknown;
  try { response = await io.submit(next); } catch { return inspectKeyCreation(io, next); }
  // Capture even a malformed receipt's secret before readback, including after navigation within this account.
  io.candidate?.(next, response);
  const result = accept(io, next, response);
  return result.status === 'unknown' || result.status === 'not_found' ? inspectKeyCreation(io, next) : result;
}
