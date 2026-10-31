import type { InfoResponse } from '../api/types';
export interface ChainSetupContext { node: string; provider: string; chain_id: number; app: string }
export interface ChainSetupOperation { version: 1; id: string; context: ChainSetupContext; actor: string; state: 'running' | 'verified' | 'unconfirmed'; created_at: number; updated_at: number; created: boolean | null; tx: string | null; admin: string | null; error: string | null }
export interface ChainSetupStatus { version: 1; capabilities: { exact_request_status: true; reviewed_selection: true }; context: ChainSetupContext; verification: { valid: boolean; errors: string[] } | null; read_error: string | null; operation: ChainSetupOperation | null }
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const address = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const contextValid = (v: unknown): v is ChainSetupContext => object(v) && address(v.node) && typeof v.provider === 'string' && Number.isSafeInteger(v.chain_id) && v.chain_id >= 0 && v.app === '/apps/knowledge';
export const chainSetupKey = (c: ChainSetupContext) => JSON.stringify([c.node.toLowerCase(), c.provider, c.chain_id, c.app]);
export function chainSetupContext(info: InfoResponse): ChainSetupContext | null {
  try {
    if (info.ledger.kind !== 'ain' || !info.ledger.provider) return null;
    const provider = new URL(info.ledger.provider);
    if (!['http:', 'https:'].includes(provider.protocol) || provider.username || provider.password) return null;
    const c = { node: info.node.address, provider: provider.origin, chain_id: info.node.chain_id, app: info.ledger.app };
    return contextValid(c) ? c : null;
  } catch { return null; }
}
export function readChainSetup(raw: unknown, expected: ChainSetupContext): ChainSetupStatus | null {
  if (!object(raw) || raw.version !== 1 || raw.capabilities?.reviewed_selection !== true || raw.capabilities?.exact_request_status !== true || !contextValid(raw.context) || chainSetupKey(raw.context) !== chainSetupKey(expected)
    || raw.read_error !== null && typeof raw.read_error !== 'string') return null;
  const v = raw.verification, op = raw.operation;
  if (v !== null && (!object(v) || typeof v.valid !== 'boolean' || !Array.isArray(v.errors) || !v.errors.every((e: unknown) => typeof e === 'string') || v.valid !== (v.errors.length === 0))) return null;
  if (v === null && !raw.read_error || v !== null && raw.read_error !== null) return null;
  if (op !== null && (!object(op) || op.version !== 1 || !id(op.id) || !contextValid(op.context) || chainSetupKey(op.context) !== chainSetupKey(expected)
    || !address(op.actor) || !['running', 'verified', 'unconfirmed'].includes(op.state)
    || !Number.isSafeInteger(op.created_at) || op.created_at < 0 || !Number.isSafeInteger(op.updated_at) || op.updated_at < op.created_at
    || ![true, false, null].includes(op.created) || op.tx !== null && typeof op.tx !== 'string'
    || op.admin !== null && !address(op.admin) || op.error !== null && typeof op.error !== 'string')) return null;
  return raw as ChainSetupStatus;
}
export class ChainSetupActionError extends Error {
  constructor(readonly code: 'changed' | 'read' | 'unconfirmed') { super(code); }
}
export async function prepareAccountChain(expected: ChainSetupContext, retryOf: string | null, deps: {
  current: () => boolean; requestId: () => string; read: () => Promise<unknown>;
  write: (body: { request_id: string; expected: ChainSetupContext; expected_request: string | null; retry_of?: string }) => Promise<unknown>;
}): Promise<ChainSetupStatus | null> {
  if (!deps.current()) return null;
  const before = readChainSetup(await deps.read(), expected);
  if (!deps.current()) return null;
  if (!before?.verification) throw new ChainSetupActionError('read');
  if (before.verification.valid) return before;
  if (before.operation?.state === 'running' || (before.operation?.state === 'unconfirmed' ? before.operation.id : null) !== retryOf) throw new ChainSetupActionError('changed');
  const request_id = deps.requestId(); if (!id(request_id)) throw new ChainSetupActionError('read');
  try {
    const reply = readChainSetup(await deps.write({ request_id, expected, expected_request: before.operation?.id ?? null, ...(retryOf ? { retry_of: retryOf } : {}) }), expected);
    if (!deps.current()) return null;
    if (reply?.operation?.id !== request_id) throw new ChainSetupActionError('unconfirmed');
  } catch {
    if (!deps.current()) return null;
    // Read-only recovery of the saved request, never a second POST.
    const recovered = await deps.read().catch(() => null);
    if (!deps.current()) return null;
    const status = readChainSetup(recovered, expected);
    if (status?.operation?.id === request_id) return status;
    throw new ChainSetupActionError('unconfirmed');
  }
  const after = readChainSetup(await deps.read().catch(() => null), expected);
  if (!deps.current()) return null;
  if (!after || after.operation?.id !== request_id) throw new ChainSetupActionError('unconfirmed');
  return after;
}
