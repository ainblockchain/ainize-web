import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navigationSection, safeReturnPath, signInHref, withQuery } from '../src/lib/uiNavigation.ts';
import { isReservedFirstSegment } from '../src/lib/reservedRoutes.ts';

test('sign-in preserves the selected project, tab, log and anchor in one return destination', () => {
  const path = '/team/mono?project=apps%2Fweb&tab=logs&log=build#output';
  const href = signInHref({ pathname: '/team/mono', search: '?project=apps%2Fweb&tab=logs&log=build', hash: '#output' });
  assert.equal(new URL(href, 'https://ainize.ai').searchParams.get('next'), path);
  assert.equal(safeReturnPath(path), path);
});

test('account sign-in has one default and does not return outside the app or into itself', () => {
  for (const value of [null, '', 'https://example.com', '//example.com', '/\\example.com', '/\n/example.com', '/signing?next=/me', '/signing/']) {
    assert.equal(safeReturnPath(value), '/me');
  }
  assert.equal(safeReturnPath('/code/session?q=a#b'), '/code/session?q=a#b');
});

test('Run shortcuts preserve the exact monorepo project and existing anchor', () => {
  assert.equal(withQuery('/team/mono?project=scripts%2Findex#run', { tab: 'runs' }), '/team/mono?project=scripts%2Findex&tab=runs#run');
  assert.equal(withQuery('/team/app?tab=settings', { tab: 'runs' }), '/team/app?tab=runs');
});

test('detail pages keep the correct parent menu selected', () => {
  assert.equal(navigationSection('/agent/guide'), 'agents');
  assert.equal(navigationSection('/explore', '?kind=agent'), 'agents');
  assert.equal(navigationSection('/explore'), 'train');
  assert.equal(navigationSection('/0x' + 'a'.repeat(40) + '/lesson'), 'train');
  assert.equal(navigationSection('/comcom/app'), 'deployments');
  assert.equal(navigationSection('/deployments'), 'deployments');
  assert.equal(navigationSection('/apps'), 'deployments', 'the old address lights the same item');
  assert.equal(navigationSection('/me/projects'), 'deployments');
  assert.equal(navigationSection('/runs'), 'runs');
  assert.equal(navigationSection('/me/projects', '?kind=script'), 'runs');
  assert.equal(navigationSection('/models/clef'), null);
  assert.equal(navigationSection('/docs/topic'), null);
});

test('malformed percent segments are rejected without crashing the router', () => {
  for (const segment of ['%', '%ZZ', '%E0%A4']) assert.equal(isReservedFirstSegment(segment), true);
});
