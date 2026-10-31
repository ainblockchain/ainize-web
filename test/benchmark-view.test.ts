import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkView } from '../src/lib/benchmarkView';

const item = {
  anchor: { id: 'chosen', author: 'author', name: 'Chosen knowledge', created_at: 1, rows: 10, size_bytes: 20,
    price: '0', model: { id_M: 'base' }, benchmark: { schema: 'topic', queries: 3, format: ['chat'] } },
  status: 'VERIFIED', attestations: [], passed: 2, quorum: 2, quorum_ok: true, downloads: 1,
};

test('comparison responses must name the selected topic and keep every row valid', () => {
  assert.deepEqual(benchmarkView({ schema: 'topic', items: [] }, 'topic'), { schema: 'topic', items: [] });
  assert.ok(benchmarkView({ schema: 'topic', items: [item] }, 'topic'));
  for (const raw of [{}, { schema: 'other', items: [item] }, { schema: 'topic', items: {} }, { schema: 'topic', items: [item, item] }]) {
    assert.equal(benchmarkView(raw, 'topic'), null);
  }
});

test('missing comparison fields cannot crash rendering or silently become an unscored or empty result', () => {
  for (const row of [{}, { ...item, attestations: null }, { ...item, attestations: [null] }, { ...item, passed: -1 },
    { ...item, anchor: { ...item.anchor, model: null } }, { ...item, anchor: { ...item.anchor, benchmark: { schema: 'other', queries: 3, format: [] } } },
    { ...item, anchor: { ...item.anchor, parents: {} } }, { ...item, anchor: { ...item.anchor, base: { stack: [{}] } } },
    { ...item, anchor: { ...item.anchor, benchmark: { ...item.anchor.benchmark, format: {} } } }, { ...item, status: 'DRAFT' }]) {
    assert.equal(benchmarkView({ schema: 'topic', items: [item, row] }, 'topic'), null);
  }
});


test('comparison reads legacy question cases as counts and preserves the original source anchor', () => {
  const cases = [{ prompt: 'Question one', expect: 'Answer one' }, { prompt: 'Question two', expect: 'Answer two' }];
  const legacy = { ...item, anchor: { ...item.anchor, benchmark: { ...item.anchor.benchmark, queries: cases } } };
  const view = benchmarkView({ schema: 'topic', items: [legacy] }, 'topic');
  assert.equal(view?.items[0].anchor.benchmark.queries, 2);
  assert.deepEqual(legacy.anchor.benchmark.queries, cases);
  const bad = { ...legacy, anchor: { ...legacy.anchor, benchmark: { ...legacy.anchor.benchmark, queries: [null] } } };
  assert.equal(benchmarkView({ schema: 'topic', items: [bad] }, 'topic'), null);
});
