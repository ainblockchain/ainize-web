import type { InfoResponse } from '../api/types';
export interface WalletSendContext { node: string; rpc_url: string; chain_id: number; gas_price: number }
export interface WalletSendReceipt {
  version: 1; id: string; context: WalletSendContext; actor: string; to: string; amount: string;
  currency: 'AIN'; tx_hash: string; state: 'prepared' | 'submitted' | 'confirmed' | 'rejected' | 'cancelled'; created_at: number; updated_at: number;
}
export interface WalletSendStatus { version: 1; context: WalletSendContext; operation: WalletSendReceipt | null; read_error: string | null }
export interface WalletSendHistory { version: 1; context: WalletSendContext; cursor: string | null; items: WalletSendReceipt[]; next_cursor: string | null }
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const sendAddress = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
export const walletSendRequestId = id;
export const walletSendHistoryCursor = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(v);
export const walletSendContextKey = (c: WalletSendContext) => JSON.stringify([c.node.toLowerCase(), c.rpc_url, c.chain_id, c.gas_price]);
const contextValid = (v: unknown): v is WalletSendContext => {
  if (!object(v) || !sendAddress(v.node) || !Number.isSafeInteger(v.chain_id) || v.chain_id < 0 || !Number.isFinite(v.gas_price) || v.gas_price < 0) return false;
  try { const u = new URL(v.rpc_url); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password && !u.hash; } catch { return false; }
};
export function walletSendContext(info: InfoResponse): WalletSendContext | null {
  try {
    if (info.ledger.kind !== 'ain' || !info.ledger.provider) return null;
    const provider = new URL(info.ledger.provider);
    if (provider.username || provider.password) return null;
    const context = { node: info.node.address, rpc_url: provider.origin + '/json-rpc', chain_id: info.node.chain_id, gas_price: 0 };
    return contextValid(context) ? context : null;
  } catch { return null; }
}
export function walletSendAmount(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,6})?$/.test(raw)) return null;
  const canonical = raw.includes('.') ? raw.replace(/0+$/, '').replace(/\.$/, '') : raw;
  const value = Number(canonical);
  return value > 0 && value <= Number.MAX_SAFE_INTEGER && String(value) === canonical ? canonical : null;
}
export const walletSendPending = (op: WalletSendReceipt | null) => op?.state === 'prepared' || op?.state === 'submitted';
export function readWalletSend(raw: unknown, expected: WalletSendContext): WalletSendStatus | null {
  if (!object(raw) || raw.version !== 1 || !contextValid(raw.context) || walletSendContextKey(raw.context) !== walletSendContextKey(expected)
    || raw.read_error !== null && typeof raw.read_error !== 'string') return null;
  const op = raw.operation;
  // A previous chain's unresolved request must remain visible; its context is shown and submission is disabled.
  if (op !== null && (!object(op) || op.version !== 1 || !id(op.id) || !contextValid(op.context) || op.context.node.toLowerCase() !== expected.node.toLowerCase()
    || !sendAddress(op.actor) || !sendAddress(op.to) || op.to.toLowerCase() === expected.node.toLowerCase() || typeof op.amount !== 'string' || walletSendAmount(op.amount) !== op.amount
    || op.currency !== 'AIN' || typeof op.tx_hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(op.tx_hash)
    || !['prepared', 'submitted', 'confirmed', 'rejected', 'cancelled'].includes(op.state)
    || !Number.isSafeInteger(op.created_at) || op.created_at < 0 || !Number.isSafeInteger(op.updated_at) || op.updated_at < op.created_at
    || 'signature' in op || 'tx_body' in op)) return null;
  return raw as WalletSendStatus;
}
export function readWalletSendHistory(raw: unknown, expected: WalletSendContext, cursor: string | null, limit = 20): WalletSendHistory | null {
  if (!object(raw) || raw.version !== 1 || !contextValid(raw.context) || walletSendContextKey(raw.context) !== walletSendContextKey(expected)
    || raw.cursor !== cursor || !Array.isArray(raw.items) || raw.items.length > limit
    || raw.next_cursor !== null && (!walletSendHistoryCursor(raw.next_cursor) || raw.next_cursor === cursor || raw.items.length !== limit)) return null;
  const ids = new Set<string>(); let previous: WalletSendReceipt | null = null;
  for (const op of raw.items) {
    if (!op || !readWalletSend({ version: 1, context: raw.context, operation: op, read_error: null }, expected)
      || ids.has(op.id) || previous && (op.created_at > previous.created_at || op.created_at === previous.created_at && op.id >= previous.id)) return null;
    ids.add(op.id); previous = op;
  }
  return raw as WalletSendHistory;
}
export type WalletSendAction = { kind: 'prepare'; request_id: string; to: string; amount: string } | { kind: 'submit' | 'cancel'; operation: WalletSendReceipt };
const receiptKey = (op: WalletSendReceipt) => JSON.stringify([op.id, walletSendContextKey(op.context), op.actor.toLowerCase(), op.to.toLowerCase(), op.amount, op.tx_hash, op.state, op.created_at, op.updated_at]);
export class WalletSendActionError extends Error { constructor(readonly code: 'changed' | 'read' | 'unconfirmed' | 'not_submitted' | 'prepare_failed') { super(code); } }
/** At most one write per deliberate action; recovery is a read, never a fallback to legacy send. */
export async function actOnWalletSend(context: WalletSendContext, action: WalletSendAction, deps: {
  current(): boolean; read(): Promise<unknown>;
  write(action: WalletSendAction, context: WalletSendContext): Promise<unknown>;
}): Promise<WalletSendStatus | null> {
  if (!deps.current()) return null;
  const before = readWalletSend(await deps.read(), context);
  if (!deps.current()) return null;
  if (!before) throw new WalletSendActionError('read');
  if (action.kind === 'prepare') {
    if (walletSendPending(before.operation) || !id(action.request_id) || !sendAddress(action.to) || action.to.toLowerCase() === context.node.toLowerCase() || walletSendAmount(action.amount) !== action.amount) throw new WalletSendActionError('changed');
  } else if (!before.operation || receiptKey(before.operation) !== receiptKey(action.operation) || before.operation.state !== 'prepared'
    || action.kind === 'submit' && walletSendContextKey(before.operation.context) !== walletSendContextKey(context)) throw new WalletSendActionError('changed');
  const requestId = action.kind === 'prepare' ? action.request_id : action.operation.id;
  try { await deps.write(action, context); } catch { /* A lost response can still have committed. Inspect the server journal once. */ }
  if (!deps.current()) return null;
  const after = readWalletSend(await deps.read().catch(() => null), context), op = after?.operation;
  if (!deps.current()) return null;
  if (action.kind === 'prepare' && after && (!op || op.id !== requestId)) throw new WalletSendActionError('prepare_failed');
  if (action.kind === 'submit' && op?.id === requestId && op.state === 'prepared') throw new WalletSendActionError('not_submitted');
  if (!op || op.id !== requestId || action.kind === 'prepare' && (op.to.toLowerCase() !== action.to.toLowerCase() || op.amount !== action.amount)
    || action.kind !== 'prepare' && (op.tx_hash !== action.operation.tx_hash || op.to !== action.operation.to || op.amount !== action.operation.amount || op.actor !== action.operation.actor || walletSendContextKey(op.context) !== walletSendContextKey(action.operation.context))
    || action.kind === 'submit' && op.state === 'prepared' || action.kind === 'cancel' && op.state === 'prepared') throw new WalletSendActionError('unconfirmed');
  return after;
}
