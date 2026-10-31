import { test } from 'node:test';
import assert from 'node:assert/strict';
import { challengeAvailability, requestManagedChallenge, ManageChallengeError } from '../src/lib/manageChallenge';
import { createNodeActionTask } from '../src/lib/accountNodeActions';
import { manageFixture } from './fixtures/manageKnowledge';

const node = '0x' + 'ab'.repeat(20), subject = '0x' + 'bc'.repeat(20), other = '0x' + 'cd'.repeat(20);
const reason = 'The current answer contradicts the new evidence.';
const p = () => ({ ...manageFixture(), status: 'VERIFIED' as const, challenge_log: [] });
const challenge = (overrides = {}) => ({ patch_id: 'chosen', challenger: node, reason, created_at: 500, ...overrides });
const access = { signedIn: true, isOwner: true, address: node, subject };
const noWrite = async () => { assert.fail('must not submit'); };
const code = (value: string) => (e: unknown) => e instanceof ManageChallengeError && e.code === value;
const deps = (overrides = {}) => ({ current: () => true, read: async (): Promise<unknown> => p(), readAccess: async (): Promise<unknown> => access, write: noWrite as (reason: string) => Promise<unknown>, now: () => 1000, ...overrides });

test('challenge eligibility matches the current-node open and 24-hour dismissed rules', () => {
  assert.deepEqual(challengeAvailability(p(), node, 1000), { kind: 'ready' });
  assert.deepEqual(challengeAvailability({ ...p(), status: 'DRAFT' }, node, 1000), { kind: 'state' });
  const row = { challenge: challenge(), state: 'open' as const };
  assert.equal(challengeAvailability({ ...p(), challenge_log: [row] }, node.toUpperCase().replace('0X', '0x'), 1000).kind, 'open');
  assert.equal(challengeAvailability({ ...p(), challenge_log: [{ ...row, challenge: challenge({ challenger: other }) }] }, node, 1000).kind, 'ready');
  const dismissed = { ...p(), challenge_log: [{ ...row, state: 'dismissed' as const, answered_at: 600 }] };
  assert.deepEqual(challengeAvailability(dismissed, node, 1000), { kind: 'cooldown', until: 600 + 86400000 });
  assert.equal(challengeAvailability(dismissed, node, 600 + 86400000).kind, 'ready');
  assert.equal(challengeAvailability({ ...dismissed, challenge_log: [{ ...dismissed.challenge_log[0], state: 'upheld' }] }, node, 1000).kind, 'ready');
});

test('missing or malformed history cannot become an eligible empty history', () => {
  for (const log of [undefined, {}, [null], [{ state: 'open', challenge: challenge({ patch_id: 'other' }) }], [{ state: 'dismissed', challenge: challenge() }], [{ state: 'open', challenge: challenge({ created_at: NaN }) }]]) {
    assert.equal(challengeAvailability({ ...p(), challenge_log: log } as any, node, 1000).kind, 'read');
  }
  assert.equal(challengeAvailability(p(), null, 1000).kind, 'read');
});

test('challenge validates the reason, fresh account/node and artifact before any write', async () => {
  await assert.rejects(requestManagedChallenge(p(), node, subject, ' '.repeat(20) + 'too short', deps()), code('reason'));
  for (const freshAccess of [{ ...access, address: other }, { ...access, subject: other }, { ...access, signedIn: false }, { ...access, isOwner: false }]) {
    await assert.rejects(requestManagedChallenge(p(), node, subject, reason, deps({ readAccess: async () => freshAccess })), code('access'));
  }
  for (const [fresh, error] of [[{ ...p(), owned: false }, 'read'], [{ ...p(), anchor: { ...p().anchor, patch_sha256: 'changed' } }, 'changed'], [{ ...p(), status: 'DRAFT' }, 'state'], [{ ...p(), challenge_log: [{ state: 'open', challenge: challenge() }] }, 'open']] as const) {
    await assert.rejects(requestManagedChallenge(p(), node, subject, reason, deps({ read: async () => fresh })), code(error));
  }
});

