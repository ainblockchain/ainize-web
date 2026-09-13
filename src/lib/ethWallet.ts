/**
 * MetaMask (and anything else that speaks EIP-1193) as the way a person signs in.
 *
 * WHY A BROWSER WALLET AT ALL. The node's identity model is "a key signs for itself", and for the CLI and for the
 * node's own key that works: the key is on the machine, it signs every request, nobody is watching. A person is
 * the other case. They have no key on the machine and should not be asked to make one, paste one, or keep one
 * safe; they already hold an address in a wallet they trust, and that address is the one they expect to be paid
 * at. So the wallet proves who they are, and it proves it the only way a wallet can — `personal_sign`.
 *
 * WHICH MEANS EIP-191, NOT AIN. `teacherKey.ts` reproduces ain-util's personal-message format, which keccaks
 * twice over a varint-length-prefixed message and counts the length in UTF-16 code units. `personal_sign` keccaks
 * once, prefixes `\x19Ethereum Signed Message:\n`, and counts UTF-8 bytes. Same curve, same key, same ADDRESS —
 * and signatures that verify under neither the other's rules. That is not a detail to paper over with a verifier
 * that tries both: the two mean different things (a person read a prompt, versus a key acted alone), and a
 * verifier that guessed would let whoever presents a signature choose which of those the node records. So the
 * scheme is named, everywhere, and this file only ever produces `eip191`.
 *
 * HOW THE WALLET IS FOUND. EIP-6963 first: wallets announce themselves on an event, so several can be installed
 * at once and the person picks. `window.ethereum` is the fallback for wallets that never learned to announce, and
 * it is deliberately last — with two extensions installed it is whichever won a race at page load, which is not a
 * choice anybody made.
 *
 * WHAT THIS FILE REFUSES TO DO. It does not ask for a private key (MetaMask has no such method, and a wallet that
 * offered one would be the wrong thing to build on), and it does not sign per request. `personal_sign` is a modal
 * prompt; a running lesson polls several times a minute, so signing each one would put a dialog between the
 * person and the page for ever. The wallet signs ONCE — either a sign-in challenge, or a delegation authorising a
 * browser key — and a key generated here signs the rest. See `delegateMessage` in @ainize/core.
 */
import { hashEip191, isAddress, toChecksumAddress } from './teacherKey';
import * as secp from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';

/** The slice of EIP-1193 this needs. Anything more would be this file deciding things it has no business in. */
export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: never[]) => void) => void;
  removeListener?: (event: string, handler: (...args: never[]) => void) => void;
}
/** What a wallet announces about itself under EIP-6963 — `rdns` is the stable id, `name`/`icon` are for the person. */
export interface WalletInfo { uuid: string; name: string; icon: string; rdns: string }
export interface DiscoveredWallet { info: WalletInfo; provider: Eip1193Provider }

declare global {
  interface Window { ethereum?: Eip1193Provider & { isMetaMask?: boolean } }
  interface WindowEventMap { 'eip6963:announceProvider': CustomEvent<DiscoveredWallet> }
}

export class WalletError extends Error {}

/**
 * Every wallet that answers, plus `window.ethereum` if nothing did.
 *
 * Announcements arrive asynchronously and there is no "that was the last one" signal, so this waits a beat and
 * returns what turned up. A bounded wait, never a spinner that never ends: a person with no wallet installed must
 * reach the "install one" state quickly and not sit watching a placeholder.
 */
export function discoverWallets(waitMs = 400): Promise<DiscoveredWallet[]> {
  if (typeof window === 'undefined') return Promise.resolve([]);
  return new Promise((resolve) => {
    const found = new Map<string, DiscoveredWallet>();
    const onAnnounce = (e: WindowEvent) => { const d = e.detail; if (d?.info?.uuid) found.set(d.info.rdns || d.info.uuid, d); };
    window.addEventListener('eip6963:announceProvider', onAnnounce as EventListener);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', onAnnounce as EventListener);
      if (!found.size && window.ethereum) {
        // A wallet too old to announce. Named for what it is rather than guessed at: `isMetaMask` is set by
        // several wallets that are not MetaMask, so it decides the label and nothing else.
        found.set('injected', {
          info: { uuid: 'injected', rdns: 'injected', name: window.ethereum.isMetaMask ? 'MetaMask' : 'Browser wallet', icon: '' },
          provider: window.ethereum,
        });
      }
      resolve([...found.values()]);
    }, waitMs);
  });
}
type WindowEvent = CustomEvent<DiscoveredWallet>;

