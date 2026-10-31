import type { StackLayer } from '../api/types';
import type { RuntimeTarget } from './loadKnowledge';
import { accountRuntime } from './accountNodeActions';
import { validAccountAddress } from './accountAccess';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const timestamp = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 8.64e15;
const instance = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const requestId = (v: unknown): v is string => typeof v === 'string' && /^\d{13}-[a-f0-9]{32}$/.test(v);
export type RuntimePhase = 'submitting' | 'checking' | 'queued' | 'running' | 'confirming' | 'interrupted';
export class RuntimeOperationError extends Error {
  constructor(readonly code: 'unsupported' | 'storage' | 'pending' | 'receipt' | 'unreachable' | 'missing') { super(code); }
}
export interface RuntimeJob {
  id: string; instance: string; patch_id: string; kind: 'apply' | 'remove';
  state: 'queued' | 'running' | 'done' | 'failed';
  queued_at: number; started_at: number | null; finished_at: number | null;
  result: string | null; error: string | null; outcome?: unknown; status?: number; details?: Record<string, unknown> | null;
}
export interface RuntimeOperation {
  version: 1; owner: string; target: RuntimeTarget; kind: 'load' | 'unload'; withBase: boolean;
  before: StackLayer[]; request: { request_id: string; instance: string }; job?: RuntimeJob;
}
export interface OperationStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export const runtimeOperationKey = (identity: string, node: string | null) => `ainize:runtime-operation:v1:${encodeURIComponent(JSON.stringify([identity, node?.toLowerCase() ?? null]))}`;

export function prepareRuntimeOperation(owner: string, target: RuntimeTarget, kind: 'load' | 'unload', withBase: boolean, before: StackLayer[], raw: unknown, randomHex: string): RuntimeOperation {
  if (!object(raw) || !instance(raw.instance) || !timestamp(raw.server_time) || String(raw.server_time).length !== 13
    || raw.request_window_ms !== 600_000 || !instance(randomHex)) throw new RuntimeOperationError('unsupported');
  // Persist the selected artifact identity, not the full benchmark or the operator's credentials.
  const { id, author, name, patch_sha256, benchmark_hash, created_at, model, base } = target;
  return structuredClone({ version: 1, owner, target: { id, author, name, patch_sha256, benchmark_hash, created_at, model, base },
    kind, withBase, before, request: { request_id: `${raw.server_time}-${randomHex}`, instance: raw.instance } });
}

export function parseRuntimeJob(raw: unknown, op: RuntimeOperation): RuntimeJob | null {
  if (!object(raw) || !object(raw.job)) return null;
  const j = raw.job;
  if (j.id !== op.request.request_id || j.instance !== op.request.instance || j.patch_id !== op.target.id
    || j.kind !== (op.kind === 'load' ? 'apply' : 'remove') || !['queued', 'running', 'done', 'failed'].includes(j.state)
    || !timestamp(j.queued_at) || !(j.started_at === null || timestamp(j.started_at) && j.started_at >= j.queued_at)
    || !(j.finished_at === null || timestamp(j.finished_at) && j.finished_at >= (j.started_at ?? j.queued_at))) return null;
  if (j.state === 'queued' && j.started_at !== null || j.state === 'running' && j.started_at === null) return null;
  if (j.state === 'queued' || j.state === 'running') {
    if (j.finished_at !== null || j.result !== null || j.error !== null || j.outcome !== undefined) return null;
  } else if (j.finished_at === null) return null;
  else if (j.state === 'done') {
    if (typeof j.result !== 'string' || j.error !== null || !object(j.outcome) || j.outcome.result !== j.result || !Array.isArray(j.outcome.stack)) return null;
  } else if (typeof j.error !== 'string' || j.result !== null || !Number.isInteger(j.status) || j.status < 400 || j.status > 599
    || j.details != null && !object(j.details)) return null;
  return structuredClone(j) as RuntimeJob;
}

