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
  BILLING_ADDABLE_CHAINS, billingChainIdHex, billingErc20TransferCalldata, billingSameAddress, billingIsHexAddress,
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
  return err?.code === 4001;
}
const requireCurrent = (current: () => boolean) => { if (!current()) throw new BillingDepositError('departed'); };
const onChain = (value: unknown, chain: number) => typeof value === 'string' && /^0x[\da-f]+$/i.test(value) && BigInt(value) === BigInt(chain);

/**
 * Put the wallet on `chainId`, adding the chain first when the wallet has never heard of it (Base, on a wallet
 * fresh out of the box). Then read it back: only an `eth_chainId` that says so counts as switched.
 */
export async function billingSwitchWalletChain(provider: Eip1193Provider, chainId: number, current = () => true): Promise<void> {
  requireCurrent(current);
  const hex = billingChainIdHex(chainId);
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] });
  } catch (e) {
    if (billingRejectedError(e)) throw new BillingDepositError('rejected');
    const addable = BILLING_ADDABLE_CHAINS[chainId];
    if (!billingUnknownChainError(e) || !addable) throw new BillingDepositError('switch_failed');
    try {
      requireCurrent(current);
      await provider.request({ method: 'wallet_addEthereumChain', params: [addable] });
    } catch (addError) {
      if (addError instanceof BillingDepositError) throw addError;
      throw new BillingDepositError(billingRejectedError(addError) ? 'rejected' : 'switch_failed');
    }
  }
  requireCurrent(current);
  const now = await provider.request({ method: 'eth_chainId' }).catch(() => null);
  requireCurrent(current);
  if (!onChain(now, chainId)) throw new BillingDepositError('wrong_chain');
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
  current?: () => boolean;
  /** Fresh server access/configuration check, after wallet connection and before submission. */
  beforeSend?: () => Promise<void>;
  /** Persist/claim the exact intent immediately before calling eth_sendTransaction. */
  onSubmitting?: (nonce: string) => Promise<void>;
}

/**
 * Connect, check the account, switch the chain, send `transfer(receivingAddress, units)` on the token contract.
 * Resolves with the transaction hash — which is when the page starts asking the node whether it has been credited.
 */
export async function billingSendDeposit(input: BillingSendDepositInput): Promise<{ txHash: string; from: string }> {
  const { provider, signedInAddress, chain, receivingAddress, units } = input;
  let walletChanged = false;
  const current = () => !walletChanged && (input.current?.() ?? true);
  requireCurrent(current);
  if (units <= 0n) throw new BillingDepositError('bad_amount');
  if (!Number.isSafeInteger(chain.chainId) || chain.chainId! <= 0) throw new BillingDepositError('unknown_chain');
  if (!billingIsHexAddress(signedInAddress) || !billingIsHexAddress(receivingAddress) || !billingIsHexAddress(chain.token)
    || /^0x0{40}$/i.test(receivingAddress) || /^0x0{40}$/i.test(chain.token) || chain.decimals !== 18) throw new BillingDepositError('configuration');
  const data = billingErc20TransferCalldata(receivingAddress, units);

  let from: string;
  try {
    from = await connect(provider);
  } catch (e) {
    throw new BillingDepositError(e instanceof WalletError && e.message === 'rejected' ? 'rejected' : 'connect_failed');
  }
  requireCurrent(current);
  if (!billingSameAddress(from, signedInAddress)) throw new BillingDepositError('account_mismatch');

  await billingSwitchWalletChain(provider, chain.chainId!, current);
  const changed = () => { walletChanged = true; };
  const listens = !!provider.on && !!provider.removeListener;
  if (listens) { provider.on!('accountsChanged', changed); provider.on!('chainChanged', changed); }
  try {
    await input.beforeSend?.(); requireCurrent(current);
    const accounts = await provider.request({ method: 'eth_accounts' }); requireCurrent(current);
    if (!Array.isArray(accounts) || !billingSameAddress(accounts[0], signedInAddress)) throw new BillingDepositError('account_mismatch');
    const activeChain = await provider.request({ method: 'eth_chainId' }); requireCurrent(current);
    if (!onChain(activeChain, chain.chainId!)) throw new BillingDepositError('wrong_chain');
    const nonce = await provider.request({ method: 'eth_getTransactionCount', params: [from, 'pending'] }); requireCurrent(current);
    if (typeof nonce !== 'string' || !/^0x[\da-f]+$/i.test(nonce)) throw new BillingDepositError('configuration');
    await input.onSubmitting?.(nonce); requireCurrent(current);
    let txHash: unknown;
    try {
      txHash = await provider.request({ method: 'eth_sendTransaction', params: [{ from, to: chain.token, data, value: '0x0', nonce }] });
    } catch (e) {
      throw new BillingDepositError(billingRejectedError(e) ? 'rejected' : 'send_unconfirmed');
    }
    if (typeof txHash !== 'string' || (!/^0x[0-9a-fA-F]{64}$/.test(txHash) || /^0x0{64}$/i.test(txHash))) throw new BillingDepositError('send_unconfirmed');
    return { txHash: txHash.toLowerCase(), from };
  } finally {
    if (listens) { provider.removeListener!('accountsChanged', changed); provider.removeListener!('chainChanged', changed); }
  }
}
