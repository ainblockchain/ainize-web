import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ainftTrainingLabel, ainftTrainingPending } from '../src/lib/ainft-training-status.js';

test('training progress distinguishes model load, baseline, real steps and serving restoration', () => {
  const job = { status: 'TRAINING', progress: { step: 20, maxSteps: 20, phase: 'restore-serving' } };
  assert.equal(ainftTrainingLabel(job, 'submitted', 'ko'), '대화 모델 다시 준비 중');
  assert.equal(ainftTrainingLabel({ ...job, progress: { ...job.progress, phase: 'load' } }, 'submitted', 'en'), 'Preparing the training model');
  assert.equal(ainftTrainingLabel({ ...job, progress: { ...job.progress, phase: 'baseline' } }, 'submitted', 'en'), 'Checking answers before training');
  assert.equal(ainftTrainingLabel({ ...job, progress: { step: 5, maxSteps: 20, phase: 'train' } }, 'submitted', 'en'), 'Training · 5/20');
  assert.equal(ainftTrainingLabel({ ...job, progress: { step: 25, maxSteps: 20, phase: 'train' } }, 'submitted', 'en'), 'Training');
});
test('only verified READY results claim evaluation and restoration passed', () => {
  assert.equal(ainftTrainingLabel({ status: 'READY' }, 'submitted', 'en'), 'Training finished; verification needs review');
  assert.equal(ainftTrainingLabel({ status: 'READY', applicationVerified: true }, 'submitted', 'en'), 'Evaluation and restoration verified');
  assert.equal(ainftTrainingLabel({ status: 'NEEDS_MORE' }, 'submitted', 'ko'), '추가 학습이 필요함');
});
test('submitted and active jobs keep polling, terminal and uncertain submissions stop', () => {
  assert.equal(ainftTrainingPending(null, 'submitted'), true);
  assert.equal(ainftTrainingPending({ status: 'TRAINING' }, 'submitted'), true);
  assert.equal(ainftTrainingPending({ status: 'CHECKING' }, 'submitted'), true);
  assert.equal(ainftTrainingPending({ status: 'READY' }, 'submitted'), false);
  assert.equal(ainftTrainingPending(null, 'unknown'), false);
});
