/**
 * The `index.mjs` templates the create form starts from — run, not just read.
 *
 * A template is the runtime's contract as working code, and the first code a person sees for it. So each one is
 * imported as the ES module the node will load and called with a fake `ctx` shaped like the runtime's
 * (ainize-node `src/hosted-agent-runtime/hostedAgentRuntimeTypes.ts`). A template that throws on its first run
 * would be the site teaching the wrong thing.
 *
 *   node --test --import tsx test/hosted-agent-templates.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOSTED_AGENT_HANDLER_TEMPLATE, HOSTED_AGENT_PACKAGE_JSON_TEMPLATE, HOSTED_AGENT_TOOLS_TEMPLATE, hostedAgentCodeTemplateFor, isUntouchedHostedAgentTemplate,
} from '../src/screens/agentCreate/hostedAgentCodeTemplates';

const load = (code: string) => import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

/** The runtime's `ctx`, minus the network: `fetch` must not be reached by an unconfigured template. */
function fakeCtx(text: string) {
  const logs: unknown[][] = [];
  const ui = {
    surface: (surfaceId: string, components: Record<string, unknown>[], data?: Record<string, unknown>) => [
      { createSurface: { surfaceId } }, { updateComponents: { surfaceId, components } }, ...(data ? [{ updateDataModel: { surfaceId, value: data } }] : []),
    ],
    text: (id: string, t: unknown, variant?: string) => ({ id, component: 'Text', text: t, ...(variant ? { variant } : {}) }),
    column: (id: string, children: string[]) => ({ id, component: 'Column', children }),
    row: (id: string, children: string[]) => ({ id, component: 'Row', children }),
    card: (id: string, child: string) => ({ id, component: 'Card', child }),
    divider: (id: string) => ({ id, component: 'Divider' }),
    list: (id: string) => ({ id, component: 'List' }),
    bind: (path: string) => ({ path }),
  };
  return {
    logs,
    ctx: {
      input: { text, contextId: 'c', history: [] },
      llm: { chat: async () => { throw new Error('the template should not need the model'); }, baseUrl: 'http://x/v1', model: 'm' },
      fetch: async () => { throw new Error('egress is not configured in a fresh template'); },
      secret: () => undefined,
      ui,
      log: (...args: unknown[]) => { logs.push(args); },
    },
  };
}

test('the tools template exports runnable tools with JSON-schema parameters', async () => {
  const mod = await load(HOSTED_AGENT_TOOLS_TEMPLATE);
  assert.ok(Array.isArray(mod.tools) && mod.tools.length > 0);
  for (const tool of mod.tools) {
    assert.equal(typeof tool.name, 'string');
    assert.match(tool.name, /^[a-zA-Z0-9_-]{1,64}$/, 'OpenAI function names allow only these');
    assert.equal(typeof tool.description, 'string');
    assert.equal(tool.parameters.type, 'object');
    assert.equal(typeof tool.run, 'function');
  }
  const stats = mod.tools.find((t: { name: string }) => t.name === 'text_stats');
  const { ctx, logs } = fakeCtx('');
  assert.deepEqual(await stats.run({ text: 'One two. Three!' }, ctx), { words: 3, sentences: 2, characters: 15 });
  assert.equal(logs.length, 1);
});

test('the handler template scores text and returns text plus an A2UI surface called score', async () => {
  const mod = await load(HOSTED_AGENT_HANDLER_TEMPLATE);
  assert.equal(typeof mod.execute, 'function');
  const { ctx } = fakeCtx('Short words read well. So do short lines.');
  const reply = await mod.execute(ctx.input.text, ctx);
  assert.match(reply.text, /^Readability \d+\/100/);
  assert.ok(Array.isArray(reply.ui));
  assert.equal(reply.ui[0].createSurface.surfaceId, 'score');
  const components = reply.ui[1].updateComponents.components as { id: string }[];
  assert.ok(components.some((c) => c.id === 'root'), 'an A2UI surface needs a root component');
  const score = reply.ui[2].updateDataModel.value.score as string;
  assert.match(score, /^\d+ \/ 100$/);
});

test('the handler answers an empty message with a sentence, not a crash', async () => {
  const mod = await load(HOSTED_AGENT_HANDLER_TEMPLATE);
  const { ctx } = fakeCtx('');
  assert.equal(typeof await mod.execute(ctx.input.text, ctx), 'string');
});

test('both code templates show the two doors out — ctx.fetch and ctx.secret', () => {
  for (const code of [HOSTED_AGENT_TOOLS_TEMPLATE, HOSTED_AGENT_HANDLER_TEMPLATE]) {
    assert.ok(code.includes('ctx.fetch('));
    assert.ok(code.includes("ctx.secret('"));
  }
});

test('templates per mode, and only untouched code is replaced on a mode switch', () => {
  assert.equal(hostedAgentCodeTemplateFor('prompt'), '');
  assert.equal(hostedAgentCodeTemplateFor('tools'), HOSTED_AGENT_TOOLS_TEMPLATE);
  assert.equal(hostedAgentCodeTemplateFor('handler'), HOSTED_AGENT_HANDLER_TEMPLATE);
  assert.equal(isUntouchedHostedAgentTemplate(HOSTED_AGENT_TOOLS_TEMPLATE), true);
  assert.equal(isUntouchedHostedAgentTemplate(''), true);
  assert.equal(isUntouchedHostedAgentTemplate(HOSTED_AGENT_TOOLS_TEMPLATE + '// mine'), false);
  assert.doesNotThrow(() => JSON.parse(HOSTED_AGENT_PACKAGE_JSON_TEMPLATE));
});
