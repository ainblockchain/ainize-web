/**
 * Teaching key — the visitor's browser-held secp256k1 identity (spec §9.1, §7.7).
 *
 * The node verifies with `@ainblockchain/ain-util` (`ecVerifySig`, see packages/core/src/identity.ts), so this file
 * reproduces ain-util's personal-message format bit for bit with `@noble/secp256k1` + `@noble/hashes` (no ain-util
 * in the browser bundle):
 *
 *   hash      = keccak256(keccak256(varint(len(PREFIX)) ‖ PREFIX ‖ varint(message.length) ‖ messageBytes))
 *   signature = 0x ‖ hash(32) ‖ r(32) ‖ s(32) ‖ v(1)          v = 27 + recovery, low-S
 *   address   = checksum(keccak256(pubkey64)[12..32])         (EIP-55 style casing, same as ain-util)
 *
 * The cross-library compatibility test lives in packages/web/test/teacherKey.test.ts (browser signature verified with
 * core `verifyMessage` and node `verifyAuthHeader`). Keep the two files in sync with identity.ts.
 *
 * Nothing in the signing part touches the DOM; the storage helpers wrap every localStorage access in try/catch so the
 * page keeps working when storage is unavailable (spec §7.7).
 */
import * as secp from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';

// noble's sync sign() needs an HMAC-SHA256 implementation (RFC 6979 nonces).
secp.etc.hmacSha256Sync = (key: Uint8Array, ...msgs: Uint8Array[]) => hmac(sha256, key, secp.etc.concatBytes(...msgs));

const PREFIX = 'AINetwork Signed Message:\n';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const hex = (b: Uint8Array): string => secp.etc.bytesToHex(b);
const unhex = (h: string): Uint8Array => secp.etc.hexToBytes(h.replace(/^0x/, ''));
const concat = (...arrs: Uint8Array[]): Uint8Array => secp.etc.concatBytes(...arrs);

/** Bitcoin-style varint (varuint-bitcoin `encode`), as used by ain-util's hashMessage. */
function varint(n: number): Uint8Array {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, (n >> 8) & 0xff);
  if (n <= 0xffffffff) return Uint8Array.of(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff);
  throw new Error('message too long');
}

/** ain-util `toBuffer` for strings: a 0x-prefixed hex string is decoded as bytes, anything else is UTF-8. */
function messageBytes(message: string): Uint8Array {
  if (/^0x[0-9A-Fa-f]*$/.test(message)) { const h = message.slice(2); return unhex(h.length % 2 ? `0${h}` : h); }
  return utf8(message);
}

/** ain-util `hashMessage` — note the length varint uses the JS string length (UTF-16 units), exactly like ain-util. */
export function hashMessage(message: string): Uint8Array {
  const data = concat(varint(PREFIX.length), utf8(PREFIX), varint(message.length), messageBytes(message));
  return keccak_256(keccak_256(data));
}

export function toChecksumAddress(address: string): string {
  const a = address.replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(a)) throw new Error('invalid address');
  const h = hex(keccak_256(utf8(a)));
  let out = '0x';
  for (let i = 0; i < a.length; i++) out += parseInt(h[i], 16) >= 8 ? a[i].toUpperCase() : a[i];
  return out;
}

export function isAddress(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/** Address of a private key, derived like packages/core/src/identity.ts (ain-util privateToPublic → pubToAddress). */
export function addressOf(privHex: string): string {
  const pub = secp.getPublicKey(unhex(privHex), false);         // 65 bytes, 0x04 ‖ X ‖ Y
  return toChecksumAddress(hex(keccak_256(pub.slice(1)).slice(-20)));
}

export function isPrivateKey(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  const v = value.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]{64}$/.test(v)) return false;
  try { return secp.utils.isValidPrivateKey(unhex(v)); } catch { return false; }
}

export function randomPrivateKey(): string { return hex(secp.utils.randomPrivateKey()); }

