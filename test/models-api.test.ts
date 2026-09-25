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
import { parseModelsResponse, modelsByModality } from '../src/api/models';

test('a node answer parses into cards', () => {
  const parsed = parseModelsResponse({ object: 'list', data: [{ id: 'qwen3-asr', modality: 'transcription', available: true }] });
  assert.deepEqual(parsed, [{ id: 'qwen3-asr', modality: 'transcription', available: true }]);
});

test('an empty list is a node that serves nothing, not a failure', () => {
  assert.deepEqual(parseModelsResponse({ object: 'list', data: [] }), []);
});

test('a malformed answer is an empty list rather than a crash', () => {
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
