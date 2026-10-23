/** Which models carry a harness on their page (src/api/modelHarness.ts) — and that it stays on-prem. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { harnessForModel } from '../src/api/modelHarness';

test('DeepSeek-V4.1-Flash models are driven by DeepSeek Harness with the release settings', () => {
  const h = harnessForModel('DeepSeek-V4.1-Flash-1017');
  assert.ok(h);
  assert.equal(h.name, 'DeepSeek Harness');
  assert.deepEqual([h.settings.temperature, h.settings.topP, h.settings.reasoningEffort], [1, 1, 'high']);
  assert.equal(h.settings.compactAt / h.settings.context, 0.75);
  assert.ok(harnessForModel('DeepSeek-V4.1-Flash'));
});

test('other models have no harness section', () => {
  for (const id of ['Qwen3.8-Flash-Next', 'GLM-5.3-Flash', 'DeepSeek-V4.1-Flashy', 'deepseek-v4.1-flash-1017', '', null, undefined]) {
    assert.equal(harnessForModel(id), null, String(id));
  }
});

test('the harness opens in AinCode on this site, never at a hosted API', () => {
  const h = harnessForModel('DeepSeek-V4.1-Flash-1017')!;
  assert.equal(h.openPath, '/code/');
  assert.ok(!JSON.stringify(h).includes('api.deepseek.com'));
});
