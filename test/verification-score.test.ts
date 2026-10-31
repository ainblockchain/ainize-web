import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Attestation, CatalogEntry } from '../src/api/types';
import { currentModelRuns, latestVerificationScore, measuredRatio } from '../src/lib/verificationScore';
import { manageFixture } from './fixtures/manageKnowledge';

const a = '0x' + 'ab'.repeat(20), b = '0x' + 'bc'.repeat(20);
const entry = (): CatalogEntry => ({ ...manageFixture(), passed: 2, quorum: 2, verifiers: [a, b], executors: ['engine'], executors_unknown: 0 });
const run = (verifier = a, created_at = 100, score = '4/4', overrides: Partial<Attestation> = {}): Attestation => ({
  verifier, created_at, patch_id: entry().anchor.id, patch_sha256: entry().anchor.patch_sha256, benchmark_hash: entry().anchor.benchmark_hash,
  passed: true, verified_on: 'vllm', score: { free_generation: score, pre_apply: '1/4' }, baseline: true, sig: 'fixture', restarts_detected: 0,
  executor: { api: 'https://model.test', model: 'model', instance: 'engine' }, ...overrides,
});
test('representative accuracy uses the latest eligible measurement independently of input order or score', () => {
  const old = run(a, 100, '4/4'), latest = run(b, 200, '3/4');
  for (const attestations of [[latest, old], [old, latest]]) {
    const score = latestVerificationScore({ ...entry(), attestations });
    assert.equal(score?.pct, 75); assert.equal(score?.raw, '3/4'); assert.equal(score?.tested, 4);
    assert.equal(score?.before, '1/4'); assert.equal(score?.attestation, latest);
  }
  const left = run(a, 200), right = run(b, 200, '2/4');
  assert.equal(latestVerificationScore({ ...entry(), attestations: [right, left] })?.attestation, left);
  assert.equal(latestVerificationScore({ ...entry(), attestations: [left, right] })?.attestation, left);
});
test('self, stale, wrong-artifact, baseline-free, integrity and unconfirmed measurements cannot supply headlines', () => {
  const base = entry();
  for (const [patch, record] of [
    [{ self_checks: 1 }, run(base.anchor.author)],
    [{ open_challenge: { patch_id: base.anchor.id, challenger: a, reason: 'New evidence', created_at: 100 } }, run()],
    [{}, run(a, 100, '4/4', { baseline: false })], [{}, run(a, 100, '4/4', { verified_on: 'hash-only' })],
    [{}, run(a, 100, '4/4', { patch_sha256: 'different' })], [{ verifiers: undefined }, run()], [{ executors: undefined }, run()],
  ] as const) {
    const value = { ...base, ...patch, attestations: [record] } as CatalogEntry;
    assert.equal(latestVerificationScore(value), null); assert.deepEqual(currentModelRuns(value), []);
  }
});
test('current failures remain visible alongside a passing score without reviving stale failed history', () => {
  const good = run(), failed = run(b, 200, '1/4', { passed: false });
  const p = { ...entry(), attestations: [good, failed], verifiers: [a], passed: 1 };
  assert.equal(latestVerificationScore(p)?.attestation, good);
  assert.deepEqual(currentModelRuns(p), [failed, good]);
  assert.equal(latestVerificationScore({ ...p, attestations: [failed] }), null);
  assert.deepEqual(currentModelRuns({ ...p, open_challenge: { patch_id: p.anchor.id, challenger: a, reason: 'Check again', created_at: 200 } }), []);
});
test('ratios reject impossible or unsafe values and retain a real zero accuracy', () => {
  for (const value of [undefined, null, 100, '', '100%', '5/4', '0/0', '-1/4', 'Infinity/4', '9007199254740992/9007199254740993', {}, '1/4 extra']) assert.equal(measuredRatio(value), null);
  assert.deepEqual(measuredRatio(' 0 / 4 '), { raw: '0/4', pct: 0, tested: 4 });
  assert.deepEqual(measuredRatio('1/3'), { raw: '1/3', pct: 33.3, tested: 3 });
});
test('an unreadable latest score does not fall back to a more favorable old result', () => {
  for (const score of ['bad', '5/4', '0/0']) assert.equal(latestVerificationScore({ ...entry(), attestations: [run(b, 200, score), run(a, 100)] }), null);
  assert.equal(latestVerificationScore({ ...entry(), attestations: [run(a, 100, '0/4')] })?.pct, 0);
});
test('before/after uses the same run and denominator; absent or mismatched baselines remain unknown', () => {
  for (const pre_apply of [undefined, 'bad', '1/8', '5/4']) {
    const record = run(a, 200, '3/4', { score: { free_generation: '3/4', ...(pre_apply !== undefined ? { pre_apply } : {}) } });
    assert.equal(latestVerificationScore({ ...entry(), attestations: [record] })?.before, null);
  }
  const legacy = run(a, 200, '3/4', { executor: undefined, score: { free_generation_vllm: '3/4', pre_apply_vllm: '0/4' } });
  assert.equal(latestVerificationScore({ ...entry(), passed: 1, executors: [], executors_unknown: 1, attestations: [legacy] })?.before, '0/4');
});
