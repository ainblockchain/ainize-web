import test from 'node:test';
import assert from 'node:assert/strict';
import { agentDeletionRequest, agentDeletionComplete, createHostedAgentDeletion } from '../src/lib/hostedAgentDeletion';
const target = { id: 'agent', name: 'Agent', owner: 'alice' };
const fresh = { agent: { ...target, version: 3, can_delete: true } };
const receipt = { deleted: target.id, cleanup: 'complete' };
const active = () => true;

test('delete requires an exact freshly authorized agent and pins its version and owner', () => {
  assert.deepEqual(agentDeletionRequest(fresh, target), { id: target.id, expected: { name: target.name, owner: target.owner, version: 3 } });
  for (const change of [{ id: 'other' }, { name: 'Other' }, { owner: 'bob' }, { can_delete: false }, { can_delete: undefined }, { version: 0 }, { version: '3' }])
    assert.equal(agentDeletionRequest({ agent: { ...fresh.agent, ...change } }, target), null);
});
test('success requires the exact completed cleanup receipt, including a valid archive reference when present', () => {
  assert.equal(agentDeletionComplete(receipt, target.id), true);
  for (const raw of [null, [], {}, { deleted: target.id }, { ...receipt, deleted: 'other' }, { ...receipt, cleanup: 'pending' }, { ...receipt, archiveId: '' }])
    assert.equal(agentDeletionComplete(raw, target.id), false);
});
test('fresh-read failure or changed identity sends nothing and permits a corrected attempt', async () => {
  const gate = createHostedAgentDeletion(), send = async () => assert.fail('must not send');
  await assert.rejects(gate.run(target, { read: async () => ({}), send, active }), /changed/);
  await assert.rejects(gate.run(target, { read: async () => { throw new Error('offline'); }, send, active }), /offline/);
  assert.equal(gate.blocked(), false); assert.equal(gate.started(), false);
});
test('one synchronous gate covers both preflight and dispatch and departure cannot send or navigate', async () => {
  let resolve!: (v: unknown) => void, alive = true;
  const gate = createHostedAgentDeletion();
  const first = gate.run(target, { read: () => new Promise(r => { resolve = r; }), send: async () => assert.fail('departed'), active: () => alive });
  assert.equal(await gate.run(target, { read: async () => assert.fail('overlap'), send: async () => receipt, active }), false);
  alive = false; resolve(fresh); assert.equal(await first, false);
});
test('malformed acknowledgments and lost responses lock repeat deletion; explicit pending cleanup can resume', async () => {
  for (const send of [async () => ({}), async () => ({ ...receipt, deleted: 'other' }), async () => { throw new Error('lost'); }]) {
    const gate = createHostedAgentDeletion(); await assert.rejects(gate.run(target, { read: async () => fresh, send, active }));
    assert.equal(gate.uncertain(), true); assert.equal(gate.started(), true);
    assert.equal(await gate.run(target, { read: async () => assert.fail('unknown repeated'), send, active }), false);
  }
  const gate = createHostedAgentDeletion();
  await assert.rejects(gate.run(target, { read: async () => fresh, send: async () => { throw { status: 502, data: { error: { code: 'agent_cleanup_pending' } } }; }, active }));
  assert.equal(gate.blocked(), false); assert.equal(gate.started(), true);
  assert.equal(await gate.run(target, { read: async () => fresh, send: async () => receipt, active }), true);
});
test('atomic stale-target refusal permits reviewing again without claiming deletion started', async () => {
  const gate = createHostedAgentDeletion();
  await assert.rejects(gate.run(target, { read: async () => fresh, send: async () => { throw { status: 409, data: { error: { code: 'agent_changed' } } }; }, active }));
  assert.equal(gate.blocked(), false); assert.equal(gate.started(), false);
});


test('confirmed deletion remains known to the parent after the owner panel departs', async () => {
  const gate = createHostedAgentDeletion(); let current = true;
  const done = await gate.run(target, { read: async () => fresh, send: async () => { current = false; return { deleted: target.id, cleanup: 'complete' }; }, active: () => current });
  assert.equal(done, false, 'do not navigate a departed panel'); assert.equal(gate.confirmed(), true); assert.equal(gate.uncertain(), false);
});
