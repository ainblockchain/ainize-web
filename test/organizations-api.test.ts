/**
 * Organizations, pinned where they cross the repository boundary (ainize-node organizations design): the id rule,
 * the role ranks, the form rules, how the node's answers are read, and how its refusals are named.
 *
 *   node --test --import tsx test/organizations-api.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORG_RESERVED_IDS, emailDomain, isOrgIdValid, myMembership, orgApiErrorOf, orgCreateInputFromDraft, orgFormProblems, orgIdFromName, parseOrgBilling,
  parseOrgInvite, parseOrgList, parseOrgProfile, parseOrgSecurity, roleAtLeast, type OrgFormDraft,
} from '../src/api/organizations';

const draft = (over: Partial<OrgFormDraft> = {}): OrgFormDraft => ({ id: 'comcom', name: 'ComCom', description: '', readme: '', claimDomain: true, domainRole: 'write', ...over });

test('the id rule is the node’s, and the words under /org/ are pages, not ids', () => {
  assert.ok(isOrgIdValid('comcom'));
  assert.ok(!isOrgIdValid('ComCom'));
  assert.ok(!isOrgIdValid('-x'));
  for (const w of ORG_RESERVED_IDS) assert.ok(!isOrgIdValid(w), `/org/${w} is a page`);
  assert.equal(orgIdFromName('ComCom Inc.'), 'comcom-inc');
  assert.equal(orgIdFromName('  AI Network — 팀 '), 'ai-network');
});

test('roles rank read < contributor < write < admin', () => {
  assert.ok(roleAtLeast('admin', 'write') && roleAtLeast('write', 'contributor') && roleAtLeast('contributor', 'read'));
  assert.ok(!roleAtLeast('read', 'contributor') && !roleAtLeast(null, 'read') && !roleAtLeast(undefined, 'read'));
});

test('the form: problems mirror the node’s schema; the only claimable domain is the sign-in’s own', () => {
  assert.deepEqual(orgFormProblems(draft()), []);
  assert.deepEqual(orgFormProblems(draft({ id: 'new' })), [{ field: 'id', key: 'org.problem.id_reserved' }]);
  assert.deepEqual(orgFormProblems(draft({ id: 'X', name: ' ' })).map((p) => p.field), ['id', 'name']);
  assert.deepEqual(orgFormProblems(draft({ description: 'd'.repeat(501), readme: 'r'.repeat(20_001) })).map((p) => p.key), ['org.problem.description', 'org.problem.readme']);
  assert.deepEqual(orgCreateInputFromDraft(draft({ name: ' ComCom ' }), 'comcom.ai'), { id: 'comcom', name: 'ComCom', description: '', readme: '', domains: ['comcom.ai'], domainRole: 'write' });
  assert.deepEqual(orgCreateInputFromDraft(draft({ claimDomain: false }), 'comcom.ai').domains, []);
  assert.deepEqual(orgCreateInputFromDraft(draft(), null).domains, [], 'a wallet sign-in has no domain to claim');
  assert.equal(emailDomain('Alice@ComCom.AI'), 'comcom.ai');
  assert.equal(emailDomain('nope'), null);
  assert.equal(emailDomain(null), null);
});

test('answers are read defensively: a full profile, a bare list, an older node', () => {
  const list = parseOrgList({ orgs: [{ id: 'comcom', name: 'ComCom', member_count: 3, agent_count: 2, my_role: 'admin', via: 'member' }, { nope: true }], signed_in: true, email_domain: 'comcom.ai', domain_org: 'comcom' });
  assert.deepEqual(list.orgs.map((o) => [o.id, o.my_role, o.via, o.member_count]), [['comcom', 'admin', 'member', 3]]);
  assert.equal(list.domain_org, 'comcom');
  assert.deepEqual(parseOrgList(undefined), { orgs: [], signed_in: false, email_domain: null, domain_org: null });

  const profile = parseOrgProfile({ org: {
    id: 'comcom', name: 'ComCom', description: 'we', readme: '# hi', domains: ['comcom.ai'], domain_role: 'contributor', sso_org_ids: ['org_1'], my_role: 'read',
    members: [{ principal: 'sso:a', role: 'admin', name: 'A', email: 'a…@comcom.ai', added_at: 1, via: 'creator' }, { bogus: 1 }],
    groups: [{ id: 'g1', name: 'Desk', members: ['sso:a'], agents: ['desk'] }],
    agents: [{ id: 'desk', name: 'Desk', owner: 'sso:a', kind: 'hosted', visibility: 'org', org_id: 'comcom', groups: ['g1'], a2a_url: 'https://n/agents/desk', calls: 4 }, { id: 'no-url' }],
    hidden_agents: 1, pending_requests: 2, open_invites: 1, spend_cap_credits: 5000,
  } });
  assert.ok(profile);
  assert.equal(profile.readme, '# hi');
  assert.equal(profile.domain_role, 'contributor');
  assert.deepEqual(profile.members.map((m) => m.principal), ['sso:a']);
  // the node's agent row (ainize-node #42): #40's visibility/org_id, the kind, and the resource groups that label it
  assert.deepEqual(profile.agents.map((a) => [a.id, a.kind, a.visibility, a.org_id, a.groups, a.card_url, a.calls]), [['desk', 'hosted', 'org', 'comcom', ['g1'], 'https://n/agents/desk/.well-known/agent-card.json', 4]]);
  assert.equal(profile.hidden_agents, 1);
  assert.equal(profile.spend_cap_credits, 5000);
  assert.equal(myMembership(profile, ['sso:a'])?.role, 'admin');
  assert.equal(myMembership(profile, ['0xabc']), null);
  assert.equal(parseOrgProfile({ error: 'nope' }), null);

  const invite = parseOrgInvite({ invite: { token: 'abc', token_prefix: 'abc', role: 'contributor', url: 'https://ainize.ai/org/join/abc', expires_at: 9 } });
  assert.equal(invite?.url, 'https://ainize.ai/org/join/abc');
  assert.equal(parseOrgInvite({ invite: { role: 'read' } }), null, 'no prefix, no invite');

  const billing = parseOrgBilling({ spend_cap_credits: null, sso_org_ids: [], keys_available: true, spend_metered: false, agent_calls_total: 4, keys: [{ prefix: 'abcd', owner: 'sso:a', org_id: 'org_1', disabled: false }], agents: [{ id: 'desk', name: 'Desk', kind: 'hosted', visibility: 'org', total: 4, last_at: null }] });
  assert.equal(billing?.spend_metered, false);
  assert.deepEqual(billing?.keys.map((k) => k.prefix), ['abcd']);
  assert.deepEqual(billing?.agents.map((a) => [a.id, a.total]), [['desk', 4]]);

  const security = parseOrgSecurity({ sso: { configured: true, issuer: 'https://auth.example', org_ids: ['org_1'] }, domains: ['comcom.ai'], domain_role: 'write', members_by_via: { creator: 1, domain: 2 }, admins: ['sso:a'], private_agents: 1, audit: [{ seq: 2, ts: 5, actor: 'sso:a', action: 'member.add', target: 'sso:b' }] });
  assert.equal(security?.sso.issuer, 'https://auth.example');
  assert.deepEqual(security?.members_by_via, { creator: 1, domain: 2 });
  assert.deepEqual(security?.audit.map((e) => [e.seq, e.action]), [[2, 'member.add']]);
});

test('refusals are named by the node’s code, with the not_member extras; older shapes fall back to the status', () => {
  const notMember = orgApiErrorOf({ status: 403, data: { error: { code: 'not_member', message: 'members only' }, org: { id: 'comcom', name: 'ComCom' }, can_request: true, requested: false } });
  assert.equal(notMember.code, 'not_member');
  assert.equal(notMember.org?.name, 'ComCom');
  assert.equal(notMember.can_request, true);
  assert.equal(orgApiErrorOf({ status: 403, data: { error: { code: 'domain_not_yours', message: 'x' } } }).code, 'domain_not_yours');
  assert.equal(orgApiErrorOf({ status: 409, data: { error: { code: 'has_agents', message: 'x' } } }).code, 'has_agents');
  assert.equal(orgApiErrorOf({ status: 404, data: 'Cannot GET /api/orgs' }).code, 'not_found', 'an older node without organizations');
  assert.equal(orgApiErrorOf({ status: 403, data: { error: 'nope' } }).code, 'insufficient_role');
  assert.equal(orgApiErrorOf({ error: 'TypeError: fetch failed' }).code, 'unreachable');
  assert.equal(orgApiErrorOf({ status: 500 }).code, 'unknown');
});

test('who may share into an organization: ainize organizations from contributor up, then the AIN organizations not already listed', async () => {
  const { shareableOrgOptions } = await import('../src/api/sharedAgents');
  const { orgRoleAtLeast } = await import('../src/api/organizations');
  assert.equal(shareableOrgOptions(null, null), null, 'no source answered: not the same as "in no organization"');
  const sso = [{ id: 'org_comcom', slug: 'comcom', name: 'ComCom (AIN)' }];
  const ainize = [{ id: 'comcom', name: 'ComCom', role: 'write' }, { id: 'readers', name: 'Readers', role: 'read' }, { id: 'org_comcom', name: 'Linked', role: 'contributor' }];
  assert.deepEqual(shareableOrgOptions(sso, ainize)?.map((o) => o.id), ['comcom', 'org_comcom'], 'read cannot share; an id listed once');
  assert.deepEqual(shareableOrgOptions(null, [{ id: 'comcom', name: 'ComCom', role: 'contributor' }])?.map((o) => o.id), ['comcom'], 'a wallet member of an ainize organization can share');
  assert.equal(orgRoleAtLeast('write', 'contributor'), true);
  assert.equal(orgRoleAtLeast('read', 'contributor'), false);
  assert.equal(orgRoleAtLeast(null, 'read'), false);
});

test('the manageable list: own and organization agents with what the caller may do; an older node\'s public list is not it', async () => {
  const { parseManageableHostedAgents } = await import('../src/api/sharedAgents');
  const rows = parseManageableHostedAgents({ agents: [
    { id: 'mine', name: 'Mine', owner: 'sso:a', mode: 'prompt', visibility: 'private', org_id: null, can_manage: true, can_delete: true, updated_by: 'sso:a' },
    { id: 'desk', name: 'Desk', owner: 'sso:b', mode: 'handler', visibility: 'org', org_id: 'comcom', can_manage: true, can_delete: false, updated_by: 'sso:a' },
  ] }, 'https://ainize.ai');
  assert.deepEqual(rows?.map((r) => [r.agent.id, r.agent.visibility, r.agent.org_id, r.canManage, r.canDelete, r.updatedBy]), [
    ['mine', 'private', null, true, true, 'sso:a'], ['desk', 'org', 'comcom', true, false, 'sso:a'],
  ]);
  assert.equal(rows?.[1].agent.a2a_url, 'https://ainize.ai/agents/desk');
  assert.equal(parseManageableHostedAgents({ agents: [{ id: 'x', name: 'X' }] }, 'https://n'), null, 'rows without can_manage: an older node answering the public list');
  assert.equal(parseManageableHostedAgents('<html>', 'https://n'), null);
});
