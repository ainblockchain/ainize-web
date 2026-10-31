import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Attestation } from '../src/api/types';
import { claimVerification, clearVerification, confirmVerification, prepareVerification, readVerification, reviewVerification,
  reviewVerificationRecovery, sameVerificationReview, saveVerificationJob, verificationOperationKey, verificationReceipt,
  verificationRequest, verificationResultKind, verificationTarget, VerificationActionError, type VerificationReview } from '../src/lib/verificationOperation';
import { followRuntimeOperation, parseRuntimeJob, RuntimeOperationError, type RuntimeJob } from '../src/lib/runtimeOperation';
import { LoadKnowledgeError } from '../src/lib/loadKnowledge';
import { createNodeActionTask } from '../src/lib/accountNodeActions';
import { manageFixture } from './fixtures/manageKnowledge';

const node = '0x' + 'ab'.repeat(20), subject = '0x' + 'bc'.repeat(20), now = 1_800_000_000_000;
const cap = { instance: 'a'.repeat(32), server_time: now, request_window_ms: 600_000, verification_jobs: true, verification_restoration: 1 };
const owner = verificationOperationKey('account-one', node);
const detail = () => ({ ...manageFixture(), status: 'VERIFIED' as const, owned: false });
const review = (): VerificationReview => ({ target: verificationTarget(detail().anchor), node, recheck: false, prior: [] });
const operation = () => prepareVerification(owner, review(), cap, 'b'.repeat(32));
const attestation = (changes: Partial<Attestation> = {}): Attestation => ({ patch_id: 'chosen', verifier: node, patch_sha256: detail().anchor.patch_sha256,
  benchmark_hash: detail().anchor.benchmark_hash, passed: true, verified_on: 'model', score: { free_generation: '4/4' }, samples_run: 4, samples_available: 4,
  created_at: now + 2, sig: 'signed-result', ...changes });
const outcome = (changes: Partial<Attestation> = {}) => ({ result: 'verification recorded', attestation: attestation(changes) });
const job = (state: RuntimeJob['state'] = 'done'): RuntimeJob => ({ id: operation().request.request_id, instance: cap.instance, patch_id: 'chosen', kind: 'verify', state,
  queued_at: now, started_at: state === 'queued' ? null : now + 1, finished_at: state === 'done' || state === 'failed' ? now + 3 : null,
  result: state === 'done' ? outcome().result : null, error: state === 'failed' ? 'runtime_restore_failed: unresolved' : null,
  ...(state === 'done' ? { outcome: outcome() } : state === 'failed' ? { status: 503 } : {}) });
const access = { signedIn: true, isOwner: true, address: node, subject };
const runtime = { available: true, model: 'model', hook: true, applied: [], stack: [] };
const deps = (overrides = {}) => ({ current: () => true, node, subject, readAccess: async (): Promise<unknown> => access,
  read: async (): Promise<unknown> => detail(), runtime: async (): Promise<unknown> => runtime, ...overrides });
const code = (value: string) => (e: unknown) => (e instanceof VerificationActionError || e instanceof RuntimeOperationError || e instanceof LoadKnowledgeError) && e.code === value;
const memory = () => { const values = new Map<string, string>(); return { values, storage: { getItem: (k: string) => values.get(k) ?? null,
  setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } } }; };

