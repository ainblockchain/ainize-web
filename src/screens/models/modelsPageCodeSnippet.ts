/**
 * The code a visitor copies off the Models page.
 *
 * This is the part of the page that leaves with them, so it is the part that has to run. A snippet that does not
 * is worse than no snippet at all: it is a promise the site made, discovered broken in somebody's editor with
 * nothing to compare against.
 *
 * Every value that varies — the model, the node's URL, the prompt just typed — is interpolated, which means
 * every one of them is an escaping question. They all go through `JSON.stringify`, because a JSON string literal
 * is also a valid Python literal, a valid TypeScript literal and a valid single-argument shell word once quoted.
 * Hand-rolled escaping is how a prompt containing a quote ships a syntax error.
 */
import type { ModelModality } from '@/api/models';

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
}

/** Obviously a placeholder, so nobody copies it and wonders why it 401s. */
const KEY_PLACEHOLDER = 'ainize-sk-...';

/**
 * What the decision playground's box holds before anyone types, and what its snippet asks when the box does not
 * parse. One situation, one question of each of the three types — the whole shape of a decision request in a
 * dozen lines. The playground imports it from here so the code on screen and the code copied are the same request.
 */
export const DECISION_EXAMPLE = `{
  "state": "The payment webhook is failing and customers cannot check out.",
  "questions": {
    "team":    { "type": "choice", "instructions": "Who should handle this?", "criteria": { "billing": "Payments or invoices", "technical": "Bugs or outages" } },
    "severity":{ "type": "score",  "instructions": "How severe is it?",       "criteria": ["low", "medium", "high"] },
    "outage":  { "type": "noul",   "instructions": "Is a service down?" }
  }
}`;

/**
 * The decision request the snippet should carry: the JSON in the box when it parses to a state and questions, the
 * example otherwise. A half-typed body must not become a half-typed snippet.
 */
function decisionRequestOf(o: SnippetOptions): { state: unknown; questions: Record<string, unknown> } {
  for (const text of [o.prompt, DECISION_EXAMPLE]) {
    try {
      const parsed = JSON.parse(text ?? '') as { state?: unknown; questions?: unknown };
      if (parsed && typeof parsed === 'object' && parsed.state !== undefined && parsed.questions && typeof parsed.questions === 'object' && !Array.isArray(parsed.questions) && Object.keys(parsed.questions).length) {
        return { state: parsed.state, questions: parsed.questions as Record<string, unknown> };
      }
    } catch { /* not this one */ }
  }
  throw new Error('DECISION_EXAMPLE is not a decision request');
}

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
    return `{\n${entries.map(([k, v]) => `${pad}${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${jsLiteral(v, indent + 1)}`).join(',\n')},\n${close}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A JSON body inside single quotes for a shell: the one character that cannot be in there is escaped. */
const shellJson = (value: unknown): string => JSON.stringify(value).replace(/'/g, `'\\''`);

/**
 * What the snippet asks when the playground's box is still empty.
 *
 * An empty prompt is not a harmless default: `"content": ""` sends a message with nothing in it, the model has
 * nothing to answer, and the copied code "works" by printing nothing — which reads as the call being broken.
 * A real question gets a real reply, so the first paste proves the key, the URL and the model all at once.
 */
export const SNIPPET_SAMPLE_PROMPT = { chat: 'Hello! Introduce yourself in one sentence.', image: 'a lighthouse at sunset, photo' } as const;
const promptOf = (o: SnippetOptions): string =>
  (o.prompt?.trim() ? o.prompt : o.modality === 'image' ? SNIPPET_SAMPLE_PROMPT.image : SNIPPET_SAMPLE_PROMPT.chat);

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
    const { state, questions } = decisionRequestOf(o);
    return `${head}out = client.decide(\n    ${model},\n    state=${pythonLiteral(state, 1)},\n    questions=${pythonLiteral(questions, 1)},\n)\nprint(out.answers)\n`;
  }
  if (o.modality === 'transcription') {
    return `${head}with open("audio.flac", "rb") as f:\n    print(client.audio.transcriptions.create(model=${model}, file=f).text)\n`;
  }
  if (o.modality === 'image') {
    return `${head}import base64\n\nout = client.images.generate(model=${model}, prompt=${prompt}, size="512x512")\nopen("out.png", "wb").write(base64.b64decode(out.data[0].b64_json))\n`;
  }
  return `${head}out = client.chat.completions.create(\n    model=${model},\n    messages=[{"role": "user", "content": ${prompt}}],\n)\nprint(out.choices[0].message.content)\n`;
}

function typescript(o: SnippetOptions): string {
  const url = lit(o.nodeUrl.replace(/\/+$/, ''));
  const model = lit(o.model);
  const prompt = lit(promptOf(o));
  const key = lit(o.apiKey || KEY_PLACEHOLDER);
  const head = `// npm install @ainize/sdk\nimport { connectAinize } from '@ainize/sdk';\n\nconst client = await connectAinize(${url}, { apiKey: ${key} });\n\n`;
  if (o.modality === 'decision') {
    const { state, questions } = decisionRequestOf(o);
    return `${head}const out = await client.decide({\n  model: ${model},\n  state: ${jsLiteral(state, 1)},\n  questions: ${jsLiteral(questions, 1)},\n});\nconsole.log(out.answers);\n`;
  }
  if (o.modality === 'transcription') {
    return `${head}const text = await client.audio.transcriptions.create({\n  model: ${model},\n  file: await fetch('audio.flac').then((r) => r.blob()),\n});\nconsole.log(text.text);\n`;
  }
  if (o.modality === 'image') {
    return `${head}const out = await client.images.generate({ model: ${model}, prompt: ${prompt}, size: '512x512' });\nconst png = Buffer.from(out.data[0].b64_json, 'base64');\n`;
  }
  return `${head}const out = await client.chat.completions.create({\n  model: ${model},\n  messages: [{ role: 'user', content: ${prompt} }],\n});\nconsole.log(out.choices[0].message.content);\n`;
}

function curl(o: SnippetOptions): string {
  const model = lit(o.model);
  const prompt = lit(promptOf(o));
  const bearer = o.apiKey || KEY_PLACEHOLDER;
  const key = '';
  if (o.modality === 'decision') {
    // Not an OpenAI endpoint: a decision model answers only at /v1/systemone.
    const { state, questions } = decisionRequestOf(o);
    return `${key}curl ${v1(o.nodeUrl, 'systemone')} \\\n  -H "Authorization: Bearer ${bearer}" \\\n  -H "Content-Type: application/json" \\\n  -d '${shellJson({ model: o.model, state, questions })}'\n`;
  }
  if (o.modality === 'transcription') {
    // Multipart, not JSON: an audio upload has a file in it, and a JSON content type would be rejected.
    return `${key}curl ${v1(o.nodeUrl, 'audio/transcriptions')} \\\n  -H "Authorization: Bearer ${bearer}" \\\n  -F model=${model} \\\n  -F file=@audio.flac\n`;
  }
  if (o.modality === 'image') {
    return `${key}curl ${v1(o.nodeUrl, 'images/generations')} \\\n  -H "Authorization: Bearer ${bearer}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": ${model}, "prompt": ${prompt}, "size": "512x512"}'\n`;
  }
  return `${key}curl ${v1(o.nodeUrl, 'chat/completions')} \\\n  -H "Authorization: Bearer ${bearer}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": ${model}, "messages": [{"role": "user", "content": ${prompt}}]}'\n`;
}

export function modelsPageCodeSnippet(o: SnippetOptions): string {
  if (o.language === 'python') return python(o);
  if (o.language === 'typescript') return typescript(o);
  return curl(o);
}
