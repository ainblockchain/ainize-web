/**
 * AIN Wallet (Chrome extension) as a teaching identity.
 *
 * The extension injects `window.ainetwork` and exposes `getAddress()` and `signMessage(message)`
 * (https://docs.ainetwork.ai/ain-wallet/ain-wallet-api). It does NOT hand out the private key, and it should not.
 *
 * WHY THIS DOES NOT SIGN EVERY REQUEST. `signMessage` is a user-facing prompt. Every teach and live-test call
 * carries a signature, and polling a running lesson makes several a minute — signing each one would put a
 * confirmation dialog between the visitor and the page, permanently. So the wallet signs ONCE: a delegation
 * (`@ainize/core` `delegateMessage`) authorising a browser key generated here to act as the wallet's address for
 * a bounded window. Requests are signed by that browser key, as they always were, and carry the delegation
 * alongside. The node checks it names that node, that key and an unexpired window.
 *
 * WHAT IS CHECKED BEFORE THE SESSION IS STORED, and why it is checked here rather than left to the node:
 *
 *   1. The wallet's signature is RECOVERED locally and must come back as the address the wallet claims. The
 *      extension is a different codebase signing with a different library; if its personal-message format ever
 *      diverges from `ain-util`'s, every later request fails with an opaque 401 on a route that has nothing to do
 *      with signing. Verified here, the failure is "your wallet's signature did not match its own address",
 *      at the moment the person pressed the button.
 *   2. `getAddress()` must return an address at all. An extension that is installed but locked returns nothing,
 *      and "nothing" must not become a session keyed to `undefined`.
 */
import { delegateMessage, DELEGATION_MAX_MS } from '@ainize/core/browser';
import { addressOf, hashMessage, isAddress, randomPrivateKey, toChecksumAddress } from './teacherKey';
import * as secp from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

interface AinWalletProvider {
  getAddress?: () => Promise<string>;
  getAccount?: () => Promise<{ address?: string }>;
  signMessage?: (message: string) => Promise<string>;
}
declare global { interface Window { ainetwork?: AinWalletProvider } }

const provider = (): AinWalletProvider | null => (typeof window === 'undefined' ? null : window.ainetwork ?? null);

/** Is the extension present AND able to do the two things we need? */
export function hasAinWallet(): boolean {
  const p = provider();
  return !!p && typeof p.signMessage === 'function' && (typeof p.getAddress === 'function' || typeof p.getAccount === 'function');
}

/**
 * The extension is injected asynchronously, so a check on first paint can be a false negative. Resolves as soon as
 * it appears, or false after `timeoutMs` — a bounded wait, never a spinner that never ends.
 */
export function whenAinWallet(timeoutMs = 3000): Promise<boolean> {
  if (hasAinWallet()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const id = setInterval(() => {
      if (hasAinWallet()) { clearInterval(id); resolve(true); }
      else if (Date.now() - started > timeoutMs) { clearInterval(id); resolve(false); }
    }, 150);
  });
}

export async function walletAddress(): Promise<string | null> {
  const p = provider();
  if (!p) return null;
  const a = (await p.getAddress?.().catch(() => null)) ?? (await p.getAccount?.().catch(() => null))?.address ?? null;
  return isAddress(a) ? toChecksumAddress(a) : null;
}

/**
 * Address that produced `signature` over `message`, in ain-util's format (`0x ‖ hash(32) ‖ r(32) ‖ s(32) ‖ v(1)`).
 *
 * The embedded hash is NOT trusted: it is recomputed from the message, because a signature that carries its own
 * hash would otherwise verify against whatever hash it chose to carry.
 */
export function recoverAddress(message: string, signature: string): string | null {
  try {
    const raw = signature.replace(/^0x/, '');
    if (raw.length !== 130 * 2 - 130 && raw.length !== 130 + 64) return recoverFrom(raw, message);
    return recoverFrom(raw, message);
  } catch { return null; }
}

function recoverFrom(raw: string, message: string): string | null {
  // ain-util prepends the 32-byte hash; a bare 65-byte signature is also accepted.
  const body = raw.length === 194 ? raw.slice(64) : raw;
  if (body.length !== 130) return null;
  const r = body.slice(0, 64); const s = body.slice(64, 128); const v = parseInt(body.slice(128, 130), 16);
  const rec = v >= 27 ? v - 27 : v;
  if (rec !== 0 && rec !== 1) return null;
  const sig = new secp.Signature(BigInt(`0x${r}`), BigInt(`0x${s}`), rec);
  const pub = sig.recoverPublicKey(hashMessage(message)).toRawBytes(false);
  return toChecksumAddress(secp.etc.bytesToHex(keccak_256(pub.slice(1)).slice(-20)));
}

export class WalletError extends Error {}

export interface WalletSession {
  /** the wallet's address — the identity every lesson is credited to */
  owner: string;
  /** the browser key that signs each request on its behalf; never leaves this browser */
  privateKey: string;
  delegate: string;
  expires: number;
  /** `<owner>:<expires>:<sig>` — sent verbatim as `x-ainize-delegate` */
  header: string;
}

/**
 * One wallet prompt, one session. `nodeAddress` binds it to this node so the delegation cannot be replayed at
 * another; `ttlMs` is clamped to what a node will honour, because asking for longer only produces a rejection
 * later, on a route that will not explain it.
 */
export async function signInWithAinWallet(nodeAddress: string, ttlMs = DELEGATION_MAX_MS): Promise<WalletSession> {
  const p = provider();
  if (!p?.signMessage) throw new WalletError('no_extension');
  const owner = await walletAddress();
  if (!owner) throw new WalletError('locked');

  const privateKey = randomPrivateKey();
  const delegate = addressOf(privateKey);
  const expires = Date.now() + Math.min(ttlMs, DELEGATION_MAX_MS);
  const message = delegateMessage({ node: nodeAddress, delegate, expires });

  const signature = await p.signMessage(message).catch((e: unknown) => {
    throw new WalletError(e instanceof Error && /reject|denied|cancel/i.test(e.message) ? 'rejected' : 'sign_failed');
  });
  if (typeof signature !== 'string' || !signature) throw new WalletError('sign_failed');

  const recovered = recoverAddress(message, signature);
  if (!recovered || recovered.toLowerCase() !== owner.toLowerCase()) throw new WalletError('signature_mismatch');

  return { owner, privateKey, delegate, expires, header: `${owner}:${expires}:${signature}` };
}
