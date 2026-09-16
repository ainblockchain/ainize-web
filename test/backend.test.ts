/**
 * The property that makes this app a backend and not a proxy: the node's address is server-side.
 *
 * `browser → this app → main node → the node that runs the agent`. Only the first hop is public, and the only
 * thing enforcing that is which files may import the node URL. A single `import { NODE_URL }` in a component
 * would compile, run, and ship the address of a machine that is supposed to be unreachable — in a bundle, to
 * every visitor. Nothing else would fail, which is why this is a test.
 *
 * The route handlers are checked for existence for a duller reason: `/agents/<id>` is the address printed on an
 * agent card and handed to strangers. If that file disappears the page still works, the listing still renders,
 * and every A2A client in the world gets this app's HTML instead of a card.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

test('the node URL is imported only by the backend — a component that imports it ships the address', () => {
  const offenders = walk(join(root, 'src'))
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('lib/node-url.ts') && !f.endsWith('lib/proxy.ts'))
    .filter((f) => /from '[^']*lib\/node-url'|from '@\/lib\/node-url'/.test(readFileSync(f, 'utf8')))
    .map((f) => f.slice(root.length + 1));
  assert.deepEqual(offenders, [], 'these reach for the node URL outside the route handlers');
});

test('the browser is given relative URLs only — an absolute node address would defeat the hop', () => {
  const api = readFileSync(join(root, 'src/api/api.ts'), 'utf8');
  const baseUrl = /baseUrl:\s*'([^']*)'/.exec(api);
  assert.ok(baseUrl, 'the API slice declares a baseUrl');
  assert.equal(baseUrl[1], '/', 'same origin: the app is the only host the browser talks to');
  assert.equal(/process\.env\.AINIZE_NODE_URL/.test(api), false, 'the node URL never appears in client code');
});

test('every prefix the browser can reach the node through has a route handler', () => {
  for (const prefix of ['api', 'agents', 'x402', 'p2p']) {
    const route = join(root, 'app', prefix, '[...path]', 'route.ts');
    assert.ok(existsSync(route), `app/${prefix}/[...path]/route.ts is what serves /${prefix}/*`);
    const src = readFileSync(route, 'utf8');
    assert.match(src, /nodeRoutes\('\/(api|agents|x402|p2p)'\)/, `${prefix} relays to the node`);
    assert.match(src, /export const \{ GET, POST/, 'a card is a GET and a call is a POST');
    // Without this Next answers the preflight itself, with `allow:` and no `access-control-allow-origin`,
    // and a browser on any other origin — including `www.` of this same site — reads that as a refusal.
    assert.match(src, /OPTIONS \} =/, `${prefix} relays the preflight to the node, which sets the CORS headers`);
  }
});

test('the app shell renders in the browser only, and says why', () => {
  const client = readFileSync(join(root, 'app/client-app.tsx'), 'utf8');
  assert.match(client, /^'use client';/, 'ssr:false needs a client component to live in');
  assert.match(client, /ssr:\s*false/);
});

test('src/pages is not resurrected — Next would read it as a second router', () => {
  assert.equal(existsSync(join(root, 'src/pages')), false,
    'the screens live in src/screens; a directory named pages turns on the Pages Router and breaks the build');
});

test('the live test posts to the origin the reader is on, not the one the node calls itself', () => {
  const page = readFileSync(join(root, 'src/screens/AgentsPage.tsx'), 'utf8');
  assert.match(page, /fetch\(samePath\(/, 'an absolute node address from a www. page is a cross-origin POST');
  // and the rewrite is limited to this app's own prefixes: an agent on another host must keep its host
  assert.match(page, /\^\\\/\(api\|agents\)\\\//, 'samePath only relativises /api and /agents');
});
