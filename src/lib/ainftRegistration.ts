/** Native AINFT Factory wire contract, signed by the injected AIN wallet. */
export interface AinftWallet {
  getAddress(): Promise<string>;
  getNetwork(): Promise<{ chainId: number }>;
  signMessage(message: string): Promise<string>;
  sendTransaction(input: Record<string, unknown>): Promise<unknown>;
}
export const AINFT_NETWORKS = {
  0: { name: 'TestNet', factory: 'https://ainft-api-dev.ainetwork.ai' },
  1: { name: 'MainNet', factory: 'https://ainft-api.ainetwork.ai' },
} as const;
export type AinftChain = keyof typeof AINFT_NETWORKS;
export interface AinftRegistration {
  agentId: string;
  address: string;
  chainId: AinftChain;
  objectId: string | null;
  tokenId: string;
  tokenOwner?: string;
  stage: 'new' | 'collection' | 'mint' | 'metadata' | 'indexed';
  pending: 'collection' | 'mint' | 'metadata' | null;
  transactions: Partial<Record<'collection' | 'mint' | 'metadata', string>>;
}
export interface AinftTokenRow {
  owner: string;
  tokenId: string;
  ainftObject: { id: string; name: string; owner: string };
  tokenURI: string;
  metadata?: Record<string, unknown>;
}
const addressOk = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-f]{40}$/i.test(s);

export class AinftOperationInactiveError extends Error {
  constructor() { super('The registration view or account changed. Reopen registration to continue.'); }
}

/** The existing metadata host normalizes token IDs as numbers. Keep new IDs exact in that API. */
export function createNativeAinftTokenId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return String(bytes.reduce((value, byte) => value * 256 + byte, 0) + 1);
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

export class AinftFactoryClient {
  constructor(readonly chainId: AinftChain, private readonly wallet: AinftWallet, private readonly http: typeof fetch = (input, init) => fetch(input, init), private readonly isCurrent: () => boolean = () => true) {}

  assertCurrent() { if (!this.isCurrent()) throw new AinftOperationInactiveError(); }

  async checkWallet(address: string) {
    this.assertCurrent();
    const [current, network] = await Promise.all([this.wallet.getAddress(), this.wallet.getNetwork()]);
    this.assertCurrent();
    if (!addressOk(current) || current.toLowerCase() !== address.toLowerCase()) throw new Error('The AIN wallet account changed. Switch back to the registration account.');
    if (network.chainId !== this.chainId) throw new Error(`Switch the AIN wallet to ${AINFT_NETWORKS[this.chainId].name}.`);
  }

