import { test } from 'node:test';
import assert from 'node:assert/strict';
import { confirmedPatchDestination, createNewPatchTask, patchIdForDraft, PatchSaveError, requestNewPatch, type PatchProgress, type PatchSaveState } from '../src/lib/newPatchSubmission';
import { createDraftJournal } from '../src/lib/draftJournal';

const author = '0x' + 'ab'.repeat(20);
const intent = { id: 'selected-v2', name: 'Selected', modelId: 'selected-model', author };
const answer = { anchor: { id: intent.id, name: intent.name, model: { id_M: intent.modelId }, author } };
const deferred = () => {
  let resolve!: (value: unknown) => void, reject!: (error: unknown) => void;
  const result = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { result, resolve, reject };
};

test('saved destination uses the confirmed exact author, normalized id, name and model', () => {
  assert.equal(patchIdForDraft('   ', '  Name / Here  '), 'name-here');
  assert.equal(patchIdForDraft('ABC / DEF', 'ignored'), 'abc-def');
  assert.equal(patchIdForDraft('a'.repeat(80), 'ignored').length, 64);
  assert.equal(confirmedPatchDestination(answer, intent), `/project/${author}/${intent.id}`);
  for (const raw of [null, {}, { anchor: null }, ...[
    { id: 'other' }, { name: 'Other' }, { author: '0x' + 'cd'.repeat(20) }, { author: 'invalid' }, { model: { id_M: 'other' } },
  ].map(patch => ({ anchor: { ...answer.anchor, ...patch } }))]) assert.equal(confirmedPatchDestination(raw, intent), null);
  const uppercase = '0x' + 'AB'.repeat(20);
  assert.equal(confirmedPatchDestination({ anchor: { ...answer.anchor, author: uppercase } }, intent), `/project/${uppercase}/${intent.id}`);
});

test('double-submit sends once; only a matching acknowledgement permits completion', async () => {
  const task = createNewPatchTask(), pending = deferred(), states: PatchSaveState[] = [];
  let sends = 0;
  const deps = { active: () => true, emit: (s: PatchSaveState) => states.push(s), progress: () => {}, send: () => { sends++; return { result: pending.result, abort() {} }; } };
  const first = task.run(intent, deps);
  assert.equal(task.pending(), true);
  await task.run(intent, deps); assert.equal(sends, 1);
  pending.resolve(answer); await first;
  assert.equal(task.pending(), false);
  assert.deepEqual(states, [{ phase: 'saving' }, { phase: 'saved', destination: `/project/${author}/${intent.id}` }]);
});

test('mismatched or empty success responses preserve the draft and never navigate', async () => {
  for (const raw of [null, {}, { anchor: { ...answer.anchor, id: 'another' } }]) {
    const states: PatchSaveState[] = [];
    await createNewPatchTask().run(intent, { active: () => true, emit: s => states.push(s), progress() {}, send: () => ({ result: Promise.resolve(raw), abort() {} }) });
    assert.deepEqual(states, [{ phase: 'saving' }, { phase: 'uncertain', reason: 'unconfirmed' }]);
  }
});

test('departed views and changed accounts ignore progress, completion and failures', async () => {
  for (const outcome of ['resolve', 'reject'] as const) {
    let active = true, progress = 0;
    const pending = deferred(), states: PatchSaveState[] = [];
    let update!: (v: PatchProgress) => void;
    const work = createNewPatchTask().run(intent, { active: () => active, emit: s => states.push(s), progress: () => progress++, send: cb => { update = cb; return { result: pending.result, abort() {} }; } });
    active = false; update({ sent: 10, total: 20 });
    pending[outcome](outcome === 'resolve' ? answer : new Error('late failure')); await work;
    assert.equal(progress, 0); assert.deepEqual(states, [{ phase: 'saving' }]);
  }
});

test('stop-waiting reports uncertainty and an older outcome cannot finish or unlock a newer submission', async () => {
  const task = createNewPatchTask(), old = deferred(), next = deferred(), states: PatchSaveState[] = [];
  let aborted = 0, progress = 0, update!: (v: PatchProgress) => void;
  const deps = { active: () => true, emit: (s: PatchSaveState) => states.push(s), progress: () => progress++ };
  const first = task.run(intent, { ...deps, send: cb => { update = cb; return { result: old.result, abort: () => aborted++ }; } });
  task.cancel(); assert.equal(aborted, 1); assert.deepEqual(states.at(-1), { phase: 'uncertain', reason: 'cancelled' });
  const second = task.run(intent, { ...deps, send: () => ({ result: next.result, abort() {} }) });
  update({ sent: 20, total: 20 }); old.resolve(answer); await first;
  assert.equal(progress, 0); assert.equal(task.pending(), true);
  assert.equal(states.filter(s => s.phase === 'saved').length, 0);
  next.resolve(answer); await second; assert.equal(task.pending(), false);
  assert.equal(states.filter(s => s.phase === 'saved').length, 1);
});

