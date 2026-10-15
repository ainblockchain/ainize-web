/**
 * The Logs tab's runtime view (src/api/runtimeLogs.ts) against the node's `GET /api/projects/:id/runtime-logs`
 * (ainize-node docs/PROJECTS.md "Runtime logs"): the answer parsed defensively, the download text, the bounded
 * request, which message each refusal becomes — and that every message exists in both languages.
 *
 *   node --test --import tsx test/project-runtime-logs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { logTime, parseRuntimeLogs, runtimeLogProblemOf, runtimeLogsText, runtimeLogsUrl } from '../src/api/runtimeLogs.ts';
import { projects } from '../src/i18n/pages/projects.ts';

test('the node\'s answer is parsed; malformed lines are dropped, unknown streams are stdout', () => {
  const r = parseRuntimeLogs({ projectId: 'prj_x', deploymentId: 'dep_x', sha: 'a'.repeat(40), placement: 'peer', tail: 200, fetchedAt: 5, truncated: true,
    lines: [{ ts: '2026-01-01T00:00:01Z', stream: 'stdout', text: 'ready' }, { ts: null, stream: 'stderr', text: 'warn' }, { text: 42 }, null, { stream: 'other', text: 'x' }] });
  assert.equal(r.placement, 'peer');
  assert.equal(r.truncated, true);
  assert.deepEqual(r.lines.map((l) => `${l.stream}:${l.text}`), ['stdout:ready', 'stderr:warn', 'stdout:x']);
  assert.deepEqual(parseRuntimeLogs(null).lines, []);
  assert.equal(parseRuntimeLogs({ placement: 'elsewhere' }).placement, 'local');
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
