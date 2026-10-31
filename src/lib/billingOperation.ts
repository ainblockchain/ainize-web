import { billingAmountToUnits, billingIsHexAddress } from '../api/billingThroughput';
import { sameBillingDeposit, type BillingDepositSelection } from './billingView';
export interface BillingOperation { version: 1; id: string; selection: BillingDepositSelection; nonce: string; txHash: string | null; }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;
export const billingOperationKey = (node: string, subject: string) => `ainize:billing:v1:${node.toLowerCase()}:${subject.toLowerCase()}`;
export function readBillingOperation(storage: Storage, node: string, subject: string): BillingOperation | null {
  const raw = storage.getItem(billingOperationKey(node, subject)); if (raw === null) return null;
  const r = JSON.parse(raw) as BillingOperation, s = r?.selection, c = s?.chain;
  if (typeof r?.nonce !== 'string' || !/^0x[\da-f]+$/i.test(r.nonce) || r?.version !== 1 || !/^[a-f0-9]{32}$/.test(r.id) || !s || !billingIsHexAddress(s.node) || !billingIsHexAddress(s.subject) || s.node.toLowerCase() !== node.toLowerCase() || s.subject.toLowerCase() !== subject.toLowerCase()
    || !billingIsHexAddress(s.receiver) || /^0x0{40}$/i.test(s.receiver) || !billingIsHexAddress(c?.token) || /^0x0{40}$/i.test(c.token) || !Number.isSafeInteger(c.chainId) || c.chainId! <= 0
    || c.decimals !== 18 || typeof c.chain !== 'string' || !c.chain || c.chain.length > 128 || !Number.isSafeInteger(c.confirmations) || c.confirmations < 0 || !['AIN', 'sAIN'].includes(s.token) || c.symbol !== s.token || typeof s.model !== 'string' || !s.model || typeof s.amount !== 'string'
    || billingAmountToUnits(s.amount) === null || billingAmountToUnits(s.amount)! <= 0n
    || r.txHash !== null && !/^0x[\da-f]{64}$/i.test(r.txHash)) throw new Error('storage');
  return r;
}
export function claimBillingOperation(storage: Storage, operation: BillingOperation) {
  const s = operation.selection;
  if (readBillingOperation(storage, s.node, s.subject)) throw new Error('pending');
  storage.setItem(billingOperationKey(s.node, s.subject), JSON.stringify(operation));
  if (readBillingOperation(storage, s.node, s.subject)?.id !== operation.id) throw new Error('storage');
}
export function updateBillingOperation(storage: Storage, operation: BillingOperation, txHash: string | null) {
  const s = operation.selection;
  const stored = readBillingOperation(storage, s.node, s.subject);
  if (!stored || stored.id !== operation.id || stored.txHash !== operation.txHash || stored.nonce !== operation.nonce || !sameBillingDeposit(stored.selection, operation.selection)) throw new Error('storage');
  if (txHash === null) {
    storage.removeItem(billingOperationKey(s.node, s.subject));
    if (readBillingOperation(storage, s.node, s.subject)) throw new Error('storage');
  }
  else {
    if (!/^0x[\da-f]{64}$/i.test(txHash)) throw new Error('storage');
    storage.setItem(billingOperationKey(s.node, s.subject), JSON.stringify({ ...operation, txHash }));
    if (readBillingOperation(storage, s.node, s.subject)?.txHash !== txHash) throw new Error('storage');
  }
}