/** ain-util `ecSignMessage` (chainId 0): 0x ‖ hash ‖ r ‖ s ‖ v. Verifiable with core `verifyMessage(message, sig, address)`. */
export function signMessage(message: string, privHex: string): string {
  const h = hashMessage(message);
  const sig = secp.sign(h, unhex(privHex), { lowS: true });
  return `0x${hex(h)}${hex(sig.toCompactRawBytes())}${(27 + sig.recovery).toString(16).padStart(2, '0')}`;
}

/**
 * Legacy `x-ainize-auth: <address>:<ts>:<sig over "<purpose>:<ts>">` — verified by the node's verifyAuthHeader (5-min skew).
 * Not bound to a route: the node refuses an exact replay but the same header would verify on another route, so the
 * API layer sends the request-bound v2 form (`authHeaderV2`) and keeps this only as a fallback when the node address
 * is unknown.
 */
export function authHeader(privHex: string, address: string, purpose = 'teach', ts = Date.now()): string {
  return `${address}:${ts}:${signMessage(`${purpose}:${ts}`, privHex)}`;
}

/** What one v2 request signs — mirrors packages/node/src/teach-auth.ts `teachAuthMessage`. */
export interface TeachAuthTarget { node: string; method: string; path: string; body?: string | Uint8Array | null; purpose?: string }

export function teachAuthMessage(t: TeachAuthTarget & { ts: number }): string {
  const parts = [t.purpose ?? 'teach', t.node, t.method.toUpperCase(), t.path, String(t.ts)];
  if (t.body !== undefined && t.body !== null && t.body.length > 0) parts.push(hex(sha256(typeof t.body === 'string' ? utf8(t.body) : t.body)));
  return parts.join(':');
}

/**
 * v2 `x-ainize-auth: <address>:<ts>:<sig>:v2`, sig over `teach:<nodeAddress>:<METHOD>:<path+query>:<ts>[:<sha256(body)>]`.
 * Single-use on the node and bound to node / route / body, so a captured header cannot be replayed elsewhere.
 */
export function authHeaderV2(privHex: string, address: string, t: TeachAuthTarget, ts = Date.now()): string {
  return `${address}:${ts}:${signMessage(teachAuthMessage({ ...t, ts }), privHex)}:v2`;
}

// ------------------------------------------------------------------ browser storage (spec §7.7)
export interface TeacherKey {
  privateKey: string;
  address: string;
  name?: string;
  payout_address?: string;
  created_at: number;
}

export const KEY_STORAGE = 'ainize.teacher.key';
const CHANGE_EVENT = 'ainize:teacher-key';

function readStorage(): TeacherKey | null {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY_STORAGE);
    if (!raw) return null;
    const k = JSON.parse(raw) as Partial<TeacherKey>;
    if (!isPrivateKey(k.privateKey)) return null;
    const address = addressOf(k.privateKey);
    return { privateKey: k.privateKey.replace(/^0x/, '').toLowerCase(), address, ...(k.name ? { name: k.name } : {}), ...(isAddress(k.payout_address) ? { payout_address: k.payout_address } : {}), created_at: typeof k.created_at === 'number' ? k.created_at : Date.now() };
  } catch { return null; }
}

function notify() { try { window.dispatchEvent(new Event(CHANGE_EVENT)); } catch { /* not in a browser */ } }

export function loadTeacherKey(): TeacherKey | null { return readStorage(); }

export function saveTeacherKey(key: TeacherKey): TeacherKey {
  const k: TeacherKey = { ...key, privateKey: key.privateKey.replace(/^0x/, '').toLowerCase(), address: addressOf(key.privateKey) };
  try { localStorage.setItem(KEY_STORAGE, JSON.stringify(k)); } catch { /* storage unavailable — the key lives in memory for this page only */ }
  memoryKey = k;
  notify();
  return k;
}

/** Fallback when localStorage throws (private window, blocked storage): the key still works until the tab closes. */
let memoryKey: TeacherKey | null = null;

