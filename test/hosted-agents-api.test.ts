/**
 * Hosted agents, pinned where they cross the repository boundary (ainize-node hosted-agents design, "HTTP API").
 *
 * The node and this app ship separately. An older node sends agent rows without `model` / `kind` / `owner` /
 * `status`, ignores `?model=`, and refuses with `{ error: "text" }` or an HTML page; a newer one names its refusal
 * as `{ error: { code, message } }`. Every one of those has to land on the page as something true — these tests are
 * that promise.
 *
 *   node --test --import tsx test/hosted-agents-api.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agentSummaryHostedFieldsOf, agentsBuiltOnModel, chatModelsForHostedAgent, hostedAgentAllowedHostsFromText, hostedAgentApiErrorOf,
  hostedAgentDraftFromSpec, hostedAgentFormProblems, hostedAgentMediaServed, hostedAgentIdFromName, hostedAgentSecretsToSend, hostedAgentSpecInputFromDraft,
  isHostedAgentIdValid, isHostedAgentOwnedBy, parseHostedAgentLogsResponse, parseHostedAgentSpecResponse, type HostedAgentFormDraft,
} from '../src/api/hostedAgents';
import { modelDetailViewState, parseModelDetailResponse } from '../src/api/models';
import type { AgentSummary } from '../src/api/types';

const row = (extra: Record<string, unknown>): AgentSummary => ({
  id: 'a', name: 'A', description: null, skills: [], protocols: ['1.0'], extensions: [], provider: null, documentation_url: null,
  a2a_url: '/agents/a', card_url: '/agents/a/.well-known/agent-card.json', reachable: true, last_checked: null, error: null,
  calls: 0, last_call_at: null, node: null, ...extra,
} as AgentSummary);

const draft = (over: Partial<HostedAgentFormDraft> = {}): HostedAgentFormDraft => ({
  id: 'score-bot', name: 'Score bot', description: '', model: 'qwen', systemPrompt: 'Score things.', mode: 'prompt',
  code: '', packageJson: '', a2ui: false, mediaTranscription: false, mediaImage: false, allowedHostsText: '', secrets: [], ...over,
});

// ── agent rows

test('an older node’s agent row has no hosted fields, and none are guessed', () => {
  assert.deepEqual(agentSummaryHostedFieldsOf(row({})), { model: null, kind: null, owner: null, status: null });
});

test('a newer node’s row is read field by field, owner lower-cased', () => {
  const f = agentSummaryHostedFieldsOf(row({ model: 'qwen', kind: 'handler', owner: '0xABCdef', status: 'building' }));
  assert.deepEqual(f, { model: 'qwen', kind: 'handler', owner: '0xabcdef', status: 'building' });
});

test('an unknown kind or status is dropped rather than rendered', () => {
  const f = agentSummaryHostedFieldsOf(row({ kind: 'wasm', status: 'melting', model: 7 }));
  assert.deepEqual(f, { model: null, kind: null, owner: null, status: null });
});

test('ownership is case-insensitive and never true for a missing side', () => {
  assert.equal(isHostedAgentOwnedBy('0xabc', '0xABC'), true);
  assert.equal(isHostedAgentOwnedBy('0xabc', '0xabd'), false);
  assert.equal(isHostedAgentOwnedBy(null, '0xabc'), false);
  assert.equal(isHostedAgentOwnedBy('0xabc', null), false);
});

test('the model page keeps only agents built on that model — an older node ignores ?model=', () => {
  const agents = [row({ id: 'x', model: 'qwen' }), row({ id: 'y', model: 'other' }), row({ id: 'z' })];
  assert.deepEqual(agentsBuiltOnModel(agents, 'qwen').map((a) => a.id), ['x']);
  assert.deepEqual(agentsBuiltOnModel(undefined, 'qwen'), []);
});

// ── the form

test('an id is derived from the name', () => {
  assert.equal(hostedAgentIdFromName('My Score Bot!'), 'my-score-bot');
  assert.equal(hostedAgentIdFromName('  Café  Critic '), 'cafe-critic');
  assert.equal(hostedAgentIdFromName('--x--'), 'x');
  assert.equal(hostedAgentIdFromName('뉴스 리뷰'), '', 'a name with nothing Latin gives an empty id, not a guess');
  const long = hostedAgentIdFromName('a'.repeat(39) + ' b c d');
  assert.ok(long.length <= 40 && !long.endsWith('-'));
  assert.ok(isHostedAgentIdValid(long));
});

test('the id rule is the node’s, plus the one id this site cannot show', () => {
  for (const ok of ['a', '0', 'news-review', 'a'.repeat(40)]) assert.equal(isHostedAgentIdValid(ok), true, ok);
  for (const bad of ['', '-a', 'A', 'a_b', 'a'.repeat(41), 'new']) assert.equal(isHostedAgentIdValid(bad), false, bad);
});

test('allowed hosts accept commas, spaces and lines, and fold duplicates', () => {
  assert.deepEqual(hostedAgentAllowedHostsFromText('api.example.com, *.Example.org\n\napi.example.com  *'), ['api.example.com', '*.example.org', '*']);
  assert.deepEqual(hostedAgentAllowedHostsFromText('  '), []);
});

test('only chat models can carry an agent; a prefilled one the list lacks is kept', () => {
  const cards = [
    { id: 'qwen', modality: 'chat' as const, available: true },
    { id: 'asr', modality: 'transcription' as const, available: true },
  ];
  assert.deepEqual(chatModelsForHostedAgent(cards).map((m) => m.id), ['qwen']);
  assert.deepEqual(chatModelsForHostedAgent(cards, 'old-model').map((m) => m.id), ['old-model', 'qwen']);
  assert.deepEqual(chatModelsForHostedAgent(cards, 'asr').map((m) => m.id), ['qwen'], 'a non-chat model is not smuggled in by the URL');
});

test('a valid prompt agent has no problems', () => {
  assert.deepEqual(hostedAgentFormProblems(draft()), []);
});

test('the form names each refusal by field', () => {
  const fields = (d: HostedAgentFormDraft) => hostedAgentFormProblems(d).map((p) => p.field);
  assert.deepEqual(fields(draft({ name: ' ' })), ['name']);
  assert.deepEqual(fields(draft({ id: 'Bad Id' })), ['id']);
  assert.deepEqual(fields(draft({ model: '' })), ['model']);
  assert.deepEqual(fields(draft({ systemPrompt: '' })), ['systemPrompt'], 'a prompt agent with no prompt is nothing');
  assert.deepEqual(fields(draft({ mode: 'handler', systemPrompt: '', code: '' })), ['code'], 'a handler may skip the prompt, not the code');
  assert.deepEqual(fields(draft({ mode: 'tools', code: 'x', packageJson: '{nope' })), ['packageJson']);
  assert.deepEqual(fields(draft({ secrets: [{ name: 'lower', value: '', set: false }] })), ['secrets']);
  assert.deepEqual(fields(draft({ secrets: [{ name: 'A', value: '', set: false }, { name: 'A', value: '', set: false }] })), ['secrets']);
});

test('the body carries files only for code modes, and secret names but never values', () => {
  const prompt = hostedAgentSpecInputFromDraft(draft({ code: 'leftover template' }));
  assert.deepEqual(prompt.files, {}, 'a prompt agent ships no code, even with a template left in the editor');
  const code = hostedAgentSpecInputFromDraft(draft({
    mode: 'handler', code: 'export async function execute() {}', packageJson: '{}', allowedHostsText: 'a.com b.com',
    secrets: [{ name: 'API_KEY', value: 'shh', set: false }, { name: ' ', value: '', set: false }],
  }));
  assert.deepEqual(code.files, { 'index.mjs': 'export async function execute() {}', 'package.json': '{}' });
  assert.deepEqual(code.allowedHosts, ['a.com', 'b.com']);
  assert.deepEqual(code.secretNames, ['API_KEY']);
  assert.ok(!JSON.stringify(code).includes('shh'), 'a secret value never travels in the spec');
  assert.deepEqual(Object.keys(code).sort(), ['a2ui', 'allowedHosts', 'description', 'files', 'id', 'media', 'mode', 'model', 'name', 'secretNames', 'systemPrompt']);
});

test('only secrets with a typed value are sent afterwards — empty means keep', () => {
  const d = draft({ secrets: [{ name: 'A', value: '1', set: true }, { name: 'B', value: '', set: true }] });
  assert.deepEqual(hostedAgentSecretsToSend(d), [{ name: 'A', value: '1' }]);
});

// ── what the node sends back

test('a stored spec round-trips into the form and back', () => {
  const raw = {
    id: 'news-review', name: 'News review', description: 'd', model: 'qwen', systemPrompt: '', mode: 'handler',
    files: { 'index.mjs': 'code', 'package.json': '{}', bad: 7 }, a2ui: true, allowedHosts: ['*'], secretNames: ['API_KEY', 'OTHER'],
    owner: '0xABC', version: 3, status: 'ready', secrets: [{ name: 'API_KEY', set: true }],
  };
  const spec = parseHostedAgentSpecResponse(raw)!;
  assert.equal(spec.owner, '0xabc');
  assert.deepEqual(spec.files, { 'index.mjs': 'code', 'package.json': '{}' });
  assert.deepEqual(spec.secrets, [{ name: 'API_KEY', set: true }, { name: 'OTHER', set: false }]);
  const back = hostedAgentSpecInputFromDraft(hostedAgentDraftFromSpec(spec));
  assert.deepEqual(back.files, { 'index.mjs': 'code', 'package.json': '{}' }, 'the non-string file is not carried back');
  assert.deepEqual(back.secretNames, ['API_KEY', 'OTHER']);
  assert.equal(back.a2ui, true);
  assert.deepEqual(back.media, { transcription: false, image: false }, 'a spec from a node without media reads as all off');
});

test('media round-trips, and is always sent so a save never quietly turns it off', () => {
  const spec = parseHostedAgentSpecResponse({ id: 'aindrive-cloud', mode: 'prompt', model: 'qwen', media: { transcription: true, image: 'yes' } })!;
  assert.deepEqual(spec.media, { transcription: true, image: false }, 'only a real true is on');
  const back = hostedAgentSpecInputFromDraft({ ...hostedAgentDraftFromSpec(spec), mediaImage: true });
  assert.deepEqual(back.media, { transcription: true, image: true });
  assert.deepEqual(hostedAgentMediaServed([{ id: 'q', modality: 'chat', available: true }, { id: 'asr', modality: 'transcription', available: true }]), { transcription: true, image: false });
});

test('a create answer wraps the spec as { agent }', () => {
  assert.equal(parseHostedAgentSpecResponse({ agent: { id: 'x', mode: 'prompt' }, a2a_url: '/agents/x' })?.id, 'x');
});

test('an unreadable spec is null, so the edit page never overwrites an agent with blanks', () => {
  assert.equal(parseHostedAgentSpecResponse(null), null);
  assert.equal(parseHostedAgentSpecResponse({ id: 'x' }), null);
  assert.equal(parseHostedAgentSpecResponse({ id: 'x', mode: 'wasm' }), null);
});

test('logs are lines or nothing', () => {
  assert.deepEqual(parseHostedAgentLogsResponse({ lines: ['a', 2, 'b'] }), ['a', 'b']);
  assert.deepEqual(parseHostedAgentLogsResponse('<html>'), []);
});

test('refusals: a named code wins, the status fills in, and no answer is offline', () => {
  assert.deepEqual(hostedAgentApiErrorOf({ status: 409, data: { error: { code: 'id_taken', message: 'taken' } } }), { status: 409, code: 'id_taken', message: 'taken' });
  assert.equal(hostedAgentApiErrorOf({ status: 501, data: { error: { code: 'docker_unavailable', message: 'no docker' } } }).code, 'docker_unavailable');
  assert.equal(hostedAgentApiErrorOf({ status: 400, data: { error: { code: 'model_not_served' } } }).code, 'model_not_served');
  assert.deepEqual(hostedAgentApiErrorOf({ status: 429, data: { error: 'too many' } }), { status: 429, code: 'limit_reached', message: 'too many' });
  assert.equal(hostedAgentApiErrorOf({ status: 'PARSING_ERROR', originalStatus: 404, data: '<html>' }).code, 'not_found');
  assert.equal(hostedAgentApiErrorOf({ status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' }).code, 'offline');
  assert.equal(hostedAgentApiErrorOf({ status: 418 }).code, 'unknown');
  assert.equal(hostedAgentApiErrorOf(undefined).code, 'unknown');
});

// ── /api/models/:id

test('one model parses, with its agent count when the node gives one', () => {
  assert.deepEqual(parseModelDetailResponse({ id: 'qwen', modality: 'chat', available: true, agents: 2 }), { id: 'qwen', modality: 'chat', available: true, agents: 2 });
  assert.equal(parseModelDetailResponse({ id: 'qwen', modality: 'chat' })?.agents, null);
  assert.equal(parseModelDetailResponse({ id: 'v', modality: 'video' }), null);
});

test('the model page tells not-served, older-node and offline apart', () => {
  const base = { id: 'qwen', detail: undefined, detailError: undefined, detailLoading: false, list: undefined, listError: undefined, listLoading: false };
  const list = { data: [{ id: 'qwen', modality: 'chat', available: true }] };
  assert.equal(modelDetailViewState({ ...base, detailLoading: true }).kind, 'loading');
  assert.equal(modelDetailViewState({ ...base, detail: { id: 'qwen', modality: 'chat', available: true, agents: 0 } }).kind, 'ok');
  // a node from before /api/models/:id: the route 404s as HTML, the list still carries the model
  const old = modelDetailViewState({ ...base, detailError: { status: 'PARSING_ERROR', originalStatus: 404 }, list });
  assert.equal(old.kind, 'ok');
  assert.equal(old.kind === 'ok' && old.model.agents, null);
  assert.equal(modelDetailViewState({ ...base, detailError: { status: 404 }, list: { data: [] } }).kind, 'not_served');
  assert.equal(modelDetailViewState({ ...base, detailError: { status: 404 }, listError: { status: 'PARSING_ERROR', originalStatus: 404 } }).kind, 'outdated');
  assert.equal(modelDetailViewState({ ...base, detailError: { status: 'FETCH_ERROR' }, listError: { status: 'FETCH_ERROR' } }).kind, 'offline');
});
