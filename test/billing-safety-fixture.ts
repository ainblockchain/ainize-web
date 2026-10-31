export const billingNode = '0x' + '11'.repeat(20), billingSubject = '0x' + '22'.repeat(20), billingReceiver = '0x' + '33'.repeat(20), billingHash = '0x' + 'ab'.repeat(32);
export const billingQuote = () => ({ model: 'M', rate: { tok_s: 10, measured: true, samples: 1 },
  free_tier: { expected_tok_s: 10, busy_expected_tok_s: 0, idle: true },
  you: { address: billingSubject, deposited_sain: 1, expected_tok_s: 10, busy_expected_tok_s: 1, idle: true },
  quote: { token: 'sAIN', amount: '1', sain: 1, expected_tok_s: 10 },
  deposits: { enabled: true, address: billingReceiver, ain_per_sain: 2, chains: [{ chain: 'base-sain', chain_id: 8453, token: '0x' + '44'.repeat(20), symbol: 'sAIN', decimals: 18, confirmations: 30 }] },
});
export const billingInput = () => ({ node: billingNode, subject: billingSubject, model: 'M', token: 'sAIN' as const, amount: '1' });
export const billingCreditFixture = () => ({ version: 1, tx_hash: billingHash, chain: 'base-sain', from: billingSubject, credited: true, shares_units: '1000000000000000001', records: [{ log_index: 0, block_number: 10, shares_units: '1000000000000000000' }, { log_index: 2, block_number: 10, shares_units: '1' }] });
