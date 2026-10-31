/**
 * Agent aliases on the site: links use the alias when an agent has one, `/agent/:idOrAlias` finds the agent by
 * either; explicit links use the alias, and catalogue refreshes do not rewrite the current route.
 *
 *   node --test --import tsx test/agent-aliases.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentAliasOf, agentMatchesParam, agentPagePath, agentPageScope, agentForPage, aliasSuggestion } from '../src/api/agentIds';
import { agentSummaryFromHostedSpecResponse, agentSummaryFromLinkedList } from '../src/api/sharedAgents';
import { agentSummaryFromOrgAgent, parseOrgAgent } from '../src/api/organizations';

const M = { id: 'external-e20458854c448acf7809', alias: 'agent-m' };

test('peer links and alias redirects preserve the selected node, including URL punctuation', () => {
  const node = { address: 'https://peer.example/a?x=1&next=2#part' };
  const peer = { ...M, node };
  const expected = `/agent/agent-m?node=${encodeURIComponent(node.address)}`;
  assert.equal(agentPagePath(peer), expected);
  assert.deepEqual(agentPageScope(expected.slice(expected.indexOf('?'))), { node: node.address, valid: true });
});

test('same ids and aliases resolve only within the explicit node; missing peers never fall back', () => {
  const local = { ...M, node: null };
  const peer = { ...M, node: { address: 'peer-one' } };
  const other = { ...M, node: { address: 'peer-two' } };
  const agents = [other, peer, local];
  assert.equal(agentForPage(agents, M.id, agentPageScope('')), local);
  assert.equal(agentForPage(agents, M.alias, agentPageScope('?node=peer-one')), peer);
  assert.equal(agentForPage([other, local], M.id, agentPageScope('?node=peer-one')), null);
  assert.equal(agentForPage([peer], M.id, agentPageScope('')), null, 'unqualified local private lookup must not be shadowed by a peer');
  for (const search of ['?node=', '?node=%20', '?node=peer-one&node=peer-two']) {
    assert.equal(agentPageScope(search).valid, false);
    assert.equal(agentForPage(agents, M.id, agentPageScope(search)), null);
  }
});

test('links to an agent page use the alias when there is one, the id otherwise', () => {
  assert.equal(agentPagePath(M), '/agent/agent-m');
  assert.equal(agentPagePath({ id: 'coffee-bot' }), '/agent/coffee-bot');
  assert.equal(agentPagePath({ id: 'coffee-bot', alias: null }), '/agent/coffee-bot');
  assert.equal(agentPagePath({ id: 'agent-1761367112311', alias: 'Not Valid' }), '/agent/agent-1761367112311', 'a malformed alias is ignored');
  assert.equal(agentPagePath(M, '/edit'), '/agent/agent-m/edit');
});

test('the page segment matches an agent by id or alias without changing the selected route', () => {
  assert.equal(agentMatchesParam(M, 'agent-m'), true);
  assert.equal(agentMatchesParam(M, M.id), true);
  assert.equal(agentMatchesParam(M, 'other'), false);
  assert.equal(agentMatchesParam({ id: 'x' }, ''), false);
});

test('alias survives every row shape the node sends; an older node sends none', () => {
  assert.equal(agentAliasOf({ alias: 'agent-m' }), 'agent-m');
  assert.equal(agentAliasOf({}), null);
  assert.equal(agentAliasOf({ alias: 7 }), null);
  const hosted = agentSummaryFromHostedSpecResponse({ agent: { id: 'baghyanggi-1765208006999', alias: 'bakhyanggi', name: '박향기' } }, 'https://ainize.ai');
  assert.equal(hosted?.alias, 'bakhyanggi');
  const linked = { agents: [{ id: M.id, alias: 'agent-m', name: 'Agent M', a2a_url: 'https://ainize.ai/agents/x', card_url: 'https://ainize.ai/agents/x/c' }] };
  assert.equal(agentSummaryFromLinkedList(linked, 'agent-m')?.id, M.id, 'a linked row is found by its alias');
  assert.equal(agentSummaryFromLinkedList(linked, M.id)?.alias, 'agent-m');
  const org = parseOrgAgent({ id: M.id, alias: 'agent-m', name: 'Agent M', a2a_url: 'https://ainize.ai/agents/x' });
  assert.equal(org?.alias, 'agent-m');
  assert.equal(agentPagePath(agentSummaryFromOrgAgent(org!)), '/agent/agent-m', 'the organization list links by alias');
  assert.equal(parseOrgAgent({ id: 'a', a2a_url: 'https://x' })?.alias, null);
});

test('the Address name field starts from the current alias, else the name — never the id itself', () => {
  assert.equal(aliasSuggestion(M.id, 'Agent M', null), 'agent-m');
  assert.equal(aliasSuggestion('baghyanggi-1765208006999', '박향기', null), 'bakhyanggi');
  assert.equal(aliasSuggestion(M.id, 'Agent M', 'agent-m-2'), 'agent-m-2');
  assert.equal(aliasSuggestion('coffee-bot', 'Coffee Bot', null), '', 'the name already is the id');
  assert.equal(aliasSuggestion('agent-1', '超人', null), '');
});
