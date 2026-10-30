import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearJobs, forgetJob, JOBS_KEY, loadJobs, rememberJob } from '../src/lib/teachStore';

const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
});
afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

test('history, deduplication and removal belong to the captured teaching identity', () => {
  const a = { id: 'same-id', name: 'A lesson', created_at: 1 };
  const b = { ...a, name: 'B lesson' };
  rememberJob(a, '0xABC'); rememberJob(b, '0xdef');
  rememberJob({ ...a, name: 'A updated' }, '0xabc');
  assert.deepEqual(loadJobs('0xABC'), [{ ...a, name: 'A updated' }]);
  assert.deepEqual(loadJobs('0xdef'), [b]);
  forgetJob(a.id, '0xabc');
  assert.deepEqual(loadJobs('0xabc'), []);
  assert.deepEqual(loadJobs('0xdef'), [b]);
  clearJobs('0xdef'); assert.deepEqual(loadJobs('0xdef'), []);
});

test('legacy records are retained but never assigned to an anonymous or unrelated teacher', () => {
  values.set(JOBS_KEY, JSON.stringify([{ id: 'unowned-private-job', created_at: 1 }]));
  for (const owner of ['', '0xabc', '0xdef']) assert.deepEqual(loadJobs(owner), []);
  rememberJob({ id: 'anonymous', created_at: 1 }, '');
  clearJobs('');
  assert.ok(values.get(JOBS_KEY)?.includes('unowned-private-job'));
  assert.equal(values.size, 1);
});

test('damaged and unavailable history storage does not break the page', () => {
  values.set(`${JOBS_KEY}:0xabc`, 'null'); assert.deepEqual(loadJobs('0xabc'), []);
  values.set(`${JOBS_KEY}:0xabc`, '{broken'); assert.deepEqual(loadJobs('0xabc'), []);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('unavailable'); } });
  assert.deepEqual(loadJobs('0xabc'), []);
  assert.doesNotThrow(() => rememberJob({ id: 'one', created_at: 1 }, '0xabc'));
});
