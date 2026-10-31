/**
 * The network's models as the Models pages draw them (src/api/networkModels.ts): an id served by several nodes is
 * one card with several providers, and a page drives exactly one of them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkModelCatalogue, networkModelHref, networkProviderLabel, parseNetworkModelsResponse, pickNetworkModelProvider, readNetworkModelsResponse, selectNetworkModel } from '../src/api/networkModels';

const MAIN = '0xab6fc64ed70dea2294e8f2371e29535ed71278e5';
const GPU = '0x951e1767f18c4317479bb460950b281a3e122b93';
const live = {
  object: 'list',
  data: [
    { id: 'Qwen3.8-Flash-Next', ref: `Qwen3.8-Flash-Next@${MAIN}`, modality: 'chat', node: { address: MAIN, name: 'ainize-ai' }, local: true },
    { id: 'Qwen3.8-Flash-Next', ref: `Qwen3.8-Flash-Next@${GPU}`, modality: 'chat', node: { address: GPU, name: 'ainize-gpu-models' }, local: false },
    { id: 'Qwen3.8-27B', ref: `Qwen3.8-27B@${GPU}`, modality: 'chat', node: { address: GPU, name: 'ainize-gpu-models' }, local: false },
    { id: 'confucius4-r2t2', modality: 'transcription', node: { address: GPU, name: 'ainize-gpu-models' }, local: false },
    { id: 'future', modality: 'video', node: { address: GPU }, local: false },
  ],
};

test('the same id on two nodes is one card with two providers — this node first — and every entry names its node', () => {
  const cat = networkModelCatalogue([{ id: 'Qwen3.8-Flash-Next', modality: 'chat', available: false }], parseNetworkModelsResponse(live));
  assert.deepEqual(cat.map((m) => [m.id, m.providers.map(networkProviderLabel)]), [
    ['Qwen3.8-Flash-Next', ['ainize-ai', 'ainize-gpu-models']],
    ['Qwen3.8-27B', ['ainize-gpu-models']],
    ['confucius4-r2t2', ['ainize-gpu-models']],
  ]);
  assert.equal(cat[0]!.providers[0]!.available, false, "this node's availability comes from its own probe");
  assert.equal(cat[2]!.providers[0]!.ref, `confucius4-r2t2@${GPU}`, 'a ref is built when the node did not send one');
});

test('a page drives the ?node= provider, else this node, else the first peer', () => {
  const cat = networkModelCatalogue([], parseNetworkModelsResponse(live));
  const flash = cat.find((m) => m.id === 'Qwen3.8-Flash-Next')!;
  assert.equal(pickNetworkModelProvider(flash, null)!.node.name, 'ainize-gpu-models', 'unprobed local availability does not outrank an eligible peer');
  assert.equal(pickNetworkModelProvider(flash, GPU.toUpperCase().replace('0X', '0x'))!.ref, `Qwen3.8-Flash-Next@${GPU}`);
  assert.equal(pickNetworkModelProvider(flash, '0x' + '0'.repeat(40)), null, 'a missing pinned provider never falls back');
  const onlyPeer = cat.find((m) => m.id === 'Qwen3.8-27B')!;
  assert.equal(pickNetworkModelProvider(onlyPeer, null)!.local, false);
});

test('network reads distinguish empty, unsupported and malformed lists, including a ref naming another provider', () => {
  assert.deepEqual(readNetworkModelsResponse({ data: [] }), { models: [], unsupported: 0 });
  assert.equal(readNetworkModelsResponse(live)?.unsupported, 1);
  const row = live.data[0];
  assert.equal(readNetworkModelsResponse(live, GPU), null, 'a foreign node cannot be labelled local');
  assert.ok(readNetworkModelsResponse(live, MAIN));
  for (const raw of [null, {}, { data: [null] }, { data: [{ ...row, ref: `other@${MAIN}` }] },
    { data: [{ ...row, ref: `Qwen3.8-Flash-Next@${GPU}` }] }, { data: [{ ...row, local: undefined }] },
    { data: [row, row] }, { data: [row, { ...live.data[1], local: true }] }]) assert.equal(readNetworkModelsResponse(raw), null);
});

test('local-only models remain visible when unrelated peers are present and unprobed local adverts are unavailable', () => {
  const cat = networkModelCatalogue([{ id: 'Own-only', modality: 'image', available: true }], parseNetworkModelsResponse(live));
  assert.ok(cat.some(row => row.id === 'Own-only' && row.providers[0].available));
  const local = cat.find(row => row.id === 'Qwen3.8-Flash-Next')!.providers.find(p => p.local)!;
  assert.equal(local.available, false);
  const fallback = networkModelCatalogue([{ id: 'Own-only', modality: 'image', available: true }], [], MAIN);
  assert.equal(pickNetworkModelProvider(fallback[0], MAIN)?.local, true, 'a current local probe still identifies this node when peer discovery is unavailable');
});

test('selection and links retain provider and modality and refuse ambiguous names or disappeared targets', () => {
  const cat = networkModelCatalogue([], parseNetworkModelsResponse(live));
  const model = cat[0];
  const provider = pickNetworkModelProvider(model, GPU)!;
  assert.equal(networkModelHref(model, provider), `/models/Qwen3.8-Flash-Next?modality=chat&node=${GPU}`);
  assert.equal(selectNetworkModel(cat, model.id, '0x' + '0'.repeat(40), 'chat').kind, 'missing');
  const collision = [...cat, { ...model, modality: 'image' as const }];
  assert.equal(selectNetworkModel(collision, model.id, GPU, null).kind, 'ambiguous');
  assert.equal(selectNetworkModel(collision, model.id, GPU, 'image').kind, 'ok');
  const old = networkModelCatalogue([{ id: 'Own', modality: 'chat', available: true }], []);
  assert.equal(networkModelHref(old[0]), '/models/Own?modality=chat&node=local');
  assert.equal(selectNetworkModel(old, 'Own', 'local', 'chat').kind, 'ok');
});

test('a node too old for the network list still lists its own models', () => {
  const cat = networkModelCatalogue([{ id: 'Own', modality: 'image', available: true }], parseNetworkModelsResponse({ error: 'not found' }));
  assert.deepEqual(cat.map((m) => [m.id, m.providers.length, m.providers[0]!.local]), [['Own', 1, true]]);
});
