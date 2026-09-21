import test from 'node:test';
import assert from 'node:assert/strict';
import { parseM1Status, m1Group } from '../src/lib/m1-status';
const fixture = () => ({ version: 1, runId: 'test', generatedAt: 123, startedAt: null, privateKey: 'secret', jobs: Array.from({ length: 70 }, (_, i) => ({ index: i + 1, node: `node-${Math.floor(i / 14)}`, status: 'QUEUED', jobId: null, step: null, maxSteps: null, percent: null, updatedAt: null, facts: ['private prompt'] })) });
test('public snapshot strips private fields and keeps 70 assignments', () => {
  const parsed = parseM1Status(fixture());
  assert.equal(parsed.jobs.length, 70);
  assert.equal(JSON.stringify(parsed).includes('private'), false);
});
test('incomplete, malformed and mixed snapshots are rejected', () => {
  const short = fixture(); short.jobs.pop();
  assert.throws(() => parseM1Status(short));
  const duplicate = fixture(); duplicate.jobs[1].index = 1;
  assert.throws(() => parseM1Status(duplicate));
  const bad = fixture(); bad.jobs[0].status = 'MADE_UP';
  assert.throws(() => parseM1Status(bad));
});
test('needs-more and unknown are never counted as completed', () => {
  assert.equal(m1Group('NEEDS_MORE'), 'attention');
  assert.equal(m1Group('UNKNOWN'), 'unknown');
  assert.equal(m1Group('READY'), 'done');
  assert.equal(m1Group('EXPORTED'), 'active');
});
