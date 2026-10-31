import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeManagedPrice, retireManagedKnowledge, deleteManagedDraft, ManageLifecycleError } from '../src/lib/manageLifecycle';
import { createNodeActionTask } from '../src/lib/accountNodeActions';
import { manageFixture } from './fixtures/manageKnowledge';

const published = () => ({ ...manageFixture(), status: 'VERIFIED' as const, sellable: true });
const subject = '0x' + 'bb'.repeat(20);
const access = { signedIn: true, isOwner: true, subject };
const code = (expected: string) => (e: unknown) => e instanceof ManageLifecycleError && e.code === expected;
const noWrite = async () => { assert.fail('no mutation expected'); };

test('price changes confirm the actual target, previous amount and currency before fresh-read success', async () => {
  const expected = published(); let saved = expected, writes = 0;
  const result = await changeManagedPrice(expected, ' 2.50 ', ' Launch ', { current: () => true, read: async () => saved, write: async (price, reason) => {
    writes++; assert.equal(price, '2.50'); assert.equal(reason, 'Launch'); saved = { ...expected, anchor: { ...expected.anchor, price } };
    return { ok: true, patch_id: expected.anchor.id, price, previous: '1', currency: 'AIN', created_at: 10 };
  } });
  assert.equal(result?.detail.anchor.price, '2.50'); assert.equal(result?.already, false); assert.equal(writes, 1);
  const retry = await changeManagedPrice(expected, '2.50', '', { current: () => true, read: async () => saved, write: noWrite });
  assert.equal(retry?.already, true);
});

test('a price edit cannot cross a changed price, artifact, currency or unavailable state', async () => {
  const p = published();
  for (const [fresh, expected] of [
    [{ ...p, anchor: { ...p.anchor, price: '4' } }, 'changed'],
    [{ ...p, anchor: { ...p.anchor, patch_sha256: 'other-file' } }, 'changed'],
    [{ ...p, anchor: { ...p.anchor, currency: 'USDC' } }, 'changed'],
    [{ ...p, status: 'DRAFT' }, 'state'], [{ ...p, status: 'RETIRED', retired_at: 10 }, 'state'], [{ ...p, owned: false }, 'read'],
  ] as const) await assert.rejects(changeManagedPrice(p, '2', '', { current: () => true, read: async () => fresh, write: noWrite }), code(expected));
  await assert.rejects(changeManagedPrice(p, '-1', '', { current: () => true, read: async () => p, write: noWrite }), code('price'));
  await assert.rejects(changeManagedPrice(p, '2', 'a'.repeat(501), { current: () => true, read: async () => p, write: noWrite }), code('reason'));
});

test('price acknowledgements and unavailable or reverted follow-up reads never report confirmed success', async () => {
  const p = published(), good = { ok: true, patch_id: p.anchor.id, price: '2', previous: '1', currency: 'AIN', created_at: 10 };
  for (const reply of [{ ...good, patch_id: 'other' }, { ...good, price: '3' }, { ...good, previous: '0' }, { ...good, currency: 'USDC' }, { ...good, ok: false }, { ...good, created_at: null }]) {
    await assert.rejects(changeManagedPrice(p, '2', '', { current: () => true, read: async () => p, write: async () => reply }), code('unconfirmed'));
  }
  for (const after of [p, { ...p, anchor: { ...p.anchor, price: '2' }, status: 'RETIRED' }, null]) {
    let reads = 0;
    await assert.rejects(changeManagedPrice(p, '2', '', { current: () => true, read: async () => reads++ ? after : p, write: async () => good }), code('unconfirmed'));
  }
});

test('retirement confirms typed id, reason, timestamp and an actually non-sellable retired record', async () => {
  const p = published(); let saved: any = p; let writes = 0;
  const result = await retireManagedKnowledge(p, ' chosen ', ' Outdated ', { current: () => true, read: async () => saved, write: async reason => {
    writes++; assert.equal(reason, 'Outdated'); saved = { ...p, status: 'RETIRED', sellable: false, retired_at: 20, retire_reason: reason };
    return { ok: true, patch_id: p.anchor.id, retired_at: 20, reason };
  } });
  assert.equal(result?.already, false); assert.equal(writes, 1);
  assert.equal((await retireManagedKnowledge(p, 'chosen', 'Another reason', { current: () => true, read: async () => saved, write: noWrite }))?.already, true);
  await assert.rejects(retireManagedKnowledge(p, 'other', '', { current: () => true, read: async () => p, write: noWrite }), code('confirm'));
});

