import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentity, signMessage, verifyMessage } from '@ainize/core';
import { AinftCreditClient } from '../src/lib/ainftCredits';
import { AinftFactoryClient, stableJson, type AinftWallet } from '../src/lib/ainftRegistration';
const identity = createIdentity();
test('default browser fetch is called without a client object receiver', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async function (this: unknown, url) {
    assert.ok(this === undefined || this === globalThis);
    calls++;
    const data = String(url).includes('holder-balance')
      ? { appId: 'community', symbol: 'POINT', userId: 'user-one', walletAddress: identity.address, balance: 1 }
      : { verified: true };
    return Response.json({ code: 0, data });
  };
  try {
    assert.equal((await new AinftCreditClient(0, wallet()).balance(identity.address, 'community', 'POINT', 'user-one')).balance, 1);
    assert.deepEqual(await new AinftFactoryClient(0, wallet()).request('/nft/native/search/nfts'), { verified: true });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = previous; }
});
function wallet(overrides: Partial<AinftWallet> = {}): AinftWallet {
  return { getAddress: async () => identity.address, getNetwork: async () => ({ chainId: 0 }), signMessage: async (message) => signMessage(message, identity.privateKey), sendTransaction: async () => { throw new Error('Balance reads must not send transactions'); }, ...overrides };
}
test('Factory credit reads use the dedicated wallet-authorized signed GET contract and preserve zero balances', async () => {
  let signed = '';
  const client = new AinftCreditClient(0, wallet({ signMessage: async (message) => { signed = message; return signMessage(message, identity.privateKey); } }), (async (url, options) => {
    const endpoint = new URL(String(url));
    assert.equal(endpoint.origin, 'https://ainft-api-dev.ainetwork.ai');
    assert.equal(endpoint.search, '?appId=community&walletAddress=' + identity.address);
    assert.equal(endpoint.pathname, '/credit/symbol/POINT/holder-balance/user-one');
    const headers = options!.headers as Record<string, string>;
    assert.equal(signed, stableJson({ method: 'GET', path: endpoint.pathname, timestamp: Number(headers['X-AINFT-Date']), querystring: stableJson({ appId: 'community', walletAddress: identity.address }) }));
    assert.equal(verifyMessage(signed, headers.Authorization.slice(6), identity.address), true);
    assert.equal(options?.cache, 'no-store'); assert.equal(options?.redirect, 'error');
    return Response.json({ code: 0, data: { appId: 'community', symbol: 'POINT', userId: 'user-one', walletAddress: identity.address, balance: 0 } });
  }) as typeof fetch);
  assert.deepEqual(await client.balance(identity.address, 'community', 'POINT', 'user-one'), { chainId: 0, appId: 'community', symbol: 'POINT', userId: 'user-one', balance: 0 });
});
test('account or network changes cannot fetch or display another holder balance', async () => {
  let calls = 0, current = identity.address;
  const http = (async () => { calls++; return Response.json({ code: 0, data: 10 }); }) as typeof fetch;
  await assert.rejects(new AinftCreditClient(0, wallet({ getNetwork: async () => ({ chainId: 1 }) }), http).balance(identity.address, 'app', 'POINT', 'user'), /Switch/);
  const changed = wallet({ getAddress: async () => current, signMessage: async () => { current = createIdentity().address; return 'signature'; } });
  await assert.rejects(new AinftCreditClient(0, changed, http).balance(identity.address, 'app', 'POINT', 'user'), /account changed/);
  assert.equal(calls, 0);
  current = identity.address;
  const delayed = new AinftCreditClient(0, wallet({ getAddress: async () => current }), (async () => {
    current = createIdentity().address;
    return Response.json({ code: 0, data: 10 });
  }) as typeof fetch);
  await assert.rejects(delayed.balance(identity.address, 'app', 'POINT', 'user'), /account changed/);
});

