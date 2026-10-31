import type { Attestation, CatalogEntry } from '../api/types';
import { sameAccountAddress, validAccountAddress } from './accountAccess';

const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const names = (v: unknown): v is string[] => Array.isArray(v) && v.every(s => typeof s === 'string' && !!s);

/** Match the catalog's machine-based quorum, not its count of passing signatures. */
export function verificationCount(e: Pick<CatalogEntry, 'passed' | 'quorum' | 'executors' | 'executors_unknown'>) {
  const quorum = count(e.quorum) ? e.quorum : null;
  const total = !count(e.passed) ? null
    : names(e.executors) && count(e.executors_unknown)
      ? new Set(e.executors).size + e.executors_unknown : e.passed === 0 ? 0 : null;
  const known = total !== null && total <= e.passed && quorum !== null;
  const shown = known ? Math.min(total, quorum) : '—';
  return { shown, fraction: `${shown}/${quorum ?? '—'}`, extra: known ? Math.max(0, total - quorum) : 0, total: known ? total : null };
}

export type VerificationContribution = 'self' | 'stale' | 'baseline' | 'integrity' | 'failed' | 'excluded' | 'unknown' | 'counted' | 'shared' | 'legacy' | 'integrity_counted';
/** Explain this row using the same exclusions as deriveCatalog and its authoritative eligible-verifier list. */
export function verificationContribution(e: CatalogEntry, at: Attestation): VerificationContribution {
  if (!validAccountAddress(at.verifier) || at.patch_id !== e.anchor.id || at.patch_sha256 !== e.anchor.patch_sha256
    || at.benchmark_hash !== e.anchor.benchmark_hash || !count(at.created_at) || typeof at.passed !== 'boolean'
    || typeof at.verified_on !== 'string' || !at.verified_on) return 'unknown';
  if (!count(e.self_checks)) return 'unknown';
  if (e.self_checks > 0 && sameAccountAddress(at.verifier, e.anchor.author)) return 'self';
  if (e.open_challenge) {
    if (!count(e.open_challenge.created_at)) return 'unknown';
    if (at.created_at <= e.open_challenge.created_at) return 'stale';
  }
  if (at.baseline === false) return 'baseline';
  if (!at.passed) return 'failed';
  if (at.verified_on === 'hash-only' && (e.anchor.benchmark.samples?.length ?? 0) > 0) return 'integrity';
  if (!Array.isArray(e.verifiers) || !e.verifiers.every(validAccountAddress)) return 'unknown';
  if (!e.verifiers.some(v => sameAccountAddress(v, at.verifier))) return 'excluded';
  if (verificationCount(e).total === null) return 'unknown';
  if (at.verified_on === 'hash-only') return 'integrity_counted';
  const instance = at.executor?.instance;
  if (!instance) return e.executors_unknown! > 0 ? 'legacy' : 'unknown';
  if (!e.executors?.includes(instance)) return 'unknown';
  const sameEngine = e.attestations.filter(row => row.executor?.instance === instance
    && e.verifiers!.some(v => sameAccountAddress(v, row.verifier)));
  return sameEngine.length > 1 ? 'shared' : 'counted';
}

export const contributesToQuorum = (value: VerificationContribution) => ['counted', 'shared', 'legacy', 'integrity_counted'].includes(value);
