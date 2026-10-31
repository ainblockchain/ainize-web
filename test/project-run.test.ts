import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRunSubmission, prepareProjectRun, projectRunReceipt, projectRunSelection, projectRunTargets, readProjectRunSource, readProjectRunHistory, readRunManifest, type ProjectRunDraft } from '../src/lib/projectRun';
import { hasProjectRunTargets } from '../src/lib/projectActions';
import type { ProjectManifest, ProjectSource } from '../src/api/projects';
const sha = 'a'.repeat(40);
const manifest = (): ProjectManifest => ({ kind: 'nextjs', inputs: { global: { default: 'top' } }, examples: [{ name: 'Top example', inputs: { global: 'top example' } }], detected: 'ainize.json',
  run: [{ entry: 'scripts/seed.ts', name: 'Seed', inputs: { collection: { required: true } }, examples: [{ name: 'Seed fixture', inputs: { collection: 'test' } }] },
    { entry: 'scripts/check.ts' }, { entry: 'scripts/empty.ts', inputs: {}, examples: [] }] });
const source = (): ProjectSource => ({ repoId: 'repo-id', sourcePath: 'web', target: 'head', sha, manifest: manifest() });
const draft = (extra: Partial<ProjectRunDraft> = {}): ProjectRunDraft => ({ target: 'head', sha: '', entry: '', answers: {}, env: '', timeoutMs: '', ...extra });

test('apps can expose declared run targets with per-entry inputs and explicit empty overrides', () => {
  const m = manifest();
  assert.equal(hasProjectRunTargets({ kind: 'nextjs', manifest: m }), true);
  assert.equal(hasProjectRunTargets({ kind: 'nextjs', manifest: { ...m, run: [] } }), false);
  const rows = projectRunTargets(m);
  assert.deepEqual(rows.map(row => row.entry), ['scripts/seed.ts', 'scripts/check.ts', 'scripts/empty.ts']);
  assert.deepEqual(rows[0].inputs, { collection: { required: true } }); assert.equal(rows[0].examples[0].name, 'Seed fixture');
  assert.deepEqual(rows[1].inputs, m.inputs); assert.deepEqual(rows[1].examples, m.examples);
  assert.deepEqual(rows[2].inputs, {}); assert.deepEqual(rows[2].examples, []);
  const script = { ...m, kind: 'script' as const, entry: 'scripts/seed.ts' };
  assert.equal(projectRunTargets(script).length, 3); assert.deepEqual(projectRunTargets(script)[0].inputs, rows[0].inputs);
});

test('unknown explicit entries never fall back and the request pins both displayed commit and file', () => {
  const src = source();
  assert.equal(projectRunSelection(src, 'missing.ts').selected, null);
  assert.throws(() => prepareProjectRun(src, draft({ entry: 'missing.ts' })), /run_input/);
  assert.throws(() => prepareProjectRun(src, draft()), /run_input/, 'seed requires collection');
  const request = prepareProjectRun(src, draft({ entry: 'scripts/check.ts', answers: { global: '', unrelated: 'never submit' }, env: 'MODE=test', timeoutMs: '1.5' }));
  assert.deepEqual(request, { target: 'commit', sha, entry: 'scripts/check.ts', inputs: { global: '' }, env: { MODE: 'test' }, timeoutMs: 1500 });
});

test('source evidence rejects other repositories, folders, commits and malformed or ambiguous declarations', () => {
  const project = { repoId: 'repo-id', sourcePath: 'web', activeCommit: sha };
  assert.ok(readProjectRunSource(source(), project, 'head'));
  assert.ok(readProjectRunSource({ ...source(), target: 'commit' }, project, 'commit', sha));
  assert.ok(readProjectRunSource({ ...source(), target: 'deployed' }, project, 'deployed'));
  for (const wrong of [{ repoId: 'other' }, { sourcePath: 'other' }, { target: 'commit' }, { sha: 'HEAD' }, { manifest: {} }]) {
    assert.equal(readProjectRunSource({ ...source(), ...wrong }, project, 'head'), null);
  }
  assert.equal(readProjectRunSource({ ...source(), target: 'commit' }, project, 'commit', 'b'.repeat(40)), null);
  assert.equal(readProjectRunSource({ ...source(), target: 'deployed' }, { ...project, activeCommit: 'b'.repeat(40) }, 'deployed'), null);
  for (const bad of [{ ...manifest(), run: [{ entry: '../escape.ts' }] }, { ...manifest(), run: [{ entry: 'same.ts' }, { entry: 'same.ts' }] },
    { ...manifest(), inputs: null }, { ...manifest(), examples: [null] }, { ...manifest(), kind: { toString: 'script' } }]) assert.equal(readRunManifest(bad), null);
});

