import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjectEnvWork } from '../src/lib/projectEnvWork';
import { parseSecretSaved, saveSecretsSequentially } from '../src/api/projectSecrets';

test('one environment gate serializes add, remove, bulk and redeploy until the whole operation ends', async () => {
  const gate = createProjectEnvWork();
  let finish!: () => void;
  const first = gate.run(() => new Promise<void>(resolve => { finish = resolve; }));
  assert.equal(gate.blocked(), true);
  assert.equal(await gate.run(async () => assert.fail('overlapping operation must not execute')), undefined);
  finish(); await first;
  assert.equal(gate.blocked(), false);
  assert.equal(await gate.run(async () => 'next explicit edit'), 'next explicit edit');
});

test('a lost reply or malformed receipt locks further writes without treating list metadata as value confirmation', async () => {
  for (const operation of [async () => { throw { status: 'FETCH_ERROR' }; }, async () => { throw { status: 503 }; },
    async () => parseSecretSaved({}, { name: 'TOKEN' })]) {
    const gate = createProjectEnvWork();
    await assert.rejects(gate.run(operation));
    assert.equal(gate.uncertain(), true);
    assert.equal(await gate.run(async () => assert.fail('must not repeat')), undefined);
  }
});

test('an explicit pre-write refusal lets the user correct the same form', async () => {
  const gate = createProjectEnvWork();
  await assert.rejects(gate.run(async () => { throw { status: 400, data: { error: { code: 'reserved_name' } } }; }));
  assert.equal(gate.uncertain(), false); assert.equal(await gate.run(async () => 'corrected'), 'corrected');
});

test('bulk partial success remains visible but an unknown later outcome blocks all further environment mutations', async () => {
  const gate = createProjectEnvWork();
  const result = await gate.run(async () => {
    const r = await saveSecretsSequentially([{ name: 'A', value: 'a' }, { name: 'B', value: 'b' }, { name: 'C', value: 'c' }], async name => {
      if (name === 'B') throw { status: 'FETCH_ERROR' };
      return { name, updatedAt: 1, created: true, redeploy: null };
    });
    if (r.failed) gate.report(r.failed.error);
    return r;
  });
  assert.deepEqual(result?.saved.map(s => s.name), ['A']); assert.equal(result?.failed?.name, 'B');
  assert.equal(gate.uncertain(), true); assert.equal(gate.blocked(), true);
});

test('a disabled secret store is an explicit pre-write refusal, not an ambiguous saved value', async () => {
  const gate = createProjectEnvWork();
  await assert.rejects(gate.run(async () => { throw { status: 503, data: { error: { code: 'secrets_off' } } }; }));
  assert.equal(gate.uncertain(), false); assert.equal(gate.blocked(), false);
});

test('manual redeploy pre-admission refusals leave environment editing available but unknown acceptance locks it', async () => {
  for (const code of ['project_deleting', 'invalid_redeploy_target', 'redeploy_target_changed']) {
    const gate = createProjectEnvWork();
    await assert.rejects(gate.run(async () => { throw { status: 409, data: { error: { code } } }; }));
    assert.equal(gate.blocked(), false);
  }
  const gate = createProjectEnvWork();
  await assert.rejects(gate.run(async () => { throw { status: 500, data: { error: { code: 'redeploy_outcome_unknown' } } }; }));
  assert.equal(gate.uncertain(), true);
});


test('a server-confirmed partial environment operation locks writes even when the later deployment was refused', async () => {
  const gate = createProjectEnvWork();
  await assert.rejects(gate.run(async () => { throw { status: 500, data: { error: { code: 'secret_mutation_outcome_unknown' } } }; }));
  assert.equal(gate.uncertain(), true);
  assert.equal(await gate.run(async () => assert.fail('do not repeat a partially saved operation')), undefined);
});
