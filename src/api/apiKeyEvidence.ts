import { sha256 } from '@noble/hashes/sha2';
import type { ApiKeySummary } from './types';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function apiKeyHash(secret: string): string {
  return Array.from(sha256(new TextEncoder().encode(secret)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export const apiKeyPrefix = (secret: string): string => apiKeyHash(secret).slice(0, 8);

/** A malformed or ambiguous list is not an empty list and must not enable key mutations. */
export function apiKeyList(value: unknown): { keys: ApiKeySummary[] } | null {
  if (!record(value) || !Array.isArray(value.keys)) return null;
  const seen = new Set<string>();
  const prefixes = new Map<string, boolean>();
  for (const key of value.keys) {
    if (!record(key) || typeof key.prefix !== 'string' || !/^[a-f0-9]{8}$/.test(key.prefix)
      || !(key.key_id === undefined || (typeof key.key_id === 'string' && /^[a-f0-9]{64}$/.test(key.key_id) && key.key_id.startsWith(key.prefix)))
      || !Number.isSafeInteger(key.issuedAt) || Number(key.issuedAt) < 0
      || !(key.label === null || (typeof key.label === 'string' && key.label.length <= 60))
      || !(key.org_id == null || (typeof key.org_id === 'string' && key.org_id.length > 0 && key.org_id.length <= 200))
      || !(key.disabled === undefined || typeof key.disabled === 'boolean')) return null;
    const id = String(key.key_id ?? key.prefix);
    if (seen.has(id)) return null;
    // A short identifier cannot coexist with another key sharing that prefix.
    if (prefixes.has(key.prefix) && (!key.key_id || prefixes.get(key.prefix))) return null;
    prefixes.set(key.prefix, !key.key_id);
    seen.add(id);
  }
  return value as { keys: ApiKeySummary[] };
}

/** Match the receipt to both the actual secret and the user's explicit selection. */
export function createdApiKey(value: unknown, label: string, orgId: string | null, context?: ApiKeyContext | null): string | null {
  if (!record(value) || typeof value.api_key !== 'string' || !/^ainize-sk-[A-Za-z0-9_-]{32}$/.test(value.api_key)
    || (context !== undefined && (!context || !matchesContext(value, context) || value.key_id !== apiKeyHash(value.api_key)))
    || value.label !== label || value.org_id !== orgId || value.prefix !== apiKeyPrefix(value.api_key)) return null;
  return value.api_key;
}

/** A successful HTTP response alone is not evidence that the selected key was revoked. */
export function revokedApiKey(value: unknown, id: string, context?: ApiKeyContext | null): boolean {
  if (!record(value) || value.revoked !== true || (context !== undefined && (!context || !matchesContext(value, context)))) return false;
  return /^[a-f0-9]{64}$/.test(id) ? value.key_id === id && value.prefix === id.slice(0, 8) : /^[a-f0-9]{8}$/.test(id) && value.prefix === id;
}

export type ApiKeyContext = { node: string; owner: string };
export function apiKeyContext(node: string | null, owner: string | null): ApiKeyContext | null {
  return node && /^0x[0-9a-f]{40}$/i.test(node) && owner ? { node: node.toLowerCase(), owner: owner.toLowerCase() } : null;
}
function matchesContext(value: Record<string, unknown>, expected: ApiKeyContext): boolean {
  return value.version === 1 && value.node === expected.node && value.owner === expected.owner;
}
export function apiKeySnapshot(value: unknown, context: ApiKeyContext | null): { keys: ApiKeySummary[] } | null {
  if (!context || !record(value) || !matchesContext(value, context) || value.complete !== true) return null;
  const listing = apiKeyList(value);
  return listing && listing.keys.every((key) => key.key_id && typeof key.disabled === 'boolean' && key.org_id !== undefined) ? listing : null;
}
export const apiKeyId = (key: ApiKeySummary): string => key.key_id ?? key.prefix;
export const apiKeyExpected = (context: ApiKeyContext) => ({ expected_owner: context.owner, expected_node: context.node });

/** A fresh complete list may disable use without destroying the only copy of a suspended key. */
export function heldApiKeyState(secret: string, receivedAt: number, value: unknown, context: ApiKeyContext | null, readStartedAt?: number): 'ready' | 'checking' | 'disabled' | 'revoked' {
  const listing = apiKeySnapshot(value, context);
  // A GET started before (or in the same millisecond as) creation cannot prove that new key is absent.
  if (!listing || !Number.isFinite(readStartedAt)) return 'checking';
  const key = listing.keys.find((candidate) => candidate.key_id === apiKeyHash(secret));
  if (key) return key.disabled ? 'disabled' : 'ready';
  return readStartedAt! <= receivedAt ? 'checking' : 'revoked';
}

/** Read-only preflight immediately before a key-authenticated model call. */
export async function confirmApiKeyForCall(secret: string, context: ApiKeyContext | null, load: () => Promise<unknown>, current: () => boolean): Promise<void> {
  if (!current()) throw new DOMException('view changed', 'AbortError');
  let value: unknown;
  try { value = await load(); } catch { throw new Error('key_unavailable'); }
  if (!current()) throw new DOMException('view changed', 'AbortError');
  const snapshot = apiKeySnapshot(value, context);
  const key = snapshot?.keys.find((entry) => entry.key_id === apiKeyHash(secret));
  if (!key || key.disabled) throw new Error('key_unavailable');
}
