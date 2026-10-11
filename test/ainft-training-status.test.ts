import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ainftTrainingFailure, ainftTrainingLabel, ainftTrainingPending, ainftTrainingVerificationIssue } from '../src/lib/ainft-training-status.js';

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

test('failure messages explain the outcome without exposing process IDs or stack traces', () => {
  const label = ainftTrainingFailure('OutOfMemoryError: CUDA out of memory. Process 12345 /private/path', 'en');
  assert.match(label, /ran out of memory/); assert.ok(!label.includes('12345')); assert.ok(!label.includes('/private/path'));
  assert.match(ainftTrainingFailure('trainer timed out', 'en'), /time limit/);
  assert.equal(ainftTrainingFailure('unknown stack trace', 'ko'), '학습을 완료하지 못했습니다. 운영자가 작업 기록을 확인해야 합니다.');
});

test('failed lesson checks explain why selection is refused without leaking internal error text', () => {
  assert.match(ainftTrainingVerificationIssue('other-answers-changed', 'en'), /Other answers changed.*cannot be selected/);
  assert.match(ainftTrainingVerificationIssue('unseen-question-missing', 'ko'), /학습에 쓰지 않은 확인 질문/);
  assert.match(ainftTrainingVerificationIssue('restoration-incomplete', 'en'), /restoration verification has not passed/);
  const unknown = ainftTrainingVerificationIssue('/private/server/path CUDA error', 'en');
  assert.match(unknown, /Verification is incomplete/);
  assert.doesNotMatch(unknown, /private|CUDA/);
});
