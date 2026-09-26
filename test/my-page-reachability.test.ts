/**
 * Somebody signed in, who does not run this node, has a page.
 *
 * This is the hole the shorter menu left. `/network` and `/ledger` came out of the navigation on the promise
 * that `/account` leads to them — and `/account` is the node runner's screen, gated on `isOwner`, which answers
 * "this node is not yours" to everybody else. So the promise held for operators and for nobody else, and the
 * test written to guard it checked only that a link existed in the source of a page most people cannot open.
 *
 * These assert the gate, not the link. A destination is reachable when somebody who is merely signed in can
 * get to it.
 *
 *   node --test --import tsx test/my-page-reachability.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const header = read('src/components/ui/Header.tsx');
const app = read('src/App.tsx');

/** The dropdown's contents, where a signed-in person looks for their own things. */
const dropdown = header.slice(header.indexOf('<Menu $open={open}'), header.indexOf('</Menu>'));

test('the user menu offers a page to somebody who does not run this node', () => {
  const toMe = /navigate\('\/me'\)/.exec(dropdown);
  assert.ok(toMe, 'the dropdown had only operator screens and /my-nodes for everybody else');
  const line = dropdown.split('\n').find((l) => l.includes("navigate('/me')"))!;
  assert.ok(!line.includes('isOwner'), '/me gated on isOwner would rebuild the hole it is closing');
});

test('/me is routed behind sign-in, not behind ownership', () => {
  const route = app.split('\n').find((l) => l.includes('path="/me"'));
  assert.ok(route, '/me has no route');
  assert.ok(!route.includes('SigningCheckLayout'),
    'SigningCheckLayout refuses anybody who does not own this node — that is the gate that caused this');
  assert.ok(/SignedInLayout|RequireSignIn/.test(route), '/me must still require a session');
});

test('the operator screens stay where they are', () => {
  // This is not a loosening of /account. It runs the node: operators, settings, runtime, the node's wallet.
  const account = app.split('\n').find((l) => l.includes('path="/account"'))!;
  assert.ok(account.includes('SigningCheckLayout'), '/account is the node runner\'s screen and stays owner-gated');
});

test('/me leads to what left the menu', () => {
  const me = read('src/screens/MyPage.tsx');
  for (const [to, what] of [
    ['/network', 'the map of nodes'],
    ['/ledger', 'the public record'],
  ] as const) {
    assert.ok(me.includes(`to="${to}"`), `${to} left the navigation and /me is where it went (${what})`);
  }
});

test('/me shows the things that belong to a person rather than to a node', () => {
  const me = read('src/screens/MyPage.tsx');
  assert.match(me, /useApiKeysQuery/, 'API keys are the caller\'s, not the node\'s');
  assert.match(me, /my-?nodes|myNodes/i, 'and so are the nodes they run elsewhere');
});
