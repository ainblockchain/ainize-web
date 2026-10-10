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
import { connectParamsOf, connectRepoOnAindrive, durationLabel, projectApiErrorOf, repoLabelOf, repoUrlLooksRight, statusToneOf } from '../src/api/projects.ts';
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
  const sources = ['screens/ProjectNewPage.tsx', 'screens/ProjectPage.tsx', 'screens/MyProjectsPage.tsx'].map(read).join('\n');
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
  for (const c of ['not_signed_in', 'invalid_request', 'repo_taken', 'limit', 'not_found', 'network', 'unknown']) assert.ok(projects[`projects.api.${c}`], c);
});

test('/projects/new keeps its own sign-in gate so the hand-off query string survives the trip to /signing', () => {
  const app = read('App.tsx');
  assert.match(app, /path="\/projects\/new" element=\{<Layout><ProjectNewPage \/><\/Layout>\}/, 'not behind SignedInLayout, which drops the query string');
  assert.match(app, /path="\/projects\/:id" element=\{<SignedInLayout>/);
  const page = read('screens/ProjectNewPage.tsx');
  assert.match(page, /\/signing\?next=\$\{encodeURIComponent\(`\$\{pathname\}\$\{search\}`\)\}/);
});
