import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { api, errorMessage, useLedgerQuery, useRuntimeQuery, useSubscribeMutation, useSyncBranchMutation, useTrackQuoteQuery } from '@/api/api';
import type { BranchesResponse, SubscribeResult, TrackActionReview } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { trackCardQuote, trackStanding, trackWindowStats } from '@/lib/trackCardEvidence';
import { useActiveView } from '@/hooks/useActiveView';
import { LoadKnowledgeError, requireRuntimeOperator } from '@/lib/loadKnowledge';
import { parseTrackReview } from '@/lib/trackReview';
import { TrackReviewSheet } from './TrackReviewSheet';
import { trackAcquisitionFailure, trackActionConfirmed, trackActionResult, trackOutcomeText } from '@/lib/trackAction';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Sheet, SheetFooter } from '@/components/chat/Sheet';
import { Muted, Row, useMoney } from '@/components/operator/common';
import { shortAddr } from '@/utils/format';

const Card = styled.div`
  min-width: 0; overflow-wrap: anywhere; padding: 16px 20px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; display: flex; flex-direction: column; gap: 8px;
`;
const Tag = styled.span`
  display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; background: #f5eefc; color: #5b1ca8; font-family: ${(p) => p.theme.font.mono};
`;
const Consequences = styled.ul`
  margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK};
`;
/**
 * Finding 262 — the card said "{n} knowledge · {subs} subscriber(s)" and nothing about THIS node, so a subscriber
 * whose model was a day behind had to read the card, then the retired item's page (which addresses the subscriber
 * on a page the subscriber never opens) and then the CLI to find out. The comparison belongs here, on the card
 * beside the button that fixes it.
 */
const Standing = styled.span<{ $behind: boolean }>`
  font-size: 13px; font-weight: ${(p) => (p.$behind ? 600 : 400)};
  color: ${(p) => (p.$behind ? '#8a4b00' : p.theme.color.SUCCESS)};
`;
const StandingNote = styled.span`display: block; font-weight: 400; font-size: 12px; color: ${(p) => p.theme.color.GREY}; margin-top: 2px;`;

type Branch = BranchesResponse['branches'][number];

/**
 * One knowledge track, and the sheet that has to be crossed before this node spends anything (items 9, 357, 255, 358).
 *
 * The plan for every item comes from the NODE (`POST /api/branches/:name/quote`), decided with the same rules
 * `market.subscribe` follows: a version another member of the track has retired is history and is not bought again,
 * an unverified bake is skipped, and a body this node holds only because it verified it is not a licence to serve it.
 * Deriving that here from the catalogue was a second copy of those rules, and it disagreed with the node on every one.
 */
