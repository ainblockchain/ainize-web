/**
 * What left the menu has to be reachable from somewhere.
 *
 * `/network` and `/ledger` were taken out of the top navigation on the promise that a signed-in page leads to
 * them — the menu got shorter, access did not change.
 *
 * The first version of this file checked for a link in `AccountPage.tsx` and passed, while the promise was
 * broken: `/account` is gated on owning THIS node, so everybody else was answered "this node is not yours". A
 * link on a page somebody cannot open is not a way in. The destination test now names `/me`, which asks only
 * for a session — see `my-page-reachability.test.ts`, which asserts that gate rather than this link.
 *
 * Both pages already existed in fuller form than any summary could be, so the account page links rather than
 * reimplements. That is the point of testing the link and not the content: a section that copies a page is a
 * second thing to keep in step, and this navigation has drifted three times already.
 *
 *   node --test --import tsx test/account-reachability.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const account = read('src/screens/AccountPage.tsx');
const footer = read('src/components/ui/Footer.tsx');
const header = read('src/components/ui/Header.tsx');
const landing = read('src/screens/LandingPage.tsx');
const app = read('src/App.tsx');

for (const [to, what] of [
  ['/network', 'the map of nodes'],
  ['/ledger', 'the public record of sales'],
] as const) {
  test(`${to} left the menu, so a signed-in page leads to it (${what})`, () => {
    const mine = read('src/screens/MyPage.tsx');
    assert.ok(mine.includes(`to="${to}"`) || account.includes(`to="${to}"`),
      `${to} is in neither navigation any more; /me is where somebody signed in should find it`);
    assert.ok(mine.includes(`to="${to}"`),
      `${to} is linked only from /account, which refuses anybody who does not run this node`);
  });

  test(`${to} is still routed, so the URL somebody bookmarked still works`, () => {
    assert.ok(app.includes(`path="${to}"`), `${to} lost its route — that is an access change, not a menu change`);
  });

  test(`${to} is still in the footer, where a signed-out visitor can reach it`, () => {
    assert.ok(footer.includes(`to="${to}"`),
      `${to} is only reachable from a signed-in page now; the public record has to stay public`);
  });

  test(`${to} is out of both navigations, not just one`, () => {
    assert.ok(!header.includes(`to="${to}"`), `${to} is still in the shared header`);
    assert.ok(!landing.includes(`to="${to}"`), `${to} is still in the landing nav`);
  });
}

test('/chat kept every way in except the menu entry', () => {
  // The live test left the menu because the landing hero already leads there. Losing the hero too would have
  // made it unreachable for a first-time visitor, which was never the intent.
  assert.ok(landing.includes('to="/chat"'), 'the landing hero still leads to the live test');
  assert.ok(app.includes('path="/chat"'), 'and the route is still there');
  assert.ok(!header.includes('<NavItem to="/chat">'), 'but the menu entry is gone');
});

test('/models is routed, because a menu entry to nowhere is worse than no entry', () => {
  assert.ok(app.includes('path="/models"'));
  assert.ok(header.includes('to="/models"'));
  assert.ok(landing.includes('to="/models"'));
});
