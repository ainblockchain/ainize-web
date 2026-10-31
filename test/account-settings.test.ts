import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsSaveTask, readAccountSettings, rebaseSettings, receiveSettings, settingsConflict, settingsDirty, settingsEditor, SettingsSaveError } from '../src/lib/accountSettings';

const base = { display_name: 'Original node', notifications: 'all' as const, payout_address: 'stored legacy value' };
const edit = () => ({ base, draft: { display_name: ' My new name ', notifications: 'all' as const } });
const reply = (settings = base) => ({ settings });
const deferred = () => {
  let resolve!: (v: unknown) => void;
  const promise = new Promise<unknown>(yes => { resolve = yes; });
  return { promise, resolve };
};

test('settings reads reject malformed defaults and refreshes preserve dirty input', () => {
  for (const raw of [null, {}, { settings: [] }, { settings: { ...base, notifications: 'everything' } }, { settings: { ...base, display_name: 1 } }, { settings: { ...base, payout_address: null } }]) assert.equal(readAccountSettings(raw), null);
  assert.equal(readAccountSettings(reply()), base);
  const pristine = settingsEditor(base), next = { ...base, display_name: 'Remote name' };
  assert.equal(settingsDirty(pristine), false);
  assert.equal(receiveSettings(pristine, next).draft.display_name, next.display_name);
  const dirty = edit(); assert.equal(receiveSettings(dirty, next), dirty); assert.equal(settingsConflict(dirty, next), true);
  const rebased = rebaseSettings(dirty, { ...next, notifications: 'none' });
  assert.equal(rebased.draft.display_name, dirty.draft.display_name); assert.equal(rebased.draft.notifications, 'none');
  assert.equal(rebased.base.display_name, next.display_name);
  assert.equal(settingsConflict(rebased, rebased.base), false);
});

test('save sends only edited fields, preserves a concurrent unrelated change and confirms a fresh read', async () => {
  const current = { ...base, notifications: 'sales' as const }, confirmed = { ...current, display_name: 'My new name' };
  const writes: unknown[] = []; let reads = 0;
  const result = await createSettingsSaveTask().run(edit(), {
    active: () => true, read: async () => { reads++; return { settings: reads === 1 ? current : confirmed }; },
    write: async patch => { writes.push(patch); return { settings: confirmed }; },
  });
  assert.deepEqual(writes, [{ display_name: 'My new name' }]); assert.equal(reads, 2);
  assert.deepEqual(result, { settings: confirmed, wrote: true });
  assert.equal(base.display_name, 'Original node');
});

test('a changed edited field, invalid input or unreadable current state stops before any write', async () => {
  for (const [editor, current, code] of [
    [edit(), { ...base, display_name: 'Someone else changed this' }, 'conflict'],
    [{ base, draft: { ...base, display_name: '   ' } }, base, 'input'],
    [edit(), null, 'read'],
  ] as const) {
    let writes = 0;
    await assert.rejects(createSettingsSaveTask().run(editor, { active: () => true, read: async () => ({ settings: current }), write: async () => { writes++; return reply(); } }), e => e instanceof SettingsSaveError && e.code === code);
    assert.equal(writes, 0);
  }
});

test('mismatched acknowledgement and missing post-save confirmation never report success or auto-retry', async () => {
  for (const mode of ['bad_ack', 'read_failure', 'changed_after_write'] as const) {
    let reads = 0, writes = 0;
    const task = createSettingsSaveTask();
    await assert.rejects(task.run(edit(), {
      active: () => true,
      read: async () => { reads++; if (reads === 1) return reply(); if (mode === 'read_failure') throw new Error('offline'); return reply(); },
      write: async () => { writes++; return mode === 'bad_ack' ? {} : { settings: { ...base, display_name: 'My new name' } }; },
    }), e => e instanceof SettingsSaveError && e.code === 'unconfirmed');
    assert.equal(writes, 1); assert.equal(task.pending(), false);
    assert.equal(reads, mode === 'bad_ack' ? 1 : 2);
  }
});

test('an already-applied retry confirms current values without repeating the write', async () => {
  let writes = 0;
  const confirmed = { ...base, display_name: 'My new name' };
  const result = await createSettingsSaveTask().run(edit(), { active: () => true, read: async () => ({ settings: confirmed }), write: async () => { writes++; return {}; } });
  assert.deepEqual(result, { settings: confirmed, wrote: false }); assert.equal(writes, 0);
});

test('single-flight save and departed accounts stop follow-up writes and ignore completed outcomes', async () => {
  const task = createSettingsSaveTask(), pending = deferred(); let active = true, reads = 0, writes = 0;
  const deps = { active: () => active, read: () => { reads++; return pending.promise; }, write: async () => { writes++; return reply(); } };
  const first = task.run(edit(), deps); assert.equal(task.pending(), true);
  assert.equal(await task.run(edit(), deps), null); assert.equal(reads, 1);
  active = false; pending.resolve(reply()); assert.equal(await first, null); assert.equal(writes, 0);
  const writePending = deferred(); active = true;
  const second = task.run(edit(), { ...deps, read: async () => reply(), write: () => writePending.promise });
  await Promise.resolve(); task.abandon();
  writePending.resolve({ settings: { ...base, display_name: 'My new name' } });
  assert.equal(await second, null); assert.equal(task.pending(), false);
});
