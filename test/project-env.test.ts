/**
 * A project's environment variables (ainize-node project-routes.ts "secrets", PR #175), held still where they cross
 * into this app: the node's rules checked before a request, the `.env` paste and the plan it becomes, the request
 * shapes the RTK endpoints send, the node's answers read defensively, the sequential save with the redeploy on the
 * last write only, and every string the section renders in both languages.
 *
 *   node --test --import tsx test/project-env.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  envAccessOf, envRowsOf, isReservedSecretName, parseDotEnv, parseProjectSecretsResponse, readProjectSecretsResponse, parseSecretRemoved, parseSecretSaved, planBulk,
  saveSecretsSequentially, secretApiErrorOf, secretDeleteRequest, secretNameProblem, secretPutRequest, secretsListUrl, secretValueProblem,
  SECRET_ERROR_CODES, type SecretSaved, type SecretRedeployTarget,
} from '../src/api/projectSecrets.ts';
import { projects } from '../src/i18n/pages/projects.ts';

const target: SecretRedeployTarget = { projectId: 'prj_1', deploymentId: 'reviewed', sha: 'a'.repeat(40) };
const receipt = (deploymentId = 'dep_9') => ({ deploymentId, status: 'queued' as const, projectId: target.projectId, redeployOf: target.deploymentId, sha: target.sha });
const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

test('.env paste: comments, blanks, export, quotes, inline comments, duplicates', () => {
  const p = parseDotEnv([
    '# a comment',
    '',
    'PLAIN=value',
    'export EXPORTED=yes',
    '  SPACED = padded value  ',
    'DQ="double # not a comment"',
    "SQ='single \\n stays'",
    'ESC="say \\"hi\\" \\\\ ok" # trailing',
    'BT=`back`',
    'INLINE=abc # comment',
    'HASH=abc#def',
    'EMPTY=',
    'EQUALS=a=b=c',
    'PLAIN=second wins',
    'not a pair',
    'OPEN="never closes',
  ].join('\r\n'));
  assert.deepEqual(Object.fromEntries(p.entries.map((e) => [e.name, e.value])), {
    EXPORTED: 'yes', SPACED: 'padded value', DQ: 'double # not a comment', SQ: 'single \\n stays', ESC: 'say "hi" \\ ok', BT: 'back',
    INLINE: 'abc', HASH: 'abc#def', EMPTY: '', EQUALS: 'a=b=c', PLAIN: 'second wins',
  });
  assert.equal(p.entries.find((e) => e.name === 'PLAIN')!.line, 14, 'the later line wins and is the one reported');
  assert.deepEqual(p.skipped.map((s) => [s.line, s.reason]), [[15, 'syntax'], [16, 'unterminated_quote']]);
  assert.deepEqual(parseDotEnv('﻿A=1').entries.map((e) => e.name), ['A'], 'a BOM is not part of the first name');
  assert.deepEqual(parseDotEnv('\n# only\n   \n'), { entries: [], skipped: [] });
});

test('the node\'s rules: name pattern, reserved names (AINIZE_ in any case), one line, 32 KiB', () => {
  assert.equal(secretNameProblem('API_KEY'), null);
  assert.equal(secretNameProblem('_x9'), null);
  assert.equal(secretNameProblem(''), 'empty');
  assert.equal(secretNameProblem('9LIVES'), 'invalid');
  assert.equal(secretNameProblem('MY-KEY'), 'invalid');
  assert.equal(secretNameProblem(`A${'B'.repeat(63)}`), null);
  assert.equal(secretNameProblem(`A${'B'.repeat(64)}`), 'invalid');
  for (const n of ['PORT', 'HOSTNAME', 'PATH', 'HTTPS_PROXY', 'no_proxy', 'NODE_USE_ENV_PROXY', 'AINIZE_URL', 'AINIZE_ANYTHING', 'ainize_lower']) {
    assert.equal(secretNameProblem(n), 'reserved', n);
  }
  assert.equal(isReservedSecretName('port'), false, 'the node matches PORT exactly');
  assert.equal(secretValueProblem(''), null);
  assert.equal(secretValueProblem('a\nb'), 'multiline');
  assert.equal(secretValueProblem('a\rb'), 'multiline');
  assert.equal(secretValueProblem('x'.repeat(32 * 1024)), null);
  assert.equal(secretValueProblem('x'.repeat(32 * 1024 + 1)), 'too_large');
  assert.equal(secretValueProblem('가'.repeat(11_000)), 'too_large', 'bytes, not characters');
});

test('the paste preview: create, update or why not — including the 64 limit', () => {
  const entries = parseDotEnv('NEW=1\nOLD=2\nPORT=3\nBAD-NAME=4\nTWO=5').entries;
  const plan = planBulk(entries, ['OLD']);
  assert.deepEqual(plan.map((r) => [r.name, r.action, r.problem]), [
    ['NEW', 'create', null], ['OLD', 'update', null], ['PORT', 'invalid', 'reserved'], ['BAD-NAME', 'invalid', 'invalid'], ['TWO', 'create', null],
  ]);
  const full = Array.from({ length: 63 }, (_, i) => `K${i}`);
  const capped = planBulk(parseDotEnv('K0=x\nA=1\nB=2').entries, full);
  assert.deepEqual(capped.map((r) => [r.name, r.action, r.problem]), [['K0', 'update', null], ['A', 'create', null], ['B', 'invalid', 'limit']]);
});

test('requests carry the reviewed commit in PUT/DELETE bodies and encode names', () => {
  assert.equal(secretsListUrl('prj_1'), 'api/projects/prj_1/secrets');
  assert.deepEqual(secretPutRequest('prj_1', 'API_KEY', 's3cret'), { url: 'api/projects/prj_1/secrets/API_KEY', method: 'PUT', body: { value: 's3cret' } });
  assert.deepEqual(secretPutRequest('prj_1', 'API_KEY', '', target), { url: 'api/projects/prj_1/secrets/API_KEY', method: 'PUT', body: { value: '', redeploy: { deploymentId: target.deploymentId, sha: target.sha } } });
  assert.deepEqual(secretDeleteRequest('prj/1', 'A B'), { url: 'api/projects/prj%2F1/secrets/A%20B', method: 'DELETE' });
  assert.deepEqual(secretDeleteRequest('prj_1', 'X', target), { url: 'api/projects/prj_1/secrets/X', method: 'DELETE', body: { redeploy: { deploymentId: target.deploymentId, sha: target.sha } } });
  // the RTK endpoints are built from these, with the readers below as transformResponse
  const api = read('api/api.ts');
  assert.match(api, /projectSecrets: b\.query<ProjectSecretsResponse, \{ id: string; identity: string \}>\(\{ keepUnusedDataFor: 0, query: \(\{ id \}\) => secretsListUrl\(id\), transformResponse: parseProjectSecretsResponse/);
  assert.match(api, /secretPutRequest\(id, name, value, redeploy\), transformResponse: \(raw, _meta, arg\) => parseSecretSaved\(raw, arg\)/);
  assert.match(api, /secretDeleteRequest\(id, name, redeploy\), transformResponse: \(raw, _meta, arg\) => parseSecretRemoved\(raw, arg\)/);
});

test('a complete environment snapshot is sorted and sanitized without copying values', () => {
  const r = parseProjectSecretsResponse({
    secrets: [{ name: 'ZED', updatedAt: 5 }, { name: 'ALPHA', updatedAt: null, value: 'must not be copied' }],
    declared: ['ALPHA', 'DB_URL'], missing: ['DB_URL'],
  });
  assert.deepEqual(r, { secrets: [{ name: 'ALPHA', updatedAt: null }, { name: 'ZED', updatedAt: 5 }], declared: ['ALPHA', 'DB_URL'], missing: ['DB_URL'], unreadable: [] });
  assert.deepEqual(parseProjectSecretsResponse({ secrets: [{ name: 'A', updatedAt: 1 }], declared: ['A', 'B'] }).missing, ['B'], 'an omitted derived field can be calculated from the complete names snapshot');
  assert.deepEqual(envRowsOf(r).map((x) => [x.name, x.set, x.declared]), [['DB_URL', false, true], ['ALPHA', true, true], ['ZED', true, false]]);
});

test('incomplete, duplicate and contradictory environment snapshots cannot enable an empty editor', () => {
  const base = { secrets: [{ name: 'A', updatedAt: 1 }], declared: ['A', 'B'], missing: ['B'] };
  for (const raw of [null, {}, [], { secrets: [] }, ...[
    { secrets: [null] }, { secrets: [{ name: 'A' }] }, { secrets: [{ name: 'A', updatedAt: 'later' }] },
    { secrets: [base.secrets[0], base.secrets[0]] }, { secrets: [{ name: 'bad name', updatedAt: 1 }] },
    { declared: ['A', 'A'] }, { declared: ['A', 7] }, { missing: [] }, { missing: ['A'] }, { missing: ['B', 'B'] },
    { missing: ['B', 'OTHER'] }, { missing: null },
  ].map(patch => ({ ...base, ...patch }))]) {
    assert.equal(readProjectSecretsResponse(raw), null);
    assert.throws(() => parseProjectSecretsResponse(raw), /invalid_project_secrets/);
    assert.equal(envAccessOf({ data: raw }), 'error');
  }
  assert.equal(envAccessOf({}), 'error', 'a completed absent response cannot spin indefinitely');
  assert.equal(envAccessOf({ isLoading: true }), 'loading');
});

test('environment mutation receipts identify the exact reviewed deployment and commit', () => {
  const saved = { name: 'A', updatedAt: 9, created: true, redeploy: receipt() };
  const removed = { name: 'A', ok: true, redeploy: receipt() };
  assert.deepEqual(parseSecretSaved(saved, { name: 'A', redeploy: target }), saved);
  assert.deepEqual(parseSecretRemoved(removed, { name: 'A', redeploy: target }), removed);
  for (const redeploy of [null, { deploymentId: 'dep', status: 'queued' },
    ...[{ projectId: 'foreign' }, { redeployOf: 'newer' }, { sha: 'b'.repeat(40) }, { deploymentId: target.deploymentId }].map(p => ({ ...receipt(), ...p }))]) {
    assert.throws(() => parseSecretSaved({ ...saved, redeploy }, { name: 'A', redeploy: target }), /unconfirmed_secret_mutation/);
    assert.throws(() => parseSecretRemoved({ ...removed, redeploy }, { name: 'A', redeploy: target }), /unconfirmed_secret_mutation/);
  }
  assert.equal(parseSecretSaved({ ...saved, redeploy: null }, { name: 'A' }).redeploy, null);
  for (const bad of [{ ...target, projectId: 'foreign' }, { ...target, sha: 'main' }]) {
    assert.throws(() => secretPutRequest(target.projectId, 'A', 'v', bad), /invalid_redeploy_target/);
    assert.throws(() => secretDeleteRequest(target.projectId, 'A', bad), /invalid_redeploy_target/);
  }
});

test('bulk save: one at a time, redeploy on the last write only, the first refusal stops it', async () => {
  const calls: [string, string, SecretRedeployTarget | false][] = [];
  const ok = (name: string, rd: SecretRedeployTarget | false): SecretSaved => ({ name, updatedAt: 1, created: true, redeploy: rd ? receipt() : null });
  const progress: number[] = [];
  const r = await saveSecretsSequentially([{ name: 'A', value: '1' }, { name: 'B', value: '2' }, { name: 'C', value: '3' }],
    async (n, v, rd) => { calls.push([n, v, rd]); return ok(n, rd); }, { redeployLast: target, onProgress: (d) => progress.push(d) });
  assert.deepEqual(calls, [['A', '1', false], ['B', '2', false], ['C', '3', target]]);
  assert.deepEqual(progress, [1, 2, 3]);
  assert.deepEqual(r.redeploy, receipt());
  assert.equal(r.failed, null);

  const seen: string[] = [];
  const stop = await saveSecretsSequentially([{ name: 'A', value: '1' }, { name: 'B', value: '2' }, { name: 'C', value: '3' }],
    async (n, _v, rd) => { seen.push(n); if (n === 'B') throw { status: 409, data: { error: { code: 'too_many_secrets', message: 'max 64' } } }; return ok(n, rd); }, { redeployLast: target });
  assert.deepEqual(seen, ['A', 'B'], 'C is not attempted');
  assert.deepEqual(stop.saved.map((s) => s.name), ['A']);
  assert.equal(stop.failed?.name, 'B');
  assert.equal(stop.redeploy, null, 'no redeploy for an incomplete set');

  const noRedeploy: (SecretRedeployTarget | false)[] = [];
  await saveSecretsSequentially([{ name: 'A', value: '1' }], async (n, _v, rd) => { noRedeploy.push(rd); return ok(n, rd); });
  assert.deepEqual(noRedeploy, [false]);
});

test('the node\'s refusals map to codes, and the section knows whom it is talking to', () => {
  assert.deepEqual(secretApiErrorOf({ status: 400, data: { error: { code: 'reserved_name', message: 'PORT is set by the node' } } }), { status: 400, code: 'reserved_name', message: 'PORT is set by the node' });
  assert.equal(secretApiErrorOf({ status: 403, data: { error: { code: 'not_writer', message: 'x' } } }).code, 'not_writer');
  assert.equal(secretApiErrorOf({ status: 503, data: { error: { code: 'secrets_off', message: 'x' } } }).code, 'secrets_off');
  assert.equal(secretApiErrorOf({ status: 418, data: { error: { code: 'teapot', message: 'short and stout' } } }).code, 'unknown');
  assert.equal(secretApiErrorOf({ status: 'FETCH_ERROR' }).code, 'network');
  assert.equal(secretApiErrorOf({ status: 'PARSING_ERROR', originalStatus: 413, data: '<html>' }).code, 'value_too_large', 'a proxy\'s HTML 413');
  assert.equal(secretApiErrorOf({ status: 404, data: 'Not Found' }).code, 'not_found');

  assert.equal(envAccessOf({ skip: true }), 'hidden');
  assert.equal(envAccessOf({ isLoading: true }), 'loading');
  assert.equal(envAccessOf({ data: { secrets: [], declared: [], missing: [] } }), 'writer');
  assert.equal(envAccessOf({ error: { status: 403, data: { error: { code: 'not_writer', message: '' } } } }), 'reader');
  assert.equal(envAccessOf({ error: { status: 404, data: { error: { code: 'not_found', message: '' } } } }), 'hidden', 'outsiders, and an older node without the route');
  assert.equal(envAccessOf({ error: { status: 503, data: { error: { code: 'secrets_off', message: '' } } } }), 'off');
  assert.equal(envAccessOf({ error: { status: 'FETCH_ERROR' } }), 'error');
  const stale = { secrets: [{ name: 'PREVIOUS_SECRET' }], declared: [], missing: [] };
  assert.equal(envAccessOf({ data: stale, error: { status: 403, data: { error: { code: 'not_writer' } } } }), 'reader');
  assert.equal(envAccessOf({ data: stale, error: { status: 401 } }), 'hidden');
  assert.equal(envAccessOf({ data: stale, error: { status: 'FETCH_ERROR' } }), 'error');
});

test('every string the section and its banner render exists in English and in Korean', () => {
  const src = read('components/ProjectEnvVars.tsx');
  const keys = [...src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]!);
  assert.ok(keys.length > 30);
  const dynamic = [
    ...SECRET_ERROR_CODES.map((c) => `projects.env.err.${c}`),
    ...['empty', 'invalid', 'reserved', 'multiline', 'too_large', 'limit'].map((p) => `projects.env.problem.${p}`),
    ...['create', 'update', 'invalid'].map((a) => `projects.env.action.${a}`),
    ...['syntax', 'unterminated_quote'].map((r) => `projects.env.skip.${r}`),
    ...['queued', 'building', 'ready', 'error'].map((s) => `projects.env.deploy.${s}`),
  ];
  for (const key of [...keys, ...dynamic]) {
    const e = projects[key];
    assert.ok(e, `missing i18n key ${key}`);
    assert.ok(e.en.trim() && e.ko.trim(), `${key} needs both languages`);
    assert.ok(/[가-힣]/.test(e.ko), `${key}.ko is not Korean`);
  }
});

test('the console mounts the section in Settings and the missing banner above the tabs', () => {
  const page = read('screens/ProjectPage.tsx');
  assert.match(page, /<MissingEnvBanner project=\{p\} onGo=\{goToEnv\} \/>/);
  assert.match(page, /<ProjectEnvVars project=\{p\} onOpenDeployment=\{openDeployment\} \/>/);
});

test('save/delete receipts must name the chosen variable and explicitly acknowledge the requested action', () => {
  const saved = { name: 'TOKEN', updatedAt: 1, created: false, redeploy: null };
  const removed = { name: 'TOKEN', ok: true, redeploy: null };
  assert.deepEqual(parseSecretSaved(saved, { name: 'TOKEN' }), saved);
  assert.deepEqual(parseSecretRemoved(removed, { name: 'TOKEN' }), removed);
  for (const raw of [null, {}, { ...saved, name: 'OTHER' }, { ...saved, created: undefined }, { ...saved, updatedAt: null },
    { ...saved, updatedAt: NaN }, { ...saved, redeploy: undefined }, { ...saved, redeploy: { deploymentId: 'dep', status: 'ready' } }]) {
    assert.throws(() => parseSecretSaved(raw, { name: 'TOKEN', redeploy: target }), /unconfirmed_secret_mutation/);
  }
  for (const raw of [null, {}, { ...removed, name: 'OTHER' }, { ...removed, ok: false }, { ...removed, ok: undefined }, { ...removed, redeploy: undefined }]) {
    assert.throws(() => parseSecretRemoved(raw, { name: 'TOKEN' }), /unconfirmed_secret_mutation/);
  }
  assert.throws(() => parseSecretSaved({ ...saved, redeploy: { deploymentId: 'unexpected', status: 'queued' } }, { name: 'TOKEN', redeploy: false }), /unconfirmed/);
  assert.throws(() => parseSecretRemoved({ ...removed, redeploy: { deploymentId: 'unexpected', status: 'queued' } }, { name: 'TOKEN', redeploy: false }), /unconfirmed/);
});

test('bulk saving stops on the exact uncertain variable and never counts a mismatched receipt as saved', async () => {
  const calls: string[] = [];
  const r = await saveSecretsSequentially([{ name: 'A', value: 'a' }, { name: 'B', value: 'b' }, { name: 'C', value: 'c' }], async name => {
    calls.push(name); return { name: name === 'B' ? 'WRONG' : name, updatedAt: 1, created: true, redeploy: null };
  }, { redeployLast: target });
  assert.deepEqual(calls, ['A', 'B']); assert.deepEqual(r.saved.map(s => s.name), ['A']);
  assert.equal(r.failed?.name, 'B'); assert.equal(r.redeploy, null);
});

test('leaving a project/account during bulk save prevents subsequent writes under a different context', async () => {
  let active = true;
  const calls: string[] = [];
  const r = await saveSecretsSequentially([{ name: 'A', value: 'a' }, { name: 'B', value: 'b' }], async name => {
    calls.push(name); active = false; return { name, updatedAt: 1, created: true, redeploy: null };
  }, { isActive: () => active, redeployLast: target });
  assert.deepEqual(calls, ['A']); assert.equal(r.failed?.name, 'B'); assert.equal(r.redeploy, null);
});


test('a bulk sequence retains its initial reviewed target while later renders or callers update their selection', async () => {
  const selected = { ...target };
  const calls: (SecretRedeployTarget | false)[] = [];
  const r = await saveSecretsSequentially([{ name: 'A', value: '1' }, { name: 'B', value: '2' }], async (name, _value, rd) => {
    calls.push(rd);
    selected.deploymentId = 'newer'; selected.sha = 'b'.repeat(40);
    return { name, updatedAt: 1, created: true, redeploy: rd ? receipt() : null };
  }, { redeployLast: selected });
  assert.deepEqual(calls, [false, target]); assert.equal(r.failed, null); assert.deepEqual(r.redeploy, receipt());
});


test('unreadable environment names remain distinct from missing variables and never become healthy masked rows', () => {
  const raw = { secrets: [{ name: 'BROKEN', updatedAt: 1 }, { name: 'OK', updatedAt: 2 }], declared: ['BROKEN', 'ABSENT'], missing: ['ABSENT'], unreadable: ['BROKEN'] };
  const read = parseProjectSecretsResponse(raw);
  assert.deepEqual(read.unreadable, ['BROKEN']);
  const rows = envRowsOf(read);
  assert.equal(rows.find(r => r.name === 'BROKEN')?.unreadable, true);
  assert.equal(rows.find(r => r.name === 'OK')?.unreadable, undefined);
  assert.equal(rows.find(r => r.name === 'ABSENT')?.set, false);
  for (const unreadable of [['ABSENT'], ['BROKEN', 'BROKEN'], ['FOREIGN'], 'BROKEN', [null], null]) {
    assert.equal(readProjectSecretsResponse({ ...raw, unreadable }), null);
  }
  const { unreadable: _ignored, ...legacy } = raw;
  assert.deepEqual(parseProjectSecretsResponse(legacy).unreadable, []);
});
