/**
 * What one code block on a docs page is, as practice — shared by the practice plan the AinCode gateway reads
 * (`practice-plan.ts`, server) and the "Run in AinCode" link under each block (`CodeBlock.tsx`, browser), so the
 * link is offered exactly when the gateway will open the block ready to run.
 */
export type StepKind = 'command' | 'file' | 'request' | 'reference';

export function stepKind(language: string, code: string, output: boolean): StepKind {
  if (output) return 'reference';
  if (['bash', 'sh', 'shell', 'console'].includes(language)) return 'command';
  if (language === 'http') return /^\s*HTTP\/\d(?:\.\d)?\s+\d{3}\b/.test(code) ? 'reference' : 'request';
  if (['js', 'javascript', 'ts', 'typescript', 'python', 'json', 'jsonl', 'yaml', 'toml'].includes(language)) return 'file';
  return 'reference';
}

/**
 * A value the reader fills in: `<id>`, `<your key>` — one line, starting with a letter. A heredoc (`<<'EOF'`, `<<EOF`)
 * and a redirect later on the same block are not one.
 */
const PLACEHOLDER = /<(?!<)[A-Za-z][^<>\n]*>/;

export function stepRequirements(kind: StepKind, code: string, language: string): string[] {
  return [
    ...(kind === 'command' && /(?:^|\n)\s*ainize(?:-agent)?\s/.test(code) && (/\[(?:options|[A-Za-z][\w.-]*(?:…|\.\.\.)?)\]/.test(code) || PLACEHOLDER.test(code)) ? ['command-template'] : []),
    ...(/\bainize(?:-agent)?\b/.test(code) ? ['ainize-cli'] : []),
    ...(/\b(?:docker|nvidia-smi|systemctl)\b|\bainize\s+(?:init|start|stop|config|verify|agent\s+(?:add|on|off|rm)|wallet|ledger\s+inference)\b/.test(code) ? ['node-operator'] : []),
    ...(/\b(?:pip|npm|git clone)\b/.test(code) ? ['package-or-git-access'] : []),
    ...(/\b(?:python|import ainize)\b/.test(code) || language === 'python' ? ['python-runtime'] : []),
    ...(PLACEHOLDER.test(code) || /\/path\/to\/|YOUR_|REPLACE_/.test(code) ? ['user-input'] : []),
    ...(/\b(?:buy|purchase|publish|deposit|transfer|ainize use|git push)\b/.test(code) ? ['review-before-write'] : []),
    ...(/private_key|PRIVATE_KEY|API_KEY|secret|token/i.test(code) ? ['credential-handling'] : []),
  ];
}

/** Needs something a prepared AinCode workspace does not have: a node of your own, or a value only you know. */
const NOT_IN_AINCODE = ['node-operator', 'user-input', 'command-template'];

/**
 * True when pressing Enter on the block's exact text in an AinCode shell runs it as written. A page about running
 * your own node opts out as a whole with `aincode: false` in its frontmatter — its commands belong on your machine.
 */
export function runsInAinCode(kind: StepKind, requirements: string[], front: Record<string, string> = {}): boolean {
  if (front.aincode === 'false') return false;
  return kind === 'command' && !requirements.some((r) => NOT_IN_AINCODE.includes(r));
}

/**
 * The frontmatter a page is judged by. `reference/*` pages are generated from ainize-node (its docs-gen test
 * fails on any edit), so they cannot carry `aincode: false` themselves: a reference is not a practice page, and its
 * examples name IDs and nodes of their own.
 */
export function practiceFront(slug: string, front: Record<string, string> = {}): Record<string, string> {
  return slug.startsWith('reference/') ? { ...front, aincode: 'false' } : front;
}
