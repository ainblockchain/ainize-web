/** The AinCode page's grouping: organization workspaces first, then personal; repository → sessions, newest first. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupOverview, misplaced, parseOverview, repoKey, type AinCodeOverview } from '../src/api/aincodeSessions';

const overview: AinCodeOverview = {
  workspaces: [
    { kind: 'personal', base: '/code', running: true, newSessionUrl: '/code/_workspaces/choose?to=personal' },
    { kind: 'organization', org: { id: 'comcom', name: 'ComCom', role: 'write' }, base: '/code/org/comcom', running: false, newSessionUrl: '/code/_workspaces/choose?to=comcom' },
  ],
  sessions: [
    { workspace: 'personal', id: 'ses_a', title: 'soulfiction', directory: '/home/aincode/agents', workingDirectory: '/home/aincode/projects/ainspace-soulfiction', repo: { org: 'comcom', name: 'ainspace-soulfiction', aindriveUrl: 'https://aindrive.ainetwork.ai/comcom/git/ainspace-soulfiction', projectPageUrl: 'https://ainize.ai/comcom/ainspace-soulfiction' }, branch: 'main', updatedAt: 30, status: 'working', openUrl: '/code/x/session/ses_a' },
    { workspace: 'personal', id: 'ses_b', title: 'notes', directory: '/home/aincode/projects/notes', workingDirectory: '/home/aincode/projects/notes', updatedAt: 10, status: 'idle', openUrl: '/code/y/session/ses_b' },
    { workspace: 'comcom', id: 'ses_c', title: 'ainspace fix', directory: '/home/aincode/repositories/ainspace', workingDirectory: '/home/aincode/repositories/ainspace', repo: { org: 'comcom', name: 'ainspace', aindriveUrl: 'https://aindrive.ainetwork.ai/comcom/git/ainspace' }, updatedAt: 20, status: 'unknown', openUrl: '/code/org/comcom/z/session/ses_c' },
  ],
};

test('organization workspaces come first, then personal; sessions grouped by repository', () => {
  const g = groupOverview(overview);
  assert.deepEqual(g.map((w) => w.key), ['comcom', 'personal']);
  assert.deepEqual(g[1].repos.map((r) => [r.label, r.href, r.sessions.map((s) => s.id)]), [
    ['ainspace-soulfiction', 'https://ainize.ai/comcom/ainspace-soulfiction', ['ses_a']],
    ['notes', undefined, ['ses_b']],
  ]);
  assert.equal(g[1].working, 1);
  assert.equal(g[0].repos[0].href, 'https://aindrive.ainetwork.ai/comcom/git/ainspace', 'no project page: AIN Drive');
});

test('a personal session on an organization repository is flagged; malformed lists are rejected', () => {
  assert.equal(misplaced(overview.sessions[0]), true);
  assert.equal(misplaced(overview.sessions[1]), false);
  assert.equal(repoKey(overview.sessions[1]).label, 'notes');
  const parsed = parseOverview({ workspaces: overview.workspaces, sessions: [...overview.sessions, { id: 'x', openUrl: 'https://evil.example/' }] });
  assert.equal(parsed, null, 'invalid rows must not silently disappear from the list');
  assert.equal(parseOverview({}), null);
  assert.deepEqual(parseOverview(overview), overview);
});

test('incomplete workspaces, orphaned sessions and duplicate rows cannot crash or misrepresent a list', () => {
  for (const workspaces of [
    [{ ...overview.workspaces[1], org: undefined }],
    [{ ...overview.workspaces[0], newSessionUrl: undefined }],
    [overview.workspaces[0], overview.workspaces[0]],
    [],
  ]) assert.equal(parseOverview({ ...overview, workspaces }), null);
  for (const changes of [
    { workingDirectory: undefined }, { updatedAt: 'yesterday' }, { status: 'unexpected' },
    { openUrl: '/code-elsewhere' }, { openUrl: '//evil.example/code' },
    { repo: { ...overview.sessions[0].repo, projectPageUrl: 'javascript:alert(1)' } },
  ]) assert.equal(parseOverview({ ...overview, sessions: [{ ...overview.sessions[0], ...changes }] }), null);
  assert.equal(parseOverview({ ...overview, sessions: [overview.sessions[0], overview.sessions[0]] }), null);
  assert.deepEqual(parseOverview({ workspaces: [], sessions: [] }), { workspaces: [], sessions: [] });
});
