import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeProjectUrl, isScriptProject } from '../src/lib/projectActions.ts';
import type { Deployment, Project } from '../src/api/projects.ts';

const deployment = (id: string, status = 'ready') => ({ id, sha: id, status, outputUrl: `https://${id}.example.com` }) as Deployment;
const project = (extra: Partial<Project> = {}) => ({ kind: 'nextjs', status: 'ready', lastDeployment: deployment('latest'), ...extra }) as Project;

test('only script projects expose script Run actions', () => {
  assert.equal(isScriptProject(project({ kind: 'script' })), true);
  for (const kind of ['nextjs', 'service', 'agent', null] as const) assert.equal(isScriptProject(project({ kind })), false);
});

test('Visit follows the active deployment even after a failed newer build or rollback', () => {
  const p = project({ activeDeploymentId: 'active', lastDeployment: deployment('failed', 'error') });
  assert.equal(activeProjectUrl(p, [deployment('newer'), deployment('active')]), 'https://active.example.com');
  assert.equal(activeProjectUrl(p, [deployment('unrelated')]), null, 'never substitute an arbitrary historical success');
  assert.equal(activeProjectUrl(project({ activeCommit: 'active' }), [deployment('active')]), 'https://active.example.com');
});

test('unknown, stopped or unsafe deployments do not expose a misleading Visit action', () => {
  assert.equal(activeProjectUrl(project({ kind: null })), null);
  assert.equal(activeProjectUrl(project({ status: 'error', lastDeployment: deployment('failed', 'error') })), null);
  assert.equal(activeProjectUrl(project({ lastDeployment: { ...deployment('x'), outputUrl: 'javascript:alert(1)' } })), null);
  assert.equal(activeProjectUrl(project({ kind: 'script' })), null);
});
