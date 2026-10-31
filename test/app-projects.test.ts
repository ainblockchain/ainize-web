import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appProjects } from '../src/lib/appProjects.ts';
import type { Project } from '../src/api/projects.ts';
const p = (id: string, kind: Project['kind'], updatedAt: number, extra: Partial<Project> = {}) => ({ id, kind, updatedAt, name: id, org: 'comcom', repoName: id, ...extra } as Project);
test('app listing combines own and organization results once and excludes agents and scripts', () => {
 const app = p('web', 'nextjs', 1);
 assert.deepEqual(appProjects([app, p('api', 'service', 2), app, p('agent', 'agent', 3), p('run', 'script', 4)]).map(p => p.id), ['api', 'web']);
});
test('global search filters names, organization paths and monorepo app folders without hiding the default list', () => {
 const rows = [p('web', 'nextjs', 1, { name: 'Hello', sourcePath: 'packages/store' }), p('api', 'service', 2)];
 assert.equal(appProjects(rows).length, 2);
 assert.deepEqual(appProjects(rows, ' HELLO ').map(p => p.id), ['web']);
 assert.deepEqual(appProjects(rows, 'packages/store').map(p => p.id), ['web']);
 assert.equal(appProjects(rows, 'comcom/').length, 2);
 assert.equal(appProjects(rows, 'missing').length, 0);
});
