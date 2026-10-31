import type { ModelModality } from '@/api/models';

export const DECISION_EXAMPLE = `{
  "state": "The payment webhook is failing and customers cannot check out.",
  "questions": {
    "team": { "type": "choice", "instructions": "Who should handle this?", "criteria": { "billing": "Payments or invoices", "technical": "Bugs or outages" } },
    "severity": { "type": "score", "instructions": "How severe is it?", "criteria": ["low", "medium", "high"] },
    "outage": { "type": "noul", "instructions": "Is a service down?" }
  }
}`;
export const MUSIC_TRY = { instrumental: true, duration: 30, response_format: 'mp3' } as const;
export const CHAT_TRY = { max_tokens: 512 } as const;
export const IMAGE_TRY = { size: '512x512', n: 1, steps: 12, response_format: 'b64_json' } as const;
export const SNIPPET_SAMPLE_PROMPT = { chat: 'Hello! Introduce yourself in one sentence.', image: 'a lighthouse at sunset, photo', music: 'calm lo-fi piano, soft rain' } as const;
export const playgroundInitialPrompt = (modality: ModelModality) => modality === 'decision' ? DECISION_EXAMPLE
  : modality === 'image' ? SNIPPET_SAMPLE_PROMPT.image : modality === 'music' ? SNIPPET_SAMPLE_PROMPT.music : SNIPPET_SAMPLE_PROMPT.chat;
export class PlaygroundInputError extends Error {
  constructor(readonly code: 'decision' | 'prompt' | 'file' | 'key') { super(code); }
}
export const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
export interface DecisionInput { [key: string]: unknown; state: unknown; questions: Record<string, unknown>; images?: unknown; videos?: unknown; }
export function decisionInput(text: string): DecisionInput {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new PlaygroundInputError('decision'); }
  if (!object(parsed) || !Object.hasOwn(parsed, 'state') || !object(parsed.questions) || !Object.keys(parsed.questions).length
    || Object.values(parsed.questions).some(q => !object(q) || !['choice', 'score', 'noul'].includes(q.type)
      || q.type === 'choice' && (!object(q.criteria) || !Object.keys(q.criteria).length || Object.values(q.criteria).some(v => typeof v !== 'string')))
    || ['images', 'videos'].some(k => parsed[k] !== undefined && !Array.isArray(parsed[k]))) throw new PlaygroundInputError('decision');
  return parsed as unknown as DecisionInput;
}
export function playgroundBody(modality: ModelModality, model: string, prompt: string) {
  if (modality === 'decision') {
    const body = decisionInput(prompt);
    if (body.model !== undefined && body.model !== model) throw new PlaygroundInputError('decision');
    return { ...body, model };
  }
  if (!prompt.trim() || prompt.length > (modality === 'chat' ? 4000 : modality === 'image' ? 2000 : 16000)) throw new PlaygroundInputError('prompt');
  if (modality === 'chat') return { model, messages: [{ role: 'user', content: prompt }], ...CHAT_TRY };
  if (modality === 'image') return { model, prompt, ...IMAGE_TRY };
  if (modality === 'music') return { model, prompt, ...MUSIC_TRY };
  return { model, input: prompt, ...(modality === 'speech' ? { voice: 'default' } : {}) };
}
export const playgroundNeedsKey = (modality: ModelModality) => ['embedding', 'speech', 'music'].includes(modality);
