/**
 * The Logs tab's runtime view (src/api/runtimeLogs.ts) against the node's `GET /api/projects/:id/runtime-logs`
 * (ainize-node docs/PROJECTS.md "Runtime logs"): the answer parsed defensively, the download text, the bounded
 * request, which message each refusal becomes — and that every message exists in both languages.
 *
 *   node --test --import tsx test/project-runtime-logs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logTime, parseRuntimeLogs, readRuntimeLogs, runtimeLogsMatchDeployment, runtimeLogProblemOf, runtimeLogsText, runtimeLogsUrl } from '../src/api/runtimeLogs.ts';
import { projects } from '../src/i18n/pages/projects.ts';

const runtimeFixture = () => ({ projectId: 'prj_x', deploymentId: 'dep_x', sha: 'a'.repeat(40), placement: 'peer', tail: 200, fetchedAt: 5, truncated: true,
  lines: [{ ts: '2026-01-01T00:00:01.123456789Z', stream: 'stdout', text: 'ready' }, { ts: null, stream: 'stderr', text: 'warn' }] });

test('runtime evidence preserves the supplied placement, fetch time and streams without inventing fields', () => {
  const raw = runtimeFixture();
  const parsed = parseRuntimeLogs(raw, { id: 'prj_x', tail: 200 });
  assert.deepEqual(parsed, raw);
  assert.notEqual(parsed.lines, raw.lines);
  assert.deepEqual(parseRuntimeLogs({ ...raw, lines: [] }).lines, [], 'only a valid empty result means no output');
});

test('malformed runtime evidence is unavailable rather than a fresh empty local log', () => {
  for (const raw of [null, {}, [], ...[
    { placement: 'elsewhere' }, { fetchedAt: undefined }, { fetchedAt: NaN }, { fetchedAt: -1 }, { truncated: undefined },
    { tail: 200.5 }, { tail: 1001 }, { sha: '' }, { sha: 'a'.repeat(41) }, { deploymentId: ' ' }, { projectId: '' },
    { lines: null }, { lines: [null] }, { lines: [{ ts: null, stream: 'other', text: 'x' }] },
    { lines: [{ ts: null, stream: 'stdout', text: 42 }] }, { lines: [{ ts: 'not a time', stream: 'stderr', text: 'x' }] },
    { tail: 1 }, { lines: [{ ts: null, stream: 'stdout', text: 'x'.repeat(8193) }] },
  ].map(patch => ({ ...runtimeFixture(), ...patch }))]) {
    assert.equal(readRuntimeLogs(raw), null);
    assert.throws(() => parseRuntimeLogs(raw), /invalid_runtime_logs/);
  }
});

test('runtime logs bind project, requested line count and known active deployment identity', () => {
  const raw = runtimeFixture();
  assert.equal(readRuntimeLogs(raw, { id: 'another-project', tail: 200 }), null);
  assert.equal(readRuntimeLogs(raw, { id: 'prj_x', tail: 500 }), null);
  const logs = parseRuntimeLogs(raw);
  assert.equal(runtimeLogsMatchDeployment(logs, { activeDeploymentId: 'dep_x', activeCommit: raw.sha }), true);
  assert.equal(runtimeLogsMatchDeployment(logs, { activeDeploymentId: 'dep_other' }), false);
  assert.equal(runtimeLogsMatchDeployment(logs, { activeCommit: 'b'.repeat(40) }), false);
  assert.equal(runtimeLogsMatchDeployment(logs, {}), true, 'older projects without active identity still use project-scoped endpoint evidence');
});

test('download text and times', () => {
  assert.equal(runtimeLogsText([{ ts: '2026-01-01T00:00:01Z', stream: 'stdout', text: 'a' }, { ts: null, stream: 'stderr', text: 'b' }]), '2026-01-01T00:00:01Z stdout a\nstderr b\n');
  assert.equal(runtimeLogsText([]), '');
  assert.equal(logTime(null), '');
  assert.equal(logTime('not a time'), '');
  assert.match(logTime('2026-01-01T00:00:01Z'), /^\d{2}:\d{2}:\d{2}$/);
});

test('the request is bounded and the project id is encoded', () => {
  assert.equal(runtimeLogsUrl('prj_1', 200), 'api/projects/prj_1/runtime-logs?tail=200');
  assert.equal(runtimeLogsUrl('a/b', 99999), 'api/projects/a%2Fb/runtime-logs?tail=1000');
  assert.equal(runtimeLogsUrl('p', 0), 'api/projects/p/runtime-logs?tail=1');
});

test('refusals become the right message, each in both languages', () => {
  assert.equal(runtimeLogProblemOf({ status: 401, data: { error: { code: 'sign_in_required' } } }), 'sign_in');
  assert.equal(runtimeLogProblemOf({ status: 403, data: { error: { code: 'not_member' } } }), 'not_member');
  assert.equal(runtimeLogProblemOf({ status: 404, data: { error: { code: 'not_running' } } }), 'not_running');
  assert.equal(runtimeLogProblemOf({ status: 502, data: { error: { code: 'logs_unavailable' } } }), 'unavailable');
  assert.equal(runtimeLogProblemOf({ status: 'FETCH_ERROR' }), 'unavailable');
  for (const p of ['sign_in', 'not_member', 'not_running', 'unavailable']) {
    const e = projects[`projects.logs.${p}`];
    assert.ok(e && e.en.trim() && /[가-힣]/.test(e.ko), p);
  }
});
