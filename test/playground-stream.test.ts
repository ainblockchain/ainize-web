import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readChatStream } from '../src/screens/models/playgroundStream';

/** A response whose body arrives in the given pieces — split mid-frame on purpose, as a network does. */
const streamed = (...pieces: string[]): Response => new Response(new ReadableStream({
  start(controller) { for (const p of pieces) controller.enqueue(new TextEncoder().encode(p)); controller.close(); },
}), { headers: { 'content-type': 'text/event-stream' } });

const frame = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  `data: ${JSON.stringify({ ...extra, choices: [{ index: 0, delta }] })}\n\n`;

test('a peer stream is shown as it arrives: reasoning first, then the answer', async () => {
  const seen: string[] = [];
  const body = frame({ reasoning_content: 'The user greets.' }) + frame({ content: '\n\n안녕' }) + frame({ content: '하세요!' }) + 'data: [DONE]\n\n';
  const done = await readChatStream(streamed(body.slice(0, 30), body.slice(30, 95), body.slice(95)), (a) => seen.push(a.text));
  assert.deepEqual(done, { text: '안녕하세요!', reasoning: 'The user greets.' });
  assert.equal(seen.at(-1), '\n\n안녕하세요!');
  assert.ok(seen.length >= 3, 'each delta updates the page');
});

test('this node\'s /api/chat stream: the closing envelope and patched frames are not read as answer text', async () => {
  const body = frame({ content: 'base' }, { ainize_mode: 'base' }) + frame({ content: 'patched' }, { ainize_mode: 'patched' })
    + `event: ainize.result\ndata: ${JSON.stringify({ base: { content: 'base' } })}\n\ndata: [DONE]\n\n`;
  assert.deepEqual(await readChatStream(streamed(body), () => {}), { text: 'base', reasoning: '' });
});

test('an interrupted stream is a failed run, not a half answer shown as whole', async () => {
  const body = frame({ content: 'half' }) + `event: error\ndata: ${JSON.stringify({ error: { message: 'Chat stream interrupted' } })}\n\n`;
  await assert.rejects(readChatStream(streamed(body), () => {}), /Chat stream interrupted/);
});