test('run bodies refuse invalid inputs, env or limits instead of submitting a reduced request', () => {
  for (const d of [draft({ answers: { collection: '' } }), draft({ answers: { collection: 'ok' }, env: 'silently skipped' }), draft({ answers: { collection: 'ok' }, timeoutMs: '900' })]) assert.throws(() => prepareProjectRun(source(), d), /run_input/);
  assert.throws(() => prepareProjectRun(source(), draft({ answers: { collection: 'x'.repeat(2049) } })), /run_size/);
});

test('acceptance requires matching record aliases and does not claim a completed execution', () => {
  assert.equal(projectRunReceipt({ runId: 'r1', deploymentId: 'r1', status: 'queued' }), 'r1');
  assert.equal(projectRunReceipt({ deploymentId: 'old-node', status: 'queued' }), 'old-node');
  for (const value of [{}, { deploymentId: 'r1', runId: 'r2', status: 'queued' }, { deploymentId: 'r1', status: 'ready' }, { deploymentId: '', status: 'queued' }]) assert.equal(projectRunReceipt(value), null);
});

test('duplicate clicks submit once and ambiguous acceptance blocks another request in this view', async () => {
  const task = createProjectRunSubmission(); let calls = 0, finish!: (value: unknown) => void;
  const first = task.submit(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  assert.equal(await task.submit(async () => { calls++; }), null); assert.equal(calls, 1);
  finish({ runId: 'r1', deploymentId: 'r1', status: 'queued' }); assert.equal(await first, 'r1'); assert.equal(task.blocked(), false);
  await assert.rejects(task.submit(async () => { throw { status: 'FETCH_ERROR' }; }));
  assert.equal(task.blocked(), true); assert.equal(await task.submit(async () => { calls++; }), null); assert.equal(calls, 1);
});

test('only a recognized pre-admission refusal allows a corrected retry', async () => {
  const task = createProjectRunSubmission();
  await assert.rejects(task.submit(async () => { throw { status: 400, data: { error: { code: 'invalid_request' } } }; }));
  assert.equal(task.blocked(), false);
  assert.equal(await task.submit(async () => ({ deploymentId: 'accepted', status: 'queued' })), 'accepted');
  for (const failure of [{ status: 502 }, { status: 404 }, { status: 408, data: { error: { code: 'timeout' } } }]) {
    const unknown = createProjectRunSubmission(); await assert.rejects(unknown.submit(async () => { throw failure; })); assert.equal(unknown.blocked(), true);
  }
});


test('run history rejects wrong project, duplicates, invalid rows and unsafe links rather than returning an empty list', () => {
  const row = { id: 'run-id', projectId: 'project-id', sha, ref: 'main', trigger: 'run', status: 'queued', createdAt: 1,
    ms: null, startedAt: null, finishedAt: null, pusher: null, logUrl: 'https://node.example/api/deployments/run-id/log' };
  assert.equal(readProjectRunHistory({ runs: [row] }, 'project-id')?.length, 1);
  assert.deepEqual(readProjectRunHistory({ runs: [] }, 'project-id'), []);
  for (const raw of [{}, { runs: [null] }, { runs: [row, row] }, { runs: [{ ...row, projectId: 'wrong' }] }, { runs: [{ ...row, logUrl: 'javascript:alert(1)' }] },
    { runs: [{ ...row, placement: { endpoint: 'not a URL', local: false, reason: 'peer' } }] }]) assert.equal(readProjectRunHistory(raw, 'project-id'), null);
});
