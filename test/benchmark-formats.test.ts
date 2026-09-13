import assert from 'node:assert/strict';
import test from 'node:test';
import { benchmarkFormats } from '../src/utils/format';

test('legacy string benchmark formats do not crash catalogue and detail rendering', () => {
  assert.equal(benchmarkFormats('template/chat').join(' + '), 'template/chat');
  assert.deepEqual(benchmarkFormats(['chat', 'natural']), ['chat', 'natural']);
  assert.deepEqual(benchmarkFormats(undefined), []);
  assert.deepEqual(benchmarkFormats([null, 3, 'chat']), ['chat']);
});
