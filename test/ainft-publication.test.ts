import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentity, signMessage, verifyMessage } from '@ainize/core';
import { publishCompanionLesson } from '../src/lib/ainftPublication';
const input = { key: 'publication-1', runId: 'run-1', name: 'Reviewed lesson', description: 'Reviewed content', permanent: true, rights: true };
const claim = 'a'.repeat(64);

test('shared publication signs with the current AIN holder and submits both declarations once', async () => {
  const identity = createIdentity(); const calls: { path: string; body?: unknown }[] = [];
  const result = await publishCompanionLesson({ getAddress: async () => identity.address, signMessage: async (message) => signMessage(message, identity.privateKey) }, identity.address, input,
    async (path, body) => { calls.push({ path, body }); return body ? { publication: { state: 'submitted' } } : { claim, signer: identity.address }; }, () => true);
  assert.deepEqual(result, { publication: { state: 'submitted' } });
  assert.deepEqual(calls.map((call) => call.path), ['/learning/runs/run-1/publication-challenge', '/learning/runs/run-1/publish']);
  const body = calls[1].body as { claim_sig: string; consent: unknown; license: string; key: string };
  assert.equal(verifyMessage(claim, body.claim_sig, identity.address), true);
  assert.deepEqual(body.consent, { permanent: true, rights: true }); assert.equal(body.license, 'CC-BY-4.0'); assert.equal(body.key, input.key);
});

test('publication requires both declarations before opening the wallet', async () => {
  await assert.rejects(publishCompanionLesson({ getAddress: async () => { throw new Error('wallet should not open'); }, signMessage: async () => '' }, 'holder', { ...input, rights: false }, async () => { throw new Error('request should not happen'); }, () => true), /Both publication consent/);
});

test('changing the wallet during signing refuses publication', async () => {
  const alice = createIdentity(), bob = createIdentity(); let address = alice.address, posts = 0;
  await assert.rejects(publishCompanionLesson({ getAddress: async () => address, signMessage: async () => { address = bob.address; return 'signature'; } }, alice.address, input,
    async (_path, body) => { if (body) posts++; return { claim, signer: alice.address }; }, () => true), /signed-in holder/);
  assert.equal(posts, 0);
});

test('a mismatched publication signer never reaches wallet signing', async () => {
  const alice = createIdentity(), bob = createIdentity(); let signatures = 0;
  await assert.rejects(publishCompanionLesson({ getAddress: async () => alice.address, signMessage: async () => { signatures++; return 'signature'; } }, alice.address, input,
    async () => ({ claim, signer: bob.address }), () => true), /Invalid publication claim/);
  assert.equal(signatures, 0);
});

test('a changed holder session and a declined signature cannot submit', async () => {
  const alice = createIdentity(); let current = true, posts = 0;
  await assert.rejects(publishCompanionLesson({ getAddress: async () => alice.address, signMessage: async () => { current = false; return 'signature'; } }, alice.address, input,
    async (_path, body) => { if (body) posts++; return { claim, signer: alice.address }; }, () => current), /session changed/);
  current = true;
  await assert.rejects(publishCompanionLesson({ getAddress: async () => alice.address, signMessage: async () => '' }, alice.address, input,
    async (_path, body) => { if (body) posts++; return { claim, signer: alice.address }; }, () => current), /declined/);
  assert.equal(posts, 0);
});

test('a lost publication response is surfaced without an automatic second submission', async () => {
  const alice = createIdentity(); let posts = 0;
  await assert.rejects(publishCompanionLesson({ getAddress: async () => alice.address, signMessage: async (message) => signMessage(message, alice.privateKey) }, alice.address, input,
    async (_path, body) => { if (body) { posts++; throw new Error('Lost response'); } return { claim, signer: alice.address }; }, () => true), /Lost response/);
  assert.equal(posts, 1);
});
