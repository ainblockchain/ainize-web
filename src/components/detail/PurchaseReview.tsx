import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, errorMessage } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { knowledgePath } from '@/lib/detailRoutes';
import { requireRuntimeOperator, LoadKnowledgeError } from '@/lib/loadKnowledge';
import { claimPurchaseOperation, clearPurchaseOperation, confirmPurchase, confirmPurchasedFiles, parsePurchaseRequest, purchaseOwner,
  readPurchaseOperation, reviewPurchase, PurchaseReviewError, type PurchaseReview, type PurchaseOperation, type PurchaseRequest, type PurchaseSelection } from '@/lib/purchaseReview';
import { Sheet, SheetFooter, SheetNote } from '@/components/chat/Sheet';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';

export function PurchaseReviewSheet({ review, request, busy, error, submitted, verified, onConfirm, onRefresh, onInspect, onClose, onDone }: {
  review: PurchaseReview | null; request: PurchaseRequest | null; busy: boolean; error: string | null; submitted: boolean; verified: boolean;
  onConfirm: () => void; onRefresh: () => void; onInspect: () => void; onClose: () => void; onDone: () => void;
}) {
  const { t } = useT();
  return <Sheet title={t(review?.again ? 'detail.purchaseReview.again' : 'detail.purchaseReview.title')} onClose={onClose} width={560} testId="purchase-review">
    {busy && <p role="status">{t('detail.purchaseReview.busy')}</p>}
    {review && <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <p><strong>{review.items.at(-1)!.anchor.name}</strong> · {review.patch_id}</p>
      <p>{t('detail.purchaseReview.maximum', { amount: review.maximum.map(v => `${v.amount} ${v.currency}`).join(' + ') || '0' })}</p>
      {review.again && <Alert $tone="warning">{t('detail.purchaseReview.repeat')}</Alert>}
      <SheetNote>{t('detail.purchaseReview.effect')}</SheetNote>
      <details><summary>{t('detail.purchaseReview.items', { n: review.items.length })}</summary>
        <ul>{review.items.map(i => <li key={i.anchor.id}>
          <Link to={knowledgePath(i.anchor.author, i.anchor.id)}>{i.anchor.name}</Link> · {t(`detail.purchaseReview.action.${i.action}`)}
          {i.action === 'buy' && ` · ${i.anchor.price} ${i.anchor.currency}`}<small style={{ display: 'block' }}>{i.anchor.id} · {i.anchor.patch_sha256}</small>
        </li>)}</ul>
      </details>
    </div>}
    {request && <div data-testid="purchase-request">
      <p>{t(`detail.purchaseReview.state.${request.state}`)}</p>
      {request.result && <>
        <p>{t('detail.purchaseReview.charges', { amount: request.result.confirmed_totals.map(v => `${v.amount} ${v.currency}`).join(' + ') || '0' })}</p>
        <ul>{request.result.items.map(i => <li key={i.id}>{i.id} · {t(`detail.purchaseReview.item.${i.state}`)}{i.error && <p>{i.error}</p>}</li>)}</ul>
      </>}
      {request.error && <Alert $tone="error">{request.error}</Alert>}
    </div>}
    {submitted && !verified && request?.state !== 'refused' && <Alert $tone="warning">{t('detail.purchaseReview.inspectNote')}</Alert>}
    {error && <Alert role="alert" $tone="error">{error}</Alert>}
    {verified && <Alert role="status" $tone="success">{t('detail.purchaseReview.done')}</Alert>}
    <SheetFooter>
      <Button variant="text" disabled={busy} onClick={onClose}>{t('op.close')}</Button>
      {submitted ? <>
        {!verified && request?.state !== 'refused' && <Button variant="text" disabled={busy} onClick={onInspect}>{t('detail.purchaseReview.inspect')}</Button>}
        {(verified || request?.state === 'refused') && <Button onClick={onDone}>{t('detail.purchaseReview.finish')}</Button>}
      </> : <>
        <Button variant="text" disabled={busy} onClick={onRefresh}>{t('op.trackReview.refresh')}</Button>
        <Button disabled={busy || !review || !!error} loading={busy} onClick={onConfirm} data-testid="purchase-review-confirm">{t('detail.purchaseReview.confirm')}</Button>
      </>}
    </SheetFooter>
  </Sheet>;
}

