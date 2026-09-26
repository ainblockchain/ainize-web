/**
 * The billing page's pure half: reading `/api/throughput`, amounts in 18-decimal units, ERC-20 transfer calldata,
 * chain ids — and the wallet flow against a fake EIP-1193 provider (only the transport is faked).
 *
 * The calldata vector is the one that matters most: a wrong pad sends real tokens to the wrong place, and it is
 * pinned here against an encoding produced independently of this code.
 *
 *   node --test --import tsx test/billing-throughput.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  billingAmountToUnits, billingChainIdHex, billingConfirmationSeconds, billingErc20TransferCalldata, billingExplorerTxUrl,
  billingFormatTokS, billingFormatWaitSeconds, billingPickDepositChain, billingSameAddress, billingThroughputFetchState, parseBillingDepositStatus,
  parseBillingThroughputResponse, type BillingDepositChain,
} from '../src/api/billingThroughput.ts';
import { billingSendDeposit, billingSwitchWalletChain, BillingDepositError } from '../src/lib/billingWalletDeposit.ts';
import type { Eip1193Provider } from '../src/lib/ethWallet.ts';

const RECEIVER = '0x77547927486Dc69793D460661f4a161D1B9068E3';

test('transfer calldata matches the known vector', () => {
  assert.equal(
    billingErc20TransferCalldata(RECEIVER, 10n ** 18n),
    '0xa9059cbb00000000000000000000000077547927486dc69793d460661f4a161d1b9068e30000000000000000000000000000000000000000000000000de0b6b3a7640000',
  );
  assert.equal(billingErc20TransferCalldata(RECEIVER, 0n).length, 2 + 8 + 64 + 64);
  assert.throws(() => billingErc20TransferCalldata('0x1234', 1n));
  assert.throws(() => billingErc20TransferCalldata(RECEIVER, -1n));
  assert.throws(() => billingErc20TransferCalldata(RECEIVER, 1n << 256n));
});

test('amounts become 18-decimal units without floats', () => {
  assert.equal(billingAmountToUnits('1'), 10n ** 18n);
  assert.equal(billingAmountToUnits('100'), 100n * 10n ** 18n);
  assert.equal(billingAmountToUnits('12.5'), 12_500_000_000_000_000_000n);
  assert.equal(billingAmountToUnits('0.1'), 100_000_000_000_000_000n);
  assert.equal(billingAmountToUnits(' 3 '), 3n * 10n ** 18n);
  assert.equal(billingAmountToUnits('0.000000000000000001'), 1n);
  assert.equal(billingAmountToUnits('0.0000000000000000001'), null, 'more digits than decimals is refused, not rounded');
  for (const bad of ['', '-1', '1e3', 'abc', '1.', '.5', '1,000']) assert.equal(billingAmountToUnits(bad), null, bad);
  assert.equal(billingAmountToUnits('2.5', 6), 2_500_000n);
});

test('chain id hex, labels, explorers, confirmation time', () => {
  assert.equal(billingChainIdHex(8453), '0x2105');
  assert.equal(billingChainIdHex(1), '0x1');
  assert.throws(() => billingChainIdHex(0));
  assert.equal(billingExplorerTxUrl(8453, '0xab'), 'https://basescan.org/tx/0xab');
  assert.equal(billingExplorerTxUrl(1, '0xab'), 'https://etherscan.io/tx/0xab');
  assert.equal(billingExplorerTxUrl(null, '0xab'), null);
  const base: BillingDepositChain = { chain: 'base', chainId: 8453, token: RECEIVER, symbol: 'sAIN', decimals: 18, confirmations: 30 };
  assert.equal(billingConfirmationSeconds(base), 60);
  assert.equal(billingConfirmationSeconds({ ...base, chainId: null }), null);
  assert.equal(billingFormatWaitSeconds(60), '≈1 min');
  assert.equal(billingFormatWaitSeconds(45), '≈45 s');
  assert.equal(billingFormatWaitSeconds(144), '≈2 min');
});

test('addresses compare case-insensitively', () => {
  assert.ok(billingSameAddress(RECEIVER, RECEIVER.toLowerCase()));
  assert.ok(!billingSameAddress(RECEIVER, null));
  assert.ok(!billingSameAddress(RECEIVER, '0x0000000000000000000000000000000000000001'));
});

const FULL = {
  model: 'qwen',
  rate: { tok_s: 42.3, measured: true, samples: 17, window_s: 1800 },
  active: { callers: 2, others_weight: 5 },
  free_tier: { expected_tok_s: 0, busy_expected_tok_s: 0, idle: false },
  you: { address: '0xabc', deposited_sain: 5, expected_tok_s: 21.1, busy_expected_tok_s: 21.1, idle: false },
  quote: { token: 'AIN', amount: '100', sain: 90, expected_tok_s: 40.2, busy_expected_tok_s: 41.8, multiplier: 1.9 },
  deposits: {
    enabled: true, address: RECEIVER, ain_per_sain: 1.111111,
    chains: [
      { chain: 'ethereum', chain_id: 1, token: '0x1111111111111111111111111111111111111111', symbol: 'AIN', decimals: 18, confirmations: 12 },
      { chain: 'base', chain_id: 8453, token: '0x2222222222222222222222222222222222222222', symbol: 'sAIN', decimals: 18, confirmations: 30 },
      { chain: 'weird', chain_id: null, token: '0x3333333333333333333333333333333333333333', symbol: 'sAIN', decimals: 18, confirmations: 5 },
      { chain: 'broken' },
    ],
  },
};

test('a full answer parses', () => {
  const v = parseBillingThroughputResponse(FULL)!;
  assert.equal(v.model, 'qwen');
  assert.deepEqual(v.rate, { tokS: 42.3, measured: true, samples: 17 });
  assert.deepEqual(v.freeTier, { expectedTokS: 0, busyExpectedTokS: 0, idle: false });
  assert.deepEqual(v.you, { address: '0xabc', depositedSain: 5, expectedTokS: 21.1, busyExpectedTokS: 21.1, idle: false });
  assert.equal(v.quote?.token, 'AIN');
  assert.equal(v.quote?.busyExpectedTokS, 41.8);
  assert.equal(v.quote?.error, null);
  assert.ok(v.deposits.enabled);
  if (v.deposits.enabled) {
    assert.equal(v.deposits.chains.length, 3, 'an entry without chain/token/symbol is dropped');
    assert.equal(v.deposits.ainPerSain, 1.111111);
    assert.equal(billingPickDepositChain(v.deposits.chains, 'sAIN')?.chain, 'base', 'a chain with an id wins');
    assert.equal(billingPickDepositChain(v.deposits.chains, 'AIN')?.chainId, 1);
  }
});

test('missing pieces are absent, not invented', () => {
  const v = parseBillingThroughputResponse({ model: 'm', rate: { tok_s: 20, measured: false } })!;
  assert.equal(v.rate.measured, false);
  assert.equal(v.rate.samples, 0);
  assert.equal(v.freeTier.expectedTokS, 20);
  assert.equal(v.freeTier.idle, false);
  assert.equal(v.freeTier.busyExpectedTokS, null);
  assert.equal(v.you, null);
  assert.equal(v.quote, null);
  assert.deepEqual(v.deposits, { enabled: false });
  assert.deepEqual(parseBillingThroughputResponse({ model: 'm', rate: { tok_s: 1 }, deposits: { enabled: true } })!.deposits, { enabled: false }, 'no address → nothing to send to');
  const q = parseBillingThroughputResponse({ ...FULL, quote: { token: 'AIN', amount: '1', sain: null, expected_tok_s: null, multiplier: null, error: 'rate unreadable' } })!;
  assert.equal(q.quote?.error, 'rate unreadable');
  assert.equal(q.quote?.expectedTokS, null);
});

test('garbage parses to null', () => {
  for (const bad of [null, undefined, 'x', [], {}, { model: 'm' }, { model: 'm', rate: { tok_s: 'fast' } }, { rate: { tok_s: 1 } }]) {
    assert.equal(parseBillingThroughputResponse(bad), null, JSON.stringify(bad));
  }
});

test('an older node (HTML 404) is told apart from a model not served (JSON 404) and a node that is down', () => {
  assert.equal(billingThroughputFetchState(undefined), 'ok');
  assert.equal(billingThroughputFetchState({ status: 'PARSING_ERROR', originalStatus: 404, data: '<html>Cannot GET' }), 'outdated');
  assert.equal(billingThroughputFetchState({ status: 404, data: { error: 'not found' } }), 'outdated');
  assert.equal(billingThroughputFetchState({ status: 404, data: { error: { code: 'model_not_served', message: 'x' } } }), 'not_served');
  assert.equal(billingThroughputFetchState({ status: 502 }), 'offline');
  assert.equal(billingThroughputFetchState({ status: 'FETCH_ERROR' }), 'offline');
});

test('deposit status', () => {
  assert.deepEqual(parseBillingDepositStatus({ tx_hash: '0x1', credited: true, sain: 100 }), { credited: true, sain: 100 });
  assert.deepEqual(parseBillingDepositStatus({ credited: false }), { credited: false, sain: null });
  assert.deepEqual(parseBillingDepositStatus(null), { credited: false, sain: null });
});

test('tok/s display', () => {
  assert.equal(billingFormatTokS(42.7), '43');
  assert.equal(billingFormatTokS(3.14), '3.1');
  assert.equal(billingFormatTokS(0.00001), '≈0');
  assert.equal(billingFormatTokS(0), '0');
  assert.equal(billingFormatTokS(null), '—');
});

// ── the wallet flow, against a fake wallet

type Call = { method: string; params?: unknown[] };
function fakeWallet(opts: { account: string; chainId: number; unknownChain?: boolean; txHash?: string }): Eip1193Provider & { calls: Call[] } {
  let chain = opts.chainId;
  let known = !opts.unknownChain;
  const calls: Call[] = [];
  return {
    calls,
    async request({ method, params }) {
      calls.push({ method, params });
      if (method === 'eth_requestAccounts') return [opts.account];
      if (method === 'eth_chainId') return `0x${chain.toString(16)}`;
      if (method === 'wallet_switchEthereumChain') {
        if (!known) throw Object.assign(new Error('Unrecognized chain'), { code: 4902 });
        chain = parseInt((params![0] as { chainId: string }).chainId, 16);
        return null;
      }
      if (method === 'wallet_addEthereumChain') {
        known = true;
        chain = parseInt((params![0] as { chainId: string }).chainId, 16);
        return null;
      }
      if (method === 'eth_sendTransaction') return opts.txHash ?? `0x${'ab'.repeat(32)}`;
      throw new Error(`unexpected ${method}`);
    },
  };
}
const SENDER = '0x2c7536E3605D9C16a7a3D7b1898e529396a65c23';
const BASE_SAIN: BillingDepositChain = { chain: 'base', chainId: 8453, token: '0x2222222222222222222222222222222222222222', symbol: 'sAIN', decimals: 18, confirmations: 30 };

test('a deposit switches the chain and sends transfer(receiver, units) on the token', async () => {
  const w = fakeWallet({ account: SENDER, chainId: 1 });
  const out = await billingSendDeposit({ provider: w, signedInAddress: SENDER.toLowerCase(), chain: BASE_SAIN, receivingAddress: RECEIVER, units: 10n ** 18n });
  assert.equal(out.txHash, `0x${'ab'.repeat(32)}`);
  const send = w.calls.find((c) => c.method === 'eth_sendTransaction')!;
  assert.deepEqual(send.params, [{
    from: SENDER, to: BASE_SAIN.token, value: '0x0',
    data: '0xa9059cbb00000000000000000000000077547927486dc69793d460661f4a161d1b9068e30000000000000000000000000000000000000000000000000de0b6b3a7640000',
  }]);
  assert.deepEqual(w.calls.find((c) => c.method === 'wallet_switchEthereumChain')!.params, [{ chainId: '0x2105' }]);
});

test('a wallet that does not know Base gets it added', async () => {
  const w = fakeWallet({ account: SENDER, chainId: 1, unknownChain: true });
  await billingSwitchWalletChain(w, 8453);
  const add = w.calls.find((c) => c.method === 'wallet_addEthereumChain')!;
  assert.equal((add.params![0] as { chainName: string }).chainName, 'Base');
  assert.deepEqual((add.params![0] as { rpcUrls: string[] }).rpcUrls, ['https://mainnet.base.org']);
});

test('a different connected account is refused before anything is sent', async () => {
  const w = fakeWallet({ account: SENDER, chainId: 8453 });
  await assert.rejects(
    billingSendDeposit({ provider: w, signedInAddress: RECEIVER, chain: BASE_SAIN, receivingAddress: RECEIVER, units: 1n }),
    (e: unknown) => e instanceof BillingDepositError && e.message === 'account_mismatch',
  );
  assert.ok(!w.calls.some((c) => c.method === 'eth_sendTransaction' || c.method === 'wallet_switchEthereumChain'));
});

test('zero is not a deposit', async () => {
  const w = fakeWallet({ account: SENDER, chainId: 8453 });
  await assert.rejects(billingSendDeposit({ provider: w, signedInAddress: SENDER, chain: BASE_SAIN, receivingAddress: RECEIVER, units: 0n }), /bad_amount/);
  assert.equal(w.calls.length, 0);
});

test('an older node without you.busy_expected_tok_s still parses; the busy figure is then absent, not zero', () => {
  const v = parseBillingThroughputResponse({ model: 'M', rate: { tok_s: 10, measured: true, samples: 1 }, free_tier: { expected_tok_s: 10 }, you: { address: '0xabc', deposited_sain: 1, expected_tok_s: 10, idle: true }, deposits: { enabled: false } });
  assert.equal(v?.you?.busyExpectedTokS, null);
});
