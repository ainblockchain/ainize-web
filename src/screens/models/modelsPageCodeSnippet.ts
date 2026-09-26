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
