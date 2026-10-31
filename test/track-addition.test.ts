import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTrackAddition, reviewTrackAddition, confirmTrackAddition } from '../src/lib/trackAddition';
import { additionFixture, additionNode, additionSubject } from './track-addition-fixture';

function fixture() {
  const review = additionFixture(); let active = true; const writes: unknown[][] = [];
  let branch = structuredClone(review.branch);
  const deps = { node: additionNode, subject: additionSubject, current: () => active,
    readAccess: async () => ({ signedIn: true, isOwner: true, address: additionNode, subject: additionSubject }),
    review: async (_name: string, _id: string): Promise<unknown> => ({ review }),
    write: async (...args: [string, string, string]): Promise<unknown> => { writes.push(args); branch = { ...branch, patch_ids: [...branch.patch_ids, review.item.id] }; return { branch }; },
    readBranches: async (): Promise<unknown> => ({ branches: [{ ...branch, current: [review.item.id], subscribers: [] }], mine: [] }),
  };
  return { review, deps, writes, leave: () => { active = false; } };
}
test('addition review matches exact node, selected track and artifact and returns an independent snapshot', () => {
  const f = fixture(), parse = (r: unknown) => parseTrackAddition({ review: r }, f.review.branch.name, f.review.item.id, additionNode);
  const result = parse(f.review)!; assert.ok(result); f.review.item.name = 'changed'; assert.equal(result.item.name, 'Selected knowledge');
  for (const altered of [{ ...result, node: additionSubject }, { ...result, already: true }, { ...result, replaces: ['missing'] },
    { ...result, item: { ...result.item, id: 'other' } }, { ...result, item: { ...result.item, status: 'RETIRED' } },
    { ...result, branch: { ...result.branch, owner: additionSubject } }, { ...result, branch: { ...result.branch, archived: true } }]) assert.equal(parse(altered), null);
});
test('addition review is read-only and current access is required', async () => {
  const f = fixture(); assert.ok(await reviewTrackAddition(f.review.branch.name, f.review.item.id, f.deps)); assert.equal(f.writes.length, 0);
  f.deps.readAccess = async () => ({ signedIn: true, isOwner: false, address: additionNode, subject: additionSubject });
  await assert.rejects(reviewTrackAddition(f.review.branch.name, f.review.item.id, f.deps), /access/);
});
test('confirmation sends the exact revision and verifies the preserved track and new item', async () => {
  const f = fixture(); assert.deepEqual(await confirmTrackAddition(f.review, f.deps), { already: false, name: 'law/KR', id: f.review.item.id });
  assert.deepEqual(f.writes, [['law/KR', f.review.item.id, 'a'.repeat(64)]]);
});
test('changed revision or content refuses before any write', async () => {
  for (const field of ['revision', 'price', 'context']) {
    const f = fixture(), changed = structuredClone(f.review);
    if (field === 'revision') changed.revision = 'b'.repeat(64);
    else if (field === 'price') changed.item.price = '9';
    else changed.branch.context.region = 'US';
    f.deps.review = async () => ({ review: changed });
    await assert.rejects(confirmTrackAddition(f.review, f.deps), /changed/); assert.equal(f.writes.length, 0);
  }
});
test('already-present knowledge never submits another public record', async () => {
  const f = fixture(); f.review.branch.patch_ids.push(f.review.item.id); f.review.already = true; f.review.replaces = [];
  assert.equal((await confirmTrackAddition(f.review, f.deps))?.already, true); assert.equal(f.writes.length, 0);
});
test('different receipt or missing fresh record cannot produce success', async () => {
  const f = fixture(); f.deps.write = async () => ({ branch: { ...f.review.branch, patch_ids: [f.review.item.id] } });
  await assert.rejects(confirmTrackAddition(f.review, f.deps), /unconfirmed/);
  const g = fixture(); g.deps.readBranches = async () => ({ branches: [], mine: [] });
  await assert.rejects(confirmTrackAddition(g.review, g.deps), /unconfirmed/); assert.equal(g.writes.length, 1);
});
test('departure and a lost response never trigger another write', async () => {
  const f = fixture(); f.deps.review = async () => { f.leave(); return { review: f.review }; };
  assert.equal(await confirmTrackAddition(f.review, f.deps), null); assert.equal(f.writes.length, 0);
  const g = fixture(); let attempts = 0; g.deps.write = async () => { attempts++; throw new Error('lost'); };
  await assert.rejects(confirmTrackAddition(g.review, g.deps), /unconfirmed/); assert.equal(attempts, 1);
});
test('explicit server refusals remain distinct from lost or unknown outcomes', async () => {
  for (const [error, code] of [[{ status: 403 }, 'access'],
    [{ status: 409, data: { error: 'track_action_busy: running' } }, 'busy'],
    [{ status: 409, data: { error: 'track_review_changed: different' } }, 'changed'],
    [{ status: 503, data: { error: 'unknown' } }, 'unconfirmed']] as const) {
    const f = fixture(); f.deps.write = async () => { throw error; };
    await assert.rejects(confirmTrackAddition(f.review, f.deps), new RegExp(code));
  }
});
