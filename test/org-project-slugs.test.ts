import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orgProjectSlugs } from '../src/lib/orgProjectSlugs';
test('organization activity only queries the current organization and its linked SSO namespaces', () => {
  const members = [{ id: 'a', slug: 'comcom' }, { id: 'b', slug: 'shared-lab' }, { id: 'c', slug: 'another-team' }];
  assert.deepEqual(orgProjectSlugs({ id: 'comcom', sso_org_ids: ['a', 'b'] }, members), ['comcom', 'shared-lab']);
  assert.deepEqual(orgProjectSlugs({ id: 'solo', sso_org_ids: [] }, members), ['solo']);
});
