import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeLinkedAgentDraft as initialize } from '../src/screens/agentLinkDraft';
import { linkedAgentInputFromDraft, parseLinkedAgentResponse, type LinkedAgentView } from '../src/api/linkedAgents';

function response(id = 'agent-a', extra: Partial<LinkedAgentView> = {}) {
  return parseLinkedAgentResponse({ agent: {
    id, name: 'Original name', description: 'Original description', upstream: 'https://original.example',
    a2a_url: `/agents/${id}`, card_url: `/agents/${id}/card`, reachable: true,
    visibility: 'public', ...extra,
  } })!;
}

test('initial edit waits for its own valid response, then populates every field', () => {
  assert.equal(initialize(null, 'agent-a', null, null), null);
  assert.equal(initialize(null, 'agent-a', response('agent-b'), null), null);
  assert.deepEqual(initialize(null, 'agent-a', response(), 'ignored-preset'), {
    id: 'agent-a', name: 'Original name', description: 'Original description',
    upstream: 'https://original.example', visibility: 'public', orgId: null,
  });
});

test('confirmed reproduction: reachable true → false preserves Unsaved draft and its save payload', () => {
  const initial = initialize(null, 'agent-a', response(), null)!;
  const edited = { ...initial, name: 'Unsaved draft' };
  const refreshed = initialize(edited, 'agent-a', response('agent-a', { reachable: false }), null)!;
  assert.strictEqual(refreshed, edited);
  assert.equal(refreshed.name, 'Unsaved draft');
  assert.equal(linkedAgentInputFromDraft(refreshed).name, 'Unsaved draft');
});

test('same-agent refreshes and missing responses preserve all local fields, including blank input', () => {
  const edited = { ...initialize(null, 'agent-a', response(), null)!, name: '',
    description: 'Draft description', upstream: 'https://draft.example', visibility: 'org' as const, orgId: 'org-draft' };
  for (const view of [null, response(), response('agent-a', { name: 'Server rename', error: 'timeout', reachable: false })]) {
    const next = initialize(edited, 'agent-a', view, null)!;
    assert.strictEqual(next, edited);
    assert.deepEqual(linkedAgentInputFromDraft(next), edited);
  }
});

test('a new route session initializes the next ID and ignores a stale previous-ID response', () => {
  const oldDraft = { ...initialize(null, 'agent-a', response(), null)!, name: 'Unsaved draft' };
  // The route key remounts the editor: the new session starts with null, not oldDraft.
  let next = initialize(null, 'agent-b', response(), null);
  assert.equal(next, null);
  next = initialize(next, 'agent-b', response('agent-b', { name: 'Agent B' }), null);
  assert.equal(next?.id, 'agent-b');
  assert.equal(next?.name, 'Agent B');
  assert.equal(oldDraft.name, 'Unsaved draft');
  const revisited = initialize(null, 'agent-a', response('agent-a', { name: 'Latest A' }), null);
  assert.equal(revisited?.name, 'Latest A');
});

test('new-agent sessions start empty, apply the org preset, and retain their own edits', () => {
  const blank = initialize(null, undefined, response(), null)!;
  assert.deepEqual(blank, { id: '', name: '', description: '', upstream: '', visibility: 'public', orgId: null });
  const shared = initialize(null, undefined, response(), 'org-first')!;
  assert.deepEqual(shared, { ...blank, visibility: 'org', orgId: 'org-first' });
  const edited = { ...shared, id: 'manual-id', name: 'New draft' };
  assert.strictEqual(initialize(edited, undefined, response(), 'org-second'), edited);
  assert.deepEqual(initialize(null, undefined, null, null), blank);
  assert.equal(initialize(null, 'agent-b', response('agent-b'), 'org-first')?.visibility, 'public');
});

test('the page ties editor state to the route ID and uses the tested initializer on refresh', () => {
  // Wiring guard only; React lifecycle validation is handed off to the controller.
  const page = readFileSync(new URL('../src/screens/AgentLinkPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /<AgentLinkEditor key=\{editId \?\? ''\} editId=\{editId\}/);
  assert.match(page, /useState\(\(\) => initializeLinkedAgentDraft\(null, editId, storedView, presetOrg\)\)/);
  assert.match(page, /setInitializedDraft\(\(current\) => initializeLinkedAgentDraft\(current, editId, storedView, presetOrg\)\)/);
  assert.doesNotMatch(page, /setDraft\(linkedAgentDraftFromView/);
});
