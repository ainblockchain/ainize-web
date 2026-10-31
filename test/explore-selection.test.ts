import test from 'node:test';
import assert from 'node:assert/strict';
import { readExploreSelection, changeExploreSelection, exploreSelectionHref } from '../src/lib/exploreSelection';
import { navigationSection } from '../src/lib/uiNavigation';
const read = (query: string) => readExploreSelection(new URLSearchParams(query));

test('knowledge URL restores every selected filter, order, version and page', () => {
  assert.deepEqual(read('kind=knowledge&q=hello&sort=latest&model=m&schema=taught%2Fone&branch=main&versions=all&page=3'), {
    invalid: false, kind: 'knowledge', scope: 'all', sort: 'latest', q: 'hello', model: 'm', schema: 'taught/one', branch: 'main', showAll: true, page: 3, org: null, cursor: null,
  });
});
test('each filter update resets the page in the same navigation and leaves unrelated selection intact', () => {
  const before = new URLSearchParams('q=hello&model=m&schema=s&branch=main&versions=all&page=7');
  const after = changeExploreSelection(before, { sort: 'price' });
  assert.equal(after.get('page'), null); assert.equal(after.get('model'), 'm'); assert.equal(after.get('versions'), 'all');
  assert.equal(before.get('page'), '7');
  const paged = changeExploreSelection(after, { page: '4' }, false);
  assert.equal(readExploreSelection(paged).page, 4); assert.equal(paged.get('schema'), 's');
  assert.equal(readExploreSelection(before).page, 7, 'history retains the previous complete address');
  assert.equal(changeExploreSelection(before, { model: '' }).has('model'), false);
});
test('scope links preserve private intent without an authentication-dependent fallback', () => {
  assert.equal(read('agents=mine').kind, 'agent'); assert.equal(read('agents=mine').scope, 'mine');
  assert.equal(read('org=chosen').scope, 'org'); assert.equal(read('org=chosen').org, 'chosen');
  assert.equal(read('kind=agent&agents=org').invalid, false);
  assert.equal(navigationSection('/explore', '?agents=mine'), 'agents');
  assert.equal(navigationSection('/explore', '?kind=unknown'), null);
  assert.equal(navigationSection('/0x' + 'a'.repeat(40) + '/repo', '?projectId=selected'), 'apps');
});
test('malformed, contradictory and duplicate selection cannot silently become the default list', () => {
  for (const query of ['kind=other', 'kind=knowledge&agents=mine', 'kind=agent&agents=other', 'kind=agent&agents=all&org=chosen',
    'kind=agent&org=', 'page=0', 'page=-1', 'page=1.5', 'page=01', 'page=1e3', 'page=9007199254740991',
    'versions=other', 'sort=other', 'q=a&q=b', 'model=a&model=b', 'kind=agent&kind=knowledge', 'kind=agent&page=2', 'kind=agent&model=chosen']) {
    assert.equal(read(query).invalid, true, query);
  }
  assert.equal(readExploreSelection(new URLSearchParams('kind=agent'), 'knowledge').invalid, true);
});


test('filter navigation keeps the current route, query and results anchor', () => {
  assert.equal(exploreSelectionHref({ pathname: '/train/knowledge', search: '?q=art&page=4&model=m', hash: '#explore-results' }, { schema: 'taught/one' }),
    '/train/knowledge?q=art&model=m&schema=taught%2Fone#explore-results');
  assert.equal(exploreSelectionHref({ pathname: '/explore', search: '?kind=agent&agents=org&org=old&q=art', hash: '#explore-results' }, { org: 'chosen' }),
    '/explore?kind=agent&agents=org&org=chosen&q=art#explore-results');
});


test('switching an implicit private-agent bookmark to Public stays in the agent section', () => {
  const path = exploreSelectionHref({ pathname: '/explore', search: '?agents=mine&q=guide', hash: '' }, { kind: 'agent', agents: null, org: null });
  const selected = readExploreSelection(new URL(path, 'https://ainize.test').searchParams);
  assert.equal(selected.kind, 'agent'); assert.equal(selected.scope, 'all'); assert.equal(selected.q, 'guide');
});


test('private list cursors survive next-page navigation and reset atomically when search or scope changes', () => {
  const params = new URLSearchParams('kind=agent&agents=mine&q=guide&cursor=page-two');
  assert.equal(readExploreSelection(params).cursor, 'page-two');
  assert.equal(changeExploreSelection(params, { q: 'other' }).get('cursor'), null);
  assert.equal(changeExploreSelection(params, { agents: 'org', org: 'chosen' }).get('cursor'), null);
  assert.equal(changeExploreSelection(params, { cursor: 'page-three' }, false).get('cursor'), 'page-three');
  for (const query of ['kind=agent&cursor=other', 'kind=agent&agents=org&cursor=other', 'kind=knowledge&cursor=other', 'kind=agent&agents=mine&cursor=a&cursor=b']) assert.equal(readExploreSelection(new URLSearchParams(query)).invalid, true);
});
