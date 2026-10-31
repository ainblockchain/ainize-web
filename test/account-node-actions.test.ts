import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountPeers, accountRuntime, askAccountRuntime, changeAccountPeer, createNodeActionTask, NodeActionError, peerEndpoint } from '../src/lib/accountNodeActions';

const nodes = (endpoints: string[]) => ({ self: 'self', nodes: [], peers: endpoints.map(endpoint => ({ endpoint, address: null, info: null, last_seen: 0, failures: 0 })) });
const endpoint = 'https://selected.example/base';
const deferred = () => { let resolve!: (value: unknown) => void; const promise = new Promise<unknown>(yes => { resolve = yes; }); return { promise, resolve }; };

test('peer endpoint validation preserves literal base paths and rejects unusable URL forms', () => {
  assert.equal(peerEndpoint('  https://Selected.example/base/// '), 'https://Selected.example/base');
  for (const value of ['', '/relative', 'ftp://peer.test', 'https://user:pass@peer.test', 'https://peer.test/?q=1', 'https://peer.test/#part', 'https://peer.test/a b', 'https:\\peer.test']) assert.equal(peerEndpoint(value), null);
  assert.ok(accountPeers(nodes([endpoint])));
  assert.equal(accountPeers({ ...nodes([]), peers: [{ info: null, last_seen: 0, failures: 0 }] })?.peers[0].endpoint, null);
  assert.equal(accountPeers(nodes([endpoint, endpoint + '/'])), null);
  assert.equal(accountPeers({ ...nodes([]), peers: [null] }), null);
});

test('peer add verifies the exact endpoint and does not repeat an already-listed addition', async () => {
  const writes: string[] = []; let reads = 0;
  const result = await changeAccountPeer('add', endpoint + '/', { current: () => true, read: async () => nodes(reads++ ? [endpoint] : []), write: async e => { writes.push(e); return { ok: true }; } });
  assert.deepEqual(result, { endpoint, already: false }); assert.deepEqual(writes, [endpoint]);
  const already = await changeAccountPeer('add', endpoint, { current: () => true, read: async () => nodes([endpoint]), write: async () => { assert.fail('must not write'); } });
  assert.deepEqual(already, { endpoint, already: true });
  await assert.rejects(changeAccountPeer('add', endpoint, { current: () => true, read: async () => nodes(['https://other.example']), write: async () => ({ ok: true }) }), e => e instanceof NodeActionError && e.code === 'unconfirmed');
});

test('removal requires a real removal/block acknowledgement and confirms absence of the selected endpoint', async () => {
  let reads = 0;
  assert.deepEqual(await changeAccountPeer('remove', endpoint, { current: () => true, read: async () => nodes(reads++ ? [] : [endpoint]), write: async e => { assert.equal(e, endpoint); return { ok: true, removed: true, blocked: true }; } }), { endpoint, already: false });
  for (const answer of [{ ok: true }, { ok: true, removed: false, blocked: false }, { ok: true, removed: true, blocked: false }]) {
    await assert.rejects(changeAccountPeer('remove', endpoint, { current: () => true, read: async () => nodes([endpoint]), write: async () => answer }), e => e instanceof NodeActionError && e.code === 'unconfirmed');
  }
  await assert.rejects(changeAccountPeer('remove', endpoint, { current: () => true, read: async () => nodes([]), write: async () => { assert.fail('not listed'); } }), e => e instanceof NodeActionError && e.code === 'missing');
});

test('a failed peer read or a departed account cannot turn into a write or successful outcome', async () => {
  await assert.rejects(changeAccountPeer('add', endpoint, { current: () => true, read: async () => ({}), write: async () => { assert.fail('bad read'); } }), e => e instanceof NodeActionError && e.code === 'read');
  let active = true;
  assert.equal(await changeAccountPeer('add', endpoint, { current: () => active, read: async () => { active = false; return nodes([]); }, write: async () => { assert.fail('departed'); } }), null);
  active = true;
  assert.equal(await changeAccountPeer('add', endpoint, { current: () => active, read: async () => nodes([]), write: async () => { active = false; return { ok: true }; } }), null);
});

test('model output remains attached to its submitted prompt even if the input changes while waiting', async () => {
  const pending = deferred(); let input = 'Original question'; let submitted: unknown;
  const work = askAccountRuntime(input, { current: () => true, send: body => { submitted = body; return pending.promise; } });
  input = 'New question'; pending.resolve({ text: 'Answer to original' });
  assert.deepEqual(submitted, { prompt: 'Original question', max_tokens: 16 });
  assert.deepEqual(await work, { prompt: 'Original question', text: 'Answer to original' });
  for (const response of [null, {}, { text: {} }]) await assert.rejects(askAccountRuntime(input, { current: () => true, send: async () => response }), e => e instanceof NodeActionError && e.code === 'response');
  assert.deepEqual(await askAccountRuntime(input, { current: () => true, send: async () => ({ text: '' }) }), { prompt: input, text: '' });
});

test('node action single flight and context departure suppress duplicate and late results', async () => {
  const task = createNodeActionTask(), pending = deferred(); let calls = 0;
  const first = task.run(() => true, async () => { calls++; return pending.promise; });
  assert.equal(await task.run(() => true, async () => { calls++; return 'duplicate'; }), null); assert.equal(calls, 1);
  task.abandon(); pending.resolve('old context'); assert.equal(await first, null);
  assert.equal(await task.run(() => true, async () => 'new context'), 'new context');
  assert.equal(task.pending(), false);
});

test('runtime status validates displayed fields and never interprets an invalid list as no applied knowledge', () => {
  const valid = { available: true, hook: false, model: 'selected', api: null, applied: [] };
  assert.ok(accountRuntime(valid));
  for (const patch of [{ available: 'yes' }, { hook: null }, { applied: null }, { applied: [{}] }, { model: {} }]) assert.equal(accountRuntime({ ...valid, ...patch }), null);
});
