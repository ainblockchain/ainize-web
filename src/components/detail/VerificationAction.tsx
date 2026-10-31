import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, Link } from 'react-router';
import { api, errorMessage } from '@/api/api';
import type { Attestation, PatchDetail } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { sameAccountAddress } from '@/lib/accountAccess';
import { knowledgePath } from '@/lib/detailRoutes';
import { LoadKnowledgeError, requireRuntimeOperator, runtimeGuardFailure } from '@/lib/loadKnowledge';
import { followRuntimeOperation, RuntimeOperationError, type RuntimePhase } from '@/lib/runtimeOperation';
import { claimVerification, clearVerification, confirmVerification, prepareVerification, readVerification, reviewVerification,
  reviewVerificationRecovery, sameVerificationReview, saveVerificationJob, verificationOperationKey, verificationRequest, verificationResultKind, verificationTarget,
  VerificationActionError, type VerificationOperation, type VerificationReview, type VerificationRecoveryReview } from '@/lib/verificationOperation';

const storage = () => { try { return window.localStorage; } catch { throw new RuntimeOperationError('storage'); } };
const supported = (raw: unknown) => !!raw && typeof raw === 'object' && 'verification_jobs' in raw && raw.verification_jobs === true
  && 'verification_restoration' in raw && raw.verification_restoration === 1;

