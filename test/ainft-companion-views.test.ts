import { test } from 'node:test';
import assert from 'node:assert/strict';
import { companionView, trainingView, rewardsView, trainingConsentKey, missingTrainingExamples, rewardAccountMatches } from '../src/lib/ainftCompanionViews';
import { benefitUsable, selectedBenefit, type BenefitCatalog, type BenefitPurchase } from '../src/lib/ainftBenefitPurchase';

const workspace = { tasks: [{ id: 'task', input: 'My request', state: 'completed', result: 'Done', error: null }], memories: [{ id: 'memory', text: 'Remember', state: 'approved', sourceTask: 'task' }], experience: 1 };
test('holder workspace rejects malformed/duplicate private rows instead of silently losing or rendering them', () => {
  assert.deepEqual(companionView(workspace).learningExamples, []);
  for (const value of [null, {}, { ...workspace, tasks: {} }, { ...workspace, tasks: [workspace.tasks[0], workspace.tasks[0]] }, { ...workspace, memories: [{ ...workspace.memories[0], text: {} }] }, { ...workspace, growthEvidence: [{}] }]) assert.throws(() => companionView(value), /Could not read/);
});

test('unavailable training remains a valid state; malformed nested jobs cannot become actionable lessons', () => {
  const base = { selectedRunId: null, capability: { available: false, model: null, reason: 'Unavailable', maxExamples: 0 }, runs: [], publications: [] };
  assert.equal(trainingView(base).capability.available, false);
  assert.throws(() => trainingView({ ...base, capability: { ...base.capability, available: true } }), /Could not read/);
  const run = { id: 'one', model: 'model-a', state: 'submitted', eligible: true, jobId: 'job', job: { status: 'READY', error: null, draftId: 'draft', applicationVerified: true } };
  assert.equal(trainingView({ ...base, runs: [run] }).runs[0].id, 'one');
  for (const job of [{ ...run.job, verificationIssues: {} }, { ...run.job, error: {} }, { ...run.job, progress: { step: 'bad' } }]) assert.throws(() => trainingView({ ...base, runs: [{ ...run, job }] }), /Could not read/);
  assert.throws(() => rewardsView({ available: true, enrollment: {}, rewards: [] }), /Could not read/);
  assert.deepEqual(rewardsView({ available: false, enrollment: null, rewards: [] }), { available: false, enrollment: null, rewards: [] });
});

test('model or example changes invalidate training consent and missing selected examples cannot be replaced', () => {
  const examples = [{ id: 'one', prompt: 'Q', answer: 'A', altPrompt: 'Q2', state: 'reviewed' }];
  const consent = trainingConsentKey('model-a', ['one']);
  assert.notEqual(trainingConsentKey('model-b', ['one']), consent);
  assert.notEqual(trainingConsentKey('model-a', ['two']), consent);
  assert.equal(missingTrainingExamples(examples, ['one']), false);
  assert.equal(missingTrainingExamples(examples, ['missing']), true);
  assert.equal(missingTrainingExamples([{ ...examples[0], state: 'withdrawn' }], ['one']), true);
});

test('allowance selection requires the exact currently usable receipt and policy version', () => {
  const receipt: BenefitPurchase = { id: 'one', fingerprint: 'fingerprint', agentId: 'agent', userId: 'user', policyVersion: 2, cost: 5, units: 3, remaining: 3, refundUntil: 100, status: 'active', settled: false };
  const catalog: BenefitCatalog = { agentId: 'agent', policy: null, purchases: [receipt, { ...receipt, id: 'other' }] };
  const connection = { executionAvailable: true, allowedPolicyVersions: [2] };
  assert.equal(selectedBenefit(catalog, connection, 'one', 2), receipt);
  assert.equal(selectedBenefit(catalog, connection, 'missing', 2), null);
  assert.equal(selectedBenefit(catalog, connection, 'one', 3), null);
  assert.equal(benefitUsable({ ...receipt, status: 'refunded' }, connection), false);
  assert.equal(benefitUsable({ ...receipt, remaining: 0 }, connection), false);
  assert.equal(benefitUsable(receipt, { ...connection, allowedPolicyVersions: [3] }), false);
  assert.equal(benefitUsable(receipt, { ...connection, executionAvailable: false }), false);
});


test('paid work cannot use another Factory enrollment even when the typed account has a purchase', () => {
  const enrollment = { userId: 'one', appId: 'studio', symbol: 'POINT', policyVersion: 1 };
  const rewards = { available: true, enrollment, rewards: [] };
  const community = { appId: 'studio', symbol: 'POINT' };
  assert.equal(rewardAccountMatches(rewards, 'one', community), true);
  assert.equal(rewardAccountMatches(rewards, 'two', community), false);
  assert.equal(rewardAccountMatches({ ...rewards, enrollment: null }, 'one', community), false);
  assert.equal(rewardAccountMatches(rewards, 'one', { ...community, appId: 'other' }), false);
  assert.throws(() => rewardsView({ ...rewards, rewards: [{ eventId: 'event', kind: 'unknown', state: 'confirmed', ...community }] }), /Could not read/);
});
