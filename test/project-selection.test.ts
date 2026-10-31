import test from 'node:test';
import assert from 'node:assert/strict';
import { readRepoProjectList, repoProjects, selectRepoProject, repoProjectLabel } from '../src/lib/repoProjects';
import { projectPath, projectRedirectPath } from '../src/lib/reservedRoutes';
import { mergeOrgRepos, type Project } from '../src/api/projects';

const root = { id: 'root-main', org: 'team', repoName: 'mono', repo: 'https://drive.example/team/git/mono', sourcePath: '', branch: 'main', updatedAt: 1 } as Project;
const preview = { ...root, id: 'root-preview', branch: 'preview' };
const folder = { ...root, id: 'app-main', sourcePath: 'apps/web' };
const folderPreview = { ...folder, id: 'app-preview', branch: 'preview' };

test('repository switcher retains every root/folder branch regardless of which project was first', () => {
  const expected = ['root-main', 'root-preview', 'app-main', 'app-preview'];
  for (const first of [root, preview, folder, folderPreview]) {
    assert.deepEqual(repoProjects(first, [folderPreview, preview, root, folder, { ...folder, id: 'foreign', repo: 'https://other.example/repo' }]).map(p => p.id), expected);
  }
  assert.notEqual(repoProjectLabel(folder), repoProjectLabel(folderPreview));
});

test('legacy addresses require a unique matching root or folder; explicit ids never fall back', () => {
  const all = [root, preview, folder, folderPreview];
  for (const path of [null, '', 'apps/web', '/apps/web', 'apps/web/', 'missing']) assert.equal(selectRepoProject(all, path), undefined);
  assert.equal(selectRepoProject([folder], null), folder);
  assert.equal(selectRepoProject([folder, root], null), root);
  assert.equal(selectRepoProject([folder], ''), undefined);
  assert.equal(selectRepoProject(all, 'apps/web', folderPreview.id), folderPreview);
  assert.equal(selectRepoProject(all, null, preview.id), preview);
  assert.equal(selectRepoProject(all, 'apps/web', preview.id), undefined);
  assert.equal(selectRepoProject(all, null, 'missing'), undefined);
});

test('project links and id redirects preserve the exact project and discard conflicting selection only', () => {
  assert.equal(projectPath(preview), '/team/mono?projectId=root-preview');
  assert.equal(projectPath(folderPreview), '/team/mono?project=apps%2Fweb&projectId=app-preview');
  const query = new URL(projectRedirectPath(preview, '?project=apps/web&projectId=wrong&projectId=other&tab=runs&open=run-id&runTarget=commit&runSha=abc'), 'https://node.example').searchParams;
  assert.equal(query.get('project'), null); assert.deepEqual(query.getAll('projectId'), [preview.id]);
  assert.equal(query.get('tab'), 'runs'); assert.equal(query.get('open'), 'run-id'); assert.equal(query.get('runSha'), 'abc');
});

test('organization rows retain separate branches and case-sensitive folders without duplicating ids', () => {
  const caseFolder = { ...folder, id: 'case-folder', sourcePath: 'Apps/web' };
  const rows = mergeOrgRepos([root, folder, preview, folderPreview, caseFolder, root], [{ name: 'mono', cloneUrl: root.repo, updatedAt: 1, headSha: null, headSubject: null, hasManifest: true }]);
  assert.deepEqual(new Set(rows.map(r => r.project?.id)), new Set([root.id, preview.id, folder.id, folderPreview.id, caseFolder.id]));
  assert.equal(rows.length, 5);
  assert.equal(new Set(rows.map(r => projectPath(r.project!))).size, 5);
});

test('malformed or duplicated project lists do not select partial results', () => {
  assert.deepEqual(readRepoProjectList({ projects: [folder, root, { ...root, id: 'other', org: 'elsewhere' }] }, 'TEAM', 'MONO'), [root, folder]);
  for (const raw of [{}, { projects: {} }, { projects: [null] }, { projects: [root, root] }, { projects: [root, { ...folder, branch: null }] }, { projects: [{ ...root, sourcePath: [] }] }]) {
    assert.equal(readRepoProjectList(raw, 'team', 'mono'), null);
  }
});
