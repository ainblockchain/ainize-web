const object = (value: unknown): Record<string, any> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
const parts = (value: unknown): unknown[] => Array.isArray(value) ? value.filter((part) => object(part)) : [];
export const a2aPartText = (value: unknown): string | null => {
  const part = object(value);
  return typeof part?.text === 'string' ? part.text : part?.content?.$case === 'text' && typeof part.content.value === 'string' ? part.content.value : null;
};
export const a2aReplyText = (value: unknown[]) => value.map((part) => a2aPartText(part) ?? '').filter(Boolean).join('\n');

/** Adjacent text chunks are one string. Data/file parts keep their own boundaries. */
function appendParts(previous: unknown[], incoming: unknown[]): unknown[] {
  const result = [...previous];
  for (const part of incoming) {
    const last = result[result.length - 1];
    const before = a2aPartText(last); const next = a2aPartText(part);
    if (before !== null && next !== null) result[result.length - 1] = { kind: 'text', text: before + next };
    else result.push(part);
  }
  return result;
}
function uniqueParts(value: unknown[]): unknown[] {
  const seen = new Set<string>();
  return value.filter((part) => {
    const row = object(part);
    if (row?.kind === 'data' || row?.content?.$case === 'data') return true;
    const text = a2aPartText(part);
    const key = text === null ? JSON.stringify(part) : `text:${text}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

/** Collect each artifact by id: replacing one artifact never discards the others. */
export class A2aReply {
  private artifacts = new Map<string, unknown[]>();
  private message: unknown[] = [];
  accept(value: unknown): unknown[] {
    const result = object(value);
    if (!result) return this.parts();
    if (result.kind === 'artifact-update') {
      const artifact = object(result.artifact);
      const id = typeof artifact?.artifactId === 'string' ? artifact.artifactId : 'default';
      const incoming = parts(artifact?.parts);
      this.artifacts.set(id, result.append === true ? appendParts(this.artifacts.get(id) ?? [], incoming) : incoming);
    } else if (result.kind === 'task' || Array.isArray(result.artifacts)) {
      for (const [index, raw] of (Array.isArray(result.artifacts) ? result.artifacts : []).entries()) {
        const artifact = object(raw);
        if (artifact) this.artifacts.set(typeof artifact.artifactId === 'string' ? artifact.artifactId : String(index), parts(artifact.parts));
      }
      if (['completed', 'input-required', 'auth-required', 'failed', 'rejected', 'canceled'].includes(result.status?.state) && result.status?.message?.parts) this.message = parts(result.status.message.parts);
    } else if (result.kind === 'message' || Array.isArray(result.parts)) {
      this.message = parts(result.parts);
    } else if (result.kind === 'status-update' && (result.final === true || result.status?.state === 'completed')) {
      // A terminal status with no message completes the existing artifacts; it does not erase them.
      if (result.status?.message?.parts) this.message = parts(result.status.message.parts);
    }
    return this.parts();
  }
  parts(): unknown[] { return uniqueParts([...this.artifacts.values()].flat().concat(this.message)); }
}

/** Preserve task output and task failure, instead of treating every result as a Message. */
export function readA2aReply(value: unknown) {
  const result = object(value);
  if (!result || (!Array.isArray(result.parts) && result.kind !== 'task' && !object(result.status))) return null;
  const status = object(result.status);
  const state = status?.state;
  if (result.kind === 'task' && typeof state !== 'string') return null;
  const failed = ['failed', 'rejected', 'canceled', 'cancelled'].includes(state);
  const contextId = typeof result.contextId === 'string' ? result.contextId : typeof status?.message?.contextId === 'string' ? status.message.contextId : undefined;
  const pending = ['submitted', 'working', 'input-required', 'auth-required'].includes(state);
  const taskId = pending && typeof result.id === 'string' ? result.id : undefined;
  const reply = new A2aReply().accept(value);
  return { parts: reply, contextId, taskId, pending, error: failed ? a2aReplyText(parts(status?.message?.parts)) || String(state) : null };
}
