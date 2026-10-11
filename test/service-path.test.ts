import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceRootRedirect } from '../src/lib/servicePath';

test('service root keeps relative assets and health links within its mount', () => {
  const root = serviceRootRedirect('https://ainize.ai/svc/prj_demo?view=1', 'GET');
  assert.equal(root, '/svc/prj_demo/?view=1');
  assert.equal(new URL('./_next/static/app.js', `https://ainize.ai${root}`).pathname, '/svc/prj_demo/_next/static/app.js');
  assert.equal(new URL('./api/health', `https://ainize.ai${root}`).pathname, '/svc/prj_demo/api/health');
});
test('canonical service root does not loop or change nested route and mutation semantics', () => {
  for (const path of ['/svc/prj_demo/', '/svc/prj_demo/api/health', '/svc/prj_demo/_next/static/a.js', '/models/clef'])
    assert.equal(serviceRootRedirect(`https://ainize.ai${path}`, 'GET'), null);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
    assert.equal(serviceRootRedirect('https://ainize.ai/svc/prj_demo', method), null);
  assert.equal(serviceRootRedirect('https://ainize.ai/svc/prj_demo', 'HEAD'), '/svc/prj_demo/');
});
