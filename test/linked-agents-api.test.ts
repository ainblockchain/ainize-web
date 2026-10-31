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
  viewerPrincipals, linkedAgentSaveMatches, type LinkedAgentFormDraft,
} from '../src/api/linkedAgents';
import { HOSTED_AGENT_RESERVED_IDS } from '../src/api/hostedAgents';
import type { AgentSummary } from '../src/api/types';

const row = (extra: Record<string, unknown>): AgentSummary => ({
  id: 'a', name: 'A', description: null, skills: [], protocols: ['1.0'], extensions: [], provider: null, documentation_url: null,
  a2a_url: '/agents/a', card_url: '/agents/a/.well-known/agent-card.json', reachable: true, last_checked: null, error: null,
  calls: 0, last_call_at: null, node: null, ...extra,
} as AgentSummary);

const draft = (over: Partial<LinkedAgentFormDraft> = {}): LinkedAgentFormDraft => ({ id: 'coffee-bot', name: 'Coffee Bot', description: '', upstream: 'https://coffee.example', visibility: 'public', orgId: null, ...over });

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
  assert.deepEqual(linkedAgentInputFromDraft(draft({ name: ' Coffee ', upstream: ' https://coffee.example ' })), { id: 'coffee-bot', name: 'Coffee', description: '', upstream: 'https://coffee.example', visibility: 'public', orgId: null });
  // Sharing (shared-agent registry): `org` needs an organization the AIN account is in; the form says so before the node does.
  const orgs = [{ id: 'org_comcom', slug: 'comcom', name: 'ComCom' }];
  assert.deepEqual(linkedAgentFormProblems(draft({ visibility: 'org', orgId: null }), orgs).map((p) => p.key), ['sharing.err.org_required']);
  assert.deepEqual(linkedAgentFormProblems(draft({ visibility: 'org', orgId: 'org_other' }), orgs).map((p) => p.key), ['sharing.err.org_not_member']);
  assert.deepEqual(linkedAgentFormProblems(draft({ visibility: 'org', orgId: 'org_comcom' }), null).map((p) => p.key), ['sharing.err.org_needs_sso'], 'a wallet belongs to no organization');
  assert.deepEqual(linkedAgentFormProblems(draft({ visibility: 'org', orgId: 'org_comcom' }), orgs), []);
  assert.deepEqual(linkedAgentInputFromDraft(draft({ visibility: 'private', orgId: 'org_comcom' })).orgId, null, 'orgId goes with org only');
});

test('the node’s answer is read defensively, and the owner’s read carries the upstream', () => {
  assert.equal(parseLinkedAgentResponse(null), null);
  assert.equal(parseLinkedAgentResponse({ agent: { id: 'x' } }), null, 'half a record is no record');
  const v = parseLinkedAgentResponse({ agent: { id: 'coffee', name: 'Coffee Bot', description: 'd', owner: 'sso:carol', a2a_url: 'https://n/agents/coffee', card_url: 'https://n/agents/coffee/.well-known/agent-card.json', reachable: false, error: 'upstream timeout' } });
  assert.deepEqual(v, { id: 'coffee', name: 'Coffee Bot', description: 'd', owner: 'sso:carol', a2a_url: 'https://n/agents/coffee', card_url: 'https://n/agents/coffee/.well-known/agent-card.json', upstream: null, editRevision: null, reachable: false, error: 'upstream timeout', visibility: null, orgId: null });
  const owned = parseLinkedAgentResponse({ agent: { ...{ id: 'coffee', name: 'Coffee Bot', a2a_url: 'a', card_url: 'c' }, upstream: 'https://coffee.example' } })!;
  assert.deepEqual(linkedAgentDraftFromView(owned), { id: 'coffee', name: 'Coffee Bot', description: '', upstream: 'https://coffee.example', visibility: 'public', orgId: null }, 'an older node’s record reads as public — what every agent was');
  const shared = parseLinkedAgentResponse({ agent: { id: 'coffee', name: 'Coffee Bot', a2a_url: 'a', card_url: 'c', visibility: 'org', org_id: 'org_comcom' } })!;
  assert.deepEqual([shared.visibility, shared.orgId], ['org', 'org_comcom']);
  assert.deepEqual(linkedAgentDraftFromView(shared).orgId, 'org_comcom');
});

