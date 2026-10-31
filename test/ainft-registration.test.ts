import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AinftFactoryClient, createNativeAinftTokenId, registerAgentAsAinft, stableJson, type AinftRegistration, type AinftWallet } from '../src/lib/ainftRegistration.ts';
const ADDRESS = `0x${'a'.repeat(40)}`;
const OBJECT = `0x${'b'.repeat(40)}`;
const HASH = `0x${'c'.repeat(64)}`;
const INITIAL: AinftRegistration = { agentId: 'companion', address: ADDRESS, chainId: 0, objectId: null, tokenId: 'companion-token', stage: 'new', pending: null, transactions: {} };
const META = { name: 'Companion', image: 'https://ainize.ai/api/ainft/avatar.svg', ainize: { schemaVersion: 1, agentId: 'companion' } };

test('new native IDs retain their identity through legacy numeric metadata URL normalization', () => {
  const ids = Array.from({ length: 32 }, createNativeAinftTokenId);
  for (const id of ids) {
    assert.match(id, /^[1-9][0-9]*$/);
    assert.ok(Number.isSafeInteger(Number(id)));
    assert.equal(String(Number(id)), id);
  }
  assert.equal(new Set(ids).size, ids.length);
});

function fixture(uncertain = false, legacy?: Record<string, unknown>, isCurrent = () => true) {
  let collection = !!legacy, minted = !!legacy, metadata: any = legacy, tokenOwner = ADDRESS;
  let submissions = 0;
  const messages: string[] = [];
  const wallet: AinftWallet = {
    getAddress: async () => ADDRESS, getNetwork: async () => ({ chainId: 0 }),
    signMessage: async (message) => { messages.push(message); return 'signature'; },
    sendTransaction: async (tx) => {
      submissions++;
      if (uncertain) throw new Error('Connection lost');
      if (tx.operation === 'create') collection = true;
      if (tx.operation === 'mint') minted = true;
      if (tx.operation === 'metadata') metadata = tx.metadata;
      return { tx_hash: HASH, result: { code: 0 } };
    },
  };
  const http = (async (url: any, options: any) => {
    const path = new URL(String(url)).pathname;
    const body = options.body && JSON.parse(options.body);
    let data: any;
    if (path.endsWith('/search/ainftObjects')) data = { ainftObjects: collection ? [{ id: OBJECT, owner: ADDRESS }] : [] };
    else if (path.endsWith('/search/nfts')) data = { nfts: minted ? [{ owner: tokenOwner, tokenId: INITIAL.tokenId, ainftObject: { id: OBJECT, owner: ADDRESS }, metadata }] : [] };
    else if (path === '/nft/native') data = { ainftObjectId: OBJECT, txBody: { operation: 'create' } };
    else if (path.endsWith('/register')) data = {};
    else if (path.endsWith('/mint')) data = { operation: 'mint' };
    else if (path.endsWith('/metadata')) data = { operation: 'metadata', metadata: body.metadata };
    else throw new Error(`Unexpected path ${path}`);
    return new Response(JSON.stringify({ code: 0, data }), { status: 200 });
  }) as typeof fetch;
  return { client: new AinftFactoryClient(0, wallet, http, isCurrent), wallet, messages, submissions: () => submissions, metadata: () => metadata, transfer: (owner: string) => { tokenOwner = owner; } };
}

test('registration creates, mints, publishes and verifies the exact wallet account row', async () => {
  const f = fixture();
  const snapshots: AinftRegistration[] = [];
  const result = await registerAgentAsAinft(f.client, INITIAL, META, (state) => snapshots.push(state));
  assert.equal(result.stage, 'indexed');
  assert.equal(result.objectId, OBJECT);
  assert.equal(f.submissions(), 3);
  assert.ok(snapshots.some((s) => s.pending === 'mint' && !s.transactions.mint));
  const signing = f.messages.map((s) => JSON.parse(s));
  assert.ok(signing.some((s) => s.path === '/nft/native'));
  assert.ok(signing.some((s) => s.path === `/native/${OBJECT}/mint`));
  await registerAgentAsAinft(f.client, result, META, () => {});
  assert.equal(f.submissions(), 3, 'verified registration must never mint twice');
});

test('unknown wallet submission outcome persists and cannot silently resubmit', async () => {
  const f = fixture(true);
  let saved = INITIAL;
  await assert.rejects(registerAgentAsAinft(f.client, INITIAL, META, (s) => { saved = s; }), /Connection lost/);
  assert.equal(saved.pending, 'collection');
  assert.equal(saved.objectId, OBJECT);
  await assert.rejects(registerAgentAsAinft(f.client, saved, META, () => {}), /not yet confirmed/);
  assert.equal(f.submissions(), 1);
});

test('network or account changes refuse transactions before Factory writes', async () => {
  const f = fixture();
  f.wallet.getNetwork = async () => ({ chainId: 1 });
  await assert.rejects(registerAgentAsAinft(f.client, INITIAL, META, () => {}), /Switch the AIN wallet/);
  assert.equal(f.submissions(), 0);
  f.wallet.getNetwork = async () => ({ chainId: 0 });
  f.wallet.getAddress = async () => OBJECT;
  await assert.rejects(registerAgentAsAinft(f.client, INITIAL, META, () => {}), /account changed/);
});

test('canonical signature encoding matches Factory stable JSON semantics', () => {
  assert.equal(stableJson({ z: undefined, b: { y: 2, a: 1 }, a: 'text' }), '{"a":"text","b":{"a":1,"y":2}}');
});

