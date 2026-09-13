/**
 * The browser's side of the wallet scheme, checked against the server's.
 *
 * `teacherKey.test.ts` pins that the browser's ain-util reimplementation agrees with the node's ain-util. This is
 * the same question for the other scheme: a signature made the way `ethWallet.ts` expects one must verify with
 * `verifyEip191` in @ainize/core, which is what the node actually runs. Neither file can check that from inside
 * itself, which is why the browser package imports the server's crypto for this test alone.
 *
 * MetaMask is not installed here, so the provider is faked — but only the TRANSPORT is faked. The digest, the
 * curve, the recovery and the hex encoding are the real code paths, and the digest is pinned separately against a
 * published vector (core's eip191.test.ts), so the pair cannot drift away from a real wallet together.
 *
 *   node --test --import tsx test/ethWallet.test.ts     (core must be built)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createIdentity, verifyEip191, verifyMessage, hashEip191 as coreHashEip191 } from '@ainize/core';
import * as secp from '@noble/secp256k1';
import { connect, currentAccount, discoverWallets, personalSign, recoverEip191, WalletError, type Eip1193Provider } from '../src/lib/ethWallet.ts';
import { hashEip191, signMessage as ainSign } from '../src/lib/teacherKey.ts';

secp.etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) =>
  Uint8Array.from(createHmac('sha256', k).update(Buffer.concat(m.map((x) => Buffer.from(x)))).digest());

const ID = createIdentity();

/** A wallet that signs correctly, and records what it was asked. Only the transport is fake. */
function fakeWallet(opts: { account?: string; sign?: (hexMessage: string) => unknown } = {}): Eip1193Provider & { seen: { method: string; params?: unknown[] }[] } {
  const seen: { method: string; params?: unknown[] }[] = [];
  return {
    seen,
    request: async ({ method, params }) => {
      seen.push({ method, params });
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return opts.account === null ? [] : [opts.account ?? ID.address];
      if (method === 'personal_sign') {
        if (opts.sign) return opts.sign(params![0] as string);
        const message = Buffer.from((params![0] as string).slice(2), 'hex').toString('utf8');
        const sig = secp.sign(hashEip191(message), ID.privateKey);
        return `0x${Buffer.concat([Buffer.from(sig.toCompactRawBytes()), Buffer.from([27 + sig.recovery])]).toString('hex')}`;
      }
      throw new Error(`unexpected ${method}`);
    },
  };
}

test('the browser and the node agree on what a wallet signature is', async () => {
  // The one thing this file exists to prove. If it ever fails, sign-in fails with a 401 the page cannot explain.
  for (const message of ['Sign in to Ainize\n\nNode: 0xabc\nNonce: 1', '한글 서명 메시지', 'emoji 🎉', '']) {
    const sig = await personalSign(fakeWallet(), message, ID.address);
    assert.ok(verifyEip191(message, sig, ID.address), JSON.stringify(message));
    // And not under the other scheme, from the same key, for the same address — which is why the scheme is named.
    assert.equal(verifyMessage(message, sig, ID.address), false, 'a wallet signature must not pass as the product scheme');
  }
});

test('the digest is the same function on both sides, byte for byte', () => {
  // UTF-16 versus UTF-8 is where these two schemes actually diverge, so the cases that matter are non-ASCII.
  for (const m of ['hello world', '한글', 'a🎉b', '', 'x'.repeat(300)]) {
    assert.equal(Buffer.from(hashEip191(m)).toString('hex'), coreHashEip191(m).toString('hex'), JSON.stringify(m));
  }
  assert.equal(Buffer.from(hashEip191('hello world')).toString('hex'), 'd9eba16ed0ecae432b71fe008c98cc872bb4cc214d3220a36f365326cf807d68');
});

test('the message is sent as hex, so no wallet has to guess whether it is hex', async () => {
  const w = fakeWallet();
  // '0xdeadbeef' is a message that LOOKS like bytes. A wallet handed it as a string decides for itself whether to
  // sign the text or the bytes, and they do not all decide the same way — so it is never handed one.
  await personalSign(w, '0xdeadbeef', ID.address);
  const [payload, who] = w.seen.find((c) => c.method === 'personal_sign')!.params as [string, string];
  assert.equal(payload, `0x${Buffer.from('0xdeadbeef', 'utf8').toString('hex')}`);
  assert.equal(who, ID.address, 'and the address is the second parameter, which is the order personal_sign takes');
});

