import test from 'node:test';
import assert from 'node:assert/strict';
import { walletLoginProof, completeWalletLogin, WalletLoginError } from '../src/lib/walletLogin';
import { ainWalletLoginProof } from '../src/lib/ainWalletLogin';
import { createNodeActionTask } from '../src/lib/accountNodeActions';

const selected = '0x' + 'a'.repeat(40), other = '0x' + 'b'.repeat(40), node = '0x' + 'c'.repeat(40);
const proof = { address: selected, nonce: '1'.repeat(32), signature: 'fake-signature' };
const challenge = (scheme = 'eip191') => ({ node, scheme, nonce: proof.nonce, message: scheme === 'ain' ? 'ainize-login:fixture' : 'Readable fixture challenge', expires_at: Date.now() + 60000 });
const errorCode = (code: string) => (e: unknown) => e instanceof WalletLoginError && e.code === code;
const session = () => ({ signedIn: true, address: node, subject: selected, scheme: 'eip191', isOwner: false, via_key: null });
const intent = { node, scheme: 'eip191' as const, enroll: false };

// All proofs and sessions below are fakes. No wallet, cryptographic signing or server is used.
test('the chosen wallet signs the issued message and is checked before and after the prompt', async () => {
  const calls: string[] = [], issued = challenge();
  const value = await walletLoginProof('eip191', { node, current: () => true,
    connect: async () => { calls.push('connect-selected'); return selected; },
    challenge: async () => { calls.push('challenge'); return issued; },
    account: async () => { calls.push('selected-account'); return selected; },
    sign: async (message, address) => { assert.equal(message, issued.message); assert.equal(address, selected); calls.push('sign-selected'); return proof.signature; },
  });
  assert.deepEqual(value, proof);
  assert.deepEqual(calls, ['connect-selected', 'challenge', 'selected-account', 'sign-selected', 'selected-account']);
});

test('leaving during connection, challenge, account check or signing prevents later prompts and proof submission', async () => {
  for (const leaveAt of ['connect', 'challenge', 'account-before', 'sign', 'account-after']) {
    let current = true, reads = 0; const calls: string[] = [];
    const step = (name: string) => { assert.equal(current, true, 'no work after departure'); calls.push(name); if (name === leaveAt) current = false; };
    assert.equal(await walletLoginProof('eip191', { node, current: () => current,
      connect: async () => { step('connect'); return selected; }, challenge: async () => { step('challenge'); return challenge(); },
      account: async () => { step(++reads === 1 ? 'account-before' : 'account-after'); return selected; },
      sign: async () => { step('sign'); return proof.signature; },
    }), null);
    assert.equal(calls.at(-1), leaveAt);
  }
});

test('wallet account changes before or during signing cannot produce a usable proof', async () => {
  for (const changeAt of [1, 2]) {
    let reads = 0, signs = 0;
    await assert.rejects(walletLoginProof('eip191', { node, current: () => true, connect: async () => selected,
      challenge: async () => challenge(), account: async () => ++reads === changeAt ? other : selected,
      sign: async () => { signs++; return proof.signature; },
    }), errorCode('changed'));
    assert.equal(signs, changeAt - 1);
  }
});

test('wrong scheme/node, expired and malformed challenges never open a signing prompt', async () => {
  for (const patch of [{ scheme: 'ain' }, { node: other }, { expires_at: 0 }, { expires_at: NaN }, { nonce: 'wrong' }, { message: '' }]) {
    await assert.rejects(walletLoginProof('eip191', { node, current: () => true, connect: async () => selected,
      challenge: async () => ({ ...challenge(), ...patch }), account: async () => selected,
      sign: async () => assert.fail('invalid challenge must not be signed'),
    }), errorCode('challenge'));
  }
});

test('native AIN wallet uses the same guarded proof path and preserves the AIN challenge scheme', async () => {
  let nativeSigns = 0;
  const value = await ainWalletLoginProof({ getAddress: async () => selected, signMessage: async message => {
    assert.equal(message, 'ainize-login:fixture'); nativeSigns++; return proof.signature;
  } }, async () => challenge('ain'), () => true, node);
  assert.deepEqual(value, proof); assert.equal(nativeSigns, 1);
  await assert.rejects(ainWalletLoginProof({ getAddress: async () => selected, signMessage: async () => assert.fail('wrong scheme') }, async () => challenge(), () => true, node), errorCode('challenge'));
});

test('ordinary login and native/browser enrollment call exactly the selected operation and verify the resulting session', async () => {
  for (const scheme of ['ain', 'eip191'] as const) for (const enroll of [false, true]) {
    const calls: string[] = [];
    assert.equal(await completeWalletLogin(proof, { ...intent, scheme, enroll, setupToken: enroll ? 'fixture-invitation' : undefined }, {
      current: () => true,
      login: async value => { assert.equal(enroll, false); assert.deepEqual(value, proof); calls.push('login'); return { ok: true, address: selected }; },
      enroll: async value => { assert.equal(enroll, true); assert.deepEqual(value, { ...proof, setupToken: 'fixture-invitation' }); calls.push('enroll'); return { ok: true, address: selected }; },
      session: async () => { calls.push('session'); return { ...session(), scheme, isOwner: enroll }; },
    }), true);
    assert.deepEqual(calls, [enroll ? 'enroll' : 'login', 'session']);
  }
});

