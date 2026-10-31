import { trackEntry, trackAuthor } from './track';
import { ledgerRecord } from './ledger';

export const dashboardEntry = (id: string) => {
  const entry = trackEntry(id);
  return { ...entry, anchor: { ...entry.anchor, benchmark: { schema: 'fact', queries: 4 } }, passed: 2, quorum: 2, integrity_checks: 1 };
};
export const dashboardAttest = (id = 'selected', passed = true, verifier = trackAuthor, engine = 'cpu') => ledgerRecord('attest', { patch_id: id, passed, verifier, verified_on: engine }, `${id}-${verifier}-${engine}`);
export const verificationPayment = (amount = '2', currency = 'AIN', state = 'pending', evidence: string | null = null) => ({ amount, currency, state, evidence });