type TrackCardProps = { branch: Branch; subscribed: boolean; currency: string; address: string | null };
export function TrackCard(props: TrackCardProps) {
  const auth = useAuth();
  return <TrackCardView key={JSON.stringify([auth.cacheIdentity, props.address, props.branch.name, props.branch.owner])} {...props} />;
}
function TrackCardView({ branch, subscribed: subscribedProp, currency, address }: TrackCardProps) {
  const { t } = useT();
  const auth = useAuth();
  const active = useActiveView(), currentView = () => active() && auth.isCurrentAccount();
  const [task] = useState(createNodeActionTask);
  useEffect(() => () => task.abandon(), [task]);
  const [readAccess] = api.useLazyMeQuery();
  const [readReview] = api.useLazyTrackReviewQuery();
  const [review, setReview] = useState<TrackActionReview | null>(null);
  const money = useMoney();
  const [open, setOpen] = useState<null | 'subscribe' | 'sync' | 'unsubscribe'>(null);
  const [subscribe, subState] = useSubscribeMutation();
  const [syncTrack, syncState] = useSyncBranchMutation();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubscribeResult | null>(null);
  const subscribed = outcome?.receipt?.subscribed ?? subscribedProp;
  const cleanupPending = outcome?.action === 'unsubscribe' && !trackActionConfirmed(outcome);

  const quote = useTrackQuoteQuery({ name: branch.name, identity: auth.cacheIdentity });
  const q = !quote.isError ? trackCardQuote(quote.currentData, branch.name, branch) : null;
  const items = q?.items ?? [];
  const mine = !!address && branch.owner.toLowerCase() === address.toLowerCase();
  /** Item 257 — `patch_ids` is the whole history of the track; `current` is what a subscriber actually loads. */
  const current = branch.current ?? q?.current ?? [];
  const retiredCount = q?.retired.length ?? 0;

  /**
   * Compare current file identities with ordered records. Neither matching IDs nor a failed read proves loading.
   */
  const runtime = useRuntimeQuery({ identity: auth.cacheIdentity });
  const standing = !runtime.isError ? trackStanding(branch.current, q, runtime.currentData) : null;
  const loaded = standing?.loaded ?? [];
  const missing = standing?.missing ?? [];
  const nameOf = (id: string) => items.find((i) => i.patch_id === id)?.name ?? id;
  const missingText = missing.length <= 2
    ? missing.map(nameOf).join(', ')
    : t('op.dash.branches.behind.more', { ids: missing.slice(0, 2).map(nameOf).join(', '), n: missing.length - 2 });
  const runtimeKnown = !!standing;

  /** One account-scoped ledger window shared by all cards. Counts are records, not lifetime users or income. */
  const ledger = useLedgerQuery({ limit: 5000, identity: auth.cacheIdentity }, { pollingInterval: 60_000 });
  const trackStats = useMemo(() => ledger.isError ? null : trackWindowStats(ledger.currentData, branch.name, branch.patch_ids),
    [ledger.isError, ledger.currentData, branch.name, branch.patch_ids]);
  const transactionTotal = trackStats?.totals.map(v => `${v.amount} ${money.unit(v.currency)}`).join(' + ') ?? '';

  const [checking, setChecking] = useState(false);
  const busy = checking || subState.isLoading || syncState.isLoading;
  const canAct = auth.isOwner && !auth.loading && !busy;

  const run = async (action: SubscribeResult['action'], replace = false) => {
    if (!canAct || task.pending() || !currentView() || action !== 'unsubscribe' && (!review || review.action !== action)) return;
    setChecking(true); setError(null);
    setOutcome(previous => previous?.action === 'unsubscribe' && !trackActionConfirmed(previous) ? previous : null);
    let stillCurrent = currentView;
    try {
      await task.run(currentView, async check => {
        stillCurrent = check;
        if (!await requireRuntimeOperator({ current: check, node: address, subject: auth.subject, readAccess: () => readAccess(undefined, false).unwrap() })) return null;
        const raw = await (action === 'sync' ? syncTrack({ name: branch.name, expected_review: review!.revision, replace })
          : subscribe({ name: branch.name, action, replace, expected_review: action === 'subscribe' ? review!.revision : undefined })).unwrap();
        if (!check()) return null;
        const result = trackActionResult(raw, branch.name, action);
        if (!result) throw new Error(t('op.dash.branches.done.unconfirmed'));
        setOutcome(result);
        if (action === 'unsubscribe' && trackActionConfirmed(result)) setOpen(null);
        return true;
      });
    } catch (err) {
      if (!stillCurrent()) return;
      const partial = action === 'subscribe' ? trackAcquisitionFailure(err, branch.name) : null;
      if (partial) setOutcome(partial);
      setError(err instanceof LoadKnowledgeError ? t(`detail.apply.error.${err.code}`) : errorMessage(err));
    } finally { if (stillCurrent()) setChecking(false); }
  };
  const doUnsubscribe = () => run('unsubscribe');
  const close = () => { if (!task.pending()) setOpen(null); };
  const beginReview = async (action: 'subscribe' | 'sync') => {
    if (!canAct || task.pending() || !currentView()) return;
    setOpen(action); setReview(null); setOutcome(null); setError(null); setChecking(true);
    let stillCurrent = currentView;
    try {
      await task.run(currentView, async check => {
        stillCurrent = check;
        if (!await requireRuntimeOperator({ current: check, node: address, subject: auth.subject, readAccess: () => readAccess(undefined, false).unwrap() })) return null;
        const raw = await readReview({ name: branch.name, action, identity: auth.cacheIdentity }, false).unwrap();
        if (!check()) return null;
        const value = parseTrackReview(raw, branch.name, action, address);
        if (!value) throw new Error(t('op.trackReview.unavailable'));
        setReview(value); return true;
      });
    } catch (e) { if (stillCurrent()) setError(e instanceof LoadKnowledgeError ? t(`detail.apply.error.${e.code}`) : errorMessage(e)); }
    finally { if (stillCurrent()) setChecking(false); }
  };

  return (
    <Card data-testid="track-card" data-branch={branch.name}>
      <Row $justify="space-between">
        <strong>{branch.name}</strong>
        {subscribed && <Tag>{t('op.dash.branches.subscribed')}</Tag>}
      </Row>
      <span style={{ fontSize: 13, color: '#8d8d8f' }}>{branch.description || t('op.dash.branches.nodesc')}</span>
      <Row $gap={6}>
        {Object.entries(branch.context).map(([k, v]) => <Tag key={k}>{k}={v}</Tag>)}
        {Object.keys(branch.context).length === 0 && <Tag>{t('op.dash.branches.noctx')}</Tag>}
      </Row>
      {/* Item 358 — the owner is on the card, so a track taken over under the same name is visible. */}
      <span style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="track-meta">
        {t('op.dash.branches.meta', { patches: current.length, subs: branch.subscribers.length, owner: mine ? t('op.dash.branches.owner.you') : shortAddr(branch.owner) })}
        {retiredCount > 0 && <> {t('op.dash.branches.meta.retired', { n: retiredCount })}</>}
      </span>
      {/* Keep the bounded source visible; a ledger read failure is not zero activity. */}
      {trackStats ? (
        <span style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="track-stats">
          {t(trackStats.partial ? 'op.dash.branches.window.partial' : 'op.dash.branches.window.complete', { n: trackStats.window, total: trackStats.available })}
          {' · '}{t('op.dash.branches.window.churn', { joined: trackStats.joined, left: trackStats.left })}
          {trackStats.settlements > 0 && <> · {t('op.dash.branches.window.settled', { n: trackStats.settlements, total: transactionTotal })}</>}
        </span>
      ) : <span style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="track-stats-unknown">
        {t(!ledger.currentData && !ledger.isError ? 'op.dash.branches.window.loading' : 'op.dash.branches.window.unknown')}
        {(ledger.isError || !!ledger.currentData) && <Button size="small" variant="text" disabled={ledger.isFetching} onClick={() => void ledger.refetch()}>{t('op.error.retry')}</Button>}
      </span>}
      {/* Published curation terms are separate from observed ledger activity and the action review. */}
      {q?.subscription?.terms && /[1-9]/.test(q.subscription.terms.price) && (
        <span style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="track-terms">
          {t('op.dash.branches.fee', { price: `${q.subscription.terms.price} ${money.unit(q.subscription.terms.currency)}`, days: q.subscription.terms.period_days })}
          {' '}
          {mine ? t('op.dash.branches.fee.own') : q.subscription.due ? <b>{t('op.dash.branches.fee.due')}</b>
            : q.subscription.paid_until ? t('op.dash.branches.fee.paid', { date: new Date(q.subscription.paid_until).toISOString().slice(0, 10) }) : t('op.dash.branches.fee.unknown')}
        </span>
      )}
      {q?.subscription && q.subscription.run_rate.knowledge_added > 0 && (
        <span style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="track-runrate">
          {t('op.dash.branches.additions', { n: q.subscription.run_rate.knowledge_added })}
        </span>
      )}
      {/* Finding 262 — "loaded 1 of 2 current · still missing: …" beside the button that closes the gap. */}
      {subscribed && (
        <Standing $behind={runtimeKnown && missing.length > 0} data-testid="track-standing">
          {!runtimeKnown ? <Muted>{t('op.dash.branches.loaded.unknown')}</Muted>
            : standing.total === 0 ? <Muted>{t('op.dash.branches.loaded.none')}</Muted>
            : missing.length === 0 ? t('op.dash.branches.loaded', { n: loaded.length, total: current.length })
              : <>
                {t('op.dash.branches.behind', { n: loaded.length, total: current.length, ids: missingText })}
                <StandingNote>{t('op.dash.branches.behind.help')}</StandingNote>
              </>}
        </Standing>
      )}
      <Row $gap={8}>
        {subscribed
          ? <>
            <Button size="small" disabled={!canAct} onClick={() => void beginReview('sync')} loading={syncState.isLoading} loadingText={t('op.dash.branches.syncing')} data-testid="track-sync">{t('op.dash.branches.sync')}</Button>
            <Button size="small" disabled={!canAct} color="secondary" onClick={() => setOpen('unsubscribe')} data-testid="track-unsubscribe">{t('op.dash.branches.unsubscribe')}</Button>
          </>
          : <Button size="small" onClick={() => void beginReview('subscribe')} disabled={!canAct || cleanupPending} data-testid="track-subscribe">{t('op.dash.branches.subscribe')}</Button>}
        {cleanupPending && <Button size="small" disabled={!canAct} onClick={() => setOpen('unsubscribe')} data-testid="track-cleanup">{t('op.dash.branches.cleanup')}</Button>}
      </Row>
      {subscribed && <Muted>{t('op.dash.branches.keepsup')}</Muted>}
      {!open && error && <Alert $tone="error" role="alert">{error}</Alert>}
      {!open && outcome && <TrackActionFeedback outcome={outcome} />}

      {(open === 'subscribe' || open === 'sync') && <TrackReviewSheet branch={branch.name} action={open} review={review}
        busy={busy} error={error} onRetry={() => void beginReview(open)} onConfirm={replace => void run(open, replace)} onClose={close}
        feedback={outcome ? <TrackActionFeedback outcome={outcome} /> : undefined} />}

      {open === 'unsubscribe' && (
        <Sheet title={t('op.dash.branches.unsub.title', { name: branch.name })} onClose={close} width={520} testId="unsubscribe-sheet">
          <Consequences>
            <li>{t('op.dash.branches.unsub.model')}</li>
            <li>{t('op.dash.branches.unsub.norefund')}</li>
            <li>{t('op.dash.branches.unsub.keep')}</li>
          </Consequences>
          {error && <Alert $tone="error" role="alert">{error}</Alert>}
          {outcome && <TrackActionFeedback outcome={outcome} />}
          <SheetFooter>
            <Button variant="text" color="default" onClick={close}>{t('common.cancel')}</Button>
            <Button variant="contained" color="secondary" disabled={!canAct} loading={busy} onClick={doUnsubscribe} data-testid="unsubscribe-confirm">{t(cleanupPending ? 'op.dash.branches.cleanup' : 'op.dash.branches.unsub.confirm')}</Button>
          </SheetFooter>
        </Sheet>
      )}
    </Card>
  );
}

export function TrackActionFeedback({ outcome }: { outcome: SubscribeResult }) {
  const { t } = useT(), money = useMoney();
  return <Alert $tone={trackActionConfirmed(outcome) ? 'success' : 'warning'} role="status" data-testid="track-outcome" data-confirmed={trackActionConfirmed(outcome)}>
    {trackOutcomeText(outcome, t, (amount, currency) => `${amount} ${money.unit(currency)}`)}
  </Alert>;
}
