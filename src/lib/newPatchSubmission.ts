import { isKnowledgeAuthor } from './detailRoutes';

export const patchIdForDraft = (id: string, name: string) => (id.trim() || name.trim()).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
export interface PatchIntent { id: string; name: string; modelId: string; author: string | null }
export interface PatchProgress { sent: number; total: number }
export interface PatchRequest { result: Promise<unknown>; abort: () => void }
export type PatchSaveState = { phase: 'saving' } | { phase: 'saved'; destination: string } | { phase: 'error'; error: unknown } | { phase: 'uncertain'; reason: 'cancelled' | 'network' | 'unconfirmed' };
export class PatchSaveError extends Error {
  constructor(readonly reason: 'cancelled' | 'network' | 'unconfirmed') { super(reason); }
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function confirmedPatchDestination(value: unknown, intent: PatchIntent): string | null {
  if (!object(value) || !object(value.anchor)) return null;
  const a = value.anchor;
  if (a.id !== intent.id || a.name !== intent.name || !object(a.model) || a.model.id_M !== intent.modelId) return null;
  if (typeof a.author !== 'string' || !isKnowledgeAuthor(a.author) || intent.author && a.author.toLowerCase() !== intent.author.toLowerCase()) return null;
  return `/project/${encodeURIComponent(a.author)}/${encodeURIComponent(intent.id)}`;
}

/** Abort stops waiting/transfer, not a promise that the server has rolled back the write. */
export function requestNewPatch(body: FormData, progress: (value: PatchProgress) => void, makeXhr = () => new XMLHttpRequest()): PatchRequest {
  const xhr = makeXhr();
  const result = new Promise<unknown>((resolve, reject) => {
    xhr.open('POST', '/api/patches'); xhr.withCredentials = true;
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && Number.isFinite(e.loaded) && e.loaded >= 0 && Number.isFinite(e.total) && e.total > 0) progress({ sent: Math.min(e.loaded, e.total), total: e.total });
    };
    xhr.onload = () => {
      let data: unknown = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* successful non-JSON responses still need an acknowledgement */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject({ status: xhr.status, data });
    };
    xhr.onerror = xhr.ontimeout = () => reject(new PatchSaveError('network'));
    xhr.onabort = () => reject(new PatchSaveError('cancelled'));
    xhr.send(body);
  });
  return { result, abort: () => xhr.abort() };
}

/** Synchronous single flight plus generation guards covers double-submit and late callbacks after leaving. */
export function createNewPatchTask() {
  let generation = 0, busy = false;
  let flight: PatchRequest | null = null;
  let reportCancellation: (() => void) | null = null;
  const stop = (notify: boolean) => {
    const report = reportCancellation, old = flight;
    generation++; busy = false; flight = null; reportCancellation = null;
    if (notify) report?.();
    old?.abort();
  };
  return {
    pending: () => busy,
    cancel: () => stop(true),
    abandon: () => stop(false),
    async run(intent: PatchIntent, deps: {
      active: () => boolean; send: (progress: (value: PatchProgress) => void) => PatchRequest;
      progress: (value: PatchProgress) => void; emit: (state: PatchSaveState) => void;
    }) {
      if (busy || !deps.active()) return;
      busy = true;
      const attempt = ++generation;
      const current = () => generation === attempt && deps.active();
      reportCancellation = () => { if (deps.active()) deps.emit({ phase: 'uncertain', reason: 'cancelled' }); };
      deps.emit({ phase: 'saving' });
      try {
        flight = deps.send(value => { if (current()) deps.progress(value); });
        const value = await flight.result;
        if (!current()) return;
        const destination = confirmedPatchDestination(value, intent);
        if (!destination) throw new PatchSaveError('unconfirmed');
        deps.emit({ phase: 'saved', destination });
      } catch (error) {
        if (current()) deps.emit(error instanceof PatchSaveError ? { phase: 'uncertain', reason: error.reason } : { phase: 'error', error });
      } finally {
        if (generation === attempt) { busy = false; flight = null; reportCancellation = null; }
      }
    },
  };
}
