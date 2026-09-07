/**
 * The ecosystem lifecycle, in the order it happens — the data behind the landing diagram (Lifecycle.tsx) AND the
 * README table. It lives in its own import-free module so `test/lifecycle.test.ts` can load it under plain node
 * and fail the build the moment the page and README.md disagree about a command or a route.
 *
 * Every command below was verified with `--help` against `packages/cli/dist/bin.js` before it was written here.
 * Rules this file is under:
 *
 *  - Nothing here may promise something the product does not do. Where a step has no shipped command (a data
 *    provider's publish is browser-only) the note in the dictionary says so instead of inventing one; where a step
 *    needs an earlier one (a derivative's author must hold the base) the acquisition is its own command line.
 *  - `npm install -g ainize` must never come back: @ainize/cli is `private: true`, so `npm view ainize` 404s. The
 *    only install that resolves is a clone + `npm install && npm run build`, then `npx ainize …`.
 *  - No measured number appears here or in the dictionary. A dev node's teach backend is a stub, so any "x %" or
 *    "n seconds" would be a number no node measured.
 *  - `ainize patch apply --with-base` is NOT here: the node's own error message names it but `patch apply --help`
 *    does not list it. Nothing goes on this page until `--help` shows it.
 */

/** Who is acting at this step. The landing diagram tints each card by it; the README prints it in the "Who" column. */
export type Actor = 'you' | 'node' | 'network' | 'other';

export interface LifecycleStep {
  n: number;
  actor: Actor;
  /** the exact command lines — byte-identical to the README table */
  cmd: string;
  /** a real route from App.tsx; the localised label is the click path a person follows to get there */
  route: string;
}

export const LIFECYCLE: LifecycleStep[] = [
  { n: 1, actor: 'you', route: '/', cmd: 'npx ainize init --name my-node\nnpx ainize start' },
  { n: 2, actor: 'node', route: '/chat', cmd: 'ainize chat <knowledge-id> "your question"' },
  { n: 3, actor: 'you', route: '/explore', cmd: 'ainize patch ls --node http://their-node:3402 --status LISTED -q "<topic>"\nainize login && ainize use <id>' },
  { n: 4, actor: 'you', route: '/teach', cmd: 'ainize teach train ./questions.jsonl --effort quick --wait' },
  { n: 5, actor: 'you', route: '/teach/mine', cmd: 'ainize publish ./knowledge.npz --name "My knowledge" --model Qwen3.8-Flash-Next --benchmark ./bench.json --price 25' },
  { n: 6, actor: 'network', route: '/network', cmd: 'ainize peers add http://a-verifier-node:3402' },
  { n: 7, actor: 'other', route: '/ledger', cmd: 'ainize use <your-id>\nainize wallet' },
  { n: 8, actor: 'other', route: '/explore', cmd: 'ainize use <your-id>\nainize dataset get <your-id> -o questions.jsonl\nainize teach train ./questions.jsonl --patch <your-id> --wait' },
];

/** The step the loop returns to: what the second publisher shipped is what the next person finds and buys. */
export const LOOP_TARGET = 3;

/** Every dictionary key the diagram reads, so the drift test can check English and Korean both exist. */
export const LIFECYCLE_KEYS: string[] = [
  'landing.flow.title', 'landing.flow.sub', 'landing.flow.legend', 'landing.flow.ui_label',
  'landing.flow.loop', 'landing.flow.readme', 'landing.flow.more',
  ...(['you', 'node', 'network', 'other'] as Actor[]).map((a) => `landing.flow.actor.${a}`),
  ...LIFECYCLE.flatMap((s) => [`landing.flow.s${s.n}.title`, `landing.flow.s${s.n}.note`, `landing.flow.s${s.n}.path`]),
];
