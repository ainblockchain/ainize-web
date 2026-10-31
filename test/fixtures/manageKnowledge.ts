import type { PatchDetail } from '../../src/api/types';
import { dashboardEntry } from './dashboard';
export const manageFixture = (id = 'chosen'): PatchDetail => {
  const entry = dashboardEntry(id);
  return { ...entry, anchor: { ...entry.anchor, billing: 'per_download', patch_sha256: 'fixture-sha', benchmark_hash: 'fixture-benchmark', size_bytes: 120, rows: 4, parents: [] },
    status: 'DRAFT', self_checks: 0, owned: true, purchased: false, has_body: true, applied: false, gateway_url: null,
    attestations: [], settlements: [], conflicts: [], supersedes: [], superseded_by: [], lineage: { parents: [], children: [] }, branches: [],
  } as PatchDetail;
};
