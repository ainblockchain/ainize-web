/**
 * Reading an A2A `message/stream` in the browser.
 *
 * A turn that takes half a minute and says nothing is indistinguishable from a hang, and both agents on this
 * network have something to say while they work — one names each stage of a scoring run, the other names each
 * tool call as it makes it. The transport carries that already; this is the half that reads it.
 *
 * Pure on purpose: no React, no fetch policy, no knowledge of which agent it is talking to. What it knows is
 * the wire — SSE frames, JSON-RPC envelopes, and the three event shapes A2A puts inside them.
 */

/** One thing that happened during a turn, in the order it happened. */
export interface A2AStreamEvent {
  kind: 'task' | 'working' | 'final' | 'error';
  /** A line worth showing a reader. Empty for events that carry no words. */
  text: string;
  /** The parts of the final message, when this is the one that carries the answer. */
  parts?: unknown[];
}

/**
 * The words inside a status update.
 *
 * One agent sends prose; the other sends JSON with a title and a description, because it is reporting a step
 * rather than talking. A reader wants the title either way, and a raw `{"title":…}` on screen is the kind of
 * detail that makes a product look unfinished.
 */
export function progressText(parts: unknown): string {
  const text = (Array.isArray(parts) ? parts : [])
    .map((p) => {
      const part = p as { kind?: string; text?: string; content?: { $case?: string; value?: string } };
      if (typeof part?.text === 'string') return part.text;
      if (part?.content?.$case === 'text' && typeof part.content.value === 'string') return part.content.value;
      return '';
    })
    .join('\n')
    .trim();
  try {
    const parsed = JSON.parse(text) as { title?: string; description?: string };
    if (parsed && typeof parsed === 'object' && (parsed.title || parsed.description)) {
      return [parsed.title, parsed.description].filter(Boolean).join(' — ');
    }
  } catch {
    // not JSON: it is already a sentence
  }
  return text;
}

/** One JSON-RPC frame from the stream, as something the page can render. */
export function readFrame(frame: unknown): A2AStreamEvent | null {
  const result = (frame as { result?: Record<string, unknown>; error?: { message?: string } })?.result;
  const error = (frame as { error?: { message?: string; code?: number } })?.error;
  if (error) return { kind: 'error', text: `${error.message ?? 'the agent refused this'}${error.code ? ` (code ${error.code})` : ''}` };
  if (!result) return null;

  if (result.kind === 'task') return { kind: 'task', text: '' };

  if (result.kind === 'message') {
    return { kind: 'final', text: '', parts: (result.parts as unknown[]) ?? [] };
  }

  if (result.kind === 'status-update') {
    const status = (result.status ?? {}) as { state?: string; message?: { parts?: unknown[] } };
    const parts = status.message?.parts ?? [];
    if (status.state === 'working') return { kind: 'working', text: progressText(parts) };
    if (status.state === 'failed' || status.state === 'rejected' || status.state === 'canceled') {
      return { kind: 'error', text: progressText(parts) || (status.state as string) };
    }
    // completed, or any other terminal state carrying the answer
    if (result.final === true || status.state === 'completed') return { kind: 'final', text: '', parts };
  }
  return null;
}

/**
 * Split an SSE buffer into whatever complete frames it holds, and return the remainder.
 *
 * Frames are separated by a blank line and arrive in arbitrary chunks, so one can straddle two reads. The
 * remainder is what has not been terminated yet and must be carried into the next chunk — dropping it loses
 * exactly the frame that was in flight.
 */
export function takeFrames(buffer: string): { frames: unknown[]; rest: string } {
  const frames: unknown[] = [];
  let rest = buffer;
  for (;;) {
    const cut = rest.indexOf('\n\n');
    if (cut === -1) break;
    const block = rest.slice(0, cut);
    rest = rest.slice(cut + 2);
    for (const line of block.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try { frames.push(JSON.parse(line.slice(6))); } catch { /* a frame we cannot parse is one we ignore */ }
    }
  }
  return { frames, rest };
}
