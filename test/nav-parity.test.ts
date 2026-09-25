/**
 * The two navigations, held to the same list of destinations.
 *
 * There are two: the shared header (`Header.tsx`), on every page, and the landing page's own chrome
 * (`LandingPage.tsx`), which is the one a first-time visitor actually sees. They have drifted apart three
 * times, and the code comments record the first two:
 *
 *   • "The landing has its own chrome, and adding the entry to the shared header left this one without it"
 *   • "Finding 69: /docs was in every other page's header and in neither of the landing's chromes."
 *
 * The third was `/network` and `/ledger` — on every page except the front one. Each time the fix was to add
 * the missing link, which is what leaves the next one to be found by a visitor rather than by us. A link added
 * to one nav and not the other is not a judgement call; it is a thing that can be checked.
 *
 * This reads the sources rather than rendering them. The app is a browser app with no renderer in this suite,
 * and what is being asserted is about the code as written — which destinations each file offers — not about
 * what React does with it. That makes the test blind to a link rendered from a variable, so the two files must
 * keep writing their `to="…"` literally; a future nav built from an array should move that array somewhere
 * both import, which would make this test unnecessary rather than wrong.
 *
 *   node --test --import tsx test/nav-parity.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const header = readFileSync(join(root, 'src/components/ui/Header.tsx'), 'utf8');
const landing = readFileSync(join(root, 'src/screens/LandingPage.tsx'), 'utf8');

/**
 * Destinations inside a nav element, as the file writes them.
 *
 * Scoped to the nav so that a link elsewhere on the landing page — a hero button, a card's call to action —
 * does not count as navigation. The landing has many of those and they are not the menu.
 */
function navDestinations(source: string, open: RegExp, close: string): string[] {
  const start = source.search(open);
  assert.ok(start >= 0, `could not find the nav opening ${open} — did the markup change?`);
  const end = source.indexOf(close, start);
  assert.ok(end > start, `could not find ${close} after the nav opened`);
  const block = source.slice(start, end);
  return [...new Set([...block.matchAll(/\bto="([^"]+)"/g)].map((m) => m[1]))];
}

/** The shared header's nav, on every page but the landing. */
const headerNav = () => navDestinations(header, /<Nav>/, '</Nav>');
/** The landing's own nav — the one a first-time visitor sees. */
const landingNav = () => navDestinations(landing, /<NavLinks\b/, '</NavLinks>');

/**
 * Where the two are allowed to differ, each with a reason.
 *
 * An exception with no reason is how this test stops meaning anything, so the list is a map rather than an
 * array and every key has to say why.
 */
const ALLOWED_ONLY_IN_HEADER: Record<string, string> = {
  '/dashboard': 'the node runner\'s screen, shown only to an owner; the landing has no session yet',
};
const ALLOWED_ONLY_IN_LANDING: Record<string, string> = {
  '/chat?teach=1': 'the landing links straight to the chat door; the header leads to the entry choice at /teach',
};
const ALLOWED_EQUIVALENT: Record<string, string> = {
  '/teach': '/chat?teach=1',
};

test('every destination in the shared header is reachable from the landing nav too', () => {
  const inLanding = new Set(landingNav());
  const missing = headerNav().filter((to) => {
    if (inLanding.has(to)) return false;
    if (to in ALLOWED_ONLY_IN_HEADER) return false;
    const equivalent = ALLOWED_EQUIVALENT[to];
    return !(equivalent && inLanding.has(equivalent));
  });
  assert.deepEqual(missing, [],
    `these are in every page's header and not in the landing's own nav, which is the one a first-time visitor sees: ${missing.join(', ')}`);
});

test('the landing nav offers nothing the header has forgotten', () => {
  const inHeader = new Set(headerNav());
  const equivalents = new Set(Object.values(ALLOWED_EQUIVALENT));
  const extra = landingNav().filter((to) =>
    !inHeader.has(to) && !(to in ALLOWED_ONLY_IN_LANDING) && !equivalents.has(to));
  assert.deepEqual(extra, [],
    `these are on the landing and nowhere else, so a visitor loses them the moment they navigate: ${extra.join(', ')}`);
});

test('the three destinations this drifted on before are in both', () => {
  // Named rather than left to the general check, so a regression says which one and why it mattered.
  const inHeader = new Set(headerNav());
  const inLanding = new Set(landingNav());
  for (const [to, why] of [
    ['/docs', 'Finding 69 — documentation was on every page but the front one'],
    ['/network', 'the map of nodes'],
    ['/ledger', 'the public record of sales'],
  ] as const) {
    assert.ok(inHeader.has(to), `${to} is missing from the shared header (${why})`);
    assert.ok(inLanding.has(to), `${to} is missing from the landing nav (${why})`);
  }
});

test('every allowed difference carries a reason', () => {
  for (const [to, reason] of Object.entries({ ...ALLOWED_ONLY_IN_HEADER, ...ALLOWED_ONLY_IN_LANDING })) {
    assert.ok(reason.trim().length > 20, `the exception for ${to} needs to say why, not just exist`);
  }
});
