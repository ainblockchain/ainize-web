import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacyTrainDestination, legacyAgentsDestination } from '../src/lib/trainNavigation.ts';

test('legacy training links preserve deep links, query options and anchors', () => {
  assert.equal(legacyTrainDestination('/teach'), '/train');
  assert.equal(legacyTrainDestination('/teach/dataset/ds_1/settings', '?retrain=job_1&effort=full', '#settings'), '/train/dataset/ds_1/settings?retrain=job_1&effort=full#settings');
  assert.equal(legacyTrainDestination('/teach/lesson/job_1'), '/train/lesson/job_1');
  assert.equal(legacyTrainDestination('/teacher/alice'), '/teacher/alice');
});

test('legacy agent listings preserve search, selected organization, pagination and anchor', () => {
  const result = new URL(legacyAgentsDestination('?q=미술+검색&agents=org&org=chosen&page=2&kind=knowledge&kind=agent', '#results'), 'https://ainize.example');
  assert.equal(result.pathname, '/explore');
  assert.equal(result.searchParams.get('q'), '미술 검색');
  assert.equal(result.searchParams.get('agents'), 'org');
  assert.equal(result.searchParams.get('org'), 'chosen');
  assert.equal(result.searchParams.get('page'), '2');
  assert.deepEqual(result.searchParams.getAll('kind'), ['agent']);
  assert.equal(result.hash, '#results');
  assert.equal(legacyAgentsDestination(), '/explore?kind=agent');
});
