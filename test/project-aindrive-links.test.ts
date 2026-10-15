/**
 * The Settings tab's AinDrive block (src/api/projects.ts `aindriveLinksOf`) against the node's project view
 * `aindrive` (ainize-node docs/PROJECTS.md "Where the data lives"): the links it lists, the path shown beside each,
 * nothing for a project without a log store or an older node — and that every label exists in both languages.
 *
 *   node --test --import tsx test/project-aindrive-links.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aindriveLinksOf } from '../src/api/projects.ts';
import { projects } from '../src/i18n/pages/projects.ts';

const DRIVE = 'https://aindrive.example/d/drive_ABC-123';
const store = {
  repo: { url: 'https://aindrive.example/exampleorg/git/app' },
  logStore: { driveId: 'drive_ABC-123', basePath: 'app-data/prj_0123456789abcdef/', urls: {
    base: `${DRIVE}/app-data/prj_0123456789abcdef`, logs: `${DRIVE}/app-data/prj_0123456789abcdef/logs`,
    transcriptsToday: `${DRIVE}/app-data/prj_0123456789abcdef/logs/2026-04-01/transcripts`, state: `${DRIVE}/app-data/prj_0123456789abcdef/state`,
  } },
};

test('three links, each with the drive path it opens as text', () => {
  assert.deepEqual(aindriveLinksOf(store), [
    { key: 'logs', path: 'app-data/prj_0123456789abcdef/logs/', url: store.logStore.urls.logs },
    { key: 'transcripts_today', path: 'app-data/prj_0123456789abcdef/logs/2026-04-01/transcripts/', url: store.logStore.urls.transcriptsToday },
    { key: 'state', path: 'app-data/prj_0123456789abcdef/state/', url: store.logStore.urls.state },
  ]);
});

test('no log store, an older node, or a link that is not https: nothing is listed', () => {
  assert.deepEqual(aindriveLinksOf({ repo: { url: 'https://aindrive.example/o/git/r' }, logStore: null }), []);
  assert.deepEqual(aindriveLinksOf(undefined), []);
  assert.deepEqual(aindriveLinksOf({ ...store, logStore: { ...store.logStore, urls: { ...store.logStore.urls, state: 'javascript:alert(1)' } } }).map((l) => l.key), ['logs', 'transcripts_today']);
});

test('every label of the block exists in both languages', () => {
  for (const k of ['title', 'repo', 'log_store', 'log_store_help', 'logs', 'transcripts_today', 'state', 'open_logs']) {
    const e = projects[`projects.aindrive.${k}`];
    assert.ok(e && e.en.trim() && e.ko.trim(), k);
  }
});
