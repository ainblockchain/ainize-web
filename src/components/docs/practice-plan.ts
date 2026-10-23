import { createHash } from 'node:crypto';
import { parseDoc, type Block } from './markdown-parser';
import { practiceFront, runsInAinCode, stepKind, stepRequirements, type StepKind } from './practice-step';

export type PracticeStep = {
  id: string; number: number; section: string; language: string; code: string;
  kind: StepKind;
  requirements: string[];
  /** runs as written in an AinCode shell — the docs link opens it ready to run (`practice-step.ts`) */
  aincode: boolean;
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
      const kind = stepKind(language, block.code, Boolean(block.output));
      const requirements = stepRequirements(kind, block.code, language);
      const number = steps.length + 1;
      steps.push({ id: `step-${number}`, number, section, language, code: block.code, kind, requirements, aincode: runsInAinCode(kind, requirements, practiceFront(slug, doc.front)) });
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