test('refusals: a coded body, a text body, no answer at all', () => {
  assert.deepEqual(linkedAgentApiErrorOf({ status: 400, data: { error: { code: 'upstream_not_public', message: 'no' } } }), { status: 400, code: 'upstream_not_public', message: 'no' });
  assert.deepEqual(linkedAgentApiErrorOf({ status: 409, data: { error: 'taken' } }), { status: 409, code: 'unknown', message: 'taken' });
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

test('a Google-only viewer (the site-vouched `google:<sub>`) owns what it made; no duplicates, case kept', () => {
  const google = viewerPrincipals(null, null, 'google:1100AB');
  assert.deepEqual(google, ['google:1100AB']);
  assert.ok(isAgentOwnedBy('google:1100AB', google));
  assert.ok(!isAgentOwnedBy('google:1100ab', google), 'a Google sub is case-sensitive');
  assert.ok(!isAgentOwnedBy('google:other', google));
  // An SSO session connected to that Google account reports it as its principal too: listed once.
  assert.deepEqual(viewerPrincipals(null, 'google:1100AB', 'google:1100AB'), ['google:1100AB']);
  assert.deepEqual(viewerPrincipals('0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', null, 'google:1100AB'), ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'google:1100AB']);
  assert.deepEqual(viewerPrincipals(null, null, null), []);
});


test('save confirmation requires the exact agent, owner, address, sharing and a new review', () => {
  const body = linkedAgentInputFromDraft(draft({ description: 'Description' }));
  const raw = { ...body, owner: 'sso:owner', a2a_url: '/agents/coffee-bot', card_url: '/agents/coffee-bot/card', edit_revision: 'b'.repeat(64) };
  const valid = parseLinkedAgentResponse({ agent: raw });
  assert.equal(linkedAgentSaveMatches(valid, body, 'sso:owner', 'a'.repeat(64)), true);
  for (const patch of [{ id: 'other' }, { owner: 'sso:other' }, { upstream: 'https://other.example' }, { visibility: 'private' }, { name: 'Other' }, { description: 'Other' }, { edit_revision: 'a'.repeat(64) }, { edit_revision: null }]) {
    assert.equal(linkedAgentSaveMatches(parseLinkedAgentResponse({ agent: { ...raw, ...patch } }), body, 'sso:owner', 'a'.repeat(64)), false, JSON.stringify(patch));
  }
  assert.equal(linkedAgentSaveMatches(null, body, 'sso:owner'), false);
  assert.equal(linkedAgentSaveMatches(valid, body, null), false);
  assert.equal(linkedAgentSaveMatches(valid, { ...body, name: '', description: '' }, 'sso:owner'), true, 'blank fields deliberately use the upstream card');
  const shared = { ...body, visibility: 'org' as const, orgId: 'chosen' };
  assert.equal(linkedAgentSaveMatches(parseLinkedAgentResponse({ agent: { ...raw, visibility: 'org', org_id: 'other' } }), shared, 'sso:owner'), false);
});

test('review and sharing refusals are not mistaken for an id collision', () => {
  for (const code of ['review_changed', 'review_required', 'sharing_denied']) {
    assert.equal(linkedAgentApiErrorOf({ status: 409, data: { error: { code } } }).code, code);
  }
});

test('actual edit mutation sends the captured revision once and preserves a conflict response', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request;
  const body = { ...linkedAgentInputFromDraft(draft()), expected_revision: 'a'.repeat(64) };
  let writes = 0;
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init);
    assert.equal(req.method, 'PUT'); assert.equal(new URL(req.url).pathname, '/api/linked-agents/coffee-bot');
    assert.deepEqual(await req.json(), body); writes++;
    return Response.json({ error: { code: 'review_changed', message: 'changed' } }, { status: 409 });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    await assert.rejects(store.dispatch(api.endpoints.updateLinkedAgent.initiate(body)).unwrap(), error => linkedAgentApiErrorOf(error).code === 'review_changed');
    assert.equal(writes, 1);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});


test('a reviewed edit cannot initialize missing sharing or owner fields as public defaults', () => {
  const raw = { id: 'chosen', name: 'Chosen', owner: 'sso:owner', a2a_url: '/agents/chosen', card_url: '/agents/chosen/card', upstream: 'https://agent.example', visibility: 'private', org_id: null, edit_revision: 'b'.repeat(64) };
  assert.ok(parseLinkedAgentResponse({ agent: raw }));
  for (const patch of [{ owner: '' }, { visibility: undefined }, { visibility: 'org', org_id: null }, { org_id: 'other' }, { upstream: undefined }]) {
    assert.equal(parseLinkedAgentResponse({ agent: { ...raw, ...patch } }), null);
  }
});
