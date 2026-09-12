/**
 * The hero diagram makes claims about what this product does, and nothing else in the suite holds it to them.
 *
 * `lifecycle.test.ts` pins Lifecycle's eight steps, their commands and their routes against README.md, so that
 * diagram cannot drift. `HeroGraph.tsx` had no such anchor: a later edit could close the 14px gap, make a
 * dashed edge solid, stamp the combined file or add a second filled arrowhead, and every one of those is a
 * sentence about the product that stopped being true. Each test below is one of those sentences.
 *
 *   node --test --import tsx test/heroGraph.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** The geometry — every node and edge lives here, and it imports no styled-components on purpose. */
const SRC = readFileSync(fileURLToPath(new URL('../src/components/public/HeroScene.tsx', import.meta.url)), 'utf-8');
/** The two wrappers: sizing, the media queries that decide which one shows, and the motion. */
const WRAP = readFileSync(fileURLToPath(new URL('../src/components/public/HeroGraph.tsx', import.meta.url)), 'utf-8');

test('the art carries no text: the headline, the sub and the legend are what say anything', () => {
  assert.ok(!/<text[\s>]/.test(SRC), 'a <text> node in the art is a string that never reaches the dictionary');
  assert.ok(!/<tspan[\s>]/.test(SRC));
  assert.ok(!/<text[\s>]/.test(WRAP));
  assert.match(WRAP, /aria-hidden="true"/, 'the art is decorative: the prose beside it is the content');
  assert.equal((WRAP.match(/aria-hidden="true"/g) ?? []).length, 2, 'both the wide and the compact instance');
});

test('one payment, one recipient: exactly one filled arrowhead exists and only the buy arc uses it', () => {
  // `hg-paid` is the only marker with a filled path. A second one would say the buyer pays somebody else —
  // they do not: the buyer makes one payment to the seller's node, and the seller sends shares afterwards.
  const filled = SRC.match(/<path d="M0 1 L9 5 L0 9 z" fill=\{MONEY\} \/>/g) ?? [];
  assert.equal(filled.length, 1, 'exactly one filled (paid) arrowhead may exist');
  assert.equal((SRC.match(/markerEnd="url\(#hg-paid\)"/g) ?? []).length, 1, 'and exactly one edge may use it');
  assert.match(SRC, /className="hg-buy"/, 'that edge is the buy arc');
  assert.match(WRAP, /\.hg-buy path/, 'and the wrapper animates it');
});

