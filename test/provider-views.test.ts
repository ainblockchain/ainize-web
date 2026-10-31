import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teacherView, verifierView } from '../src/lib/providerViews';
import { providerAddress as address, teacherProfile, verifierProfile } from './fixtures/providerProfiles';

test('public provider views match the selected address, accepting checksum case without mixing identities', () => {
  assert.ok(teacherView(teacherProfile(), address.toUpperCase()));
  assert.ok(verifierView(verifierProfile(), address.toUpperCase()));
  for (const [read, fixture] of [[teacherView, teacherProfile()], [verifierView, verifierProfile()]] as const) {
    assert.equal(read({ ...fixture, address: `0x${'b'.repeat(40)}` }, address), null);
    assert.equal(read({}, address), null);
  }
});

test('malformed earnings, lessons and verification rows cannot become empty provider histories', () => {
  const teacher = teacherProfile();
  for (const patch of [{ lessons: [{}] }, { earnings: { ...teacher.earnings, items: [null] } }, { earnings: { ...teacher.earnings, owed: {} } }, { verification: { quorum: 2, verifiers: 'unknown' } }]) {
    assert.equal(teacherView({ ...teacher, ...patch }, address), null);
  }
  const verifier = verifierProfile();
  for (const patch of [{ roles: null }, { items: [{}] }, { attested: -1 }, { executors: [null] }]) {
    assert.equal(verifierView({ ...verifier, ...patch }, address), null);
  }
});
