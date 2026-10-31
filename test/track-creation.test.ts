import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrack, trackCreationInput } from '../src/lib/trackCreation';

const node = `0x${'1'.repeat(40)}`, subject = `0x${'2'.repeat(40)}`;
const input = () => trackCreationInput(' new/track ', ' Description ', [{ k: ' region ', v: ' KR ' }], []);
function fixture() {
  const value = input(), row = { ...value, owner: node, created_at: 12, current: [], subscribers: [] };
  let written = false, active = true, writes = 0;
  const deps = {
    node, subject, current: () => active,
    readAccess: async () => ({ signedIn: true, isOwner: true, address: node, subject }),
    readBranches: async (): Promise<unknown> => ({ branches: written ? [row] : [], mine: [] }),
    readInventory: async (): Promise<unknown> => ({ items: [] }),
    write: async (_input: unknown): Promise<unknown> => { written = true; writes++; return { branch: row }; },
  };
  return { deps, value, row, writes: () => writes, leave: () => { active = false; } };
}
test('creation normalizes input without overwriting duplicate context or selected ids', () => {
  assert.deepEqual(input(), { name: 'new/track', description: 'Description', context: { region: 'KR' }, patch_ids: [] });
  assert.throws(() => trackCreationInput('x', '', [], []), /name/);
  assert.throws(() => trackCreationInput('track', '', [{ k: 'x', v: 'a' }, { k: ' x ', v: 'b' }], []), /context/);
  assert.throws(() => trackCreationInput('track', '', [{ k: '', v: 'lost' }], []), /context/);
  assert.throws(() => trackCreationInput('track', '', [], ['id', 'id']), /changed/);
  const proto = trackCreationInput('track', '', [{ k: '__proto__', v: 'literal value' }], []);
  assert.equal(Object.hasOwn(proto.context, '__proto__'), true);
});
test('creation confirms the exact receipt and fresh current branch before success', async () => {
  const f = fixture(); assert.equal(await createTrack(f.value, f.deps), 'new/track'); assert.equal(f.writes(), 1);
});
test('existing names, failed inventory and revoked operator access refuse before write', async () => {
  const f = fixture(); f.deps.readBranches = async () => ({ branches: [f.row], mine: [] });
  await assert.rejects(createTrack(f.value, f.deps), /exists/); assert.equal(f.writes(), 0);
  const g = fixture(); g.value.patch_ids = ['gone'];
  await assert.rejects(createTrack(g.value, g.deps), /changed/); assert.equal(g.writes(), 0);
  const h = fixture(); h.deps.readAccess = async () => ({ signedIn: true, isOwner: false, address: node, subject });
  await assert.rejects(createTrack(h.value, h.deps), /access/); assert.equal(h.writes(), 0);
});
test('mismatched receipts and fresh records remain unconfirmed', async () => {
  const f = fixture(); f.deps.write = async () => ({ branch: { ...f.row, name: 'other' } });
  await assert.rejects(createTrack(f.value, f.deps), /unconfirmed/);
  const g = fixture(); const write = g.deps.write; g.deps.write = async value => { const result = await write(value); g.deps.readBranches = async () => ({ branches: [{ ...g.row, description: 'other' }], mine: [] }); return result; };
  await assert.rejects(createTrack(g.value, g.deps), /unconfirmed/);
});
test('departure before submission cancels; departure after submission suppresses the result', async () => {
  const f = fixture(); f.deps.readBranches = async () => { f.leave(); return { branches: [], mine: [] }; };
  assert.equal(await createTrack(f.value, f.deps), null); assert.equal(f.writes(), 0);
  const g = fixture(); const write = g.deps.write; g.deps.write = async value => { g.leave(); return write(value); };
  assert.equal(await createTrack(g.value, g.deps), null); assert.equal(g.writes(), 1);
});
test('lost response is not retried and leaves caller input intact', async () => {
  const f = fixture(); let attempts = 0;
  f.deps.write = async value => { attempts++; (value as any).name = 'transport mutated'; throw new Error('lost'); };
  await assert.rejects(createTrack(f.value, f.deps), /unconfirmed/);
  assert.equal(attempts, 1); assert.equal(f.value.name, 'new/track');
});
