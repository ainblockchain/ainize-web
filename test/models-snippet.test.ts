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
import { modelsPageCodeSnippet, SNIPPET_LANGUAGES } from '../src/screens/models/modelsPageCodeSnippet';

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

test('an empty prompt still produces a runnable snippet', () => {
  for (const language of SNIPPET_LANGUAGES) {
    const s = modelsPageCodeSnippet({ ...base, language, modality: 'chat', prompt: '' });
    assert.ok(s.length > 0);
    assert.ok(!s.includes('undefined'), `${language} leaked an undefined into the snippet`);
  }
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
