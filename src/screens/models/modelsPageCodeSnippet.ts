/**
 * The code a visitor copies off the Models page.
 *
 * This is the part of the page that leaves with them, so it is the part that has to run. A snippet that does not
 * is worse than no snippet at all: it is a promise the site made, discovered broken in somebody's editor with
 * nothing to compare against.
 *
 * The selected model, prompt and media belong to this request. Python/TypeScript literals and shell arguments
 * use their own encoders; invalid input cannot silently become the introductory example.
 */
import type { ModelModality } from '@/api/models';
import { DECISION_EXAMPLE, MUSIC_TRY, CHAT_TRY, IMAGE_TRY, playgroundInitialPrompt, playgroundBody } from './modelPlaygroundInput';
export { DECISION_EXAMPLE, MUSIC_TRY, SNIPPET_SAMPLE_PROMPT } from './modelPlaygroundInput';

export const SNIPPET_LANGUAGES = ['python', 'typescript', 'curl'] as const;
export type SnippetLanguage = (typeof SNIPPET_LANGUAGES)[number];

export interface SnippetOptions {
  language: SnippetLanguage;
  modality: ModelModality;
  model: string;
  nodeUrl: string;
  prompt?: string;
  /**
   * The caller's own key, when they have one. It is written straight into the snippet so somebody signed in can
   * paste and run — which is the whole difference between a quickstart that works and one that needs a detour.
   */
  apiKey?: string;
  audioFileName?: string;
}

/** Obviously a placeholder, so nobody copies it and wonders why it 401s. */
const KEY_PLACEHOLDER = 'ainize-sk-...';

/**
 * The decision playground's initial example, visible before anyone types. One situation, one question of each of the three types — the whole shape of a decision request in a
 * dozen lines. The playground imports it from here so the code on screen and the code copied are the same request.
 */
function decisionRequestOf(o: SnippetOptions) { return playgroundBody('decision', o.model, o.prompt ?? DECISION_EXAMPLE) as import('./modelPlaygroundInput').DecisionInput; }

/**
 * A JSON value as a Python literal. JSON strings, numbers, arrays and objects already are Python; `true`, `false`
 * and `null` are not, and a state that carries one would otherwise ship a NameError. Indented like the JSON the
 * visitor typed, so the copied code reads as the request it is.
 */
export function pythonLiteral(value: unknown, indent = 0): string {
  const pad = '    '.repeat(indent + 1);
  const close = '    '.repeat(indent);
  if (value === null || value === undefined) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'None';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return value.length ? `[${value.map((v) => pythonLiteral(v, indent)).join(', ')}]` : '[]';
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${pythonLiteral(v, indent + 1)}`).join(',\n')},\n${close}}`;
}

/** A JSON value as a JavaScript literal, laid out the same way (JSON is JavaScript, so only the layout is ours). */
function jsLiteral(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent + 1);
  const close = '  '.repeat(indent);
  if (Array.isArray(value)) return value.length ? `[${value.map((v) => jsLiteral(v, indent)).join(', ')}]` : '[]';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return '{}';
    return `{\n${entries.map(([k, v]) => `${pad}${k === '__proto__' ? `[${JSON.stringify(k)}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${jsLiteral(v, indent + 1)}`).join(',\n')},\n${close}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A JSON body inside single quotes for a shell: the one character that cannot be in there is escaped. */

/**
 * What the snippet asks when the playground's box is still empty.
 *
 * An empty prompt is not a harmless default: `"content": ""` sends a message with nothing in it, the model has
 * nothing to answer, and the copied code "works" by printing nothing — which reads as the call being broken.
 * A real question gets a real reply, so the first paste proves the key, the URL and the model all at once.
 */
const promptOf = (o: SnippetOptions): string => o.prompt ?? playgroundInitialPrompt(o.modality);

/** A literal that is valid in all three languages. */
const lit = (value: string): string => JSON.stringify(value);

/** Joined, not concatenated: a node URL pasted with a trailing slash must not become `example//v1`. */
const v1 = (nodeUrl: string, path: string): string => `${nodeUrl.replace(/\/+$/, '')}/v1/${path}`;

function python(o: SnippetOptions): string {
  const url = lit(o.nodeUrl.replace(/\/+$/, ''));
  const model = lit(o.model);
  const prompt = lit(promptOf(o));
  const key = lit(o.apiKey || KEY_PLACEHOLDER);
  const head = `# pip install ainize\nimport ainize\n\nclient = ainize.connect(${url}, api_key=${key})\n\n`;
  if (o.modality === 'decision') {
    const request = decisionRequestOf(o);
    const { state, questions } = request;
    if (Object.keys(request).some(k => !['model', 'state', 'questions'].includes(k))) return `${head}out = client.post("/systemone", cast_to=dict, body=${pythonLiteral({ model: o.model, ...request })})\nprint(out["answers"])\n`;
    return `${head}out = client.decide(\n    ${model},\n    state=${pythonLiteral(state, 1)},\n    questions=${pythonLiteral(questions, 1)},\n)\nprint(out.answers)\n`;
  }
  if (o.modality === 'embedding') return `${head}out = client.embeddings.create(model=${model}, input=${prompt})\nprint(out.data[0].embedding)\n`;
  if (o.modality === 'speech') return `${head}with client.audio.speech.with_streaming_response.create(model=${model}, input=${prompt}, voice="default") as audio:\n    audio.stream_to_file("out.mp3")\n`;
  // OpenAI's client has no music call; its generic post() reaches the node's /v1/audio/music with the same key.
  if (o.modality === 'music') return `${head}import httpx\n\nsong = client.post("/audio/music", cast_to=httpx.Response, body={\n    "model": ${model},\n    "prompt": ${prompt},\n    "instrumental": True,\n    "duration": ${MUSIC_TRY.duration},\n    "response_format": "mp3",\n}, options={"timeout": 300})\nopen("out.mp3", "wb").write(song.content)\n`;
  if (o.modality === 'transcription') {
    return `${head}with open(${lit(o.audioFileName ?? "audio.flac")}, "rb") as f:\n    print(client.audio.transcriptions.create(model=${model}, file=f).text)\n`;
  }
  if (o.modality === 'image') {
    return `${head}import base64\n\nout = client.images.generate(model=${model}, prompt=${prompt}, size="512x512", n=1, response_format="b64_json", extra_body={"steps": ${IMAGE_TRY.steps}})\nopen("out.png", "wb").write(base64.b64decode(out.data[0].b64_json))\n`;
  }
  return `${head}out = client.chat.completions.create(\n    model=${model},\n    messages=[{"role": "user", "content": ${prompt}}],\n    max_tokens=${CHAT_TRY.max_tokens},\n)\nprint(out.choices[0].message.content)\n`;
}

