/**
 * Linked agents, pinned where they cross the repository boundary (ainize-node linked-agents design).
 *
 *   node --test --import tsx test/linked-agents-api.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentsOwnedBy, isAgentOwnedBy, isLinkedAgentIdValid, isLinkedAgentRow, isLinkedAgentUpstreamValid, linkedAgentApiErrorOf,
  linkedAgentDraftFromView, linkedAgentFormProblems, linkedAgentIdFromName, linkedAgentInputFromDraft, parseLinkedAgentResponse,
  viewerPrincipals, type LinkedAgentFormDraft,
} from '../src/api/linkedAgents';
import { HOSTED_AGENT_RESERVED_IDS } from '../src/api/hostedAgents';
import type { AgentSummary } from '../src/api/types';

const row = (extra: Record<string, unknown>): AgentSummary => ({
  id: 'a', name: 'A', description: null, skills: [], protocols: ['1.0'], extensions: [], provider: null, documentation_url: null,
  a2a_url: '/agents/a', card_url: '/agents/a/.well-known/agent-card.json', reachable: true, last_checked: null, error: null,
  calls: 0, last_call_at: null, node: null, ...extra,
} as AgentSummary);

const draft = (over: Partial<LinkedAgentFormDraft> = {}): LinkedAgentFormDraft => ({ id: 'coffee-bot', name: 'Coffee Bot', description: '', upstream: 'https://coffee.example', org: null, visibility: 'public', group: null, ...over });

test('the id rule is the node’s, and the two route words are not ids', () => {
  assert.ok(isLinkedAgentIdValid('coffee-bot'));
  assert.ok(!isLinkedAgentIdValid('Coffee'));
  assert.ok(!isLinkedAgentIdValid('-x'));
  assert.ok(!isLinkedAgentIdValid('new'), '/agent/new is a page');
  assert.ok(!isLinkedAgentIdValid('link'), '/agent/link is a page');
  assert.ok(HOSTED_AGENT_RESERVED_IDS.includes('link'), 'the hosted form refuses it too — one reserved list');
  assert.equal(linkedAgentIdFromName('Coffee Bot!'), 'coffee-bot');
  assert.equal(linkedAgentIdFromName('  --Café  '), 'cafe');
});

test('an upstream is an absolute http(s) URL; the public-address check belongs to the node', () => {
  assert.ok(isLinkedAgentUpstreamValid('https://coffee.example'));
  assert.ok(isLinkedAgentUpstreamValid('http://10.0.0.5:9200/'), 'private is the node’s refusal, not the form’s');
  assert.ok(!isLinkedAgentUpstreamValid('coffee.example'));
  assert.ok(!isLinkedAgentUpstreamValid('ftp://coffee.example'));
  assert.ok(!isLinkedAgentUpstreamValid(''));
});

test('form problems name the field and the message key', () => {
  assert.deepEqual(linkedAgentFormProblems(draft()), []);
  assert.deepEqual(linkedAgentFormProblems(draft({ id: 'link' })), [{ field: 'id', key: 'agentLink.problem.id_reserved' }]);
  assert.deepEqual(linkedAgentFormProblems(draft({ id: 'X', upstream: 'nope' })).map((p) => p.field), ['id', 'upstream']);
  assert.deepEqual(linkedAgentFormProblems(draft({ name: 'n'.repeat(81), description: 'd'.repeat(501) })).map((p) => p.key), ['agentLink.problem.name', 'agentLink.problem.description']);
  assert.deepEqual(linkedAgentInputFromDraft(draft({ name: ' Coffee ', upstream: ' https://coffee.example ' })), { id: 'coffee-bot', name: 'Coffee', description: '', upstream: 'https://coffee.example', org: null, visibility: 'public', group: null });
  // organizations: private and a group mean something only under an organization — a personal agent is public with no group
  assert.deepEqual(linkedAgentInputFromDraft(draft({ visibility: 'private', group: 'g1' })).visibility, 'public');
  assert.deepEqual(linkedAgentInputFromDraft(draft({ org: ' comcom ', visibility: 'private', group: 'g1' })), { id: 'coffee-bot', name: 'Coffee Bot', description: '', upstream: 'https://coffee.example', org: 'comcom', visibility: 'private', group: 'g1' });
});

test('the node’s answer is read defensively, and the owner’s read carries the upstream', () => {
  assert.equal(parseLinkedAgentResponse(null), null);
  assert.equal(parseLinkedAgentResponse({ agent: { id: 'x' } }), null, 'half a record is no record');
  const v = parseLinkedAgentResponse({ agent: { id: 'coffee', name: 'Coffee Bot', description: 'd', owner: 'sso:carol', a2a_url: 'https://n/agents/coffee', card_url: 'https://n/agents/coffee/.well-known/agent-card.json', reachable: false, error: 'upstream timeout' } });
  // a node from before organizations sends no org fields: personal and public, as it was
  assert.deepEqual(v, { id: 'coffee', name: 'Coffee Bot', description: 'd', owner: 'sso:carol', a2a_url: 'https://n/agents/coffee', card_url: 'https://n/agents/coffee/.well-known/agent-card.json', upstream: null, reachable: false, error: 'upstream timeout', org: null, visibility: 'public', group: null });
  const inOrg = parseLinkedAgentResponse({ agent: { id: 'desk', name: 'Desk', a2a_url: 'a', card_url: 'c', org: 'comcom', visibility: 'private', group: 'g1' } })!;
  assert.deepEqual([inOrg.org, inOrg.visibility, inOrg.group], ['comcom', 'private', 'g1']);
  const owned = parseLinkedAgentResponse({ agent: { ...{ id: 'coffee', name: 'Coffee Bot', a2a_url: 'a', card_url: 'c' }, upstream: 'https://coffee.example' } })!;
  assert.deepEqual(linkedAgentDraftFromView(owned), { id: 'coffee', name: 'Coffee Bot', description: '', upstream: 'https://coffee.example', org: null, visibility: 'public', group: null });
});

test('refusals: a coded body, a text body, no answer at all', () => {
  assert.deepEqual(linkedAgentApiErrorOf({ status: 400, data: { error: { code: 'upstream_not_public', message: 'no' } } }), { status: 400, code: 'upstream_not_public', message: 'no' });
  assert.deepEqual(linkedAgentApiErrorOf({ status: 409, data: { error: 'taken' } }), { status: 409, code: 'id_taken', message: 'taken' });
  assert.deepEqual(linkedAgentApiErrorOf({ status: 500, data: { error: { code: 'weird' } } }), { status: 500, code: 'unknown', message: null });
  assert.deepEqual(linkedAgentApiErrorOf({ status: 'FETCH_ERROR', error: 'TypeError: fetch failed' }), { status: null, code: 'unreachable', message: 'TypeError: fetch failed' });
  assert.equal(linkedAgentApiErrorOf({ status: 401 }).code, 'not_signed_in');
  assert.equal(linkedAgentApiErrorOf({ status: 403 }).code, 'not_owner');
});

test('"mine" is a principal match: wallet case-folded, SSO principal kept, nobody’s rows left out', () => {
  const p = viewerPrincipals('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'sso:Carol');
  assert.deepEqual(p, ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'sso:Carol']);
  assert.deepEqual(viewerPrincipals(null, null), []);
  assert.ok(isAgentOwnedBy('0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa', p));
  assert.ok(isAgentOwnedBy('sso:Carol', p));
  assert.ok(!isAgentOwnedBy('sso:carol', p), 'an OIDC sub is case-sensitive');
  assert.ok(!isAgentOwnedBy(null, p), 'a config agent is nobody’s');
  const rows = [
    row({ id: 'cfg', kind: 'upstream', owner: null }),
    row({ id: 'mine-linked', kind: 'upstream', owner: 'sso:Carol' }),
    row({ id: 'mine-hosted', kind: 'prompt', owner: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }),
    row({ id: 'theirs', kind: 'prompt', owner: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' }),
    row({ id: 'peer', kind: 'upstream', owner: 'sso:Carol', node: { address: '0xnode', name: 'n' } }),
  ];
  assert.deepEqual(agentsOwnedBy(rows, p).map((r) => r.id), ['mine-linked', 'mine-hosted', 'peer']);
  assert.ok(isLinkedAgentRow(rows[1]!));
  assert.ok(!isLinkedAgentRow(rows[0]!), 'an upstream with no owner is a config agent');
  assert.ok(!isLinkedAgentRow(rows[2]!), 'a hosted agent is not linked');
  assert.ok(!isLinkedAgentRow(rows[4]!), 'a peer’s agent is edited on the peer');
  // an older node sends no `kind`: an upstream is the default, so an owned row without it still reads as linked
  assert.ok(isLinkedAgentRow(row({ owner: 'sso:Carol' })));
});
