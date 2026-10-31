import test from 'node:test';
import assert from 'node:assert/strict';
import { readAgentArchivePage, reviewAgentArchive, readAgentArchiveRestore, readAgentArchiveDownload, agentArchiveDeleted } from '../src/api/agentArchiveEvidence';
import { createAgentArchiveDownload } from '../src/lib/agentArchiveAction';
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

test('export preflight is single-flight and a late account response cannot trigger a download', async () => {
  const controller = createAgentArchiveDownload(); let release!: (v: unknown) => void, active = true, exports = 0;
  const d = { ...deps(), current: () => active, read: () => new Promise(resolve => { release = resolve; }),
    perform: async () => { exports++; return new Blob(['fixture']); } };
  const first = controller.run(record, d);
  assert.deepEqual(await controller.run(record, d), { kind: 'busy' });
  active = false; release(archiveDetail()); assert.equal((await first).kind, 'departed'); assert.equal(exports, 0);
  active = true;
  assert.equal((await controller.run(record, { ...d, read: async () => ({}), perform: async () => assert.fail('no export') })).kind, 'changed');
  const exported = await controller.run(record, { ...d, read: async () => archiveDetail() });
  assert.equal(exported.kind, 'exported'); assert.equal(exports, 1);
  assert.equal((await controller.run(record, { ...d, read: async () => archiveDetail(), perform: async () => { active = false; return new Blob(); } })).kind, 'departed');
});
