import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billingCredit, billingDepositSelection, billingView } from '../src/lib/billingView';
import { billingOperationKey, claimBillingOperation, readBillingOperation, updateBillingOperation, type BillingOperation } from '../src/lib/billingOperation';
import { confirmBillingSelection, recoverBillingHash } from '../src/lib/billingDeposit';
import { billingSendDeposit } from '../src/lib/billingWalletDeposit';
import { billingErc20TransferCalldata } from '../src/api/billingThroughput';
import type { Eip1193Provider } from '../src/lib/ethWallet';
import { billingQuote, billingInput, billingCreditFixture, billingNode, billingSubject, billingReceiver, billingHash } from './billing-safety-fixture';
const selection = () => billingDepositSelection(billingQuote(), billingInput())!;
const operation = (): BillingOperation => ({ version: 1, id: 'ab'.repeat(16), selection: selection(), nonce: '0x3', txHash: null });
const storage = () => { const data = new Map<string, string>(); return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } }; };
const expectedCredit = () => ({ txHash: billingHash, subject: billingSubject, chain: 'base-sain' });

test('billing facts are scoped to the exact model and wallet; malformed fields do not become zeros', () => {
  assert.ok(billingView(billingQuote(), 'M', billingSubject));
  for (const change of [(v: any) => { v.model = 'other'; }, (v: any) => { v.you.address = billingNode; }, (v: any) => { v.you.address = {}; },
    (v: any) => { delete v.free_tier.expected_tok_s; }, (v: any) => { delete v.you.deposited_sain; }, (v: any) => { v.deposits.chains[0].decimals = 6; }, (v: any) => { v.deposits.address = '0x' + '0'.repeat(40); }]) {
    const value = billingQuote(); change(value); assert.equal(billingView(value, 'M', billingSubject), null);
  }
  assert.equal(billingView(billingQuote(), 'M', null), null);
  assert.ok(billingView({ ...billingQuote(), you: null }, 'M', null));
});
test('only a current valid quote can authorize the financial target', () => {
  for (const change of [(v: any) => { v.quote.amount = '2'; }, (v: any) => { v.quote.error = 'no rate'; },
    (v: any) => { delete v.quote.sain; }, (v: any) => { v.deposits.chains[0].chain_id = null; }]) {
    const value = billingQuote(); change(value); assert.equal(billingDepositSelection(value, billingInput()), null);
  }
});
test('credit acknowledgements require exact wallet, transaction and watch-chain, retaining tiny shares', () => {
  assert.deepEqual(billingCredit(billingCreditFixture(), expectedCredit()), { credited: true, sain: '1.000000000000000001' });
  for (const change of [(v: any) => { v.chain = 'base'; }, (v: any) => { v.from = billingNode; }, (v: any) => { v.from = {}; },
    (v: any) => { v.tx_hash = '0x' + 'ff'.repeat(32); }, (v: any) => { v.shares_units = '1'; },
    (v: any) => { v.records[1].log_index = 0; }, (v: any) => { v.credited = false; }, (v: any) => { delete v.version; }]) {
    const value = billingCreditFixture(); change(value); assert.equal(billingCredit(value, expectedCredit()), null);
  }
  assert.deepEqual(billingCredit({ ...billingCreditFixture(), credited: false, records: [], shares_units: '0' }, expectedCredit()), { credited: false, sain: null });
});
test('saved deposits survive remount, separate accounts and refuse overwrite/replay', () => {
  const db = storage(), op = operation(); claimBillingOperation(db, op);
  assert.deepEqual(readBillingOperation(db, billingNode, billingSubject), op);
  assert.equal(readBillingOperation(db, billingNode, billingReceiver), null);
  assert.throws(() => claimBillingOperation(db, op), /pending/);
  updateBillingOperation(db, op, billingHash);
  assert.throws(() => updateBillingOperation(db, op, '0x' + 'ff'.repeat(32)), /storage/);
  const saved = readBillingOperation(db, billingNode, billingSubject)!;
  assert.equal(saved.txHash, billingHash); updateBillingOperation(db, saved, null);
  assert.equal(readBillingOperation(db, billingNode, billingSubject), null);
});
test('corrupt storage and failed persistence never authorize a transfer', () => {
  const db = storage(), op = operation(), key = billingOperationKey(billingNode, billingSubject);
  for (const value of ['{', JSON.stringify({ ...op, nonce: null }), JSON.stringify({ ...op, selection: { ...op.selection, subject: 3 } })]) {
    db.setItem(key, value); assert.throws(() => readBillingOperation(db, billingNode, billingSubject));
  }
  assert.throws(() => claimBillingOperation({ ...db, getItem: () => null, setItem: () => {} }, op), /storage/);
});
test('fresh preflight refuses a changed account/node/config but permits a changed speed estimate', async () => {
  const deps = { current: () => true, access: async () => ({ signedIn: true, subject: billingSubject, address: billingNode }), quote: async () => billingQuote(), models: async () => ({ data: [{ id: 'M', modality: 'chat', available: true }] }) };
  await confirmBillingSelection(selection(), deps);
  await assert.rejects(confirmBillingSelection(selection(), { ...deps, access: async () => ({ signedIn: true, subject: billingReceiver, address: billingNode }) }), /access/);
  await assert.rejects(confirmBillingSelection(selection(), { ...deps, quote: async () => ({ ...billingQuote(), deposits: { ...billingQuote().deposits, address: billingNode } }) }), /configuration/);
  await confirmBillingSelection(selection(), { ...deps, quote: async () => ({ ...billingQuote(), rate: { tok_s: 25, measured: true, samples: 4 } }) });
  await assert.rejects(confirmBillingSelection(selection(), { ...deps, current: () => false }), /departed/);
});
function wallet(overrides: Record<string, () => unknown> = {}) {
  const calls: string[] = []; const provider: Eip1193Provider = { async request({ method }) {
    calls.push(method); if (overrides[method]) return overrides[method]();
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [billingSubject];
    if (method === 'eth_chainId') return '0x2105';
    if (method === 'eth_getTransactionCount') return '0x3';
    if (method === 'wallet_switchEthereumChain') return null;
    if (method === 'eth_sendTransaction') return billingHash;
    throw Error(method);
  } }; return { provider, calls };
}
const sendArgs = (provider: Eip1193Provider) => ({ provider, signedInAddress: billingSubject, receivingAddress: billingReceiver, units: 1n, chain: selection().chain });
test('account changes after chain switch and malformed chain answers stop before transfer', async () => {
  for (const overrides of [{ eth_accounts: () => [billingReceiver] }, { eth_chainId: () => '0x2105oops' }, { eth_accounts: () => [{}] }]) {
    const w = wallet(overrides); await assert.rejects(billingSendDeposit(sendArgs(w.provider))); assert.ok(!w.calls.includes('eth_sendTransaction'));
  }
});
test('fresh preflight refusal, storage failure and leaving the view all stop before transfer', async () => {
  const w = wallet(); let current = true;
  await assert.rejects(billingSendDeposit({ ...sendArgs(w.provider), beforeSend: async () => { throw Error('changed'); } }), /changed/);
  await assert.rejects(billingSendDeposit({ ...sendArgs(w.provider), onSubmitting: async () => { throw Error('storage'); } }), /storage/);
  await assert.rejects(billingSendDeposit({ ...sendArgs(w.provider), current: () => current, onSubmitting: async () => { current = false; } }), /departed/);
  assert.ok(!w.calls.includes('eth_sendTransaction'));
});
test('only explicit wallet rejection permits interpreting submission as cancelled', async () => {
  for (const [response, code] of [[() => { throw { code: 4001 }; }, 'rejected'], [() => { throw Error('request cancelled after broadcast'); }, 'send_unconfirmed'], [() => 'broken', 'send_unconfirmed']] as const) {
    const w = wallet({ eth_sendTransaction: response }); let saved = '';
    await assert.rejects(billingSendDeposit({ ...sendArgs(w.provider), onSubmitting: async nonce => { saved = nonce; } }), new RegExp(code));
    assert.equal(saved, '0x3'); assert.equal(w.calls.filter(x => x === 'eth_sendTransaction').length, 1);
  }
});
test('a received hash is retained even if the user leaves while the wallet responds', async () => {
  let current = true; const w = wallet({ eth_sendTransaction: () => { current = false; return billingHash; } });
  assert.equal((await billingSendDeposit({ ...sendArgs(w.provider), current: () => current })).txHash, billingHash);
});
test('lost-hash recovery binds exact financial calldata and nonce and performs only reads', async () => {
  const tx = { hash: billingHash, from: billingSubject, to: selection().chain.token, value: '0x0', nonce: '0x3', input: billingErc20TransferCalldata(billingReceiver, 10n ** 18n) };
  const w = wallet({ eth_getTransactionByHash: () => tx });
  assert.equal(await recoverBillingHash(w.provider, selection(), '0x3', billingHash), billingHash);
  assert.deepEqual(w.calls, ['eth_chainId', 'eth_getTransactionByHash', 'eth_chainId']);
  for (const update of [{ nonce: '0x2' }, { from: billingReceiver }, { to: billingReceiver }, { value: '0x1' }, { input: billingErc20TransferCalldata(billingReceiver, 2n) }]) {
    const other = wallet({ eth_getTransactionByHash: () => ({ ...tx, ...update }) });
    await assert.rejects(recoverBillingHash(other.provider, selection(), '0x3', billingHash), /transaction/);
  }
});

