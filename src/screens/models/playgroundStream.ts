/** Read one selected chat result. EOF alone never proves a completed answer. */
export type StreamedAnswer = { text: string; reasoning: string; partial: boolean };
export async function readChatStream(res: Response, onUpdate: (answer: StreamedAnswer) => void, expectedModel?: string): Promise<StreamedAnswer> {
  const answer: StreamedAnswer = { text: '', reasoning: '', partial: true };
  if (!res.body) throw new Error('stream_incomplete');
  const reader = res.body.getReader(), decoder = new TextDecoder();
  let buffer = '', completed = false, truncated = false, reason: string | null = null;
  const take = (frame: string) => {
    let event = 'message'; const data: string[] = [];
    for (const line of frame.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    const payload = data.join('\n'); if (!payload) return;
    if (payload === '[DONE]') { completed = true; return; }
    let parsed: any;
    try { parsed = JSON.parse(payload); } catch { throw new Error('stream_invalid'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('stream_invalid');
    if (event === 'error' || parsed.error) throw new Error('stream_incomplete');
    if (parsed.ainize_mode !== undefined && parsed.ainize_mode !== 'base') return;
    if (event === 'ainize.result') {
      if (expectedModel && (parsed.model !== expectedModel || parsed.base?.model !== expectedModel)) throw new Error('stream_model');
      if (!parsed.base || typeof parsed.base.content !== 'string') throw new Error('stream_invalid');
      if (expectedModel && !['stop', 'length', 'content_filter'].includes(parsed.base.finish_reason)) throw new Error('stream_invalid');
      // The local runtime may trim a degenerate answer after streaming. Its final, guarded result is authoritative.
      answer.text = parsed.base.content;
      if (typeof parsed.base.reasoning === 'string') answer.reasoning = parsed.base.reasoning;
      if (parsed.base.finish_reason) reason = parsed.base.finish_reason;
      truncated = parsed.base.truncated === true;
      onUpdate({ ...answer });
      return;
    }
    if (event !== 'message') return;
    if (expectedModel && parsed.model !== expectedModel) throw new Error('stream_model');
    if (!Array.isArray(parsed.choices)) throw new Error('stream_invalid');
    for (const choice of parsed.choices) {
      if (choice.index !== 0 || !choice.delta || typeof choice.delta !== 'object' || Array.isArray(choice.delta)) throw new Error('stream_invalid');
      for (const field of ['content', 'reasoning_content', 'reasoning']) if (choice.delta[field] != null && typeof choice.delta[field] !== 'string') throw new Error('stream_invalid');
      if (choice.finish_reason != null) {
        if (!['stop', 'length', 'content_filter'].includes(choice.finish_reason)) throw new Error('stream_invalid');
        reason = choice.finish_reason;
      }
      answer.text += choice.delta.content ?? '';
      answer.reasoning += choice.delta.reasoning_content ?? choice.delta.reasoning ?? '';
      if (answer.text.length + answer.reasoning.length > 8 * 1024 * 1024) throw new Error('stream_invalid');
      onUpdate({ ...answer });
    }
  };
  try {
    while (!completed) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      if (buffer.length > 1024 * 1024) throw new Error('stream_invalid');
      let boundary: RegExpExecArray | null;
      while (!completed && (boundary = /\r?\n\r?\n/.exec(buffer))) {
        take(buffer.slice(0, boundary.index).replace(/\r\n/g, '\n'));
        buffer = buffer.slice(boundary.index + boundary[0].length);
      }
      if (done) { if (buffer.trim() && !completed) take(buffer.replace(/\r\n/g, '\n')); break; }
    }
    if (!completed || !reason) throw new Error('stream_incomplete');
    if (!answer.text.trim() && !answer.reasoning.trim()) throw new Error('stream_invalid');
    return { text: answer.text.trim(), reasoning: answer.reasoning.trim(), partial: truncated || reason !== 'stop' || !answer.text.trim() };
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}
