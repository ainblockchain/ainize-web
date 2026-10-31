import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Attestation, CatalogEntry } from '../src/api/types';
import { verificationContribution, verificationCount } from '../src/lib/verificationView';
import { manageFixture } from './fixtures/manageKnowledge';

const verifier = '0x' + 'bb'.repeat(20), other = '0x' + 'cc'.repeat(20);
const entry = (): CatalogEntry => ({ ...manageFixture(), passed: 1, quorum: 2, verifiers: [verifier], executors: ['engine-1'], executors_unknown: 0 });
const att = (overrides: Partial<Attestation> = {}): Attestation => ({ patch_id: entry().anchor.id, patch_sha256: entry().anchor.patch_sha256,
  benchmark_hash: entry().anchor.benchmark_hash, verifier, passed: true, verified_on: 'vllm', created_at: 100,
  score: { free_generation: '4/4' }, sig: 'fixture', restarts_detected: 0, baseline: true,
  executor: { api: 'https://model.test', model: 'model', instance: 'engine-1' }, ...overrides });

test('quorum progress counts shared engines once and keeps legacy unknown engines distinct', () => {
  assert.deepEqual(verificationCount({ ...entry(), passed: 2 }), { shown: 1, fraction: '1/2', extra: 0, total: 1 });
  assert.deepEqual(verificationCount({ ...entry(), passed: 3, executors: ['engine-1', 'engine-2'], executors_unknown: 1 }), { shown: 2, fraction: '2/2', extra: 1, total: 3 });
  assert.deepEqual(verificationCount({ ...entry(), passed: 2, executors: [], executors_unknown: 2 }), { shown: 2, fraction: '2/2', extra: 0, total: 2 });
  assert.equal(verificationCount({ ...entry(), passed: 2, executors: ['engine-1', 'engine-1'] }).total, 1);
});
test('missing and inconsistent quorum metadata stays unknown rather than borrowing signature totals', () => {
  for (const value of [{ ...entry(), executors: undefined }, { ...entry(), executors_unknown: undefined }, { ...entry(), executors_unknown: 3 }, { ...entry(), passed: NaN }, { ...entry(), quorum: -1 }]) {
    assert.equal(verificationCount(value).shown, '—'); assert.equal(verificationCount(value).extra, 0);
  }
  assert.equal(verificationCount({ passed: 0, quorum: 2 }).fraction, '0/2');
});
test('row contribution explains failed, own, pre-challenge, baseline and integrity exclusions', () => {
  assert.equal(verificationContribution(entry(), att({ passed: false })), 'failed');
  assert.equal(verificationContribution({ ...entry(), self_checks: 1 }, att({ verifier: entry().anchor.author })), 'self');
  assert.equal(verificationContribution({ ...entry(), open_challenge: { patch_id: 'chosen', challenger: other, reason: 'Check new evidence', created_at: 100 } }, att()), 'stale');
  assert.equal(verificationContribution(entry(), att({ baseline: false })), 'baseline');
  const sampled = { ...entry(), anchor: { ...entry().anchor, benchmark: { ...entry().anchor.benchmark, samples: [{ prompt: 'Q', expect: 'A' }] } } } as CatalogEntry;
  assert.equal(verificationContribution(sampled, att({ verified_on: 'hash-only' })), 'integrity');
});
test('row contribution describes counted shared/legacy/integrity evidence without claiming independence', () => {
  const a = att();
  assert.equal(verificationContribution({ ...entry(), attestations: [a] }, a), 'counted');
  const b = att({ verifier: other });
  const shared = { ...entry(), passed: 2, verifiers: [verifier, other], attestations: [a, b] };
  assert.equal(verificationContribution(shared, a), 'shared'); assert.equal(verificationContribution(shared, b), 'shared');
  assert.equal(verificationContribution({ ...entry(), executors: [], executors_unknown: 1 }, att({ executor: undefined })), 'legacy');
  const hash = att({ verified_on: 'hash-only', executor: undefined });
  const noSamples = { ...entry(), executors: [], executors_unknown: 1, anchor: { ...entry().anchor, benchmark: { ...entry().anchor.benchmark, samples: [] } } };
  assert.equal(verificationContribution(noSamples, hash), 'integrity_counted');
});
test('row contribution checks exact artifact, authoritative eligible list and engine metadata', () => {
  for (const row of [att({ patch_id: 'different' }), att({ patch_sha256: 'other' }), att({ benchmark_hash: 'other' }), att({ created_at: NaN }), att({ verified_on: '' }), att({ executor: { api: '', model: '', instance: 'unlisted' } })]) {
    assert.equal(verificationContribution(entry(), row), 'unknown');
  }
  assert.equal(verificationContribution({ ...entry(), verifiers: undefined }, att()), 'unknown');
  assert.equal(verificationContribution({ ...entry(), verifiers: [] }, att()), 'excluded');
  // A dev node explicitly counting self-attestations must not be contradicted by a blanket author exclusion.
  assert.equal(verificationContribution({ ...entry(), self_checks: 0, verifiers: [entry().anchor.author] }, att({ verifier: entry().anchor.author })), 'counted');
});