test('review requires the current operator and exact public foreign target, before any request exists', async () => {
  assert.deepEqual(await reviewVerification(detail().anchor, deps()), review());
  for (const override of [{ isOwner: false }, { address: subject }, { subject: node }, { signedIn: false }]) {
    await assert.rejects(reviewVerification(detail().anchor, deps({ readAccess: async () => ({ ...access, ...override }) })), code('access'));
  }
  for (const change of [{ name: 'renamed' }, { patch_sha256: 'other-file' }, { author: node }, { benchmark_hash: 'other-benchmark' }, { model: { id_M: 'other' } }, { base: { stack: [] } }]) {
    await assert.rejects(reviewVerification(detail().anchor, deps({ read: async () => ({ ...detail(), anchor: { ...detail().anchor, ...change } }) })), code('changed'));
  }
  const own = { ...detail(), anchor: { ...detail().anchor, author: node } };
  await assert.rejects(reviewVerification(own.anchor, deps({ read: async () => own })), code('self'));
  await assert.rejects(reviewVerification(detail().anchor, deps({ read: async () => ({ ...detail(), status: 'DRAFT' }) })), code('draft'));
});
test('review refuses a loaded benchmark and unknown state; prior signed history changes the recheck decision', async () => {
  const d = detail(); d.anchor.benchmark.samples = [{ prompt: 'q', expect: 'a' }]; d.applied = true;
  await assert.rejects(reviewVerification(d.anchor, deps({ read: async () => d })), code('loaded'));
  await assert.rejects(reviewVerification(d.anchor, deps({ runtime: async () => ({}) })), code('read'));
  const changed = await reviewVerification(detail().anchor, deps({ read: async () => ({ ...detail(), attestations: [attestation()] }) }));
  assert.equal(changed!.recheck, true); assert.deepEqual(changed!.prior, ['signed-result']); assert.equal(sameVerificationReview(review(), changed!), false);
  const incompatible = await reviewVerification(d.anchor, deps({ read: async () => d, runtime: async () => ({ ...runtime, available: false, model: null }) }));
  assert.ok(incompatible); // No promise of a model measurement: server may wait or record integrity only.
});
test('preparation gates restoration-safe capabilities and stores a compact exact request', () => {
  for (const c of [{ ...cap, verification_jobs: false }, { ...cap, verification_restoration: undefined }, { ...cap, instance: 'bad' }, { ...cap, request_window_ms: 1 }]) {
    assert.throws(() => prepareVerification(owner, review(), c, 'b'.repeat(32)), code('unsupported'));
  }
  const op = operation(), request = verificationRequest(op);
  assert.equal(request.body.expected.id, 'chosen'); assert.equal(request.body.recheck, false);
  assert.equal('benchmark' in request.body.expected, false); assert.equal('samples' in request.body.expected, false);
  const r = review(), made = prepareVerification(owner, r, cap, 'b'.repeat(32)); r.target.name = 'changed';
  assert.notEqual(made.target.name, 'changed');
});
test('storage is account/node scoped, claimed once, and cannot overwrite a newer or terminal receipt', () => {
  const m = memory(), op = operation(); claimVerification(m.storage, op);
  assert.throws(() => claimVerification(m.storage, op), code('pending'));
  assert.equal(readVerification(m.storage, verificationOperationKey('account-two', node)), null);
  assert.equal(readVerification(m.storage, verificationOperationKey('account-one', subject)), null);
  saveVerificationJob(m.storage, op, job()); saveVerificationJob(m.storage, op, job('running'));
  assert.equal(readVerification(m.storage, owner)!.job!.state, 'done');
  const newer = { ...op, request: { ...op.request, request_id: `${now}-${'c'.repeat(32)}` }, job: undefined };
  m.storage.setItem(owner, JSON.stringify(newer));
  assert.throws(() => saveVerificationJob(m.storage, op, job()), code('pending')); clearVerification(m.storage, op);
  assert.equal(readVerification(m.storage, owner)!.request.request_id, newer.request.request_id);
  clearVerification(m.storage, newer); assert.equal(readVerification(m.storage, owner), null);
});
test('malformed and unsavable recovery evidence refuses submission rather than losing the original request', () => {
  for (const change of [{ kind: 'load' }, { owner: 'foreign' }, { node: 'bad' }, { recheck: true }, { request: { instance: 'bad' } }, { target: {} }, { job: { ...job(), kind: 'apply' } }]) {
    const m = memory(); m.storage.setItem(owner, JSON.stringify({ ...operation(), ...change })); assert.throws(() => readVerification(m.storage, owner), code('storage'));
  }
  const m = memory(); m.storage.setItem = () => { throw new Error('storage full'); };
  assert.throws(() => claimVerification(m.storage, operation()), code('storage'));
});
test('lost POST response is recovered with GET only and uses a verification receipt, never a load stack', async () => {
  let posts = 0, reads = 0; const states = [job('queued'), job('running'), job()]; const m = memory(), op = operation(); claimVerification(m.storage, op);
  const result = await followRuntimeOperation(op, { current: () => true, submit: async () => { posts++; throw new Error('lost response'); },
    read: async () => { reads++; return { job: states.shift() }; }, save: j => { saveVerificationJob(m.storage, op, j); }, phase() {}, wait: async () => {} });
  assert.deepEqual(result, outcome()); assert.equal(posts, 1); assert.equal(reads, 3);
  const recovered = await followRuntimeOperation(readVerification(m.storage, owner)!, { current: () => true,
    read: async () => assert.fail('terminal saved receipt'), save() {}, phase() {}, wait: async () => {} });
  assert.deepEqual(recovered, outcome()); assert.equal(posts, 1);
  for (const change of [{ kind: 'apply' }, { instance: 'b'.repeat(32) }, { patch_id: 'another' }, { outcome: { result: outcome().result, stack: [] } }]) assert.equal(parseRuntimeJob({ job: { ...job(), ...change } }, op), null);
});
test('failed restoration is persisted and surfaced as a failed job, never a recorded PASS', async () => {
  let saved = false;
  await assert.rejects(followRuntimeOperation(operation(), { current: () => true, read: async () => ({ job: job('failed') }),
    save() { saved = true; }, phase() {}, wait: async () => {} }), e => {
      assert.equal(saved, true); assert.deepEqual(e, { status: 503, data: { error: 'runtime_restore_failed: unresolved' } }); return true;
    });
});
test('completion requires a new exact signed result from this node and matching fresh published history', async () => {
  for (const changes of [{ patch_id: 'foreign' }, { verifier: subject }, { patch_sha256: 'other-file' }, { benchmark_hash: 'other-benchmark' },
    { created_at: now - 1 }, { sig: '' }, { passed: 'yes' }, { score: { bad: Infinity } }, { recheck: true }]) {
    assert.throws(() => verificationReceipt(operation(), outcome(changes as any)), code('unconfirmed'));
  }
  const op = prepareVerification(owner, { ...review(), recheck: true, prior: ['signed-result'] }, cap, 'b'.repeat(32));
  assert.throws(() => verificationReceipt(op, outcome({ recheck: true })), code('unconfirmed'));
  await assert.rejects(confirmVerification(operation(), outcome(), deps()), code('unconfirmed'));
  const fresh = { ...detail(), attestations: [attestation()] };
  assert.deepEqual(await confirmVerification(operation(), outcome(), deps({ read: async () => fresh })), attestation());
  await assert.rejects(confirmVerification(operation(), outcome(), deps({ read: async () => ({ ...fresh, attestations: [attestation({ passed: false })] }) })), code('unconfirmed'));
});
test('recorded FAIL and integrity-only results are complete records, not passed model benchmarks', async () => {
  for (const passed of [true, false]) for (const verified_on of ['model', 'hash-only']) {
    const a = attestation({ passed, verified_on });
    const result = await confirmVerification(operation(), { result: 'recorded', attestation: a }, deps({ read: async () => ({ ...detail(), attestations: [a] }) }));
    assert.equal(result!.passed, passed); assert.equal(verificationResultKind(result!), verified_on === 'hash-only' ? 'integrity' : 'model');
  }
  assert.equal(verificationResultKind(attestation({ samples_run: undefined })), 'record');
  assert.equal(verificationResultKind(attestation({ samples_run: 5 })), 'record');
});
test('recovery inspection cannot dismiss running work or failed reads; expired or changed targets remain reviewable', async () => {
  for (const state of ['queued', 'running'] as const) await assert.rejects(reviewVerificationRecovery(operation(), { ...deps(), readJob: async () => ({ job: job(state) }) }), code('pending'));
  for (const status of [401, 503]) await assert.rejects(reviewVerificationRecovery(operation(), { ...deps(), readJob: async () => { throw { status }; } }), e => (e as any).status === status);
  const absent = async () => { throw { status: 404 }; };
  assert.deepEqual(await reviewVerificationRecovery(operation(), { ...deps(), readJob: absent }), { attestations: [], target: 'current' });
  assert.deepEqual(await reviewVerificationRecovery(operation(), { ...deps({ read: absent }), readJob: absent }), { attestations: [], target: 'missing' });
  const changed = await reviewVerificationRecovery(operation(), { ...deps({ read: async () => ({ ...detail(), anchor: { ...detail().anchor, name: 'edited' }, attestations: [attestation(), attestation({ patch_sha256: 'wrong' })] }) }), readJob: absent });
  assert.equal(changed!.target, 'changed'); assert.deepEqual(changed!.attestations, [attestation()]);
  await assert.rejects(reviewVerificationRecovery(operation(), { ...deps({ read: async () => ({ ...detail(), attestations: [attestation({ created_at: NaN })] }) }), readJob: absent }), code('read'));
});
test('account or route departure suppresses later checks and a shared task rejects duplicate clicks', async () => {
  for (const stage of ['access', 'read', 'runtime']) {
    let current = true;
    const result = await reviewVerification(detail().anchor, deps({ current: () => current,
      readAccess: async () => { if (stage === 'access') current = false; return access; },
      read: async () => { if (stage === 'read') current = false; return detail(); },
      runtime: async () => { if (stage === 'runtime') current = false; return runtime; } }));
    assert.equal(result, null);
  }
  const task = createNodeActionTask(); let finish!: () => void, calls = 0;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  const run = () => task.run(() => true, async () => { calls++; await wait; return true; });
  const first = run(); assert.equal(await run(), null); finish(); assert.equal(await first, true); assert.equal(calls, 1);
});
