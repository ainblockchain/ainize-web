import styled from 'styled-components';

/**
 * The hero diagram: many people's knowledge, the graph it forms, and where the money goes.
 *
 * It replaces `/static/images/intro-image.png` — an abstract of circles on a line carried over from the 2019
 * container-hosting Ainize, which said nothing about knowledge, people or a graph, and which was
 * `display:none` below 960px, so the picture the page led with did not exist on a phone.
 *
 * ─── WHAT EVERY STROKE IS ALLOWED TO CLAIM ────────────────────────────────────────────────────────────────
 * Read this before moving anything. Each rule below is a thing the product does NOT do, drawn out of the
 * picture on purpose. `test/heroGraph.test.ts` pins the load-bearing ones.
 *
 *  · A SOLID grey edge ending in an OPEN SOCKET is `parents[]` — "this knowledge names that one as its
 *    source". Credit and royalty only; `types.ts` says in terms that an anchor with parents and no
 *    `derivation` was NOT trained on top of them. It moves no bytes, which is why it ends in a socket and
 *    never an arrowhead. This is shipped and unconditional.
 *  · A DASHED grey edge, dimmed, is the COMBINE path (two knowledges into one). It is built and it is behind
 *    `teach.lineage`, which defaults to false (`@ainize/core` config.ts). Its output file carries no check
 *    stamps, and its thread toward the model STOPS SHORT with no arrowhead: nothing combined has landed in a
 *    live table on a default node. Do not make it solid, do not stamp it, do not close the gap.
 *  · There is NO base-stack shelf and no "trained on top" glyph. That claim is purely flag-dependent with no
 *    unconditional reading, so it is subtracted rather than softened.
 *  · The BUY arc is the only filled arrowhead and the only thick purple stroke: one payment, full price, one
 *    recipient — the seller's node. The buyer never pays an ancestor, a verifier or a data provider
 *    (`market.ts` settlePayment). Any second solid purple head would be a lie.
 *  · The THREE PAYOUT arcs are identical in weight and leave ONE point — the sale ring's rim — after the
 *    payment lands, because `payouts.ts` is a separate retrying job, not part of the sale. They are open-headed
 *    (a promise recorded, sent afterwards) and they land on FILES, never on a person: an anchor's author is a
 *    node address.
 *  · TWO check stamps, not three: the default quorum is 2, and it is counted over distinct model servers
 *    (`catalog.ts` — `executors`), which is why the copy says "two other model servers" and never "two
 *    independent parties". Addresses are free; machines are the strictest thing the code actually counts.
 *  · APPLY hairlines carry no arrowhead: applying a knowledge is reversible (`runtime.ts`).
 *  · The HATCHED, PADLOCKED slab under each memory strip is the base checkpoint. It is EMPTY and must stay
 *    empty. Nothing here is retraining, fine-tuning or weight merging — the trainer only ever sees the memory
 *    rows a corpus activated, and the artifact is a row-set, not a model.
 *  · There are TWO model strips and both run off the frame. Not one global brain: one serving model per node,
 *    each bigger than the picture. The lit rows on them are deliberately few — a handful of marks, not a
 *    proportion. A real knowledge is on the order of one row in a hundred thousand, and any fill ratio a
 *    reader could measure here would overstate it.
 *  · COLOUR MEANS WHAT KIND OF THING MOVES, never who is acting — the inverse of Lifecycle's actor tints.
 *    White is work and people, grey is a declared source, purple is money, green is a passed check.
 *
 * The band behind it is #333333 permanently, so there is no `prefers-color-scheme` here: HowArt's INK
 * (#3f3f45) would be invisible and is dropped. No text nodes — the headline, the sub and
 * `landing.hero.art_legend` carry the meaning, and the art is `aria-hidden`.
 */

import { HeroScene } from './HeroScene';

/**
 * Motion: only money moves, and only twice in nine seconds. The buy arc draws, the three payouts follow it
 * ~3s later — the delay is the one honest way to say that a payout is a separate retrying job and not part of
 * the sale. Everything stops for `prefers-reduced-motion`, which leaves the still frame the picture is
 * designed around: every element above is legible with no animation at all.
 */
const Art = styled.svg`
  display: block; width: 100%; height: auto; pointer-events: none;
  .hg-buy path, .hg-payouts path, .hg-deliver path { stroke-dasharray: 1400; stroke-dashoffset: 0; }
  @media (prefers-reduced-motion: no-preference) {
    .hg-deliver path { animation: hg-draw 9s ease-in-out infinite; }
    .hg-buy path { animation: hg-draw 9s ease-in-out 0.6s infinite; }
    .hg-payouts path { animation: hg-draw 9s ease-in-out 3.5s infinite; }
  }
  @keyframes hg-draw {
    0% { stroke-dashoffset: 1400; }
    18%, 100% { stroke-dashoffset: 0; }
  }
`;

const Wide = styled(Art)`
  max-width: 760px;
  @media (max-width: ${(p) => p.theme.breakpoint.md}px) { display: none; }
`;
/**
 * The phone crops rather than shrinks: the same geometry, a window onto the half that carries the sentence —
 * the sale, the return path, and both models. Shrinking 900px of graph into 360 makes a texture, not a
 * diagram, and the old hero answered this question by disappearing.
 */
const Narrow = styled(Art)`
  max-width: 420px; margin: 0 auto;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { display: none; }
`;

export function HeroGraph() {
  return (
    <Wide viewBox="0 0 900 560" preserveAspectRatio="xMidYMid meet" role="presentation" aria-hidden="true" focusable="false">
      <HeroScene />
    </Wide>
  );
}

export function HeroGraphCompact() {
  return (
    <Narrow viewBox="250 20 650 500" preserveAspectRatio="xMidYMid meet" role="presentation" aria-hidden="true" focusable="false">
      <HeroScene />
    </Narrow>
  );
}
