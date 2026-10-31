import { dashboardEntry } from './dashboard';

export function purchaseFixture(): any {
  const entry = dashboardEntry('selected'); entry.anchor.patch_sha256 = 'file'; entry.anchor.benchmark_hash = 'benchmark';
  return { patch_id: 'selected', sha256: 'file', tx_hash: 'tx', scheme: 'local-credit', amount: '999', manifest: null, path: '/file', created_at: 1, entry, applied: false,
    payment: { evidence: 'settlement', amount: '0.00000001', currency: 'AIN', scheme: 'ain-transfer', tx_hash: 'tx', created_at: 2, royalty: null } };
}
