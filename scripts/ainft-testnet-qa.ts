/** Opt-in real testnet registration. Keeps the test key in an explicit private file, never in output. */
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createIdentity } from '@ainize/core';
import { AinftFactoryClient, createNativeAinftTokenId, registerAgentAsAinft, type AinftRegistration, type AinftWallet } from '../src/lib/ainftRegistration.js';
import { loadLiveAgentFixture } from './ainft-live-fixture.js';
const identityFile = process.env.AINFT_LIVE_IDENTITY_FILE;
const sdkPath = process.env.AINFT_LIVE_SDK_PATH;
const agentUrl = process.env.AINFT_LIVE_AGENT_URL;
if (!identityFile || !sdkPath || !agentUrl) throw new Error('Set AINFT_LIVE_IDENTITY_FILE, AINFT_LIVE_SDK_PATH and AINFT_LIVE_AGENT_URL explicitly; this script uses testnet only.');
const fixture = await loadLiveAgentFixture(agentUrl);
const identity = existsSync(identityFile) ? JSON.parse(readFileSync(identityFile, 'utf8')) : createIdentity();
if (!existsSync(identityFile)) writeFileSync(identityFile, JSON.stringify(identity), { mode: 0o600, flag: 'wx' });
const sdk = createRequire(import.meta.url)(sdkPath);
const Ain = sdk.default ?? sdk;
const ain = new Ain('https://testnet-api.ainetwork.ai', undefined, 0);
ain.wallet.addAndSetDefaultAccount(identity.privateKey);
if (ain.wallet.defaultAccount.address.toLowerCase() !== identity.address.toLowerCase()) throw new Error('Test identity does not match the SDK account');
const wallet: AinftWallet = {
  getAddress: async () => identity.address,
  getNetwork: async () => ({ chainId: 0 }),
  signMessage: async (message) => ain.signer.signMessage(message),
  sendTransaction: async (tx) => ain.sendTransaction(tx),
};
const stateFile = `${identityFile}.registration.json`;
let state: AinftRegistration = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, 'utf8')) : {
  agentId: fixture.agentId, address: identity.address, chainId: 0, objectId: null, tokenId: createNativeAinftTokenId(), stage: 'new', pending: null, transactions: {},
};
if (state.agentId !== fixture.agentId || state.address.toLowerCase() !== identity.address.toLowerCase() || state.chainId !== 0) throw new Error('Saved registration belongs to a different agent, account or network');
const fixtureFile = `${identityFile}.fixture.json`;
if (existsSync(fixtureFile) && JSON.parse(readFileSync(fixtureFile, 'utf8')).fingerprint !== fixture.fingerprint) throw new Error('Hosted agent metadata changed; reconcile the saved registration before continuing');
if (!existsSync(fixtureFile)) writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2), { mode: 0o600, flag: 'wx' });
const save = (next: AinftRegistration) => { state = next; writeFileSync(stateFile, JSON.stringify(next, null, 2), { mode: 0o600 }); };
const balance = await ain.db.ref(`/accounts/${identity.address}/balance`).getValue();
console.log(JSON.stringify({ chainId: 0, address: identity.address, balance }));
if (Number(balance ?? 0) <= 0) {
  const response = await fetch(`https://faucet.ainetwork.ai/api/test/${identity.address}/`, { signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  const evidence = { chainId: 0, address: identity.address, at: new Date().toISOString(), funded: false, faucetStatus: response.status, message: String(result.message ?? result.result ?? '').slice(0, 800) };
  writeFileSync(`${identityFile}.evidence.json`, JSON.stringify(evidence, null, 2), { mode: 0o600 });
  console.log(JSON.stringify(evidence));
  // Funding is a distinct phase. Re-run after the chain confirms; do not assume a faucet reply is finality.
  process.exit(response.ok ? 0 : 1);
}
try {
  save(state);
  const registered = await registerAgentAsAinft(new AinftFactoryClient(0, wallet), state, fixture.metadata, save);
  if ((await loadLiveAgentFixture(agentUrl)).fingerprint !== fixture.fingerprint) throw new Error('Agent release changed during native registration');
  console.log(JSON.stringify({ nativeRegistrationVerified: true, hostedAgentUrl: fixture.detailUrl, holderBindingVerified: false, walletDisplayVerified: false, transferVerified: false, registration: registered }));
} catch (error) {
  console.log(JSON.stringify({ verified: false, stage: state.stage, pending: state.pending, transactions: state.transactions, error: error instanceof Error ? error.message : 'Registration failed' }));
  process.exitCode = 1;
}
