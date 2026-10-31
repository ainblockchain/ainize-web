import { readA2aReply } from './a2aReply';
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
  /** `chunk`: a piece of the answer as the agent writes it (an artifact update), appended unless `append` is false. */
  kind: 'task' | 'working' | 'chunk' | 'final' | 'error';
  append?: boolean;
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

/**
 * A piece of the answer's text exactly as sent — unlike `progressText`, never trimmed: " there" after "Hello" keeps
 * its space, or the words run together on screen.
 */
function chunkText(parts: unknown[]): string {
  return (parts as { kind?: string; text?: string; content?: { $case?: string; value?: string } }[])
    .map((p) => (typeof p?.text === 'string' ? p.text : p?.content?.$case === 'text' && typeof p.content.value === 'string' ? p.content.value : ''))
    .join('');
}

/** One JSON-RPC frame from the stream, as something the page can render. */
export function readFrame(frame: unknown): A2AStreamEvent | null {
  const result = (frame as { result?: Record<string, unknown>; error?: { message?: string } })?.result;
  const error = (frame as { error?: { message?: string; code?: number } })?.error;
  if (error) return { kind: 'error', text: `${error.message ?? 'the agent refused this'}${error.code ? ` (code ${error.code})` : ''}` };
  if (!result) return null;

  if (result.kind === 'task') {
    const reply = readA2aReply(result);
    if (reply?.error) return { kind: 'error', text: reply.error };
    return reply && !reply.pending ? { kind: 'final', text: '', parts: reply.parts } : { kind: 'task', text: '' };
  }

  if (result.kind === 'message') {
    return { kind: 'final', text: '', parts: Array.isArray(result.parts) ? result.parts : [] };
  }

  // A streaming agent writes its answer into an artifact, piece by piece; the page shows it growing.
  if (result.kind === 'artifact-update') {
    const artifact = (result.artifact ?? {}) as { parts?: unknown[] };
    return { kind: 'chunk', text: chunkText(Array.isArray(artifact.parts) ? artifact.parts : []), append: result.append === true };
  }
  if (result.kind === 'status-update') {
    const status = (result.status ?? {}) as { state?: string; message?: { parts?: unknown[] } };
    const parts = Array.isArray(status.message?.parts) ? status.message.parts : [];
    if (status.state === 'working') return { kind: 'working', text: progressText(parts) };
    if (status.state === 'failed' || status.state === 'rejected' || status.state === 'canceled' || status.state === 'cancelled') {
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
    const separator = /\r?\n\r?\n/.exec(rest);
    if (!separator) break;
    const block = rest.slice(0, separator.index);
    rest = rest.slice(separator.index + separator[0].length);
    const data = block.split(/\r?\n/).filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, '')).join('\n');
    if (!data) continue;
    try { frames.push(JSON.parse(data)); } catch { /* malformed event; never execute stream content */ }
  }
  return { frames, rest };
}

/**
 * What a card says about streaming: `true` or `false` when it says so, `null` when there is no card to ask.
 *
 * A2A makes `capabilities.streaming` optional and an agent that leaves it out does not stream, so only an
 * explicit `true` counts. `null` is kept apart from `false`: a card that has not arrived (or failed to) is not
 * a card that refused, and the caller tries the stream and lets the agent answer for itself.
 */
export function cardStreams(card: unknown): boolean | null {
  if (!card || typeof card !== 'object') return null;
  return (card as { capabilities?: { streaming?: unknown } }).capabilities?.streaming === true;
}

/** The method to send a turn with: `message/send` to an agent whose card says it does not stream. */
export function sendMethod(streams: boolean | null): 'message/stream' | 'message/send' {
  return streams === false ? 'message/send' : 'message/stream';
}

/**
 * Is this JSON-RPC error an agent refusing `message/stream` itself — as opposed to refusing the message?
 *
 * The spec's answer is `UnsupportedOperationError` (-32004), but SDKs in the wild wrap it as an internal error
 * (-32603 "Streaming is not supported by the agent"), so the words count as much as the code. Only this
 * refusal is worth retrying as `message/send`; any other error is the agent's real answer.
 */
export function isStreamingRefusal(error: unknown): boolean {
  const e = error as { code?: unknown; message?: unknown } | null | undefined;
  if (!e || typeof e !== 'object') return false;
  const message = typeof e.message === 'string' ? e.message : '';
  if (e.code === -32004) return true;
  return /stream/i.test(message) && /(not|un)\s*-?supported|unsupported/i.test(message);
}
