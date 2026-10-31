import styled from 'styled-components';
import type { RuntimeApplyReview as Review } from '@/lib/runtimeApplyReview';
import { useT } from '@/i18n';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';
import { Button } from '@/components/ui/Button';

const Rows = styled.ol`margin: 0; padding-left: 22px; overflow-wrap: anywhere; li { padding: 8px 0; }`;
const State = styled.span`margin-left: 8px; font-size: 12px; color: #626772;`;
const Details = styled.details`font-size: 12px; margin: 6px 0; overflow-wrap: anywhere; summary { cursor: pointer; } code { display: block; white-space: normal; }`;

export function RuntimeApplyReview({ review, busy, onClose, onConfirm }: { review: Review; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const { t } = useT();
  return <Sheet title={t('detail.apply.review.title')} onClose={onClose} width={520} testId="apply-review">
    <Rows>
      {review.order.map(row => <li key={row.anchor.id}>
        <strong>{row.anchor.name || row.anchor.id}</strong>
        <State>{t(row.action === 'reuse' ? 'detail.apply.review.reuse' : 'detail.apply.review.load')}</State>
        {row.physical_id !== row.anchor.id && <div>{t('detail.apply.review.alias', { id: row.physical_id })}</div>}
        <Details><summary>{t('detail.apply.review.file')}</summary><code>{row.anchor.id}</code><code>{row.anchor.patch_sha256}</code></Details>
      </li>)}
    </Rows>
    {review.before.length > 0 && <Details>
      <summary>{t('detail.apply.review.preserved', { n: String(review.before.length) })}</summary>
      {review.before.map(row => <code key={row.patch_id}>{row.patch_id} · {row.sha256}</code>)}
    </Details>}
    <SheetFooter>
      <Button variant="outlined" disabled={busy} onClick={onClose}>{t('common.cancel')}</Button>
      <Button variant="contained" disabled={busy} loading={busy} data-testid="apply-confirm-reviewed" onClick={onConfirm}>{t('detail.apply.review.confirm')}</Button>
    </SheetFooter>
  </Sheet>;
}
