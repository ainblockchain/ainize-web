import type { StackLayer } from '@/api/types';
import type { RuntimeOperation, RuntimePhase } from '@/lib/runtimeOperation';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';

/** Compact progress/recovery UI, kept outside any fieldset disabled while model work is pending. */
export function RuntimeOperationStatus({ operation, phase, checking, error, review, onRetry, onReview, onCloseReview, onDismiss }: {
  operation: RuntimeOperation; phase: RuntimePhase; checking: boolean; review: StackLayer[] | null;
  error?: string | null;
  onRetry: () => void; onReview: () => void; onCloseReview: () => void; onDismiss: () => void;
}) {
  const { t } = useT();
  return <section data-testid="runtime-operation" aria-label={t('detail.operation.title')}
    style={{ margin: '12px 0', padding: 12, border: '1px solid #ddd', borderRadius: 8, overflowWrap: 'anywhere' }}>
    <div role="status"><strong>{operation.target.name || operation.target.id}</strong> · {t(`detail.operation.${operation.kind}`)} · {t(`detail.operation.${phase}`)}</div>
    {error && <p role="alert" style={{ margin: '8px 0' }}>{error}</p>}
    {!checking && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      <Button size="small" data-testid="runtime-operation-retry" onClick={onRetry}>{t('detail.operation.retry')}</Button>
      <Button size="small" variant="text" data-testid="runtime-operation-review" onClick={onReview}>{t('detail.operation.review')}</Button>
    </div>}
    {review !== null && <Sheet title={t('detail.operation.review')} onClose={onCloseReview} width={480} testId="runtime-operation-review-sheet">
      <p>{t('detail.operation.review_note')}</p>
      <div style={{ maxHeight: '30vh', overflowY: 'auto', overflowWrap: 'anywhere' }}>
        {review.length ? <ol>{review.map(row => <li key={row.patch_id}>{typeof row.name === 'string' && row.name || row.patch_id} <small>({row.patch_id})</small> · <code>{row.sha256.slice(0, 12)}</code></li>)}</ol> : <p>{t('detail.operation.empty')}</p>}
      </div>
      <SheetFooter>
        <Button variant="outlined" onClick={onCloseReview}>{t('common.cancel')}</Button>
        <Button data-testid="runtime-operation-dismiss" disabled={checking} onClick={onDismiss}>{t('detail.operation.dismiss')}</Button>
      </SheetFooter>
    </Sheet>}
  </section>;
}
