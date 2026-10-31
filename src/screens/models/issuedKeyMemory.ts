import { apiKeyHash, apiKeyList, apiKeyPrefix } from '../../api/apiKeyEvidence';
/** One freshly issued secret, scoped to the current account and this browser tab.
 * Account changes and logout discard it. Unscoped legacy values cannot be attributed safely.
 */
const STORAGE_KEY = 'ainize.issuedApiKey';
const CANDIDATE_KEY = 'ainize.keyCandidates.v1';
type Candidate = { owner: string; id: string; key: string };
let candidates: Candidate[] = [];
type HeldKey = { owner: string; key: string; receivedAt: number };
let owner: string | null = null;
let held: HeldKey | null = null;
// Preserve a pre-node-scoping secret until a fresh owned list proves its node; never use it speculatively.
let legacy: HeldKey | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function read(): HeldKey | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    return parsed && typeof parsed.owner === 'string' && typeof parsed.key === 'string' ? { owner: parsed.owner, key: parsed.key, receivedAt: 0 } : null;
  } catch { return null; }
}
function persist(): void {
  try {
    if (held ?? legacy) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(held ?? legacy));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Private mode: retain only the current account's in-memory copy. */ }
}
function persistCandidates(): void {
  try {
    if (candidates.length) sessionStorage.setItem(CANDIDATE_KEY, JSON.stringify(candidates));
    else sessionStorage.removeItem(CANDIDATE_KEY);
  } catch { /* Keep this tab's in-memory copy when session storage is unavailable. */ }
}
/** Quarantined secrets are never returned by recallIssuedKey or inserted into snippets. */
export function retainKeyCandidate(forOwner: string, id: string, value: unknown): boolean {
  const key = (value as { api_key?: unknown } | null)?.api_key;
  if (!forOwner || owner !== forOwner || !/^[a-f0-9]{32}$/.test(id) || typeof key !== 'string' || !/^ainize-sk-[A-Za-z0-9_-]{32}$/.test(key)) return false;
  const existing = candidates.find(candidate => candidate.id === id);
  if (existing) return existing.key === key;
  candidates.push({ owner: forOwner, id, key }); persistCandidates();
  return true;
}
export function confirmKeyCandidate(forOwner: string, id: string, keyId: string): boolean {
  if (!forOwner || owner !== forOwner) return false;
  if (held && apiKeyHash(held.key) === keyId) { discardKeyCandidate(forOwner, id); return true; }
  const candidate = candidates.find(value => value.id === id && value.owner === forOwner && apiKeyHash(value.key) === keyId);
  // Never replace the only visible copy of another secret, including a legacy secret awaiting its node proof.
  if (!candidate || held || legacy || !rememberIssuedKey(forOwner, candidate.key)) return false;
  discardKeyCandidate(forOwner, id);
  return true;
}
export function discardKeyCandidate(forOwner: string, id: string): void {
  if (owner !== forOwner) return;
  candidates = candidates.filter(candidate => candidate.id !== id);
  persistCandidates();
}
/** A node switch is a different key context even when the account stays the same. */
export function issuedKeyScope(account: string, node: string | null | undefined): string {
  return account && node && /^0x[0-9a-f]{40}$/i.test(node) ? JSON.stringify([account, node.toLowerCase()]) : '';
}
export function forgetIssuedKeyById(forOwner: string, id: string): boolean {
  const key = recallIssuedKey(forOwner);
  if (!key || (/^[a-f0-9]{64}$/.test(id) ? apiKeyHash(key) !== id : apiKeyPrefix(key) !== id)) return false;
  forgetIssuedKey(forOwner);
  return true;
}
export function activateIssuedKeyOwner(next: string | null): void {
  const candidate = held ?? legacy ?? read();
  owner = next;
  if (!candidates.length) {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem(CANDIDATE_KEY) ?? '[]');
      if (Array.isArray(saved)) candidates = saved.filter((value): value is Candidate => !!value && value.owner === next && typeof value.id === 'string'
        && /^[a-f0-9]{32}$/.test(value.id) && typeof value.key === 'string' && /^ainize-sk-[A-Za-z0-9_-]{32}$/.test(value.key))
        .map(value => ({ owner: value.owner, id: value.id, key: value.key }));
    } catch { /* Unattributable secrets cannot be used. */ }
  }
  candidates = next ? candidates.filter(candidate => candidate.owner === next) : [];
  persistCandidates();
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
  return rememberIssuedKey(forOwner, secret, 0);
}
export function rememberIssuedKey(forOwner: string, key: string, receivedAt = Date.now()): boolean {
  // A creation response can arrive after logout or an account switch.
  if (!forOwner || forOwner !== owner) return false;
  legacy = null;
  held = { owner: forOwner, key, receivedAt };
  persist();
  notify();
  return true;
}
export function recallIssuedKeyRecord(forOwner: string): Readonly<HeldKey> | null {
  return forOwner && forOwner === owner && held?.owner === forOwner ? held : null;
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
