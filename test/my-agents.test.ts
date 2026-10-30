import { test } from 'node:test';
import assert from 'node:assert/strict';
import { myAgentRows, parseMyLinkedAgents } from '../src/api/myAgents';
import { agentSummaryFromHostedSpecResponse, parseManageableHostedAgents } from '../src/api/sharedAgents';

const owner = 'sso:member-a';
const linked = { id: 'private-proxy', name: 'Private proxy', owner, visibility: 'private', a2a_url: 'https://fixture.invalid/agents/private-proxy', card_url: 'https://fixture.invalid/agents/private-proxy/card' };
const hosted = (id: string) => agentSummaryFromHostedSpecResponse({ id, name: id, owner, mode: 'prompt', visibility: 'private' }, 'https://fixture.invalid')!;

test('private and unlisted linked agents are present without any public catalogue rows', () => {
  const list = parseMyLinkedAgents({ agents: [linked, { ...linked, id: 'unlisted-proxy', visibility: 'unlisted' }] });
  assert.ok(list);
  const rows = myAgentRows([], [], list, [owner]);
  assert.deepEqual(rows.map(r => r.agent.id), ['private-proxy', 'unlisted-proxy']);
  assert.ok(rows.every(r => r.canEdit && r.canDelete && !r.shared));
  assert.equal(rows[0].agent.visibility, 'private');
});

test('private lists never fall through to empty on an unsupported or damaged response', () => {
  for (const raw of [null, {}, { agents: [null] }, { agents: [{ id: 'x' }] }]) assert.equal(parseMyLinkedAgents(raw), null);
  assert.deepEqual(parseMyLinkedAgents({ agents: [] }), []);
  assert.equal(parseManageableHostedAgents({ agents: [{ can_manage: true }] }, ''), null);
});

test('public rows enrich health but cannot replace store ownership, visibility or permissions', () => {
  const agent = hosted('same-id');
  const stalePublic = { ...agent, name: 'Old name', visibility: 'public' as const, reachable: true };
  const rows = myAgentRows([stalePublic], [{ agent, canManage: true, canDelete: false, updatedBy: null }], [], [owner]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].canDelete, false);
  assert.equal(rows[0].agent.visibility, 'private');
  assert.equal(rows[0].agent.name, 'same-id');
  assert.equal(rows[0].agent.reachable, true);
});

test('a peer with the same id cannot shadow or supply destructive actions for a local agent', () => {
  const local = hosted('shared-name');
  const peer = { ...local, name: 'Remote agent', node: { address: 'peer-address', name: 'Peer', url: 'https://peer.invalid' } };
  assert.deepEqual(myAgentRows([peer], [], [], [owner]), []);
  const rows = myAgentRows([peer], [{ agent: local, canManage: true, canDelete: true, updatedBy: null }], [], [owner]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].agent.node, null);
  assert.equal(rows[0].agent.name, 'shared-name');
});

test('another owner’s linked records are excluded and shared hosted roles keep their actual permissions', () => {
  const list = parseMyLinkedAgents({ agents: [linked] })!;
  const agent = hosted('shared');
  const rows = myAgentRows([], [{ agent, canManage: true, canDelete: false, updatedBy: null }], list, ['sso:member-b']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].agent.id, 'shared');
  assert.equal(rows[0].shared, true);
  assert.equal(rows[0].canDelete, false);
});
