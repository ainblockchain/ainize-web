/**
 * Signed in is not the same as allowed, and the app has to say so in every place it used to conflate them.
 *
 * For as long as only an owner of a node could hold a session, `isSignedIn` WAS permission, and every guard,
 * every menu item and every private field could read it as such. Sign-in is open now — a person connects a
 * wallet to be known and to be paid — so each of those reads is wrong about nearly every visitor: it would offer
 * a dashboard that answers "this node is not yours", show a stranger the node's runtime API, and waive a free-try
 * quota the node is still counting.
 *
 * A React test would need a DOM and a store to say this. What it comes down to is which name each decision reads,
 * so this reads the source: every guard, and every field the node keeps to itself, must be spelled `isOwner`.
 *
 *   node --test --import tsx test/auth-scope.test.ts     (packages/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');
/** Lines of real code — the claims below are about what runs, and comments discuss both names on purpose. */
const code = (rel: string) => read(rel).split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
const has = (rel: string, needle: string) => code(rel).some((l) => l.includes(needle));

test('the route guards ask who owns the node, not who is signed in', () => {
  const layout = code('components/base/Layout.tsx').join('\n');
  // /dashboard and the rest: not signed in is a redirect, because there is something to do about it. Signed in
  // and not the owner must NOT be — /signing would send them straight back and the two would trade the tab for
  // ever — so it renders a panel instead.
  assert.ok(layout.includes('if (!isOwner) return <Layout><NotYourNode /></Layout>;'), 'SigningCheckLayout must answer a non-owner, not redirect one');
  assert.ok(layout.includes('if (!isSignedIn) return <Navigate to={`/signing'), 'and must still send a signed-out visitor somewhere they can act');
  // The landing page sends only the node's runner to the dashboard. Bouncing every connected wallet there is the
  // old assumption in the most visible place there is.
  assert.ok(layout.includes('if (!loading && isOwner) return <Navigate to="/dashboard"'), 'FullScreenLayout');
  // Uploading a file into this node's catalogue is refused by the node to anyone else; the pre-screen offers the
  // door that IS open to a visitor.
  assert.ok(layout.includes('if (!isOwner) return <Layout><Suspense'), 'NewPatchGate');
});

test('nothing private is shown to a wallet that merely connected', () => {
  // Each of these was `isSignedIn`, and each is something the NODE gives only to its owner: the runtime API and
  // repo path of the machine, the manage view of a published knowledge, and the unmetered live-test counter.
  assert.ok(has('screens/NetworkPage.tsx', '{isOwner && (<>'), 'runtime api/repo');
  assert.ok(has('screens/PatchPage.tsx', '{!(isOwner && data.owned) && ('), 'buy vs manage');
  assert.ok(has('screens/ChatPage.tsx', 'const outOfTries = exhausted && !isOwner;'), 'free-try quota');
  assert.ok(has('screens/ChatPage.tsx', 'const quotaText = isOwner || quota === null'), 'the counter a visitor reads');
});

test('the header offers no link that lands on "this node is not yours"', () => {
  const header = code('components/ui/Header.tsx').join('\n');
  for (const owned of ['/dashboard', "navigate('/new-patch')", "navigate('/account')", "navigate('/drive')"]) {
    const line = header.split('\n').find((l) => l.includes(owned))!;
    assert.match(line, /isOwner/, `${owned} is an owner-only route and must be offered only to an owner`);
  }
  // The menu showed the NODE's name and the NODE's address as though they were yours — the same wrong idea twice.
  // A Google-only session has no wallet, so it is named by its account — still the person, never the node.
  assert.ok(header.includes("const who = subject ? shortAddr(subject, 6) : google?.email ?? '—';"), 'the button names the wallet that is connected');
  assert.ok(header.includes('{who} ▾'), 'the button shows who is signed in');
});

