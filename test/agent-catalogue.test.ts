import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentCatalogue } from '../src/api/agentCatalogue';
import { parseCompleteOrgList, parseOrgAgentList } from '../src/api/organizations';

const row = { id: 'helper', name: 'Helper', description: null, skills: [], protocols: [], extensions: [], provider: null, documentation_url: null,
  a2a_url: '/agents/helper', card_url: '/agents/helper/card', reachable: null, last_checked: null, error: null, calls: null, last_call_at: null, node: null };

test('catalogue keeps same-id agents on separate nodes but refuses ambiguous identities and malformed card fields', () => {
  assert.equal(parseAgentCatalogue({ agents: [row, { ...row, node: { address: 'peer', name: 'Peer' } }] })?.length, 2);
  assert.deepEqual(parseAgentCatalogue({ agents: [] }), []);
  for (const agents of [[row, row], [null], [row, {}], [{ ...row, skills: [null] }], [{ ...row, extensions: {} }],
    [{ ...row, node: {} }], [{ ...row, model: {} }], [{ ...row, calls: NaN }], [{ ...row, reachable: 'unknown' }]]) {
    assert.equal(parseAgentCatalogue({ agents }), null);
  }
});
test('card destinations remain explicit web URLs or origin-relative paths, never executable or implicit routes', () => {
  for (const card_url of ['javascript:alert(1)', '//other.test/card', 'card', 'https://user:secret@example.test/card', 'https://example.test/with space']) {
    assert.equal(parseAgentCatalogue({ agents: [{ ...row, card_url }] }), null);
  }
  assert.equal(parseAgentCatalogue({ agents: [{ ...row, card_url: 'https://peer.test/card' }] })?.[0].card_url, 'https://peer.test/card');
});
test('complete memberships refuse dropped/duplicate rows instead of auto-selecting a remaining organization', () => {
  const org = { id: 'studio' };
  assert.deepEqual(parseCompleteOrgList({ signed_in: true, orgs: [] })?.orgs, []);
  assert.equal(parseCompleteOrgList({ signed_in: true, orgs: [org] })?.orgs[0].id, 'studio');
  for (const body of [{}, { signed_in: true, orgs: [org, null] }, { signed_in: true, orgs: [org, org] }]) assert.equal(parseCompleteOrgList(body), null);
});
test('organization agents must be complete and belong to the exact selection or a declared SSO alias', () => {
  const agent = { id: 'helper', a2a_url: '/agents/helper', org_id: 'sso-studio' };
  const org = { id: 'studio', sso_org_ids: ['sso-studio'], agents: [agent] };
  assert.equal(parseOrgAgentList({ org }, 'studio')?.agents[0].id, 'helper');
  assert.equal(parseOrgAgentList({ org }, 'other'), null);
  for (const agents of [null, [agent, {}], [agent, agent], [{ ...agent, org_id: 'other' }]]) assert.equal(parseOrgAgentList({ org: { ...org, agents } }, 'studio'), null);
});
