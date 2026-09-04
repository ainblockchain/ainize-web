import { errorMessage, usePatchQuery } from '@/api/api';
import type { ContributorRow, TeachJobAdmin } from '@/api/types';
import { useT } from '@/i18n';
import styled from 'styled-components';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { KeyValue, Mono, StyledLink } from '@/components/ui/Misc';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';
import { Muted, Row, SmallSpinner, Stack, useMoney } from '@/components/operator/common';
import { num, shortAddr } from '@/utils/format';

const Facts = styled.ol`
  margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px;
`;
const Fact = styled.li`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-left: 3px solid #8b3eeb; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 6px; font-size: 14px; line-height: 1.5; word-break: break-word;
  b { font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.GREY}; display: block; }
`;
const Before = styled.span`color: ${(p) => p.theme.color.GREY}; text-decoration: line-through;`;
const Consequences = styled.ul`
  margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK};
`;

/**
 * The confirm step in front of Approve (item 8).
 *
 * `POST /api/me/teach/jobs/:id/approve` calls `announceJob` → `market.announce(draft_id)`: an anchor record on the
 * ledger, broadcast to peers, permanent, authored by THIS node. The queue used to fire that from the first click on a
 * row whose questions and answers the operator had never seen — a stranger's text on a public record under the
 * operator's own identity, one click away.
 *
 * Everything shown here is data the API already returns: the job carries the corrections, the contributor and the
 * post-training checks, and the draft the operator is about to announce (`/api/patches/:draft_id`, visible to the
 * operator) carries the name, price, licence, training-set access and the signed contributor share.
 */
export function ApproveLessonSheet({ job, contributor, nodeName, nodeAddress, currency, busy, error, onApprove, onDecline, onClose }: {
  job: TeachJobAdmin;
  contributor?: ContributorRow;
  nodeName: string;
  nodeAddress: string;
  currency: string;
  busy: boolean;
  error: string | null;
  onApprove: () => void;
  onDecline: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const money = useMoney();
  const draft = usePatchQuery(job.draft_id ?? '', { skip: !job.draft_id });
  const a = draft.data?.anchor;
  const facts = job.facts ?? [];
  const who = job.contributor.name || contributor?.name || t('op.teach.approve.who.anon');
  // The share on the record is the one the teacher signed, not today's slider: read it from the draft's contributors.
  const mine = (a?.contributors ?? []).find((c) => (c.signer ?? c.address).toLowerCase() === job.contributor.address.toLowerCase()) ?? a?.contributors?.[0];
  const share = mine ? Math.round(mine.share * 1000) / 10 : null;
  const access = a?.dataset?.access;

  return (
    <Sheet
      title={t('op.teach.approve.title', { name: job.name || job.facts?.[0]?.prompt || job.id })}
      sub={t('op.teach.approve.sub')}
      onClose={onClose}
      width={720}
      testId="approve-sheet"
    >
      {/* who wrote it */}
      <Stack $gap={4}>
        <Muted>{t('op.teach.approve.who')}</Muted>
        <Row $gap={8} $wrap>
          <StyledLink to={`/teacher/${job.contributor.address}`}>{who}</StyledLink>
          <Muted><Mono>{shortAddr(job.contributor.address, 10)}</Mono>{job.ip ? ` · ${job.ip}` : ''}</Muted>
        </Row>
        {contributor && <Muted>{t('op.teach.approve.who.meta', { jobs: contributor.jobs, published: contributor.published })}</Muted>}
      </Stack>

      {/* the text itself — the thing the operator is publishing */}
      <Stack $gap={8}>
        <strong data-testid="approve-facts-title">{t('op.teach.approve.facts', { n: facts.length }, facts.length)}</strong>
        <Facts>
          {facts.map((f, i) => (
            <Fact key={`${f.prompt}-${i}`} data-testid="approve-fact">
              <span><b>{t('op.teach.approve.fact.q')}</b>{f.prompt}</span>
              <span><b>{t('op.teach.approve.fact.a')}</b>{f.answer}</span>
              {f.base_answer && <span><b>{t('op.teach.approve.fact.before')}</b><Before>{f.base_answer}</Before></span>}
              {f.after_answer && <span><b>{t('op.teach.approve.fact.after')}</b>{f.after_answer}</span>}
            </Fact>
          ))}
        </Facts>
        <Muted data-testid="approve-checks">
          {job.checks?.executed
            ? t('op.teach.approve.checks', { taught: `${job.checks.taught.hits}/${job.checks.taught.total}`, locality: `${job.checks.locality.same}/${job.checks.locality.total}` })
            : t('op.teach.approve.nochecks')}
        </Muted>
      </Stack>

      {/* what the record will say */}
      <Stack $gap={8}>
        <strong>{t('op.teach.approve.what')}</strong>
        {draft.isLoading && <SmallSpinner />}
        {draft.isError && <Alert $tone="warning" role="alert" data-testid="approve-draft-error">{t('op.teach.approve.draft_missing', { message: errorMessage(draft.error) })}</Alert>}
        {a && (
          <KeyValue data-testid="approve-record">
            <dt>{t('op.teach.approve.what.name')}</dt><dd>{a.name || a.id}</dd>
            <dt>{t('op.teach.approve.what.price')}</dt><dd>{money.fmt(a.price, a.currency ?? currency)}</dd>
            <dt>{t('op.teach.approve.what.rows')}</dt><dd>{num(a.rows)}</dd>
            {a.license && <><dt>{t('op.teach.approve.what.license')}</dt><dd>{a.license}</dd></>}
            {access && <><dt>{t('op.teach.approve.what.dataset')}</dt><dd>{t(`op.teach.approve.dataset.${access}`)}</dd></>}
          </KeyValue>
        )}
      </Stack>

      <Consequences>
        <li>{t('op.teach.approve.why.identity', { node: nodeName, address: shortAddr(nodeAddress, 10) })}</li>
        <li>{share === null || share > 0 ? t('op.teach.approve.why.share', { share: share ?? 0 }) : t('op.teach.approve.why.noshare')}</li>
        <li>{t('op.teach.approve.why.verify')}</li>
        <li>{t('op.teach.approve.why.permanent')}</li>
      </Consequences>

      {error && <Alert $tone="error" role="alert">{error}</Alert>}
      <SheetFooter>
        <Button variant="text" color="default" onClick={onClose}>{t('common.cancel')}</Button>
        <Button size="small" color="secondary" onClick={onDecline} data-testid="approve-sheet-decline">{t('op.teach.approve.decline')}</Button>
        <Button variant="contained" loading={busy} loadingText={t('op.teach.approve.announcing')} onClick={onApprove} data-testid="approve-sheet-confirm">
          {t('op.teach.approve.confirm')}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
