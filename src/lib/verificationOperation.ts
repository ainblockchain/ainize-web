import type { Attestation, PatchDetail } from '../api/types';
import { sameAccountAddress, validAccountAddress } from './accountAccess';
import { accountRuntime } from './accountNodeActions';
import { managedKnowledge } from './manageKnowledge';
import { requireRuntimeOperator, type RuntimeTarget } from './loadKnowledge';
import { parseRuntimeJob, prepareRuntimeRequest, validRuntimeRequest, RuntimeOperationError,
  type OperationStorage, type RuntimeJob, type RuntimeJobIdentity } from './runtimeOperation';

const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v;
const time = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 8.64e15;
const signedRecord = (a: unknown): a is Attestation => object(a) && text(a.patch_id) && validAccountAddress(a.verifier)
  && text(a.patch_sha256) && text(a.benchmark_hash) && typeof a.passed === 'boolean' && text(a.verified_on)
  && text(a.sig) && time(a.created_at) && object(a.score)
  && Object.values(a.score).every(v => typeof v === 'string' || typeof v === 'number' && Number.isFinite(v));
const canonical = (v: unknown): string => JSON.stringify(v, (_k, x) => object(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);
export const verificationTarget = ({ id, author, name, patch_sha256, benchmark_hash, created_at, model, base }: RuntimeTarget): RuntimeTarget =>
  structuredClone({ id, author, name, patch_sha256, benchmark_hash, created_at, model, ...(base === undefined ? {} : { base }) });
export class VerificationActionError extends Error {
  constructor(readonly code: 'read' | 'changed' | 'self' | 'draft' | 'loaded' | 'unconfirmed') { super(code); }
}
export interface VerificationReview { target: RuntimeTarget; node: string; recheck: boolean; prior: string[] }
export interface VerificationOperation extends VerificationReview, RuntimeJobIdentity { version: 1; owner: string; kind: 'verify'; target: RuntimeTarget }
export const verificationOperationKey = (identity: string, node: string | null) => `ainize:verification:v1:${encodeURIComponent(JSON.stringify([identity, node?.toLowerCase() ?? null]))}`;
type Reads = { current: () => boolean; node: string | null; subject: string | null; readAccess: () => Promise<unknown>; read: () => Promise<unknown> };

function selected(raw: unknown, target: RuntimeTarget) {
  const d = managedKnowledge(raw, target.id);
  if (!d) throw new VerificationActionError('read');
  if (canonical(verificationTarget(d.anchor)) !== canonical(verificationTarget(target))) throw new VerificationActionError('changed');
  return d;
}
export async function reviewVerification(target: RuntimeTarget, deps: Reads & { runtime: () => Promise<unknown> }): Promise<VerificationReview | null> {
  if (!await requireRuntimeOperator(deps)) return null;
  const d = selected(await deps.read(), target);
  if (!deps.current()) return null;
  if (sameAccountAddress(target.author, deps.node)) throw new VerificationActionError('self');
  if (d.status === 'DRAFT') throw new VerificationActionError('draft');
  const rt = accountRuntime(await deps.runtime());
  if (!deps.current()) return null;
  if (!rt) throw new VerificationActionError('read');
  if (d.applied && rt.available && !!rt.model && target.model.id_M.startsWith(rt.model) && !!d.anchor.benchmark.samples?.length) throw new VerificationActionError('loaded');
  const own = d.attestations.filter(at => sameAccountAddress(at.verifier, deps.node));
  if (!own.every(signedRecord)) throw new VerificationActionError('read');
  return { target: verificationTarget(target), node: deps.node!, recheck: own.length > 0, prior: [...new Set(own.map(at => at.sig))].sort() };
}
export const sameVerificationReview = (a: VerificationReview, b: VerificationReview) => canonical(a) === canonical(b);
export function prepareVerification(owner: string, review: VerificationReview, capabilities: unknown, randomHex: string): VerificationOperation {
  if (!object(capabilities) || capabilities.verification_jobs !== true || capabilities.verification_restoration !== 1) throw new RuntimeOperationError('unsupported');
  return structuredClone({ ...review, owner, version: 1, kind: 'verify', request: prepareRuntimeRequest(capabilities, randomHex) });
}
export const verificationRequest = (op: VerificationOperation) => ({ id: op.target.id, body: {
  async: true as const, ...op.request, recheck: op.recheck, expected: verificationTarget(op.target),
} });
export function verificationResultKind(at: Attestation): 'integrity' | 'model' | 'record' {
  if (at.verified_on === 'hash-only') return 'integrity';
  return Number.isSafeInteger(at.samples_run) && at.samples_run! > 0 && Number.isSafeInteger(at.samples_available)
    && at.samples_available! >= at.samples_run! ? 'model' : 'record';
}

export function readVerification(storage: OperationStorage, key: string): VerificationOperation | null {
  try {
    const raw = storage.getItem(key); if (raw === null) return null;
    const op = JSON.parse(raw), a = op?.target;
    if (!object(op) || op.version !== 1 || op.kind !== 'verify' || op.owner !== key || !validAccountAddress(op.node)
      || !validRuntimeRequest(op.request) || typeof op.recheck !== 'boolean' || !Array.isArray(op.prior) || !op.prior.every(text)
      || new Set(op.prior).size !== op.prior.length || op.recheck !== (op.prior.length > 0)
      || !object(a) || !text(a.id) || typeof a.name !== 'string' || !validAccountAddress(a.author) || !text(a.patch_sha256)
      || !text(a.benchmark_hash) || !time(a.created_at) || !object(a.model) || !text(a.model.id_M)
      || a.base != null && !object(a.base) || op.job !== undefined && !parseRuntimeJob({ job: op.job }, op as VerificationOperation)) throw new Error('invalid saved verification');
    return op as VerificationOperation;
  } catch { throw new RuntimeOperationError('storage'); }
}
/** Must run under the browser lock for this account/node key. */
export function claimVerification(storage: OperationStorage, op: VerificationOperation) {
  if (readVerification(storage, op.owner)) throw new RuntimeOperationError('pending');
  try {
    storage.setItem(op.owner, JSON.stringify(op));
    if (readVerification(storage, op.owner)?.request.request_id !== op.request.request_id) throw new Error('not saved');
  } catch { throw new RuntimeOperationError('storage'); }
}
export function saveVerificationJob(storage: OperationStorage, op: VerificationOperation, job: RuntimeJob): VerificationOperation {
  const saved = readVerification(storage, op.owner);
  if (!saved || saved.request.request_id !== op.request.request_id || saved.request.instance !== op.request.instance) throw new RuntimeOperationError('pending');
  if (!parseRuntimeJob({ job }, op)) throw new RuntimeOperationError('receipt');
  const next = { ...saved, job: saved.job && ['done', 'failed'].includes(saved.job.state) ? saved.job : job };
  try { storage.setItem(op.owner, JSON.stringify(next)); } catch { throw new RuntimeOperationError('storage'); }
  return next;
}
export function clearVerification(storage: OperationStorage, op: VerificationOperation) {
  const saved = readVerification(storage, op.owner);
  if (!saved || saved.request.request_id !== op.request.request_id || saved.request.instance !== op.request.instance) return;
  try { storage.removeItem(op.owner); } catch { throw new RuntimeOperationError('storage'); }
}

export function verificationReceipt(op: VerificationOperation, raw: unknown): Attestation {
  const a = object(raw) && raw.attestation;
  if (!object(raw) || typeof raw.result !== 'string' || !signedRecord(a) || a.patch_id !== op.target.id || !sameAccountAddress(a.verifier, op.node)
    || a.patch_sha256 !== op.target.patch_sha256 || a.benchmark_hash !== op.target.benchmark_hash
    || a.created_at < Number(op.request.request_id.split('-')[0]) || op.prior.includes(a.sig)
    || (a.recheck === true) !== op.recheck) throw new VerificationActionError('unconfirmed');
  return structuredClone(a) as Attestation;
}
/** A finished request is not a passed benchmark; require the exact receipt to appear in a fresh selected record. */
export async function confirmVerification(op: VerificationOperation, raw: unknown, deps: Reads): Promise<Attestation | null> {
  if (!await requireRuntimeOperator(deps)) return null;
  if (!sameAccountAddress(op.node, deps.node)) throw new VerificationActionError('changed');
  const a = verificationReceipt(op, raw);
  const d = selected(await deps.read(), op.target);
  if (!deps.current()) return null;
  if (!d.attestations.some(next => canonical(next) === canonical(a))) throw new VerificationActionError('unconfirmed');
  return a;
}
/** A missing receipt may have completed. Inspect current signed history before explicitly closing its observer. */
export interface VerificationRecoveryReview { attestations: Attestation[]; target: 'current' | 'changed' | 'missing' }
export async function reviewVerificationRecovery(op: VerificationOperation, deps: Reads & { readJob: () => Promise<unknown> }): Promise<VerificationRecoveryReview | null> {
  if (!await requireRuntimeOperator(deps)) return null;
  if (!sameAccountAddress(op.node, deps.node)) throw new VerificationActionError('changed');
  try {
    const raw = await deps.readJob(); if (!deps.current()) return null;
    const job = parseRuntimeJob(raw, op);
    if (!job) throw new RuntimeOperationError('receipt');
    if (job.state === 'queued' || job.state === 'running') throw new RuntimeOperationError('pending');
  } catch (e) { if (!object(e) || e.status !== 404) throw e; }
  if (!deps.current()) return null;
  let raw: unknown;
  try { raw = await deps.read(); }
  catch (e) {
    if (!deps.current()) return null;
    if (object(e) && e.status === 404) return { attestations: [], target: 'missing' };
    throw e;
  }
  if (!deps.current()) return null;
  const d: PatchDetail | null = managedKnowledge(raw, op.target.id);
  if (!d) throw new VerificationActionError('read');
  const unchanged = canonical(verificationTarget(d.anchor)) === canonical(verificationTarget(op.target));
  const own = d.attestations.filter(at => sameAccountAddress(at.verifier, op.node));
  if (!own.every(signedRecord)) throw new VerificationActionError('read');
  return { attestations: own.filter(at => at.patch_id === op.target.id
    && at.patch_sha256 === op.target.patch_sha256 && at.benchmark_hash === op.target.benchmark_hash), target: unchanged ? 'current' : 'changed' };
}
