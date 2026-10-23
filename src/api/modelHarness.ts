/**
 * The harness a model is meant to be driven by, when it has one.
 *
 * DeepSeek-V4.1-Flash-1017 is "optimized for DeepSeek Harness" (DeepSeek's 2026-10-17 release notes recommend Harness
 * 0.2.1-rc.1 or later), so its page says which harness, with which settings, and where it runs. Here that is AinCode
 * (ainize.ai/code): every workspace ships the harness on-prem, pointed at the network's own copy of the model — the
 * page never sends anyone to DeepSeek's hosted API. Pure — `test/model-harness.test.ts` pins it.
 */
export interface ModelHarness {
  name: string;
  version: string;
  /** source repository (MIT) */
  source: string;
  license: string;
  settings: {
    temperature: number;
    topP: number;
    reasoningEffort: string;
    reasoningEfforts: string[];
    context: number;
    compactAt: number;
  };
  /** same-site path where the harness runs */
  openPath: string;
  commands: { web: string; run: string };
}

const DEEPSEEK_HARNESS: ModelHarness = {
  name: 'DeepSeek Harness',
  version: '0.2.1-rc.2',
  source: 'https://github.com/deepseek-ai/deepseek-harness',
  license: 'MIT',
  settings: {
    temperature: 1.0,
    topP: 1.0,
    reasoningEffort: 'high',
    reasoningEfforts: ['low', 'medium', 'high', 'max'],
    context: 1_048_576,
    compactAt: 786_432,
  },
  openPath: '/code/',
  commands: { web: 'aincode-harness', run: 'aincode-harness run "<task>"' },
};

const HARNESSES: [RegExp, ModelHarness][] = [[/^DeepSeek-V4\.1-Flash(-|$)/, DEEPSEEK_HARNESS]];

/** The harness for a model id, or null when the model has none. */
export function harnessForModel(id: string | null | undefined): ModelHarness | null {
  if (!id) return null;
  return HARNESSES.find(([re]) => re.test(id))?.[1] ?? null;
}
