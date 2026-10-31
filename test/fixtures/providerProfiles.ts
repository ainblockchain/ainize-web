import type { TeacherProfile, VerifierProfile } from '../../src/api/types';
export const providerAddress = `0x${'a'.repeat(40)}`;
export const teacherProfile = (address = providerAddress): TeacherProfile => ({
  address, name: 'Selected teacher', hidden: false, lessons: [],
  ledger: { kind: 'local', currency: 'CREDIT' },
  earnings: { currency: 'CREDIT', owed: '0', paid: '0', pending: '0', failed: '0', sales: 0, items: [] },
});
export const verifierProfile = (address = providerAddress): VerifierProfile => ({
  address, name: 'Selected verifier', endpoint: null, roles: [], last_seen: null,
  attested: 0, passed: 0, failed: 0, hash_only: 0, rechecks: 0, counted: 0, no_baseline: 0, knowledges: 0,
  executors: [], samples_run: 0, model_seconds: 0, measured_runs: 0,
  challenges_raised: 0, challenges_upheld: 0, challenges_dismissed: 0, challenges_open: 0,
  attestations_later_challenged: 0, disagreed_with_peers: 0, first_at: null, last_at: null, items: [],
});
