import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useLedgerQuery, useRuntimeQuery, useSubscribeMutation, useSyncBranchMutation, useTrackQuoteQuery } from '@/api/api';
import type { BranchesResponse, SubscribeResult, TrackItem, TrackOverlap } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Sheet, SheetFooter, SheetNote } from '@/components/chat/Sheet';
import { SubText } from '@/components/ui/Table';
import { Muted, QueryError, Row, SmallSpinner, Stack, useMoney } from '@/components/operator/common';
import { num, shortAddr } from '@/utils/format';

const Card = styled.div`
  padding: 16px 20px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; display: flex; flex-direction: column; gap: 8px;
`;
const Tag = styled.span`
  display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 11px; background: #f5eefc; color: #5b1ca8; font-family: ${(p) => p.theme.font.mono};
`;
const Cost = styled.span<{ $spend?: boolean }>`
  font-size: 13px; font-weight: ${(p) => (p.$spend ? 700 : 500)}; color: ${(p) => (p.$spend ? '#a0102c' : p.theme.color.GREY)};
`;
const Consequences = styled.ul`
  margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK};
`;
/** The item list reads at 360 as well as at 1280: two stacked columns, never a table the phone has to scroll sideways. */
const ItemList = styled.ul`
  flex: none; margin: 0; padding: 0; list-style: none; border-top: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const ItemRow = styled.li`
  display: flex; flex-wrap: wrap; gap: 4px 16px; justify-content: space-between; align-items: baseline;
  padding: 10px 2px; border-bottom: 1px solid #f4f4f4;
`;
/** The load order of a track's items (item 214): later is on top, and wins on any row two of them share. */
const OrderBadge = styled.span`
  display: inline-block; min-width: 18px; margin-right: 6px; padding: 0 4px; border-radius: 9px;
  background: ${(p) => p.theme.color.LIGHT_GREY}; color: ${(p) => p.theme.color.DARK_GREY};
  font-size: 11px; font-weight: 700; text-align: center; font-variant-numeric: tabular-nums;
