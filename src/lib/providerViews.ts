import type { TeacherProfile, VerifierProfile } from '../api/types';
const record = (v: unknown): Record<string, any> | null => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const text = (v: unknown) => typeof v === 'string';
const optionalText = (v: unknown) => v == null || text(v);
const count = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const list = (v: unknown, check: (row: any) => boolean) => Array.isArray(v) && v.every(check);
const fields = (v: Record<string, any>, keys: string[], check: (v: unknown) => boolean) => keys.every(k => check(v[k]));
const score = (v: unknown) => !!record(v) && Object.values(v as object).every(x => text(x) || typeof x === 'number' && Number.isFinite(x));
const sameAddress = (v: unknown, address: string) => typeof v === 'string' && v.toLowerCase() === address.toLowerCase();

export function teacherView(raw: unknown, address: string): TeacherProfile | null {
  const p = record(raw), e = record(p?.earnings);
  if (!p || !e || !sameAddress(p.address, address) || !optionalText(p.name) || typeof p.hidden !== 'boolean'
    || !fields(e, ['currency', 'owed', 'paid', 'pending', 'failed'], text) || !count(e.sales)) return null;
  if (!list(p.lessons, l => !!record(l) && fields(l, ['id', 'name', 'status', 'revenue'], text) && !!l.id
    && typeof l.verified === 'boolean' && count(l.downloads) && optionalText(l.job_id)
    && ['created_at', 'attestations', 'quorum'].every(k => l[k] == null || count(l[k]))
    && (l.results == null || list(l.results, r => !!record(r) && fields(r, ['verifier', 'verified_on'], text) && optionalText(r.verifier_name)
      && typeof r.passed === 'boolean' && count(r.created_at) && score(r.score)
      && list(r.failures, f => !!record(f) && fields(f, ['prompt', 'expect', 'got'], text)))))) return null;
  if (!list(e.items, i => !!record(i) && fields(i, ['patch_id', 'seller', 'settle_hash', 'amount', 'currency', 'scheme'], text)
    && ['paid', 'pending', 'failed'].includes(i.status) && count(i.created_at) && optionalText(i.tx_hash) && optionalText(i.last_error)
    && ['attempts', 'max_attempts', 'paid_at'].every(k => i[k] == null || count(i[k]))
    && (i.payout_id === undefined || Number.isInteger(i.payout_id) && i.payout_id > 0))) return null;
  if (p.verification != null && (!record(p.verification) || !fields(p.verification, ['quorum', 'verifiers'], count))) return null;
  if (p.ledger != null && (!record(p.ledger) || !['local', 'ain'].includes(p.ledger.kind) || !text(p.ledger.currency))) return null;
  return p as TeacherProfile;
}

export function verifierView(raw: unknown, address: string): VerifierProfile | null {
  const p = record(raw);
  if (!p || !sameAddress(p.address, address) || !optionalText(p.name) || !optionalText(p.endpoint)
    || !list(p.roles, text) || !list(p.executors, text)
    || !fields(p, ['attested', 'passed', 'failed', 'hash_only', 'rechecks', 'counted', 'no_baseline', 'knowledges', 'samples_run', 'model_seconds', 'measured_runs', 'challenges_raised', 'challenges_upheld', 'challenges_dismissed', 'challenges_open', 'attestations_later_challenged', 'disagreed_with_peers'], count)
    || !['first_at', 'last_at'].every(k => p[k] === null || count(p[k]))) return null;
  if (!list(p.items, i => !!record(i) && fields(i, ['patch_id', 'name', 'status', 'verified_on'], text) && !!i.patch_id
    && fields(i, ['passed', 'recheck', 'challenged_after'], v => typeof v === 'boolean') && score(i.score) && count(i.created_at)
    && ['samples_run', 'samples_available', 'duration_ms'].every(k => i[k] === null || count(i[k])))) return null;
  return p as VerifierProfile;
}
