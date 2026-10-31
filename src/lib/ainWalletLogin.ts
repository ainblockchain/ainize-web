import type { AinftWallet } from './ainftRegistration';
import { walletLoginProof, type LoginChallenge } from './walletLogin';

/** The native wallet uses the existing AIN challenge/session protocol, not an EIP-191 signature. */
export async function ainWalletLoginProof(wallet: Pick<AinftWallet, 'getAddress' | 'signMessage'>,
  challenge: () => Promise<LoginChallenge>, current: () => boolean = () => true, node?: string | null) {
  return walletLoginProof('ain', { current, node, challenge,
    connect: () => wallet.getAddress(), account: () => wallet.getAddress(), sign: message => wallet.signMessage(message),
  });
}
