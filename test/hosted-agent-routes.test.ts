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
] as const) {
  test(`${path} renders ${page}`, () => {
    assert.ok(new RegExp(`path="${path.replace(/[/:]/g, (c) => `\\${c}`)}" element={<Layout><${page} />`).test(app), `${path} → ${page} is not routed`);
  });
}

test('no page is routed under /agents/, which is the A2A address', () => {
  assert.ok(!/path="\/agents\/[^"]/.test(app));
});