test('success requires the exact registered challenge, even if it was already answered', async () => {
  for (const state of ['open', 'dismissed', 'upheld'] as const) {
    let reads = 0, writes = 0;
    const after = { ...p(), challenge_log: [{ challenge: challenge(), state, ...(state !== 'open' ? { answered_at: 600 } : {}) }] };
    const result = await requestManagedChallenge(p(), node, subject, `  ${reason}  `, deps({ read: async () => reads++ ? after : p(), write: async (text: string) => { writes++; assert.equal(text, reason); return { ok: true, challenge: challenge(), record: { address: node, filed: 1, open: state === 'open' ? 1 : 0 } }; } }));
    assert.equal(result?.detail, after); assert.equal(reads, 2); assert.equal(writes, 1);
  }
});

test('wrong or reused acknowledgements and aggregate counts cannot confirm a request', async () => {
  for (const reply of [{ ok: false, challenge: challenge() }, { ok: true, record: { address: node, filed: 1 } }, ...[{ patch_id: 'other' }, { challenger: other }, { reason: 'different text' }, { created_at: null }].map(v => ({ ok: true, challenge: challenge(v) }))]) {
    await assert.rejects(requestManagedChallenge(p(), node, subject, reason, deps({ write: async () => reply })), code('unconfirmed'));
  }
  const before = { ...p(), challenge_log: [{ state: 'upheld', challenge: challenge(), answered_at: 600 }] };
  await assert.rejects(requestManagedChallenge(p(), node, subject, reason, deps({ read: async () => before, write: async () => ({ ok: true, challenge: challenge() }) })), code('unconfirmed'));
});

test('unavailable or mismatching follow-up history never reports success or repeats the request', async () => {
  for (const after of [p(), null, { ...p(), challenge_log: [{ state: 'open', challenge: challenge({ created_at: 501 }) }] }, { ...p(), challenge_log: [{ state: 'open', challenge: challenge({ challenger: other }) }] }, { ...p(), challenge_log: [{ state: 'open', challenge: challenge({ reason: 'other' }) }] }]) {
    let reads = 0, writes = 0;
    await assert.rejects(requestManagedChallenge(p(), node, subject, reason, deps({ read: async () => reads++ ? after : p(), write: async () => { writes++; return { ok: true, challenge: challenge() }; } })), code('unconfirmed'));
    assert.equal(writes, 1);
  }
  await assert.rejects(requestManagedChallenge(p(), node, subject, reason, deps({ write: async () => { throw new Error('connection lost after submission'); } })), code('unconfirmed'));
  let reads = 0;
  await assert.rejects(requestManagedChallenge(p(), node, subject, reason, deps({ read: async () => { if (reads++) throw new Error('unavailable'); return p(); }, write: async () => ({ ok: true, challenge: challenge() }) })), code('unconfirmed'));
});

test('account or view departure stops later writes, rereads and success', async () => {
  for (const stage of ['access', 'read', 'write', 'after']) {
    let current = true, reads = 0, writes = 0;
    const result = await requestManagedChallenge(p(), node, subject, reason, deps({ current: () => current,
      readAccess: async () => { if (stage === 'access') current = false; return access; },
      read: async () => { reads++; if (stage === 'read' || stage === 'after' && reads === 2) current = false; return reads === 1 ? p() : { ...p(), challenge_log: [{ state: 'open', challenge: challenge() }] }; },
      write: async () => { writes++; if (stage === 'write') current = false; return { ok: true, challenge: challenge() }; },
    }));
    assert.equal(result, null); assert.equal(writes, ['access', 'read'].includes(stage) ? 0 : 1); assert.equal(reads, stage === 'access' ? 0 : stage === 'after' ? 2 : 1);
  }
});

test('the management single-flight task prevents duplicate challenge submission', async () => {
  const task = createNodeActionTask(); let writes = 0, release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; }); let reads = 0;
  const run = () => task.run(() => true, current => requestManagedChallenge(p(), node, subject, reason, deps({ current,
    read: async () => reads++ ? { ...p(), challenge_log: [{ state: 'open', challenge: challenge() }] } : p(),
    write: async () => { writes++; await wait; return { ok: true, challenge: challenge() }; },
  })));
  const first = run(); assert.equal(await run(), null); release(); assert.ok(await first); assert.equal(writes, 1);
});
