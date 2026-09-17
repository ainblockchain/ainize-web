/**
 * Reading an A2A stream in the browser.
 *
 * The page used to wait in silence for a turn that takes half a minute, and both agents on this network
 * report what they are doing while they do it. What can go wrong here is not the rendering — it is the
 * reading: a frame split across two network chunks, a progress update that is JSON rather than a sentence,
 * and a failure that is also a final frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressText, readFrame, takeFrames } from '../src/lib/a2a-stream';

const frame = (result: unknown) => ({ jsonrpc: '2.0', id: '1', result });
const update = (state: string, text: string, final = false) => frame({
  kind: 'status-update', taskId: 't', final,
  status: { state, message: { kind: 'message', role: 'agent', parts: [{ kind: 'text', text }] } },
});

test('a frame split across two chunks is not lost', () => {
  const whole = `data: ${JSON.stringify(frame({ kind: 'task' }))}\n\ndata: ${JSON.stringify(update('working', 'reading'))}\n\n`;
  const cut = Math.floor(whole.length / 2);
  const first = takeFrames(whole.slice(0, cut));
  // the half-delivered frame is carried, not dropped: it is exactly the one in flight
  const second = takeFrames(first.rest + whole.slice(cut));
  assert.equal(first.frames.length + second.frames.length, 2);
  assert.equal(second.rest, '', 'nothing is left over once the last frame is terminated');
});

test('a working update becomes a line a reader can read, whatever shape the agent sent', () => {
  assert.equal(readFrame(update('working', 'reading the article'))!.text, 'reading the article');
  // one agent reports steps as JSON; a raw {"title":…} on screen is how a product looks unfinished
  const asJson = JSON.stringify({ title: '[데스크] MCP 실행: donga-article_list', description: '실패 목록' });
  assert.equal(readFrame(update('working', asJson))!.text, '[데스크] MCP 실행: donga-article_list — 실패 목록');
  assert.equal(progressText([{ kind: 'text', text: 'plain' }]), 'plain');
  // the v1.0 part spelling reads too, since the same page talks to agents on both dialects
  assert.equal(progressText([{ content: { $case: 'text', value: 'v1' } }]), 'v1');
});

test('a failed turn is an error, not an answer — even though it is also the final frame', () => {
  const event = readFrame(update('failed', 'backend down', true))!;
  assert.equal(event.kind, 'error');
  assert.equal(event.text, 'backend down');
});

test('the completed frame carries the parts, and so does a plain message reply', () => {
  const parts = [{ kind: 'text', text: 'the answer' }];
  const completed = readFrame(frame({
    kind: 'status-update', final: true,
    status: { state: 'completed', message: { kind: 'message', parts } },
  }))!;
  assert.equal(completed.kind, 'final');
  assert.deepEqual(completed.parts, parts);

  const message = readFrame(frame({ kind: 'message', parts }))!;
  assert.equal(message.kind, 'final', 'an agent that answers with a message rather than a task still answers');
  assert.deepEqual(message.parts, parts);
});

test('a JSON-RPC error frame is surfaced rather than swallowed', () => {
  const event = readFrame({ jsonrpc: '2.0', id: '1', error: { code: -32004, message: 'bad order' } })!;
  assert.equal(event.kind, 'error');
  assert.match(event.text, /bad order \(code -32004\)/);
});
