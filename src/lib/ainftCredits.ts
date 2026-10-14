import { AINFT_NETWORKS, AinftFactoryClient, stableJson, type AinftChain, type AinftWallet } from './ainftRegistration';

/** Uses the dedicated wallet-authorized Factory read; legacy routes require an app-owner key. */
export class AinftCreditClient {
  constructor(private readonly chainId: AinftChain, private readonly wallet: AinftWallet, private readonly http: typeof fetch = (input, init) => fetch(input, init)) {}
  async balance(address: string, appId: string, symbol: string, userId: string) {
    for (const value of [appId, symbol, userId]) {
      if (!value.trim() || value.trim() !== value || value.length > 128 || /[.#$\[\]/\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid Factory credit identity');
    }
    const data = await this.read(address, `/credit/symbol/${encodeURIComponent(symbol)}/holder-balance/${encodeURIComponent(userId)}`, appId) as { appId?: string; symbol?: string; userId?: string; walletAddress?: string; balance?: number } | null;
    const balance = data?.balance;
    if (data?.appId !== appId || data?.symbol !== symbol || data?.userId !== userId || typeof data?.walletAddress !== 'string' || data.walletAddress.toLowerCase() !== address.toLowerCase() || typeof balance !== 'number' || !Number.isFinite(balance) || balance < 0) throw new Error('Factory credit balance is unavailable');
    return { chainId: this.chainId, appId, symbol, userId, balance };
  }
  /** The caller persists requestKey before submission and reconciles an uncertain outcome through catalog. */
  async purchase(address: string, appId: string, symbol: string, agentId: string, userId: string, requestKey: string, policyVersion: number, quantity: number) {
    this.identities(appId, symbol, agentId, userId, requestKey);
    if (!Number.isSafeInteger(policyVersion) || policyVersion < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('Invalid benefit quantity or policy version');
    return this.write(address, appId, symbol, agentId, userId, 'purchase', { requestKey, policyVersion, quantity });
  }
  async refund(address: string, appId: string, symbol: string, agentId: string, userId: string, purchaseId: string) {
    this.identities(appId, symbol, agentId, userId, purchaseId);
    return this.write(address, appId, symbol, agentId, userId, 'refund', { purchaseId });
  }
  async catalog(address: string, appId: string, symbol: string, agentId: string, userId: string): Promise<unknown> {
    this.identities(appId, symbol, agentId, userId);
    return this.read(address, `/credit/symbol/${encodeURIComponent(symbol)}/agent-benefits/${encodeURIComponent(agentId)}/catalog/${encodeURIComponent(userId)}`, appId);
  }
  private identities(...values: string[]) {
    for (const value of values) if (!value || value.trim() !== value || value.length > 128 || /[.#$\[\]/\u0000-\u001f\u007f]/.test(value) || ['__proto__', 'prototype', 'constructor'].includes(value)) throw new Error('Invalid Factory credit identity');
  }
  private async write(address: string, appId: string, symbol: string, agentId: string, userId: string, operation: 'purchase' | 'refund', input: Record<string, unknown>): Promise<unknown> {
    const guard = new AinftFactoryClient(this.chainId, this.wallet, this.http);
    await guard.checkWallet(address);
    const path = `/credit/symbol/${encodeURIComponent(symbol)}/agent-benefits/${encodeURIComponent(agentId)}/${operation}/${encodeURIComponent(userId)}`;
    const body = { appId, walletAddress: address, ...input }, timestamp = Date.now();
    const signature = await this.wallet.signMessage(stableJson({ method: 'POST', path, timestamp, body: stableJson(body) }));
    await guard.checkWallet(address);
    const response = await this.http(`${AINFT_NETWORKS[this.chainId].factory}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AINFT-Date': String(timestamp), Authorization: `AINFT ${signature}` },
      body: JSON.stringify(body), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    const envelope = await response.json();
    await guard.checkWallet(address);
    if (!response.ok || envelope?.code !== 0 || envelope?.data == null) throw new Error(envelope?.message || 'Factory benefit request failed');
    return envelope.data;
  }
  private async read(address: string, path: string, appId: string): Promise<unknown> {
    const guard = new AinftFactoryClient(this.chainId, this.wallet, this.http);
    await guard.checkWallet(address);
    const timestamp = Date.now();
    const query = { appId, walletAddress: address };
    const signature = await this.wallet.signMessage(stableJson({ method: 'GET', path, timestamp, querystring: stableJson(query) }));
    await guard.checkWallet(address);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      await guard.checkWallet(address);
      try {
        response = await this.http(`${AINFT_NETWORKS[this.chainId].factory}${path}?${new URLSearchParams(query)}`, {
          method: 'GET', headers: { 'X-AINFT-Date': String(timestamp), Authorization: `AINFT ${signature}` },
          cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
        });
        break;
      } catch (error) {
        if (!(error instanceof TypeError) || !/Failed to fetch|NetworkError|fetch failed/i.test(error.message) || attempt === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    if (!response) throw new Error('Factory credit balance is unavailable');
    if (response.status === 404) {
      await guard.checkWallet(address);
      throw new Error('Factory holder credit reads are not deployed on this server');
    }
    let envelope;
    try { envelope = await response.json(); }
    catch { await guard.checkWallet(address); throw new Error('Factory credit balance is unavailable'); }
    await guard.checkWallet(address);
    if (!response.ok || envelope?.code !== 0 || envelope?.data == null) throw new Error(response.status === 404 ? 'Factory holder credit reads are not deployed on this server' : 'Factory credit balance is unavailable');
    return envelope.data;
  }
}
