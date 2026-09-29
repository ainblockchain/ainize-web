/**
 * Shared agents, pinned where they cross the repository boundary (ainize-node `feat/shared-agent-registry`,
 * `@ain/integration-contracts` 1.0).
 *
 * An older node sends rows without `visibility` and answers `/api/shared-agents` with an Express 404 page; a newer
 * one sends the contract. Both have to land on the page as something true — a public list and no badge, never a
 * guessed "public" — and a spec saved from the form must never quietly widen who sees an agent.
 *
 *   node --test --import tsx test/shared-agents-api.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentKindFromReleaseId, agentListKey, agentOrgIdOf, agentSummaryFromHostedSpecResponse, agentSummaryFromLinkedList, agentSummaryFromRef, agentVisibilityOf,
  defaultOrgIdFor, fallbackRows, orgVisibilityAvailable, parseAgentRef, parseSharedAgentsResponse, scopeForFilter, sharedAgentsErrorCode, sharedAgentsUnsupported,
  sharingFieldsOf, sharingProblemKey, visibilityBadgeOf,
} from '../src/api/sharedAgents';
import { hostedAgentDraftFromSpec, hostedAgentFormProblems, hostedAgentSpecInputFromDraft, parseHostedAgentSpecResponse, type HostedAgentFormDraft } from '../src/api/hostedAgents';
import type { AgentSummary } from '../src/api/types';

const row = (extra: Record<string, unknown>): AgentSummary => ({
  id: 'a', name: 'A', description: null, skills: [], protocols: ['0.3.0'], extensions: [], provider: null, documentation_url: null,
  a2a_url: 'https://n/agents/a', card_url: 'https://n/agents/a/.well-known/agent-card.json', reachable: true, last_checked: null, error: null,
  calls: 0, last_call_at: null, node: null, ...extra,
} as AgentSummary);

const ORGS = [{ id: 'org_comcom', slug: 'comcom', name: 'ComCom' }, { id: 'org_other', slug: 'other', name: 'Other' }];

const ref = (over: Record<string, unknown> = {}) => ({
  registryIssuer: 'https://ainize.ai', agentId: 'doc-summary', releaseId: 'v3',
  ownerRef: { kind: 'principal', issuer: 'https://ainize.ai', subject: 'sso:Carol' }, visibility: 'org',
  orgRef: { kind: 'org', issuer: 'https://auth.comcom.ai', subject: 'org_comcom' },
  agentCardUrl: 'https://ainize.ai/agents/doc-summary/.well-known/agent-card.json', endpoint: 'https://ainize.ai/agents/doc-summary',
  supportedProtocolVersions: ['0.3.0'], skills: [{ id: 's', name: 'Summarise', description: 'd', examples: ['요약해'] }, { id: 'bad' }],
  inputModes: ['text/plain'], outputModes: ['text/plain'], uiCapabilities: ['streaming', 'a2ui_basic'], status: 'active',
  displayName: 'Doc summary', description: 'Summarises a file', updatedAt: '2026-09-29T00:00:00Z', ...over,
});

// ── visibility off a row

test('an older node’s row has no visibility, and none is guessed — so no badge', () => {
  assert.equal(agentVisibilityOf(row({})), null);
  assert.equal(agentOrgIdOf(row({})), null);
  assert.equal(visibilityBadgeOf(row({})), null);
  assert.equal(visibilityBadgeOf(row({ visibility: 'public' })), null, 'public is the ordinary state and says nothing');
  assert.equal(visibilityBadgeOf(row({ visibility: 'org', org_id: 'org_comcom' })), 'org');
  assert.equal(visibilityBadgeOf(row({ visibility: 'private' })), 'private');
  assert.equal(visibilityBadgeOf(row({ visibility: 'secret' })), null, 'a value this build has not heard of is no badge');
  assert.equal(agentOrgIdOf({ orgId: 'x' }), 'x', 'a stored spec spells it orgId, a row org_id');
});

// ── the sharing choice

test('org needs an organization the AIN account is in; a wallet has none', () => {
  assert.equal(orgVisibilityAvailable(null), false);
  assert.equal(orgVisibilityAvailable([]), false);
  assert.equal(orgVisibilityAvailable(ORGS), true);
  assert.equal(sharingProblemKey('public', null, null), null);
  assert.equal(sharingProblemKey('org', 'org_comcom', null), 'sharing.err.org_needs_sso');
  assert.equal(sharingProblemKey('org', null, ORGS), 'sharing.err.org_required');
  assert.equal(sharingProblemKey('org', 'org_nope', ORGS), 'sharing.err.org_not_member');
  assert.equal(sharingProblemKey('org', 'org_comcom', ORGS), null);
  assert.deepEqual(sharingFieldsOf('org', 'org_comcom'), { visibility: 'org', orgId: 'org_comcom' });
  assert.deepEqual(sharingFieldsOf('private', 'org_comcom'), { visibility: 'private', orgId: null }, 'orgId goes with org only');
  assert.deepEqual(sharingFieldsOf(undefined, null), { visibility: 'public', orgId: null });
});

test('the org to preselect: the active one, else the only one, else ask', () => {
  assert.equal(defaultOrgIdFor(ORGS, 'org_other'), 'org_other');
  assert.equal(defaultOrgIdFor(ORGS, 'org_gone'), null, 'two orgs and no active one: the form asks');
  assert.equal(defaultOrgIdFor([ORGS[0]], null), 'org_comcom');
  assert.equal(defaultOrgIdFor([], 'org_comcom'), null);
});

// ── the hosted form carries it

const draft = (over: Partial<HostedAgentFormDraft> = {}): HostedAgentFormDraft => ({
  id: 'doc-summary', name: 'Doc summary', description: '', model: 'qwen', systemPrompt: 'Summarise.', mode: 'prompt',
  code: '', packageJson: '', a2ui: false, mediaTranscription: false, mediaImage: false, allowedHostsText: '', secrets: [], visibility: 'public', orgId: null, ...over,
});

test('the hosted form refuses an org choice the node would refuse, and always sends the sharing fields', () => {
  assert.deepEqual(hostedAgentFormProblems(draft({ visibility: 'org', orgId: null }), ORGS), [{ field: 'orgId', key: 'sharing.err.org_required' }]);
  assert.deepEqual(hostedAgentFormProblems(draft({ visibility: 'org', orgId: 'org_comcom' }), null), [{ field: 'orgId', key: 'sharing.err.org_needs_sso' }]);
  assert.deepEqual(hostedAgentFormProblems(draft({ visibility: 'org', orgId: 'org_comcom' }), ORGS), []);
  const body = hostedAgentSpecInputFromDraft(draft({ visibility: 'org', orgId: 'org_comcom' }));
  assert.deepEqual([body.visibility, body.orgId], ['org', 'org_comcom']);
  assert.deepEqual([hostedAgentSpecInputFromDraft(draft()).visibility, hostedAgentSpecInputFromDraft(draft()).orgId], ['public', null], 'sent even when public: PUT replaces the spec');
});

test('a stored spec round-trips its sharing; one from before visibility reads as public', () => {
  const shared = parseHostedAgentSpecResponse({ id: 'x', mode: 'prompt', model: 'qwen', owner: 'sso:Carol', visibility: 'org', orgId: 'org_comcom' })!;
  assert.deepEqual([shared.visibility, shared.orgId, shared.owner], ['org', 'org_comcom', 'sso:Carol'], 'an SSO principal owner is kept as written');
  const back = hostedAgentSpecInputFromDraft(hostedAgentDraftFromSpec(shared));
  assert.deepEqual([back.visibility, back.orgId], ['org', 'org_comcom']);
  const old = parseHostedAgentSpecResponse({ id: 'y', mode: 'prompt', model: 'qwen', owner: '0xABC' })!;
  assert.deepEqual([old.visibility, old.orgId, old.owner], ['public', null, '0xabc']);
  assert.equal(hostedAgentDraftFromSpec(old).visibility, 'public');
});

// ── the registry (contract 1.0)

test('a ref is read defensively and becomes a marketplace row', () => {
  assert.equal(parseAgentRef(null), null);
  assert.equal(parseAgentRef({ agentId: 'x' }), null, 'no endpoint is no ref');
  assert.equal(parseAgentRef(ref({ visibility: 'secret' })), null, 'a visibility this build has not heard of is no ref');
  const r = parseAgentRef(ref())!;
  assert.equal(r.skills.length, 1, 'a skill without id and name is dropped');
  const summary = agentSummaryFromRef(r, 'https://ainize.ai/');
  assert.equal(summary.id, 'doc-summary');
  assert.equal(summary.name, 'Doc summary');
  assert.equal(summary.owner, 'sso:Carol');
  assert.equal(summary.visibility, 'org');
  assert.equal(summary.org_id, 'org_comcom');
  assert.equal(summary.node, null, 'same registry as the page: this node');
  assert.equal(summary.kind, null, 'a hosted ref does not say its mode');
  assert.equal(summary.reachable, null, 'the registry says active, not that the card answered just now');
  assert.equal(summary.calls, null);
  assert.deepEqual(summary.skills[0], { id: 's', name: 'Summarise', description: 'd', tags: [], examples: ['요약해'] });
  assert.ok(summary.extensions.some((u) => u.includes('a2ui.org')), 'a2ui_basic becomes the A2UI badge');
  const elsewhere = agentSummaryFromRef(parseAgentRef(ref({ registryIssuer: 'https://other.example', releaseId: 'linked-v2', status: 'stopped' }))!, 'https://ainize.ai');
  assert.deepEqual(elsewhere.node, { address: 'https://other.example', name: 'other.example' });
  assert.equal(elsewhere.kind, 'upstream');
  assert.equal(elsewhere.reachable, false, 'stopped is not answering');
  assert.equal(agentKindFromReleaseId('upstream'), 'upstream');
  assert.equal(agentKindFromReleaseId('v7'), null);
});

test('a page of refs; a body that is not one is null', () => {
  assert.equal(parseSharedAgentsResponse('<html>Cannot GET</html>'), null);
  assert.equal(parseSharedAgentsResponse({ agents: [] }), null, 'the old list shape is not the contract');
  const page = parseSharedAgentsResponse({ contract: '1.0', asOf: 't', nextCursor: null, items: [{ ref: ref(), canInvoke: true }, { ref: { agentId: 'broken' }, canInvoke: true }] })!;
  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, null);
});

test('scopes and the chips; a node without the registry is told apart from a refusal', () => {
  assert.equal(scopeForFilter('all'), 'public');
  assert.equal(scopeForFilter('mine'), 'mine');
  assert.equal(scopeForFilter('org'), 'shared_with_org');
  assert.ok(sharedAgentsUnsupported({ status: 404, data: '<html>Cannot GET /api/shared-agents</html>' }), 'an Express 404 page: no such route');
  assert.ok(!sharedAgentsUnsupported({ status: 404, data: { error: { code: 'not_found', message: 'x' } } }), 'a coded 404 is an answer');
  assert.ok(!sharedAgentsUnsupported({ status: 401, data: { error: { code: 'auth_required' } } }));
  assert.equal(sharedAgentsErrorCode({ status: 401, data: { error: { code: 'auth_required', message: 'sign in' } } }), 'auth_required');
  assert.equal(sharedAgentsErrorCode({ status: 500 }), null);
});

test('without the registry, "mine" is the public list by owner and "org" is the public list as is', () => {
  const rows = [row({ id: 'cfg', owner: null }), row({ id: 'mine', owner: 'sso:Carol' }), row({ id: 'wallet', owner: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }), row({ id: 'theirs', owner: 'sso:Dave' })];
  const principals = ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'sso:Carol'];
  assert.deepEqual(fallbackRows('mine', rows, principals).map((r) => r.id), ['mine', 'wallet']);
  assert.deepEqual(fallbackRows('org', rows, principals).map((r) => r.id), ['cfg', 'mine', 'wallet', 'theirs']);
  assert.deepEqual(fallbackRows('all', rows, []).length, 4);
});

test('a row is keyed by node and id: two nodes may each run a donga-desk', () => {
  assert.equal(agentListKey(row({ id: 'donga-desk' })), 'self#donga-desk');
  assert.equal(agentListKey(row({ id: 'donga-desk', node: { address: '0xpeer', name: 'peer' } })), '0xpeer#donga-desk');
});

// ── one non-public agent, found off the public list

test('a hosted spec or a linked-agents row becomes the agent page’s row when the public list misses', () => {
  assert.equal(agentSummaryFromHostedSpecResponse(null, 'https://ainize.ai'), null);
  const fromSpec = agentSummaryFromHostedSpecResponse({ agent: { id: 'private-one', name: 'Private', mode: 'tools', model: 'qwen', owner: 'sso:Carol', visibility: 'private', a2ui: true, skills: [{ id: 's', name: 'S' }] } }, 'https://ainize.ai/')!;
  assert.equal(fromSpec.a2a_url, 'https://ainize.ai/agents/private-one');
  assert.equal(fromSpec.card_url, 'https://ainize.ai/agents/private-one/.well-known/agent-card.json');
  assert.deepEqual([fromSpec.kind, fromSpec.model, fromSpec.owner, fromSpec.visibility, fromSpec.org_id], ['tools', 'qwen', 'sso:Carol', 'private', null]);
  assert.equal(fromSpec.skills.length, 1);
  assert.ok(fromSpec.extensions.length === 1, 'a2ui on the spec is the badge');
  assert.equal(agentSummaryFromLinkedList({ agents: [] }, 'x'), null);
  const fromLinked = agentSummaryFromLinkedList({ agents: [{ id: 'coffee', name: 'Coffee', owner: '0xABC', a2a_url: 'https://n/agents/coffee', card_url: 'https://n/agents/coffee/.well-known/agent-card.json', visibility: 'org', org_id: 'org_comcom', reachable: true }] }, 'coffee')!;
  assert.deepEqual([fromLinked.kind, fromLinked.owner, fromLinked.visibility, fromLinked.org_id, fromLinked.reachable], ['upstream', '0xabc', 'org', 'org_comcom', true]);
});
