import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyTrainDestination } from '../src/lib/trainNavigation.ts';

test('legacy training links preserve deep links, query options and anchors', () => {
  assert.equal(legacyTrainDestination('/teach'), '/train');
  assert.equal(legacyTrainDestination('/teach/dataset/ds_1/settings', '?retrain=job_1&effort=full', '#settings'), '/train/dataset/ds_1/settings?retrain=job_1&effort=full#settings');
  assert.equal(legacyTrainDestination('/teach/lesson/job_1'), '/train/lesson/job_1');
  assert.equal(legacyTrainDestination('/teacher/alice'), '/teacher/alice');
});
