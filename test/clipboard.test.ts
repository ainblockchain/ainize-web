import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClipboardTask, writeClipboard, clipboardUrl, type CopyPhase } from '../src/lib/clipboard';

const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('a pending copy is not duplicated and reports success only after the selected value is written', async () => {
  const pending = deferred<boolean>();
  const writes: string[] = [], phases: CopyPhase[] = [];
  const task = createClipboardTask(async text => { writes.push(text); return pending.promise; }, () => () => {});
  const first = task.copy('exact selected value', () => true, phase => phases.push(phase));
  await task.copy('exact selected value', () => true, phase => phases.push(phase));
  assert.deepEqual(writes, ['exact selected value']);
  assert.deepEqual(phases, ['copying']);
  pending.resolve(true); await first;
  assert.deepEqual(phases, ['copying', 'copied']);
});

test('failure stays visible and a retry cannot be cleared by a prior success timer', async () => {
  const timers: (() => void)[] = [], phases: CopyPhase[] = [];
  let succeed = true, cleared = 0;
  const task = createClipboardTask(async () => succeed, callback => { timers.push(callback); return () => { cleared++; }; });
  const update = (phase: CopyPhase) => phases.push(phase);
  await task.copy('value', () => true, update);
  succeed = false;
  await task.copy('value', () => true, update);
  timers[0]();
  assert.equal(phases.at(-1), 'failed');
  assert.equal(timers.length, 1, 'failure is not hidden on a timeout');
  assert.equal(cleared, 1);
  succeed = true;
  await task.copy('value', () => true, update);
  timers[1]();
  assert.equal(phases.at(-1), 'idle');
});

test('old target completions cannot mark a replacement target as copied, including A to B to A', async () => {
  const pending = deferred<boolean>();
  const oldPhases: CopyPhase[] = [];
  const old = createClipboardTask(() => pending.promise, () => () => {});
  let selected = old;
  const work = old.copy('A', () => selected === old, phase => oldPhases.push(phase));
  selected = createClipboardTask();
  old.cancel();
  selected = createClipboardTask(); // A again has a fresh task, not the earlier copy's identity.
  pending.resolve(true); await work;
  assert.deepEqual(oldPhases, ['copying']);
});

test('cleanup suppresses late outcomes and permits effect remount without a stuck pending state', async () => {
  const first = deferred<boolean>();
  const phases: CopyPhase[] = [];
  let calls = 0;
  const task = createClipboardTask(() => ++calls === 1 ? first.promise : Promise.resolve(true), () => () => {});
  const old = task.copy('same value', () => true, phase => phases.push(phase));
  task.cancel();
  await task.copy('same value', () => true, phase => phases.push(phase));
  first.resolve(false); await old;
  assert.deepEqual(phases, ['copying', 'copying', 'copied']);
});

function fallbackDocument(result: boolean | Error, badFocus = false) {
  const calls: string[] = [];
  const range = {};
  const prior = { tagName: 'INPUT', isConnected: true, selectionStart: 2, selectionEnd: 4, selectionDirection: 'backward',
    focus: () => { calls.push('restore focus'); if (badFocus) throw Error('detached'); doc.activeElement = prior; },
    setSelectionRange: (start: number, end: number, direction: string) => { assert.deepEqual([start, end, direction], [2, 4, 'backward']); calls.push('restore caret'); },
  };
  const area = { value: '', style: { cssText: '' }, readOnly: false, tabIndex: 0,
    setAttribute: () => {}, focus: () => { doc.activeElement = area; }, select: () => { calls.push('select'); },
    remove: () => { calls.push('remove'); doc.activeElement = doc.body; },
  };
  const doc: any = {
    activeElement: prior, body: { appendChild: () => calls.push('append') },
    createElement: () => area,
    execCommand: (command: string) => { assert.equal(command, 'copy'); calls.push('copy'); if (result instanceof Error) throw result; return result; },
    getSelection: () => ({ rangeCount: 1, getRangeAt: () => ({ cloneRange: () => range }), removeAllRanges: () => calls.push('clear selection'), addRange: (value: unknown) => { assert.equal(value, range); calls.push('restore selection'); } }),
  };
  return { doc: doc as Document, area, calls };
}

test('HTTP fallback copies the exact text then removes its temporary input and restores focus and selection', async () => {
  const { doc, area, calls } = fallbackDocument(true);
  assert.equal(await writeClipboard('multi\nline value', () => true, { document: doc }), true);
  assert.equal(area.value, 'multi\nline value');
  assert.deepEqual(calls, ['append', 'select', 'copy', 'remove', 'restore focus', 'restore caret', 'clear selection', 'restore selection']);
});

test('failed fallback still cleans up, while a failed focus restoration does not misreport a successful copy', async () => {
  for (const result of [false, Error('denied')]) {
    const { doc, calls } = fallbackDocument(result);
    assert.equal(await writeClipboard('value', () => true, { document: doc }), false);
    assert.ok(calls.includes('remove'));
    assert.ok(calls.includes('restore caret'));
  }
  const { doc } = fallbackDocument(true, true);
  assert.equal(await writeClipboard('value', () => true, { document: doc }), true);
});

test('leaving during a denied modern copy never starts a fallback for the old text', async () => {
  const pending = deferred<void>(), { doc, calls } = fallbackDocument(true);
  let active = true;
  const work = writeClipboard('old secret', () => active, { clipboard: { writeText: () => pending.promise }, document: doc });
  active = false; pending.reject(Error('denied'));
  assert.equal(await work, false);
  assert.deepEqual(calls, []);
});

test('empty or unavailable clipboard targets cannot report success or clear existing clipboard contents', async () => {
  let writes = 0;
  const environment = { clipboard: { writeText: async () => { writes++; } } };
  assert.equal(await writeClipboard(' \n', () => true, environment), false);
  assert.equal(await writeClipboard('value', () => false, environment), false);
  assert.equal(writes, 0);
  assert.equal(await writeClipboard('value', () => true, {}), false);
});

test('card copy addresses keep the selected peer or resolve the exact local path', () => {
  assert.equal(clipboardUrl('https://peer.example/api/a2a/chosen', 'https://local.example'), 'https://peer.example/api/a2a/chosen');
  assert.equal(clipboardUrl('/api/sam/node/agents/chosen', 'https://local.example'), 'https://local.example/api/sam/node/agents/chosen');
  assert.equal(clipboardUrl('', 'https://local.example'), '');
  assert.equal(clipboardUrl('https://[', 'https://local.example'), '');
});