function typescript(o: SnippetOptions): string {
  const url = lit(o.nodeUrl.replace(/\/+$/, ''));
  const model = lit(o.model);
  const prompt = lit(promptOf(o));
  const key = lit(o.apiKey || KEY_PLACEHOLDER);
  const head = `// npm install @ainize/sdk\nimport { connectAinize } from '@ainize/sdk';\n\nconst client = await connectAinize(${url}, { apiKey: ${key} });\n\n`;
  if (o.modality === 'decision') {
    const request = decisionRequestOf(o);
    const { state, questions } = request;
    if (Object.keys(request).some(k => !['model', 'state', 'questions'].includes(k))) return `${head}const out = await client.post<{ answers: Record<string, unknown> }>('/systemone', { body: ${jsLiteral({ model: o.model, ...request }, 1)} });\nconsole.log(out.answers);\n`;
    return `${head}const out = await client.decide({\n  model: ${model},\n  state: ${jsLiteral(state, 1)},\n  questions: ${jsLiteral(questions, 1)},\n});\nconsole.log(out.answers);\n`;
  }
  if (o.modality === 'embedding') return `${head}const out = await client.embeddings.create({ model: ${model}, input: ${prompt} });\nconsole.log(out.data[0].embedding);\n`;
  if (o.modality === 'speech') return `${head}import { writeFile } from 'node:fs/promises';\nconst audio = await client.audio.speech.create({ model: ${model}, input: ${prompt}, voice: 'default' });\nawait writeFile('out.mp3', Buffer.from(await audio.arrayBuffer()));\n`;
  if (o.modality === 'music') return `${head}import { writeFile } from 'node:fs/promises';\nconst song = await client.post<Response>('/audio/music', {\n  body: { model: ${model}, prompt: ${prompt}, instrumental: true, duration: ${MUSIC_TRY.duration}, response_format: 'mp3' },\n  __binaryResponse: true,\n  timeout: 300_000,\n});\nawait writeFile('out.mp3', Buffer.from(await song.arrayBuffer()));\n`;
  if (o.modality === 'transcription') {
    return `${head}import { createReadStream } from 'node:fs';\nconst text = await client.audio.transcriptions.create({\n  model: ${model},\n  file: createReadStream(${lit(o.audioFileName ?? 'audio.flac')}),\n});\nconsole.log(text.text);\n`;
  }
  if (o.modality === 'image') {
    return `${head}const out = await client.post<{ data: Array<{ b64_json: string }> }>('/images/generations', { body: { model: ${model}, prompt: ${prompt}, size: '512x512', n: 1, response_format: 'b64_json', steps: ${IMAGE_TRY.steps} } });\nconst png = Buffer.from(out.data[0].b64_json, 'base64');\n`;
  }
  return `${head}const out = await client.chat.completions.create({\n  model: ${model},\n  messages: [{ role: 'user', content: ${prompt} }],\n  max_tokens: ${CHAT_TRY.max_tokens},\n});\nconsole.log(out.choices[0].message.content);\n`;
}

function curl(o: SnippetOptions): string {
  const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'";
  const file = (o.audioFileName ?? 'audio.flac').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const header = `-H ${quote(`Authorization: Bearer ${o.apiKey || KEY_PLACEHOLDER}`)}`;
  if (o.modality === 'transcription') return `curl ${quote(v1(o.nodeUrl, 'audio/transcriptions'))} ${header} --form-string ${quote(`model=${o.model}`)} -F ${quote(`file=@"${file}"`)}\n`;
  const paths = { chat: 'chat/completions', decision: 'systemone', image: 'images/generations', embedding: 'embeddings', speech: 'audio/speech', music: 'audio/music' };
  const body = playgroundBody(o.modality, o.model, promptOf(o));
  return `curl ${quote(v1(o.nodeUrl, paths[o.modality]))} ${header} -H 'Content-Type: application/json' -d ${quote(JSON.stringify(body))}${['speech', 'music'].includes(o.modality) ? ' --output out.mp3' : ''}\n`;
}

export function modelsPageCodeSnippet(o: SnippetOptions): string {
  if (o.modality !== 'transcription') playgroundBody(o.modality, o.model, promptOf(o));
  if (o.language === 'python') return python(o);
  if (o.language === 'typescript') return typescript(o);
  return curl(o);
}