/** Public signed history stays visible to everyone; only this node's operator may create a new attestation. */
export function VerificationAction({ detail }: { detail: PatchDetail }) {
  const auth = useAuth(), location = useLocation();
  if (auth.loading || !auth.isOwner) return null;
  const key = JSON.stringify([auth.cacheIdentity, auth.address, location.pathname, location.search, verificationTarget(detail.anchor)]);
  return <VerificationActionView key={key} detail={detail} />;
}
export function VerificationResult({ attestation }: { attestation: Attestation }) {
  const { t } = useT();
  const kind = verificationResultKind(attestation);
  return <span data-testid={`verification-result-${kind}-${attestation.passed ? 'pass' : 'fail'}`}>
    {t(`verifyAction.result.${kind}.${attestation.passed ? 'pass' : 'fail'}`)}
  </span>;
}
function VerificationActionView({ detail }: { detail: PatchDetail }) {
  const auth = useAuth(), { t } = useT(), dispatch = useDispatch(), active = useActiveView();
  const owner = verificationOperationKey(auth.cacheIdentity, auth.address);
  const allowed = useRef(true); allowed.current = auth.isOwner && !auth.loading;
  const current = () => active() && allowed.current && auth.isCurrentAccount();
  const [task] = useState(createNodeActionTask);
  useEffect(() => () => task.abandon(), [task]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<VerificationReview | null>(null), [op, setOp] = useState<VerificationOperation | null>(null);
  const [phase, setPhase] = useState<RuntimePhase>('checking'), [result, setResult] = useState<Attestation | null>(null);
  const [history, setHistory] = useState<VerificationRecoveryReview | null>(null);
  const cap = api.useRuntimeOperationCapabilitiesQuery({ identity: auth.cacheIdentity });
  const [readCap] = api.useLazyRuntimeOperationCapabilitiesQuery(), [readJob] = api.useLazyRuntimeOperationQuery();
  const [readPatch] = api.useLazyManagedPatchQuery(), [readRuntime] = api.useLazyRuntimeQuery(), [readAccess] = api.useLazyMeQuery();
  const [start] = api.useStartVerificationMutation();
  const reads = (target: VerificationReview['target'], stillCurrent: () => boolean) => ({ current: stillCurrent, node: auth.address, subject: auth.subject,
    readAccess: () => readAccess(undefined, false).unwrap(), read: () => readPatch({ id: target.id, identity: auth.cacheIdentity }, false).unwrap(),
    runtime: () => readRuntime({ identity: auth.cacheIdentity }, false).unwrap() });
  const message = (e: unknown) => e instanceof VerificationActionError ? t(`verifyAction.error.${e.code}`)
    : e instanceof LoadKnowledgeError ? t(`detail.apply.error.${e.code}`)
    : e instanceof RuntimeOperationError ? t(`detail.operation.error.${e.code}`)
    : runtimeGuardFailure(e) === 'recovery' ? t('detail.apply.error.recovery') : errorMessage(e);
  const invalidate = () => dispatch(api.util.invalidateTags(['Patch', 'Catalog', 'Runtime', 'Ledger', 'Events']));
  const clear = (saved: VerificationOperation) => { clearVerification(storage(), saved); if (current()) { setOp(readVerification(storage(), owner)); setHistory(null); } };
  const fail = (e: unknown) => {
    if (!current()) return;
    try {
      const saved = readVerification(storage(), owner);
      if (saved?.job?.state === 'failed') { clear(saved); invalidate(); }
      else if (saved) { setOp(saved); setPhase('interrupted'); }
      setError(message(e));
    } catch (storageError) { setError(message(storageError)); }
  };
  const follow = async (saved: VerificationOperation, stillCurrent: () => boolean, submit = false) => {
    const deps = reads(saved.target, stillCurrent);
    if (!await requireRuntimeOperator(deps)) return null;
    const outcome = await followRuntimeOperation(saved, { current: stillCurrent,
      submit: submit ? () => start(verificationRequest(saved)).unwrap() : undefined,
      read: () => readJob({ identity: auth.cacheIdentity, id: saved.request.request_id }, false).unwrap(),
      save: job => { const next = saveVerificationJob(storage(), saved, job); if (stillCurrent()) setOp(next); },
      phase: value => { if (stillCurrent()) setPhase(value); }, wait: () => new Promise(resolve => setTimeout(resolve, 1500)),
    });
    if (!stillCurrent()) return null;
    return confirmVerification(saved, outcome, deps);
  };
  const run = async (work: (stillCurrent: () => boolean) => Promise<void>) => {
    if (!current() || task.pending()) return;
    setBusy(true); setError(null); setResult(null); setHistory(null);
    let stillCurrent = current;
    try { await task.run(current, async check => { stillCurrent = check; await work(check); return true; }); }
    catch (e) { if (stillCurrent()) fail(e); }
    finally { if (stillCurrent()) setBusy(false); }
  };
  const finish = (saved: VerificationOperation, value: Attestation) => { clear(saved); setResult(value); invalidate(); };
  const resume = (saved: VerificationOperation) => run(async check => {
    setOp(saved); setPhase('checking');
    const value = await follow(saved, check);
    if (value && check()) finish(saved, value);
  });
  useEffect(() => {
    const recover = () => {
      if (!current() || task.pending()) return;
      try { const saved = readVerification(storage(), owner); if (saved) void resume(saved); else setOp(null); }
      catch (e) { if (current()) setError(message(e)); }
    };
    recover();
    const changed = (e: StorageEvent) => { if (e.key === owner) recover(); };
    window.addEventListener('storage', changed);
    return () => window.removeEventListener('storage', changed);
    // This component is keyed by account, node, route and selected artifact. A render must not restart polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const begin = () => run(async check => {
    const saved = readVerification(storage(), owner);
    if (saved) { setOp(saved); setPhase('interrupted'); throw new RuntimeOperationError('pending'); }
    const fresh = await readCap({ identity: auth.cacheIdentity }, false).unwrap();
    if (!check()) return;
    if (!supported(fresh)) throw new RuntimeOperationError('unsupported');
    const reviewed = await reviewVerification(detail.anchor, reads(detail.anchor, check));
    if (reviewed && check()) setReview(reviewed);
  });
  const confirm = () => review && run(async check => {
    const reviewed = review;
    const fresh = await reviewVerification(reviewed.target, reads(reviewed.target, check));
    if (!fresh || !check()) return;
    if (!sameVerificationReview(reviewed, fresh)) { setReview(null); throw new VerificationActionError('changed'); }
    const caps = await readCap({ identity: auth.cacheIdentity }, false).unwrap();
    if (!check()) return;
    const random = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
    const saved = prepareVerification(owner, fresh, caps, random);
    if (!navigator.locks) throw new RuntimeOperationError('storage');
    await navigator.locks.request(owner, () => {
      if (!check()) return;
      claimVerification(storage(), saved); setOp(saved); setReview(null); setPhase('submitting');
    });
    if (!check()) return;
    const value = await follow(saved, check, true);
    if (value && check()) finish(saved, value);
  });
  const inspect = (saved: VerificationOperation) => run(async check => {
    const rows = await reviewVerificationRecovery(saved, { ...reads(saved.target, check),
      readJob: () => readJob({ identity: auth.cacheIdentity, id: saved.request.request_id }, false).unwrap() });
    if (rows && check()) setHistory(rows);
  });
  const self = sameAccountAddress(detail.anchor.author, auth.address), draft = detail.status === 'DRAFT';
  const recheck = detail.attestations.some(at => sameAccountAddress(at.verifier, auth.address));
  return <section data-testid="verification-action" style={{ margin: '12px 0', overflowWrap: 'anywhere' }}>
    {!op && !self && !draft && <Button size="small" data-testid="verification-begin" disabled={busy || cap.isFetching || cap.isError || !supported(cap.currentData)} loading={busy} onClick={() => void begin()}>{t(recheck ? 'verifyAction.recheck' : 'verifyAction.begin')}</Button>}
    {!op && self && <small>{t('verifyAction.error.self')}</small>}
    {!op && !self && !draft && !cap.isFetching && (cap.isError || !supported(cap.currentData)) && <div>
      <small>{t(cap.isError ? 'verifyAction.read_failed' : 'verifyAction.unsupported')}</small>{' '}
      <Button size="small" variant="text" disabled={busy} onClick={() => void cap.refetch()}>{t('verifyAction.refresh')}</Button>
    </div>}
    {op && <div data-testid="verification-operation">
      <div role="status"><Link to={`${knowledgePath(op.target.author, op.target.id)}?tab=verification`}>{op.target.name || op.target.id}</Link> · {t(`verifyAction.phase.${phase}`)}</div>
      {!busy && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <Button size="small" onClick={() => void resume(op)}>{t('verifyAction.retry')}</Button>
        <Button size="small" variant="text" onClick={() => void inspect(op)}>{t('verifyAction.review_records')}</Button>
      </div>}
    </div>}
    {error && <p role="alert">{error}</p>}
    {result && <p role="status"><VerificationResult attestation={result} /> · {new Date(result.created_at).toLocaleString()}</p>}
    {review && <Sheet title={t(review.recheck ? 'verifyAction.recheck' : 'verifyAction.begin')} onClose={() => { if (!busy) setReview(null); }} width={480} testId="verification-review">
      <strong>{review.target.name || review.target.id}</strong>
      <p>{t('verifyAction.effect')}</p>
      {review.recheck && <p>{t('verifyAction.recheck_effect')}</p>}
      <details style={{ overflowWrap: 'anywhere' }}><summary>{t('verifyAction.target')}</summary><p>{review.target.id}<br />{review.node}<br />{review.target.patch_sha256}</p></details>
      {error && <p role="alert">{error}</p>}
      <SheetFooter><Button variant="outlined" disabled={busy} onClick={() => setReview(null)}>{t('common.cancel')}</Button>
        <Button disabled={busy} loading={busy} data-testid="verification-confirm" onClick={() => void confirm()}>{t('verifyAction.confirm')}</Button></SheetFooter>
    </Sheet>}
    {history !== null && op && <Sheet title={t('verifyAction.review_records')} onClose={() => setHistory(null)} width={480} testId="verification-recovery-review">
      <p>{t('verifyAction.recovery_note')}</p>
      {history.target !== 'current' && <p>{t(`verifyAction.recovery.${history.target}`)}</p>}
      <div style={{ maxHeight: '30vh', overflowY: 'auto', overflowWrap: 'anywhere' }}>{history.attestations.length ? <ul>{history.attestations.map(at => <li key={at.sig}><VerificationResult attestation={at} /> · {new Date(at.created_at).toLocaleString()}</li>)}</ul> : <p>{t('verifyAction.no_records')}</p>}</div>
      <SheetFooter><Button variant="outlined" onClick={() => setHistory(null)}>{t('common.cancel')}</Button>
        <Button disabled={busy} onClick={() => { if (!current() || task.pending()) return; try { clear(op); setError(null); } catch (e) { fail(e); } }}>{t('verifyAction.dismiss')}</Button></SheetFooter>
    </Sheet>}
  </section>;
}