test('the three payouts are one weight, one origin and open-headed', () => {
  const open = SRC.indexOf('className="hg-payouts"');
  const groupTag = SRC.slice(open, SRC.indexOf('>', open));
  // The width, the head and the colour live on the <g>, which is what makes the three arcs identical.
  assert.match(groupTag, /markerEnd="url\(#hg-owed\)"/, 'open head — a promise recorded, sent by a retrying job');
  assert.match(groupTag, /strokeWidth=\{1\.3\}/, 'one weight for all three');
  const paths = SRC.slice(SRC.indexOf('>', open), SRC.indexOf('</g>', open));
  assert.equal((paths.match(/<path d="M5\d\d 1\d\d/g) ?? []).length, 3, 'three payouts: one per distinct ancestor author');
  assert.ok(!/strokeWidth=|stroke=|markerEnd=/.test(paths), 'no per-path override: an unequal arc would be an unequal split');
});

test('combining is drawn as built-and-off: dashed, unstamped, and it never lands', () => {
  const flagged = SRC.slice(SRC.indexOf('combining two knowledges'), SRC.indexOf('the knowledges and the people'));
  assert.match(flagged, /strokeDasharray="5 4"/, 'the combine edges stay dashed while teach.lineage defaults to false');
  assert.match(flagged, /<KnowledgeFile x=\{\d+\} y=\{\d+\} dashed \/>/, 'the combined file stays dashed');
  assert.ok(!/<Stamps x=\{4[2-4]\d\}/.test(flagged), 'the combined file must carry no check stamps');
  // The gap is the claim, not the coordinate: whatever the layout, the combine thread must END ABOVE the
  // memory strip it points at. Pinning the numbers made this test break every time the art was nudged, which
  // teaches the next person to update the number rather than to check the gap.
  const thread = /<path d="M\d+ \d+ V(\d+)"[^/]*strokeDasharray="4 4"/.exec(flagged);
  assert.ok(thread, 'the combine path still has a dashed thread toward the table');
  const stripTop = Number(/<rect x=\{-40\} y=\{(\d+)\}/.exec(SRC)?.[1]);
  assert.ok(Number(thread[1]) < stripTop - 10, `the thread ends at ${thread[1]}, which must be clear of the table at ${stripTop}`);
  assert.ok(!/markerEnd/.test(flagged), 'and it has no arrowhead: nothing combined has landed on a default node');
});

test('two stamps, never three: the default quorum is two', () => {
  const stamps = SRC.slice(SRC.indexOf('function Stamps'), SRC.indexOf('function Person'));
  assert.equal((stamps.match(/<path d=/g) ?? []).length, 2, 'a Stamps mark is exactly two ticks');
  assert.equal((SRC.match(/<Stamps /g) ?? []).length, 5, 'five verified files, and the combined one is not among them');
});

test('the base checkpoint is hatched, locked and empty — nothing here is retraining', () => {
  assert.match(SRC, /id="hg-hatch"/);
  assert.equal((SRC.match(/url\(#hg-hatch\)/g) ?? []).length, 2, 'one locked base per model, and there are two models');
  // Anything drawn inside the slab would read as the product writing to the base weights. It never does.
  const slabRects = SRC.match(/<rect x=\{-?\d+\} y=\{464\}[^/]*\/>/g) ?? [];
  assert.equal(slabRects.length, 2);
  for (const r of slabRects) assert.match(r, /fill="url\(#hg-hatch\)"/, 'the slab carries the hatch and nothing else');
});

test('two model strips, both running off the frame: there is no one global brain', () => {
  assert.equal((SRC.match(/url\(#hg-rows\)/g) ?? []).length, 2, 'one memory strip per node');
  // Off the FRAME is the claim: the viewBox is 0..900, so a strip that begins at -40 or ends at 940 is bigger
  // than the picture. The y is layout and may move.
  assert.match(SRC, /M-40 \d+ H\d+/, "the seller's model starts off the left edge");
  assert.match(SRC, /M940 \d+ H\d+/, "the buyer's model runs off the right edge");
});

test('applying carries no arrowhead, because applying is reversible', () => {
  const applyBlock = SRC.slice(SRC.indexOf('applying: reversible'), SRC.indexOf('the sale. One payment'));
  assert.ok(!/markerEnd/.test(applyBlock));
});

test('a declared source ends in a socket, never an arrowhead', () => {
  const declares = SRC.slice(SRC.indexOf('function Declares'), SRC.indexOf('export function HeroScene'));
  assert.match(declares, /<circle[^/]*stroke=\{EDGE\}/, 'the socket is a ring on the parent, in the edge ink');
  assert.ok(!/<circle[^/]*fill=\{EDGE\}/.test(declares), 'and never filled: nothing arrives, so nothing is solid');
  assert.ok(!/markerEnd/.test(declares), 'naming a source moves no bytes');
  assert.equal((SRC.match(/<Declares /g) ?? []).length, 4);
});

test('purple is money and nothing else', () => {
  // Every MONEY use must be the sale ring, the wallet, the buy arc or the payouts. If a file, a person or a
  // model outline ever takes it, the picture starts colour-coding people, which is Lifecycle's job, not this one.
  for (const fn of ['function KnowledgeFile', 'function Person', 'function Authored', 'function Stamps']) {
    const body = SRC.slice(SRC.indexOf(fn), SRC.indexOf('\n}', SRC.indexOf(fn)));
    assert.ok(!body.includes('MONEY'), `${fn} must not use the money ink`);
  }
});

test('motion is optional: money moves, and a question moves', () => {
  assert.match(WRAP, /prefers-reduced-motion: no-preference/, 'animation is opt-in, so the still frame is the design');
  const anim = WRAP.slice(WRAP.indexOf('const Art = styled.svg'), WRAP.indexOf('const Wide'));
  for (const cls of ['hg-buy', 'hg-payouts', 'hg-deliver', 'hg-ask']) assert.ok(anim.includes(cls));
  // The hero is hidden before any animation runs, so a reader with reduced motion is not shown a question
  // frozen half-way across the table as though one were in flight.
  assert.match(WRAP, /\.hg-ask \{ opacity: 0; \}/, 'the sweep is invisible until it runs');
});

test('the inference pass reads three separate owners, not one lit band', () => {
  // The claim the pass makes is that three DIFFERENT people own three DIFFERENT sets of row addresses in one
  // model. Three clusters, three threads, three flares, each on its own delay. Collapse them into one and the
  // picture starts saying an answer comes from "the model" rather than from named contributors.
  for (const k of ['a', 'b', 'c']) {
    assert.match(SRC, new RegExp(`className="hg-rows-${k}"`), `rows cluster ${k}`);
    assert.match(SRC, new RegExp(`className="hg-apply-${k}"`), `the thread that wrote cluster ${k}`);
    assert.match(SRC, new RegExp(`className="hg-file-${k}"`), `the file that owns cluster ${k}`);
  }
  const anim = WRAP.slice(WRAP.indexOf('const Art = styled.svg'), WRAP.indexOf('const Wide'));
  const delays = [...anim.matchAll(/\.hg-rows-[abc] \{ animation: hg-flare [\d.]+s ease-out ([\d.]+)s/g)].map((m) => Number(m[1]));
  assert.equal(delays.length, 3, 'three flares');
  assert.equal(new Set(delays).size, 3, 'on three different delays: they are separate contributions, not one event');
});

test('the sweep stays in the row layer and never crosses the frozen checkpoint', () => {
  // The slab is the base checkpoint. A question that visibly swept it would say inference reads the weights the
  // way it reads the rows, and that a patch could change them. Neither is true.
  const slabTop = Number(/<rect x=\{-40\} y=\{(\d+)\} width=\{440\} height=\{30\}/.exec(SRC)?.[1]);
  const sweepY = Number(/<path d="M-30 (\d+) H\d+" stroke=\{ASK\}/.exec(SRC)?.[1]);
  assert.ok(Number.isFinite(slabTop) && Number.isFinite(sweepY));
  assert.ok(sweepY < slabTop, `the sweep runs at y=${sweepY}, above the locked slab at y=${slabTop}`);
  assert.ok(!/ASK/.test(SRC.slice(SRC.indexOf('hg-hatch)'), SRC.indexOf('hg-rows-a'))), 'nothing in the slab is drawn in the question ink');
});

test('the phone gets the diagram, not a blank space', () => {
  assert.match(WRAP, /export function HeroGraphCompact/);
  assert.match(WRAP, /const Narrow = styled\(Art\)/);
  // Narrow hides at and above md; Wide hides below it. Exactly one is ever on screen, and never neither.
  const narrow = WRAP.slice(WRAP.indexOf('const Narrow'), WRAP.indexOf('export function HeroGraph'));
  assert.match(narrow, /min-width: \$\{\(p\) => p\.theme\.breakpoint\.md\}px\) \{ display: none; \}/);
  const wide = WRAP.slice(WRAP.indexOf('const Wide'), WRAP.indexOf('const Narrow'));
  assert.match(wide, /max-width: \$\{\(p\) => p\.theme\.breakpoint\.md\}px\) \{ display: none; \}/);
});