  async request(path: string, body?: Record<string, unknown>, signedPath?: string, allowEmptyData = false): Promise<any> {
    this.assertCurrent();
    const method = body ? 'POST' : 'GET';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (signedPath && body) {
      const timestamp = Date.now();
      const message = stableJson({ method, path: signedPath, timestamp, body: stableJson(body) });
      headers['X-AINFT-Date'] = String(timestamp);
      headers.Authorization = `AINFT ${await this.wallet.signMessage(message)}`;
    }
    this.assertCurrent();
    const response = await this.http(`${AINFT_NETWORKS[this.chainId].factory}${path}`, {
      method, headers, cache: 'no-store', ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000),
    });
    const envelope = await response.json();
    if (!response.ok || envelope.code !== 0 || (!allowEmptyData && envelope.data == null)) throw new Error(envelope.message || 'AINFT Factory request failed');
    return envelope.data;
  }

  async tokens(address: string | null, objectId: string, tokenId: string): Promise<AinftTokenRow[]> {
    const query = new URLSearchParams({ ...(address ? { userAddress: address } : {}), ainftObjectId: objectId, tokenId, limit: '100' });
    const response = await this.request(`/nft/native/search/nfts?${query}`);
    if (!Array.isArray(response.nfts)) throw new Error('Invalid AINFT search response');
    return response.nfts.filter((t: AinftTokenRow) => addressOk(t?.owner) && (!address || t.owner.toLowerCase() === address.toLowerCase())
      && t.ainftObject?.id?.toLowerCase() === objectId.toLowerCase() && String(t.tokenId) === tokenId);
  }

  async token(objectId: string, tokenId: string): Promise<AinftTokenRow | null> {
    const rows = await this.tokens(null, objectId, tokenId);
    if (rows.length > 1) throw new Error('Ambiguous AINFT ownership index');
    return rows[0] ?? null;
  }

  async collection(objectId: string) {
    const response = await this.request(`/nft/native/search/ainftObjects?${new URLSearchParams({ ainftObjectId: objectId })}`);
    return response.ainftObjects?.find((o: { id: string }) => o.id?.toLowerCase() === objectId.toLowerCase()) ?? null;
  }

  async registerObject(state: AinftRegistration) {
    await this.checkWallet(state.address);
    const message = stableJson({ address: state.address, timestamp: Date.now() });
    const signature = await this.wallet.signMessage(message);
    this.assertCurrent();
    return this.request('/nft/native/register', { signature, message, ainftObjectId: state.objectId }, undefined, true);
  }

  async submit(state: AinftRegistration, tx: unknown): Promise<string> {
    await this.checkWallet(state.address);
    if (!tx || typeof tx !== 'object' || !('operation' in tx)) throw new Error('Factory returned an invalid transaction');
    const result = await this.wallet.sendTransaction(tx as Record<string, unknown>) as { tx_hash?: string; result?: { code?: number; result_list?: Record<string, { code?: number }> } };
    const operations = Object.values(result?.result?.result_list ?? {});
    // Native collection creation is SET: its successful response has per-operation codes,
    // and no top-level code. A single operation supplies the top-level code instead.
    const success = result?.result && (result.result.code === 0
      || (result.result.code === undefined && operations.length > 0))
      && operations.every((r) => r?.code === 0);
    if (!success
      || !/^0x[0-9a-f]{64}$/i.test(result.tx_hash ?? '')) throw new Error('AINFT transaction did not succeed');
    return result.tx_hash!;
  }
}

export function isAinftRegistration(value: unknown): value is AinftRegistration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as AinftRegistration;
  return addressOk(state.address) && (state.objectId === null || addressOk(state.objectId))
    && (state.tokenOwner === undefined || addressOk(state.tokenOwner))
    && typeof state.agentId === 'string' && /^[a-z0-9][a-z0-9-]{0,39}$/.test(state.agentId)
    && typeof state.tokenId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(state.tokenId)
    && (state.chainId === 0 || state.chainId === 1) && ['new', 'collection', 'mint', 'metadata', 'indexed'].includes(state.stage)
    && !!state.transactions && typeof state.transactions === 'object' && !Array.isArray(state.transactions)
    && Object.entries(state.transactions).every(([key, hash]) => ['collection', 'mint', 'metadata'].includes(key) && typeof hash === 'string' && /^0x[0-9a-f]{64}$/i.test(hash))
    && (state.pending === null || ['collection', 'mint', 'metadata'].includes(state.pending));
}

