/**
 * Agent aliases on the site: links use the alias when an agent has one, `/agent/:idOrAlias` finds the agent by
 * either and moves the URL bar to the alias, and every row the node sends keeps its `alias`.
 *
 *   node --test --import tsx test/agent-aliases.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agentAliasOf, agentMatchesParam, agentPagePath, agentPageRedirect, aliasSuggestion } from '../src/api/agentIds';
import { agentSummaryFromHostedSpecResponse, agentSummaryFromLinkedList } from '../src/api/sharedAgents';
import { agentSummaryFromOrgAgent, parseOrgAgent } from '../src/api/organizations';

const M = { id: 'external-e20458854c448acf7809', alias: 'agent-m' };

test('links to an agent page use the alias when there is one, the id otherwise', () => {
  assert.equal(agentPagePath(M), '/agent/agent-m');
  assert.equal(agentPagePath({ id: 'coffee-bot' }), '/agent/coffee-bot');
  assert.equal(agentPagePath({ id: 'coffee-bot', alias: null }), '/agent/coffee-bot');
  assert.equal(agentPagePath({ id: 'agent-1761367112311', alias: 'Not Valid' }), '/agent/agent-1761367112311', 'a malformed alias is ignored');
  assert.equal(agentPagePath(M, '/edit'), '/agent/agent-m/edit');
});

test('the page segment matches an agent by id or alias, and redirects an id to the alias', () => {
  assert.equal(agentMatchesParam(M, 'agent-m'), true);
  assert.equal(agentMatchesParam(M, M.id), true);
  assert.equal(agentMatchesParam(M, 'other'), false);
  assert.equal(agentMatchesParam({ id: 'x' }, ''), false);
  assert.equal(agentPageRedirect(M.id, M), '/agent/agent-m', 'opened by id → the readable address');
  assert.equal(agentPageRedirect('old-name', M), '/agent/agent-m', 'an old alias → the current one');
  assert.equal(agentPageRedirect('agent-m', M), null, 'already there');
  assert.equal(agentPageRedirect('coffee-bot', { id: 'coffee-bot' }), null, 'no alias, no redirect');
  assert.equal(agentPageRedirect('x', null), null);
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
