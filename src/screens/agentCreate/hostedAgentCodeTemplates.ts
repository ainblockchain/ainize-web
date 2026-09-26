/**
 * The `index.mjs` a code agent starts from, one per mode.
 *
 * A template is the first thing a person reads about the runtime, before any doc — so it has to be the runtime's
 * contract written as working code, not a placeholder. Each one runs as is (`test/hosted-agent-templates.test.ts`
 * imports them and calls them with a fake `ctx`), uses only what `ctx` really offers (ainize-node
 * `src/hosted-agent-runtime/hostedAgentRuntimeTypes.ts`), and shows the two doors out of the container —
 * `ctx.fetch` and `ctx.secret` — in comments, because both need settings on the form (allowed hosts, secret names)
 * that an empty agent does not have yet. Code that called them unconditionally would fail on its first run.
 *
 * Plain strings rather than files beside this one: they are shipped in the page bundle, and the editor needs them
 * as text anyway.
 */
import type { HostedAgentMode } from '@/api/hostedAgents';

/** Tools mode: the node runs the function-calling loop; this module only says which functions exist. */
export const HOSTED_AGENT_TOOLS_TEMPLATE = `/**
 * Tools mode.
 *
 * The node runs an OpenAI function-calling loop (up to 8 rounds) against this agent's model, with the system
 * prompt from the form. Whenever the model asks for one of the tools below, the node calls its run(args, ctx)
 * and hands the return value back to the model. You write the tools; the conversation is handled for you.
 *
 * ctx.fetch(url, init)  — the only way out of the sandbox. Only the "allowed hosts" on the form answer.
 * ctx.secret('NAME')    — a value you stored under one of the form's secret names (undefined if unset).
 * ctx.log(...)          — goes to this agent's log, which only you can read.
 */

export const tools = [
  {
    name: 'text_stats',
    description: 'Count words, sentences and characters in a piece of text.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'The text to measure' } },
      required: ['text'],
    },
    async run(args, ctx) {
      const text = String(args?.text ?? '');
      const words = text.trim() ? text.trim().split(/\\s+/).length : 0;
      const sentences = text.split(/[.!?。]+/).filter((s) => s.trim()).length;
      ctx.log('text_stats', { words, sentences });
      return { words, sentences, characters: text.length };
    },
  },
  {
    name: 'today',
    description: 'The current date and time in UTC, as ISO 8601.',
    parameters: { type: 'object', properties: {} },
    async run() {
      return { now: new Date().toISOString() };
    },
  },
  // Calling an external API — add its host to "allowed hosts" and its key to the secrets first:
  //
  // {
  //   name: 'weather',
  //   description: 'Current weather for a city.',
  //   parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
  //   async run(args, ctx) {
  //     const res = await ctx.fetch(
  //       'https://api.example.com/weather?q=' + encodeURIComponent(args.city),
  //       { headers: { authorization: 'Bearer ' + ctx.secret('WEATHER_API_KEY') } },
  //     );
  //     if (!res.ok) return { error: 'weather service answered ' + res.status };
  //     return await res.json();
  //   },
  // },
];
`;

/** Handler mode: the module decides the whole reply. The example scores text and draws the score as A2UI. */
export const HOSTED_AGENT_HANDLER_TEMPLATE = `/**
 * Handler mode.
 *
 * execute(input, ctx) receives every message and decides the reply itself — no model is called unless you call
 * it. Good for deterministic pipelines: score something, look something up, write something somewhere.
 *
 * input            — the message text (a string); ctx.input also has { text, contextId, history }
 * ctx.llm.chat({ messages, temperature?, max_tokens? }) → { message, finish_reason }, on this agent's model
 * ctx.fetch(url, init) — the only way out of the sandbox. Only the "allowed hosts" on the form answer.
 * ctx.secret('NAME')   — a value stored under one of the form's secret names (undefined if unset)
 * ctx.ui               — A2UI helpers: surface(id, components, data), text, column, row, card, divider, list, bind
 * ctx.log(...)         — goes to this agent's log, which only you can read
 *
 * Return a string, or { text, ui }. text is what every client shows; ui is drawn by clients that speak A2UI
 * (tick "A2UI" on the form so the agent card says so).
 */

export async function execute(input, ctx) {
  const text = String(input ?? '').trim();
  if (!text) return 'Send me a paragraph and I will score how easy it is to read.';

  // A small, deterministic score: shorter sentences and shorter words read more easily.
  const sentences = text.split(/[.!?。]+/).map((s) => s.trim()).filter(Boolean);
  const words = text.split(/\\s+/).filter(Boolean);
  const wordsPerSentence = words.length / Math.max(1, sentences.length);
  const lettersPerWord = words.join('').length / Math.max(1, words.length);
  const score = Math.max(0, Math.min(100, Math.round(120 - wordsPerSentence * 2.5 - lettersPerWord * 6)));
  const verdict = score >= 70 ? 'Easy to read' : score >= 40 ? 'Takes some effort' : 'Hard going';
  ctx.log('scored', { score, sentences: sentences.length, words: words.length });

  // Writing the result somewhere — add the host to "allowed hosts" and the key to the secrets first:
  //
  // await ctx.fetch('https://api.example.com/scores', {
  //   method: 'POST',
  //   headers: { 'content-type': 'application/json', authorization: 'Bearer ' + ctx.secret('EXAMPLE_API_KEY') },
  //   body: JSON.stringify({ score, verdict }),
  // });

  const ui = ctx.ui.surface('score', [
    ctx.ui.card('root', 'body'),
    ctx.ui.column('body', ['title', 'score', 'verdict', 'rule', 'detail']),
    ctx.ui.text('title', 'Readability', 'h3'),
    ctx.ui.text('score', ctx.ui.bind('/score'), 'h1'),
    ctx.ui.text('verdict', ctx.ui.bind('/verdict')),
    ctx.ui.divider('rule'),
    ctx.ui.text('detail', ctx.ui.bind('/detail'), 'caption'),
  ], {
    score: score + ' / 100',
    verdict,
    detail: sentences.length + ' sentences · ' + words.length + ' words · ' + wordsPerSentence.toFixed(1) + ' words per sentence',
  });

  return { text: 'Readability ' + score + '/100 — ' + verdict + '.', ui };
}
`;

/** A starting package.json, offered (not prefilled) — most agents need no dependencies at all. */
export const HOSTED_AGENT_PACKAGE_JSON_TEMPLATE = `{
  "name": "my-agent",
  "private": true,
  "type": "module",
  "dependencies": {}
}
`;

/** The template for a mode. Prompt mode has no code, so it has no template. */
export function hostedAgentCodeTemplateFor(mode: HostedAgentMode): string {
  if (mode === 'tools') return HOSTED_AGENT_TOOLS_TEMPLATE;
  if (mode === 'handler') return HOSTED_AGENT_HANDLER_TEMPLATE;
  return '';
}

/** Is this code still one of the untouched templates? Then switching mode may replace it without losing work. */
export const isUntouchedHostedAgentTemplate = (code: string): boolean =>
  !code.trim() || code === HOSTED_AGENT_TOOLS_TEMPLATE || code === HOSTED_AGENT_HANDLER_TEMPLATE;