test('the app asks the node whether it is an owner rather than deciding for itself', () => {
  const ctx = code('auth/AuthContext.tsx').join('\n');
  // Not `isOwner: live` and not a scope computed here: a grant, a revocation or an edit to the node's config file
  // takes effect on the next /api/auth/me, which is what keeps a 30-day cookie from outliving a revocation.
  assert.match(ctx, /isOwner:\s*live\s*&&\s*!!data\?\.isOwner/);
  assert.match(ctx, /subject:\s*live\s*\?\s*data\?\.subject/, 'the subject is the person; `address` stays the node');
  assert.ok(ctx.includes('address: data?.address ?? null'), "the node's address keeps its own name");
});

test('the only signing scheme the browser asks for is the one a wallet can produce', () => {
  const page = code('screens/SigningPage.tsx').join('\n');
  // Stated, never inferred. The node fixes the scheme to the challenge it issues, so asking for the wrong one
  // fails at the signature rather than silently recording "a person approved this" when a key did.
  assert.ok(page.includes("challenge({ scheme: 'eip191' })"), 'the challenge names eip191');
  assert.ok(!page.includes('ainWallet'), 'the AIN Wallet extension path is gone, not left beside the new one');
  // The wallet's own answer is checked here: left to the node it becomes an opaque 401 on an unrelated route.
  assert.ok(page.includes('personalSign(w.provider, ch.message, address)'));
});

test('the authorize page shows the bytes the wallet will sign, not its own account of them', () => {
  const page = code('screens/AuthorizePage.tsx').join('\n');
  // A page saying one thing while the wallet signs another is the whole attack. The node composes the message and
  // stores it; this renders THAT string, so there is only one string and nothing for the two to disagree about.
  assert.ok(page.includes('<Signed data-testid="authorize-message">{data.message}</Signed>'), 'the message is rendered verbatim');
  assert.ok(page.includes('personalSign(w.provider, data.message, address)'), 'and it is what gets signed');
  // The key in full. `0x04…cb55` cannot be compared against what the terminal printed, which is the one check a
  // person can actually make here.
  assert.ok(page.includes('<Mono>{data.delegate}</Mono>'), 'the key is not abbreviated');
  // Readable before signed in: being told to connect a wallet before being allowed to read what for is backwards.
  const app = code('App.tsx').join('\n');
  assert.ok(app.includes('<Route path="/authorize" element={<Layout><AuthorizePage /></Layout>} />'), 'not behind a sign-in guard');
});

test('an expired or spent request is a different answer from a button that fails', () => {
  const page = code('screens/AuthorizePage.tsx').join('\n');
  // "Run it again" and "you already did this" are different things to do next, and a person who is told neither
  // will click approve until something happens.
  // `tt` resolves to the cli or node wording — a node prints a new link on its next start, a CLI is re-run,
  // and telling somebody the wrong one of those is telling them to do something that will not work.
  assert.match(page, /data\.status === 'expired' \? tt\('expired'\)/);
  assert.match(page, /data\.status !== 'pending' \? t\('op\.authorize\.used'\)/);
});

test('a visitor who does not run the node is given ways out, never a command they cannot run', () => {
  const layout = code('components/base/Layout.tsx').join('\n');
  const app = code('App.tsx').join('\n');

  // It used to print `ainize operators add <their address>`: a command that needs a shell on somebody else's
  // machine, and which — if they somehow ran it — would make them an owner of a node that is not theirs. It told
  // a visitor their own wallet was the wrong kind of thing, and then gave them nothing to do about it.
  assert.ok(!layout.includes('operators add'), 'no shell command on a screen a visitor reaches from a browser');
  assert.ok(!/<code>/.test(layout.split('function NotYourNode')[1] ?? ''), 'and nothing shaped like one');

  // What it offers instead. Each of these must be a route with no guard on it, or the way out is another wall.
  for (const to of ['/chat', '/explore', '/teach']) {
    assert.ok(layout.includes(`<Way to="${to}"`), `${to} is offered`);
    const route = app.split('\n').find((l) => l.includes(`path="${to}"`))!;
    assert.ok(route, `${to} is a route`);
    assert.ok(!/SigningCheckLayout|NewPatchGate/.test(route), `${to} must be open to a visitor — it is offered as the way out`);
  }
  // And the answer to "these screens are not for you": run a node where they are. A guide, not a command.
  assert.match(layout, /const setup = locale === 'ko' \? '\/docs\/ko\/get-started\/quickstart'/);
  assert.ok(layout.includes('<Way to={setup}'), 'the setup guide is a link');
});

