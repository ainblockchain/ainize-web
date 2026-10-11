import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyRelease } from './verify-release.mjs';
const sha = 'a'.repeat(40);
test('accepts the same public release', () => verifyRelease(JSON.stringify({ sha }), sha));
test('rejects a healthy but stale deployment', () => assert.throws(() => verifyRelease(JSON.stringify({ sha: 'b'.repeat(40) }), sha), /different release/));
test('rejects an HTML fallback and a missing SHA', () => {
  assert.throws(() => verifyRelease('<html>OK</html>', sha), /manifest/);
  assert.throws(() => verifyRelease('{}', sha), /different release/);
});
test('rejects an invalid expected SHA', () => assert.throws(() => verifyRelease('{}', 'main'), /Invalid/));
