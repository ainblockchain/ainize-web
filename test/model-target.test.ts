import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmModelTarget } from '../src/api/modelTarget';
import type { NetworkModelProvider } from '../src/api/networkModels';

const node = '0x' + 'a'.repeat(40), other = '0x' + 'b'.repeat(40);
const model = { id: 'chosen', modality: 'chat' as const, available: true };
const provider: NetworkModelProvider = { node: { address: node, name: 'Chosen provider' }, ref: `chosen@${node}`, local: false, available: true };
const row = { id: 'chosen', modality: 'chat', node: { address: node }, ref: provider.ref, local: false };

test('a targeted read permits only the selected id, provider, modality and availability', async () => {
  await confirmModelTarget(model, provider, async () => ({ data: [row] }), () => true);
  for (const value of [{ data: [] }, {}, { data: [{ ...row, id: 'other' }] }, { data: [{ ...row, modality: 'image' }] },
    { data: [{ ...row, available: false }] }, { data: [{ ...row, node: { address: other }, ref: `chosen@${other}` }] }, { data: [{ ...row, local: true }] }]) {
    await assert.rejects(confirmModelTarget(model, provider, async () => value, () => true), /model_unavailable/);
  }
});

test('local execution requires a current positive availability probe and never accepts an advert instead', async () => {
  const local = { ...provider, local: true, ref: model.id };
  await confirmModelTarget(model, local, async () => ({ data: [model] }), () => true);
  for (const value of [{ data: [] }, {}, { data: [{ ...model, available: false }] }, { data: [{ ...model, available: undefined }] }, { data: [row] }]) {
    await assert.rejects(confirmModelTarget(model, local, async () => value, () => true), /model_unavailable/);
  }
});

test('failed reads and a departed/cancelled view cannot proceed to a model call', async () => {
  let calls = 0, live = true;
  const run = async (load: () => Promise<unknown>) => { await confirmModelTarget(model, provider, load, () => live); calls++; };
  await assert.rejects(run(async () => { throw new Error('offline'); }), /model_unavailable/);
  await assert.rejects(run(async () => { live = false; return { data: [row] }; }), { name: 'AbortError' });
  await assert.rejects(run(async () => { throw new Error('should not load'); }), { name: 'AbortError' });
  assert.equal(calls, 0);
});