export function readRuntimeOperation(storage: OperationStorage, key: string): RuntimeOperation | null {
  try {
    const text = storage.getItem(key);
    if (text === null) return null;
    const op = JSON.parse(text);
    const a = op?.target;
    if (!object(op) || op.version !== 1 || op.owner !== key || !object(a) || typeof a.id !== 'string' || !a.id
      || !validAccountAddress(a.author) || typeof a.name !== 'string' || typeof a.patch_sha256 !== 'string' || !a.patch_sha256
      || typeof a.benchmark_hash !== 'string' || !timestamp(a.created_at) || !object(a.model) || typeof a.model.id_M !== 'string'
      || a.base != null && !object(a.base) || !['load', 'unload'].includes(op.kind) || typeof op.withBase !== 'boolean'
      || !object(op.request) || !instance(op.request.instance) || !requestId(op.request.request_id) || !Array.isArray(op.before)
      || !accountRuntime({ available: true, hook: true, applied: op.before.map((r: any) => r?.patch_id), stack: op.before })
      || op.job !== undefined && !parseRuntimeJob({ job: op.job }, op as RuntimeOperation)) throw new Error('invalid saved operation');
    return op as RuntimeOperation;
  } catch { throw new RuntimeOperationError('storage'); }
}

/** Caller holds a browser Web Lock across this synchronous claim, including across tabs. */
export function claimRuntimeOperation(storage: OperationStorage, op: RuntimeOperation) {
  if (readRuntimeOperation(storage, op.owner)) throw new RuntimeOperationError('pending');
  try {
    storage.setItem(op.owner, JSON.stringify(op));
    if (readRuntimeOperation(storage, op.owner)?.request.request_id !== op.request.request_id) throw new Error('receipt not saved');
  } catch { throw new RuntimeOperationError('storage'); }
}
export function saveRuntimeJob(storage: OperationStorage, op: RuntimeOperation, job: RuntimeJob) {
  const existing = readRuntimeOperation(storage, op.owner);
  if (!existing || existing.request.request_id !== op.request.request_id || existing.request.instance !== op.request.instance) throw new RuntimeOperationError('pending');
  // A slow tab must not overwrite a terminal receipt another tab has already received.
  const keep = existing.job && ['done', 'failed'].includes(existing.job.state) ? existing.job : job;
  const next = { ...existing, job: keep };
  try { storage.setItem(op.owner, JSON.stringify(next)); } catch { throw new RuntimeOperationError('storage'); }
  return next;
}
export function clearRuntimeOperation(storage: OperationStorage, op: RuntimeOperation) {
  const existing = readRuntimeOperation(storage, op.owner);
  if (!existing || existing.request.request_id !== op.request.request_id || existing.request.instance !== op.request.instance) return;
  try { storage.removeItem(op.owner); } catch { throw new RuntimeOperationError('storage'); }
}
export const runtimeOperationRequest = (op: RuntimeOperation) => ({ id: op.target.id, kind: op.kind,
  body: { async: true as const, ...op.request, ...(op.kind === 'load' ? { with_base: op.withBase } : { cascade: false }) } });

/** POST only on the initial explicit action. Recovery/polling never invents an ID or resubmits work. */
export async function followRuntimeOperation(op: RuntimeOperation, deps: {
  current: () => boolean; submit?: () => Promise<unknown>; read: () => Promise<unknown>;
  save: (job: RuntimeJob) => void; phase: (phase: RuntimePhase) => void; wait: () => Promise<void>;
}): Promise<unknown | null> {
  if (!deps.current()) return null;
  let raw: unknown;
  if (op.job && ['done', 'failed'].includes(op.job.state)) raw = { job: op.job };
  else if (deps.submit) {
    deps.phase('submitting');
    try { raw = await deps.submit(); }
    catch {
      if (!deps.current()) return null;
      // Even a failed admission response may be a proxy response after acceptance. Recover by the saved ID.
    }
  }
  while (deps.current()) {
    if (raw === undefined) {
      try { raw = await deps.read(); }
      catch (e) {
        if (!deps.current()) return null;
        throw new RuntimeOperationError(object(e) && e.status === 404 ? 'missing' : 'unreachable');
      }
    }
    if (!deps.current()) return null;
    const job = parseRuntimeJob(raw, op);
    if (!job) throw new RuntimeOperationError('receipt');
    deps.save(job);
    if (!deps.current()) return null;
    if (job.state === 'failed') throw { status: job.status, data: { ...(job.details ?? {}), error: job.error } };
    if (job.state === 'done') { deps.phase('confirming'); return job.outcome; }
    deps.phase(job.state); await deps.wait(); raw = undefined;
  }
  return null;
}