`;
const ItemName = styled.div`min-width: 0; flex: 1 1 180px; font-size: 14px; a { color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; } a:hover { text-decoration: underline; }`;
const ItemPlan = styled.div<{ $tone: 'spend' | 'warn' | 'muted' }>`
  flex: 0 0 auto; text-align: right; font-size: 13px;
  color: ${(p) => (p.$tone === 'spend' ? '#a0102c' : p.$tone === 'warn' ? '#8a4b00' : p.theme.color.GREY)};
  strong { display: block; font-size: 14px; color: ${(p) => p.theme.color.BLACK}; }
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
export function TrackCard({ branch, subscribed, currency, address }: { branch: Branch; subscribed: boolean; currency: string; address: string | null }) {
  const { t } = useT();
  const money = useMoney();
  const [open, setOpen] = useState<null | 'subscribe' | 'unsubscribe'>(null);
  const [subscribe, subState] = useSubscribeMutation();
  const [syncTrack, syncState] = useSyncBranchMutation();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubscribeResult | null>(null);

  const quote = useTrackQuoteQuery(branch.name);
  const q = quote.data?.quote;
  const items = q?.items ?? [];
  const toBuy = items.filter((i) => i.plan === 'buy');
  const totalText = q && q.total.length ? q.total.map((x) => money.fmt(Number(x.amount), x.currency)).join(' + ') : money.fmt(0, currency);
  const balance = q?.balance ?? null;
  /** The balance is held in ONE currency: only compare it with a total priced in that same currency. */
  const short = !!q && q.total.length === 1 && q.total[0].currency === currency && typeof balance === 'number' && Number(q.total[0].amount) > balance;
  const mine = !!address && branch.owner.toLowerCase() === address.toLowerCase();
  /** Item 257 — `patch_ids` is the whole history of the track; `current` is what a subscriber actually loads. */
  const current = branch.current ?? q?.current ?? branch.patch_ids;
  const retiredCount = branch.patch_ids.length - current.length;

  /**
   * Finding 262 — what this node actually holds of the track's current knowledge. `applied` is the runtime's own
   * answer (what is on the model right now), never a guess from the catalogue: a subscription that half-failed,
   * a body this node owns but never loaded and a version superseded overnight all read the same on the ledger.
   */
  const runtime = useRuntimeQuery();
  const loadedIds = new Set((runtime.data?.applied ?? []).map((x) => x.patch_id));
  const loaded = current.filter((id) => loadedIds.has(id));
  const missing = current.filter((id) => !loadedIds.has(id));
  const nameOf = (id: string) => items.find((i) => i.patch_id === id)?.name ?? id;
  const missingText = missing.length <= 2
    ? missing.map(nameOf).join(', ')
    : t('op.dash.branches.behind.more', { ids: missing.slice(0, 2).map(nameOf).join(', '), n: missing.length - 2 });
  const runtimeKnown = !!runtime.data?.available;

  /**
   * Item 361 — `subscribers` is derived from live subscribe/unsubscribe state, so a node that leaves simply
   * vanishes: no churn, no history, and the person deciding whether to keep baking every morning could see neither
   * who left nor what the track earns. Both are on the public record — `subscribe` records carry the action, and a
   * settlement names the knowledge it paid for — so the card reads them instead of asking for a new endpoint.
   * One query shared by every card on the page (same args = one request).
   */
  const ledger = useLedgerQuery({ limit: 5000 }, { pollingInterval: 60_000 });
  const trackStats = useMemo(() => {
    const members = new Set(branch.patch_ids);
    let joined = 0; let left = 0; let sales = 0;
    const revenue = new Map<string, number>();
    for (const r of ledger.data?.records ?? []) {
      const b = (r.body ?? {}) as Record<string, unknown>;
      if (r.kind === 'subscribe' && b.branch === branch.name) { if (b.action === 'unsubscribe') left += 1; else joined += 1; }
      if (r.kind === 'settle' && typeof b.patch_id === 'string' && members.has(b.patch_id)) {
        sales += 1;
        const cur = String(b.currency ?? currency);
        revenue.set(cur, (revenue.get(cur) ?? 0) + Number(b.amount ?? 0));
      }
    }
    return { joined, left, sales, revenue: [...revenue.entries()].map(([cur, amount]) => money.fmt(Math.round(amount * 1e6) / 1e6, cur)).join(' + ') };
  }, [ledger.data, branch.name, branch.patch_ids, currency, money]);

  const planLabel = (i: TrackItem) => t(`op.dash.branches.plan.${i.plan}`);
  const busy = subState.isLoading;
  const loading = quote.isLoading;

  /**
   * Item 214 — a track is loaded ON TOP of what is already in the model, and the model is last-wins on a shared row.
   * The node refuses when that would write over something already loaded; the offer to do it anyway is explicit,
   * beside the sentence naming what would be overridden, rather than a silent 409 the card swallowed.
   */
  const [overrides, setOverrides] = useState<TrackOverlap[] | null>(null);
  const doSubscribe = async (replace = false) => {
    setError(null); setOutcome(null); setOverrides(null);
    try { setOutcome(await subscribe({ name: branch.name, action: 'subscribe', replace }).unwrap()); }
    catch (err) {
      const d = (err as { data?: { details?: { code?: string; pairs?: TrackOverlap[] } } }).data?.details;
      if (d?.code === 'overlaps_loaded' && d.pairs?.length) setOverrides(d.pairs);
      setError(errorMessage(err));
    }
  };
  const doSync = async () => {
    setError(null); setOutcome(null);
    try { setOutcome(await syncTrack(branch.name).unwrap()); }
    catch (err) { setError(errorMessage(err)); }
  };
  const doUnsubscribe = async () => {
    setError(null);
    try { await subscribe({ name: branch.name, action: 'unsubscribe' }).unwrap(); setOpen(null); } catch (err) { setError(errorMessage(err)); }
  };
  const close = () => { setOpen(null); setError(null); setOutcome(null); };

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
      {/* Item 361: what the track has actually done — who joined, who left, and (for its owner) what it earned. */}
      {(trackStats.joined > 0 || trackStats.left > 0 || trackStats.sales > 0) && (
        <span style={{ fontSize: 12, color: '#8d8d8f' }} data-testid="track-stats">
          {t('op.dash.branches.churn', { subs: branch.subscribers.length, joined: trackStats.joined, left: trackStats.left })}
          {mine && trackStats.sales > 0 && <> · {t('op.dash.branches.earned', { n: trackStats.sales, total: trackStats.revenue })}</>}
        </span>
      )}
      {/* The price of the track, before the click (item 9): what subscribing would spend, right now, from this node. */}
      {!subscribed && (
        <Cost $spend={toBuy.length > 0} data-testid="track-cost">
          {loading ? <SmallSpinner /> : quote.isError ? t('op.dash.branches.cost.unknown')
            : toBuy.length === 0 ? t('op.dash.branches.cost.nothing', { n: current.length })
              : t('op.dash.branches.cost.buy', { n: toBuy.length, total: totalText })}
        </Cost>
      )}
      {/* Finding 262 — "loaded 1 of 2 current · still missing: …" beside the button that closes the gap. */}
      {subscribed && (
        <Standing $behind={runtimeKnown && missing.length > 0} data-testid="track-standing">
          {!runtimeKnown ? <Muted>{t('op.dash.branches.loaded.unknown')}</Muted>
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
            <Button size="small" onClick={doSync} loading={syncState.isLoading} loadingText={t('op.dash.branches.syncing')} data-testid="track-sync">{t('op.dash.branches.sync')}</Button>
            <Button size="small" color="secondary" onClick={() => setOpen('unsubscribe')} data-testid="track-unsubscribe">{t('op.dash.branches.unsubscribe')}</Button>
          </>
          : <Button size="small" onClick={() => setOpen('subscribe')} disabled={loading} data-testid="track-subscribe">{t('op.dash.branches.subscribe')}</Button>}
      </Row>
      {subscribed && <Muted>{t('op.dash.branches.keepsup')}</Muted>}
      {subscribed && error && <Alert $tone="error" role="alert">{error}</Alert>}
      {subscribed && outcome && <Alert $tone={outcome.failed.length ? 'warning' : 'success'} role="status" data-testid="track-sync-outcome">{outcomeText(outcome, t, money)}</Alert>}

      {open === 'subscribe' && (
        <Sheet title={t('op.dash.branches.sheet.title', { name: branch.name })} sub={t('op.dash.branches.sheet.sub')} onClose={close} width={720} testId="subscribe-sheet">
          {quote.isError
            ? <QueryError error={quote.error} what={t('op.dash.branches.sheet.items')} retrying={quote.isFetching} onRetry={() => void quote.refetch()} />
            : (
              <ItemList>
                {items.map((i) => (
                  <ItemRow key={i.patch_id} data-testid="subscribe-item" data-plan={i.plan}>
                    <ItemName>
                      {/* Item 214: a track is LOADED in this order, and the later item wins on any row two of them share. */}
                      {current.includes(i.patch_id) && <OrderBadge title={t('op.dash.branches.sheet.order')}>{current.indexOf(i.patch_id) + 1}</OrderBadge>}
                      {i.author ? <Link to={`/${i.author}/${i.patch_id}`}>{i.name ?? i.patch_id}</Link> : <span>{i.name ?? i.patch_id}</span>}
                      <SubText>{i.patch_id}{i.author ? ` · ${i.author_name ?? shortAddr(i.author)}` : ''}</SubText>
                    </ItemName>
                    <ItemPlan $tone={i.plan === 'buy' ? 'spend' : i.plan === 'held' || i.plan === 'own' ? 'muted' : 'warn'}>
                      {i.plan === 'buy' && <strong title={money.note(i.currency)}>{money.fmt(i.price, i.currency)}</strong>}
                      {planLabel(i)}
                    </ItemPlan>
                  </ItemRow>
                ))}
              </ItemList>
            )}

          <Stack $gap={8}>
            <strong data-testid="subscribe-total">{t('op.dash.branches.sheet.total', { n: toBuy.length, total: totalText }, toBuy.length)}</strong>
            {typeof balance === 'number' && <Muted>{t('op.dash.branches.sheet.balance', { balance: money.fmt(balance, currency) })}</Muted>}
          </Stack>
          {short && <Alert $tone="error" role="alert" data-testid="subscribe-short">{t('op.dash.branches.sheet.short')}</Alert>}

          <Consequences>
            <li>{t('op.dash.branches.sheet.why.record')}</li>
            <li>{q && !q.runtime_available ? t('op.dash.branches.sheet.why.model_off') : t('op.dash.branches.sheet.why.model')}</li>
            <li>{t('op.dash.branches.sheet.why.partial')}</li>
            <li>{t('op.dash.branches.sheet.why.keepsup')}</li>
            <li>{t('op.dash.branches.sheet.why.route')}</li>
            <li>{t('op.dash.branches.sheet.why.refund')}</li>
            <li>{t('op.dash.branches.sheet.why.allornothing')}</li>
          </Consequences>

          {error && <Alert $tone="error" role="alert" data-testid="subscribe-error">{error}</Alert>}
          {/* Item 214: what this track would write over, and the one button that says yes to it. */}
          {overrides && (
            <Alert $tone="warning" role="alert" data-testid="subscribe-overrides">
              <div>{t('op.dash.branches.sheet.overrides')}</div>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {overrides.map((o) => (
                  <li key={`${o.track_id}|${o.loaded_id}`}>{o.rows !== null
                    ? t('op.dash.branches.sheet.overrides.line', {
                      track: o.track_id, loaded: o.loaded_id, rows: num(o.rows),
                      how: o.loaded_reason === 'manual' ? t('op.dash.branches.loadedby.manual') : t('op.dash.branches.loadedby.track', { track: o.loaded_reason.replace(/^subscription:/, '') }),
                    })
                    /* The body is not on this node yet, so the count is an estimate from the published sketches and says so. */
                    : t('op.dash.branches.sheet.overrides.line_est', {
                      track: o.track_id, loaded: o.loaded_id, pct: Math.round((o.jaccard ?? 0) * 100),
                      how: o.loaded_reason === 'manual' ? t('op.dash.branches.loadedby.manual') : t('op.dash.branches.loadedby.track', { track: o.loaded_reason.replace(/^subscription:/, '') }),
                    })}</li>
                ))}
              </ul>
              <Button size="small" color="secondary" style={{ marginTop: 8 }} loading={busy} onClick={() => void doSubscribe(true)} data-testid="subscribe-replace">
                {t('op.dash.branches.sheet.overrides.anyway')}
              </Button>
            </Alert>
          )}
          {outcome && (
            <Alert $tone={outcome.failed.length ? 'warning' : 'success'} role="alert" data-testid="subscribe-outcome">
              {outcomeText(outcome, t, money)}
            </Alert>
          )}

          <SheetNote>{t('op.dash.branches.sheet.note')}</SheetNote>
          <SheetFooter>
            <Button variant="text" color="default" onClick={close}>{outcome ? t('op.close') : t('common.cancel')}</Button>
            {!outcome && (
              <Button variant="contained" loading={busy} loadingText={t('op.dash.branches.sheet.subscribing')} onClick={() => void doSubscribe(false)} data-testid="subscribe-confirm">
                {toBuy.length === 0 ? t('op.dash.branches.sheet.confirm.free')
                  : short ? t('op.dash.branches.sheet.confirm.anyway', { total: totalText })
                    : t('op.dash.branches.sheet.confirm', { total: totalText })}
              </Button>
            )}
          </SheetFooter>
        </Sheet>
      )}

      {open === 'unsubscribe' && (
        <Sheet title={t('op.dash.branches.unsub.title', { name: branch.name })} onClose={close} width={520} testId="unsubscribe-sheet">
          <Consequences>
            <li>{t('op.dash.branches.unsub.model')}</li>
            <li>{t('op.dash.branches.unsub.norefund')}</li>
            <li>{t('op.dash.branches.unsub.keep')}</li>
          </Consequences>
          {error && <Alert $tone="error" role="alert">{error}</Alert>}
          <SheetFooter>
            <Button variant="text" color="default" onClick={close}>{t('common.cancel')}</Button>
            <Button variant="contained" color="secondary" loading={busy} onClick={doUnsubscribe} data-testid="unsubscribe-confirm">{t('op.dash.branches.unsub.confirm')}</Button>
          </SheetFooter>
        </Sheet>
      )}
    </Card>
  );
}

/** What the node reported it actually did — bought, loaded, unloaded, skipped (item 357). */
function outcomeText(x: SubscribeResult, t: (k: string, v?: Record<string, string | number>) => string, money: ReturnType<typeof useMoney>): string {
  const parts: string[] = [];
  if (x.acquired.length) parts.push(t('op.dash.branches.done.bought', { n: x.acquired.length, total: x.spent.map((s) => money.fmt(Number(s.amount), s.currency)).join(' + ') || money.fmt(0, 'CREDIT') }));
  if (x.applied.length) parts.push(t('op.dash.branches.done.loaded', { ids: x.applied.join(', ') }));
  if (x.removed.length) parts.push(t('op.dash.branches.done.unloaded', { ids: x.removed.join(', ') }));
  for (const s of x.skipped) parts.push(t('op.dash.branches.done.skipped', { id: s.patch_id, reason: s.reason }));
  if (!parts.length) parts.push(t('op.dash.branches.done.nothing'));
  return parts.join(' ');
}
