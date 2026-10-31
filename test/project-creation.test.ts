import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectParamsOf, connectRepoOnAindrive, projectRepoRef } from '../src/api/projects';
import { createProjectCreation, createdProjectReceipt, projectBranchValid } from '../src/lib/projectCreation';

const input = { repo: 'https://aindrive.ainetwork.ai/acme/git/repositories/demo.git', branch: 'feature/one' };
const receipt = () => ({ id: 'prj_1234567890abcdef', owner: 'sso:one', repo: 'https://aindrive.ainetwork.ai/acme/git/demo', org: 'acme', repoName: 'demo', branch: 'feature/one', sourcePath: '', canManage: true, hasDeployToken: false,
  hookUrl: 'https://ainize.test/api/projects/prj_1234567890abcdef/hook', webhookSecret: `whsec_${'a'.repeat(48)}` });
const deferred = <T>() => { let resolve!: (v: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };

test('creation receipts bind owner, canonical source, branch and root before exposing one-time secrets', () => {
  assert.ok(createdProjectReceipt(receipt(), input, 'sso:one'));
  for (const patch of [{ id: 'other' }, { owner: 'sso:two' }, { repo: input.repo }, { org: 'other' }, { repoName: 'other' }, { branch: 'main' }, { sourcePath: 'web' }, { canManage: false }, { hasDeployToken: true }, { webhookSecret: 'missing' }, { hookUrl: 'https://ainize.test/api/projects/prj_other/hook' }, { hookUrl: 'javascript:alert(1)' }, { deletionRequestedAt: 1 }]) {
    assert.equal(createdProjectReceipt({ ...receipt(), ...patch }, input, 'sso:one'), null, JSON.stringify(patch));
  }
  assert.equal(createdProjectReceipt(receipt(), input, ''), null);
  assert.equal(createdProjectReceipt(null, input, 'sso:one'), null);
});
test('same-turn duplicate submits cannot create twice or re-create after completion', async () => {
  const c = createProjectCreation(), d = deferred<unknown>(); let count = 0;
  const io = { active: () => true, send: () => { count++; return d.promise; } };
  const first = c.run(input, 'sso:one', io);
  assert.equal(await c.run(input, 'sso:one', io), null); assert.equal(count, 1);
  d.resolve(receipt()); assert.equal((await first)?.id, receipt().id);
  assert.equal(await c.run(input, 'sso:one', io), null); assert.equal(count, 1);
});
test('late account/view results do not hand a created project to a new view', async () => {
  const c = createProjectCreation(), d = deferred<unknown>(); let active = true;
  const pending = c.run(input, 'sso:one', { active: () => active, send: () => d.promise });
  active = false; d.resolve(receipt()); assert.equal(await pending, null); assert.equal(c.blocked(), true);
});
test('network, parse, server and wrong-target success are uncertain; no second write', async () => {
  for (const error of [{ status: 'FETCH_ERROR' }, { status: 'PARSING_ERROR', originalStatus: 201 }, { status: 500 }, { status: 403, data: { error: { code: 'unknown' } } }]) {
    const c = createProjectCreation(); let count = 0;
    const send = async () => { count++; throw error; };
    await assert.rejects(c.run(input, 'sso:one', { active: () => true, send }));
    assert.equal(c.uncertain(), true); assert.equal(await c.run(input, 'sso:one', { active: () => true, send }), null); assert.equal(count, 1);
  }
  const c = createProjectCreation();
  await assert.rejects(c.run(input, 'sso:one', { active: () => true, send: async () => ({ ...receipt(), branch: 'wrong' }) }));
  assert.equal(c.uncertain(), true);
});
test('documented pre-write rejections allow correcting the form', async () => {
  for (const [status, code] of [[400, 'invalid_request'], [401, 'not_signed_in'], [403, 'not_member'], [409, 'repo_taken'], [429, 'limit']]) {
    const c = createProjectCreation();
    await assert.rejects(c.run(input, 'sso:one', { active: () => true, send: async () => { throw { status, data: { error: { code } } }; } }));
    assert.equal(c.blocked(), false); assert.ok(await c.run(input, 'sso:one', { active: () => true, send: async () => receipt() }));
  }
});
test('ambiguous incoming target selectors are refused and return links cannot switch host through backslashes or credentials', () => {
  for (const search of ['?repo=a&repo=b', '?driveId=d&driveId=e', '?returnTo=/a&returnTo=/b', '?branch=dev&branch=main', '?driveId=d&repo=https://other.test/o/git/r', '?driveId=d']) assert.equal(connectParamsOf(search).invalid, true);
  assert.equal(connectParamsOf('?branch=feature%2Ftwo').branch, 'feature/two');
  for (const target of ['/\\evil.test', '//evil.test', 'https://user@aindrive.ainetwork.ai/a', '/\nevil']) assert.equal(connectParamsOf(`?returnTo=${encodeURIComponent(target)}`).returnTo, null);
});
test('repository and branch selectors reject silently ignored or invalid values', () => {
  assert.equal(projectRepoRef(input.repo)?.url, receipt().repo);
  for (const repo of ['https://d.test/o/git/r?branch=other', 'https://d.test/o/git/r#other', 'https://user@d.test/o/git/r', 'https://d.test/o/git/%XX', 'https://d.test/o/git/r%2Fs', 'https://d.test/o/git//r', 'https://d.test/o/git/a/../r', 'https://d.test/o/git/%2e%2e/r']) assert.equal(projectRepoRef(repo), null);
  for (const branch of ['', '..', 'main..other', 'a//b', 'a/.b', 'a.lock', 'a/', '.hidden', 'main.', 'a@{b']) assert.equal(projectBranchValid(branch), false, branch);
  for (const branch of ['main', 'feature/one', 'release-1.2']) assert.equal(projectBranchValid(branch), true);
});
test('handoff requires a receipt for the same drive, repository URL and project; generic 2xx is not connected', async () => {
  const request = { driveId: 'd', repo: input.repo, projectId: receipt().id, webhookSecret: receipt().webhookSecret };
  const good = { ok: true, driveId: 'd', repoUrl: input.repo, repo: 'repositories/demo', projectId: receipt().id };
  for (const response of [{}, { ...good, driveId: 'other' }, { ...good, repoUrl: 'other' }, { ...good, projectId: 'other' }, { ...good, repo: 'repositories/other' }, { ...good, repo: '' }, { ...good, repo: '../other' }]) {
    const result = await connectRepoOnAindrive(request, { fetchImpl: (async () => Response.json(response)) as typeof fetch });
    assert.equal(result.ok, false);
  }
  let body: unknown;
  const ctrl = new AbortController();
  const result = await connectRepoOnAindrive(request, { signal: ctrl.signal, fetchImpl: (async (_url, init) => { body = JSON.parse(String(init?.body)); assert.equal(init?.signal?.aborted, false); ctrl.abort(); assert.equal(init?.signal?.aborted, true); return Response.json(good); }) as typeof fetch });
  assert.deepEqual(result, { ok: true, repoPath: 'repositories/demo' });
  assert.deepEqual(body, { repoUrl: input.repo, projectId: receipt().id, webhookSecret: receipt().webhookSecret, expectedProjectId: null });
});

test('handoff timeout and cancelled views report uncertainty instead of waiting forever or sending after cancellation', async (t) => {
  const request = { driveId: 'd', repo: input.repo, projectId: receipt().id, webhookSecret: receipt().webhookSecret };
  const ctrl = new AbortController(); ctrl.abort(); let calls = 0;
  assert.equal((await connectRepoOnAindrive(request, { signal: ctrl.signal, fetchImpl: (async () => { calls++; return Response.json({}); }) as typeof fetch })).ok, false);
  assert.equal(calls, 0);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = connectRepoOnAindrive(request, { fetchImpl: (async (_url, init) => new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); })) as typeof fetch });
  t.mock.timers.tick(15000);
  assert.equal((await pending).ok, false);
});
