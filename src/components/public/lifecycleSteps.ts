/** Commands and routes shared by the landing page and README. */
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
  { n: 3, actor: 'you', route: '/explore', cmd: 'ainize patch ls --node http://their-node:3402 --status VERIFIED -q "<topic>"\nainize login && ainize use <id>' },
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
