import test from 'node:test';
import assert from 'node:assert/strict';
import { needsServiceCacheMigration, SERVICE_CACHE_REVISION } from '../src/lib/serviceCacheMigration';
const page = { method: 'GET', pathname: '/apps', accept: 'text/html', prefetch: false };
test('legacy service redirects are cleared once during a real site navigation', () => {
  assert.equal(needsServiceCacheMigration(page), true);
  assert.equal(needsServiceCacheMigration({ ...page, revision: SERVICE_CACHE_REVISION }), false);
});
test('cache migration excludes services, APIs, assets, prefetches and mutations', () => {
  for (const pathname of ['/svc/prj_demo/', '/api/auth/me', '/_next/static/app.js'])
    assert.equal(needsServiceCacheMigration({ ...page, pathname }), false);
  assert.equal(needsServiceCacheMigration({ ...page, prefetch: true }), false);
  assert.equal(needsServiceCacheMigration({ ...page, method: 'POST' }), false);
  assert.equal(needsServiceCacheMigration({ ...page, accept: 'application/json' }), false);
});
