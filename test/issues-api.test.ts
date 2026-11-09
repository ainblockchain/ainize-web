/**
 * Issues (src/api/issues.ts) against ainize-node's `/api/orgs/:id/issues` family: the defensive parse, where an issue
 * links, the sparkline geometry, the refusal messages — and that every kind, status and message exists in both languages.
 *
 *   node --test --import tsx test/issues-api.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISSUE_KINDS, ISSUE_STATUSES, issueKindKey, issueLink, issueProblemOf, parseIssue, parseIssueList, sparklinePoints } from '../src/api/issues.ts';
import { issues as dict } from '../src/i18n/pages/issues.ts';

const raw = { id: 'iss_1', org_id: 'comcom', project_id: 'prj_1', kind: 'deploy_failed', fingerprint: 'deploy_failed:prj_1:docker build exited N', title: 'Deployment failed: docker build exited 1', culprit: 'comcom/ainspace @ main',
  status: 'unresolved', first_seen: 1000, last_seen: 2000, count: 3, status_changed_at: null, status_changed_by: null, hourly: new Array(24).fill(0), events: [{ at: 2000, message: 'docker build exited 1', meta: { deploymentId: 'dep_2' } }, { at: 1000, message: 'x' }] };

test('the node\'s answer is parsed; anything malformed becomes a default, never a crash', () => {
  const i = parseIssue(raw)!;
  assert.equal(i.kind, 'deploy_failed'); assert.equal(i.count, 3); assert.equal(i.events.length, 2); assert.deepEqual(i.events[0]!.meta, { deploymentId: 'dep_2' });
  assert.equal(parseIssue(null), null); assert.equal(parseIssue({ title: 'no id' }), null);
  const odd = parseIssue({ id: 'iss_2', kind: 'nope', status: 'weird', hourly: [1, 2], count: 'many', events: [{ message: 'no at' }, null] })!;
  assert.equal(odd.kind, 'custom'); assert.equal(odd.status, 'unresolved'); assert.equal(odd.count, 1); assert.equal(odd.hourly.length, 24); assert.deepEqual(odd.hourly.slice(-2), [1, 2]); assert.deepEqual(odd.events, []);
  assert.equal(odd.title, 'iss_2');
  const list = parseIssueList({ issues: [raw, null, { id: 'iss_3' }], counts: { unresolved: 2 } });
  assert.equal(list.issues.length, 2); assert.deepEqual(list.counts, { unresolved: 2, resolved: 0, ignored: 0 });
  assert.deepEqual(parseIssueList(undefined), { issues: [], counts: { unresolved: 0, resolved: 0, ignored: 0 } });
});

test('an issue links to the deployment or run it is about, the agent, or the project; a monitor\'s site issue links nowhere', () => {
  const dep = parseIssue(raw)!;
  assert.deepEqual(issueLink(dep), { to: '/projects/prj_1?open=dep_2', key: 'issues.open.deployment' });
  assert.deepEqual(issueLink(parseIssue({ ...raw, kind: 'run_failed' })!), { to: '/projects/prj_1?tab=runs&open=dep_2', key: 'issues.open.run' });
  assert.deepEqual(issueLink(parseIssue({ ...raw, events: [] })!), { to: '/projects/prj_1', key: 'issues.open.project' });
  assert.deepEqual(issueLink(parseIssue({ id: 'a', kind: 'agent_unreachable', culprit: '/agents/aina', events: [{ at: 1, meta: { agentId: 'aina' } }] })!), { to: '/agent/aina', key: 'issues.open.agent' });
  assert.equal(issueLink(parseIssue({ id: 's', kind: 'site_down', culprit: 'https://ainspace.ainetwork.ai' })!), null);
});

test('the sparkline is 24 points across the box, flat when nothing happened, scaled to the busiest hour', () => {
  const flat = sparklinePoints(new Array(24).fill(0)).split(' ');
  assert.equal(flat.length, 24); assert.ok(flat.every((p) => p.endsWith(',23.0')));
  const h = new Array(24).fill(0); h[23] = 4; h[10] = 2;
  const pts = sparklinePoints(h).split(' ');
  assert.equal(pts[23], '96.0,1.0'); assert.equal(pts[10]!.split(',')[1], '12.0'); assert.equal(pts[0], '0.0,23.0');
});

test('every kind, status, empty state and refusal has words in both languages', () => {
  const both = (k: string) => { assert.ok(dict[k], `missing ${k}`); assert.ok(dict[k]!.ko && dict[k]!.en, `half-translated ${k}`); };
  for (const k of ISSUE_KINDS) both(issueKindKey(k));
  for (const s of ISSUE_STATUSES) { both(`issues.status.${s}`); both(`issues.tab.${s}`); both(`issues.empty.${s}`); }
  both('issues.tab.all'); both('issues.empty.all');
  for (const key of ['issues.open.deployment', 'issues.open.run', 'issues.open.agent', 'issues.open.project']) both(key);
  assert.equal(issueProblemOf(401, undefined), 'issues.problem.signin');
  assert.equal(issueProblemOf(403, 'not_member'), 'issues.problem.member');
  assert.equal(issueProblemOf(403, 'insufficient_role'), 'issues.problem.role');
  assert.equal(issueProblemOf(404, 'not_found'), 'issues.problem.unavailable');
  assert.equal(issueProblemOf(500, undefined), 'issues.problem.failed');
  for (const key of ['issues.problem.signin', 'issues.problem.member', 'issues.problem.role', 'issues.problem.unavailable', 'issues.problem.failed']) both(key);
});
