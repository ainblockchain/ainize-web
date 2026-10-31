import { billingAmountToUnits, billingErc20TransferCalldata, billingSameAddress } from '../api/billingThroughput';
import { billingDepositSelection, sameBillingDeposit, type BillingDepositSelection } from './billingView';
import { BillingDepositError } from './billingWalletDeposit';
import type { Eip1193Provider } from './ethWallet';

/** Refresh both the session and the financial target. Displayed speed estimates may change; payment details may not. */
export async function confirmBillingSelection(selection: BillingDepositSelection, deps: {
  current: () => boolean; access: () => Promise<unknown>; quote: () => Promise<unknown>;
}) {
  const current = () => { if (!deps.current()) throw new BillingDepositError('departed'); };
  current(); const access = await deps.access() as any; current();
  if (!access || access.signedIn !== true || !billingSameAddress(access.subject, selection.subject)
    || !billingSameAddress(access.address, selection.node)) throw new BillingDepositError('access');
  const raw = await deps.quote(); current();
  const fresh = billingDepositSelection(raw, selection);
  if (!fresh || !sameBillingDeposit(selection, fresh)) throw new BillingDepositError('configuration');
}

/** Recover a lost hash using read-only wallet RPC. An arbitrary transaction must never unlock another deposit. */
export async function recoverBillingHash(provider: Eip1193Provider, selection: BillingDepositSelection, nonce: string, hash: string) {
  if (!/^0x[\da-f]{64}$/i.test(hash) || !/^0x[\da-f]+$/i.test(nonce)) throw new BillingDepositError('transaction');
  const chain = await provider.request({ method: 'eth_chainId' });
  if (typeof chain !== 'string' || !/^0x[\da-f]+$/i.test(chain) || BigInt(chain) !== BigInt(selection.chain.chainId!)) throw new BillingDepositError('wrong_chain');
  const tx = await provider.request({ method: 'eth_getTransactionByHash', params: [hash] }) as any;
  const data = billingErc20TransferCalldata(selection.receiver, billingAmountToUnits(selection.amount)!);
  if (!tx || typeof tx.nonce !== 'string' || !/^0x[\da-f]+$/i.test(tx.nonce) || BigInt(tx.nonce) !== BigInt(nonce) || typeof tx.hash !== 'string' || tx.hash.toLowerCase() !== hash.toLowerCase()
    || !billingSameAddress(tx.from, selection.subject) || !billingSameAddress(tx.to, selection.chain.token)
    || typeof tx.input !== 'string' || tx.input.toLowerCase() !== data.toLowerCase()
    || typeof tx.value !== 'string' || !/^0x0+$/i.test(tx.value)) throw new BillingDepositError('transaction');
  // Verify the network again in case the wallet changed while the RPC was in flight.
  if (await provider.request({ method: 'eth_chainId' }) !== chain) throw new BillingDepositError('wrong_chain');
  return hash.toLowerCase();
}