/** Is there anything to sign with at all? Cheap enough to call on render; `discoverWallets` is the real answer. */
export function maybeHasWallet(): boolean {
  return typeof window !== 'undefined' && !!window.ethereum;
}

/**
 * The address the person chose, after the wallet has asked them.
 *
 * `eth_requestAccounts` is the prompt. It returns the accounts the person GRANTED, which may be none — a wallet
 * that is installed but locked, or a person who closed the dialog — and none must never become an identity keyed
 * to `undefined`.
 */
export async function connect(provider: Eip1193Provider): Promise<string> {
  const accounts = await provider.request({ method: 'eth_requestAccounts' }).catch((e: unknown) => {
    throw new WalletError(rejected(e) ? 'rejected' : 'connect_failed');
  }) as unknown;
  const first = Array.isArray(accounts) ? accounts[0] : null;
  if (!isAddress(first)) throw new WalletError('locked');
  return toChecksumAddress(first);
}

/** Accounts already granted, without prompting. Null when the wallet is locked or has granted nothing. */
export async function currentAccount(provider: Eip1193Provider): Promise<string | null> {
  try {
    const accounts = await provider.request({ method: 'eth_accounts' }) as unknown;
    const first = Array.isArray(accounts) ? accounts[0] : null;
    return isAddress(first) ? toChecksumAddress(first) : null;
  } catch { return null; }
}

/**
 * Sign a message, and check the wallet's own answer before handing it on.
 *
 * The recovery is not ceremony. The wallet is a different codebase signing with a different library, and if its
 * format ever diverges from what the node verifies, every later request fails with an opaque 401 on a route that
 * has nothing to do with signing. Checked here, the failure is "your wallet's signature did not match its own
 * address", at the moment the person pressed the button, which is the only moment it can be acted on.
 *
 * The message goes over the wire as UTF-8 hex rather than as a string: a wallet asked to sign a plain string has
 * to guess whether something that looks like hex IS hex, and they do not all guess the same way. Hex is
 * unambiguous, and MetaMask renders it back to the person as text.
 */
export async function personalSign(provider: Eip1193Provider, message: string, address: string): Promise<string> {
  const hex = `0x${[...new TextEncoder().encode(message)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
  const signature = await provider.request({ method: 'personal_sign', params: [hex, address] }).catch((e: unknown) => {
    throw new WalletError(rejected(e) ? 'rejected' : 'sign_failed');
  }) as unknown;
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new WalletError('sign_failed');
  if (recoverEip191(message, signature)?.toLowerCase() !== address.toLowerCase()) throw new WalletError('signature_mismatch');
  return signature;
}

/** The address that produced an EIP-191 signature over `message`, or null. Mirrors `verifyEip191` in the node. */
export function recoverEip191(message: string, signature: string): string | null {
  try {
    const raw = signature.replace(/^0x/, '');
    if (raw.length !== 130) return null;                       // a bare 65 bytes — an AIN signature is 97 and is not this
    const v = parseInt(raw.slice(128, 130), 16);
    const rec = v >= 27 ? v - 27 : v;
    if (rec !== 0 && rec !== 1) return null;
    const sig = new secp.Signature(BigInt(`0x${raw.slice(0, 64)}`), BigInt(`0x${raw.slice(64, 128)}`), rec);
    const pub = sig.recoverPublicKey(hashEip191(message)).toRawBytes(false);
    return toChecksumAddress(secp.etc.bytesToHex(keccak_256(pub.slice(1)).slice(-20)));
  } catch { return null; }
}

/** A person closing the dialog is not a failure to report as one — EIP-1193 says 4001, wallets also say it in words. */
function rejected(e: unknown): boolean {
  const err = e as { code?: number; message?: string } | null;
  return err?.code === 4001 || /reject|denied|cancel/i.test(err?.message ?? '');
}
