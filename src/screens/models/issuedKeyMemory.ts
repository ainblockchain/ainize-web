/** One freshly issued secret, scoped to the current account and this browser tab.
 * Account changes and logout discard it. Unscoped legacy values cannot be attributed safely.
 */
const STORAGE_KEY = 'ainize.issuedApiKey';
type HeldKey = { owner: string; key: string };
let owner: string | null = null;
let held: HeldKey | null = null;
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
    if (held) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(held));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* Private mode: retain only the current account's in-memory copy. */ }
}
export function activateIssuedKeyOwner(next: string | null): void {
  const candidate = held ?? read();
  owner = next;
  held = next && candidate?.owner === next ? candidate : null;
  persist();
  notify();
}
export function rememberIssuedKey(forOwner: string, key: string): boolean {
  // A creation response can arrive after logout or an account switch.
  if (!forOwner || forOwner !== owner) return false;
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
  persist();
  notify();
}
export function subscribeIssuedKey(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