test('retirement rejects wrong acknowledgements, missing evidence and a still-sellable state', async () => {
  const p = published(), good = { ok: true, patch_id: p.anchor.id, retired_at: 20, reason: 'Outdated' };
  for (const reply of [{ ...good, patch_id: 'other' }, { ...good, reason: 'Other reason' }, { ...good, retired_at: -1 }, { ...good, ok: false }]) {
    await assert.rejects(retireManagedKnowledge(p, 'chosen', 'Outdated', { current: () => true, read: async () => p, write: async () => reply }), code('unconfirmed'));
  }
  for (const after of [p, { ...p, status: 'RETIRED', sellable: true, retired_at: 20, retire_reason: 'Outdated' }, { ...p, status: 'RETIRED', sellable: false, retired_at: 21, retire_reason: 'Outdated' }]) {
    let reads = 0;
    await assert.rejects(retireManagedKnowledge(p, 'chosen', 'Outdated', { current: () => true, read: async () => reads++ ? after : p, write: async () => good }), code('unconfirmed'));
  }
});

test('draft deletion needs the reviewed anchor, a successful response, 404 and the same operator access', async () => {
  const p = manageFixture(); let reads = 0, accessReads = 0;
  const result = await deleteManagedDraft(p, subject, { current: () => true, read: async () => { if (reads++) throw { status: 404 }; return p; }, write: async () => ({ ok: true }), readAccess: async () => { accessReads++; return access; } });
  assert.deepEqual(result, { deleted: true }); assert.equal(accessReads, 1);
  await assert.rejects(deleteManagedDraft(p, subject, { current: () => true, read: async () => ({ ...p, anchor: { ...p.anchor, description: 'Changed after review' } }), write: noWrite, readAccess: async () => access }), code('changed'));
  await assert.rejects(deleteManagedDraft(p, subject, { current: () => true, read: async () => published(), write: noWrite, readAccess: async () => access }), code('state'));
});

test('deletion does not confuse cached items, access failures or malformed acknowledgements with absence', async () => {
  const p = manageFixture();
  for (const outcome of ['present', 401, 403, 503, 'parse']) {
    let reads = 0;
    await assert.rejects(deleteManagedDraft(p, subject, { current: () => true, read: async () => {
      if (!reads++ || outcome === 'present') return p; throw { status: outcome === 'parse' ? 'PARSING_ERROR' : outcome, originalStatus: 404 };
    }, write: async () => ({ ok: true }), readAccess: async () => { assert.fail('absence unconfirmed'); } }), code('unconfirmed'));
  }
  await assert.rejects(deleteManagedDraft(p, subject, { current: () => true, read: async () => p, write: async () => ({}), readAccess: async () => access }), code('unconfirmed'));
  for (const who of [{ ...access, signedIn: false }, { ...access, isOwner: false }, { ...access, subject: '0x' + 'cc'.repeat(20) }, {}]) {
    let reads = 0;
    await assert.rejects(deleteManagedDraft(p, subject, { current: () => true, read: async () => { if (reads++) throw { status: 404 }; return p; }, write: async () => ({ ok: true }), readAccess: async () => who }), code('access'));
  }
});

test('departed views never start a lifecycle write or report a late completion', async () => {
  const p = published(); let active = true;
  assert.equal(await changeManagedPrice(p, '2', '', { current: () => active, read: async () => { active = false; return p; }, write: noWrite }), null);
  active = true;
  assert.equal(await retireManagedKnowledge(p, 'chosen', 'Outdated', { current: () => active, read: async () => p, write: async () => { active = false; return {}; } }), null);
  active = true; let reads = 0;
  assert.equal(await deleteManagedDraft(manageFixture(), subject, { current: () => active, read: async () => { if (reads++) { active = false; throw { status: 404 }; } return manageFixture(); }, write: async () => ({ ok: true }), readAccess: async () => { assert.fail('departed access check'); } }), null);
});

test('the shared management task blocks overlapping lifecycle buttons through confirmation reads', async () => {
  const p = published(), task = createNodeActionTask(); let finish!: (value: unknown) => void, writes = 0;
  const first = task.run(() => true, current => changeManagedPrice(p, '2', '', { current, read: async () => p, write: () => { writes++; return new Promise(resolve => { finish = resolve; }); } }));
  await Promise.resolve(); await Promise.resolve();
  assert.equal(await task.run(() => true, async () => { writes++; return true; }), null);
  finish({}); await assert.rejects(first, code('unconfirmed')); assert.equal(writes, 1); assert.equal(task.pending(), false);
});
