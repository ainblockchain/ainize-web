/**
 * The network's models as the Models pages draw them (src/api/networkModels.ts): an id served by several nodes is
 * one card with several providers, and a page drives exactly one of them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkModelCatalogue, networkProviderLabel, parseNetworkModelsResponse, pickNetworkModelProvider } from '../src/api/networkModels';

const MAIN = '0xab6fc64ed70dea2294e8f2371e29535ed71278e5';
const GPU = '0x951e1767f18c4317479bb460950b281a3e122b93';
const live = {
  object: 'list',
  data: [
    { id: 'Qwen3.8-Flash-Next', ref: `Qwen3.8-Flash-Next@${MAIN}`, modality: 'chat', node: { address: MAIN, name: 'ainize-ai' }, local: true },
    { id: 'Qwen3.8-Flash-Next', ref: `Qwen3.8-Flash-Next@${GPU}`, modality: 'chat', node: { address: GPU, name: 'ainize-gpu-models' }, local: false },
    { id: 'Qwen3.8-27B', ref: `Qwen3.8-27B@${GPU}`, modality: 'chat', node: { address: GPU, name: 'ainize-gpu-models' }, local: false },
    { id: 'confucius4-r2t2', modality: 'transcription', node: { address: GPU, name: 'ainize-gpu-models' }, local: false },
    { id: 'bad', modality: 'video', node: { address: GPU } },
    { id: 'no-node', modality: 'chat' },
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
  assert.equal(pickNetworkModelProvider(flash, null)!.node.name, 'ainize-ai');
  assert.equal(pickNetworkModelProvider(flash, GPU.toUpperCase().replace('0X', '0x'))!.ref, `Qwen3.8-Flash-Next@${GPU}`);
  assert.equal(pickNetworkModelProvider(flash, '0x' + '0'.repeat(40))!.node.name, 'ainize-ai', 'an unknown node falls back');
  const onlyPeer = cat.find((m) => m.id === 'Qwen3.8-27B')!;
  assert.equal(pickNetworkModelProvider(onlyPeer, null)!.local, false);
});

test('a node too old for the network list still lists its own models', () => {
  const cat = networkModelCatalogue([{ id: 'Own', modality: 'image', available: true }], parseNetworkModelsResponse({ error: 'not found' }));
  assert.deepEqual(cat.map((m) => [m.id, m.providers.length, m.providers[0]!.local]), [['Own', 1, true]]);
});
