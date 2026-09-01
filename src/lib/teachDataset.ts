/**
 * Teach mode v2 — browser-side dataset helpers (design `docs/teachable-dataset-design.md` §5, §6.6, §D2, §D14).
 *
 * Three jobs, and nothing else:
 *  1. the sha256 the upload signs (`x-ngram-dataset-sha256`) and the fingerprint the preview shows;
 *  2. the canonical `rows.jsonl` bytes, so a chat basket downloads as exactly the file the node would have written;
 *  3. an instant, DISPLAY-ONLY count of what a picked file looks like — replaced by the server's report the moment the
 *     upload answers (§D2: two parsers that can disagree is where "it looked fine in the preview" bugs come from).
 */
import { sha256 } from '@noble/hashes/sha2';
import type { DatasetRowInput } from '@/api/types';
import { nodeAddressOnce } from '@/api/api';
import { currentTeacherKey, authHeaderV2 } from '@/lib/teacherKey';

/** Keys are emitted in this order, exactly one trailing LF, no BOM — the node's canonical form (§6.1). */
export function canonicalJsonl(rows: DatasetRowInput[]): string {
  return rows.map((r) => {
    const o: Record<string, string> = { prompt: r.prompt, answer: r.answer };
    if (r.alt_prompt) o.alt_prompt = r.alt_prompt;
    if (r.note) o.note = r.note;
    return JSON.stringify(o);
  }).join('\n') + (rows.length ? '\n' : '');
}

/**
 * sha256 of the file bytes, hex — the upload signature (§D14) and the fingerprint the preview shows.
 * Computed with @noble/hashes (already in the bundle for the teaching key) rather than `crypto.subtle`, which is
 * unavailable when a node is opened over plain http on a LAN address.
 */
export function sha256Hex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(sha256(view)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const shortSha = (sha: string | null | undefined): string => (sha ? sha.slice(0, 12) : '');

export const isoDay = (now = Date.now()): string => new Date(now).toISOString().slice(0, 10);
/** The name the node gives a frozen chat basket (`teach-datasets.ts` basketFilename) — the freeze receipt names it. */
export const basketFilename = (now = Date.now()): string => `your-dataset-${isoDay(now)}.jsonl`;

export const ACCEPTED_EXTENSIONS = ['.jsonl', '.json', '.csv', '.tsv', '.txt'] as const;
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(',');

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}
export function acceptedFile(name: string, formats?: string[]): boolean {
  const ext = extensionOf(name).replace('.', '');
  const list = formats?.length ? formats : ACCEPTED_EXTENSIONS.map((e) => e.slice(1));
  return list.includes(ext);
}

/** Human file size — MB above a megabyte, kB below, so "4 MB" and "12 kB" both read naturally. */
export function fileSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(bytes >= 1e7 ? 0 : 1)} MB`;
  if (bytes >= 1000) return `${Math.round(bytes / 1000)} kB`;
  return `${bytes} B`;
}

/**
 * A rough count of question/answer pairs for the "reading your file…" chip. Deliberately optimistic and never
 * authoritative: the node's report replaces it, and this never decides whether an upload happens.
 */
export function previewCount(text: string, filename: string): number {
  const ext = extensionOf(filename);
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '');
  if (ext === '.json' || /^\s*\[/.test(text)) {
    try { const arr = JSON.parse(text) as unknown[]; return Array.isArray(arr) ? arr.length : 0; } catch { return 0; }
  }
  if (ext === '.jsonl' || /^\s*\{/.test(text)) return lines.filter((l) => l.trim().startsWith('{')).length;
  if (ext === '.csv' || ext === '.tsv') return Math.max(0, lines.length - 1);
  const qa = lines.filter((l) => /^\s*(Q|질문)\s*:/i.test(l)).length;
  if (qa) return qa;
  if (lines.some((l) => l.includes('\t'))) return lines.filter((l) => l.includes('\t')).length;
  return text.split(/\n\s*\n/).filter((b) => b.trim() !== '').length;
}

/** Save bytes the browser already has (the basket download, a copied dataset) — no node call (§5.9). */
export function downloadBytes(filename: string, body: BlobPart, type = 'application/x-ndjson') {
  try {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* storage or DOM unavailable */ }
}

/**
 * Download an owner-only node file (the dataset). A plain <a href> cannot carry `x-ngram-auth`, so the bytes are
 * fetched with a request-bound signature and saved from the blob.
 */
export async function signedDownload(path: string, fallbackName: string): Promise<void> {
  const key = currentTeacherKey();
  const headers: Record<string, string> = {};
  if (key) {
    const node = await nodeAddressOnce();
    if (node) headers['x-ngram-auth'] = authHeaderV2(key.privateKey, key.address, { node, method: 'GET', path });
  }
  const res = await fetch(path, { headers, credentials: 'include' });
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try { message = ((await res.json()) as { error?: string }).error ?? message; } catch { /* not json */ }
    throw new Error(message);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const named = /filename="([^"]+)"/.exec(cd)?.[1];
  downloadBytes(named ?? fallbackName, await res.blob());
}

// ------------------------------------------------------------------ the wizard's own scratch state
/** Which questions the visitor picked on the preview screen, carried to the settings screen (never sent to the node twice). */
const SELECTION_KEY = 'ainize.teach.selection';
export function saveSelection(datasetId: string, indexes: number[] | null) {
  try {
    if (!indexes) sessionStorage.removeItem(`${SELECTION_KEY}.${datasetId}`);
    else sessionStorage.setItem(`${SELECTION_KEY}.${datasetId}`, JSON.stringify(indexes));
  } catch { /* storage unavailable */ }
}
export function loadSelection(datasetId: string): number[] | null {
  try {
    const raw = sessionStorage.getItem(`${SELECTION_KEY}.${datasetId}`);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(v) && v.every((n) => typeof n === 'number') ? (v as number[]) : null;
  } catch { return null; }
}

/**
 * What the live pre-flight measured on the preview screen, carried to the settings screen so the promise there ("Train
 * this lesson (N questions)") matches what the worker will really teach — and so the lesson can record what it left
 * out. Tied to the dataset REVISION: one edit and every measured answer is about text that no longer exists.
 */
const KNOWN_KEY = 'ainize.teach.known';
export interface KnownQuestion { index: number; base_answer: string }
export function saveKnown(datasetId: string, revision: number, known: KnownQuestion[]) {
  try {
    const key = `${KNOWN_KEY}.${datasetId}`;
    if (!known.length) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify({ revision, known }));
  } catch { /* storage unavailable */ }
}
export function loadKnown(datasetId: string, revision: number): KnownQuestion[] {
  try {
    const raw = sessionStorage.getItem(`${KNOWN_KEY}.${datasetId}`);
    const v = raw ? (JSON.parse(raw) as { revision?: number; known?: KnownQuestion[] }) : null;
    if (!v || v.revision !== revision || !Array.isArray(v.known)) return [];
    return v.known.filter((k) => typeof k?.index === 'number');
  } catch { return []; }
}
export function clearKnown(datasetId: string) {
  try { sessionStorage.removeItem(`${KNOWN_KEY}.${datasetId}`); } catch { /* ignore */ }
}

/** `id → name` for anonymous browsers, mirroring `ainize.teach.jobs` (§6.6). */
const DATASETS_KEY = 'ainize.teach.datasets';
export function rememberDataset(id: string, name: string) {
  try {
    const raw = localStorage.getItem(DATASETS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[id] = name;
    localStorage.setItem(DATASETS_KEY, JSON.stringify(map));
  } catch { /* storage unavailable */ }
}
