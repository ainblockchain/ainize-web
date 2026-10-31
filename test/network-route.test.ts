import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNetworkRouteTask, networkRouteView, nodeApiUrl, routeCurlCommand, routeInput, type RouteState } from '../src/lib/networkRoute';
import { matchedRoute, unmatchedRoute, routeCondition } from './fixtures/networkRoute';
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (error: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('routing requires a real condition and keeps reserved options out of the attribute request', () => {
  assert.deepEqual(routeInput(' jurisdiction ', ' KR '), routeCondition);
  for (const [key, value] of [['', 'KR'], ['jurisdiction', ' '], [' partial ', 'true']]) assert.equal(routeInput(key, value), null);
  assert.equal(nodeApiUrl('https://node.example/base/', 'info'), 'https://node.example/base/api/info');
  for (const endpoint of ['javascript:alert(1)', 'https://user:secret@node.example', '/relative', 'https://node.example?path=other']) assert.equal(nodeApiUrl(endpoint, 'info'), null);
  const command = routeCurlCommand('https://node.example/base/', { key: 'a & b', value: 'x$(echo wrong)?' });
  assert.equal(command, "curl 'https://node.example/base/api/route?a+%26+b=x%24%28echo+wrong%29%3F'");
  assert.equal(routeCurlCommand('https://node.example', null), null);
});

test('routing only accepts matching conditions and coherent node records, never a malformed empty answer', () => {
  assert.ok(networkRouteView(matchedRoute(), routeCondition));
  assert.ok(networkRouteView(unmatchedRoute(), routeCondition));
  const wrong = matchedRoute(); wrong.branch!.context.jurisdiction = 'US';
  const inconsistent = matchedRoute(); inconsistent.nodes[0].missing = ['chosen/id'];
  for (const result of [{}, { ...unmatchedRoute(), unmatched: [] }, wrong, inconsistent, { ...matchedRoute(), candidates: [{}] }, { ...matchedRoute(), nodes: [{}] }]) {
    assert.equal(networkRouteView(result, routeCondition), null);
  }
});

test('a pending routing lookup suppresses duplicate submits and clears prior results before retry', async () => {
  const task = createNetworkRouteTask(), read = deferred(), states: RouteState[] = [];
  let calls = 0;
  const request = (context: Record<string, string>) => { calls++; assert.deepEqual(context, { jurisdiction: 'KR' }); return { unwrap: () => read.promise, abort() {} }; };
  const run = task.run(routeCondition, request, () => true, state => states.push(state));
  await task.run(routeCondition, request, () => true, state => states.push(state));
  assert.equal(calls, 1); assert.deepEqual(states, [{ phase: 'loading' }]);
  read.resolve(matchedRoute()); await run;
  assert.equal(states.at(-1)?.phase, 'ready');
  const next = deferred();
  const retry = task.run(routeCondition, () => ({ unwrap: () => next.promise, abort() {} }), () => true, state => states.push(state));
  assert.equal(states.at(-1)?.phase, 'loading');
  next.reject(new Error('offline')); await retry;
  assert.equal(states.at(-1)?.phase, 'error');
});

test('edited or departed routing tasks ignore late success and failure, even after returning to the same input', async () => {
  for (const failure of [false, true]) {
    const old = createNetworkRouteTask(), read = deferred(), events: RouteState[] = [];
    let aborted = 0;
    const pending = old.run(routeCondition, () => ({ unwrap: () => read.promise, abort() { aborted++; } }), () => true, state => events.push(state));
    old.cancel();
    const fresh = createNetworkRouteTask(), current: RouteState[] = [];
    await fresh.run(routeCondition, () => ({ unwrap: async () => unmatchedRoute(), abort() {} }), () => true, state => current.push(state));
    if (failure) read.reject(new Error('late failure')); else read.resolve(matchedRoute());
    await pending;
    assert.equal(aborted, 1); assert.deepEqual(events, [{ phase: 'loading' }]);
    assert.equal(current.at(-1)?.phase, 'ready');
    assert.equal((current.at(-1) as { data: { branch: unknown } }).data.branch, null);
  }
});

test('a malformed route result fails visibly and can be retried without inventing a match', async () => {
  const task = createNetworkRouteTask(), states: RouteState[] = [];
  await task.run(routeCondition, () => ({ unwrap: async () => ({}), abort() {} }), () => true, state => states.push(state));
  assert.equal(states.at(-1)?.phase, 'error');
  await task.run(routeCondition, () => ({ unwrap: async () => matchedRoute(), abort() {} }), () => true, state => states.push(state));
  assert.deepEqual(states.map(s => s.phase), ['loading', 'error', 'loading', 'ready']);
  let called = false;
  await task.run(routeCondition, () => { called = true; throw new Error('must not request'); }, () => false, () => assert.fail('departed view emitted'));
  assert.equal(called, false);
});
