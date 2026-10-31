export type WalletProof = { address: string; nonce: string; signature: string };
export type LoginChallenge = { nonce: string; message: string; scheme: string; expires_at: number; node?: string };
export class WalletLoginError extends Error {
  constructor(readonly code: 'changed' | 'challenge' | 'unconfirmed') { super(code); }
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const address = (v: unknown): v is string => typeof v === 'string' && /^0x[0-9a-f]{40}$/i.test(v);
const same = (a: unknown, b: unknown) => typeof a === 'string' && typeof b === 'string' && (address(a) && address(b) ? a.toLowerCase() === b.toLowerCase() : a === b);

/** Stop between each prompt/request when the route, account or selected wallet has changed. */
export async function walletLoginProof(scheme: 'ain' | 'eip191', deps: {
  current: () => boolean; node?: string | null;
  connect: () => Promise<string>; account: () => Promise<string | null>;
  challenge: () => Promise<LoginChallenge>; sign: (message: string, address: string) => Promise<string>;
}): Promise<WalletProof | null> {
  if (!deps.current()) return null;
  const selected = await deps.connect();
  if (!deps.current()) return null;
  if (!address(selected)) throw new WalletLoginError('changed');
  const issued = await deps.challenge();
  if (!deps.current()) return null;
  if (issued.scheme !== scheme || !/^[0-9a-f]{32}$/.test(issued.nonce) || !Number.isFinite(issued.expires_at)
    || issued.expires_at <= Date.now() || typeof issued.message !== 'string' || !issued.message
    || scheme === 'ain' && !issued.message.startsWith('ainize-login:')
    || deps.node && !same(issued.node, deps.node)) throw new WalletLoginError('challenge');
  if (!same(await deps.account(), selected)) throw new WalletLoginError('changed');
  if (!deps.current()) return null;
  const signature = await deps.sign(issued.message, selected);
  if (!deps.current()) return null;
  if (!same(await deps.account(), selected)) throw new WalletLoginError('changed');
  if (!deps.current()) return null;
  if (issued.expires_at <= Date.now()) throw new WalletLoginError('challenge');
  return { address: selected, nonce: issued.nonce, signature };
}

/** A successful POST alone is not proof that this browser has the requested session. */
export async function completeWalletLogin(proof: WalletProof, intent: {
  enroll: boolean; setupToken?: string; node: string; scheme: 'ain' | 'eip191';
}, deps: {
  current: () => boolean;
  login: (proof: WalletProof) => Promise<unknown>;
  enroll: (proof: WalletProof & { setupToken?: string }) => Promise<unknown>;
  session: () => Promise<unknown>;
}): Promise<boolean> {
  if (!deps.current()) return false;
  let answer: unknown;
  try { answer = await (intent.enroll ? deps.enroll({ ...proof, setupToken: intent.setupToken }) : deps.login(proof)); }
  catch (error) {
    if (!deps.current()) return false;
    const status = record(error) ? error.status : null;
    if (typeof status === 'number' && status >= 400 && status < 500) throw error;
    throw new WalletLoginError('unconfirmed');
  }
  if (!deps.current()) return false;
  // A delegated wallet may return its owner's identity. Require the explicit via_key, never infer that binding.
  if (!record(answer) || answer.ok !== true || typeof answer.address !== 'string'
    || !(same(answer.address, proof.address) || !intent.enroll && same(answer.via_key, proof.address))) throw new WalletLoginError('unconfirmed');
  let session: unknown;
  try { session = await deps.session(); } catch { throw new WalletLoginError('unconfirmed'); }
  if (!deps.current()) return false;
  if (!record(session) || session.signedIn !== true || !same(session.address, intent.node)
    || !same(session.subject, answer.address) || session.scheme !== intent.scheme
    || (intent.enroll ? session.isOwner !== true : !same(session.subject, proof.address) && !same(session.via_key, proof.address))) throw new WalletLoginError('unconfirmed');
  return true;
}
