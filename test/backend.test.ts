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
import { agentEndpoints, agentRequestUrl } from '../src/lib/agentRequestUrl';

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
  // `git` is here for the reason the others are, and one more: a repository address is pasted into
  // `git clone`, and a missing route makes git say "is this a git repository?" — which reads as the agent
  // not existing rather than as this app not forwarding.
  for (const prefix of ['api', 'agents', 'x402', 'p2p', 'git']) {
    const route = join(root, 'app', prefix, '[...path]', 'route.ts');
    assert.ok(existsSync(route), `app/${prefix}/[...path]/route.ts is what serves /${prefix}/*`);
    const src = readFileSync(route, 'utf8');
    assert.match(src, /nodeRoutes\('\/(api|agents|x402|p2p|git)'\)/, `${prefix} relays to the node`);
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
  const page = readFileSync(join(root, 'src/screens/AgentPage.tsx'), 'utf8');
  assert.match(page, /fetch\(samePath\(/, 'an absolute node address from a www. page is a cross-origin POST');
  assert.ok(page.includes('agentRequestUrl(url, window.location.origin)'), 'destination policy is shared with its behavior tests');
});

test('the live test offers the AGENT\'s examples, not one agent\'s job hard-coded into the page', () => {
  // Comments stripped: the file explains this history in prose, and the test is about what RENDERS.
  const page = readFileSync(join(root, 'src/screens/AgentPage.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // The buttons were three news articles, so every other agent got a form asking for a news article.
  assert.equal(/Paste an article/.test(page), false, 'the placeholder must not describe one agent\'s input');
  assert.equal(/publisher pages|Scoring…/.test(page), false, 'nor must the waiting note describe one agent\'s work');
  assert.match(page, /examplesOf\(skills\)/, 'examples come from the card');
  assert.match(page, /samePath\(cardUrl\)/, 'the card is fetched from this app, same origin');
});

/**
 * The way in for somebody who built an agent.
 *
 * The UX review that produced these: a builder landing on the site read the nav (`Explore knowledge | Live test
 * | Teach | Docs & API`), the three doors of "which one are you?" (use knowledge / teach / run a node) and the
 * docs index, and nowhere learned that a node gives an agent a public address — although `ainize agent add`
 * had shipped, the marketplace listed agents, and the whole path worked. The capability was complete and
 * invisible. These assert the entrances exist, in every chrome, because the landing has its own.
 */
test('both navigations offer the agents, not just the one on inner pages', () => {
  const header = readFileSync(join(root, 'src/components/ui/Header.tsx'), 'utf8');
  const landing = readFileSync(join(root, 'src/screens/LandingPage.tsx'), 'utf8');
  for (const [name, src] of [['Header', header], ['LandingPage', landing]] as const) {
    assert.match(src, /to="\/explore\?kind=agent"/, `${name} has no way into the agents`);
  }
});

test('the landing answers "which one are you?" for somebody holding an agent', () => {
  const landing = readFileSync(join(root, 'src/screens/LandingPage.tsx'), 'utf8');
  assert.match(landing, /audience\('agent'\)/, 'the fourth door');
  assert.match(landing, /landing-agent-cta/);
  assert.match(landing, /docs\/how-to\/host-an-agent/, 'and the page that tells them how');
});

test('the how-to an agent builder needs exists, in both languages, and is listed', () => {
  for (const lang of ['en', 'ko']) {
    const page = join(root, 'docs', lang, 'how-to/host-an-agent.md');
    assert.ok(existsSync(page), `docs/${lang}/how-to/host-an-agent.md`);
    const toc = readFileSync(join(root, 'docs', lang, '_toctree.json'), 'utf8');
    assert.match(toc, /how-to\/host-an-agent/, `${lang} toctree does not list it, so nothing links to it`);
  }
  // the command it teaches must be the one that works without a restart
  const en = readFileSync(join(root, 'docs/en/how-to/host-an-agent.md'), 'utf8');
  assert.match(en, /ainize agent add [\w-]+ --upstream/);
});

test('one list, one item — the item page is not a second list', () => {
  const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
  // /agents was a grid of every agent PLUS a panel, so clicking a row on the marketplace showed both again
  assert.match(app, /path="\/agent\/:id"/, 'the item has its own route');
  assert.match(app, /path="\/agents" element=\{<Navigate to="\/explore\?kind=agent"/, 'the old list redirects');
  const item = readFileSync(join(root, 'src/screens/AgentPage.tsx'), 'utf8');
  assert.equal(/agents\.map\(/.test(item), false, 'the item page must not render the list');
  const row = readFileSync(join(root, 'src/components/public/AgentListItem.tsx'), 'utf8');
  assert.match(row, /to=\{(`\/agent\/|agentPagePath\()/, 'a row links to the item');
  // the link helper (by alias when the agent has one) builds the same singular path
  assert.match(readFileSync(join(root, 'src/api/agentIds.ts'), 'utf8'), /return `\/agent\/\$\{encodeURIComponent\(/);
  // singular, because /agents/<id> is the A2A endpoint served by app/agents/[...path]/route.ts
  assert.equal(/to=\{`\/agents\//.test(row), false, 'a page under /agents/ would shadow the agent address');
});

/** A short peer registration can change with the freshest advert; selected identity must survive that. */
test('peer execution and cards stay on the selected public relay instead of a moving short registration', () => {
  const node = { address: '0xselected', name: 'Selected node' };
  const row = { id: 'guide', node, a2a_url: 'https://ainize.ai/agents/guide', card_url: 'https://ainize.ai/agents/guide/.well-known/agent-card.json', call_url: 'https://ainize.ai/api/sam/0xselected/a2a/guide' };
  const selected = agentEndpoints(row);
  assert.equal(agentRequestUrl(selected.call, 'https://www.ainize.ai'), '/api/sam/0xselected/a2a/guide');
  assert.equal(selected.card, row.call_url + '/.well-known/agent-card.json');
  assert.deepEqual(agentEndpoints({ ...row, a2a_url: 'https://ainize.ai/agents/another-registration' }), selected);
  assert.notEqual(agentEndpoints({ ...row, node: { address: '0xother', name: 'Other node' }, call_url: 'https://ainize.ai/api/sam/0xother/a2a/guide' }).call, selected.call);
});
