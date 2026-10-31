import { stableJson } from './ainftRegistration';
export interface BenefitPolicy { active: boolean; version: number; title: string; unitCost: number; unitsPerPurchase: number; refundWindowMs: number }
export interface BenefitPurchase { id: string; fingerprint: string; agentId: string; userId: string; policyVersion: number; cost: number; units: number; remaining: number; refundUntil: number; status: 'active' | 'consumed' | 'refunded'; settled: boolean }
export interface BenefitCatalog { agentId: string; policy: BenefitPolicy | null; purchases: BenefitPurchase[] }
type BenefitAvailability = { executionAvailable?: boolean; allowedPolicyVersions?: number[] };
export const benefitUsable = (receipt: BenefitPurchase, connection: BenefitAvailability) => connection.executionAvailable === true
  && receipt.status === 'active' && receipt.remaining > 0 && !!connection.allowedPolicyVersions?.includes(receipt.policyVersion);
/** An explicitly selected receipt must still be available; never substitute another purchase. */
export const selectedBenefit = (catalog: BenefitCatalog, connection: BenefitAvailability, id: string, version: number) =>
  catalog.purchases.find(receipt => receipt.id === id && receipt.policyVersion === version && benefitUsable(receipt, connection)) ?? null;
export function benefitCatalog(value: unknown, agentId: string, userId: string): BenefitCatalog {
  const data = value as BenefitCatalog | null;
  const integer = (x: number, min = 0) => Number.isSafeInteger(x) && x >= min;
  if (!data || data.agentId !== agentId || !Array.isArray(data.purchases)) throw new Error('Invalid benefit catalog');
  const policy = data.policy;
  if (policy !== null && (!policy || typeof policy.active !== 'boolean' || !integer(policy.version, 1) || typeof policy.title !== 'string' || !policy.title.trim() || policy.title.length > 200 || policy.unitCost > Number.MAX_SAFE_INTEGER || !Number.isFinite(policy.unitCost) || policy.unitCost < 0 || !integer(policy.unitsPerPurchase, 1) || !integer(policy.refundWindowMs))) throw new Error('Invalid benefit policy');
  for (const receipt of data.purchases) {
    if (!receipt || !/^[a-f0-9]{64}$/.test(receipt.id) || !/^[a-f0-9]{64}$/.test(receipt.fingerprint) || receipt.agentId !== agentId || receipt.userId !== userId || !integer(receipt.policyVersion, 1) || receipt.cost > Number.MAX_SAFE_INTEGER || !Number.isFinite(receipt.cost) || receipt.cost < 0 || !integer(receipt.units, 1) || !integer(receipt.remaining) || receipt.remaining > receipt.units || !integer(receipt.refundUntil) || typeof receipt.settled !== 'boolean' || !['active','consumed','refunded'].includes(receipt.status)) throw new Error('Invalid benefit receipt');
  }
  return data;
}
interface Intent { requestKey: string; policyVersion: number; quantity: 1 }
/** Persist before signing. Unknown outcomes keep the same key across page reloads. */
export class AinftBenefitPurchase {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, private readonly key: string) {}
  pending(): Intent | null {
    const raw = this.storage.getItem(this.key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Intent;
    if (!value || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.requestKey) || !Number.isSafeInteger(value.policyVersion) || value.policyVersion < 1 || value.quantity !== 1) throw new Error('Invalid saved purchase intent');
    return value;
  }
  prepare(policyVersion: number): Intent {
    const prior = this.pending();
    if (prior) return prior;
    if (!Number.isSafeInteger(policyVersion) || policyVersion < 1) throw new Error('Invalid benefit policy version');
    const next: Intent = { requestKey: crypto.randomUUID(), policyVersion, quantity: 1 };
    this.storage.setItem(this.key, JSON.stringify(next));
    return next;
  }
  async reconcile(catalog: BenefitCatalog, userId: string): Promise<BenefitPurchase | null> {
    const intent = this.pending();
    if (!intent) return null;
    const action = { type: 'purchase', agentId: catalog.agentId, userId, ...intent };
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(action)));
    const fingerprint = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,'0')).join('');
    const receipt = catalog.purchases.find(row => row.fingerprint === fingerprint);
    if (receipt && this.pending()?.requestKey === intent.requestKey) this.storage.removeItem(this.key);
    return receipt ?? null;
  }
}
