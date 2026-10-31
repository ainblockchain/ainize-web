import test from 'node:test';
import assert from 'node:assert/strict';
import { readAgentArchivePage, reviewAgentArchive, readAgentArchiveRestore, readAgentArchiveDownload, agentArchiveDeleted } from '../src/api/agentArchiveEvidence';
import { createAgentArchiveActions } from '../src/lib/agentArchiveAction';
import { archivedAgent, archiveDetail, archiveReceipt } from './fixtures/agentArchive';
const record = archivedAgent();
const page = () => ({ archives: [record], total: 1, offset: 0, limit: 10 });
const deps = () => ({ owner: 'sso:viewer', current: () => true, read: async () => archiveDetail(), perform: async () => archiveReceipt() });

test('archive pages require coherent pagination, exact unique identities and usable row metadata', () => {
  assert.deepEqual(readAgentArchivePage(page(), 0), page());
  assert.deepEqual(readAgentArchivePage({ archives: [], total: 0, offset: 0, limit: 10 }, 0)?.archives, []);
  for (const patch of [{ total: 2 }, { total: -1 }, { offset: 10 }, { limit: 50 }, { archives: null }, { total: 2, archives: [record, record] }]) {
    assert.equal(readAgentArchivePage({ ...page(), ...patch }, 0), null);
  }
  for (const patch of [{ id: '../other' }, { agent: '../edit' }, { bytes: NaN }, { createdAt: 'yesterday' }, { exportedAt: true },
    { restoredAt: 0 }, { repository: 'yes' }, { repositoryFormat: 'zip' }, { secretNames: 'TOKEN' }, { source: [] }]) {
    assert.equal(readAgentArchivePage({ ...page(), archives: [{ ...record, ...patch }] }, 0), null);
  }
  assert.equal(readAgentArchivePage({ archives: [], total: 5, offset: 10, limit: 10 }, 10)?.total, 5, 'a disappeared final page can navigate back');
});

test('preflight binds archive, owner, version and reviewed metadata while allowing a newly completed export', () => {
  assert.equal(reviewAgentArchive(archiveDetail(), record, 'sso:viewer')?.version, 5);
  assert.equal('spec' in reviewAgentArchive(archiveDetail(), record, 'sso:viewer')!.record, false, 'the UI review does not retain files or private archive metadata');
  const exported = archiveDetail(); exported.archive.exportedAt = 1700000001000;
  assert.equal(reviewAgentArchive(exported, record, 'sso:viewer')?.record.exportedAt, 1700000001000);
  assert.equal(reviewAgentArchive(archiveDetail(), record, 'sso:another'), null);
  for (const patch of [{ id: 'archive_' + 'b'.repeat(24) }, { agent: 'other' }, { createdAt: record.createdAt + 1 },
    { bytes: 1 }, { restoredAt: record.createdAt + 10 }, { spec: { ...archiveDetail().archive.spec, version: '5' } },
    { spec: { ...archiveDetail().archive.spec, owner: 'another' } }]) {
    assert.equal(reviewAgentArchive({ archive: { ...archiveDetail().archive, ...patch } }, record, 'sso:viewer'), null);
  }
});

test('restore and deletion receipts cannot confirm another archive, agent, version or incomplete result', () => {
  const review = reviewAgentArchive(archiveDetail(), record, 'sso:viewer')!;
  assert.ok(readAgentArchiveRestore(archiveReceipt(), review));
  for (const patch of [{ archiveId: undefined }, { archiveId: 'archive_' + 'b'.repeat(24) }, { agentId: 'other' },
    { status: 'building' }, { version: 8 }, { version: 5 }, { commit: '' }, { sourceCommit: 'HEAD' }, { secretsRequired: null }]) {
    assert.equal(readAgentArchiveRestore({ ...archiveReceipt(), ...patch }, review), null);
  }
  assert.equal(agentArchiveDeleted({ deleted: 'other' }, record.id), false);
  assert.equal(agentArchiveDeleted({ deleted: record.id }, record.id), true);
});

