import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftDirty, draftConflicts, manageDraftEditor, receiveManageDraft, resolveDraftGroup, saveManageDraft, ManageDraftError } from '../src/lib/manageDraft';
import { createNodeActionTask } from '../src/lib/accountNodeActions';
import { manageFixture } from './fixtures/manageKnowledge';

const fixture = () => { const p = manageFixture(); p.anchor.description = 'Saved description'; p.anchor.branch = 'old/branch'; p.anchor.license = 'CC-BY'; p.anchor.benchmark = { schema: 'facts', queries: 1, format: ['template'], samples: [{ prompt: 'Question?', expect: 'A' }], extra: { preserve: true } } as any; return p; };
const change = (p: ReturnType<typeof fixture>, fields: Record<string, any>) => ({ ...p, anchor: { ...p.anchor, ...fields } });
const expectCode = (code: string) => (e: unknown) => e instanceof ManageDraftError && e.code === code;

test('draft refresh preserves dirty and malformed JSON text while updating pristine values', () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor);
  editor.draft.description = 'My unsaved description'; editor.draft.benchmark = '{ incomplete';
  const next = receiveManageDraft(editor, change(p, { price: '2', description: 'Other writer' }).anchor);
  assert.equal(next.draft.price, '2'); assert.equal(next.base.price, '2');
  assert.equal(next.draft.description, 'My unsaved description'); assert.equal(next.base.description, 'Saved description');
  assert.equal(next.draft.benchmark, '{ incomplete'); assert.equal(draftDirty(next), true);
  assert.deepEqual(draftConflicts(next, change(p, { price: '2', description: 'Other writer' }).anchor, 'fields'), ['description']);
});

test('conflict choices change only their section and retain unsubmitted benchmark input', () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor); editor.draft.description = 'Mine'; editor.draft.benchmark = '{ invalid';
  const latest = change(p, { description: 'Theirs', price: '4' });
  const keep = resolveDraftGroup(editor, latest.anchor, 'fields', true);
  assert.equal(keep.base.description, 'Theirs'); assert.equal(keep.draft.description, 'Mine'); assert.equal(keep.draft.price, '4'); assert.equal(keep.draft.benchmark, '{ invalid');
  assert.deepEqual(draftConflicts(keep, latest.anchor, 'fields'), []);
  const discard = resolveDraftGroup(editor, latest.anchor, 'fields', false);
  assert.equal(discard.draft.description, 'Theirs'); assert.equal(draftDirty(discard, 'fields'), false); assert.equal(draftDirty(discard, 'benchmark'), true);
});

test('clearing branch and license sends explicit empty strings while unrelated concurrent fields are preserved', async () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor); editor.draft.branch = ''; editor.draft.license = '';
  let saved = change(p, { description: 'Concurrent description' }), payload: unknown;
  const result = await saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => saved, write: async patch => { payload = patch; saved = change(saved, patch); return { anchor: saved.anchor }; } });
  assert.deepEqual(payload, { branch: '', license: '' }); assert.equal(result?.detail.anchor.description, 'Concurrent description'); assert.equal(result?.wrote, true);
});

test('legacy billing is omitted on unrelated edits while new unsupported billing is rejected', async () => {
  const p = fixture(); p.anchor.billing = 'per_hit'; const editor = manageDraftEditor(p.anchor); editor.draft.description = 'New description'; let saved = p;
  await saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => saved, write: async patch => { assert.deepEqual(patch, { description: 'New description' }); saved = change(saved, patch); return { anchor: saved.anchor }; } });
  editor.draft.billing = 'per_apply_hour';
  await assert.rejects(saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => { assert.fail('invalid billing must not read'); }, write: async () => { assert.fail('invalid billing must not write'); } }), expectCode('billing'));
});

