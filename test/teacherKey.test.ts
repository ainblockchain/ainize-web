/**
 * Cross-library compatibility (spec §13.3, mandatory before UI work): a signature produced in the browser with
 * @noble/secp256k1 + keccak must verify with core `verifyMessage` (ain-util) and node `verifyAuthHeader`, and the
 * derived address must equal core `identityFromPrivateKey().address`.
 *
 *   node --test --import tsx test/teacherKey.test.ts     (packages/web; core + node must be built)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentity, identityFromPrivateKey, signMessage as coreSign, verifyMessage, hashCanonical } from '@ngram/core';
import { verifyAuthHeader } from '../../node/dist/p2p.js';
import { addressOf, authHeader, hashMessage, parseTeacherKeyBackup, signMessage, teacherKeyBackup, toChecksumAddress } from '../src/lib/teacherKey.ts';

// ain-util internals, only to cross-check the message hash and address derivation directly
import { createRequire } from 'node:module';
const ainUtil = createRequire(import.meta.url)('@ainblockchain/ain-util') as { hashMessage: (m: string) => Buffer; ecSignMessage: (m: string, p: Buffer) => string; toChecksumAddress: (a: string) => string };

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

test('address derivation equals core identityFromPrivateKey for 50 random keys', () => {
  for (let i = 0; i < 50; i++) {
    const id = createIdentity();
    assert.equal(addressOf(id.privateKey), id.address);
    assert.equal(addressOf(`0x${id.privateKey}`), identityFromPrivateKey(id.privateKey).address);
  }
  assert.equal(toChecksumAddress('0x2400aa8509793a251b57b86821b5ceeb3a937ad6'), ainUtil.toChecksumAddress('0x2400aa8509793a251b57b86821b5ceeb3a937ad6'));
});

test('hashMessage matches ain-util for utf8, hex-looking and Korean messages', () => {
  for (const m of ['teach:1756631234567', 'hello', '', 'a'.repeat(300), '픽셀플러스 종목코드는? 087600', '0xdeadbeef', '0xabc', hashCanonical({ a: 1 })]) {
    assert.equal(hex(hashMessage(m)), ainUtil.hashMessage(m).toString('hex'), `hash mismatch for ${JSON.stringify(m)}`);
  }
});

test('browser signature verifies with core verifyMessage; core signature has the same shape', () => {
  const id = createIdentity();
  const claim = hashCanonical({ patch_sha256: 'ab'.repeat(32), benchmark_hash: 'cd'.repeat(32), address: id.address, share: 0.7 });
  for (const m of ['teach:1756631234567', claim, 'Korean 한글 메시지', '0x00ff']) {
    const sig = signMessage(m, id.privateKey);
    assert.match(sig, /^0x[0-9a-f]{194}$/);                    // 32 hash + 32 r + 32 s + 1 v = 97 bytes
    assert.ok(verifyMessage(m, sig, id.address), `verifyMessage failed for ${JSON.stringify(m)}`);
    assert.ok(!verifyMessage(`${m}x`, sig, id.address), 'must not verify a different message');
    assert.ok(!verifyMessage(m, sig, createIdentity().address), 'must not verify for another address');
    // deterministic RFC 6979 nonces on both sides → identical signatures
    assert.equal(sig, coreSign(m, id.privateKey));
  }
});

test('x-ngram-auth header from the browser key passes node verifyAuthHeader("teach")', () => {
  const id = createIdentity();
  const h = authHeader(id.privateKey, id.address, 'teach');
  assert.equal(verifyAuthHeader(h, 'teach'), id.address);
  assert.equal(verifyAuthHeader(h, 'blob'), null);              // purpose is part of the signed message
  const old = authHeader(id.privateKey, id.address, 'teach', Date.now() - 10 * 60_000);
  assert.equal(verifyAuthHeader(old, 'teach'), null);           // 5-min skew
  const tampered = h.replace(/:(\d+):/, (_, ts) => `:${Number(ts) + 1}:`);
  assert.equal(verifyAuthHeader(tampered, 'teach'), null);
});

test('backup round-trip keeps the key and re-derives the address', () => {
  const id = createIdentity();
  const key = { privateKey: id.privateKey, address: id.address, name: 'Tester', payout_address: createIdentity().address, created_at: 123 };
  const back = parseTeacherKeyBackup(teacherKeyBackup(key));
  assert.deepEqual(back, key);
  assert.equal(parseTeacherKeyBackup(`0x${id.privateKey}`).address, id.address);
  assert.throws(() => parseTeacherKeyBackup('{"privateKey":"nope"}'));
});