test('download rejects HTML/sign-in, foreign filenames and non-gzip bodies before browser save', async () => {
  const filename = `${record.agent}-${record.id}.tar.gz`;
  const headers = { 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="${filename}"` };
  const magic = new Uint8Array([31, 139, 8, 0]);
  assert.equal((await readAgentArchiveDownload(new Response(magic, { headers }), record)).size, 4);
  for (const response of [new Response('<html>'), new Response(magic, { headers: { ...headers, 'content-disposition': 'attachment; filename="other.tar.gz"' } }),
    new Response('broken', { headers }), new Response(magic, { headers: { ...headers, 'content-type': 'text/html' } })]) {
    await assert.rejects(readAgentArchiveDownload(response, record), /archive_download_invalid/);
  }
  await assert.rejects(readAgentArchiveDownload(new Response(JSON.stringify({ error: { code: 'not_found' } }), { status: 404 }), record), (e: any) => e.status === 404);
});

test('synchronous action lock prevents double restore admission during delayed preflight', async () => {
  const controller = createAgentArchiveActions(); let reads = 0, writes = 0, release!: (v: unknown) => void;
  const d = { ...deps(), read: () => { reads++; return new Promise(resolve => { release = resolve; }); }, perform: async () => { writes++; return archiveReceipt(); } };
  const first = controller.run(record, 'restore', d);
  assert.deepEqual(await controller.run(record, 'restore', d), { kind: 'busy' });
  release(archiveDetail()); assert.equal((await first).kind, 'restored'); assert.equal(reads, 1); assert.equal(writes, 1);
});

test('account departure and changed/failed review perform no write or success update', async () => {
  for (const read of [async () => ({ archive: null }), async () => { throw new Error('offline'); }]) {
    const result = await createAgentArchiveActions().run(record, 'restore', { ...deps(), read, perform: async () => assert.fail('no write') });
    assert.ok(result.kind === 'changed' || result.kind === 'failed');
  }
  let active = true;
  const result = await createAgentArchiveActions().run(record, 'restore', { ...deps(), current: () => active,
    read: async () => { active = false; return archiveDetail(); }, perform: async () => assert.fail('no write after departure') });
  assert.equal(result.kind, 'departed');
});

test('unexported archives cannot be deleted even when the stale row claimed an export', async () => {
  const selected = { ...record, exportedAt: record.createdAt + 1 };
  assert.equal((await createAgentArchiveActions().run(selected, 'delete', { ...deps(), perform: async () => assert.fail('no delete') })).kind, 'changed');
});

test('missing or lost mutation receipts lock restore/delete, while read-only export stays available', async () => {
  for (const perform of [async () => ({}), async () => { throw new Error('lost reply'); }, async () => { throw { status: 502, data: { error: { code: 'restore_cleanup_failed' } } }; }]) {
    const controller = createAgentArchiveActions();
    assert.equal((await controller.run(record, 'restore', { ...deps(), perform })).kind, 'unknown');
    assert.ok(controller.unresolved(record.id));
    for (const action of ['restore', 'delete'] as const) assert.equal((await controller.run(record, action, { ...deps(), read: async () => assert.fail('no repeat') })).kind, 'unknown');
    assert.equal((await controller.run(record, 'export', { ...deps(), perform: async () => new Blob(['fixture']) })).kind, 'exported');
  }
});

test('exact pre-admission refusals allow corrected attempts but anonymous status guesses do not', async () => {
  const controller = createAgentArchiveActions();
  assert.equal((await controller.run(record, 'restore', { ...deps(), perform: async () => { throw { status: 409, data: { error: { code: 'project_environment_required' } } }; } })).kind, 'failed');
  assert.equal(controller.unresolved(record.id), false);
  assert.equal((await controller.run(record, 'restore', deps())).kind, 'restored');
  assert.equal((await controller.run(record, 'restore', { ...deps(), perform: async () => { throw { status: 409 }; } })).kind, 'unknown');
});

test('late mutation response after account departure cannot publish another account result', async () => {
  const controller = createAgentArchiveActions(); let active = true;
  assert.equal((await controller.run(record, 'restore', { ...deps(), current: () => active,
    perform: async () => { active = false; return archiveReceipt(); } })).kind, 'departed');
  assert.ok(controller.unresolved(record.id));
});

test('archive selection is captured before awaits and deletion needs its own exact receipt', async () => {
  const selected = { ...archivedAgent(), exportedAt: 1700000001000 }, original = structuredClone(selected);
  const result = await createAgentArchiveActions().run(selected, 'delete', { ...deps(),
    read: async () => { selected.agent = 'changed'; selected.id = 'archive_' + 'b'.repeat(24); return archiveDetail(original); },
    perform: async review => { assert.equal(review.record.agent, original.agent); return { deleted: original.id }; } });
  assert.equal(result.kind, 'deleted');
  const controller = createAgentArchiveActions();
  const invalid = await controller.run(original, 'delete', { ...deps(), read: async () => archiveDetail(original), perform: async () => ({ deleted: 'another' }) });
  assert.equal(invalid.kind, 'unknown'); assert.ok(controller.unresolved(original.id));
});