export function usePurchaseReview(target: PurchaseSelection) {
  const auth = useAuth(), active = useActiveView(), { t } = useT();
  const [task] = useState(createNodeActionTask);
  useEffect(() => () => task.abandon(), [task]);
  const current = () => active() && auth.isCurrentAccount();
  const owner = purchaseOwner(auth.cacheIdentity, auth.address, target.id);
  const [ready, setReady] = useState(false), [open, setOpen] = useState(false), [again, setAgain] = useState(false);
  const [review, setReview] = useState<PurchaseReview | null>(null), [operation, setOperation] = useState<PurchaseOperation | null>(null);
  const [request, setRequest] = useState<PurchaseRequest | null>(null), [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [access] = api.useLazyMeQuery(), [readReview] = api.useLazyPurchaseReviewQuery(), [write] = api.usePurchaseReviewedMutation();
  const [readRequest] = api.useLazyPurchaseRequestQuery(), [readItem] = api.useLazyManagedPatchQuery();
  const report = (e: unknown) => e instanceof PurchaseReviewError ? t(`detail.purchaseReview.error.${e.code}`)
    : e instanceof LoadKnowledgeError ? t(`detail.apply.error.${e.code}`) : errorMessage(e);
  useEffect(() => {
    try {
      const stored = readPurchaseOperation(localStorage, owner);
      if (stored && (stored.review.node !== auth.address || stored.subject !== auth.subject || stored.review.patch_id !== target.id
        || stored.review.items.at(-1)!.anchor.author.toLowerCase() !== target.author.toLowerCase())) throw new PurchaseReviewError('storage');
      if (stored) { setOperation(stored); setReview(stored.review); setAgain(stored.review.again); }
      setReady(true);
    } catch (e) { setError(report(e)); }
  }, [owner]);
  const run = async (mode: 'review' | 'confirm' | 'inspect', repeat = again) => {
    if (!ready || !current() || !auth.isOwner || task.pending()) return;
    let stored: PurchaseOperation | null;
    try { stored = readPurchaseOperation(localStorage, owner); }
    catch (e) { setError(report(e)); setOpen(true); return; }
    if (stored && mode !== 'inspect') { setOperation(stored); setReview(stored.review); setOpen(true); return; }
    if (mode === 'confirm' && !review) return;
    setBusy(true); setError(null); setOpen(true); let stillCurrent = current;
    try {
      await task.run(current, async check => {
        stillCurrent = check;
        const deps = { current: check, node: auth.address, subject: auth.subject, readAccess: () => access(undefined, false).unwrap(),
          review: (id: string, again: boolean) => readReview({ id, again, identity: auth.cacheIdentity }, false).unwrap() };
        if (mode === 'review') {
          setReview(null); setAgain(repeat); setVerified(false);
          const next = await reviewPurchase(target, repeat, deps); if (next && check()) setReview(next);
        } else {
          let op: PurchaseOperation, value: PurchaseRequest | null;
          if (mode === 'confirm') {
            op = { owner, id: crypto.randomUUID().replaceAll('-', ''), subject: auth.subject, review: structuredClone(review!) };
            value = await confirmPurchase(op, { ...deps,
              claim: async () => {
                if (!navigator.locks) throw new PurchaseReviewError('storage');
                await navigator.locks.request(owner, () => { if (check()) { claimPurchaseOperation(localStorage, op); setOperation(op); } });
              },
              write: () => write({ id: op.review.patch_id, again: op.review.again, expected_review: op.review.revision, request_id: op.id }).unwrap() });
          } else {
            op = stored ?? operation!; if (!op) throw new PurchaseReviewError('unconfirmed');
            if (!await requireRuntimeOperator(deps)) return null;
            value = parsePurchaseRequest(await readRequest({ id: op.id, identity: auth.cacheIdentity }, false).unwrap(), op);
            if (!check()) return null;
            if (!value) throw new PurchaseReviewError('unconfirmed');
          }
          if (value && check()) {
            setRequest(value);
            const complete = await confirmPurchasedFiles(op, value, { current: check,
              read: id => readItem({ id, identity: auth.cacheIdentity }, false).unwrap() });
            if (check()) setVerified(complete);
          }
        }
        return true;
      });
    } catch (e) { if (stillCurrent()) setError(report(e)); }
    finally { if (stillCurrent()) setBusy(false); }
  };
  useEffect(() => {
    if (!open || !operation || request?.state !== 'running') return;
    const timer = setInterval(() => { void run('inspect'); }, 2000);
    return () => clearInterval(timer);
  }, [open, operation?.id, request?.state]);
  const finish = () => {
    if (!operation || !verified && request?.state !== 'refused' || !current()) return;
    try { clearPurchaseOperation(localStorage, operation); setOperation(null); setRequest(null); setReview(null); setOpen(false); setVerified(false); }
    catch (e) { setError(report(e)); }
  };
  return { ready, busy, submitted: !!operation,
    launch: (repeat: boolean) => { if (operation) { setOpen(true); void run('inspect'); } else void run('review', repeat); },
    dialog: <>
      {!ready && error && <Alert role="alert" $tone="error">{error}</Alert>}
      {open && <PurchaseReviewSheet review={review} request={request} busy={busy} error={error} submitted={!!operation} verified={verified}
        onConfirm={() => void run('confirm')} onRefresh={() => void run('review')} onInspect={() => void run('inspect')}
        onClose={() => { if (!task.pending()) setOpen(false); }} onDone={finish} />}
    </> };
}

/** The chat picker keeps this launcher outside its changing result rows. Opening only reads a review. */
export function PurchaseReviewLauncher({ selection }: { selection: { id: string; author: string; nonce: number } }) {
  const auth = useAuth();
  return <PurchaseLaunchView key={JSON.stringify([auth.cacheIdentity, auth.address, selection.id, selection.author, selection.nonce])} selection={selection} />;
}
function PurchaseLaunchView({ selection }: { selection: PurchaseSelection }) {
  const purchase = usePurchaseReview(selection), { t } = useT(), launched = useRef(false);
  useEffect(() => { if (purchase.ready && !launched.current) { launched.current = true; purchase.launch(false); } }, [purchase.ready]);
  return <>{purchase.dialog}<Button variant="text" disabled={!purchase.ready || purchase.busy} onClick={() => purchase.launch(false)}>{t(purchase.submitted ? 'detail.purchaseReview.inspect' : 'detail.purchaseReview.title')}</Button></>;
}
