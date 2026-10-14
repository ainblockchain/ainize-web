import type { AinftWallet } from './ainftRegistration';

/** The native wallet uses the existing AIN challenge/session protocol, not an EIP-191 signature. */
export async function ainWalletLoginProof(wallet: Pick<AinftWallet, 'getAddress' | 'signMessage'>,
  challenge: () => Promise<{ nonce: string; message: string; scheme: string; expires_at: number }>) {
  const address = await wallet.getAddress();
  if (!/^0x[0-9a-f]{40}$/i.test(address)) throw new Error('AIN Wallet returned an invalid address');
  const issued = await challenge();
  if (issued.scheme !== 'ain' || !/^[0-9a-f]{32}$/.test(issued.nonce) || issued.expires_at <= Date.now()
    || !issued.message.startsWith('ainize-login:')) throw new Error('Invalid AIN login challenge');
  const signature = await wallet.signMessage(issued.message);
  if ((await wallet.getAddress()).toLowerCase() !== address.toLowerCase()) throw new Error('AIN Wallet account changed while signing');
  return { address, nonce: issued.nonce, signature };
}
