/**
 * The shape the Models page is built on, pinned where it crosses a repository boundary.
 *
 * The node and this app are released separately, so `/api/models` is a contract between two things that move
 * independently. Nothing else in this suite would notice a field renamed on the other side — the page would
 * simply go blank, and the blank page looks exactly like a node that serves nothing.
 *
 *   node --test --import tsx test/models-api.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseModelsResponse, modelsByModality, modelsFetchState, readModelsResponse, modelDetailViewState } from '../src/api/models';

test('embedding and speech models remain visible in their own groups', () => {
  const cards = parseModelsResponse({ data: [
    { id: 'embed', modality: 'embedding', available: true },
    { id: 'voice', modality: 'speech', available: false },
  ] });
  assert.equal(cards.length, 2);
  assert.deepEqual(modelsByModality(cards).map(group => group.modality), ['embedding', 'speech']);
  assert.equal(cards[1].available, false);
});

test('music models are kept and grouped after speech', () => {
  const cards = parseModelsResponse({ data: [
    { id: 'ace-step-1.5', modality: 'music', available: true },
    { id: 'voice', modality: 'speech', available: true },
  ] });
  assert.equal(cards.length, 2);
  assert.deepEqual(modelsByModality(cards).map(group => group.modality), ['speech', 'music']);
});

test('a node answer parses into cards', () => {
  const parsed = parseModelsResponse({ object: 'list', data: [{ id: 'qwen3-asr', modality: 'transcription', available: true }] });
  assert.deepEqual(parsed, [{ id: 'qwen3-asr', modality: 'transcription', available: true }]);
});

test('an empty list is a node that serves nothing, not a failure', () => {
  assert.deepEqual(parseModelsResponse({ object: 'list', data: [] }), []);
});

test('array-only legacy consumers fail closed on malformed answers', () => {
  assert.deepEqual(parseModelsResponse(null), []);
  assert.deepEqual(parseModelsResponse(undefined), []);
  assert.deepEqual(parseModelsResponse({ data: 'nonsense' }), []);
  assert.deepEqual(parseModelsResponse({ data: [null, 7, 'x'] }), []);
});

test('an unknown modality is dropped rather than rendered as a broken card', () => {
  const parsed = parseModelsResponse({ object: 'list', data: [
    { id: 'ok', modality: 'chat', available: true },
    { id: 'future', modality: 'video', available: true },
  ] });
  assert.deepEqual(parsed.map((m) => m.id), ['ok'], 'a newer node may serve a modality this page cannot drive');
});

test('a card with no id is dropped — there is nothing to call', () => {
  const parsed = parseModelsResponse({ object: 'list', data: [{ modality: 'chat', available: true }] });
  assert.deepEqual(parsed, []);
});

test('availability defaults to false rather than true when the node omits it', () => {
  // An older node without the field must not have its models drawn as ready to use.
  const parsed = parseModelsResponse({ object: 'list', data: [{ id: 'old', modality: 'chat' }] });
  assert.equal(parsed[0].available, false);
});

test('cards group by modality in the order the page shows them', () => {
  const grouped = modelsByModality([
    { id: 'i', modality: 'image', available: true },
    { id: 'c', modality: 'chat', available: true },
    { id: 't', modality: 'transcription', available: false },
  ]);
  assert.deepEqual(grouped.map((g) => g.modality), ['chat', 'transcription', 'image']);
  assert.deepEqual(grouped.map((g) => g.models.map((m) => m.id)), [['c'], ['t'], ['i']]);
});

test('a modality with no models is not a group', () => {
  const grouped = modelsByModality([{ id: 'c', modality: 'chat', available: true }]);
  assert.deepEqual(grouped.map((g) => g.modality), ['chat'], 'an empty heading is a promise the node did not make');
});

test('two models of one modality stay together, in the order the node gave them', () => {
  const grouped = modelsByModality([
    { id: 'first', modality: 'chat', available: true },
    { id: 'second', modality: 'chat', available: false },
  ]);
  assert.deepEqual(grouped[0].models.map((m) => m.id), ['first', 'second']);
});

test('a 404 is a node older than this page, not a node that is down', () => {
  // Production hit exactly this: the node answered every other route and had never heard of /api/models.
  // Calling that "not answering" is wrong twice over — it answers, and it serves a model.
  assert.equal(modelsFetchState({ status: 404 }), 'outdated');
});

test('a 404 delivered as HTML is still a 404', () => {
  // What actually arrives: Express answers an unknown route with an HTML page, RTK Query cannot parse it as
  // JSON, and the real code moves to `originalStatus`. Reading only `status` here reported production — a live
  // node running an older build — as unreachable.
  assert.equal(modelsFetchState({ status: 'PARSING_ERROR', originalStatus: 404 }), 'outdated');
});

test('a parsing error over a real failure is still a failure', () => {
  assert.equal(modelsFetchState({ status: 'PARSING_ERROR', originalStatus: 502 }), 'offline');
});

test('any other error is a node that is not answering', () => {
  assert.equal(modelsFetchState({ status: 502 }), 'offline');
  assert.equal(modelsFetchState({ status: 'FETCH_ERROR' }), 'offline');
});

test('no error at all is a node that answered', () => {
  assert.equal(modelsFetchState(undefined), 'ok');
});

test('list evidence separates valid empty lists, unsupported types and corrupt or ambiguous entries', () => {
  assert.deepEqual(readModelsResponse({ data: [] }), { models: [], unsupported: 0 });
  assert.deepEqual(readModelsResponse({ data: [{ id: 'future', modality: 'video', available: true }] }), { models: [], unsupported: 1 });
  const model = { id: 'chosen', modality: 'chat', available: true };
  for (const value of [null, {}, { data: [null] }, { data: [model, model] }, { data: [{ ...model, available: 'true' }] }]) assert.equal(readModelsResponse(value), null);
});

test('detail failures cannot reuse stale successful data or claim a malformed list proves absence', () => {
  const model = { id: 'chosen', modality: 'chat', available: true };
  const base = { id: 'chosen', detail: model, detailError: undefined, detailLoading: false, list: { data: [model] }, listError: undefined, listLoading: false };
  assert.equal(modelDetailViewState({ ...base, detailError: { status: 503 } }).kind, 'offline');
  assert.equal(modelDetailViewState({ ...base, detail: { ...model, id: 'wrong' } }).kind, 'invalid');
  assert.equal(modelDetailViewState({ ...base, detailError: { status: 404 }, list: {} }).kind, 'invalid');
  assert.equal(modelDetailViewState({ ...base, detailError: { status: 404 }, listError: { status: 503 } }).kind, 'offline');
  assert.equal(modelsFetchState({ status: 'PARSING_ERROR', originalStatus: 200 }), 'invalid');
});
