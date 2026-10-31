import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmHostedAgentSelection, hostedAgentModels, hostedAgentModelChoice, hostedAgentModelHref, hostedAgentModelPrefill, hostedAgentSelectionUsable } from '../src/api/hostedAgentModels';

const self = '0x' + 'a'.repeat(40), peer = '0x' + 'b'.repeat(40);
const chat = { id: 'chosen', modality: 'chat', available: true };
const advert = { ...chat, node: { address: peer }, ref: `chosen@${peer}`, local: false };
const selection = { model: `chosen@${self}`, media: { transcription: false, image: false } };
const input = { self, own: { data: [chat] }, network: { data: [advert] } };

test('agent choices keep local and exact peer identities with matching detail destinations', () => {
  const read = hostedAgentModels(input);
  assert.equal(read.complete, true);
  assert.deepEqual(read.choices.map(row => row.id), [`chosen@${self}`, advert.ref]);
  assert.equal(read.choices[0].href, `/models/chosen?modality=chat&node=${self}`);
  assert.equal(read.choices[1].href, `/models/chosen?modality=chat&node=${peer}`);
  assert.equal(hostedAgentModelChoice(read.choices, 'missing'), null);
  assert.equal(hostedAgentModelChoice(read.choices, `chosen@0x${'c'.repeat(40)}`), null);
  for (const address of [self, peer, '0x' + 'B'.repeat(40)]) {
    const id = `chosen@${address}`;
    assert.equal(hostedAgentModelChoice(read.choices, id)?.id, id, 'original option value is preserved');
    assert.equal(hostedAgentModelHref(id), `/models/chosen?modality=chat&node=${address.toLowerCase()}`);
  }
  assert.equal(hostedAgentModelHref('folder/model'), '/models/folder%2Fmodel?modality=chat');
});

test('malformed and failed catalogue reads never resurrect cached selectable choices', () => {
  for (const read of [
    hostedAgentModels({ ...input, own: {}, network: {} }),
    hostedAgentModels({ ...input, ownError: { status: 503 }, networkError: { status: 503 } }),
    hostedAgentModels({ ...input, own: { data: [chat, chat] }, network: { data: [{ ...advert, ref: 'wrong' }] } }),
  ]) {
    assert.equal(read.complete, false);
    assert.deepEqual(read.choices, []);
    assert.equal(hostedAgentSelectionUsable(selection, read), false);
  }
  assert.equal(hostedAgentModels({ self, own: { data: [] }, network: { data: [] } }).complete, true);
  const oldNode = hostedAgentModels({ ...input, networkError: { status: 'PARSING_ERROR', originalStatus: 404 } });
  assert.equal(oldNode.complete, true);
  assert.deepEqual(oldNode.choices.map(row => row.id), [`chosen@${self}`]);
});

test('partial results enable only independently confirmed choices, never local adverts as probes', () => {
  const partial = hostedAgentModels({ ...input, ownError: { status: 503 } });
  assert.equal(partial.complete, false);
  assert.deepEqual(partial.choices.map(row => row.id), [advert.ref]);
  assert.equal(hostedAgentSelectionUsable(selection, partial), false);
  assert.equal(hostedAgentSelectionUsable({ ...selection, model: advert.ref }, partial), true);
  const localAdvert = hostedAgentModels({ self, own: {}, network: { data: [{ ...advert, local: true, node: { address: self }, ref: `chosen@${self}` }] } });
  assert.deepEqual(localAdvert.choices, []);
  const noProbe = hostedAgentModels({ ...input, own: { data: [{ ...chat, available: undefined }] } });
  assert.equal(noProbe.choices[0].availabilityKnown, false);
  assert.equal(hostedAgentSelectionUsable(selection, noProbe), true, 'known registration permits configuration without claiming health');
});

test('an existing missing model is retained for unrelated edits, never replaced by another choice', () => {
  const read = hostedAgentModels({ ...input, own: { data: [{ ...chat, id: 'another' }] } });
  assert.equal(hostedAgentSelectionUsable(selection, read), false);
  assert.equal(hostedAgentSelectionUsable(selection, read, selection), true);
  assert.equal(hostedAgentSelectionUsable({ ...selection, model: 'unknown' }, read, selection), false);
  assert.equal(hostedAgentSelectionUsable({ ...selection, model: '' }, read, selection), false);
  assert.equal(hostedAgentModelChoice(read.choices, selection.model), null);
});