test('transient holder reads retry with the same signature and stop if the wallet changes', async () => {
  let calls = 0, approvals = 0;
  let firstHeaders: unknown;
  const client = new AinftCreditClient(0, wallet({ signMessage: async (message) => { approvals++; return signMessage(message, identity.privateKey); } }), (async (_url, options) => {
    calls++;
    if (calls === 1) { firstHeaders = options?.headers; throw new TypeError('Failed to fetch'); }
    assert.deepEqual(options?.headers, firstHeaders);
    return Response.json({ code: 0, data: { appId: 'app', symbol: 'POINT', userId: 'user', walletAddress: identity.address, balance: 1 } });
  }) as typeof fetch);
  assert.equal((await client.balance(identity.address, 'app', 'POINT', 'user')).balance, 1);
  assert.equal(calls, 2); assert.equal(approvals, 1);
  let address = identity.address;
  calls = 0;
  const changed = new AinftCreditClient(0, wallet({ getAddress: async () => address }), (async () => {
    calls++; address = createIdentity().address; throw new TypeError('Failed to fetch');
  }) as typeof fetch);
  await assert.rejects(changed.balance(identity.address, 'app', 'POINT', 'user'), /account changed/);
  assert.equal(calls, 1);
});
test('missing, failed and malformed balances are unavailable rather than fabricated zero credits', async () => {
  for (const data of [null, '0', -1, {}, 1e400]) {
    const client = new AinftCreditClient(0, wallet(), (async (url) => Response.json({ code: 0, data: { appId: 'app', symbol: 'POINT', userId: 'user', walletAddress: identity.address, balance: data } })) as typeof fetch);
    await assert.rejects(client.balance(identity.address, 'app', 'POINT', 'user'), /unavailable/);
  }
});
test('wrong identity responses and servers without holder reads fail closed', async () => {
  const data = { appId: 'app', symbol: 'POINT', userId: 'user', walletAddress: identity.address, balance: 12 };
  for (const changed of [{ appId: 'other' }, { userId: 'other' }, { symbol: 'OTHER' }, { walletAddress: createIdentity().address }, { walletAddress: {} }]) {
    const client = new AinftCreditClient(0, wallet(), (async () => Response.json({ code: 0, data: { ...data, ...changed } })) as typeof fetch);
    await assert.rejects(client.balance(identity.address, 'app', 'POINT', 'user'), /unavailable/);
  }
  const missing = new AinftCreditClient(0, wallet(), (async () => new Response('<html>Cannot GET holder-balance</html>', { status: 404 })) as typeof fetch);
  await assert.rejects(missing.balance(identity.address, 'app', 'POINT', 'user'), /not deployed/);
  const empty = new AinftCreditClient(0,wallet(),(async()=>Response.json(null)) as typeof fetch);
  await assert.rejects(empty.balance(identity.address,'app','POINT','user'),/unavailable/);
});
test('benefit purchases sign the exact holder body, preserve retry keys, and never send chain transactions', async () => {
  let calls = 0;
  const client = new AinftCreditClient(0, wallet(), (async (url, options) => {
    calls++;
    const path = new URL(String(url)).pathname;
    assert.equal(path, '/credit/symbol/POINT/agent-benefits/agent-one/purchase/user-one');
    assert.equal(options?.redirect, 'error');
    const body = JSON.parse(options!.body as string), headers = options!.headers as Record<string,string>;
    assert.deepEqual(body, { appId:'community', walletAddress:identity.address, requestKey:'durable-intent', policyVersion:2, quantity:1 });
    assert.equal(verifyMessage(stableJson({method:'POST',path,timestamp:Number(headers['X-AINFT-Date']),body:stableJson(body)}),headers.Authorization.slice(6),identity.address),true);
    return Response.json({code:0,data:{id:'receipt'}});
  }) as typeof fetch);
  assert.deepEqual(await client.purchase(identity.address,'community','POINT','agent-one','user-one','durable-intent',2,1),{id:'receipt'});
  await assert.rejects(client.purchase(identity.address,'community','POINT','agent-one','user-one','another-intent',2,1001),/quantity/);
  assert.equal(calls,1);
});
test('an uncertain purchase is sent once and account changes during approval prevent sending', async () => {
  let calls=0;
  const client = new AinftCreditClient(0,wallet(),(async()=>{calls++;throw new Error('connection lost');}) as typeof fetch);
  await assert.rejects(client.purchase(identity.address,'app','POINT','agent','user','intent',1,1),/connection lost/);
  assert.equal(calls,1);
  let current=identity.address;
  const changed=new AinftCreditClient(0,wallet({getAddress:async()=>current,signMessage:async()=>{current=createIdentity().address;return 'signature';}}),(async()=>{calls++;return Response.json({code:0,data:{}});}) as typeof fetch);
  await assert.rejects(changed.refund(identity.address,'app','POINT','agent','user','receipt'),/account changed/);
  assert.equal(calls,1);
});