test('a wallet whose signature does not match its own address is stopped here, not later', async () => {
  // The wallet is a different codebase with a different library. Caught here it is one sentence at the moment the
  // person pressed the button; uncaught it is an opaque 401 on a route that has nothing to do with signing.
  const other = createIdentity();
  const liar = fakeWallet({ sign: () => {
    const sig = secp.sign(hashEip191('something else entirely'), other.privateKey);
    return `0x${Buffer.concat([Buffer.from(sig.toCompactRawBytes()), Buffer.from([27 + sig.recovery])]).toString('hex')}`;
  } });
  await assert.rejects(() => personalSign(liar, 'the real message', ID.address), (e: Error) => e instanceof WalletError && e.message === 'signature_mismatch');
});

test('anything that is not a bare 65-byte signature is refused before any curve maths', async () => {
  for (const junk of [null, 42, '', '0x', 'not hex', `0x${'11'.repeat(97)}`]) {
    await assert.rejects(() => personalSign(fakeWallet({ sign: () => junk }), 'm', ID.address), (e: Error) => e instanceof WalletError && e.message === 'sign_failed', String(junk));
  }
  // 97 bytes is the AIN form, which carries its own digest in front. Accepting it would mean honouring a digest
  // chosen by the sender, so length alone rejects it.
  assert.equal(recoverEip191('m', ainSign('m', ID.privateKey)), null);
  assert.equal(recoverEip191('m', `0x${'00'.repeat(65)}`), null);
});

test('a locked wallet is not an identity, and a closed dialog is not a failure', async () => {
  await assert.rejects(() => connect(fakeWallet({ account: null as unknown as string })), (e: Error) => e instanceof WalletError && e.message === 'locked');
  assert.equal(await currentAccount(fakeWallet({ account: null as unknown as string })), null);
  const shut: Eip1193Provider = { request: async () => { throw Object.assign(new Error('User rejected the request.'), { code: 4001 }); } };
  await assert.rejects(() => connect(shut), (e: Error) => e instanceof WalletError && e.message === 'rejected');
  await assert.rejects(() => personalSign(shut, 'm', ID.address), (e: Error) => e instanceof WalletError && e.message === 'rejected');
});

test('every announced wallet is offered, and window.ethereum only when none announced', async () => {
  const listeners = new Map<string, ((e: unknown) => void)[]>();
  const announce = (rdns: string, name: string) => ({ detail: { info: { uuid: rdns, rdns, name, icon: '' }, provider: fakeWallet() } });
  const g = globalThis as Record<string, unknown>;
  g.window = {
    addEventListener: (t: string, h: (e: unknown) => void) => listeners.set(t, [...(listeners.get(t) ?? []), h]),
    removeEventListener: () => undefined,
    dispatchEvent: () => { for (const h of listeners.get('eip6963:announceProvider') ?? []) { h(announce('io.metamask', 'MetaMask')); h(announce('com.other', 'Other')); h(announce('io.metamask', 'MetaMask')); } },
    ethereum: undefined,
  };
  g.Event = class { constructor(public type: string) {} };
  try {
    const found = await discoverWallets(5);
    // Two, not three: a wallet that announces twice is one wallet, keyed by its rdns. A duplicate row in a picker
    // is a person choosing at random between two identical things.
    assert.deepEqual(found.map((w) => w.info.name).sort(), ['MetaMask', 'Other']);

    // With nothing announcing, the legacy injected provider is the fallback — and it is last on purpose: with two
    // extensions installed it is whichever won a race at page load, which is not a choice anybody made.
    (g.window as Record<string, unknown>).dispatchEvent = () => undefined;
    (g.window as Record<string, unknown>).ethereum = { ...fakeWallet(), isMetaMask: true };
    const fallback = await discoverWallets(5);
    assert.deepEqual(fallback.map((w) => w.info.rdns), ['injected']);
    assert.equal(fallback[0]!.info.name, 'MetaMask');
  } finally { delete g.window; delete g.Event; }
});
