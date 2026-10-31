import test from 'node:test';
import assert from 'node:assert/strict';
import type { Project } from '../src/api/projects';
import { createProjectManagement, projectManagementReceipt, projectSyncTarget, sameProjectManagementTarget } from '../src/lib/projectManagement';
const p = { id: 'project', repo: 'https://aindrive.ainetwork.ai/team/git/app', upstreamRepo: 'https://github.com/team/app', branch: 'main', owner: 'alice',
  hookUrl: 'https://node.example/api/projects/project/hook', sourcePath: 'web', canManage: true, canOperate: true } as Project;
const rotation = { id: p.id, hookUrl: p.hookUrl, webhookSecret: `whsec_${'a'.repeat(48)}` };
const sync = { projectId: p.id, repository: p.repo, requested: true, requestedAt: '2026-10-31T01:00:00.000Z' };
const deletion = { id: p.id, ok: true };
const active = () => true;

test('management receipts bind the operation and exact project rather than trusting HTTP success', () => {
  assert.equal(projectManagementReceipt(rotation, p, 'rotate')?.kind, 'rotate');
  assert.equal(projectManagementReceipt(sync, p, 'sync')?.kind, 'sync');
  assert.equal(projectManagementReceipt(deletion, p, 'delete')?.kind, 'delete');
  for (const raw of [null, {}, { ...rotation, id: 'other' }, { ...rotation, hookUrl: 'https://elsewhere.example/hook' }, { ...rotation, webhookSecret: 'short' }]) assert.equal(projectManagementReceipt(raw, p, 'rotate'), null);
  for (const raw of [{}, { ...sync, projectId: 'other' }, { ...sync, repository: 'other' }, { ...sync, requested: false }, { ...sync, requestedAt: 'today' }]) assert.equal(projectManagementReceipt(raw, p, 'sync'), null);
  for (const raw of [{}, { ...deletion, id: 'other' }, { ...deletion, ok: false }]) assert.equal(projectManagementReceipt(raw, p, 'delete'), null);
});

test('preflight requires the reviewed target and action permission but permits unrelated build updates', () => {
  assert.equal(sameProjectManagementTarget({ ...p, status: 'building', updatedAt: 99 }, p, 'delete'), true);
  for (const change of [{ id: 'other' }, { owner: 'bob' }, { branch: 'next' }, { sourcePath: 'other' }, { repo: 'https://other.example/app' }, { canManage: false }, { hookUrl: 'https://other.example/hook' }]) assert.equal(sameProjectManagementTarget({ ...p, ...change }, p, 'rotate'), false);
  assert.equal(sameProjectManagementTarget({ ...p, canOperate: false }, p, 'sync'), false);
  assert.equal(sameProjectManagementTarget({ ...p, canManage: false }, p, 'sync'), true);
});

test('sync controls require an explicit GitHub source and exact supported Drive repository', () => {
  assert.equal(projectSyncTarget(p), true);
  for (const upstreamRepo of [undefined, '', 'https://github.com/team/app/issues', 'https://github.com.evil.com/team/app', 'https://user:pass@github.com/team/app']) assert.equal(projectSyncTarget({ ...p, upstreamRepo }), false);
  for (const repo of ['https://aindrive.ainetwork.ai/d/drive', 'https://aindrive.ainetwork.ai/team/git/app?other=1', 'https://aindrive.ainetwork.ai.evil.com/team/git/app']) assert.equal(projectSyncTarget({ ...p, repo }), false);
});

test('changed permissions and failed fresh reads send no management request', async () => {
  const gate = createProjectManagement(); let sent = 0;
  await assert.rejects(gate.run(p, 'delete', { read: async () => ({ ...p, canManage: false }), send: async () => { sent++; return deletion; }, active }), /changed/);
  await assert.rejects(gate.run(p, 'rotate', { read: async () => { throw new Error('read failed'); }, send: async () => { sent++; return rotation; }, active }), /read failed/);
  assert.equal(sent, 0); assert.equal(gate.blocked(), false);
});

test('sync, rotation and deletion share synchronous exclusion through preflight and dispatch', async () => {
  const gate = createProjectManagement(); let release!: (v: unknown) => void, sent = 0;
  const first = gate.run(p, 'rotate', { read: () => new Promise(r => { release = r; }), send: async () => { sent++; return rotation; }, active });
  for (const action of ['sync', 'rotate', 'delete'] as const) assert.equal(await gate.run(p, action, { read: async () => p, send: async () => assert.fail('overlap'), active }), null);
  release(p); assert.equal((await first)?.kind, 'rotate'); assert.equal(sent, 1); assert.equal(gate.blocked(), false);
});

test('unknown, wrong-target and malformed acknowledgments lock all management actions', async () => {
  for (const send of [async () => ({}), async () => ({ ...rotation, id: 'other' }), async () => { throw new Error('lost response'); }]) {
    const gate = createProjectManagement();
    await assert.rejects(gate.run(p, 'rotate', { read: async () => p, send, active }));
    assert.equal(gate.uncertain(), true);
    assert.equal(await gate.run(p, 'delete', { read: async () => p, send: async () => assert.fail('must not repeat'), active }), null);
  }
});

test('known pre-admission refusals remain correctable', async () => {
  const gate = createProjectManagement();
  await assert.rejects(gate.run(p, 'delete', { read: async () => p, send: async () => { throw { status: 409, data: { error: { code: 'ax_cleanup_required' } } }; }, active }));
  assert.equal(gate.uncertain(), false);
  assert.equal((await gate.run(p, 'delete', { read: async () => p, send: async () => deletion, active }))?.kind, 'delete');
});

test('leaving during preflight prevents dispatch and leaving during dispatch suppresses secret delivery', async () => {
  let here = true, release!: (v: unknown) => void;
  const before = createProjectManagement().run(p, 'rotate', { read: () => new Promise(r => { release = r; }), send: async () => assert.fail('departed'), active: () => here });
  here = false; release(p); assert.equal(await before, null);
  here = true;
  const after = createProjectManagement().run(p, 'rotate', { read: async () => p, send: () => new Promise(r => { release = r; }), active: () => here });
  await Promise.resolve(); here = false; release(rotation); assert.equal(await after, null);
});