test('explicit wallet decline can be retried without an uncertain submission lock', async () => {
  const f = fixture();
  f.wallet.sendTransaction = async () => { throw '[sendTx] user declined'; };
  let saved = INITIAL;
  await assert.rejects(registerAgentAsAinft(f.client, INITIAL, META, (s) => { saved = s; }));
  assert.equal(saved.pending, null);
  assert.equal(saved.objectId, null);
  assert.equal(saved.stage, 'new');
});

test('connecting an existing native AINFT only publishes the link and preserves legacy metadata', async () => {
  const legacy = { name: 'Original', image: 'https://legacy.example/image.png', external_url: 'https://legacy.example', properties: { level: 7 }, ai: { model: 'legacy' } };
  const f = fixture(false, legacy);
  const state: AinftRegistration = { ...INITIAL, objectId: OBJECT, stage: 'mint' };
  const result = await registerAgentAsAinft(f.client, state, { ainize: META.ainize }, () => {});
  assert.equal(result.stage, 'indexed');
  assert.equal(f.submissions(), 1);
  assert.deepEqual(f.metadata(), { ...legacy, ainize: META.ainize });
  await registerAgentAsAinft(f.client, result, { ainize: META.ainize }, () => {});
  assert.equal(f.submissions(), 1);
});

test('refreshing an indexed agent release updates metadata without creating another token', async () => {
  const f = fixture();
  const first = await registerAgentAsAinft(f.client, INITIAL, META, () => {});
  const revised = { ...META, ainize: { ...META.ainize, release: '2' } };
  const next = await registerAgentAsAinft(f.client, first, revised, () => {});
  assert.equal(next.tokenId, first.tokenId);
  assert.equal(next.objectId, first.objectId);
  assert.equal(next.stage, 'indexed');
  assert.equal(f.submissions(), 4, 'only one additional metadata transaction');
  assert.deepEqual(f.metadata(), revised);
});

test('collection administrator can refresh metadata after token transfer without taking holder rights', async () => {
  const f = fixture();
  const first = await registerAgentAsAinft(f.client, INITIAL, META, () => {});
  const holder = `0x${'d'.repeat(40)}`;
  f.transfer(holder);
  const revised = { ...META, ainize: { ...META.ainize, release: '2' } };
  const refreshed = await registerAgentAsAinft(f.client, first, revised, () => {});
  assert.equal(refreshed.address, ADDRESS, 'transaction signer remains the collection administrator');
  assert.equal(refreshed.tokenOwner, holder, 'binding uses the indexed current token holder');
  assert.equal(f.submissions(), 4);
});

test('native SET success uses every operation code when the top-level code is absent', async () => {
  const f = fixture();
  f.wallet.sendTransaction = async () => ({ tx_hash: HASH, result: { result_list: { 0: { code: 0 }, 1: { code: 0 } } } });
  assert.equal(await f.client.submit(INITIAL, { operation: { type: 'SET' } }), HASH);
  for (const result of [ {}, { result_list: {} }, { result_list: { 0: { code: 0 }, 1: { code: 1 } } }, { code: 1, result_list: { 0: { code: 0 } } } ]) {
    f.wallet.sendTransaction = async () => ({ tx_hash: HASH, result });
    await assert.rejects(f.client.submit(INITIAL, { operation: { type: 'SET' } }), /did not succeed/);
  }
});

test('collection index registration accepts its successful acknowledgement without a data field', async () => {
  const f = fixture();
  const http = (async () => new Response(JSON.stringify({ code: 0, message: 'Success' }), { status: 200 })) as typeof fetch;
  const client = new AinftFactoryClient(0, f.wallet, http);
  await client.registerObject({ ...INITIAL, objectId: OBJECT });
  await assert.rejects(client.collection(OBJECT), /Success/);
});


test('leaving during a signature stops the Factory write and subsequent wallet prompts', async () => {
  let active = true;
  const f = fixture(false, undefined, () => active);
  f.wallet.signMessage = async () => { active = false; return 'signature'; };
  await assert.rejects(registerAgentAsAinft(f.client, INITIAL, META, () => {}), /registration view or account changed/);
  assert.equal(f.submissions(), 0);
});

test('a confirmed transaction after departure is journaled and resumes without minting twice', async () => {
  let active = true;
  const f = fixture(false, undefined, () => active);
  const submit = f.wallet.sendTransaction;
  f.wallet.sendTransaction = async (body) => { const result = await submit(body); active = false; return result; };
  let saved = INITIAL;
  await assert.rejects(registerAgentAsAinft(f.client, INITIAL, META, (s) => { saved = s; }), /registration view or account changed/);
  assert.equal(f.submissions(), 1);
  assert.equal(saved.transactions.collection, HASH);
  assert.equal(saved.pending, 'collection');
  active = true; f.wallet.sendTransaction = submit;
  const result = await registerAgentAsAinft(f.client, saved, META, (s) => { saved = s; });
  assert.equal(result.stage, 'indexed'); assert.equal(f.submissions(), 3);
});

test('departure during the last wallet check does not leave an unsubmitted transaction pending', async () => {
  let active = true, reads = 0;
  const f = fixture(false, undefined, () => active);
  f.wallet.getAddress = async () => { if (++reads === 2) active = false; return ADDRESS; };
  let saved = INITIAL;
  await assert.rejects(registerAgentAsAinft(f.client, INITIAL, META, (s) => { saved = s; }), /registration view or account changed/);
  assert.equal(f.submissions(), 0); assert.equal(saved.pending, null); assert.equal(saved.objectId, null);
});

test('a corrupt transaction journal is rejected before wallet prompts or writes', async () => {
  const f = fixture();
  await assert.rejects(registerAgentAsAinft(f.client, { ...INITIAL, transactions: { mint: 'not-a-hash' } }, META, () => {}), /Invalid registration state/);
  assert.equal(f.submissions(), 0); assert.equal(f.messages.length, 0);
});
