import { apiKeyHash, apiKeyList, apiKeyPrefix } from '../../api/apiKeyEvidence';
/** One freshly issued secret, scoped to the current account and this browser tab.
 * Account changes and logout discard it. Unscoped legacy values cannot be attributed safely.
 */
const STORAGE_KEY = 'ainize.issuedApiKey';
type HeldKey = { owner: string; key: string };
let owner: string | null = null;
let held: HeldKey | null = null;
// Preserve a pre-node-scoping secret until a fresh owned list proves its node; never use it speculatively.
let legacy: HeldKey | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function read(): HeldKey | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed.owner === 'string' && typeof parsed.key === 'string' ? parsed : null;
  } catch { return null; }
}
function persist(): void {
  try {
    if (held ?? legacy) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(held ?? legacy));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Private mode: retain only the current account's in-memory copy. */ }
}
/** A node switch is a different key context even when the account stays the same. */
export function issuedKeyScope(account: string, node: string | null | undefined): string {
  return account && node && /^0x[0-9a-f]{40}$/i.test(node) ? JSON.stringify([account, node.toLowerCase()]) : '';
}
export function forgetIssuedKeyByPrefix(forOwner: string, prefix: string): boolean {
  const key = recallIssuedKey(forOwner);
  if (!key || apiKeyPrefix(key) !== prefix) return false;
  forgetIssuedKey(forOwner);
  return true;
}
export function activateIssuedKeyOwner(next: string | null): void {
  const candidate = held ?? legacy ?? read();
  owner = next;
  held = next && candidate?.owner === next ? candidate : null;
  legacy = null;
  if (!held && next && candidate) {
    try {
      const scope: unknown = JSON.parse(next);
      if (Array.isArray(scope) && scope.length === 2 && candidate.owner === scope[0]) legacy = candidate;
    } catch { /* Legacy values without account ownership cannot be adopted. */ }
  }
  persist();
  notify();
}
export function adoptLegacyIssuedKey(forOwner: string, listing: unknown): boolean {
  if (!forOwner || forOwner !== owner || !legacy) return false;
  const keys = apiKeyList(listing);
  const hash = apiKeyHash(legacy.key);
  if (!keys?.keys.some((key) => key.key_id === hash && !key.disabled)) return false;
  const secret = legacy.key;
  legacy = null;
  return rememberIssuedKey(forOwner, secret);
}
export function rememberIssuedKey(forOwner: string, key: string): boolean {
  // A creation response can arrive after logout or an account switch.
  if (!forOwner || forOwner !== owner) return false;
  legacy = null;
  held = { owner: forOwner, key };
  persist();
  notify();
  return true;
}
export function recallIssuedKey(forOwner: string): string | null {
  return forOwner && forOwner === owner && held?.owner === forOwner ? held.key : null;
}
export function forgetIssuedKey(forOwner: string): void {
  if (forOwner !== owner) return;
  held = null;
  legacy = null;
  persist();
  notify();
}
export function subscribeIssuedKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
