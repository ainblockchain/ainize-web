/**
 * `/api/health` names the Git commit of the running build. The commit is resolved while building (next.config.ts)
 * and inlined, because a deployed release has no `.git` and no CI variable to read at runtime.
 *
 *   node --test --import tsx test/health-commit.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import config, { resolveBuildCommit } from '../next.config.ts';
import { GET } from '../app/api/health/route.ts';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const C = 'c'.repeat(40);
const missing = () => { throw new Error('missing'); };

test('the deploy marker written before the build wins over the checkout', () => {
  assert.equal(resolveBuildCommit({}, () => JSON.stringify({ sha: A }), () => B), A);
});

test('an explicit GIT_COMMIT overrides the marker', () => {
  assert.equal(resolveBuildCommit({ GIT_COMMIT: C }, () => JSON.stringify({ sha: A }), () => B), C);
});

test('Ainize embeds the exact deployment commit even without Git metadata', () => {
  assert.equal(resolveBuildCommit({ AINIZE_DEPLOYMENT_COMMIT:C, GIT_COMMIT:A }, missing, missing), C);
  assert.equal(resolveBuildCommit({ AINIZE_DEPLOYMENT_COMMIT:'main', GIT_COMMIT:A }, missing, missing), A);
});

test('a plain checkout falls back to git HEAD', () => {
  assert.equal(resolveBuildCommit({}, missing, () => `${B}\n`), B);
});

test('garbage is never reported as a commit', () => {
  assert.equal(resolveBuildCommit({ GIT_COMMIT: 'latest' }, () => '{"sha":"nope"}', () => 'fatal: not a git repository'), 'unknown');
  assert.equal(resolveBuildCommit({}, missing, missing), 'unknown');
});

test('the build embeds the commit for the route', () => {
  assert.match(String(config.env?.AINIZE_WEB_COMMIT), /^([0-9a-f]{7,40}|unknown)$/);
});

test('GET /api/health returns the embedded commit', async () => {
  const before = process.env.AINIZE_WEB_COMMIT;
  process.env.AINIZE_WEB_COMMIT = A;
  try {
    const body = await (await GET()).json();
    assert.equal(body.status, 'ok');
    assert.equal(body.commit, A);
    assert.equal(body.version, A);
  } finally {
    if (before === undefined) delete process.env.AINIZE_WEB_COMMIT; else process.env.AINIZE_WEB_COMMIT = before;
  }
});
