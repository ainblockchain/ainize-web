import type { ModelModality, PublicModelCard } from '@/api/models';
import { object, playgroundBody, playgroundNeedsKey, PlaygroundInputError } from './modelPlaygroundInput';

export interface PlaygroundCall {
  model: PublicModelCard; modelRef: string; peer: boolean; localNode?: string | null; prompt: string; audio: File | null; apiKey: string | null;
}
export function playgroundTargetMatches(model: string, ref: string, peer: boolean, localNode?: string | null) {
  const suffix = ref.slice(model.length);
  return ref.startsWith(model) && /^@0x[\da-f]{40}$/i.test(suffix)
    && (peer || !!localNode && suffix.slice(1).toLowerCase() === localNode.toLowerCase());
}
/** A single selected destination. Never fall back to an unnamed local runtime or another provider. */
export function callPlayground(input: PlaygroundCall, signal: AbortSignal, transport: typeof fetch = fetch) {
  const { model, modelRef, prompt, audio, apiKey, peer } = input;
  if (!model.available || !modelRef) throw new Error('model_unavailable');
  if (!playgroundTargetMatches(model.id, modelRef, peer, input.localNode)) throw new Error('model_unavailable');
  if (playgroundNeedsKey(model.modality) && !apiKey) throw new PlaygroundInputError('key');
  if (model.modality === 'transcription') {
    if (!audio || !audio.size || audio.size > 10 * 1024 * 1024) throw new PlaygroundInputError('file');
    const form = new FormData(); form.set('model', modelRef); form.set('file', audio);
    return transport('/api/transcribe', { method: 'POST', body: form, credentials: 'include', signal });
  }
  // /api/chat only runs this node's local runtime and expects its bare backend id.
  // Other routes and copied /v1 examples must retain the provider pin.
  const body = playgroundBody(model.modality, !peer && model.modality === 'chat' ? model.id : modelRef, prompt);
  const path = { chat: peer ? '/api/peer-chat' : '/api/chat', image: '/api/image', decision: '/api/decide',
    embedding: '/v1/embeddings', speech: '/v1/audio/speech', music: '/v1/audio/music' }[model.modality];
  return transport(path, { method: 'POST', credentials: 'include', signal,
    headers: { 'content-type': 'application/json', ...(playgroundNeedsKey(model.modality) ? { authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({ ...body, ...(model.modality === 'chat' ? { stream: true, ...(!peer ? { patch_ids: [], mode: 'base' } : {}) } : {}) }),
  });
}
export class PlaygroundResponseError extends Error {
  constructor() { super('response'); }
}
/** Validate result shape instead of rendering arbitrary JSON as a successful answer. */
export function playgroundJson(modality: ModelModality, raw: unknown, model: string, questions: Record<string, unknown> = {}) {
  if (!object(raw) || raw.error || raw.model !== undefined && raw.model !== model) throw new PlaygroundResponseError();
  if (modality === 'chat') {
    if (!object(raw.base) && (!Array.isArray(raw.choices) || raw.choices.length !== 1 || raw.choices[0]?.index !== 0)) throw new PlaygroundResponseError();
    const answer = object(raw.base) ? raw.base : raw.choices?.[0]?.message;
    const reason = raw.base?.finish_reason ?? raw.choices?.[0]?.finish_reason;
    if (raw.model !== model || raw.base && raw.base.model !== model || !object(answer) || typeof answer.content !== 'string'
      || !['stop', 'length', 'content_filter'].includes(reason)) throw new PlaygroundResponseError();
    return { kind: 'text' as const, text: answer.content, reasoning: typeof answer.reasoning_content === 'string' ? answer.reasoning_content : undefined, partial: raw.base?.truncated === true || reason !== 'stop' || !answer.content.trim() };
  }
  if (modality === 'transcription') {
    if (typeof raw.text !== 'string') throw new PlaygroundResponseError();
    return { kind: 'text' as const, text: raw.text, partial: false };
  }
  if (modality === 'decision') {
    const questionIds = Object.keys(questions);
    const probability = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
    if (raw.model !== model || !object(raw.answers) || !questionIds.length || Object.keys(raw.answers).length !== questionIds.length) throw new PlaygroundResponseError();
    for (const id of questionIds) {
      const answer = raw.answers[id], question = questions[id];
      if (!Object.hasOwn(raw.answers, id) || !object(answer) || !object(question) || answer.type !== question.type
        || answer.confidence !== undefined && !probability(answer.confidence)
        || answer.probabilities !== undefined && (!object(answer.probabilities) || Object.values(answer.probabilities).some(v => !probability(v)))) throw new PlaygroundResponseError();
      if (answer.type === 'noul' ? !probability(answer.noul)
        : answer.type === 'choice' ? typeof answer.choice !== 'string' || !object(question.criteria) || !Object.hasOwn(question.criteria, answer.choice)
        : answer.type === 'score' ? typeof answer.score !== 'number' || !Number.isFinite(answer.score) || !Array.isArray(question.criteria) || answer.score < 0 || answer.score > question.criteria.length - 1
        : true) throw new PlaygroundResponseError();
    }
    return { kind: 'decision' as const, answers: raw.answers as Record<string, unknown> };
  }
  if (modality === 'image') {
    if (!Array.isArray(raw.data) || raw.data.length !== 1) throw new PlaygroundResponseError();
    const data = raw.data[0]?.b64_json;
    if (typeof data !== 'string' || !/^[\da-z+/]+={0,2}$/i.test(data) || data.length % 4 !== 0) throw new PlaygroundResponseError();
    const mime = data.startsWith('iVBORw0KGgo') ? 'image/png' : data.startsWith('/9j/') ? 'image/jpeg' : null;
    if (!mime) throw new PlaygroundResponseError();
    return { kind: 'image' as const, dataUrl: `data:${mime};base64,${data}` };
  }
  if (modality === 'embedding') {
    if (raw.model !== model || !Array.isArray(raw.data) || raw.data.length !== 1 || !raw.data.every(e => object(e) && e.index === 0 && Array.isArray(e.embedding)
      && e.embedding.length && e.embedding.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)))) throw new PlaygroundResponseError();
    return { kind: 'text' as const, text: JSON.stringify(raw.data.map(e => e.embedding), null, 2), partial: false };
  }
  throw new PlaygroundResponseError();
}
/** Synchronous duplicate exclusion and abortable reads. Cancelling never submits another run. */
export function createPlaygroundTask() {
  let controller: AbortController | null = null;
  return {
    busy: () => controller !== null,
    cancel: () => { controller?.abort(); controller = null; },
    async run<T>(current: () => boolean, work: (signal: AbortSignal, current: () => boolean) => Promise<T>) {
      if (controller || !current()) return null;
      const run = new AbortController(); controller = run;
      const live = () => controller === run && !run.signal.aborted && current();
      try { return await work(run.signal, live); }
      catch (error) { if (!live()) return null; throw error; }
      finally { if (controller === run) controller = null; }
    },
  };
}
