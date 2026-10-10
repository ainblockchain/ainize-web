import { createHash } from 'node:crypto';
import { parseDoc, type Block } from './markdown-parser';

export type PracticeStep = {
  id: string; number: number; section: string; language: string; code: string;
  kind: 'command' | 'file' | 'request' | 'reference';
  requirements: string[];
};

/** Exact source examples, including tabs and callouts. An example is never evidence of a successful run. */
export function practicePlan(source: string, lang: string, slug: string) {
  const doc = parseDoc(source);
  const steps: PracticeStep[] = [];
  let section = doc.headings[0]?.text ?? slug;
  const walk = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.t === 'heading') section = block.text;
      if (block.t === 'quote') walk(block.c);
      if (block.t === 'tabs') for (const panel of block.panels) walk(panel.c);
      if (block.t !== 'code') continue;
      const language = block.lang || 'text';
      const kind = ['bash', 'sh', 'shell', 'console'].includes(language) ? 'command'
        : language === 'http' ? (/^\s*HTTP\/\d(?:\.\d)?\s+\d{3}\b/.test(block.code) ? 'reference' : 'request')
        : ['js', 'javascript', 'ts', 'typescript', 'python', 'json', 'jsonl', 'yaml', 'toml'].includes(language) ? 'file' : 'reference';
      const requirements = [
        ...(/\bainize(?:-agent)?\b/.test(block.code) ? ['ainize-cli'] : []),
        ...(/\b(?:docker|nvidia-smi|systemctl)\b|\bainize\s+(?:init|start|stop|config|verify|agent\s+add)\b/.test(block.code) ? ['node-operator'] : []),
        ...(/\b(?:pip|npm|git clone)\b/.test(block.code) ? ['package-or-git-access'] : []),
        ...(/\b(?:python|import ainize)\b/.test(block.code) || language === 'python' ? ['python-runtime'] : []),
        ...(/<[^>]+>|\/path\/to\/|YOUR_|REPLACE_/.test(block.code) ? ['user-input'] : []),
        ...(/\b(?:buy|purchase|publish|deposit|transfer|ainize use|git push)\b/.test(block.code) ? ['review-before-write'] : []),
        ...(/private_key|PRIVATE_KEY|API_KEY|secret|token/i.test(block.code) ? ['credential-handling'] : []),
      ];
      const number = steps.length + 1;
      steps.push({ id: `step-${number}`, number, section, language, code: block.code, kind, requirements });
    }
  };
  walk(doc.blocks);
  return {
    version: 1, lang, slug, title: doc.headings[0]?.text ?? slug,
    sourceHash: createHash('sha256').update(source).digest('hex'), source, steps,
    storage: { provider: 'aindrive', repositoryFolder: 'repositories', progressFile: '.ainize-practice/progress.json' },
    execution: { verified: false, reason: 'Verification requires actual results for every step and its configured runtime.' },
  };
}
