import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deploymentLogHref, deploymentPage, projectRedeployTarget, readProjectDeploymentHistory, readProjectRunHistory } from '../src/lib/projectHistory';
import { createProjectRedeployment } from '../src/lib/projectRedeploy';
import { activeProjectUrl } from '../src/lib/projectActions';
import type { Deployment, Project } from '../src/api/projects';

const record = (id: string, createdAt = 1): Deployment => ({ id, projectId: 'project', trigger: 'push', sha: 'a'.repeat(40), ref: 'refs/heads/main', status: 'ready',
  createdAt, startedAt: null, finishedAt: null, ms: null, pusher: null, logUrl: 'https://node.example/log', outputUrl: `https://app.example/${id}` });

test('deployment history refuses wrong project, wrong category, malformed and duplicate records instead of treating them as empty', () => {
  const good = record('selected');
  assert.deepEqual(readProjectDeploymentHistory({ deployments: [] }, 'project'), []);
  for (const raw of [null, {}, { deployments: {} }, { deployments: [null] }, { deployments: [good, good] },
    ...[{ projectId: 'other' }, { trigger: 'run' }, { trigger: 'unknown' }, { status: 'unknown' }, { sha: 'a'.repeat(41) }, { ref: null },
      { createdAt: NaN }, { logUrl: 'javascript:alert(1)' }, { outputUrl: 'https://user:password@app.example/' }].map(patch => ({ deployments: [{ ...good, ...patch }] }))]) {
    assert.equal(readProjectDeploymentHistory(raw, 'project'), null);
  }
  assert.equal(readProjectRunHistory({ runs: [good] }, 'project'), null);
});

test('out-of-order responses are sorted but the header redeploy still targets the project’s named attempt', () => {
  const older = record('older', 1), newer = record('newer', 2);
  const raw = { deployments: [older, newer] };
  const rows = readProjectDeploymentHistory(raw, 'project')!;
  assert.deepEqual(rows.map(d => d.id), ['newer', 'older']);
  assert.deepEqual(raw.deployments.map(d => d.id), ['older', 'newer'], 'do not mutate the query cache');
  assert.equal(projectRedeployTarget({ id: 'project', lastDeploymentId: 'older' }, rows)?.id, 'older');
  for (const lastDeploymentId of [undefined, 'missing']) assert.equal(projectRedeployTarget({ id: 'project', lastDeploymentId }, rows), null);
  assert.equal(projectRedeployTarget({ id: 'other', lastDeploymentId: 'newer' }, rows), null);
});

test('deep-linked records beyond page one stay visible and shrinking histories clamp the page', () => {
  const rows = Array.from({ length: 25 }, (_, i) => record(`id-${i}`));
  const selected = deploymentPage(rows, 1, 'id-24', 10);
  assert.equal(selected.page, 3); assert.equal(selected.rows.at(-1)?.id, 'id-24');
  const shrunk = deploymentPage(rows.slice(0, 2), 3, null, 10);
  assert.equal(shrunk.page, 1); assert.equal(shrunk.rows.length, 2);
  assert.equal(deploymentLogHref('id/with ?'), '/api/deployments/id%2Fwith%20%3F/log');
});

test('a fresh empty deployment read cannot revive a stale active URL from the project cache', () => {
  const p = { id: 'project', kind: 'nextjs', status: 'ready', activeDeploymentId: 'active', lastDeployment: record('active') } as Project;
  assert.equal(activeProjectUrl(p, []), null);
  assert.equal(activeProjectUrl(p, [{ ...record('active'), trigger: 'run' }]), null);
  assert.equal(activeProjectUrl(p, [{ ...record('active'), projectId: 'other' }]), null);
  assert.equal(activeProjectUrl(p, [record('active')]), 'https://app.example/active');
});

test('row and header redeploy overlap produces one exact-target request and a new record receipt', async () => {
  const gate = createProjectRedeployment();
  let finish!: (v: unknown) => void;
  const sent: string[] = [];
  const first = gate.submit(record('selected'), id => { sent.push(id); return new Promise(resolve => { finish = resolve; }); });
  assert.equal(gate.blocked(), true);
  assert.equal(await gate.submit(record('different'), async id => { sent.push(id); }), null);
  finish({ deploymentId: 'new-build', status: 'queued' });
  assert.equal(await first, 'new-build'); assert.deepEqual(sent, ['selected']); assert.equal(gate.blocked(), false);
});

test('lost or contradictory redeploy acceptance cannot blindly repeat while explicit refusal can retry', async () => {
  for (const receipt of [{}, { deploymentId: 'selected', status: 'queued' }, { deploymentId: 'new', status: 'ready' }, { deploymentId: 'new', runId: 'other', status: 'queued' }]) {
    const gate = createProjectRedeployment();
    await assert.rejects(gate.submit(record('selected'), async () => receipt));
    assert.equal(gate.uncertain(), true);
    assert.equal(await gate.submit(record('selected'), async () => { assert.fail('must not send'); }), null);
  }
  for (const error of [{ status: 'FETCH_ERROR' }, { status: 503 }, { status: 403, data: { error: { code: 'unrecognized' } } }]) {
    const gate = createProjectRedeployment();
    await assert.rejects(gate.submit(record('selected'), async () => { throw error; })); assert.equal(gate.uncertain(), true);
  }
  const refused = createProjectRedeployment();
  await assert.rejects(refused.submit(record('selected'), async () => { throw { status: 409, data: { error: { code: 'not_yet_cloned' } } }; }));
  assert.equal(refused.blocked(), false);
  assert.equal(await refused.submit(record('selected'), async () => ({ deploymentId: 'new', status: 'queued' })), 'new');
});

test('runs and unresolved commits cannot be sent to the redeploy endpoint', async () => {
  for (const d of [{ ...record('run'), trigger: 'run' as const }, { ...record('not-cloned'), sha: '' }]) {
    const gate = createProjectRedeployment();
    await assert.rejects(gate.submit(d, async () => assert.fail('must not send')));
    assert.equal(gate.uncertain(), false);
  }
});

test('a receipt naming another pre-existing record is not accepted as a new deployment', async () => {
  const gate = createProjectRedeployment();
  await assert.rejects(gate.submit(record('selected'), async () => ({ deploymentId: 'already-exists', status: 'queued' }), ['already-exists']));
  assert.equal(gate.uncertain(), true);
});