test('a malformed anchor from any node must not white-page the explorer', () => {
  // `benchmark.format` is typed `string[]` and read with `?.length ? .join() : null`. A node that wrote a bare
  // string sailed past the length check — a string has one — and threw on `.join`. Inside a `.map` over the
  // catalogue that is not a broken row, it is a blank page where /explore used to be, for every visitor, caused
  // by one record a stranger published. Anchors are written by other people's nodes; their shapes are claims.
  // Every page that renders it, not just the one that happened to crash. What must not appear is a read of the
  // ANCHOR's field as though its type were guaranteed; a local already narrowed by benchmarkFormats() is fine,
  // which is the difference between `g.format.join(…)` (safe) and `a.benchmark.format.join(…)` (the crash).
  for (const f of ['components/public/PatchListItem.tsx', 'screens/PatchPage.tsx', 'screens/BenchmarkPage.tsx']) {
    const src = code(f).join('\n');
    assert.ok(!/benchmark\??\.format(\?\.|\.)(length|join)\b/.test(src), `${f}: an anchor field is read as if its type were guaranteed`);
    if (/benchmark\??\.format/.test(src)) assert.match(src, /benchmarkFormats\(/, `${f}: reads benchmark.format without narrowing it`);
  }
  const helper = code('utils/format.ts').join('\n');
  assert.ok(helper.includes('benchmarkFormats'), 'the shape is narrowed in one place');
});

/**
 * The page describes what is actually asking.
 *
 * One request shape serves two situations: a command line the person just ran, and a node that started in
 * another room and printed its own link. The page was written for the first only, so somebody approving a
 * node read "Authorize a command line?" over a lead telling them to reject it unless they had just run
 * `ainize login` — which is advice to refuse the thing they came to approve. The prompt that says what you
 * are approving is the one a security page cannot get wrong.
 */
test('the authorisation page speaks about a node when a node is what asked', () => {
  const page = code('screens/AuthorizePage.tsx').join('\n');
  assert.match(page, /const k = data\.kind === 'node' \? 'node' : 'cli'/, 'the wording follows what the node recorded');
  // Nothing user-visible may reach for the flat key again: that is how the cli wording came back last time.
  const flat = [...page.matchAll(/t\('op\.authorize\.(\w+)'\)/g)].map((m) => m[1]);
  const neutral = new Set(['title', 'busy', 'reject', 'label', 'node', 'until', 'message', 'signin_first', 'done_end', 'used', 'unknown', 'no_code', 'wallet_mismatch']);
  assert.deepEqual(flat.filter((key) => !neutral.has(key)), [], 'a string that differs between a CLI and a node must go through tt()');

  const strings = code('i18n/pages/operator.ts').join('\n');
  for (const key of ['title', 'lead', 'key', 'label_hint', 'approve', 'done', 'rejected', 'expired']) {
    for (const kind of ['cli', 'node']) {
      assert.ok(strings.includes(`'op.authorize.${kind}.${key}'`), `op.authorize.${kind}.${key} is missing`);
    }
  }
  // The advice that is wrong for the other case, in the case it is wrong for.
  const nodeLead = strings.match(/'op\.authorize\.node\.lead':[^\n]*/)![0];
  assert.ok(nodeLead.includes('no wallet spending'), 'node linking must not promise account delegation');
});
