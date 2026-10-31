import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseKnowledgeDemand, requestKnowledge, knowledgeDemandTarget } from '../src/lib/knowledgeDemand';
import { demandFixture, demandNode, demandAuthor } from './knowledge-demand-fixture';
const selected = { id: 'selected', author: demandAuthor }, context = { node: demandNode, actor: 'google:person' };
test('request records bind node, account, selected author/item and consistent event evidence', () => {
  const r = demandFixture(true); assert.ok(parseKnowledgeDemand(r, selected, context));
  for (const change of [{ node: 'other' }, { actor: 'google:other' }, { patch_id: 'other' }, { author: 'other' }, { scope: 'network' },
    { requested: false }, { event_id: null }, { event_id: -1 }, { requests: 0 }, { requests: NaN }, { can_request: true }, { count_scope: 'people' }]) {
    assert.equal(parseKnowledgeDemand({ ...r, ...change }, selected, context), null);
  }
  assert.equal(parseKnowledgeDemand({ ...r, requester: 'other' }, selected, context, knowledgeDemandTarget(r)), null);
});
test('confirmation reads first, sends one exact intent and verifies the record afresh', async () => {
  let reads = 0, writes = 0, intent: unknown;
  const out = await requestKnowledge(selected, { ...context, current: () => true, intent: t => { intent = t; },
    read: async () => demandFixture(++reads > 1), write: async expected => { writes++; assert.deepEqual(expected, intent); return demandFixture(true); } });
  assert.equal(out?.requested, true); assert.equal(reads, 2); assert.equal(writes, 1);
});
test('an existing request or already available file is observed without another mutation', async () => {
  for (const status of [demandFixture(true), { ...demandFixture(), available: true, can_request: false }]) {
    let writes = 0;
    const result = await requestKnowledge(selected, { ...context, current: () => true, intent() {}, read: async () => status, write: async () => { writes++; } });
    assert.deepEqual(result, status); assert.equal(writes, 0);
  }
});
test('a lost response stays unconfirmed and inspection never repeats the request', async () => {
  let writes = 0, saved: any;
  const deps = { ...context, current: () => true, intent: (t: unknown) => { saved = t; }, read: async () => demandFixture(),
    write: async () => { writes++; throw new Error('lost'); } };
  await assert.rejects(requestKnowledge(selected, deps), /unconfirmed/); assert.equal(writes, 1);
  const result = await requestKnowledge(selected, { ...deps, expected: saved, inspectOnly: true, read: async () => demandFixture(true) });
  assert.equal(result?.requested, true); assert.equal(writes, 1);
});
test('wrong target or account response and missing readback cannot report success', async () => {
  for (const reply of [{ ...demandFixture(true), patch_id: 'other' }, { ...demandFixture(true), actor: 'google:other' },
    { ...demandFixture(true), patch_sha256: 'new-file' }, { ...demandFixture(true), requester: 'other' }, demandFixture(true)]) {
    let writes = 0;
    await assert.rejects(requestKnowledge(selected, { ...context, current: () => true, intent() {},
      read: async () => demandFixture(), write: async () => { writes++; return reply; } }), /unconfirmed/);
    assert.equal(writes, 1);
  }
});
test('leaving before submission prevents writing and leaving afterward suppresses its outcome', async () => {
  let active = true, writes = 0;
  assert.equal(await requestKnowledge(selected, { ...context, current: () => active, intent() {},
    read: async () => { active = false; return demandFixture(); }, write: async () => { writes++; } }), null);
  assert.equal(writes, 0); active = true;
  assert.equal(await requestKnowledge(selected, { ...context, current: () => active, intent() {},
    read: async () => demandFixture(), write: async () => { active = false; writes++; return demandFixture(true); } }), null);
  assert.equal(writes, 1);
});
test('anonymous network requests are not represented as a signed-in account request', () => {
  const network = { ...demandFixture(true), actor: null, scope: 'network' };
  assert.ok(parseKnowledgeDemand(network, selected, { ...context, actor: null }));
  assert.equal(parseKnowledgeDemand(network, selected, context), null);
});
test('failed preflight or server target refusal does not become a successful request', async () => {
  let writes = 0;
  await assert.rejects(requestKnowledge(selected, { ...context, current: () => true, intent() {}, read: async () => ({ requests: 1 }), write: async () => { writes++; } }), /read/);
  assert.equal(writes, 0);
  await assert.rejects(requestKnowledge(selected, { ...context, current: () => true, intent() {}, read: async () => demandFixture(),
    write: async () => { writes++; throw { status: 409, data: { error: 'knowledge_request_changed: file changed' } }; } }), /changed/);
  assert.equal(writes, 1);
});
test('checking a previously recorded request never recreates a pruned record', async () => {
  let writes = 0;
  const result = await requestKnowledge(selected, { ...context, current: () => true, intent() {}, inspectOnly: true,
    read: async () => demandFixture(), write: async () => { writes++; return demandFixture(true); } });
  assert.equal(result?.requested, false); assert.equal(result?.can_request, true); assert.equal(writes, 0);
});