test('new media needs a registered model; saved media can be preserved or disabled', () => {
  const enabled = { ...selection, media: { transcription: true, image: true } };
  const down = hostedAgentModels({ ...input, own: { data: [chat, { id: 'stt', modality: 'transcription', available: false }] } });
  assert.equal(down.media.transcription, true, 'registered local media can be configured while its health probe is down');
  assert.equal(hostedAgentSelectionUsable(enabled, down), false, 'image registration is still missing');
  assert.equal(hostedAgentSelectionUsable(enabled, down, enabled), true);
  assert.equal(hostedAgentSelectionUsable(selection, down, enabled), true);
  const available = hostedAgentModels({ ...input, own: { data: [chat, { id: 'stt', modality: 'transcription', available: true }] },
    network: { data: [{ ...advert, id: 'image', ref: `image@${peer}`, modality: 'image' }] } });
  assert.equal(hostedAgentSelectionUsable(enabled, available), true);
  const failed = hostedAgentModels({ ...input, ownError: { status: 503 }, network: { data: [] } });
  assert.equal(hostedAgentSelectionUsable(enabled, failed), false);
});

test('save preflight refuses a disappeared peer and newly missing media without a write', async () => {
  let writes = 0;
  const chosenPeer = { ...selection, model: advert.ref };
  const save = async (network: unknown, wanted = chosenPeer) => {
    await confirmHostedAgentSelection({ selection: wanted, self, current: () => true, own: async () => input.own, network: async () => network });
    writes++;
  };
  for (const data of [[], [{ ...advert, available: false }], [{ ...advert, node: { address: self }, ref: `chosen@${self}` }], [{ ...advert, modality: 'image' }]]) {
    await assert.rejects(save({ data }), /model_selection_unavailable/);
  }
  await assert.rejects(save(input.network, { ...chosenPeer, media: { transcription: true, image: false } }), /model_selection_unavailable/);
  assert.equal(writes, 0);
  await save(input.network);
  assert.equal(writes, 1);
  await confirmHostedAgentSelection({ selection, self, current: () => true,
    own: async () => ({ data: [{ ...chat, available: false }] }), network: async () => ({ data: [] }) });
});

test('failed read or account/node departure cannot proceed to a new save', async () => {
  let writes = 0, live = true, reads = 0;
  const run = async (own: () => Promise<unknown>) => {
    await confirmHostedAgentSelection({ selection, self, current: () => live, own, network: async () => { reads++; return input.network; } });
    writes++;
  };
  await assert.rejects(run(async () => { throw new Error('offline'); }), /model_selection_unavailable/);
  await assert.rejects(run(async () => { live = false; return input.own; }), /editor_departed/);
  const previousReads = reads;
  await assert.rejects(run(async () => { throw new Error('must not read'); }), /editor_departed/);
  assert.equal(reads, previousReads);
  assert.equal(writes, 0);
});

test('preflight preserves existing choices through an outage and leaves acceptance to the save endpoint', async () => {
  const existing = { ...selection, media: { transcription: true, image: true } };
  await confirmHostedAgentSelection({ selection: existing, existing, self, current: () => true,
    own: async () => { throw new Error('offline'); }, network: async () => { throw new Error('offline'); } });
});


test('new local choices and prefills pin the provider while saved automatic references remain explicit', () => {
  const read = hostedAgentModels(input);
  assert.equal(read.choices[0].id, `chosen@${self}`);
  assert.equal(hostedAgentModelPrefill('chosen', self), `chosen@${self}`);
  assert.equal(hostedAgentModelPrefill(advert.ref, self), advert.ref);
  assert.equal(hostedAgentModelPrefill('', self), '');
  const legacy = { ...selection, model: 'chosen' };
  assert.equal(hostedAgentSelectionUsable(legacy, read), false, 'new spec cannot accidentally retain automatic routing');
  assert.equal(hostedAgentSelectionUsable(legacy, read, legacy), true, 'unrelated edits do not rewrite existing routing');
  assert.equal(hostedAgentModelChoice(read.choices, 'chosen')?.id, 'chosen', 'the legacy option stays selected');
  const unidentified = hostedAgentModels({ ...input, self: null });
  assert.equal(hostedAgentSelectionUsable(legacy, unidentified), false);
  assert.equal(hostedAgentSelectionUsable({ ...selection, model: advert.ref }, unidentified), true, 'a known remote address remains exact');
});
