import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appDomainHostname, appDomainLabel, createDomainOperation, readAppDomain, readAppDomains } from '../src/lib/projectDomains';
import type { AppDomain } from '../src/api/projects';
const row = (hostname = 'app.example.com', extra: Partial<AppDomain> = {}): AppDomain => ({ hostname, projectId: 'project', token: `ainize-verification=${'a'.repeat(48)}`, status: 'pending', message: 'Add DNS', createdAt: 1, checkedAt: null, ...extra });
const list = (domains: AppDomain[]) => ({ domains, addresses: ['203.0.113.1', '2001:db8::1'], cname: 'ingress.example.com', managedBase: 'platform.com' });

test('domain input normalizes public hostnames but never silently accepts a URL, IP or private hostname', () => {
  assert.equal(appDomainHostname(' APP.Example.COM. '), 'app.example.com');
  assert.equal(appDomainHostname('bücher.de'), 'xn--bcher-kva.de');
  for (const s of ['https://app.com', 'app.com/path', 'app.com:443', '*.app.com', 'user@app.com', '127.1', '127.0.0.1', '[::1]', 'localhost', 'a.local', 'a..com', '-a.com', 'a.com?x', 'a.com#x', 'a.com%2fpath']) assert.equal(appDomainHostname(s), null, s);
  assert.equal(appDomainLabel(' Next-App '), 'next-app');
  for (const s of ['', '-app', 'app-', 'a.b', 'a'.repeat(64)]) assert.equal(appDomainLabel(s), null);
});

test('domain evidence validates exact scope, uniqueness, status, DNS values and the managed address base', () => {
  assert.equal(readAppDomains(list([row()]), 'project')?.domains[0].hostname, 'app.example.com');
  for (const raw of [null, {}, { ...list([]), domains: [null] }, list([row(), row()]), list([row('app.example.com', { projectId: 'other' })]),
    { ...list([]), addresses: ['not-an-ip'] }, { ...list([]), addresses: ['1.2.3.999'] }, { ...list([]), cname: 'https://wrong.com' },
    list([row('wrong.com', { managed: true })]), list([row('one.platform.com', { managed: true }), row('two.platform.com', { managed: true })]),
  ]) assert.equal(readAppDomains(raw, 'project'), null);
  assert.equal(readAppDomain({ ...row(), status: 'unknown' }, 'project'), null);
  assert.equal(readAppDomain({ ...row(), token: '' }, 'project'), null);
  assert.equal(readAppDomain(row(), 'project', 'different.com'), null);
});

test('add waits for its own receipt and a fresh matching claim before confirming the draft', async () => {
  const gate = createDomainOperation(); let reads = 0, sends = 0;
  const result = await gate.run('project', { kind: 'add', hostname: 'app.example.com' }, {
    active: () => true, read: async () => (++reads === 1 ? list([]) : list([row()])), send: async () => { sends++; return row(); },
  });
  assert.equal(typeof result === 'object' && result.hostname, 'app.example.com'); assert.equal(reads, 2); assert.equal(sends, 1); assert.equal(gate.uncertain(), false);
});

test('an explicit claim changed before check/remove/rename is never mutated', async () => {
  for (const kind of ['check', 'remove', 'rename'] as const) {
    const previous = row('old.platform.com', { managed: kind === 'rename' });
    const gate = createDomainOperation();
    const action = kind === 'rename' ? { kind, hostname: 'new.platform.com', previous, base: 'platform.com' } : { kind, hostname: previous.hostname, previous };
    await assert.rejects(gate.run('project', action, {
      active: () => true, read: async () => list([{ ...previous, token: `ainize-verification=${'b'.repeat(48)}` }]), send: async () => assert.fail('must not send'),
    }), /changed/);
    assert.equal(gate.blocked(), false);
  }
});

