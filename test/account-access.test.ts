import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccessActionError, accountBindings, accountOwners, changeAccountOwner, endAccountBinding, ownerRemovalReason, sameAccountAddress } from '../src/lib/accountAccess';

const node = '0x' + 'aa'.repeat(20), actor = '0x' + 'bb'.repeat(20), target = '0x' + 'cc'.repeat(20), other = '0x' + 'dd'.repeat(20);
const owner = (address: string, source = 'granted'): any => ({ address, source, added_at: source === 'granted' ? 1 : null, added_by: source === 'granted' ? node : null, note: null });
const owners = (extra: any[] = []) => ({ owners: [owner(node, 'node'), ...extra] });
const binding = (delegate = target, owner = actor): any => ({ delegate, owner, label: 'Selected terminal', created_at: 1, last_seen_at: null });
const bindings = (rows = [binding()], via: string | null = null) => ({ bindings: rows, via });

test('access reads reject malformed, duplicate and foreign records while matching addresses case-insensitively', () => {
  assert.ok(accountOwners(owners())); assert.equal(accountOwners({ owners: [] }), null);
  assert.equal(accountOwners(owners([owner(node.toUpperCase().replace('0X', '0x'))])), null);
  assert.equal(accountOwners(owners([{ ...owner(target), source: 'unexpected' }])), null);
  assert.equal(sameAccountAddress(42, actor), false);
  assert.ok(accountBindings(bindings([binding()], target.toUpperCase().replace('0X', '0x')), actor));
  for (const raw of [bindings([binding(target, other)]), bindings([binding(), binding()]), bindings([binding()], other), { bindings: [{}], via: null }, { bindings: [], via: 'invalid' }]) assert.equal(accountBindings(raw, actor), null);
  assert.equal(accountBindings(bindings(), null), null);
  assert.equal(ownerRemovalReason(owner(actor), actor.toUpperCase().replace('0X', '0x')), 'self');
  assert.equal(ownerRemovalReason(owner(target, 'config'), actor), 'protected');
  assert.equal(ownerRemovalReason(owner(target), null), 'unknown_actor');
});

test('grant keeps the exact submitted address and confirms membership before reporting completion', async () => {
  await assert.rejects(changeAccountOwner('add', target.toUpperCase(), actor, { current: () => true, read: async () => { assert.fail('invalid prefix must not read'); }, write: async () => { assert.fail('invalid prefix must not write'); } }), e => e instanceof AccessActionError && e.code === 'address');
  let reads = 0; const written: string[] = [];
  const result = await changeAccountOwner('add', target, actor, { current: () => true, read: async () => owners(reads++ ? [owner(target)] : []), write: async address => { written.push(address); return { ...owners([owner(target)]), address, ok: true, already: false }; } });
  assert.deepEqual(written, [target]); assert.deepEqual(result, { address: target, already: false, ended: 0 });
  assert.deepEqual(await changeAccountOwner('add', target, actor, { current: () => true, read: async () => owners([owner(target, 'config')]), write: async () => { assert.fail('already owned'); } }), { address: target, already: true, ended: 0 });
});

test('protected, self, missing and no-longer-granted owners cannot reach a revoke write', async () => {
  for (const [selected, rows, code] of [[node, [], 'protected'], [actor, [owner(actor)], 'self'], [target, [], 'missing'], [target, [owner(target, 'config')], 'protected']] as const) {
    await assert.rejects(changeAccountOwner('remove', selected, actor, { current: () => true, read: async () => owners([...rows]), write: async () => { assert.fail('must not revoke'); } }), e => e instanceof AccessActionError && e.code === code);
  }
});

test('revocation needs a matching target, session count, returned list and confirmed absence', async () => {
  const success = { ...owners(), ok: true, address: target, sessions_ended: 2 };
  let reads = 0;
  assert.deepEqual(await changeAccountOwner('remove', target, actor, { current: () => true, read: async () => owners(reads++ ? [] : [owner(target)]), write: async () => success }), { address: target, already: false, ended: 2 });
  for (const response of [{ ...success, address: other }, { ...success, ok: false }, { ...success, sessions_ended: -1 }, { ...success, ...owners([owner(target)]) }]) {
    await assert.rejects(changeAccountOwner('remove', target, actor, { current: () => true, read: async () => owners([owner(target)]), write: async () => response }), e => e instanceof AccessActionError && e.code === 'unconfirmed');
  }
  await assert.rejects(changeAccountOwner('remove', target, actor, { current: () => true, read: async () => owners([owner(target)]), write: async () => success }), e => e instanceof AccessActionError && e.code === 'unconfirmed');
});

test('binding removal verifies the owner and target and rechecks other connections', async () => {
  let reads = 0;
  const result = await endAccountBinding(target, actor, { current: () => true, read: async () => bindings(reads++ ? [] : [binding()]), write: async delegate => ({ ok: true, delegate, sessions_ended: 3, bindings: [] }) });
  assert.deepEqual(result, { delegate: target, ended: 3, self: false }); assert.equal(reads, 2);
  for (const response of [{ ok: true, delegate: other, sessions_ended: 1, bindings: [] }, { ok: true, delegate: target, sessions_ended: 1, bindings: [binding()] }, { ok: true, delegate: target, bindings: [] }]) {
    await assert.rejects(endAccountBinding(target, actor, { current: () => true, read: async () => bindings(), write: async () => response }), e => e instanceof AccessActionError && e.code === 'unconfirmed');
  }
});

test('ending the active binding accepts its exact acknowledgement without requiring the revoked session to read again', async () => {
  let reads = 0;
  const result = await endAccountBinding(target, actor, { current: () => true, read: async () => { reads++; if (reads > 1) throw new Error('revoked session'); return bindings([binding()], target.toUpperCase().replace('0X', '0x')); }, write: async delegate => ({ ok: true, delegate, sessions_ended: 1, bindings: [] }) });
  assert.deepEqual(result, { delegate: target, ended: 1, self: true }); assert.equal(reads, 1);
});

test('departed accounts stop writes and completed changes do not produce stale UI outcomes', async () => {
  let active = true;
  assert.equal(await changeAccountOwner('add', target, actor, { current: () => active, read: async () => { active = false; return owners(); }, write: async () => { assert.fail('departed before grant'); } }), null);
  active = true;
  assert.equal(await endAccountBinding(target, actor, { current: () => active, read: async () => bindings(), write: async delegate => { active = false; return { ok: true, delegate, sessions_ended: 1, bindings: [] }; } }), null);
});
