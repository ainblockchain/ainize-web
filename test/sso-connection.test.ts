import test from 'node:test';
import assert from 'node:assert/strict';
import { connectReviewedAccount, connectionSessionMatches, readConnectionReview, SsoConnectionError, type SsoConnectionReview } from '../src/lib/ssoConnection';
const node = '0x' + 'b'.repeat(40);
const review = (): SsoConnectionReview => ({ request: 'a'.repeat(64), issuer: 'https://issuer.test', subject: 'fixture-account', name: 'Fixture', email: 'ain@example.test', next: '/apps?q=chosen#list', expiresAt: Date.now() + 60000, legacy: { principal: 'google:123', email: 'old@example.test' } });
const session = (r: SsoConnectionReview) => ({ address: node, sso: { sub: r.subject, principal: r.legacy!.principal } });
const receipt = (r: SsoConnectionReview) => ({ ok: true, request: r.request, subject: r.subject, principal: r.legacy!.principal, next: r.next });
const code = (value: string) => (e: unknown) => e instanceof SsoConnectionError && e.code === value;

test('reviews reject ambiguous fields, foreign destinations and malformed identity comparisons', () => {
  const r = review(); assert.deepEqual(readConnectionReview(r), r);
  for (const patch of [{ request: '' }, { subject: 'bad/sub' }, { next: '//elsewhere.test' }, { next: '/signing' }, { expiresAt: NaN }, { legacy: { email: 'only@example.test' } }, { legacy: { principal: 'sso:chosen', email: 'x' } }, { extra: true }]) assert.equal(readConnectionReview({ ...r, ...patch }), null);
});

test('connect uses the exact review then confirms the selected account through a fresh session read', async () => {
  const r = review(), calls: string[] = [];
  assert.equal(await connectReviewedAccount(r, 'legacy', node, {
    current: () => true, read: async () => { calls.push('read'); return { connectionReview: r }; },
    attempting: () => calls.push('attempt'), refused: () => assert.fail('not refused'),
    write: async (choice, expected) => { calls.push('write'); assert.equal(choice, 'legacy'); assert.deepEqual(expected, r); return receipt(r); },
    session: async () => { calls.push('session'); return session(r); },
  }), true);
  assert.deepEqual(calls, ['read', 'attempt', 'write', 'session']);
});

test('changed pending identity, legacy selection, expiry snapshot or return target refuses before connecting', async () => {
  const r = review();
  for (const patch of [{ request: 'c'.repeat(64) }, { subject: 'another' }, { legacy: null }, { email: 'different@example.test' }, { expiresAt: r.expiresAt + 1000 }, { next: '/models' }]) {
    await assert.rejects(connectReviewedAccount(r, 'legacy', node, { current: () => true, read: async () => ({ connectionReview: { ...r, ...patch } }),
      attempting: () => assert.fail('not attempted'), refused() {}, write: async () => assert.fail('changed'), session: async () => assert.fail('changed'),
    }), code('changed'));
  }
});

test('lost replies only recover when the reviewed AIN account and selected legacy account are both current', async () => {
  const r = review();
  for (const result of [session(r), { ...session(r), address: 'other-node' }, { address: node, sso: { sub: 'other', principal: r.legacy!.principal } }, { address: node, sso: { sub: r.subject, principal: 'google:456' } }, null]) {
    let writes = 0;
    const action = connectReviewedAccount(r, 'legacy', node, { current: () => true, read: async () => ({ connectionReview: r }), attempting() {}, refused() {},
      write: async () => { writes++; throw new Error('reply lost'); }, session: async () => result,
    });
    if (connectionSessionMatches(result, r, 'legacy', node)) assert.equal(await action, true);
    else await assert.rejects(action, code('unconfirmed'));
    assert.equal(writes, 1);
  }
});

test('mismatched acknowledgements never become success even if a cached account could match', async () => {
  const r = review();
  for (const patch of [{ ok: false }, { request: 'c'.repeat(64) }, { subject: 'other' }, { principal: 'google:other' }, { next: '/wrong' }]) {
    await assert.rejects(connectReviewedAccount(r, 'legacy', node, { current: () => true, read: async () => ({ connectionReview: r }), attempting() {}, refused() {},
      write: async () => ({ ...receipt(r), ...patch }), session: async () => assert.fail('invalid receipt'),
    }), code('unconfirmed'));
  }
});

test('explicit refusal enables review again, whereas read failure after a write remains unconfirmed', async () => {
  const r = review(); let refused = 0;
  await assert.rejects(connectReviewedAccount(r, 'legacy', node, { current: () => true, read: async () => ({ connectionReview: r }), attempting() {}, refused: () => { refused++; },
    write: async () => { throw { status: 409 }; }, session: async () => assert.fail('refused'),
  }), code('changed')); assert.equal(refused, 1);
  await assert.rejects(connectReviewedAccount(r, 'legacy', node, { current: () => true, read: async () => ({ connectionReview: r }), attempting() {}, refused: () => assert.fail('uncertain'),
    write: async () => receipt(r), session: async () => { throw new Error('offline'); },
  }), code('unconfirmed'));
});

test('route departure after preflight, write or session read suppresses every later action', async () => {
  const r = review();
  for (const step of ['read', 'write', 'session']) {
    let current = true;
    const event = (which: string) => { assert.equal(current, true); if (step === which) current = false; };
    assert.equal(await connectReviewedAccount(r, 'legacy', node, { current: () => current,
      read: async () => { event('read'); return { connectionReview: r }; }, attempting() {}, refused() {},
      write: async () => { event('write'); return receipt(r); }, session: async () => { event('session'); return session(r); },
    }), false);
  }
});

test('continue without a new link still requires the selected AIN account, including its already-linked principal', () => {
  const r = review();
  assert.ok(connectionSessionMatches({ address: node, sso: { sub: r.subject, principal: 'sso:' + r.subject } }, r, 'new', node));
  assert.ok(connectionSessionMatches(session(r), r, 'new', node));
  assert.equal(connectionSessionMatches({ address: node, sso: { sub: 'another', principal: 'sso:' + r.subject } }, r, 'new', node), false);
});
