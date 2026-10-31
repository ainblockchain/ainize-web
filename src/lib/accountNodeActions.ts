import type { RuntimeResponse } from '../api/types';
import { networkNodes } from './networkView';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export const trimEndpoint = (v: string) => v.trim().replace(/\/+$/, '');
export function peerEndpoint(raw: string): string | null {
  const text = trimEndpoint(raw);
  try { const url = new URL(text); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash && !/[\s\\]/.test(text) ? text : null; }
  catch { return null; }
}
export function accountPeers(raw: unknown) {
  const source = networkNodes(raw); if (!source) return null;
  const nodes = { ...source, peers: source.peers.map(p => ({ ...p, endpoint: p.endpoint ?? null, address: p.address ?? null })) };
  const endpoints = nodes.peers.map(p => p.endpoint === null ? null : trimEndpoint(p.endpoint)).filter((v): v is string => v !== null);
  return endpoints.every(Boolean) && new Set(endpoints).size === endpoints.length ? nodes : null;
}
export function accountRuntime(raw: unknown): RuntimeResponse | null {
  if (!object(raw) || typeof raw.available !== 'boolean' || typeof raw.hook !== 'boolean'
    || ['api', 'model', 'error'].some(k => raw[k] != null && typeof raw[k] !== 'string') || !Array.isArray(raw.applied)) return null;
  const ids = new Set<string>();
  for (const id of raw.applied) {
    if (typeof id !== 'string' || !id || ids.has(id)) return null;
    ids.add(id);
  }
  // The endpoint derives both arrays from one ordered stack. A mismatch is not an empty model.
  if (raw.stack !== undefined) {
    if (!Array.isArray(raw.stack) || raw.stack.length !== raw.applied.length) return null;
    for (const [index, layer] of raw.stack.entries()) {
      if (!object(layer) || layer.patch_id !== raw.applied[index] || typeof layer.sha256 !== 'string' || !layer.sha256
        || typeof layer.reason !== 'string' || !Number.isSafeInteger(layer.applied_at) || layer.applied_at < 0 || layer.applied_at > 8.64e15
        || !Number.isSafeInteger(layer.position) || layer.position < 0) return null;
    }
  }
  return raw as RuntimeResponse;
}
export class NodeActionError extends Error {
  constructor(readonly code: 'endpoint' | 'read' | 'missing' | 'unconfirmed' | 'prompt' | 'response') { super(code); }
}

/** One task per mounted account/context; no automatic write or inference retries. */
export function createNodeActionTask() {
  let busy = false, generation = 0;
  return {
    pending: () => busy,
    abandon() { generation++; busy = false; },
    async run<T>(active: () => boolean, action: (current: () => boolean) => Promise<T | null>): Promise<T | null> {
      if (busy || !active()) return null;
      busy = true; const id = ++generation;
      const current = () => generation === id && active();
      try { const result = await action(current); return current() ? result : null; }
      finally { if (generation === id) busy = false; }
    },
  };
}

export async function changeAccountPeer(kind: 'add' | 'remove', raw: string, deps: {
  current: () => boolean; read: () => Promise<unknown>; write: (endpoint: string) => Promise<unknown>;
}) {
  const endpoint = kind === 'add' ? peerEndpoint(raw) : trimEndpoint(raw);
  if (!endpoint) throw new NodeActionError('endpoint');
  if (!deps.current()) return null;
  const before = accountPeers(await deps.read());
  if (!deps.current()) return null;
  if (!before) throw new NodeActionError('read');
  const present = before.peers.some(p => p.endpoint !== null && trimEndpoint(p.endpoint) === endpoint);
  if (kind === 'add' && present) return { endpoint, already: true };
  if (kind === 'remove' && !present) throw new NodeActionError('missing');
  const answer = await deps.write(endpoint);
  if (!deps.current()) return null;
  if (!object(answer) || answer.ok !== true || kind === 'remove' && (answer.removed !== true || answer.blocked !== true)) throw new NodeActionError('unconfirmed');
  let after;
  try { after = accountPeers(await deps.read()); } catch { throw new NodeActionError('unconfirmed'); }
  if (!deps.current()) return null;
  if (!after || after.peers.some(p => p.endpoint !== null && trimEndpoint(p.endpoint) === endpoint) !== (kind === 'add')) throw new NodeActionError('unconfirmed');
  return { endpoint, already: false };
}

export async function askAccountRuntime(prompt: string, deps: { current: () => boolean; send: (body: { prompt: string; max_tokens: number }) => Promise<unknown> }) {
  if (!prompt.trim() || prompt.length > 2000) throw new NodeActionError('prompt');
  if (!deps.current()) return null;
  const value = await deps.send({ prompt, max_tokens: 16 });
  if (!deps.current()) return null;
  if (!object(value) || typeof value.text !== 'string') throw new NodeActionError('response');
  return { prompt, text: value.text };
}
