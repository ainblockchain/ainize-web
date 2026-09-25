/**
 * The key a visitor just created, for as long as the tab is open.
 *
 * The node keeps only a hash, so a key exists exactly once: in the response that made it. To write it into the
 * snippet on the next render — which is the whole point of not making somebody retype it — the browser has to
 * hold it, and the honest options are all forms of "somewhere a script on this origin can read".
 *
 * `sessionStorage` is the narrowest of them that survives a refresh: this tab only, gone when it closes, never
 * sent anywhere. The page says it is there and offers to forget it, because a secret nobody knows is held is a
 * secret held badly. It is never put in `localStorage`: a key still sitting in a shared browser next month is a
 * different risk from one that ends with the tab.
 */
const STORAGE_KEY = 'ainize.issuedApiKey';

export function rememberIssuedKey(key: string): void {
  try { sessionStorage.setItem(STORAGE_KEY, key); } catch { /* private mode: it lives in memory for this render */ }
}

export function recallIssuedKey(): string | null {
  try { return sessionStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function forgetIssuedKey(): void {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* nothing to forget */ }
}