/** Save BEFORE prompting the signer. An unknown outcome is reconciled, never blindly resubmitted. */
export async function registerAgentAsAinft(client: AinftFactoryClient, state: AinftRegistration,
  metadata: Record<string, unknown>, save: (state: AinftRegistration) => void): Promise<AinftRegistration> {
  if (!isAinftRegistration(state) || state.chainId !== client.chainId) throw new Error('Invalid registration state');
  let next = structuredClone(state);
  const persist = () => save(structuredClone(next));
  const submit = async (kind: 'collection' | 'mint' | 'metadata', tx: unknown) => {
    try { next.transactions[kind] = await client.submit(next, tx); persist(); }
    catch (error) {
      // A decline proves no transaction was submitted. A closed window or network error does not.
      if (error instanceof AinftOperationInactiveError || error === '[sendTx] user declined' || (error && typeof error === 'object' && 'code' in error && error.code === 4001)) {
        next.pending = null;
        if (kind === 'collection') next.objectId = null;
        persist();
      }
      throw error;
    }
  };
  await client.checkWallet(next.address);
  if (next.objectId) {
    const object = await client.collection(next.objectId);
    if (!object && next.stage === 'new' && !next.pending) throw new Error('The selected AINFT collection is not registered.');
    if (object && object.owner?.toLowerCase() !== next.address.toLowerCase()) throw new Error('Only the AINFT collection owner can mint or publish metadata.');
    if (object && (next.pending === 'collection' || next.stage === 'new')) {
      next.pending = null; next.stage = 'collection'; persist();
    }
    const tokens = await client.tokens(null, next.objectId, next.tokenId);
    if (tokens.length) {
      if (tokens.length !== 1) throw new Error('Ambiguous AINFT ownership index');
      next.tokenOwner = tokens[0].owner;
      if (Object.entries(metadata).every(([k, v]) => stableJson(tokens[0].metadata?.[k]) === stableJson(v))) {
        next.stage = 'indexed'; next.pending = null; persist(); return next;
      }
      if (next.pending === 'mint' || next.stage === 'collection' || next.stage === 'indexed') {
        next.stage = 'mint'; next.pending = null; persist();
      }
    }
  }
  if (next.pending) {
    if (next.pending === 'collection' && next.transactions.collection && next.objectId) await client.registerObject(next);
    throw new Error('A submitted transaction is not yet confirmed by the Factory index. Refresh registration later; it will not be submitted twice.');
  }
  if (next.stage === 'indexed') throw new Error('Published metadata changed. Refresh the binding before updating it.');
  if (next.stage === 'new') {
    const created = await client.request('/nft/native', { address: next.address, name: 'Ainize Agents', symbol: 'AINAGENT' }, '/nft/native');
    client.assertCurrent();
    if (!addressOk(created.ainftObjectId)) throw new Error('Factory returned an invalid collection ID');
    next.objectId = created.ainftObjectId;
    next.pending = 'collection'; persist();
    await submit('collection', created.txBody);
    await client.registerObject(next);
    if (!await client.collection(next.objectId!)) throw new Error('Collection confirmation is pending. Refresh registration later.');
    next.pending = null; next.stage = 'collection'; persist();
  }
  if (next.stage === 'collection') {
    const tx = await client.request(`/nft/native/${next.objectId}/mint`, { address: next.address, toAddress: next.address, tokenId: next.tokenId }, `/native/${next.objectId}/mint`);
    client.assertCurrent();
    next.pending = 'mint'; persist();
    await submit('mint', tx);
    if (!await client.token(next.objectId!, next.tokenId)) throw new Error('Token confirmation is pending. Refresh registration later.');
    next.pending = null; next.stage = 'mint'; persist();
  }
  if (next.stage === 'mint') {
    const token = await client.token(next.objectId!, next.tokenId);
    if (!token) throw new Error('Token is not uniquely indexed.');
    next.tokenOwner = token.owner;
    const merged = { ...(token.metadata ?? {}), ...metadata };
    const tx = await client.request('/nft/native/metadata', { ainftObjectId: next.objectId, tokenId: next.tokenId, metadata: merged, userAddress: next.address });
    client.assertCurrent();
    next.pending = 'metadata'; persist();
    await submit('metadata', tx);
    next.pending = null; next.stage = 'metadata'; persist();
  }
  const token = await client.token(next.objectId!, next.tokenId);
  if (!token || Object.entries(metadata).some(([k, v]) => stableJson(token.metadata?.[k]) !== stableJson(v))) throw new Error('Metadata indexing is pending. Refresh registration later.');
  next.tokenOwner = token.owner;
  next.stage = 'indexed'; next.pending = null; persist();
  return next;
}
