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

// Release directories may be reached through the operator's symlinked home path.
import { mkdtempSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
test('the CLI validates when invoked through a symlink', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ainize-release-'));
  try {
    const entry = join(directory, 'verify.mjs');
    symlinkSync(fileURLToPath(new URL('./verify-release.mjs', import.meta.url)), entry);
    const stale = spawnSync(process.execPath, [entry, sha], { input: JSON.stringify({ sha: 'b'.repeat(40) }), encoding: 'utf8' });
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /different release/);
    const current = spawnSync(process.execPath, [entry, sha], { input: JSON.stringify({ sha }), encoding: 'utf8' });
    assert.equal(current.status, 0);
    assert.match(current.stdout, /matches the deployed release/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
