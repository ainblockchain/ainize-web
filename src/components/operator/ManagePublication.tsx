import { useEffect, useState } from 'react';
import type { PatchDetail } from '@/api/types';
import { useAnnouncePreviewQuery, useReviewedAnnounceMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { publishReviewed, readPublicationReview, samePublicationReview, PublicationReviewError, type PublicationReview } from '@/lib/publicationReview';
import { knowledgePath } from '@/lib/detailRoutes';
import { benchmarkQuestionCount } from '@/lib/benchmarkQuestions';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, KeyValue, Mono, StatusChip, StyledLink } from '@/components/ui/Misc';
import { Muted, QueryError, Row, useMoney } from './common';
import { num, shortHash } from '@/utils/format';

type Run = (action: (current: () => boolean) => Promise<unknown>, ok?: string, onError?: (message: string) => void) => Promise<void>;
export function ManagePublication({ expected, busy, run, readDetail, onClose, onPublished }: { expected: PatchDetail; busy: boolean; run: Run; readDetail: () => Promise<unknown>; onClose: () => void; onPublished: () => void }) {
  const { t } = useT(), auth = useAuth(), active = useActiveView(), money = useMoney();
  const query = useAnnouncePreviewQuery({ id: expected.anchor.id, identity: auth.cacheIdentity });
  const candidate = !query.isError ? readPublicationReview(query.currentData, expected) : null;
  const [review, setReview] = useState<PublicationReview | null>(() => !query.isFetching ? candidate : null);
  const [typed, setTyped] = useState(''), [error, setError] = useState<string | null>(null);
  const [announce] = useReviewedAnnounceMutation();
  useEffect(() => { if (!review && candidate && !query.isFetching) setReview(candidate); }, [review, candidate, query.isFetching]);
  const changed = !!review && !!candidate && !samePublicationReview(review, candidate);
  const ready = !!review && !!candidate && !query.isFetching && !query.isError && !changed;
  const confirm = () => {
    if (!ready || busy || !review || !active() || !auth.isCurrentAccount()) return;
    setError(null);
    void run(async current => {
      try {
        const result = await publishReviewed(review, expected, typed, { current: () => current() && active() && auth.isCurrentAccount(), preview: () => query.refetch().unwrap(), write: revision => announce({ id: review.anchor.id, revision }).unwrap(), detail: readDetail });
        if (result && current() && active() && auth.isCurrentAccount()) onPublished();
      } catch (err) {
        if (err instanceof PublicationReviewError) throw new Error(t(`op.manage.preview.${err.code}`));
        throw err;
      }
    }, undefined, message => { if (active()) setError(message); });
  };
  const a = review?.anchor;
  return <Sheet title={t('op.manage.publish.title', { name: a?.name || expected.anchor.name || expected.anchor.id })} sub={t('op.manage.publish.sub')} onClose={onClose} width={680} testId="publish-sheet">
    {query.isFetching && !review && <CenterProgress />}
    {!busy && !query.isFetching && !candidate && <QueryError error={query.error} what={t('op.manage.preview.title')} onRetry={() => void query.refetch()} retrying={query.isFetching} />}
    {changed && <Alert role="alert" $tone="warning">{t('op.manage.preview.changed')} <Button type="button" size="small" disabled={busy || query.isFetching} onClick={() => { setReview(candidate); setTyped(''); setError(null); }}>{t('op.manage.preview.refresh')}</Button></Alert>}
    {review && a && <>
      <strong>{t('op.manage.publish.sealed.title')}</strong>
      <KeyValue data-testid="publish-facts">
        <dt>{t('op.manage.publish.f.id')}</dt><dd><Mono>{a.id}</Mono></dd>
        <dt>{t('op.manage.publish.f.name')}</dt><dd>{a.name || a.id}</dd>
        <dt>{t('op.manage.publish.f.price')}</dt><dd>{money.fmt(a.price, a.currency)} · {t(`op.billing.${a.billing}`)}</dd>
        <dt>{t('op.manage.publish.f.license')}</dt><dd>{a.license || t('op.manage.publish.f.license.none')}</dd>
        <dt>{t('op.manage.publish.f.bench')}</dt><dd>{t('op.manage.publish.f.bench.value', { schema: a.benchmark.schema, queries: num(benchmarkQuestionCount(a.benchmark.queries)), samples: a.benchmark.samples?.length ?? 0 })}</dd>
        <dt>{t('op.manage.publish.f.file')}</dt><dd><Mono>{shortHash(a.patch_sha256, 24)}</Mono></dd>
        <dt>{t('op.manage.publish.f.payee')}</dt><dd><Mono>{a.author}</Mono></dd>
      </KeyValue>
      <ul style={{ margin: 0, paddingLeft: 18 }}>{['sealed', 'record', 'verify', 'file'].map(key => <li key={key}>{t(`op.manage.publish.why.${key}`)}</li>)}</ul>
      {review.retires.length === 0 ? <Muted data-testid="publish-no-replacements">{t('op.manage.preview.none')}</Muted> : <>
        <strong>{t('op.manage.retire.title')}</strong>
        <span>{t('op.manage.retire.body', { schema: a.benchmark.schema, id: a.id })}</span>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {review.retires.map(row => <li key={row.patch_id} data-testid="retire-row" data-id={row.patch_id} style={{ padding: '12px 0', borderBottom: '1px solid #eee', overflowWrap: 'anywhere' }}>
            <Row $wrap $gap={8}><StyledLink to={knowledgePath(row.author, row.patch_id)}>{row.name || row.patch_id}</StyledLink><StatusChip status={row.status as PatchDetail['status']} /></Row>
            <Mono>{row.patch_id}</Mono>
            <div data-testid="retire-sales">{row.paid_sales === null || row.revenue === null ? t('op.manage.sales_unknown') : row.paid_sales === 0 ? t('op.manage.retire.sold_none') : t('op.manage.retire.sold', { n: row.paid_sales, revenue: money.revenue(row.revenue, row.currency) })}</div>
            <Muted>{t('op.manage.retire.col.overlap')}: {t('units.rows', { n: num(row.overlap_rows) })}</Muted>
          </li>)}
        </ul>
        <TextField label={t('op.manage.retire.type', { id: a.id })} value={typed} onChange={e => setTyped(e.target.value)} disabled={busy} data-testid="retire-type" />
      </>}
      {review.coexisting > 0 && <Muted>{t('op.manage.retire.crossbranch', { n: review.coexisting })}</Muted>}
    </>}
    {error && <Alert $tone="error" role="alert">{error}</Alert>}
    <SheetFooter>
      <Button type="button" variant="text" color="default" onClick={onClose}>{t('op.manage.publish.cancel')}</Button>
      <Button type="button" variant="contained" disabled={!ready || busy || !!review?.retires.length && typed.trim() !== review.anchor.id} loading={busy} loadingText={t('op.manage.announcing')} onClick={confirm} data-testid="publish-confirm">{t(review?.retires.length ? 'op.manage.retire.confirm' : 'op.manage.publish.confirm')}</Button>
    </SheetFooter>
  </Sheet>;
}
