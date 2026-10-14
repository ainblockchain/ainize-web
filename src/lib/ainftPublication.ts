import type { AinftWallet } from './ainftRegistration';
export interface CompanionPublicationInput {
  key: string; runId: string; name: string; description: string;
  permanent: boolean; rights: boolean;
}
/** No private keys enter the application; the current holder approves a claim in AIN Wallet. */
export async function publishCompanionLesson(
  wallet: Pick<AinftWallet, 'getAddress' | 'signMessage'>,
  holder: string,
  input: CompanionPublicationInput,
  request: (path: string, body?: unknown) => Promise<unknown>,
  isCurrent: () => boolean,
) {
  if (!input.permanent || !input.rights) throw new Error('Both publication consent declarations are required');
  if (input.name.trim().length < 2 || input.name.trim().length > 80 || input.description.length > 2000) throw new Error('Review the publication title and description');
  const checkHolder = async () => {
    if (!isCurrent()) throw new Error('Holder session changed');
    const address = await wallet.getAddress();
    if (!isCurrent() || !/^0x[0-9a-f]{40}$/i.test(address) || address.toLowerCase() !== holder.toLowerCase()) throw new Error('Use the signed-in holder wallet');
  };
  await checkHolder();
  const path = `/learning/runs/${encodeURIComponent(input.runId)}`;
  const challenge = await request(`${path}/publication-challenge`) as { claim?: unknown; signer?: unknown };
  if (typeof challenge.claim !== 'string' || !/^(0x)?[0-9a-f]{64}$/i.test(challenge.claim) || typeof challenge.signer !== 'string' || challenge.signer.toLowerCase() !== holder.toLowerCase()) throw new Error('Invalid publication claim or holder');
  await checkHolder();
  const signature = await wallet.signMessage(challenge.claim);
  if (!signature) throw new Error('Publication signature declined');
  await checkHolder();
  return request(`${path}/publish`, { key: input.key, name: input.name.trim(), description: input.description.trim(), license: 'CC-BY-4.0', claim_sig: signature, consent: { permanent: true, rights: true } });
}
