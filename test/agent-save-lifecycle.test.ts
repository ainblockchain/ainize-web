import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveHostedAgent } from '../src/lib/saveHostedAgent';
import { agentRequestUrl } from '../src/lib/agentRequestUrl';
import { canEditHostedAgentSpec, parseHostedAgentSpecResponse, type HostedAgentSpecInput } from '../src/api/hostedAgents';

const body: HostedAgentSpecInput = { id: 'sample', name: 'Sample', mode: 'prompt', model: 'chat', systemPrompt: 'Help.' };
const taken = { status: 409, data: { error: { code: 'id_taken' } } };

test('secret failure retries the accepted suffixed agent instead of creating a duplicate', async () => {
  let savedId: string | null = null;
  const created: string[] = []; const updated: string[] = []; const secrets: string[] = [];
  let failSecret = true;
  const options = {
    body, suggestedId: true, secrets: [{ name: 'API_KEY', value: 'fixture-only' }], active: () => true,
    create: async (spec: HostedAgentSpecInput) => { created.push(spec.id); if (spec.id === 'sample') throw taken; },
    update: async (spec: HostedAgentSpecInput) => { updated.push(spec.id); },
    setSecret: async (secret: { id: string }) => { secrets.push(secret.id); if (failSecret) throw new Error('offline'); },
    onSaved: (id: string) => { savedId = id; },
  };
  assert.deepEqual(await saveHostedAgent({ ...options, savedId }), { id: 'sample-2', failed: ['API_KEY'] });
  assert.equal(savedId, 'sample-2');
  failSecret = false;
  assert.deepEqual(await saveHostedAgent({ ...options, body: { ...body, id: 'changed-name' }, savedId }), { id: 'sample-2', failed: [] });
  assert.deepEqual(created, ['sample', 'sample-2']);
  assert.deepEqual(updated, ['sample-2']);
  assert.deepEqual(secrets, ['sample-2', 'sample-2']);
});

test('leaving an editor stops automatic retries and subsequent secret writes', async () => {
  let active = true; let creates = 0; let secretWrites = 0; let saved = false;
  const options = {
    body, savedId: null, suggestedId: true, secrets: [{ name: 'ONE', value: 'fixture' }, { name: 'TWO', value: 'fixture' }],
    active: () => active, create: async () => { creates++; active = false; throw taken; },
    update: async () => {}, setSecret: async () => { secretWrites++; active = false; }, onSaved: () => { saved = true; },
  };
  await assert.rejects(saveHostedAgent(options));
  assert.equal(creates, 1); assert.equal(secretWrites, 0); assert.equal(saved, false);
  active = true;
  assert.equal(await saveHostedAgent({ ...options, create: async () => { active = false; } }), null);
  assert.equal(saved, false); assert.equal(secretWrites, 0);
  active = true;
  assert.equal(await saveHostedAgent({ ...options, savedId: 'existing' }), null);
  assert.equal(secretWrites, 1); assert.equal(saved, true);
});

test('typed-id collisions do not invent another address and failed spec writes never upload secrets', async () => {
  let creates = 0; let secrets = 0;
  await assert.rejects(saveHostedAgent({
    body, savedId: null, suggestedId: false, secrets: [{ name: 'KEY', value: 'fixture' }], active: () => true,
    create: async () => { creates++; throw taken; }, update: async () => {},
    setSecret: async () => { secrets++; }, onSaved: () => { assert.fail('spec did not save'); },
  }));
  assert.equal(creates, 1); assert.equal(secrets, 0);
});

test('edit capability respects explicit denials and exact account ownership on older nodes', () => {
  const parse = (extra: object) => parseHostedAgentSpecResponse({ agent: { ...body, owner: 'sso:viewer', ...extra } })!;
  assert.equal(canEditHostedAgentSpec(parse({ can_manage: false }), ['sso:viewer']), false);
  assert.equal(canEditHostedAgentSpec(parse({ can_manage: true }), ['sso:org-writer']), true);
  assert.equal(canEditHostedAgentSpec(parse({}), ['sso:viewer']), true);
  assert.equal(canEditHostedAgentSpec(parse({}), ['sso:Viewer']), false);
  assert.equal(canEditHostedAgentSpec(parse({ owner: null }), ['sso:viewer']), false);
});

test('agent requests keep peer hosts even if they share the local API path', () => {
  const origin = 'https://www.ainize.ai';
  assert.equal(agentRequestUrl('https://ainize.ai/agents/a?x=1', origin), '/agents/a?x=1');
  assert.equal(agentRequestUrl('/api/agents/a', origin), '/api/agents/a');
  for (const url of ['https://peer.example/agents/a', 'https://peer.example/api/a', 'http://ainize.ai/agents/a', 'https://ainize.ai:8443/agents/a', 'https://ainize.ai/other/a']) {
    assert.equal(agentRequestUrl(url, origin), url);
  }
});