test('rename requires the new managed claim and disappearance of the previous address', async () => {
  const previous = row('old.platform.com', { managed: true }), next = row('new.platform.com', { managed: true, token: `ainize-verification=${'b'.repeat(48)}` });
  for (const after of [list([next]), list([previous]), list([])]) {
    const gate = createDomainOperation(); let reads = 0;
    const call = gate.run('project', { kind: 'rename', hostname: next.hostname, previous, base: 'platform.com' }, { active: () => true,
      read: async () => ++reads === 1 ? list([previous]) : after, send: async () => next });
    if (after.domains[0] === next) assert.equal((await call as AppDomain).hostname, next.hostname);
    else { await assert.rejects(call, /unconfirmed/); assert.equal(gate.uncertain(), true); }
  }
});

test('delete confirms current absence, never a 204 response alone', async () => {
  for (const remains of [false, true]) {
    const gate = createDomainOperation(); let reads = 0;
    const call = gate.run('project', { kind: 'remove', hostname: row().hostname, previous: row() }, { active: () => true,
      read: async () => ++reads === 1 || remains ? list([row()]) : list([]), send: async () => undefined });
    if (remains) { await assert.rejects(call); assert.equal(gate.uncertain(), true); }
    else assert.equal(await call, 'removed');
  }
});

test('wrong receipts, stale check readback and transport ambiguity cannot repeat an operation', async () => {
  const previous = row(), checked = row(previous.hostname, { status: 'verified', checkedAt: 10 });
  for (const receipt of [row('wrong.example.com'), { ...checked, projectId: 'other' }, checked]) {
    const gate = createDomainOperation();
    await assert.rejects(gate.run('project', { kind: 'check', hostname: previous.hostname, previous }, { active: () => true, read: async () => list([previous]), send: async () => receipt }));
    assert.equal(gate.blocked(), true);
    assert.equal(await gate.run('project', { kind: 'add', hostname: 'another.com' }, { active: () => true, read: async () => assert.fail(), send: async () => assert.fail() }), undefined);
  }
  const lost = createDomainOperation();
  await assert.rejects(lost.run('project', { kind: 'add', hostname: 'app.example.com' }, { active: () => true, read: async () => list([]), send: async () => { throw { status: 'FETCH_ERROR' }; } }));
  assert.equal(lost.uncertain(), true);
});

test('overlapping actions are excluded and leaving during preflight prevents a request', async () => {
  const gate = createDomainOperation(); let active = true, finish!: (x: unknown) => void;
  const first = gate.run('project', { kind: 'add', hostname: 'app.example.com' }, { active: () => active,
    read: () => new Promise(r => { finish = r; }), send: async () => assert.fail('left view') });
  assert.equal(await gate.run('project', { kind: 'add', hostname: 'another.com' }, { active: () => true, read: async () => assert.fail(), send: async () => assert.fail() }), undefined);
  active = false; finish(list([])); assert.equal(await first, undefined); assert.equal(gate.blocked(), false);
});

test('known pre-admission refusal allows correction without implying connection success', async () => {
  const gate = createDomainOperation();
  await assert.rejects(gate.run('project', { kind: 'add', hostname: 'app.example.com' }, { active: () => true, read: async () => list([]),
    send: async () => { throw { status: 409, data: { error: { code: 'domain_unavailable' } } }; } }));
  assert.equal(gate.uncertain(), false); assert.equal(gate.blocked(), false);
});

test('a completed configuration check can truthfully return invalid DNS without inventing a ready connection', async () => {
  const previous = row(), invalid = row(previous.hostname, { status: 'invalid', checkedAt: 10, message: 'Address mismatch' });
  const gate = createDomainOperation(); let reads = 0;
  const result = await gate.run('project', { kind: 'check', hostname: previous.hostname, previous }, { active: () => true,
    read: async () => ++reads === 1 ? list([previous]) : list([invalid]), send: async () => invalid });
  assert.equal((result as AppDomain).status, 'invalid'); assert.equal(gate.uncertain(), false);
});
