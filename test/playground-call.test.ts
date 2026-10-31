import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callPlayground, createPlaygroundTask, playgroundJson, type PlaygroundCall } from '../src/screens/models/playgroundCall';
import { decisionInput, playgroundBody, DECISION_EXAMPLE } from '../src/screens/models/modelPlaygroundInput';
import { modelsPageCodeSnippet } from '../src/screens/models/modelsPageCodeSnippet';
import { spawnSync } from 'node:child_process';
const input = (): PlaygroundCall => ({ model: { id: 'M', modality: 'chat', available: true }, modelRef: 'M', peer: false, prompt: 'chosen input', audio: null, apiKey: null });
const signal = () => new AbortController().signal;
test('local and remote chat always send the selected model, input and capped parameters', async () => {
  for (const peer of [false, true]) {
    let request: any; const ref = peer ? 'M@0x' + '11'.repeat(20) : 'M';
    await callPlayground({ ...input(), peer, modelRef: ref }, signal(), async (url, init) => { request = { url, ...init, body: JSON.parse(String(init?.body)) }; return new Response('{}'); });
    assert.equal(request.url, peer ? '/api/peer-chat' : '/api/chat'); assert.equal(request.body.model, ref);
    assert.deepEqual(request.body.messages, [{ role: 'user', content: 'chosen input' }]); assert.equal(request.body.max_tokens, 512);
    if (!peer) assert.deepEqual(request.body.patch_ids, []);
  }
});
test('invalid decision input cannot run or copy an unrelated example', () => {
  for (const bad of ['broken', '[]', 'null', '{}', '{"state":1,"questions":{}}', JSON.stringify({ state: 'x', questions: { q: { type: 'choice', criteria: ['a', 'b'] } } })]) {
    assert.throws(() => decisionInput(bad));
    assert.throws(() => callPlayground({ ...input(), model: { ...input().model, modality: 'decision' }, prompt: bad }, signal(), async () => { throw Error('must not call'); }));
    for (const language of ['python', 'typescript', 'curl'] as const) assert.throws(() => modelsPageCodeSnippet({ modality: 'decision', model: 'M', nodeUrl: 'https://node.example', language, prompt: bad }));
  }
});
test('decision media and exact questions survive both runnable request and copied code', () => {
  const data = { debug: { prompt: true }, state: { important: true }, questions: { q: { type: 'noul' } }, images: ['https://image.example/selected.png'], videos: [] };
  const prompt = JSON.stringify(data); assert.deepEqual(playgroundBody('decision', 'M', prompt), { ...data, model: 'M' });
  for (const language of ['python', 'typescript', 'curl'] as const) {
    const code = modelsPageCodeSnippet({ modality: 'decision', model: 'M', nodeUrl: 'https://node.example', language, prompt });
    assert.match(code, /debug/); assert.match(code, /selected.png/); assert.match(code, /videos/); assert.doesNotMatch(code, /payment webhook/);
  }
});
test('key-required modalities refuse before fetch and sends a key only to those routes', async () => {
  for (const modality of ['embedding', 'speech', 'music'] as const) {
    const value = { ...input(), model: { ...input().model, modality } };
    assert.throws(() => callPlayground(value, signal(), async () => { throw Error('unexpected'); }), /key/);
    let request: any;
    await callPlayground({ ...value, apiKey: 'selected-key' }, signal(), async (url, init) => { request = { url, ...init }; return new Response('{}'); });
    assert.equal(request.headers.authorization, 'Bearer selected-key');
  }
});
test('malformed, wrong-model or missing-question results cannot be rendered as success', () => {
  for (const body of [{}, { model: 'Other', choices: [{ index: 0, message: { content: 'wrong' }, finish_reason: 'stop' }] }, { model: 'M', choices: [] }]) assert.throws(() => playgroundJson('chat', body, 'M'));
  assert.throws(() => playgroundJson('decision', { answers: {} }, 'M', { requested: { type: 'noul' } }));
  assert.throws(() => playgroundJson('decision', { answers: { unrelated: {} } }, 'M', { requested: { type: 'noul' } }));
  assert.throws(() => playgroundJson('image', { data: [{ b64_json: 'oops' }] }, 'M'));
  assert.throws(() => playgroundJson('embedding', { model: 'M', data: [{ embedding: [NaN] }] }, 'M'));
  assert.throws(() => playgroundJson('transcription', { text: null }, 'M'));
  assert.deepEqual(playgroundJson('chat', { model: 'M', choices: [{ index: 0, message: { content: 'partial' }, finish_reason: 'length' }] }, 'M'), { kind: 'text', text: 'partial', reasoning: undefined, partial: true });
});
test('rapid clicks start once; cancellation prevents stale updates while a later explicit run can start', async () => {
  const task = createPlaygroundTask(); let calls = 0, resolve!: () => void, oldLive!: () => boolean;
  const pending = task.run(() => true, async (_signal, current) => { calls++; oldLive = current; await new Promise<void>(r => resolve = r); return current(); });
  assert.equal(await task.run(() => true, async () => { calls++; }), null); assert.equal(calls, 1);
  task.cancel(); assert.equal(oldLive(), false); assert.equal(task.busy(), false);
  assert.equal(await task.run(() => true, async () => 'new'), 'new'); resolve(); assert.equal(await pending, false);
});
test('account departure suppresses errors and work that has not started', async () => {
  const task = createPlaygroundTask(); let current = true;
  assert.equal(await task.run(() => current, async () => { current = false; throw Error('late'); }), null);
  assert.equal(await task.run(() => false, async () => { throw Error('not started'); }), null);
});
test('shell snippets keep quotes, dollar substitutions and file names literal without executing them', () => {
  // Stub curl is a shell function that prints arguments. No network, file upload, SDK, or model runs.
  const prompt = 'it\'s "quoted" $(printf WRONG) `printf WRONG`';
  for (const modality of ['chat', 'image', 'speech', 'transcription'] as const) {
    const model = 'model $(printf WRONG)', apiKey = 'key"$(printf WRONG)';
    const code = modelsPageCodeSnippet({ modality, model, apiKey, prompt, nodeUrl: 'https://node.example/path$(printf WRONG)', language: 'curl', audioFileName: 'chosen "audio".wav' });
    const out = spawnSync('/bin/sh', ['-c', 'curl() { printf "%s\\n" "$@"; }\n' + code], { encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr); assert.match(out.stdout, /model \$\(printf WRONG\)/); assert.ok(out.stdout.includes(apiKey));
    if (modality !== 'transcription') { const lines = out.stdout.trim().split('\n'); assert.ok(lines.includes(JSON.stringify(playgroundBody(modality, model, prompt)))); }
    else assert.match(out.stdout, /chosen \\"audio\\".wav/);
  }
});

test('transcription code uses the selected file name and Node file streams instead of a relative fetch URL', () => {
  const opts = { modality: 'transcription' as const, model: 'M', nodeUrl: 'https://node.example', audioFileName: 'my recording.wav' };
  const ts = modelsPageCodeSnippet({ ...opts, language: 'typescript' });
  assert.match(ts, /createReadStream\("my recording.wav"\)/); assert.doesNotMatch(ts, /fetch\('audio/);
  assert.match(modelsPageCodeSnippet({ ...opts, language: 'python' }), /open\("my recording.wav", "rb"\)/);
});
test('decision code keeps a literal __proto__ question rather than changing the JavaScript object prototype', () => {
  const prompt = '{"state":{"__proto__":{"topic":"chosen"}},"questions":{"__proto__":{"type":"noul"}}}';
  const code = modelsPageCodeSnippet({ language: 'typescript', modality: 'decision', model: 'M', nodeUrl: 'https://node.example', prompt });
  assert.equal((code.match(/\["__proto__"\]/g) ?? []).length, 2);
});

test('a provider reference that does not match the visible model is refused before any request', () => {
  for (const [peer, modelRef] of [[false, 'Other'], [true, 'Other@0x' + '11'.repeat(20)], [true, 'M']] as const) {
    assert.throws(() => callPlayground({ ...input(), peer, modelRef }, signal(), async () => { throw Error('unexpected call'); }), /model_unavailable/);
  }
});

test('explicit decision model must match selection; optional backend fields are preserved', () => {
  const prompt = JSON.stringify({ ...JSON.parse(DECISION_EXAMPLE), model: 'Different', debug: { prompt: true } });
  assert.throws(() => playgroundBody('decision', 'M', prompt), /decision/);
  assert.throws(() => modelsPageCodeSnippet({ modality: 'decision', model: 'M', nodeUrl: 'https://node.example', language: 'python', prompt }), /decision/);
});

test('decision results identify the chosen model, questions and documented value scales', () => {
  const questions = { team: { type: 'choice', criteria: { billing: 'Bills', technical: 'Bugs' } }, severity: { type: 'score', criteria: ['low', 'medium', 'high'] }, outage: { type: 'noul' } };
  const body = { model: 'M', answers: { team: { type: 'choice', choice: 'technical', confidence: 0.92, probabilities: { billing: 0.08, technical: 0.92 } }, severity: { type: 'score', score: 1.85 }, outage: { type: 'noul', noul: 0.93 } } };
  assert.equal(playgroundJson('decision', body, 'M', questions).kind, 'decision');
  for (const change of [(v: any) => { v.model = 'Other'; }, (v: any) => { v.answers.outage.noul = 93; }, (v: any) => { v.answers.team.choice = 'unrelated'; }, (v: any) => { v.answers.team.confidence = 92; }, (v: any) => { v.answers.severity.score = 999; }]) {
    const value = structuredClone(body); change(value); assert.throws(() => playgroundJson('decision', value, 'M', questions));
  }
});
