/**
 * The hosted-agent pages are routed, and routed where they cannot collide.
 *
 * `/agents/<id>` is the agent's A2A address (app/agents/[...path]); pages live under the singular `/agent/`. The
 * create form and the edit form must be declared as their own routes, or `/agent/new` would render the agent page
 * for an agent called "new".
 *
 *   node --test --import tsx test/hosted-agent-routes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');

for (const [path, page] of [
  ['/models/:id', 'ModelDetailPage'],
  ['/agent/new', 'AgentCreatePage'],
  ['/agent/:id/edit', 'AgentCreatePage'],
  ['/agent/:id', 'AgentPage'],
  // linked agents (ainize-node linked-agents design): registered by URL, edited under their own segment
  ['/agent/link', 'AgentLinkPage'],
  ['/agent/:id/link', 'AgentLinkPage'],
  // organizations (ainize-node organizations design): `/org/new` and `/org/join/:token` are declared before `/org/:id`
  ['/org', 'OrgsPage'],
  ['/org/new', 'OrgCreatePage'],
  ['/org/join/:token', 'OrgJoinPage'],
  ['/org/:id/settings', 'OrgSettingsPage'],
  ['/org/:id', 'OrgPage'],
] as const) {
  test(`${path} renders ${page}`, () => {
    // `<Layout>` for a public page, `<SignedInLayout>` for one behind sign-in — either is "routed"; which one is the route's own business
    assert.ok(new RegExp(`path="${path.replace(/[/:]/g, (c) => `\\${c}`)}" element={<(?:SignedIn)?Layout><${page} />`).test(app), `${path} → ${page} is not routed`);
  });
}

test('no page is routed under /agents/, which is the A2A address', () => {
  assert.ok(!/path="\/agents\/[^"]/.test(app));
});

test('/me/agents is routed behind sign-in, not behind ownership or a wallet', () => {
  const route = app.split('\n').find((l) => l.includes('path="/me/agents"'));
  assert.ok(route, '/me/agents has no route');
  assert.ok(/SignedInLayout/.test(route!), 'an AIN account with no wallet owns linked agents, so a session is the gate');
  assert.ok(!route!.includes('SigningCheckLayout'), 'owning this node is not what this page is about');
});

test('the two route words under /agent/ are reserved as ids, so no agent is left without a page', () => {
  const hosted = readFileSync(join(root, 'src/api/hostedAgents.ts'), 'utf8');
  const reserved = /HOSTED_AGENT_RESERVED_IDS[^=]*=\s*\[([^\]]*)\]/.exec(hosted)?.[1] ?? '';
  for (const word of ['new', 'link']) assert.ok(reserved.includes(`'${word}'`), `${word} is a route under /agent/ and must be a reserved id`);
});
