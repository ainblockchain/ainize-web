import type { InfoResponse } from '../api/types';
export interface ChainSetupContext { node: string; provider: string; chain_id: number; app: string }
export interface ChainSetupOperation { version: 1; id: string; context: ChainSetupContext; actor: string; state: 'running' | 'verified' | 'unconfirmed'; created_at: number; updated_at: number; created: boolean | null; tx: string | null; admin: string | null; error: string | null }
export interface ChainSetupStatus { version: 1; capabilities: { exact_request_status: true; reviewed_selection: true }; context: ChainSetupContext; verification: { valid: boolean; errors: string[] } | null; read_error: string | null; operation: ChainSetupOperation | null }
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const address = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
export const chainSetupRequestId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
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
export function readChainSetup(raw: unknown, expected: ChainSetupContext, requestedId?: string): ChainSetupStatus | null {
  if (!object(raw) || raw.version !== 1 || raw.capabilities?.reviewed_selection !== true || raw.capabilities?.exact_request_status !== true || !contextValid(raw.context) || chainSetupKey(raw.context) !== chainSetupKey(expected)
    || raw.read_error !== null && typeof raw.read_error !== 'string') return null;
  const v = raw.verification, op = raw.operation;
  if (requestedId !== undefined && (!chainSetupRequestId(requestedId) || !op || op.id !== requestedId)) return null;
  if (v !== null && (!object(v) || typeof v.valid !== 'boolean' || !Array.isArray(v.errors) || !v.errors.every((e: unknown) => typeof e === 'string') || v.valid !== (v.errors.length === 0))) return null;
  if (v === null && !raw.read_error || v !== null && raw.read_error !== null) return null;
  if (op !== null && (!object(op) || op.version !== 1 || !chainSetupRequestId(op.id) || !contextValid(op.context) || chainSetupKey(op.context) !== chainSetupKey(expected)
    || !address(op.actor) || !['running', 'verified', 'unconfirmed'].includes(op.state)
    || !Number.isSafeInteger(op.created_at) || op.created_at < 0 || !Number.isSafeInteger(op.updated_at) || op.updated_at < op.created_at
    || ![true, false, null].includes(op.created) || op.tx !== null && typeof op.tx !== 'string'
    || op.admin !== null && !address(op.admin) || op.error !== null && typeof op.error !== 'string')) return null;
  const context = { node: raw.context.node, provider: raw.context.provider, chain_id: raw.context.chain_id, app: raw.context.app };
  return { version: 1, capabilities: { exact_request_status: true, reviewed_selection: true }, context,
    verification: v === null ? null : { valid: v.valid, errors: [...v.errors] }, read_error: raw.read_error,
    operation: op === null ? null : { version: 1, id: op.id, context: { node: op.context.node, provider: op.context.provider, chain_id: op.context.chain_id, app: op.context.app }, actor: op.actor,
      state: op.state, created_at: op.created_at, updated_at: op.updated_at, created: op.created, tx: op.tx, admin: op.admin, error: op.error },
  };
}
export class ChainSetupActionError extends Error {
  constructor(readonly code: 'changed' | 'read' | 'unconfirmed') { super(code); }
}
export async function prepareAccountChain(expected: ChainSetupContext, retryOf: string | null, deps: {
  current: () => boolean; actor: string; requestId: () => string; read: () => Promise<unknown>;
  retain: (id: string) => void | Promise<void>; readRequest: (id: string) => Promise<unknown>;
  write: (body: { request_id: string; expected: ChainSetupContext; expected_request: string | null; retry_of?: string }) => Promise<unknown>;
}): Promise<ChainSetupStatus | null> {
  if (!deps.current()) return null;
  if (!address(deps.actor)) throw new ChainSetupActionError('changed');
  const before = readChainSetup(await deps.read(), expected);
  if (!deps.current()) return null;
  if (!before?.verification) throw new ChainSetupActionError('read');
  if (before.operation?.state === 'running') throw new ChainSetupActionError('changed');
  if (before.verification.valid) return before;
  if ((before.operation?.state === 'unconfirmed' ? before.operation.id : null) !== retryOf) throw new ChainSetupActionError('changed');
  const request_id = deps.requestId(); if (!chainSetupRequestId(request_id) || request_id === before.operation?.id) throw new ChainSetupActionError('read');
  // Keep the exact ID in navigation before a request can reach the server. A reload can inspect the same ID.
  await deps.retain(request_id);
  if (!deps.current()) return null;
  let acknowledged: ChainSetupStatus | null = null;
  try {
    acknowledged = readChainSetup(await deps.write({ request_id, expected, expected_request: before.operation?.id ?? null, ...(retryOf ? { retry_of: retryOf } : {}) }), expected, request_id);
  } catch { /* A failed reply is not proof the request was not admitted. Never write twice. */ }
  if (!deps.current()) return null;
  const after = readChainSetup(await deps.readRequest(request_id).catch(() => null), expected, request_id);
  if (!deps.current()) return null;
  if (!after || after.operation?.actor.toLowerCase() !== deps.actor.toLowerCase()) throw new ChainSetupActionError('unconfirmed');
  const result = reconcileChainSetup(acknowledged, after, expected, request_id);
  if (!result) throw new ChainSetupActionError('unconfirmed');
  return result;
}

/** Preserve a completed journal entry across out-of-order reads, but always use the newly read rule state. */
export function reconcileChainSetup(previous: unknown, incoming: unknown, expected: ChainSetupContext, requestedId: string): ChainSetupStatus | null {
  const after = readChainSetup(incoming, expected, requestedId), before = readChainSetup(previous, expected, requestedId);
  if (!after) return null;
  if (!before) return after;
  const a = before.operation!, b = after.operation!;
  if (a.actor.toLowerCase() !== b.actor.toLowerCase() || a.created_at !== b.created_at || chainSetupKey(a.context) !== chainSetupKey(b.context)) return null;
  if (a.state !== 'running' && b.state !== 'running' &&
    (a.state !== b.state || a.updated_at !== b.updated_at || a.created !== b.created || a.tx !== b.tx || a.admin !== b.admin || a.error !== b.error)) return null;
  return a.state !== 'running' || b.updated_at < a.updated_at ? { ...after, operation: a } : after;
}

export type ChainSetupSelection = { kind: 'current' } | { kind: 'request'; id: string } | { kind: 'invalid' };
export function chainSetupSelection(params: URLSearchParams): ChainSetupSelection {
  const ids = params.getAll('chainRequest');
  if (!ids.length) return { kind: 'current' };
  return ids.length === 1 && chainSetupRequestId(ids[0]) ? { kind: 'request', id: ids[0] } : { kind: 'invalid' };
}
export function chainSetupLink(params: URLSearchParams, id: string | null) {
  if (id !== null && !chainSetupRequestId(id)) throw new Error('invalid setup request ID');
  const next = new URLSearchParams(params);
  next.delete('chainRequest'); if (id !== null) next.set('chainRequest', id);
  return { pathname: '/account', search: next.size ? '?' + next : '', hash: '#chain-setup' };
}
