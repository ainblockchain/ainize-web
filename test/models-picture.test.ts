import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fittedSize, parseLabels } from '../src/screens/models/pictureBase64';

test('a picture is shrunk to fit its long side, and never enlarged', () => {
  assert.deepEqual(fittedSize(4032, 3024), { width: 1280, height: 960 });
  assert.deepEqual(fittedSize(3024, 4032), { width: 960, height: 1280 });
  assert.deepEqual(fittedSize(640, 480), { width: 640, height: 480 });
  assert.deepEqual(fittedSize(5000, 1), { width: 1280, height: 1 });
});

test('labels are read with their score and common name; malformed entries are skipped', () => {
  assert.deepEqual(parseLabels({ labels: [
    { label: 'Pica serica', score: 0.93, common_name: 'Oriental Magpie' },
    { label: 'Corvus corone', score: 1.4 },
    { label: '', score: 0.1 }, { label: 'no score' }, null,
  ] }), [
    { label: 'Pica serica', score: 0.93, detail: 'Oriental Magpie' },
    { label: 'Corvus corone', score: 1, detail: null },
  ]);
  assert.deepEqual(parseLabels({ error: 'x' }), []);
  assert.deepEqual(parseLabels(null), []);
});
