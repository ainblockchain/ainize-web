import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentActionScope, type AgentAction } from '../src/lib/agentActionScope';
const actions: AgentAction[] = ['alias', 'sharing', 'delete', 'unlink'];

test('one management operation owns the page synchronously, before any rendering or preflight finishes', () => {
  for (const chosen of actions) {
    const scope = createAgentActionScope(), lease = scope.begin(chosen, 'selected'); assert.ok(lease);
    for (const action of actions) {
      assert.equal(scope.canStart(action, 'selected'), false);
      assert.equal(scope.begin(action, 'selected'), null);
      assert.equal(scope.begin(action, 'different'), null, 'a refreshed target cannot bypass the in-flight operation');
    }
    assert.deepEqual(scope.snapshot(), { action: chosen, id: 'selected', phase: 'pending' });
    lease.finish(null); assert.equal(scope.snapshot(), null); assert.ok(scope.begin('sharing', 'selected'));
  }
});
test('unknown outcomes survive catalogue subscriber unmount/remount and block every management write', () => {
  const scope = createAgentActionScope(); let oldUpdates = 0, newUpdates = 0;
  const unmount = scope.subscribe(() => { oldUpdates++; });
  const lease = scope.begin('alias', 'original')!; unmount();
  const remount = scope.subscribe(() => { newUpdates++; });
  lease.finish('unconfirmed');
  assert.equal(oldUpdates, 1); assert.equal(newUpdates, 1);
  for (const action of actions) assert.equal(scope.begin(action, 'original'), null);
  assert.deepEqual(scope.snapshot(), { action: 'alias', id: 'original', phase: 'unconfirmed' });
  remount(); assert.equal(scope.blocked(), true);
});
test('delayed duplicate completion cannot unlock or relabel newer work', () => {
  const scope = createAgentActionScope(), old = scope.begin('sharing', 'first')!;
  old.finish('complete'); assert.equal(scope.blocked(), false);
  const current = scope.begin('unlink', 'second')!; old.finish(null); old.finish('unconfirmed');
  assert.deepEqual(scope.snapshot(), { action: 'unlink', id: 'second', phase: 'pending' });
  current.finish('unconfirmed'); old.finish('complete'); assert.equal(scope.blocked(), true);
});
test('known partial cleanup only allows the same deletion to resume, never alias/sharing or another target', () => {
  const scope = createAgentActionScope(); scope.begin('delete', 'selected')!.finish('cleanup');
  assert.equal(scope.canStart('delete', 'selected'), true);
  for (const action of ['alias', 'sharing', 'unlink'] as const) assert.equal(scope.begin(action, 'selected'), null);
  assert.equal(scope.begin('delete', 'different'), null);
  const resumed = scope.begin('delete', 'selected')!; assert.ok(resumed); assert.equal(scope.canStart('delete', 'selected'), false);
  resumed.finish('complete'); assert.equal(scope.blocked(), false);
});
test('separate account/resource page scopes cannot receive one another’s late feedback', () => {
  const departed = createAgentActionScope(), current = createAgentActionScope();
  const prior = departed.begin('delete', 'same-id')!; current.begin('alias', 'same-id');
  prior.finish('unconfirmed');
  assert.deepEqual(current.snapshot(), { action: 'alias', id: 'same-id', phase: 'pending' });
  assert.equal(departed.snapshot()?.phase, 'unconfirmed');
  assert.equal(createAgentActionScope().snapshot(), null, 'this is page-local, not a durable operation journal');
});
