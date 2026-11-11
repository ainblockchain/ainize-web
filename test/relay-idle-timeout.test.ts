import test from 'node:test';
import assert from 'node:assert/strict';
import { idleAbort, touching } from '../src/lib/proxy';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A body that emits `n` chunks `gapMs` apart, honouring the abort signal the way fetch does. */
function slowBody(n: number, gapMs: number, signal: AbortSignal): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(c) {
      await sleep(gapMs);
      if (signal.aborted) { c.error(signal.reason); return; }
      if (i++ >= n) { c.close(); return; }
      c.enqueue(new Uint8Array([i]));
    },
  });
}

test('a stream that keeps sending outlives the limit: it is an idle limit, not a total one', async () => {
  const idle = idleAbort(80);
  const out = touching(slowBody(10, 30, idle.signal), idle)!;   // 300 ms in total, never 80 ms silent
  let got = 0;
  for await (const _ of out as unknown as AsyncIterable<Uint8Array>) got++;
  assert.equal(got, 10);
  assert.equal(idle.signal.aborted, false);
});

test('a stream that goes silent is cut after the idle limit', async () => {
  const idle = idleAbort(50);
  const out = touching(slowBody(3, 200, idle.signal), idle)!;
  await assert.rejects(async () => { for await (const _ of out as unknown as AsyncIterable<Uint8Array>) { /* drain */ } }, /no data from the node/);
});

test('a finished stream disarms the timer', async () => {
  const idle = idleAbort(40);
  const out = touching(slowBody(1, 5, idle.signal), idle)!;
  for await (const _ of out as unknown as AsyncIterable<Uint8Array>) { /* drain */ }
  await sleep(80);
  assert.equal(idle.signal.aborted, false);
});
