import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRuntimeApplyReview, reviewedRuntimeOutcome } from '../src/lib/runtimeApplyReview';
import { runtimeReviewFixture } from './fixtures/runtimeReview';
import { manageFixture } from './fixtures/manageKnowledge';
import { changeRuntimeKnowledge, confirmRuntimeKnowledge, reviewRuntimeKnowledge, LoadKnowledgeError } from '../src/lib/loadKnowledge';
import { prepareRuntimeOperation, runtimeOperationRequest, RuntimeOperationError } from '../src/lib/runtimeOperation';
const target = () => manageFixture().anchor;
const node = runtimeReviewFixture().node;
const access = { signedIn: true, isOwner: true, address: node, subject: null };
const record = (patch_id: string, sha256: string, position = 0) => ({ patch_id, sha256, position, applied_at: 100, reason: 'manual' });
const deps = (overrides = {}) => ({ current: () => true, node, subject: null,
  readAccess: async (): Promise<unknown> => access, read: async (): Promise<unknown> => manageFixture(),
  runtime: async (): Promise<unknown> => ({ available: true, hook: true, applied: [], stack: [] }), ...overrides });

function chain() {
  const r = runtimeReviewFixture(); r.with_base = true;
  const base = { ...r.order[0].anchor, id: 'base', name: 'Base', patch_sha256: 'base-bytes' };
  r.order[0].anchor.base = { export: 'delta', stack: [{ patch_id: 'base', patch_sha256: 'base-bytes' }] } as any;
  r.order.unshift({ anchor: base, requested: false, physical_id: 'existing-alias', action: 'reuse' });
  r.before = [{ patch_id: 'existing-alias', sha256: 'base-bytes' }]; r.after.unshift(r.before[0]);
  return r;
}

