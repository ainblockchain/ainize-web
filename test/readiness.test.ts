/**
 * The entry page's readiness line (ux-critique-owner O-5): plain language first, and a minute figure only when this
 * node measured it — design §10 / §8.4. Every branch is driven from the real dictionary so the sentences asserted
 * here are the sentences a visitor reads.
 *
 *   node --test --import tsx test/readiness.test.ts     (packages/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readiness } from '../src/components/teach/util.ts';
import { teach } from '../src/i18n/pages/teach.ts';
import type { TeachPolicy } from '../src/api/types.ts';

const t = (key: string, vars?: Record<string, string | number>, count?: number): string => {
  const e = (count === 1 ? teach[`${key}_one`] : undefined) ?? teach[key];
  if (!e) return key;
  return vars ? e.en.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : e.en;
};
const TECH = 'Teaching on this node: open · 0 waiting · (technical)';

function policy(over: Partial<TeachPolicy> & { queue?: Partial<TeachPolicy['queue']>; timing?: Partial<TeachPolicy['timing']> } = {}): TeachPolicy {
  return {
    enabled: true, publish: 'auto', trainer: 'ready', backend: 'gradient',
    limits: { facts_per_job: 8, jobs_per_key_per_day: 3, jobs_per_ip_per_day: 5, prompt_max: 400, answer_max: 200 },
    shares: { contributor: 0.7, lineage: 0.3 }, model: { id_M: null }, applied: [], draft_ttl_days: 7, simulated_checks: false,
    ...over,
    queue: { depth: 0, max: 10, ...(over.queue ?? {}) },
    timing: { p50_s: null, p90_s: null, samples: 0, simulated: false, ...(over.timing ?? {}) },
  } as TeachPolicy;
}

test('no policy yet → nothing to say', () => {
  assert.deepEqual(readiness(undefined, t, TECH), { text: '', ok: false, detail: [] });
});

test('off and paused: the node\'s own plain sentence, warning tone, no disclosure', () => {
  assert.deepEqual(readiness(policy({ enabled: false }), t, TECH), { text: 'This node does not accept lessons. Try another node or run your own.', ok: false, detail: [] });
  assert.deepEqual(readiness(policy({ trainer: 'paused', paused_reason: 'GPU maintenance until Monday' }), t, TECH), { text: 'Teaching is paused on this node right now. GPU maintenance until Monday', ok: false, detail: [] });
  assert.equal(readiness(policy({ trainer: 'paused' }), t, TECH).text, 'Teaching is paused on this node right now.');
});

test('open, nobody waiting, nothing measured: "You can start now" and no minutes anywhere', () => {
  const r = readiness(policy(), t, TECH);
  assert.equal(r.text, 'You can start now — nobody is waiting.');
  assert.equal(r.ok, true);
  assert.deepEqual(r.detail, [TECH, 'Queue: 0 of 10 lessons']);
  assert.doesNotMatch(r.text + r.detail.join(' '), /\bmin\b/);
});

test('the queue is counted in lessons, singular and plural', () => {
  assert.equal(readiness(policy({ queue: { depth: 1 } }), t, TECH).text, 'You can start now — 1 lesson is ahead of you.');
  assert.equal(readiness(policy({ queue: { depth: 3 } }), t, TECH).text, 'You can start now — 3 lessons are ahead of you.');
  assert.deepEqual(readiness(policy({ queue: { depth: 3 } }), t, TECH).detail, [TECH, 'Queue: 3 of 10 lessons']);
});

test('a full queue is a warning, not "you can start now"', () => {
  const r = readiness(policy({ queue: { depth: 10, max: 10 } }), t, TECH);
  assert.equal(r.text, 'The queue is full right now — try again in a little while.');
  assert.equal(r.ok, false);
  assert.deepEqual(r.detail, [TECH, 'Queue: 10 of 10 lessons']);
});

test('minutes appear only from ≥ 3 measured samples, and never on a simulated node', () => {
  // two samples: not enough
  assert.equal(readiness(policy({ timing: { samples: 2, p50_s: 240, p90_s: 300 } }), t, TECH).text, 'You can start now — nobody is waiting.');
  // three samples, measured: about N min (equal rounded minutes never print "4–4")
  const about = readiness(policy({ timing: { samples: 3, p50_s: 240, p90_s: 250 } }), t, TECH);
  assert.equal(about.text, 'You can start now — nobody is waiting. Recent lessons took about 4 min each.');
  assert.deepEqual(about.detail, [TECH, 'Queue: 0 of 10 lessons', 'Measured on this node over 3 real lessons: median 240 s, 90th percentile 250 s']);
  // a range when the minutes differ
  assert.equal(readiness(policy({ queue: { depth: 2 }, timing: { samples: 8, p50_s: 240, p90_s: 600 } }), t, TECH).text, 'You can start now — 2 lessons are ahead of you. Recent lessons took 4–10 min each.');
  // sub-minute lessons say so instead of "about 1 min"
  assert.equal(readiness(policy({ timing: { samples: 5, p50_s: 20, p90_s: 40 } }), t, TECH).text, 'You can start now — nobody is waiting. Recent lessons finished in under a minute.');
  // the same eight samples on a node whose trainer is the stub: no minutes, no "measured" line
  const demo = readiness(policy({ backend: 'stub', timing: { samples: 8, p50_s: 1.6, p90_s: 1.7, simulated: true } }), t, TECH);
  assert.equal(demo.text, 'You can start now — nobody is waiting.');
  assert.deepEqual(demo.detail, [TECH, 'Queue: 0 of 10 lessons']);
});