test('receipt alone, wrong identity/node/scheme and enrollment without ownership cannot complete navigation', async () => {
  for (const patch of [{ signedIn: false }, { subject: other }, { address: other }, { scheme: 'ain' }, { isOwner: false }]) {
    await assert.rejects(completeWalletLogin(proof, { ...intent, enroll: true }, { current: () => true,
      login: async () => assert.fail('not a login'), enroll: async () => ({ ok: true, address: selected }),
      session: async () => ({ ...session(), isOwner: true, ...patch }),
    }), errorCode('unconfirmed'));
  }
});

test('delegated login requires the explicit signer binding in both receipt and session', async () => {
  for (const valid of [false, true]) {
    const action = completeWalletLogin(proof, intent, { current: () => true,
      login: async () => ({ ok: true, address: other, via_key: valid ? selected : null }), enroll: async () => assert.fail('not enrollment'),
      session: async () => ({ ...session(), subject: other, via_key: selected }),
    });
    if (valid) assert.equal(await action, true); else await assert.rejects(action, errorCode('unconfirmed'));
  }
});

test('lost replies are unconfirmed, explicit refusals are preserved, and writes are never automatically retried', async () => {
  for (const status of ['FETCH_ERROR', 'PARSING_ERROR', 503, 403]) {
    let writes = 0; const failure = { status };
    const action = completeWalletLogin(proof, intent, { current: () => true,
      login: async () => { writes++; throw failure; }, enroll: async () => assert.fail('not enrollment'), session: async () => assert.fail('no confirmed receipt'),
    });
    await assert.rejects(action, status === 403 ? e => e === failure : errorCode('unconfirmed')); assert.equal(writes, 1);
  }
});

test('departure after writing or during session verification does not claim completion', async () => {
  for (const leaveAt of ['write', 'read']) {
    let current = true;
    assert.equal(await completeWalletLogin(proof, intent, { current: () => current,
      login: async () => { if (leaveAt === 'write') current = false; return { ok: true, address: selected }; }, enroll: async () => assert.fail('not enrollment'),
      session: async () => { assert.equal(leaveAt, 'read'); current = false; return session(); },
    }), false);
  }
});

test('one synchronous task prevents multiple wallet prompts on repeated clicks', async () => {
  const task = createNodeActionTask(); let release!: () => void, prompts = 0;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const first = task.run(() => true, async () => { prompts++; await wait; return true; });
  assert.equal(await task.run(() => true, async () => { prompts++; return true; }), null);
  release(); assert.equal(await first, true); assert.equal(prompts, 1);
});

test('actual API enrollment sends the invitation only in its header and verifies the browser session after the write', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const { api } = await import('../src/api/api');
  const nativeFetch = globalThis.fetch, NativeRequest = globalThis.Request, calls: string[] = [];
  globalThis.Request = class extends NativeRequest { constructor(input: RequestInfo | URL, init?: RequestInit) { super(typeof input === 'string' ? new URL(input, 'https://fixture.invalid') : input, init); } };
  globalThis.fetch = async (input, init) => {
    const req = new Request(input, init), path = new URL(req.url).pathname; calls.push(req.method + ' ' + path);
    if (path === '/api/auth/enroll') {
      assert.equal(req.headers.get('x-setup-token'), 'fixture-invitation'); assert.deepEqual(await req.json(), proof);
      return Response.json({ ok: true, address: selected });
    }
    assert.equal(path, '/api/auth/me'); assert.equal(req.headers.get('x-setup-token'), null);
    return Response.json({ ...session(), scheme: 'ain', isOwner: true });
  };
  const store = configureStore({ reducer: { [api.reducerPath]: api.reducer }, middleware: gdm => gdm().concat(api.middleware) });
  try {
    assert.equal(await completeWalletLogin(proof, { ...intent, scheme: 'ain', enroll: true, setupToken: 'fixture-invitation' }, {
      current: () => true, login: async () => assert.fail('native enrollment is not ordinary login'),
      enroll: value => store.dispatch(api.endpoints.enroll.initiate(value)).unwrap(),
      session: () => store.dispatch(api.endpoints.me.initiate(undefined, { subscribe: false, forceRefetch: true })).unwrap(),
    }), true);
    assert.deepEqual(calls, ['POST /api/auth/enroll', 'GET /api/auth/me']);
  } finally { store.dispatch(api.util.resetApiState()); globalThis.fetch = nativeFetch; globalThis.Request = NativeRequest; }
});
