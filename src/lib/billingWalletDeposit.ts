/**
 * Send a throughput deposit from the browser wallet — the only thing on the billing page that moves money.
 *
 * WHAT A DEPOSIT IS. A plain ERC-20 `transfer` to the node operator's receiving address. The node's deposit
 * watcher credits it to the SENDER (ainize-node `deposit-watcher.ts`), so the account that sends is the account
 * that gets faster. That is why `billingSendDeposit` refuses when the wallet's connected account is not the
 * address signed in to this site: the transfer would still succeed on-chain, and it would be credited to an
 * address the person is not using here — money spent on somebody else's speed, with nothing on this page to show
 * for it. Refused before the wallet opens, with the reason, rather than discovered afterwards.
 *
 * WHICH WALLET. The same one sign-in uses: `discoverWallets` / `connect` in `ethWallet.ts` (EIP-6963, then
 * `window.ethereum`). No wallet library — the three calls this needs (`wallet_switchEthereumChain`,
 * `wallet_addEthereumChain`, `eth_sendTransaction`) are plain EIP-1193 requests, and the calldata is built in
 * `billingThroughput.ts` where it is tested against a known vector.
 *
 * WHICH CHAIN. The wallet is switched to the chain the node watches for the chosen token, and then ASKED which
 * chain it is on before anything is sent. A wallet that silently stayed on another chain would send the same
 * calldata to the same address on a network where it is a different contract, or none.
 */
import { connect, WalletError, type Eip1193Provider } from './ethWallet';
import {
  BILLING_ADDABLE_CHAINS, billingChainIdHex, billingErc20TransferCalldata, billingSameAddress,
  type BillingDepositChain,
} from '../api/billingThroughput';

/**
 * Why a deposit did not go out. The message is a stable code the page translates (`billing.err.<code>`), in the
 * style of `WalletError` — never a wallet's own English, which differs by wallet and by version.
 */
export class BillingDepositError extends Error {}

/** EIP-1193 / EIP-3085: the wallet does not know this chain yet. MetaMask mobile nests it under `data.originalError`. */
function billingUnknownChainError(e: unknown): boolean {
  const err = e as { code?: number; data?: { originalError?: { code?: number } } } | null;
  return err?.code === 4902 || err?.data?.originalError?.code === 4902;
}
function billingRejectedError(e: unknown): boolean {
  const err = e as { code?: number; message?: string } | null;
  return err?.code === 4001 || /reject|denied|cancel/i.test(err?.message ?? '');
}

/**
 * Put the wallet on `chainId`, adding the chain first when the wallet has never heard of it (Base, on a wallet
 * fresh out of the box). Then read it back: only an `eth_chainId` that says so counts as switched.
 */
export async function billingSwitchWalletChain(provider: Eip1193Provider, chainId: number): Promise<void> {
  const hex = billingChainIdHex(chainId);
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e) {
    if (billingRejectedError(e)) throw new BillingDepositError('rejected');
    const addable = BILLING_ADDABLE_CHAINS[chainId];
    if (!billingUnknownChainError(e) || !addable) throw new BillingDepositError('switch_failed');
    try {
      await provider.request({ method: 'wallet_addEthereumChain', params: [addable] });
    } catch (addError) {
      throw new BillingDepositError(billingRejectedError(addError) ? 'rejected' : 'switch_failed');
    }
  }
  const now = await provider.request({ method: 'eth_chainId' }).catch(() => null);
  if (typeof now !== 'string' || parseInt(now, 16) !== chainId) throw new BillingDepositError('wrong_chain');
}

export interface BillingSendDepositInput {
  provider: Eip1193Provider;
  /** the address signed in to this site (auth `subject`) — the only account a deposit may be sent from */
  signedInAddress: string;
  chain: BillingDepositChain;
  /** the operator's receiving address — the `to` of the ERC-20 transfer, not of the transaction */
  receivingAddress: string;
  /** amount in the token's smallest unit (`billingAmountToUnits`) */
  units: bigint;
}

/**
 * Connect, check the account, switch the chain, send `transfer(receivingAddress, units)` on the token contract.
 * Resolves with the transaction hash — which is when the page starts asking the node whether it has been credited.
 */
export async function billingSendDeposit(input: BillingSendDepositInput): Promise<{ txHash: string; from: string }> {
  const { provider, signedInAddress, chain, receivingAddress, units } = input;
  if (units <= 0n) throw new BillingDepositError('bad_amount');
  if (chain.chainId === null) throw new BillingDepositError('unknown_chain');

  let from: string;
  try {
    from = await connect(provider);
  } catch (e) {
    throw new BillingDepositError(e instanceof WalletError && e.message === 'rejected' ? 'rejected' : 'connect_failed');
  }
  if (!billingSameAddress(from, signedInAddress)) throw new BillingDepositError('account_mismatch');

  await billingSwitchWalletChain(provider, chain.chainId);

  const data = billingErc20TransferCalldata(receivingAddress, units);
  let txHash: unknown;
  try {
    txHash = await provider.request({ method: 'eth_sendTransaction', params: [{ from, to: chain.token, data, value: '0x0' }] });
  } catch (e) {
    throw new BillingDepositError(billingRejectedError(e) ? 'rejected' : 'send_failed');
  }
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new BillingDepositError('send_failed');
  return { txHash: txHash.toLowerCase(), from };
}
