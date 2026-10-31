import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectKnowledge } from '../src/lib/collectKnowledge';
import { manageFixture } from './fixtures/manageKnowledge';
const node = `0x${'1'.repeat(40)}`, subject = `0x${'2'.repeat(40)}`;
function fixture() {
  const detail = { ...manageFixture(), owned: false, purchased: true, has_body: false }; let active = true, writes = 0;
  const reply = { receipt_version: 1, node, patch_id: detail.anchor.id, redeemed: true, total: '0', totals: [], path: '/file', manifest: { id: detail.anchor.id, patch_sha256: detail.anchor.patch_sha256 } };
  const deps = { node, subject, current: () => active,
    readAccess: async () => ({ signedIn: true, isOwner: true, address: node, subject }), read: async (): Promise<unknown> => detail,
    write: async (expected: unknown): Promise<unknown> => { writes++; assert.equal((expected as any).id, detail.anchor.id); detail.has_body = true; return reply; } };
  return { detail, reply, deps, writes: () => writes, leave: () => { active = false; } };
}
test('collection confirms the exact no-charge receipt and freshly stored file', async () => {
  const f = fixture(); assert.deepEqual(await collectKnowledge(f.detail.anchor, f.deps), { already: false }); assert.equal(f.writes(), 1);
});
test('existing files make collection a read-only no-op', async () => {
  const f = fixture(); f.detail.has_body = true;
  assert.deepEqual(await collectKnowledge(f.detail.anchor, f.deps), { already: true }); assert.equal(f.writes(), 0);
});
test('explicit status inspection never starts a missing-file download', async () => {
  const f = fixture(); await assert.rejects(collectKnowledge(f.detail.anchor, { ...f.deps, inspectOnly: true }), /missing/);
  assert.equal(f.writes(), 0);
});
test('changed target or revoked access refuses before collection', async () => {
  const f = fixture(), expected = structuredClone(f.detail.anchor); f.detail.anchor.patch_sha256 = 'other';
  await assert.rejects(collectKnowledge(expected, f.deps), /changed/); assert.equal(f.writes(), 0);
  const g = fixture(); g.deps.readAccess = async () => ({ signedIn: true, isOwner: false, address: node, subject });
  await assert.rejects(collectKnowledge(g.detail.anchor, g.deps), /access/); assert.equal(g.writes(), 0);
});
test('old, wrong-node, charged or missing-file outcomes never become collection success', async () => {
  for (const change of ['legacy', 'node', 'charge', 'file']) {
    const f = fixture();
    if (change === 'legacy') f.reply.receipt_version = 0;
    if (change === 'node') f.reply.node = subject;
    if (change === 'charge') f.reply.total = '1';
    if (change === 'file') f.deps.write = async () => f.reply;
    await assert.rejects(collectKnowledge(f.detail.anchor, f.deps), /unconfirmed/);
  }
});
test('departure or a lost reply cannot cause an automatic replay', async () => {
  const f = fixture(); f.deps.read = async () => { f.leave(); return f.detail; };
  assert.equal(await collectKnowledge(f.detail.anchor, f.deps), null); assert.equal(f.writes(), 0);
  const g = fixture(); let calls = 0; g.deps.write = async () => { calls++; throw new Error('lost'); };
  await assert.rejects(collectKnowledge(g.detail.anchor, g.deps), /unconfirmed/); assert.equal(calls, 1);
});

test('an unresolved prior payment is a refusal, not a free collection or automatic retry', async () => {
  const f = fixture(); let calls = 0;
  f.deps.write = async () => { calls++; throw { status: 409, data: { error: 'collection_payment_pending: unresolved' } }; };
  await assert.rejects(collectKnowledge(f.detail.anchor, f.deps), /payment/);
  assert.equal(calls, 1); assert.equal(f.detail.has_body, false);
});
