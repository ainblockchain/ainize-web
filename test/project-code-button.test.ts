/**
 * The project page's "Code" action (src/api/projects.ts `codeWorkspaceUrlOf`): the ainize.ai/code `_aincode/open`
 * route it opens — under `/code/org/<org>/` for an organization's project, under `/code/` for a personal one — with
 * the repository URL encoded, and that the label and tooltip exist in both languages.
 *
 *   node --test --import tsx test/project-code-button.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeWorkspaceUrlOf } from '../src/api/projects.ts';
import { projects } from '../src/i18n/pages/projects.ts';

const repo = 'https://aindrive.example/exampleorg/git/app';
const encoded = 'https%3A%2F%2Faindrive.example%2Fexampleorg%2Fgit%2Fapp';

test('an organization project opens under /code/org/<org>/', () => {
  assert.equal(codeWorkspaceUrlOf({ org: 'exampleorg', repo, visibility: 'org' }), `/code/org/exampleorg/_aincode/open?repo=${encoded}`);
  assert.equal(codeWorkspaceUrlOf({ org: 'exampleorg', repo, visibility: 'public', owner: 'org:0123' }), `/code/org/exampleorg/_aincode/open?repo=${encoded}`);
});

test('a personal project opens under /code/', () => {
  assert.equal(codeWorkspaceUrlOf({ org: 'alice', repo: 'https://aindrive.example/alice/git/app' }), '/code/_aincode/open?repo=https%3A%2F%2Faindrive.example%2Falice%2Fgit%2Fapp');
  assert.equal(codeWorkspaceUrlOf({ org: 'alice', repo, visibility: 'public', owner: 'user:0123' }), `/code/_aincode/open?repo=${encoded}`);
});

test('the repo URL and the org slug are encoded', () => {
  assert.equal(codeWorkspaceUrlOf({ org: 'a b', repo: 'https://aindrive.example/a%20b/git/x?y=1&z=2', visibility: 'org' }), '/code/org/a%20b/_aincode/open?repo=https%3A%2F%2Faindrive.example%2Fa%2520b%2Fgit%2Fx%3Fy%3D1%26z%3D2');
});

test('label and tooltip exist in both languages', () => {
  for (const k of ['code', 'code_hint']) {
    const e = projects[`projects.page.${k}`];
    assert.ok(e && e.en.trim() && e.ko.trim(), k);
  }
});