export function currentTeacherKey(): TeacherKey | null { return readStorage() ?? memoryKey; }

/**
 * Finding 37 — did the key actually SURVIVE being written? `saveTeacherKey` swallows the storage error and falls
 * back to a key that lives until the tab closes, and the sheet's warning ("if you clear this browser…") is then a
 * kinder sentence than the truth. This is the one fact that separates the two, read back from storage.
 */
export function keyIsPersisted(): boolean { return readStorage() !== null; }

export function createTeacherKey(extra: { name?: string; payout_address?: string } = {}): TeacherKey {
  const privateKey = randomPrivateKey();
  return saveTeacherKey({ privateKey, address: addressOf(privateKey), created_at: Date.now(), ...(extra.name?.trim() ? { name: extra.name.trim() } : {}), ...(isAddress(extra.payout_address) ? { payout_address: extra.payout_address } : {}) });
}

export function updateTeacherKey(patch: { name?: string; payout_address?: string | null }): TeacherKey | null {
  const k = currentTeacherKey();
  if (!k) return null;
  const next: TeacherKey = { ...k };
  if (patch.name !== undefined) { if (patch.name.trim()) next.name = patch.name.trim().slice(0, 40); else delete next.name; }
  if (patch.payout_address !== undefined) { if (isAddress(patch.payout_address)) next.payout_address = patch.payout_address; else delete next.payout_address; }
  return saveTeacherKey(next);
}

export function forgetTeacherKey() {
  try { localStorage.removeItem(KEY_STORAGE); } catch { /* ignore */ }
  memoryKey = null;
  notify();
}

/** Parse a backup file / pasted JSON / bare private key. Throws a plain Error on garbage. */
export function parseTeacherKeyBackup(text: string): TeacherKey {
  const s = text.trim();
  if (isPrivateKey(s)) return { privateKey: s.replace(/^0x/, '').toLowerCase(), address: addressOf(s), created_at: Date.now() };
  const j = JSON.parse(s) as Partial<TeacherKey>;
  if (!isPrivateKey(j.privateKey)) throw new Error('backup has no valid private key');
  return { privateKey: j.privateKey.replace(/^0x/, '').toLowerCase(), address: addressOf(j.privateKey), ...(typeof j.name === 'string' && j.name.trim() ? { name: j.name.trim().slice(0, 40) } : {}), ...(isAddress(j.payout_address) ? { payout_address: j.payout_address } : {}), created_at: typeof j.created_at === 'number' ? j.created_at : Date.now() };
}

/** Backup file body (what "Download key backup" saves). */
export function teacherKeyBackup(key: TeacherKey): string {
  return JSON.stringify({ kind: 'ainize-teaching-key', version: 1, ...key }, null, 2);
}

export function teacherKeyBackupName(key: TeacherKey): string { return `ainize-teaching-key-${key.address.slice(2, 10).toLowerCase()}.json`; }

/** Legacy signed header for the current key, or null when this browser has no key yet (fallback when the node address is unknown). */
export function teachAuthHeader(purpose = 'teach'): string | null {
  const k = currentTeacherKey();
  return k ? authHeader(k.privateKey, k.address, purpose) : null;
}

/** Request-bound v2 header for the current key, or null when this browser has no key yet. */
export function teachAuthHeaderFor(t: TeachAuthTarget): string | null {
  const k = currentTeacherKey();
  return k ? authHeaderV2(k.privateKey, k.address, t) : null;
}

/** Subscribe to key changes (created / imported / forgotten) in this tab. */
export function onTeacherKeyChange(fn: () => void): () => void {
  try { window.addEventListener(CHANGE_EVENT, fn); return () => window.removeEventListener(CHANGE_EVENT, fn); } catch { return () => undefined; }
}

export function shortKey(address: string): string { return `${address.slice(0, 6)}…${address.slice(-4)}`; }
