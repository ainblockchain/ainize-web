/**
 * Deployments and Runs (ainize-node "Runs" contract §3): Apps became Deployments (`/deployments`, `/apps` forwards),
 * Runs got a landing (`/runs`) and a Triggers section on the project page. Held still here: both navs carry both
 * items, every string the new screens render exists in both languages, and the trigger helpers.
 *
 *   node --test --import tsx test/deployments-and-runs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apps } from '../src/i18n/pages/apps.ts';
import { common } from '../src/i18n/pages/common.ts';
import { projects } from '../src/i18n/pages/projects.ts';
import { projectApiErrorOf, sortTriggers, triggerDetail, isRunTrigger, type ProjectTrigger, type Project } from '../src/api/projects.ts';
import { filterProjects, projectFilterOf, runProjects } from '../src/lib/appProjects.ts';
import { isReservedFirstSegment } from '../src/lib/reservedRoutes.ts';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

test('both navigations offer Deployments and Runs, and the old /apps address forwards', () => {
  const header = read('components/ui/Header.tsx');
  const landing = read('screens/LandingPage.tsx');
  assert.match(header, /to="\/deployments" data-testid="nav-deployments"/);
  assert.match(header, /to="\/runs" data-testid="nav-runs"/);
  assert.doesNotMatch(header, /to="\/apps"/);
  assert.match(landing, /to="\/deployments" data-testid="landing-nav-deployments"/);
  assert.match(landing, /to="\/runs" data-testid="landing-nav-runs"/);
  const app = read('App.tsx');
  assert.match(app, /<Route path="\/deployments" element=\{<Layout><AppsPage \/><\/Layout>\} \/>/);
  assert.match(app, /<Route path="\/apps" element=\{<LegacyAppsRoute \/>\} \/>/);
  assert.match(app, /<Route path="\/runs" element=\{<Layout><RunsPage \/><\/Layout>\} \/>/);
  assert.match(app, /<Navigate to=\{`\/deployments\$\{search\}\$\{hash\}`\} replace \/>/, 'the query string (?q=) survives the forward');
  for (const s of ['deployments', 'runs']) assert.ok(isReservedFirstSegment(s), `${s} is reserved from the org/repo routes`);
  assert.equal(common['nav.apps']!.en, 'Deployments'); assert.equal(common['nav.apps']!.ko, '배포');
  assert.equal(common['nav.runs']!.en, 'Runs'); assert.equal(common['nav.runs']!.ko, '실행');
});

test('every string the Deployments and Runs landings render exists in English and in Korean', () => {
  const dict = { ...common, ...apps, ...projects };
  for (const file of ['screens/AppsPage.tsx', 'screens/RunsPage.tsx']) {
    const keys = [...read(file).matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]!);
    assert.ok(keys.length > 10, `${file} is translated through t()`);
    for (const key of keys) {
      const e = dict[key];
      assert.ok(e, `${file}: missing i18n key ${key}`);
      assert.ok(e.en.trim() && e.ko.trim(), `${key} needs both languages`);
      assert.ok(/[가-힣]/.test(e.ko) || e.ko === e.en, `${key}.ko is not Korean`);
    }
  }
  for (const tr of ['push', 'redeploy', 'run', 'schedule', 'ain', 'http']) assert.ok(projects[`projects.trigger.${tr}`], tr);
  for (const ty of ['schedule', 'ain', 'http']) assert.ok(projects[`projects.triggers.type.${ty}`], ty);
  assert.ok(projects['projects.api.trigger_disabled']);
  assert.equal(projects['projects.trigger.ain']!.en, 'AIN trigger'); assert.equal(projects['projects.trigger.ain']!.ko, 'AIN 트리거');
  assert.equal(projects['projects.trigger.http']!.en, 'webhook'); assert.equal(projects['projects.trigger.http']!.ko, '웹훅');
  assert.equal(projects['projects.trigger.schedule']!.ko, '스케줄');
});

test('trigger rows: detail column, order, run triggers, and the disabled-trigger error', () => {
  assert.equal(triggerDetail({ type: 'schedule', cron: '0 * * * *' }), '0 * * * *', 'UTC is the default and not repeated');
  assert.equal(triggerDetail({ type: 'schedule', cron: '0 9 * * 1', timezone: 'Asia/Seoul' }), '0 9 * * 1 · Asia/Seoul');
  assert.equal(triggerDetail({ type: 'ain', path: '/apps/afan/posts/$post_id' }), '/apps/afan/posts/$post_id');
  assert.equal(triggerDetail({ type: 'http' }), '');
  const rows: ProjectTrigger[] = [
    { name: 'webhook', type: 'http', enabled: true, hasToken: true },
    { name: 'on-post', type: 'ain', path: '/x', enabled: true, hasToken: true },
    { name: 'b-hourly', type: 'schedule', cron: '0 * * * *', enabled: true, hasToken: false },
    { name: 'a-daily', type: 'schedule', cron: '0 0 * * *', enabled: false, hasToken: false },
  ];
  assert.deepEqual(sortTriggers(rows).map((r) => r.name), ['a-daily', 'b-hourly', 'on-post', 'webhook']);
  for (const t of ['run', 'schedule', 'ain', 'http'] as const) assert.equal(isRunTrigger(t), true);
  for (const t of ['push', 'redeploy'] as const) assert.equal(isRunTrigger(t), false);
  assert.equal(projectApiErrorOf({ status: 409, data: { error: { code: 'trigger_disabled', message: 'off' } } }).code, 'trigger_disabled');
});

test('the Runs landing lists script projects only; My projects filters by ?kind=', () => {
  const p = (id: string, kind: Project['kind'], updatedAt: number, extra: Partial<Project> = {}) => ({ id, kind, updatedAt, name: id, org: 'comcom', repoName: id, ...extra } as Project);
  const rows = [p('web', 'nextjs', 1), p('check', 'script', 2, { entry: 'check.py' }), p('check', 'script', 2, { entry: 'check.py' }), p('agent', 'agent', 3), p('late', null, 4, { manifest: { kind: 'script', inputs: {}, examples: [], detected: 'ainize.json' } })];
  assert.deepEqual(runProjects(rows).map((r) => r.id), ['late', 'check'], 'script by kind or by manifest, once each, newest first');
  assert.deepEqual(runProjects(rows, 'check.PY').map((r) => r.id), ['check'], 'the entry file is searchable');
  assert.deepEqual(runProjects(rows, 'nope'), []);
  assert.equal(projectFilterOf('script'), 'script'); assert.equal(projectFilterOf('deployment'), 'deployment'); assert.equal(projectFilterOf('x'), 'all'); assert.equal(projectFilterOf(null), 'all');
  assert.deepEqual(filterProjects(rows, 'script').map((r) => r.id), ['check', 'check', 'late']);
  assert.deepEqual(filterProjects(rows, 'deployment').map((r) => r.id), ['web', 'agent']);
  assert.equal(filterProjects(rows, 'all').length, rows.length);
});
