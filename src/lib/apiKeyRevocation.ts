import { apiKeySnapshot, revokedApiKey, type ApiKeyContext } from '../api/apiKeyEvidence';
import type { ApiKeySummary } from '../api/types';

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface KeyRevocation {
  version: 1;
  id: string;
  context: ApiKeyContext;
  key: Required<ApiKeySummary>;
  requestedAt: number;
  state: 'pending' | 'confirmed';
}
export type KeyRevocationResult = { operation: KeyRevocation; status: 'confirmed' | 'present' | 'unknown' | 'changed' };
export const keyRevocationStorageKey = (context: ApiKeyContext): string => `ainize:key-revocation:v1:${encodeURIComponent(context.node)}:${encodeURIComponent(context.owner)}`;
const sameKey = (a: ApiKeySummary, b: ApiKeySummary) => a.key_id === b.key_id && a.label === b.label && a.org_id === b.org_id && a.issuedAt === b.issuedAt;
const sameIntent = (a: KeyRevocation, b: KeyRevocation) => a.id === b.id && a.requestedAt === b.requestedAt
  && a.context.node === b.context.node && a.context.owner === b.context.owner && sameKey(a.key, b.key);
function parse(value: unknown, context: ApiKeyContext): KeyRevocation {
  const r = value as KeyRevocation;
  if (!r || r.version !== 1 || typeof r.id !== 'string' || !/^[a-f0-9]{32}$/.test(r.id)
    || r.context?.node !== context.node || r.context?.owner !== context.owner
    || !Number.isSafeInteger(r.requestedAt) || r.requestedAt < 0 || !['pending', 'confirmed'].includes(r.state)
    || !apiKeySnapshot({ version: 1, ...r.context, complete: true, keys: [r.key] }, context)) throw new Error('storage');
  return { version: 1, id: r.id, context: { node: r.context.node, owner: r.context.owner },
    key: { key_id: r.key.key_id, prefix: r.key.prefix, label: r.key.label, org_id: r.key.org_id, issuedAt: r.key.issuedAt, disabled: r.key.disabled },
    requestedAt: r.requestedAt, state: r.state };
}
export function readKeyRevocation(storage: Storage, context: ApiKeyContext): KeyRevocation | null {
  try {
    const raw = storage.getItem(keyRevocationStorageKey(context));
    return raw === null ? null : parse(JSON.parse(raw), context);
  } catch { throw new Error('storage'); }
}
function write(storage: Storage, operation: KeyRevocation) {
  const clean = parse(operation, operation.context);
  try {
    const raw = JSON.stringify(clean);
    storage.setItem(keyRevocationStorageKey(operation.context), raw);
    if (storage.getItem(keyRevocationStorageKey(operation.context)) !== raw) throw new Error('storage');
  } catch { throw new Error('storage'); }
}
function claim(storage: Storage, operation: KeyRevocation) {
  if (operation.state !== 'pending' || readKeyRevocation(storage, operation.context)) throw new Error('pending');
  write(storage, operation);
}
function confirm(storage: Storage, operation: KeyRevocation): KeyRevocationResult {
  const saved = readKeyRevocation(storage, operation.context);
  if (!saved || !sameIntent(saved, operation)) throw new Error('storage');
  const confirmed: KeyRevocation = { ...operation, state: 'confirmed' };
  write(storage, confirmed);
  return { operation: confirmed, status: 'confirmed' };
}
export function acknowledgeKeyRevocation(storage: Storage, operation: KeyRevocation): void {
  const saved = readKeyRevocation(storage, operation.context);
  if (!saved || !sameIntent(saved, operation) || saved.state !== 'confirmed') throw new Error('unconfirmed');
  try {
    storage.removeItem(keyRevocationStorageKey(operation.context));
    if (storage.getItem(keyRevocationStorageKey(operation.context)) !== null) throw new Error('storage');
  } catch { throw new Error('storage'); }
}
export interface KeyRevocationIO {
  storage: Storage;
  current: () => boolean;
  load: () => Promise<unknown>;
  retained?: (operation: KeyRevocation) => void;
  revoke: (id: string, context: ApiKeyContext) => Promise<unknown>;
}
async function observe(io: KeyRevocationIO, operation: KeyRevocation): Promise<'absent' | 'present' | 'changed' | 'unknown'> {
  if (!io.current()) throw new Error('departed');
  let value: unknown;
  try { value = await io.load(); } catch { return 'unknown'; }
  if (!io.current()) throw new Error('departed');
  const snapshot = apiKeySnapshot(value, operation.context);
  if (!snapshot) return 'unknown';
  const key = snapshot.keys.find((k) => k.key_id === operation.key.key_id);
  return !key ? 'absent' : sameKey(key, operation.key) ? 'present' : 'changed';
}
/** Caller holds the per-account/node browser lock. This function never submits a mutation. */
export async function inspectKeyRevocation(io: KeyRevocationIO, operation: KeyRevocation): Promise<KeyRevocationResult> {
  const saved = readKeyRevocation(io.storage, operation.context);
  if (!saved || !sameIntent(saved, operation)) throw new Error('storage');
  if (saved.state === 'confirmed') return { operation: saved, status: 'confirmed' };
  const status = await observe(io, operation);
  return status === 'absent' ? confirm(io.storage, operation) : { operation: saved, status };
}
/** Only called after an explicit Revoke/Retry click, under the same browser lock as inspect/acknowledge. */
export async function submitKeyRevocation(io: KeyRevocationIO, operation: KeyRevocation, retry = false): Promise<KeyRevocationResult> {
  parse(operation, operation.context);
  if (!io.current()) throw new Error('departed');
  const existing = readKeyRevocation(io.storage, operation.context);
  if (retry ? !existing || !sameIntent(existing, operation) : !!existing) throw new Error('pending');
  if (existing?.state === 'confirmed') return { operation: existing, status: 'confirmed' };
  const status = await observe(io, operation);
  if (status === 'unknown' || status === 'changed') throw new Error(status);
  if (!retry) claim(io.storage, operation);
  io.retained?.(operation);
  if (status === 'absent') return confirm(io.storage, operation);
  // Retain the target before DELETE, including when departure or a lost response interrupts observation.
  if (!io.current()) throw new Error('departed');
  try {
    const receipt = await io.revoke(operation.key.key_id, operation.context);
    if (revokedApiKey(receipt, operation.key.key_id, operation.context)) return confirm(io.storage, operation);
  } catch { /* A transport error is not evidence of failure. Reconcile with a read, without another DELETE. */ }
  if (!io.current()) return { operation, status: 'unknown' };
  return inspectKeyRevocation(io, operation);
}
