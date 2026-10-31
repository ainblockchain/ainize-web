import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyNewPatchDraft, hasNewPatchEdits, newPatchDraftKey, newPatchFromSource, readNewPatchDraft } from '../src/lib/newPatchDraft';

test('stored drafts distinguish account, source and plain creation without guessing legacy ownership', () => {
  const keys = ['one', 'two'].flatMap(identity => [null, '', 'source', 'source/other'].map(from => newPatchDraftKey(identity, from)));
  assert.equal(new Set(keys).size, keys.length);
  for (const text of ['null', '[]', '{}', '{', '{"name":42}', '{"source":"else"}', '{"benchText":{}}']) assert.equal(readNewPatchDraft(text), null);
  assert.deepEqual(readNewPatchDraft('{"benchText":"{broken","name":"draft"}'), { benchText: '{broken', name: 'draft' });
});

test('JSON-only, model-only and upload-source-only edits are kept even when the parsed benchmark is invalid', () => {
  const initial = emptyNewPatchDraft('selected-model');
  assert.equal(hasNewPatchEdits({ ...initial }, initial), false);
  for (const patch of [{ benchText: '{broken' }, { modelId: 'another-model' }, { source: 'path' as const }, { asOf: '2026-10-31' }]) {
    assert.equal(hasNewPatchEdits({ ...initial, ...patch }, initial), true);
  }
});

test('new-version seed keeps every example and field and never returns the original id', () => {
  const id = 'a'.repeat(61) + '-v2';
  const anchor = { id, model: { id_M: 'source-model' }, price: '3', name: 'source', license: 'custom license', branch: 'chosen', topic_path: 'topic', as_of: '2026-10-31',
    benchmark: { schema: 'schema', queries: 8, format: ['chat'], samples: Array.from({ length: 8 }, (_, i) => ({ prompt: `q${i}`, expect: `a${i}`, source: `source${i}` })), extra: { preserved: true } } };
  const snapshot = JSON.stringify(anchor);
  const result = newPatchFromSource({ anchor }, id); assert.ok(result);
  assert.equal(result.license, anchor.license); assert.equal(result.parents, id); assert.equal(result.modelId, 'source-model');
  assert.equal(result.asOf, anchor.as_of); assert.equal(result.branch, anchor.branch); assert.equal(result.topic, anchor.topic_path);
  assert.notEqual(result.id, id); assert.ok(result.id.length <= 64);
  assert.deepEqual(JSON.parse(result.benchText), anchor.benchmark); assert.equal(JSON.stringify(anchor), snapshot);
  assert.equal(newPatchFromSource({ anchor }, 'different'), null);
  for (const patch of [{ model: null }, { price: 3 }, { benchmark: null }, { name: {} }, { license: [] }]) assert.equal(newPatchFromSource({ anchor: { ...anchor, ...patch } }, id), null);
});
