import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readChatStream } from '../src/screens/models/playgroundStream';

/** A response whose body arrives in the given pieces — split mid-frame on purpose, as a network does. */
const streamed = (...pieces: string[]): Response => new Response(new ReadableStream({
  start(controller) { for (const p of pieces) controller.enqueue(new TextEncoder().encode(p)); controller.close(); },
}), { headers: { 'content-type': 'text/event-stream' } });

const frame = (delta: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  `data: ${JSON.stringify({ model: 'M', ...extra, choices: [{ index: 0, delta, finish_reason: extra.finish_reason ?? null }] })}\n\n`;

test('a peer stream is shown as it arrives: reasoning first, then the answer', async () => {
  const seen: string[] = [];
  const body = frame({ reasoning_content: 'The user greets.' }) + frame({ content: '\n\n안녕' }) + frame({ content: '하세요!' }) + frame({}, { finish_reason: 'stop' }) + 'data: [DONE]\n\n';
  const done = await readChatStream(streamed(body.slice(0, 30), body.slice(30, 95), body.slice(95)), (a) => seen.push(a.text));
  assert.deepEqual(done, { text: '안녕하세요!', reasoning: 'The user greets.', partial: false });
  assert.equal(seen.at(-1), '\n\n안녕하세요!');
  assert.ok(seen.length >= 3, 'each delta updates the page');
});

test('this node\'s /api/chat stream: the closing envelope and patched frames are not read as answer text', async () => {
  const body = frame({ content: 'base' }, { ainize_mode: 'base' }) + frame({ content: 'patched' }, { ainize_mode: 'patched' })
    + frame({}, { finish_reason: 'stop' }) + `event: ainize.result\ndata: ${JSON.stringify({ base: { content: 'base' } })}\n\ndata: [DONE]\n\n`;
  assert.deepEqual(await readChatStream(streamed(body), () => {}), { text: 'base', reasoning: '', partial: false });
});

test('an interrupted stream is a failed run, not a half answer shown as whole', async () => {
  const body = frame({ content: 'half' }) + `event: error\ndata: ${JSON.stringify({ error: { message: 'Chat stream interrupted' } })}\n\n`;
  await assert.rejects(readChatStream(streamed(body), () => {}), /stream_incomplete/);
});

test('EOF, missing finish reason and malformed frames cannot look complete', async () => {
  for (const body of [frame({ content: 'half' }), frame({ content: 'half' }) + 'data: [DONE]\n\n', 'data: broken\n\ndata: [DONE]\n\n']) {
    await assert.rejects(readChatStream(streamed(body), () => {}, 'M'), /stream_/);
  }
});
test('stream frames and local result envelopes identify the selected model', async () => {
  await assert.rejects(readChatStream(streamed(frame({ content: 'other' }, { model: 'Another' })), () => {}, 'M'), /stream_model/);
  const body = frame({ content: 'answer' }, { finish_reason: 'stop' }) + 'event: ainize.result\ndata: {"model":"Other","base":{"model":"Other","content":"answer"}}\n\ndata: [DONE]\n\n';
  await assert.rejects(readChatStream(streamed(body), () => {}, 'M'), /stream_model/);
});
test('length-limited answers remain partial; CRLF boundaries may split across chunks', async () => {
  const body = (frame({ content: 'partial' }) + frame({}, { finish_reason: 'length' }) + 'data: [DONE]\n\n').replaceAll('\n', '\r\n');
  const split = body.indexOf('\r\n') + 1;
  const done = await readChatStream(streamed(body.slice(0, split), body.slice(split)), () => {}, 'M');
  assert.deepEqual(done, { text: 'partial', reasoning: '', partial: true });
});
test('a terminal marker closes the reader even if the connection remains open', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(frame({ content: 'answer' }, { finish_reason: 'stop' }) + 'data: [DONE]\n\n')); }, cancel() { cancelled = true; } }));
  assert.equal((await readChatStream(response, () => {}, 'M')).text, 'answer'); assert.equal(cancelled, true);
});

test('the local final guarded result replaces raw streamed content and retains truncation', async () => {
  const envelope = { model: 'M', base: { model: 'M', content: 'guarded', reasoning: '', finish_reason: 'stop', truncated: true } };
  const body = frame({ content: 'raw unguarded repeated text' }, { finish_reason: 'stop' }) + `event: ainize.result\ndata: ${JSON.stringify(envelope)}\n\ndata: [DONE]\n\n`;
  const updates: string[] = [];
  const done = await readChatStream(streamed(body), value => updates.push(value.text), 'M');
  assert.deepEqual(done, { text: 'guarded', reasoning: '', partial: true }); assert.equal(updates.at(-1), 'guarded');
});
