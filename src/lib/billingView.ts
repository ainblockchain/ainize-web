import { billingAmountToUnits, billingIsHexAddress, billingPickDepositChain, billingSameAddress, parseBillingThroughputResponse,
  type BillingDepositChain, type BillingDepositToken } from '../api/billingThroughput';
const object = (v: any) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonnegative = (v: any) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const optionalNumber = (v: any) => v == null || nonnegative(v);
/** Private throughput facts belong to the selected model and wallet, never a previous query/account. */
export function billingView(raw: unknown, model: string, subject: string | null) {
  const r = raw as any;
  if (!object(r) || r.model !== model || !object(r.rate) || !nonnegative(r.rate.tok_s) || typeof r.rate.measured !== 'boolean'
    || !Number.isSafeInteger(r.rate.samples) || r.rate.samples < 0 || !object(r.free_tier)
    || !nonnegative(r.free_tier.expected_tok_s) || !optionalNumber(r.free_tier.busy_expected_tok_s) || typeof r.free_tier.idle !== 'boolean') return null;
  if (subject ? !object(r.you) || !billingSameAddress(r.you.address, subject) || !nonnegative(r.you.deposited_sain)
    || !nonnegative(r.you.expected_tok_s) || !optionalNumber(r.you.busy_expected_tok_s) || typeof r.you.idle !== 'boolean' : r.you !== null) return null;
  const d = r.deposits;
  if (!object(d) || typeof d.enabled !== 'boolean') return null;
  if (d.enabled && (!billingIsHexAddress(d.address) || /^0x0{40}$/i.test(d.address) || !optionalNumber(d.ain_per_sain) || !Array.isArray(d.chains)
    || !d.chains.every((c: any) => object(c) && typeof c.chain === 'string' && !!c.chain && billingIsHexAddress(c.token) && !/^0x0{40}$/i.test(c.token)
      && ['AIN', 'sAIN'].includes(c.symbol) && c.decimals === 18 && (c.chain_id === null || Number.isSafeInteger(c.chain_id) && c.chain_id > 0)
      && Number.isSafeInteger(c.confirmations) && c.confirmations >= 0))) return null;
  if (r.quote != null && (!object(r.quote) || !['AIN', 'sAIN'].includes(r.quote.token) || typeof r.quote.amount !== 'string'
    || billingAmountToUnits(r.quote.amount) === null || !['sain', 'expected_tok_s', 'busy_expected_tok_s', 'multiplier'].every(k => optionalNumber(r.quote[k]))
    || r.quote.error != null && typeof r.quote.error !== 'string')) return null;
  return parseBillingThroughputResponse(r);
}
export interface BillingDepositSelection {
  node: string; subject: string; model: string; token: BillingDepositToken; amount: string; receiver: string; chain: BillingDepositChain;
}
export function billingDepositSelection(raw: unknown, input: { node: string; subject: string; model: string; token: BillingDepositToken; amount: string }): BillingDepositSelection | null {
  const view = billingView(raw, input.model, input.subject), units = billingAmountToUnits(input.amount);
  if (!billingIsHexAddress(input.node) || !billingIsHexAddress(input.subject) || !view?.deposits.enabled || units === null || units <= 0n || units >= 2n ** 256n) return null;
  const chain = billingPickDepositChain(view.deposits.chains, input.token), quote = view.quote;
  if (!chain || chain.chainId === null || !quote || quote.token !== input.token || quote.amount !== input.amount.trim()
    || quote.error || quote.sain === null || quote.expectedTokS === null) return null;
  return { ...input, amount: input.amount.trim(), receiver: view.deposits.address, chain: structuredClone(chain) };
}
export function sameBillingDeposit(a: BillingDepositSelection, b: BillingDepositSelection) {
  return a.node === b.node && billingSameAddress(a.subject, b.subject) && a.model === b.model && a.token === b.token
    && billingAmountToUnits(a.amount) === billingAmountToUnits(b.amount) && billingSameAddress(a.receiver, b.receiver)
    && a.chain.chain === b.chain.chain && a.chain.chainId === b.chain.chainId && billingSameAddress(a.chain.token, b.chain.token)
    && a.chain.symbol === b.chain.symbol && a.chain.decimals === b.chain.decimals && a.chain.confirmations === b.chain.confirmations;
}
export interface BillingCredit { credited: boolean; sain: string | null; }
/** Versioned node acknowledgement: one exact wallet/hash/watch-chain, retaining integer share precision. */
export function billingCredit(raw: unknown, expected: { txHash: string; subject: string; chain: string }): BillingCredit | null {
  const r = raw as any;
  if (!object(r) || r.version !== 1 || typeof r.tx_hash !== 'string' || r.tx_hash.toLowerCase() !== expected.txHash.toLowerCase()
    || !billingSameAddress(r.from, expected.subject) || r.chain !== expected.chain || typeof r.credited !== 'boolean' || !Array.isArray(r.records)) return null;
  if (!r.credited) return r.records.length === 0 && r.shares_units === '0' ? { credited: false, sain: null } : null;
  const seen = new Set<number>(); let units = 0n;
  for (const e of r.records) {
    if (!object(e) || !Number.isSafeInteger(e.log_index) || e.log_index < 0 || seen.has(e.log_index)
      || !Number.isSafeInteger(e.block_number) || e.block_number < 0 || typeof e.shares_units !== 'string' || !/^[1-9]\d*$/.test(e.shares_units)) return null;
    seen.add(e.log_index); units += BigInt(e.shares_units);
  }
  if (!seen.size || units.toString() !== r.shares_units) return null;
  const whole = units / 10n ** 18n, fraction = (units % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return { credited: true, sain: `${whole}${fraction ? `.${fraction}` : ''}` };
}
