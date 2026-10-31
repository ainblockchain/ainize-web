import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { TrackActionReview } from '@/api/types';
import { useT } from '@/i18n';
import { knowledgePath } from '@/lib/detailRoutes';
import { Sheet, SheetFooter, SheetNote } from '@/components/chat/Sheet';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Stack, useMoney } from './common';

export function TrackReviewSheet({ branch, action, review, busy, error, feedback, onRetry, onConfirm, onClose }: {
  branch: string; action: 'subscribe' | 'sync'; review: TrackActionReview | null; busy: boolean; error: string | null;
  feedback?: ReactNode; onRetry: () => void; onConfirm: (replace: boolean) => void; onClose: () => void;
}) {
  const { t } = useT(), money = useMoney();
  const exact = (amount: string, currency: string) => `${amount} ${money.unit(currency)}`;
  const [acceptedRevision, setAcceptedRevision] = useState<string | null>(null);
  const total = review?.total.map(v => exact(v.amount, v.currency)).join(' + ') || exact('0', review?.quote.currency ?? 'CREDIT');
  const hasOverlap = !!review?.overlaps.length;
  const removed = review?.before.filter(r => !review.after.some(a => a.sha256 === r.sha256)) ?? [];
  const added = review?.after.filter(r => !review.before.some(b => b.sha256 === r.sha256)) ?? [];
  return <Sheet title={t(`op.trackReview.title.${action}`, { name: branch })} onClose={onClose} width={640} testId="track-review-sheet">
    {busy && !review && <div role="status">{t('op.trackReview.loading')}</div>}
    {review && <Stack $gap={12}>
      <strong data-testid="track-review-total">{t('op.trackReview.total', { total })}</strong>
      <span>{t('op.trackReview.fee', { total: exact(review.fee.amount, review.fee.currency) })}</span>
      <span>{t('op.trackReview.changes', { add: added.length, remove: removed.length, keep: review.after.length - added.length })}</span>
      <details><summary>{t('op.trackReview.items')}</summary><ul>
        {review.quote.items.map(i => <li key={i.patch_id}>{i.name || i.patch_id} · {t(`op.dash.branches.plan.${i.plan}`)}
          {i.plan === 'buy' && <> · {exact(i.price, i.currency)}</>}
        </li>)}
      </ul></details>
      <details><summary>{t('op.trackReview.model')}</summary>
        <ol>{review.after.map(r => { const a = review.anchors.find(a => a.patch_sha256 === r.sha256); return <li key={r.patch_id}>
          {a ? <Link to={knowledgePath(a.author, a.id)}>{a.name}</Link> : r.patch_id} · {r.reason}
        </li>; })}</ol>
        {removed.length > 0 && <p>{t('op.trackReview.removed', { ids: removed.map(r => r.patch_id).join(', ') })}</p>}
      </details>
      {!review.quote.runtime_available && <Alert $tone="warning">{t('op.trackReview.modelOffline')}</Alert>}
      {hasOverlap && <Alert $tone="warning">
        <p>{t('op.trackReview.overlap')}</p>
        <ul>{review.overlaps.map((o, i) => <li key={i}>{o.track_id} → {o.loaded_id}</li>)}</ul>
        <label><input type="checkbox" checked={acceptedRevision === review.revision} disabled={busy || !!feedback}
          onChange={e => setAcceptedRevision(e.target.checked ? review.revision : null)} /> {t('op.trackReview.acceptOverlap')}</label>
      </Alert>}
      {action === 'subscribe' && <SheetNote>{t('op.dash.branches.sheet.why.keepsup')}</SheetNote>}
      <SheetNote>{t('op.trackReview.partial')}</SheetNote>
    </Stack>}
    {error && <Alert role="alert" $tone="error">{error}</Alert>}
    {feedback}
    <SheetFooter>
      <Button variant="text" color="default" disabled={busy} onClick={onClose}>{t('op.close')}</Button>
      {!feedback && <>
        <Button variant="text" disabled={busy} onClick={onRetry}>{t('op.trackReview.refresh')}</Button>
        <Button variant="contained" loading={busy} disabled={!review || busy || !!error || hasOverlap && acceptedRevision !== review.revision}
          onClick={() => onConfirm(hasOverlap)} data-testid="track-review-confirm">{t(`op.trackReview.confirm.${action}`, { total })}</Button>
      </>}
    </SheetFooter>
  </Sheet>;
}
