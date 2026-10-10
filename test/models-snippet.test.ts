/**
 * The code somebody copies off the page.
 *
 * This is the part of the page that leaves with the visitor, so it is the part that has to be right. A snippet
 * that does not run is worse than no snippet: it is a promise the site made, which the caller discovers broken
 * in their own editor with nothing to compare against.
 *
 *   node --test --import tsx test/models-snippet.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_EXAMPLE, modelsPageCodeSnippet, pythonLiteral, SNIPPET_LANGUAGES, SNIPPET_SAMPLE_PROMPT } from '../src/screens/models/modelsPageCodeSnippet';

const base = { model: 'qwen2.5-7b-instruct', nodeUrl: 'https://node.example', prompt: 'hello' } as const;

test('the python snippet installs, connects and calls', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat' });
  assert.match(s, /pip install ainize/);
  assert.match(s, /import ainize/);
  assert.match(s, /ainize\.connect\(\s*"https:\/\/node\.example"/);
  assert.match(s, /model="qwen2\.5-7b-instruct"/);
});

test('the model and the node URL are the ones on screen, not placeholders', () => {
  for (const language of SNIPPET_LANGUAGES) {
    const s = modelsPageCodeSnippet({ ...base, language, modality: 'chat' });
    assert.ok(s.includes('qwen2.5-7b-instruct'), `${language} lost the model id`);
    assert.ok(s.includes('https://node.example'), `${language} lost the node URL`);
    assert.ok(!s.includes('…'), `${language} still has an ellipsis placeholder`);
    assert.ok(!s.includes('YOUR_'), `${language} still has a YOUR_ placeholder`);
  }
});

test('each modality calls its own method', () => {
  assert.match(modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat' }), /chat\.completions\.create/);
  assert.match(modelsPageCodeSnippet({ ...base, language: 'python', modality: 'decision' }), /client\.decide\(/);
  assert.match(modelsPageCodeSnippet({ ...base, language: 'python', modality: 'transcription' }), /audio\.transcriptions\.create/);
  assert.match(modelsPageCodeSnippet({ ...base, language: 'python', modality: 'image' }), /images\.generate/);
});

test('the typescript snippet uses the package that exists', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'typescript', modality: 'chat' });
  assert.match(s, /npm install @ainize\/sdk/);
  assert.match(s, /connectAinize/);
});

test('the curl snippet targets /v1 and carries a key header', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'curl', modality: 'chat' });
  assert.match(s, /https:\/\/node\.example\/v1\/chat\/completions/);
  assert.match(s, /Authorization: Bearer/);
});

test('curl for audio posts multipart, not JSON', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'curl', modality: 'transcription' });
  assert.match(s, /-F /, 'an audio upload is multipart; a JSON body would be rejected');
  assert.ok(!s.includes('application/json'), 'and must not claim otherwise');
});

test('a prompt with a quote does not break the snippet it is pasted into', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat', prompt: 'she said "hi"' });
  assert.ok(!s.includes('"she said "hi""'), 'an unescaped quote would make the snippet a syntax error');
  assert.ok(s.includes('she said'), 'and the prompt must still be in there');
});

test('a prompt containing a newline stays inside the string literal', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat', prompt: 'line one\nline two' });
  const literal = /"line one\\nline two"/;
  assert.match(s, literal, 'a raw newline would end the literal and leave a dangling line');
});

test('a prompt with a backslash survives every language', () => {
  for (const language of SNIPPET_LANGUAGES) {
    const s = modelsPageCodeSnippet({ ...base, language, modality: 'chat', prompt: 'C:\\temp' });
    assert.ok(s.includes('C:\\\\temp'), `${language} did not escape the backslash`);
  }
});

test('an empty prompt still produces a snippet that gets an answer — never an empty message', () => {
  for (const language of SNIPPET_LANGUAGES) {
    for (const prompt of ['', '   ', undefined]) {
      const s = modelsPageCodeSnippet({ ...base, language, modality: 'chat', prompt });
      assert.ok(!s.includes('undefined'), `${language} leaked an undefined into the snippet`);
      // `"content": ""` sends nothing to answer; the pasted code then prints nothing and looks broken.
      assert.ok(!/content["']?:\s*""/.test(s), `${language} sends an empty message`);
      assert.ok(s.includes(JSON.stringify(SNIPPET_SAMPLE_PROMPT.chat)), `${language} asks the sample question`);
    }
    const image = modelsPageCodeSnippet({ ...base, language, modality: 'image', prompt: '' });
    assert.ok(image.includes(JSON.stringify(SNIPPET_SAMPLE_PROMPT.image)), `${language} draws the sample picture`);
  }
  const typed = modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat', prompt: 'What is 2+2?' });
  assert.ok(typed.includes('"What is 2+2?"') && !typed.includes(SNIPPET_SAMPLE_PROMPT.chat), 'what was typed wins');
});

test('a node URL with a trailing slash does not become a double slash', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'curl', modality: 'chat', nodeUrl: 'https://node.example/' });
  assert.ok(!s.includes('example//v1'), 'the URL is joined, not concatenated');
});

test('the snippet asks for an API key, never a private key', () => {
  // No other model API asks for a private key, and the thing being pasted into a source file would be the whole
  // wallet. Our own quickstart used to teach exactly that.
  for (const language of SNIPPET_LANGUAGES) {
    const s = modelsPageCodeSnippet({ ...base, language, modality: 'chat' });
    assert.ok(!s.includes('private_key'), `${language} still asks for a private key`);
    assert.ok(!s.includes('privateKey'), `${language} still asks for a private key`);
    assert.ok(!/0x<your key>/.test(s), `${language} still shows a hex key placeholder`);
  }
});

test('a key the caller already has is written into the snippet', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat', apiKey: 'ainize-sk-real' });
  assert.match(s, /api_key="ainize-sk-real"/, 'somebody signed in should be able to paste and run');
});

test('without a key the snippet carries a placeholder that is obviously one', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat' });
  assert.match(s, /api_key="ainize-sk-\.\.\."/);
});

test('the key reaches the curl snippet too, where it is a header', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'curl', modality: 'chat', apiKey: 'ainize-sk-real' });
  assert.match(s, /Authorization: Bearer ainize-sk-real/);
});

test('a key is escaped like every other interpolated value', () => {
  const s = modelsPageCodeSnippet({ ...base, language: 'python', modality: 'chat', apiKey: 'ainize-sk-"x"' });
  assert.ok(!s.includes('"ainize-sk-"x""'), 'an unescaped key would be a syntax error in the pasted file');
});

// ── decision models (Clef): not an OpenAI call, so the snippet must not pretend it is one

const decision = { modality: 'decision', model: 'clef-flash', nodeUrl: 'https://ainize.ai', prompt: DECISION_EXAMPLE } as const;

test('a decision model is called with client.decide, never chat.completions — that call does not exist for it', () => {
  for (const language of SNIPPET_LANGUAGES) {
    const s = modelsPageCodeSnippet({ ...decision, language });
    assert.ok(!s.includes('chat.completions'), `${language} still shows a chat call, which a decision model 404s`);
    assert.ok(!s.includes('messages'), `${language} still sends messages`);
  }
  const py = modelsPageCodeSnippet({ ...decision, language: 'python' });
  assert.match(py, /^# pip install ainize\nimport ainize\n\nclient = ainize\.connect\("https:\/\/ainize\.ai", api_key="ainize-sk-\.\.\."\)\n\nout = client\.decide\(\n    "clef-flash",\n    state=/);
  assert.match(py, /print\(out\.answers\)\n$/);
  const ts = modelsPageCodeSnippet({ ...decision, language: 'typescript' });
  assert.match(ts, /await client\.decide\(\{\n  model: "clef-flash",\n  state: /);
  assert.match(ts, /console\.log\(out\.answers\)/);
  const sh = modelsPageCodeSnippet({ ...decision, language: 'curl' });
  assert.match(sh, /https:\/\/ainize\.ai\/v1\/systemone/, 'the one endpoint a decision model answers at');
  assert.match(sh, /Authorization: Bearer/);
  assert.ok(!sh.includes('chat/completions'));
});

test('the decision snippet carries the same example the playground shows, state and all three question types', () => {
  const example = JSON.parse(DECISION_EXAMPLE) as { state: string; questions: Record<string, { type: string }> };
  assert.deepEqual(Object.values(example.questions).map((q) => q.type).sort(), ['choice', 'noul', 'score']);
  for (const language of SNIPPET_LANGUAGES) {
    const s = modelsPageCodeSnippet({ ...decision, language });
    assert.ok(s.includes(example.state), `${language} lost the state`);
    for (const id of Object.keys(example.questions)) assert.ok(s.includes(id), `${language} lost question ${id}`);
    for (const type of ['noul', 'score', 'choice']) assert.ok(s.includes(`"${type}"`), `${language} lost the ${type} question`);
  }
  // the curl body is the request itself, parseable, with the model inside it
  const body = /-d '([^']*(?:'\\''[^']*)*)'/.exec(modelsPageCodeSnippet({ ...decision, language: 'curl' }))?.[1] ?? '';
  assert.deepEqual(JSON.parse(body), { model: 'clef-flash', state: example.state, questions: example.questions });
});

test('what the visitor typed in the decision box is what the snippet sends; a half-typed box falls back to the example', () => {
  const typed = '{"state": {"ticket": "refund", "vip": true, "note": null}, "questions": {"q": {"type": "noul", "instructions": "Escalate?"}}}';
  const py = modelsPageCodeSnippet({ ...decision, language: 'python', prompt: typed });
  assert.ok(py.includes('"ticket": "refund"') && py.includes('"Escalate?"'));
  assert.ok(py.includes('"vip": True') && py.includes('"note": None'), 'JSON true/null are not Python; the snippet must translate them');
  assert.ok(!py.includes('true') && !py.includes('null'), py);
  assert.ok(!py.includes('payment webhook'), 'the example is not sent when the visitor wrote their own');
  const ts = modelsPageCodeSnippet({ ...decision, language: 'typescript', prompt: typed });
  assert.ok(ts.includes('vip: true') && ts.includes('note: null'));
  for (const language of SNIPPET_LANGUAGES) {
    for (const prompt of ['', '{"state": 1', '{"state": 1}', '{"state": 1, "questions": {}}', undefined]) {
      const s = modelsPageCodeSnippet({ ...decision, language, prompt });
      assert.ok(s.includes('payment webhook'), `${language} with ${JSON.stringify(prompt)} did not fall back to the example`);
      assert.ok(!s.includes('undefined'));
    }
  }
});

test('a quote in the decision state stays inside the literal in every language', () => {
  const prompt = JSON.stringify({ state: `she said "hi" and it's fine`, questions: { q: { type: 'noul' } } });
  assert.ok(modelsPageCodeSnippet({ ...decision, language: 'python', prompt }).includes('"she said \\"hi\\" and it\'s fine"'));
  const sh = modelsPageCodeSnippet({ ...decision, language: 'curl', prompt });
  assert.ok(sh.includes(`it'\\''s fine`), 'a single quote inside a single-quoted shell word must be escaped');
});

test('pythonLiteral renders JSON as Python', () => {
  assert.equal(pythonLiteral(null), 'None');
  assert.equal(pythonLiteral([true, false, 1.5, 'x']), '[True, False, 1.5, "x"]');
  assert.equal(pythonLiteral({}), '{}');
  assert.equal(pythonLiteral({ a: [] }), '{\n    "a": [],\n}');
});
