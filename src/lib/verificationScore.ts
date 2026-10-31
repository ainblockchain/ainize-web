import type { Attestation, CatalogEntry } from '../api/types';
import { contributesToQuorum, verificationContribution } from './verificationView';

/** Ratio evidence is a measurement, not a free-form score label. Invalid values must not become percentages. */
export function measuredRatio(value: unknown): { raw: string; pct: number; tested: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(value.trim());
  if (!match) return null;
  const hit = Number(match[1]), tested = Number(match[2]);
  if (!Number.isSafeInteger(hit) || !Number.isSafeInteger(tested) || tested <= 0 || hit > tested) return null;
  return { raw: `${hit}/${tested}`, pct: Math.round(hit / tested * 1000) / 10, tested };
}

/** Keep every effective current measurement, including failures; signed history remains in the full table. */
export function currentModelRuns(entry: CatalogEntry): Attestation[] {
  return entry.attestations.filter(at => {
    if (at.verified_on === 'hash-only') return false;
    const contribution = verificationContribution(entry, at);
    return contribution === 'failed' || contributesToQuorum(contribution);
  }).sort((a, b) => b.created_at - a.created_at || a.verifier.toLowerCase().localeCompare(b.verifier.toLowerCase()));
}

/** Pick the newest eligible passing measurement, never API array order or the highest percentage. */
export function latestVerificationScore(entry: CatalogEntry) {
  const attestation = currentModelRuns(entry).find(at => at.passed);
  if (!attestation || !attestation.score || typeof attestation.score !== 'object' || Array.isArray(attestation.score)) return null;
  const score = attestation.score;
  const after = measuredRatio(score.free_generation ?? score.free_generation_vllm ?? score.chat_60);
  // Do not silently fall back to an older, better score when the newest measurement is unreadable.
  if (!after) return null;
  const before = measuredRatio(score.pre_apply ?? score.pre_apply_vllm);
  return { ...after, before: before?.tested === after.tested ? before.raw : null, attestation };
}
