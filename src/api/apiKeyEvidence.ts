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
  for (const key of value.keys) {
    if (!record(key) || typeof key.prefix !== 'string' || !/^[a-f0-9]{8}$/.test(key.prefix) || seen.has(key.prefix)
      || !(key.key_id === undefined || (typeof key.key_id === 'string' && /^[a-f0-9]{64}$/.test(key.key_id) && key.key_id.startsWith(key.prefix)))
      || !Number.isSafeInteger(key.issuedAt) || Number(key.issuedAt) < 0
      || !(key.label === null || (typeof key.label === 'string' && key.label.length <= 60))
      || !(key.org_id == null || (typeof key.org_id === 'string' && key.org_id.length > 0 && key.org_id.length <= 200))
      || !(key.disabled === undefined || typeof key.disabled === 'boolean')) return null;
    seen.add(key.prefix);
  }
  return value as { keys: ApiKeySummary[] };
}

/** Match the receipt to both the actual secret and the user's explicit selection. */
export function createdApiKey(value: unknown, label: string, orgId: string | null): string | null {
  if (!record(value) || typeof value.api_key !== 'string' || !/^ainize-sk-[A-Za-z0-9_-]{32}$/.test(value.api_key)
    || value.label !== label || value.org_id !== orgId || value.prefix !== apiKeyPrefix(value.api_key)) return null;
  return value.api_key;
}

/** A successful HTTP response alone is not evidence that the selected key was revoked. */
export function revokedApiKey(value: unknown, prefix: string): boolean {
  return record(value) && value.revoked === true && value.prefix === prefix;
}