test('abandon aborts the request silently; transport errors release single flight without automatic retries', async () => {
  const task = createNewPatchTask(), pending = deferred(), states: PatchSaveState[] = [];
  let sends = 0, aborted = 0;
  const deps = { active: () => true, emit: (s: PatchSaveState) => states.push(s), progress() {} };
  const work = task.run(intent, { ...deps, send: () => { sends++; return { result: pending.result, abort: () => { aborted++; pending.reject(new PatchSaveError('cancelled')); } }; } });
  task.abandon(); await work;
  assert.equal(aborted, 1); assert.equal(sends, 1); assert.deepEqual(states, [{ phase: 'saving' }]);
  await task.run(intent, { ...deps, send: () => { sends++; throw new Error('send failed'); } });
  assert.equal(task.pending(), false); assert.equal(sends, 2); assert.equal(states.at(-1)?.phase, 'error');
});

class FakeXhr {
  upload: { onprogress?: (e: any) => void } = {};
  onload?: () => void; onerror?: () => void; ontimeout?: () => void; onabort?: () => void;
  withCredentials = false; status = 200; responseText = JSON.stringify(answer);
  opened: unknown[] = []; body?: FormData; aborted = false;
  open(...args: unknown[]) { this.opened = args; }
  send(body: FormData) { this.body = body; }
  abort() { this.aborted = true; this.onabort?.(); }
}
test('XHR sends exactly the selected body and uses measured bounded multipart progress', async () => {
  const xhr = new FakeXhr(), body = new FormData(), progress: PatchProgress[] = [];
  body.set('path', '/server/selected.npz');
  const request = requestNewPatch(body, value => progress.push(value), () => xhr as unknown as XMLHttpRequest);
  assert.deepEqual(xhr.opened, ['POST', '/api/patches']); assert.equal(xhr.body, body); assert.equal(xhr.withCredentials, true);
  for (const event of [{ lengthComputable: false, loaded: 3, total: 5 }, { lengthComputable: true, loaded: 2, total: 0 }, { lengthComputable: true, loaded: -1, total: 5 }, { lengthComputable: true, loaded: 2, total: 5 }, { lengthComputable: true, loaded: 10, total: 5 }]) xhr.upload.onprogress?.(event);
  assert.deepEqual(progress, [{ sent: 2, total: 5 }, { sent: 5, total: 5 }]);
  xhr.onload?.(); assert.deepEqual(await request.result, answer);
});

test('XHR preserves HTTP failures, distinguishes interrupted requests, and never invents a parsed success', async () => {
  for (const kind of ['http', 'network', 'timeout', 'cancel', 'malformed'] as const) {
    const xhr = new FakeXhr();
    const request = requestNewPatch(new FormData(), () => {}, () => xhr as unknown as XMLHttpRequest);
    if (kind === 'http') { xhr.status = 409; xhr.responseText = '{"error":"id exists"}'; xhr.onload?.(); await assert.rejects(request.result, e => (e as any).status === 409); }
    else if (kind === 'malformed') { xhr.responseText = '<html>not a saved anchor</html>'; xhr.onload?.(); assert.equal(await request.result, null); }
    else {
      if (kind === 'network') xhr.onerror?.(); else if (kind === 'timeout') xhr.ontimeout?.(); else request.abort();
      await assert.rejects(request.result, e => e instanceof PatchSaveError && e.reason === (kind === 'cancel' ? 'cancelled' : 'network'));
    }
  }
});

test('draft journal reports storage failure and completion prevents late unmount writes from resurrecting it', () => {
  const data = new Map<string, string>();
  const storage = { setItem: (key: string, text: string) => { data.set(key, text); }, removeItem: (key: string) => { data.delete(key); } };
  const own = createDraftJournal(() => storage, 'account/source');
  assert.equal(own.save('{broken draft'), true); assert.equal(data.get('account/source'), '{broken draft');
  assert.equal(own.complete(), true); own.save('late old draft'); assert.equal(data.has('account/source'), false);
  const blocked = createDraftJournal(() => { throw new Error('storage denied'); }, 'other');
  assert.equal(blocked.save('draft'), false); assert.equal(blocked.complete(), false);
});