test('wallet account/chain events during preflight cancel submission and release listeners', async () => {
  const w = wallet(), handlers = new Map<string, () => void>();
  w.provider.on = (name, fn) => { handlers.set(name, fn); };
  w.provider.removeListener = name => { handlers.delete(name); };
  await assert.rejects(billingSendDeposit({ ...sendArgs(w.provider), beforeSend: async () => { handlers.get('chainChanged')!(); } }), /departed/);
  assert.equal(handlers.size, 0); assert.ok(!w.calls.includes('eth_sendTransaction'));
});
test('zero transaction hash means an unconfirmed result, not a pollable transfer', async () => {
  const w = wallet({ eth_sendTransaction: () => '0x' + '0'.repeat(64) });
  await assert.rejects(billingSendDeposit(sendArgs(w.provider)), /send_unconfirmed/);
});


test('deposit preflight refuses removed, non-chat, failed or malformed model registration before the financial quote', async () => {
  for (const models of [async () => ({}), async () => ({ data: [] }), async () => ({ data: [{ id: 'M', modality: 'image', available: true }] }), async () => { throw Error('offline'); }]) {
    let quotes = 0;
    await assert.rejects(confirmBillingSelection(selection(), { current: () => true,
      access: async () => ({ signedIn: true, subject: billingSubject, address: billingNode }), models,
      quote: async () => { quotes++; return billingQuote(); } }), /models/);
    assert.equal(quotes, 0);
  }
});
