import { test } from 'node:test';
import assert from 'node:assert/strict';
import { benchmarkEditorSamples, editBenchmarkDraft, readBenchmarkDraft } from '../src/lib/benchmarkEditor';

const question = (i: number) => ({ prompt: `Question ${i}`, expect: `Answer ${i}`, source: `parent-${i}`, extra: { retained: true } });
const draft = { schema: 'chosen/topic', queries: 8, format: ['chat'], samples: Array.from({ length: 8 }, (_, i) => question(i)), answers_hash: 'existing-hash', custom: { source: 'keep' } };

test('benchmark JSON preserves all cases and metadata through plain-field edits', () => {
  const read = readBenchmarkDraft(JSON.stringify(draft)); assert.ok(read.value);
  const next = editBenchmarkDraft(read.value, { schema: 'new/topic' });
  assert.equal(next.samples?.length, 8); assert.deepEqual(next.samples, draft.samples);
  assert.deepEqual(next.custom, draft.custom); assert.equal(next.answers_hash, draft.answers_hash);
  assert.equal(read.value.schema, 'chosen/topic');
  assert.deepEqual(readBenchmarkDraft(JSON.stringify(next), true).value, next);
});

test('legacy embedded cases stay in their original field and preserve separate samples', () => {
  const read = readBenchmarkDraft(JSON.stringify({ schema: 'legacy', queries: [question(1), question(2)], format: 'template/chat' })); assert.ok(read.value);
  assert.deepEqual(benchmarkEditorSamples(read.value), read.value.queries);
  const next = editBenchmarkDraft(read.value, { samples: [...benchmarkEditorSamples(read.value), question(3)] });
  assert.equal((next.queries as unknown[]).length, 3); assert.equal(Object.hasOwn(next, 'samples'), false);
  assert.deepEqual(readBenchmarkDraft(JSON.stringify(next), true).value, next);
  const separate = { ...next, samples: [question(9)] };
  const changed = editBenchmarkDraft(separate, { samples: [question(10)] });
  assert.deepEqual(changed.queries, next.queries); assert.deepEqual(changed.samples, [question(10)]);
});

test('malformed JSON and field shapes are rejected rather than coerced or replaced with a default', () => {
  for (const text of ['{', 'null', '[]', '4', JSON.stringify({ ...draft, schema: 42 }), JSON.stringify({ ...draft, queries: '8' }), JSON.stringify({ ...draft, samples: [null] }), JSON.stringify({ ...draft, samples: [{ prompt: 1, expect: {} }] }), JSON.stringify({ ...draft, format: { chat: true } }), JSON.stringify({ ...draft, collateral_bound_nat: '0.1' })]) assert.ok(readBenchmarkDraft(text).issue);
});

test('submission validates incomplete numbers and examples without silently increasing counts', () => {
  for (const queries of [-1, 1.5]) {
    const text = JSON.stringify({ ...draft, queries });
    assert.ok(readBenchmarkDraft(text).value); assert.equal(readBenchmarkDraft(text, true).issue, 'queries');
  }
  const next = editBenchmarkDraft(draft, { queries: 1 });
  assert.equal(next.queries, 1); assert.equal(readBenchmarkDraft(JSON.stringify(next), true).issue, 'sample_count');
  assert.equal(readBenchmarkDraft(JSON.stringify({ ...draft, samples: [{ prompt: '', expect: '' }] }), true).issue, 'sample_prompt');
  assert.equal(readBenchmarkDraft(JSON.stringify({ ...draft, schema: ' ' }), true).issue, 'schema');
  const noSamples = { schema: 'empty', queries: 0, format: ['chat'], samples: [] };
  assert.deepEqual(readBenchmarkDraft(JSON.stringify(noSamples), true).value, noSamples);
  assert.equal(readBenchmarkDraft(JSON.stringify({ ...noSamples, collateral_bound_nat: -1 }), true).issue, 'bound');
  assert.equal(Object.hasOwn(editBenchmarkDraft({ ...draft, collateral_bound_nat: 0.1 }, { collateral_bound_nat: undefined }), 'collateral_bound_nat'), false);
});