test('complete prerequisite review accepts pinned physical aliases and rejects substituted plans', () => {
  const r = chain(), chosen = r.order[1].anchor;
  assert.ok(parseRuntimeApplyReview(r, chosen, node, r.instance));
  const variants = [
    { ...r, node: '0x' + 'ef'.repeat(20) }, { ...r, instance: 'restarted' }, { ...r, revision: 'invalid' },
    { ...r, requested: ['other'] }, { ...r, after: [...r.after].reverse() }, { ...r, before: [] },
    { ...r, order: r.order.slice(1) }, { ...r, order: r.order.map(row => ({ ...row, action: 'load' })) },
    { ...r, with_base: false, before: [], order: r.order.map(row => ({ ...row, action: 'load' })) },
    { ...r, order: [r.order[0], { ...r.order[1], anchor: { ...chosen, base: { stack: [null] } } }] },
  ];
  for (const raw of variants) assert.equal(parseRuntimeApplyReview(raw, chosen, node), null);
  assert.equal(parseRuntimeApplyReview(r, target(), node), null);
  const unrelated = runtimeReviewFixture(); unrelated.with_base = true;
  unrelated.order.unshift({ ...unrelated.order[0], anchor: { ...unrelated.order[0].anchor, id: 'unrelated', patch_sha256: 'unrelated' }, requested: false, physical_id: 'unrelated' });
  unrelated.after.unshift({ patch_id: 'unrelated', sha256: 'unrelated' });
  assert.equal(parseRuntimeApplyReview(unrelated, target(), node), null);
});
test('receipt and fresh records confirm every reviewed physical alias/order and preserve prior layers', () => {
  const r = chain(), outcome = { order: ['base', 'chosen'], loaded: ['chosen'], aliases: { base: 'existing-alias' }, stack: r.after };
  assert.equal(reviewedRuntimeOutcome(r, outcome, r.after), true);
  assert.equal(reviewedRuntimeOutcome(r, outcome, [...r.after, { patch_id: 'later', sha256: 'later' }]), true);
  for (const raw of [{ ...outcome, aliases: {} }, { ...outcome, order: ['chosen'] }, { ...outcome, loaded: ['base', 'chosen'] }, { ...outcome, stack: r.after.slice(1) }]) assert.equal(reviewedRuntimeOutcome(r, raw, r.after), false);
  assert.equal(reviewedRuntimeOutcome(r, outcome, r.after.slice(1)), false);
  assert.equal(reviewedRuntimeOutcome(r, outcome, [...r.after].reverse()), false);
});
test('review reads are operator/target/view scoped and never send a model write', async () => {
  const review = runtimeReviewFixture(); review.with_base = true;
  let reads = 0;
  const preview = async () => { reads++; return review; };
  assert.ok(await reviewRuntimeKnowledge(target(), { ...deps(), preview })); assert.equal(reads, 1);
  await assert.rejects(reviewRuntimeKnowledge(target(), { ...deps({ readAccess: async () => ({ ...access, isOwner: false }) }), preview }), /access/);
  await assert.rejects(reviewRuntimeKnowledge(target(), { ...deps({ read: async () => manageFixture('other') }), preview }), /read/);
  assert.equal(reads, 1);
  let active = true;
  assert.equal(await reviewRuntimeKnowledge(target(), { ...deps({ current: () => active }), preview: async () => { active = false; return review; } }), null);
});
test('a changed reviewed baseline stops submission and old nodes cannot silently discard the revision', async () => {
  const r = runtimeReviewFixture(); const cap = { instance: r.instance, server_time: 1_800_000_000_000, request_window_ms: 600_000, apply_preview: true };
  const op = prepareRuntimeOperation('owner', target(), 'load', false, [], cap, 'b'.repeat(32), r);
  assert.equal(runtimeOperationRequest(op).body.expected_preview, r.revision);
  assert.throws(() => prepareRuntimeOperation('owner', target(), 'load', false, [], { ...cap, apply_preview: false }, 'b'.repeat(32), r), RuntimeOperationError);
  assert.throws(() => prepareRuntimeOperation('owner', target(), 'load', false, [], cap, 'b'.repeat(32)), RuntimeOperationError);
  assert.throws(() => prepareRuntimeOperation('owner', target(), 'load', false, [], { ...cap, instance: 'd'.repeat(32) }, 'b'.repeat(32), r),
    (e: unknown) => e instanceof RuntimeOperationError && e.code === 'review');
  await assert.rejects(changeRuntimeKnowledge(target(), 'load', false, { ...deps({ runtime: async () => ({ available: true, hook: true, applied: ['other'], stack: [record('other', 'other')] }) }), review: r,
    write: async () => assert.fail('changed review must not submit') }), (e: unknown) => e instanceof LoadKnowledgeError && e.code === 'changed');
});
test('completion accepts a reviewed prerequisite alias but refuses a misleading alias receipt', async () => {
  const r = chain(), chosen = r.order[1].anchor;
  const rows = r.after.map((row, i) => record(row.patch_id, row.sha256, i));
  const d = { ...deps({ read: async () => ({ ...manageFixture(), anchor: { ...manageFixture().anchor, ...chosen }, applied: true }),
    runtime: async () => ({ available: true, hook: true, applied: rows.map(row => row.patch_id), stack: rows }) }), review: r };
  const reply = { result: 'loaded', order: ['base', 'chosen'], loaded: ['chosen'], aliases: { base: 'existing-alias' }, stack: rows };
  const before = [record('existing-alias', 'base-bytes')];
  assert.deepEqual(await confirmRuntimeKnowledge(chosen, 'load', true, before, reply, d), { order: ['base', 'chosen'], already: false, alias: null, reviewed: true });
  await assert.rejects(confirmRuntimeKnowledge(chosen, 'load', true, before, { ...reply, aliases: {} }, d), /unconfirmed/);
});
test('review, submission and completion carry the same expanded plan through the full mocked flow', async () => {
  const review = chain(), selected = { ...target(), ...review.order[1].anchor };
  const before = review.before.map((row, i) => record(row.patch_id, row.sha256, i));
  const after = review.after.map((row, i) => record(row.patch_id, row.sha256, i));
  let written = false, calls = 0;
  const d = deps({ read: async () => ({ ...manageFixture(), anchor: selected, applied: written }),
    runtime: async () => { const stack = written ? after : before; return { available: true, hook: true, applied: stack.map(row => row.patch_id), stack }; } });
  const reviewed = await reviewRuntimeKnowledge(selected, { ...d, preview: async () => review });
  assert.ok(reviewed); assert.equal(written, false);
  const result = await changeRuntimeKnowledge(selected, 'load', true, { ...d, review: reviewed,
    write: async records => {
      calls++;
      const op = prepareRuntimeOperation('owner', selected, 'load', true, records,
        { instance: review.instance, server_time: 1_800_000_000_000, request_window_ms: 600_000, apply_preview: true }, 'b'.repeat(32), reviewed);
      assert.equal(runtimeOperationRequest(op).body.expected_preview, review.revision);
      assert.deepEqual(op.review, review); written = true;
      return { result: 'loaded', order: ['base', 'chosen'], loaded: ['chosen'], aliases: { base: 'existing-alias' }, stack: after };
    } });
  assert.equal(calls, 1); assert.equal(result?.reviewed, true); assert.equal(result?.alias, null);
});