test('save rejects conflicts, changed ownership, sealed drafts and invalid input before writing', async () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor); editor.draft.description = 'Mine';
  for (const [fresh, code] of [[change(p, { description: 'Theirs' }), 'conflict'], [{ ...p, status: 'ANNOUNCED' }, 'sealed'], [{ ...p, owned: false }, 'read'], [manageFixture('different'), 'read']] as const) {
    await assert.rejects(saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => fresh, write: async () => { assert.fail('no update'); } }), expectCode(code));
  }
  for (const price of ['', '-1', 'Infinity', '1e4']) {
    await assert.rejects(saveManageDraft({ ...editor, draft: { ...editor.draft, price } }, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => p, write: async () => { assert.fail('invalid price'); } }), expectCode('price'));
  }
});

test('save confirms exact acknowledgement identity and requested values, then rereads current values', async () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor); editor.draft.description = 'Mine'; const saved = change(p, { description: 'Mine' });
  for (const response of [{}, { anchor: change(saved, { id: 'other' }).anchor }, { anchor: change(saved, { author: '0x' + 'b'.repeat(40) }).anchor }, { anchor: p.anchor }]) {
    await assert.rejects(saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => p, write: async () => response }), expectCode('unconfirmed'));
  }
  for (const after of [p, null, change(saved, { description: 'Overwritten' })]) {
    let reads = 0;
    await assert.rejects(saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => reads++ ? after : p, write: async () => ({ anchor: saved.anchor }) }), expectCode('unconfirmed'));
  }
  let reads = 0;
  await assert.rejects(saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => { if (reads++) throw new Error('disconnected'); return p; }, write: async () => ({ anchor: saved.anchor }) }), expectCode('unconfirmed'));
  assert.equal(editor.draft.description, 'Mine');
});

test('retry after an uncertain save confirms already-applied values without writing again', async () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor); editor.draft.description = 'Mine';
  const result = await saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => true, read: async () => change(p, { description: 'Mine', price: '8' }), write: async () => { assert.fail('must not repeat applied write'); } });
  assert.equal(result?.wrote, false); assert.equal(result?.detail.anchor.price, '8');
});

test('benchmark save preserves full metadata and accepts semantic object equality without changing question order', async () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor); const benchmark = { ...p.anchor.benchmark, queries: 2, metadata: { second: 2, first: 1 } };
  editor.draft.benchmark = JSON.stringify(benchmark); let saved = p;
  const result = await saveManageDraft(editor, 'benchmark', p.anchor.id, p.anchor.author, { current: () => true, read: async () => saved, write: async patch => { assert.deepEqual(patch, { benchmark }); saved = change(p, { benchmark: { ...benchmark, metadata: { first: 1, second: 2 } } }); return { anchor: saved.anchor }; } });
  assert.equal(result?.wrote, true); assert.deepEqual((result?.detail.anchor.benchmark as any).extra, { preserve: true });
  const formatting = manageDraftEditor(p.anchor); formatting.draft.benchmark = JSON.stringify(p.anchor.benchmark);
  assert.equal((await saveManageDraft(formatting, 'benchmark', p.anchor.id, p.anchor.author, { current: () => true, read: async () => p, write: async () => { assert.fail('format-only edit'); } }))?.wrote, false);
  editor.draft.benchmark = '{';
  await assert.rejects(saveManageDraft(editor, 'benchmark', p.anchor.id, p.anchor.author, { current: () => true, read: async () => p, write: async () => { assert.fail('invalid benchmark'); } }), e => e instanceof ManageDraftError && e.benchmarkIssue === 'json');
});

test('account departure stops follow-up writes and duplicate saves share the management task', async () => {
  const p = fixture(), editor = manageDraftEditor(p.anchor); editor.draft.description = 'Mine'; let active = true;
  assert.equal(await saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current: () => active, read: async () => { active = false; return p; }, write: async () => { assert.fail('departed'); } }), null);
  active = true; let finish!: () => void;
  const task = createNodeActionTask(); let writes = 0;
  const first = task.run(() => active, current => saveManageDraft(editor, 'fields', p.anchor.id, p.anchor.author, { current, read: async () => p, write: async () => { writes++; await new Promise<void>(resolve => { finish = resolve; }); return { anchor: change(p, { description: 'Mine' }).anchor }; } }));
  await Promise.resolve();
  assert.equal(await task.run(() => active, async () => { writes++; return true; }), null);
  active = false; finish(); assert.equal(await first, null); assert.equal(writes, 1);
});
