import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadLiveAgentFixture } from '../scripts/ainft-live-fixture.js';

const root = 'https://node.example';
const metadata = { name: 'Actual companion', description: 'Published hosted agent', image: `${root}/api/ainft/avatar.svg`, external_url: `${root}/agent/companion`, ainize: { schemaVersion: 1, agentId: 'companion', detailUrl: `${root}/agent/companion`, agentUrl: `${root}/agents/companion`, cardUrl: `${root}/agents/companion/.well-known/agent-card.json`, release: '3', access: 'holder', growthPolicy: 'activity-v1' } };
const card = { name: metadata.name, url: metadata.ainize.agentUrl, version: '3' };
function server(meta: unknown = metadata, agentCard: unknown = card, status = 200) {
  const requests: string[] = [];
  const http = (async (url: string | URL | Request, options?: RequestInit) => {
    const path = String(url); requests.push(path);
    assert.equal(options?.redirect, 'error'); assert.equal(options?.cache, 'no-store');
    return new Response(JSON.stringify(path.endsWith('ainft-metadata') ? meta : agentCard), { status });
  }) as typeof fetch;
  return { http, requests };
}
test('live registration uses the actual published metadata and matching agent card', async () => {
  const { http, requests } = server();
  const fixture = await loadLiveAgentFixture(metadata.external_url, http);
  assert.equal(fixture.agentId, 'companion'); assert.deepEqual(fixture.metadata, metadata);
  assert.deepEqual(requests, [`${root}/api/hosted-agents/companion/ainft-metadata`, metadata.ainize.cardUrl]);
  assert.equal((await loadLiveAgentFixture(metadata.external_url, server({ ...metadata, description: 'Changed' }).http)).fingerprint === fixture.fingerprint, false);
  await loadLiveAgentFixture(metadata.external_url, server(metadata, { name: card.name, version: card.version, supportedInterfaces: [{ url: card.url, protocolVersion: '1.0' }, { url: card.url, protocolVersion: '0.3' }] }).http);
});
test('different agent, stale release and unavailable published agents cannot become mint fixtures', async () => {
  await assert.rejects(loadLiveAgentFixture(metadata.external_url, server({ ...metadata, ainize: { ...metadata.ainize, agentId: 'other' } }).http), /metadata does not match/);
  await assert.rejects(loadLiveAgentFixture(metadata.external_url, server(metadata, { ...card, version: '2' }).http), /release/);
  await assert.rejects(loadLiveAgentFixture(metadata.external_url, server(metadata, { ...card, supportedInterfaces: [{ url: 'https://other.example/agents/companion' }] }).http), /release/);
  await assert.rejects(loadLiveAgentFixture(metadata.external_url, server(metadata, card, 404).http), /unavailable/);
});
test('fixture addresses cannot inject credentials, query data or arbitrary endpoints', async () => {
  for (const url of ['https://user:secret@node.example/agent/companion', `${metadata.external_url}?secret=hidden`, `${root}/api/hosted-agents/companion`, 'file:///agent/companion']) {
    const { http, requests } = server();
    await assert.rejects(loadLiveAgentFixture(url, http), /exact hosted agent/);
    assert.deepEqual(requests, []);
  }
});
