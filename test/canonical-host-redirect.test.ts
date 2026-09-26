import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalHostRedirect } from '../src/lib/canonicalHostRedirect';

test('www goes to the apex with the path and query kept', () => {
  assert.equal(canonicalHostRedirect('www.ainize.ai', '/models/Qwen?x=1'), 'https://ainize.ai/models/Qwen?x=1');
  assert.equal(canonicalHostRedirect('WWW.ainize.ai', '/'), 'https://ainize.ai/');
  assert.equal(canonicalHostRedirect('www.ainize.ai', '/api/auth/google/start?next=%2Fbilling'), 'https://ainize.ai/api/auth/google/start?next=%2Fbilling');
});

test('the apex, loopback and odd hosts are left alone', () => {
  for (const h of ['ainize.ai', 'localhost:3000', '127.0.0.1:3900', 'www.localhost', 'www.', '', null, undefined]) {
    assert.equal(canonicalHostRedirect(h, '/'), null, String(h));
  }
});
