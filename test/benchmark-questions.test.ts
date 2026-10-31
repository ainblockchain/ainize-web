import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkCoverage, benchmarkQuestionCount } from '../src/lib/benchmarkQuestions';

test('declared question counts accept numeric and embedded cases without mutating the signed data', () => {
  const cases = [{ prompt: 'one', expect: 'answer' }, { prompt: 'two', expect: 'answer' }];
  const original = JSON.stringify(cases);
  assert.equal(benchmarkQuestionCount(cases), 2);
  assert.equal(JSON.stringify(cases), original);
  assert.equal(benchmarkQuestionCount(4), 4); assert.equal(benchmarkQuestionCount(0), 0);
  assert.equal(benchmarkQuestionCount([]), 0);
  for (const value of [undefined, null, '4', -1, 1.5, Infinity, NaN, [null], [{ prompt: 'one' }], [{ prompt: 1, expect: 'answer' }]]) assert.equal(benchmarkQuestionCount(value), null);
});

test('missing or inconsistent measurement counts never imply that every declared question was tested', () => {
  assert.equal(benchmarkCoverage(null, 100), 'unknown');
  assert.equal(benchmarkCoverage(0, 0), 'unknown');
  assert.equal(benchmarkCoverage(3, 100), 'declared');
  assert.equal(benchmarkCoverage(3, 3), 'declared');
  assert.equal(benchmarkCoverage(3, 2), 'declared');
  assert.equal(benchmarkCoverage(3, undefined), 'measured');
  assert.equal(benchmarkCoverage(3.5, 3), 'unknown');
});
