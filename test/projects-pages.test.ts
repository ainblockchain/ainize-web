/**
 * The project pages' contract with aindrive (aindrive#206) and with the node (ainize-node docs/PROJECTS.md), held
 * still where it can be: the hand-off query string, the one-time secret's return trip, the node's error shape, and
 * that every string the pages render exists in both languages.
 *
 *   node --test --import tsx test/projects-pages.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { connectParamsOf, connectRepoOnAindrive, durationLabel, inputAnswers, mergeOrgRepos, missingInputs, parseEnvLines, projectApiErrorOf, relativeTime, repoLabelOf, repoUrlLooksRight, statusToneOf, type Project } from '../src/api/projects.ts';
import { projects } from '../src/i18n/pages/projects.ts';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8');

test('the "Connect to ainize" query string: repo and driveId pass, returnTo only back to aindrive or into this app', () => {
  const p = connectParamsOf('?repo=https%3A%2F%2Faindrive.ainetwork.ai%2Fcomcom%2Fgit%2Fart&driveId=-nLGGiI3VXYR&returnTo=https%3A%2F%2Faindrive.ainetwork.ai%2Fcomcom%2Fgit%2Fart');
  assert.deepEqual(p, { repo: 'https://aindrive.ainetwork.ai/comcom/git/art', driveId: '-nLGGiI3VXYR', returnTo: 'https://aindrive.ainetwork.ai/comcom/git/art' });
  assert.equal(connectParamsOf('?returnTo=https://evil.example/x').returnTo, null, 'no open redirect');
  assert.equal(connectParamsOf('?returnTo=//evil.example').returnTo, null);
  assert.equal(connectParamsOf('?returnTo=/me/projects').returnTo, '/me/projects');
  assert.deepEqual(connectParamsOf(''), { repo: null, driveId: null, returnTo: null });
});

test('a repo URL is accepted only in the node\'s shape, and labelled org/repo', () => {
  assert.equal(repoUrlLooksRight('https://aindrive.ainetwork.ai/comcom/git/art-search'), true);
  assert.equal(repoUrlLooksRight('https://aindrive.ainetwork.ai/api/drives/-nLGGiI3VXYR/git/tools/art'), true);
  assert.equal(repoUrlLooksRight('https://aindrive.ainetwork.ai/comcom/art-search'), false);
  assert.equal(repoUrlLooksRight('https://u:p@aindrive.ainetwork.ai/c/git/a'), false);
  assert.equal(repoUrlLooksRight('http://aindrive.ainetwork.ai/c/git/a'), false);
  assert.equal(repoLabelOf('https://aindrive.ainetwork.ai/comcom/git/art-search.git'), 'comcom/art-search');
  assert.equal(repoLabelOf('https://aindrive.ainetwork.ai/api/drives/-nLGGiI3VXYR/git/tools/art'), '-nLGGiI3VXYR/art');
});

test('the one-time secret goes to aindrive\'s git-connect with the person\'s session, and a refusal comes back as words', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const ok = await connectRepoOnAindrive({ driveId: 'd1', repo: 'https://aindrive.ainetwork.ai/o/git/r', projectId: 'prj_1', webhookSecret: 'whsec_x' }, {
    fetchImpl: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response('{}', { status: 200 }); }) as unknown as typeof fetch,
  });
  assert.deepEqual(ok, { ok: true });
  assert.equal(calls[0]!.url, 'https://aindrive.ainetwork.ai/api/drives/d1/git-connect');
  assert.equal(calls[0]!.init.method, 'POST');
  assert.equal(calls[0]!.init.credentials, 'include', 'the aindrive session cookie must travel');
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), { repo: 'https://aindrive.ainetwork.ai/o/git/r', projectId: 'prj_1', webhookSecret: 'whsec_x' });

  const refused = await connectRepoOnAindrive({ driveId: 'd1', repo: 'r', projectId: 'p', webhookSecret: 's' }, {
    fetchImpl: (async () => new Response(JSON.stringify({ error: { message: 'not an editor of this drive' } }), { status: 403 })) as unknown as typeof fetch,
  });
  assert.deepEqual(refused, { ok: false, status: 403, message: 'not an editor of this drive' });
  const down = await connectRepoOnAindrive({ driveId: 'd1', repo: 'r', projectId: 'p', webhookSecret: 's' }, { fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
  assert.equal(down.ok, false);
});

test('the node\'s error shape is read, and statuses map to the three dots', () => {
  assert.deepEqual(projectApiErrorOf({ status: 409, data: { error: { code: 'repo_taken', message: 'already' } } }), { status: 409, code: 'repo_taken', message: 'already' });
  assert.equal(projectApiErrorOf({ status: 'FETCH_ERROR' }).code, 'network');
  assert.equal(projectApiErrorOf({ status: 401, data: {} }).code, 'not_signed_in');
  assert.equal(statusToneOf('ready'), 'ok'); assert.equal(statusToneOf('error'), 'warn'); assert.equal(statusToneOf('building'), 'busy'); assert.equal(statusToneOf('queued'), 'busy'); assert.equal(statusToneOf('idle'), 'muted');
  assert.equal(durationLabel(850), '850ms'); assert.equal(durationLabel(4200), '4.2s'); assert.equal(durationLabel(61_000), '1m 1s');
});

test('every string the project pages render exists in English and in Korean', () => {
  const sources = ['screens/ProjectNewPage.tsx', 'screens/ProjectPage.tsx', 'screens/MyProjectsPage.tsx', 'screens/OrgRepositoriesPage.tsx'].map(read).join('\n');
  const keys = [...sources.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]!);
  assert.ok(keys.length > 20, 'the pages are translated through t()');
  for (const key of keys) {
    const e = projects[key];
    assert.ok(e, `missing i18n key ${key}`);
    assert.ok(e.en.trim() && e.ko.trim(), `${key} needs both languages`);
    assert.ok(/[가-힣]/.test(e.ko) || e.ko === e.en, `${key}.ko is not Korean`);
  }
  // dynamic keys: every status and kind the node can answer with
  for (const s of ['idle', 'queued', 'building', 'ready', 'error']) assert.ok(projects[`projects.status.${s}`], s);
  for (const k of ['nextjs', 'service', 'script', 'agent']) assert.ok(projects[`projects.kind.${k}`], k);
  for (const c of ['not_signed_in', 'invalid_request', 'repo_taken', 'limit', 'not_found', 'not_member', 'not_a_script', 'aindrive_off', 'network', 'unknown']) assert.ok(projects[`projects.api.${c}`], c);
  for (const tr of ['push', 'redeploy', 'run']) assert.ok(projects[`projects.trigger.${tr}`], tr);
  for (const tab of ['deployments', 'runs', 'logs', 'settings']) assert.ok(projects[`projects.tabs.${tab}`], tab);
});

test('/projects/new keeps its own sign-in gate so the hand-off query string survives the trip to /signing', () => {
  const app = read('App.tsx');
  assert.match(app, /path="\/projects\/new" element=\{<Layout><ProjectNewPage \/><\/Layout>\}/, 'not behind SignedInLayout, which drops the query string');
  // reading a project is public now (ainize-node docs/PROJECTS.md "Who sees what"): the old address forwards without a gate
  assert.match(app, /path="\/projects\/:id" element=\{<Layout><ProjectPage \/><\/Layout>\}/);
  const page = read('screens/ProjectNewPage.tsx');
  assert.match(page, /\/signing\?next=\$\{encodeURIComponent\(`\$\{pathname\}\$\{search\}`\)\}/);
});

test('every link to a project is the pretty URL /<org>/<repo>; nothing links to /projects/<id> any more', () => {
  for (const file of ['screens/ProjectNewPage.tsx', 'screens/MyProjectsPage.tsx', 'screens/ProjectPage.tsx', 'screens/OrgRepositoriesPage.tsx']) {
    assert.ok(!/`\/projects\/\$\{/.test(read(file)), `${file} still builds a /projects/<id> link`);
  }
  assert.match(read('screens/ProjectPage.tsx'), /<Navigate to=\{`\$\{projectPath\(q\.data\)\}/, '/projects/:id forwards to the pretty URL');
  assert.match(read('screens/ProjectPage.tsx'), /<Link to=\{orgPath\(p\.org\)\}>\{p\.org\}<\/Link>/, 'the breadcrumb\'s org links to /<org>');
});

test('the org page merges the drive\'s repositories with the projects bound here, by name, newest first', () => {
  const project = (repoName: string, updatedAt: number) => ({ id: `prj_${repoName}`, org: 'comcom', repoName, repo: `https://aindrive.ainetwork.ai/comcom/git/${repoName}`, branch: 'main', kind: 'script', entry: null, name: repoName, status: 'ready', url: '', pageUrl: '', lastDeploymentId: null, createdAt: 1, updatedAt }) as Project;
  const rows = mergeOrgRepos([project('Clef-Artwork-Search', 50), project('gone-from-drive', 10)], [
    { name: 'clef-artwork-search', cloneUrl: 'c', headSha: 'a', headSubject: 's', updatedAt: 40, hasManifest: true },
    { name: 'notes', cloneUrl: 'n', headSha: null, headSubject: null, updatedAt: 90, hasManifest: false },
  ]);
  assert.deepEqual(rows.map((r) => [r.name, !!r.project, !!r.repo]), [['notes', false, true], ['clef-artwork-search', true, true], ['gone-from-drive', true, false]]);
});

test('the Run panel: answers fall back to defaults, required blanks are named, env lines are parsed, times are relative', () => {
  const inputs = { desc: { required: true }, TOP_K: { type: 'number' as const, default: 5 }, verbose: { type: 'boolean' as const, default: false } };
  assert.deepEqual(inputAnswers(inputs, { desc: '노을 바다 유화' }), { desc: '노을 바다 유화', TOP_K: '5', verbose: 'false' });
  assert.deepEqual(missingInputs(inputs, {}), ['desc']);
  assert.deepEqual(missingInputs(inputs, { desc: 'x' }), []);
  assert.deepEqual(parseEnvLines('A=1\n bad line\nB = two words \n_C=\n9X=no'), { A: '1', B: 'two words', _C: '' });
  const now = 1_000_000_000_000;
  assert.equal(relativeTime(now - 10_000, now), 'just now');
  assert.equal(relativeTime(now - 5 * 60_000, now), '5m ago');
  assert.equal(relativeTime(now - 3 * 3_600_000, now), '3h ago');
  assert.equal(relativeTime(now - 2 * 86_400_000, now), '2d ago');
  assert.equal(relativeTime(null), '');
});
