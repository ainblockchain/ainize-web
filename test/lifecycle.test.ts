/**
 * The landing page's lifecycle diagram and README.md's lifecycle table are one thing said twice, so this test is
 * the joint that stops them drifting: every command line and every route in `lifecycleSteps.ts` must appear in the
 * README's table, and every string the diagram renders must exist in both English and Korean.
 *
 * It also guards the two things this page got wrong before: a command that cannot resolve
 * (`npm install -g ainize` — @ainize/cli is private) and a Korean column that is really English.
 *
 *   node --test --import tsx test/lifecycle.test.ts     (packages/web)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LIFECYCLE, LIFECYCLE_KEYS, LOOP_TARGET } from '../src/components/public/lifecycleSteps.ts';
import { landing } from '../src/i18n/pages/public.ts';

const README = readFileSync(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf-8');
/** the lifecycle section only — a command must be in the table, not merely somewhere else in the file */
const SECTION = README.slice(README.indexOf('## The loop —'), README.indexOf('## Teach the model'));
const HANGUL = /[ㄱ-ㆎ가-힣]/;

test('README carries every step, in the same order, with the same commands', () => {
  assert.ok(SECTION.length > 1000, 'the lifecycle section is missing from README.md');
  let at = 0;
  for (const s of LIFECYCLE) {
    const row = SECTION.indexOf(`| ${s.n} | `, at);
    assert.ok(row > 0, `README has no table row for step ${s.n}`);
    assert.ok(row >= at, `README step ${s.n} is out of order`);
    const end = SECTION.indexOf('\n', row);
    const cell = SECTION.slice(row, end);
    for (const line of s.cmd.split('\n')) {
      assert.ok(cell.includes('`' + line + '`'), `README step ${s.n} is missing the command line: ${line}`);
    }
    at = end;
  }
});

test('README prints the same route for each step as the diagram links to', () => {
  for (const s of LIFECYCLE) {
    const row = SECTION.slice(SECTION.indexOf(`| ${s.n} | `));
    const cell = row.slice(0, row.indexOf('\n'));
    assert.ok(cell.includes('`http://localhost:3402' + s.route + '`'), `README step ${s.n} is missing the route ${s.route}`);
  }
});

test('the ASCII loop names every step and returns to the step the page returns to', () => {
  const fence = SECTION.slice(SECTION.indexOf('```text'), SECTION.indexOf('```', SECTION.indexOf('```text') + 3));
  for (const s of LIFECYCLE) assert.match(fence, new RegExp(`\\s${s.n}\\s{2}`), `the ASCII diagram is missing step ${s.n}`);
  assert.ok(fence.includes(`step ${LOOP_TARGET}`), `the ASCII diagram must name the step the loop returns to (${LOOP_TARGET})`);
  assert.equal(landing['landing.flow.loop'].en.includes('step {n}'), true);
});

test('every string the diagram renders exists in English and in real Korean', () => {
  for (const key of LIFECYCLE_KEYS) {
    const e = landing[key];
    assert.ok(e, `missing dictionary entry: ${key}`);
    assert.ok(e.en.trim().length > 0 && e.ko.trim().length > 0, `${key} is empty in one locale`);
    assert.notEqual(e.ko, e.en, `${key} is not translated — the Korean is the English`);
    assert.match(e.ko, HANGUL, `${key} has no Hangul: a transliteration is not a translation`);
  }
});

test('the role-grouped "one line is enough" block is gone from the page and the README', () => {
  for (const k of Object.keys(landing)) assert.ok(!k.startsWith('landing.oneline.'), `retired key still present: ${k}`);
  assert.ok(!README.includes('## One line is enough'));
});

test('no command that cannot resolve, and no unshipped flag', (t) => {
  const page = readFileSync(fileURLToPath(new URL('../src/pages/LandingPage.tsx', import.meta.url)), 'utf-8');
  const every = LIFECYCLE.map((s) => s.cmd).join('\n') + '\n' + SECTION + '\n' + page;
  // `npm install -g ainize` was banned outright while the CLI was published as `@ainize/cli` and
  // `npm view ainize` 404d. That ban is now a CONDITION: the page may make the promise exactly when the
  // registry can keep it. Deleting the guard once the command works would remove the thing that stopped the
  // false promise coming back the first time — the invariant is "no unkeepable promise", not "never this
  // string". Skipped rather than failed when the registry is unreachable, because a test that turns red
  // offline is a test people learn to ignore.
  if (every.includes('npm install -g ainize')) {
    const probe = spawnSync('npm', ['view', 'ainize', 'version'], { encoding: 'utf-8', timeout: 20_000 });
    const offline = !!probe.error || /ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network/i.test(probe.stderr ?? '');
    if (offline) t.skip('registry unreachable — cannot check that `npm install -g ainize` resolves');
    else assert.equal(probe.status, 0,
      'the page promises `npm install -g ainize` but `npm view ainize` fails — publish the CLI under that name, or take the line off the page');
  }
  // named by the node's own needs_base error, but `ainize patch apply --help` does not list it
  assert.ok(!LIFECYCLE.some((s) => s.cmd.includes('--with-base')), '--with-base is not in `patch apply --help` yet');
});
