import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSelectedOrg, joinSelectedOrg, orgCreationAccess, orgInviteTarget, OrgEntryError } from '../src/lib/orgEntry';
import type { OrgCreateInput } from '../src/api/organizations';

const access = { orgs: [], signed_in: true, email_domain: 'studio.example', domain_org: null };
const body: OrgCreateInput = { id: 'studio', name: 'Studio', description: '', readme: '', domains: ['studio.example'], domainRole: 'write' };
const profile = { org: { id: 'studio', name: 'Studio', my_role: 'admin' } };
const current = () => true;
const rejectsCode = (code: OrgEntryError['code']) => (error: unknown) => error instanceof OrgEntryError && error.code === code;

test('domain availability must be explicit and signed in; missing/failed metadata cannot mean unclaimed', () => {
  for (const raw of [undefined, {}, { ...access, signed_in: false }, { ...access, email_domain: undefined },
    { ...access, domain_org: undefined }, { ...access, domain_org: '' }, { ...access, email_domain: 'invalid' },
    { ...access, email_domain: null, domain_org: 'other' }]) assert.equal(orgCreationAccess(raw), null);
  assert.deepEqual(orgCreationAccess(access), { domain: 'studio.example', heldBy: null });
  assert.deepEqual(orgCreationAccess({ ...access, email_domain: null }), { domain: null, heldBy: null });
});

test('a changed or claimed domain blocks creation without silently stripping the selected domain', async () => {
  let writes = 0;
  for (const raw of [{ ...access, domain_org: 'existing-team' }, { ...access, email_domain: 'new.example' }, { ...access, email_domain: null }]) {
    await assert.rejects(createSelectedOrg(body, { readAccess: async () => raw, create: async () => { writes++; return profile; }, isCurrent: current }), rejectsCode('domain_changed'));
  }
  await assert.rejects(createSelectedOrg(body, { readAccess: async () => ({}), create: async () => { writes++; return profile; }, isCurrent: current }), rejectsCode('read_failed'));
  assert.equal(writes, 0);
  assert.deepEqual(body.domains, ['studio.example']);
});

test('creation sends the exact opt-in choice, and a domain-free organization remains possible', async () => {
  for (const input of [body, { ...body, domains: [] }]) {
    const writes: OrgCreateInput[] = [];
    const org = await createSelectedOrg(input, {
      readAccess: async () => input.domains.length ? access : { ...access, domain_org: 'existing-team' },
      create: async (value) => { writes.push(value); return profile; }, isCurrent: current,
    });
    assert.equal(org?.id, body.id);
    assert.deepEqual(writes, [input]);
  }
});

test('leaving during the fresh read cancels the write; leaving during creation cannot produce a navigation result', async () => {
  let active = true;
  let writes = 0;
  assert.equal(await createSelectedOrg(body, {
    readAccess: async () => { active = false; return access; },
    create: async () => { writes++; return profile; }, isCurrent: () => active,
  }), null);
  assert.equal(writes, 0);
  active = true;
  assert.equal(await createSelectedOrg(body, {
    readAccess: async () => access,
    create: async () => { writes++; active = false; return profile; }, isCurrent: () => active,
  }), null);
  assert.equal(writes, 1);
});

test('malformed and different-organization responses never count as successful creation', async () => {
  for (const raw of [{}, { org: { id: 'elsewhere', my_role: 'admin' } }, { org: { id: 'studio' } }, { org: { id: 'studio', my_role: 'read' } }]) {
    await assert.rejects(createSelectedOrg(body, { readAccess: async () => access, create: async () => raw, isCurrent: current }), rejectsCode('unconfirmed'));
  }
});

test('an invite with an unknown or missing role cannot be presented as a read invitation', () => {
  for (const raw of [{ org: { id: 'studio' } }, { org: { id: 'studio' }, role: 'owner' }, { org: { id: 'studio' }, role: 'read', email: 4 }]) assert.equal(orgInviteTarget(raw), null);
  assert.deepEqual(orgInviteTarget({ org: { id: 'studio', name: 'Studio' }, role: 'write' }), { id: 'studio', name: 'Studio', role: 'write', email: null });
});

test('invite acceptance retains the displayed target and ignores departed-account outcomes', async () => {
  for (const raw of [{}, { org: { id: 'other', my_role: 'read' } }, { org: { id: 'studio' } }]) {
    await assert.rejects(joinSelectedOrg('token-a', 'studio', { accept: async () => raw, isCurrent: current }), rejectsCode('unconfirmed'));
  }
  const tokens: string[] = [];
  assert.equal((await joinSelectedOrg('token-a', 'studio', { accept: async (token) => { tokens.push(token); return profile; }, isCurrent: current }))?.id, 'studio');
  assert.deepEqual(tokens, ['token-a']);
  let active = true;
  assert.equal(await joinSelectedOrg('token-a', 'studio', { accept: async () => { active = false; return profile; }, isCurrent: () => active }), null);
  let calls = 0;
  assert.equal(await joinSelectedOrg('token-a', 'studio', { accept: async () => { calls++; return profile; }, isCurrent: () => false }), null);
  assert.equal(calls, 0);
});
