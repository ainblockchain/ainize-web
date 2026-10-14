/**
 * Reads a streamed chat answer for the playground, so the reader sees it being written instead of a spinner.
 *
 * Two doors send it, and both speak OpenAI's server-sent events: `/api/chat` (this node's model — its frames carry
 * `ainize_mode`, and a closing `event: ainize.result` frame holds the whole envelope) and `/api/peer-chat` (another
 * node's model, its frames piped through untouched). Only `delta.content` and the reasoning a thinking model writes
 * first are read; a frame this build does not know is skipped, never thrown on.
 */
export type StreamedAnswer = { text: string; reasoning: string };

export async function readChatStream(res: Response, onUpdate: (answer: StreamedAnswer) => void): Promise<StreamedAnswer> {
  const answer: StreamedAnswer = { text: '', reasoning: '' };
  if (!res.body) return answer;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const take = (frame: string) => {
    let event = 'message';
    const data: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    const payload = data.join('\n');
    if (!payload || payload === '[DONE]') return;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(payload) as Record<string, unknown>; } catch { return; }
    if (event === 'error' || parsed.error) {
      const error = parsed.error as { message?: string } | undefined;
      throw new Error(error?.message ?? 'the stream was interrupted');
    }
    if (event !== 'message') return;
    // Compare mode streams a patched answer beside the base one; the playground asks for the base answer only.
    if (parsed.ainize_mode !== undefined && parsed.ainize_mode !== 'base') return;
    const delta = (parsed.choices as { delta?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown } }[] | undefined)?.[0]?.delta;
    if (!delta) return;
    const content = typeof delta.content === 'string' ? delta.content : '';
    const reasoning = typeof delta.reasoning_content === 'string' ? delta.reasoning_content : typeof delta.reasoning === 'string' ? delta.reasoning : '';
    if (!content && !reasoning) return;
    answer.text += content;
    answer.reasoning += reasoning;
    onUpdate({ ...answer });
  };
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replace(/\r\n/g, '\n');
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      take(buffer.slice(0, cut));
      buffer = buffer.slice(cut + 2);
    }
    if (done) break;
  }
  if (buffer.trim()) take(buffer);
  // A model that leaves blank lines ahead of its answer (Qwen3 does) reads as a gap; the non-streamed path trims too.
  return { text: answer.text.trim(), reasoning: answer.reasoning.trim() };
}
