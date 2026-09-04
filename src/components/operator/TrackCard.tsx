import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useCatalogQuery, useChainQuery, useInfoQuery, useMyPurchasesQuery, useRuntimeQuery, useSubscribeMutation } from '@/api/api';
import type { BranchesResponse, CatalogEntry } from '@/api/types';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Sheet, SheetFooter, SheetNote } from '@/components/chat/Sheet';
import { SubText } from '@/components/ui/Table';
import { Muted, QueryError, Row, SmallSpinner, Stack, useMoney } from '@/components/operator/common';
import { shortAddr } from '@/utils/format';

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
const ItemName = styled.div`min-width: 0; flex: 1 1 180px; font-size: 14px; a { color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; } a:hover { text-decoration: underline; }`;
const ItemPlan = styled.div<{ $tone: 'spend' | 'warn' | 'muted' }>`
  flex: 0 0 auto; text-align: right; font-size: 13px;
  color: ${(p) => (p.$tone === 'spend' ? '#a0102c' : p.$tone === 'warn' ? '#8a4b00' : p.theme.color.GREY)};
  strong { display: block; font-size: 14px; color: ${(p) => p.theme.color.BLACK}; }
`;

type Branch = BranchesResponse['branches'][number];
/** What subscribing will do with one item of the track, decided by the same rules `market.subscribe` follows. */
type Plan = 'buy' | 'held' | 'own' | 'blocked' | 'missing';

interface Item { id: string; name: string; author: string | null; authorName?: string; price: string; currency?: string; status?: string; plan: Plan }

/**
 * One knowledge track, and the sheet that has to be crossed before this node spends anything (items 9 and 357).
 *
 * The bare outlined "Subscribe" that used to sit here called `market.subscribe`, which appends and broadcasts the
 * public subscription record FIRST and then loops `buy()` over every item the node lacks — applying each one to the
 * live serving model, logging failures as warnings, and answering `{ok: true}` whatever happened. So the card now
 * prices the track before the click, the sheet names every item and what will happen to it, and after the call the
 * node's own purchase list is read back to say how many items were really acquired instead of "done".
 */
export function TrackCard({ branch, subscribed, currency, address }: { branch: Branch; subscribed: boolean; currency: string; address: string | null }) {
  const { t } = useT();
  const money = useMoney();
  const [open, setOpen] = useState<null | 'subscribe' | 'unsubscribe'>(null);
  const [subscribe, subState] = useSubscribeMutation();
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ acquired: number; wanted: number; missing: string[] } | null>(null);

  // The track's own items, priced: /api/catalog?branch= is the same list `market.subscribe` walks.
  const cat = useCatalogQuery({ branch: branch.name, limit: 200, include_drafts: true });
  const purchases = useMyPurchasesQuery();
  // `subscribe` decides per item on `blobs.has(patch_sha256)`, NOT on the purchase list — a node that verified an
  // item already holds its body and is never charged for it. `info.node.blobs` is that same set, so the plan below
  // predicts what the node will really do instead of what a buyer would guess.
  const info = useInfoQuery();
  // `subscribe` only applies what it acquired `if (st.available)` — with no runtime the spend still happens and nothing is loaded.
  const runtime = useRuntimeQuery();

  const heldSha = useMemo(() => new Set(info.data?.node.blobs ?? []), [info.data]);
  const heldId = useMemo(() => new Set((purchases.data?.items ?? []).map((p) => p.patch_id)), [purchases.data]);
  const items: Item[] = useMemo(() => {
    const byId = new Map<string, CatalogEntry>((cat.data?.items ?? []).map((e) => [e.anchor.id, e]));
    return branch.patch_ids.map((id) => {
      const e = byId.get(id);
      if (!e) return { id, name: id, author: null, price: '0', plan: 'missing' as Plan };
      const own = !!address && e.anchor.author.toLowerCase() === address.toLowerCase();
      const have = heldSha.has(e.anchor.patch_sha256) || heldId.has(id);
      const plan: Plan = own ? 'own' : have ? 'held' : e.sellable ? 'buy' : 'blocked';
      return { id, name: e.anchor.name || id, author: e.anchor.author, authorName: e.anchor.author_name, price: e.anchor.price, currency: e.anchor.currency ?? currency, status: e.status, plan };
    });
  }, [cat.data, branch.patch_ids, heldSha, heldId, address, currency]);

  const toBuy = items.filter((i) => i.plan === 'buy');
  /** Prices are per anchor and each anchor names its own currency: sum per currency, never across. */
  const totals = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of toBuy) m.set(i.currency || currency, (m.get(i.currency || currency) ?? 0) + Number(i.price || 0));
    return [...m.entries()];
  }, [toBuy, currency]);
  const totalText = totals.length ? totals.map(([cur, n]) => money.fmt(n, cur)).join(' + ') : money.fmt(0, currency);
  const chain = useChainQuery();
  const balance = chain.data?.balance;
  /** The balance is held in ONE currency: only compare it with a total priced in that same currency. */
  const short = totals.length === 1 && totals[0][0] === currency && typeof balance === 'number' && totals[0][1] > balance;

  const planLabel = (i: Item) => t(`op.dash.branches.plan.${i.plan}`);
  const busy = subState.isLoading;
  const loading = cat.isLoading || purchases.isLoading || info.isLoading;

  const doSubscribe = async () => {
    setError(null); setOutcome(null);
    try {
      await subscribe({ name: branch.name, action: 'subscribe' }).unwrap();
      // `{ok: true}` says nothing about what arrived: read the node's own blob list back and count (item 357).
      const [freshInfo, freshBuys] = await Promise.all([info.refetch(), purchases.refetch()]);
      const now = new Set(freshInfo.data?.node.blobs ?? []);
      const bought = new Set((freshBuys.data?.items ?? []).map((p) => p.patch_id));
      const byId = new Map<string, CatalogEntry>((cat.data?.items ?? []).map((e) => [e.anchor.id, e]));
      const wanted = items.filter((i) => i.plan === 'buy' || i.plan === 'blocked');
      const missing = wanted.filter((i) => !bought.has(i.id) && !now.has(byId.get(i.id)?.anchor.patch_sha256 ?? '')).map((i) => i.id);
      setOutcome({ acquired: wanted.length - missing.length, wanted: wanted.length, missing });
    } catch (err) { setError(errorMessage(err)); }
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
      <span style={{ fontSize: 12, color: '#8d8d8f' }}>{t('op.dash.branches.meta', { patches: branch.patch_ids.length, subs: branch.subscribers.length, owner: shortAddr(branch.owner) })}</span>
      {/* The price of the track, before the click (item 9): what subscribing would spend, right now, from this node. */}
      {!subscribed && (
        <Cost $spend={toBuy.length > 0} data-testid="track-cost">
          {loading ? <SmallSpinner /> : cat.isError ? t('op.dash.branches.cost.unknown')
            : toBuy.length === 0 ? t('op.dash.branches.cost.nothing', { n: branch.patch_ids.length })
              : t('op.dash.branches.cost.buy', { n: toBuy.length, total: totalText })}
        </Cost>
      )}
      <Row $gap={8}>
        {subscribed
          ? <Button size="small" color="secondary" onClick={() => setOpen('unsubscribe')} data-testid="track-unsubscribe">{t('op.dash.branches.unsubscribe')}</Button>
          : <Button size="small" onClick={() => setOpen('subscribe')} disabled={loading} data-testid="track-subscribe">{t('op.dash.branches.subscribe')}</Button>}
      </Row>

      {open === 'subscribe' && (
        <Sheet title={t('op.dash.branches.sheet.title', { name: branch.name })} sub={t('op.dash.branches.sheet.sub')} onClose={close} width={720} testId="subscribe-sheet">
          {cat.isError
            ? <QueryError error={cat.error} what={t('op.dash.branches.sheet.items')} retrying={cat.isFetching} onRetry={() => void cat.refetch()} />
            : (
              <ItemList>
                {items.map((i) => (
                  <ItemRow key={i.id} data-testid="subscribe-item" data-plan={i.plan}>
                    <ItemName>
                      {i.author ? <Link to={`/${i.author}/${i.id}`}>{i.name}</Link> : <span>{i.name}</span>}
                      <SubText>{i.id}{i.author ? ` · ${i.authorName ?? shortAddr(i.author)}` : ''}</SubText>
                    </ItemName>
                    <ItemPlan $tone={i.plan === 'buy' ? 'spend' : i.plan === 'blocked' || i.plan === 'missing' ? 'warn' : 'muted'}>
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
            <li>{runtime.data && !runtime.data.available ? t('op.dash.branches.sheet.why.model_off') : t('op.dash.branches.sheet.why.model')}</li>
            <li>{t('op.dash.branches.sheet.why.partial')}</li>
            <li>{t('op.dash.branches.sheet.why.route')}</li>
            <li>{t('op.dash.branches.sheet.why.refund')}</li>
            <li>{t('op.dash.branches.sheet.why.allornothing')}</li>
          </Consequences>

          {error && <Alert $tone="error" role="alert">{error}</Alert>}
          {outcome && (
            <Alert $tone={outcome.missing.length ? 'warning' : 'success'} role="alert" data-testid="subscribe-outcome">
              {t('op.dash.branches.sheet.done', { acquired: outcome.acquired, wanted: outcome.wanted })}
              {outcome.missing.length > 0 && <> {t('op.dash.branches.sheet.done.missing', { ids: outcome.missing.join(', ') })}</>}
            </Alert>
          )}

          <SheetNote>{t('op.dash.branches.sheet.note')}</SheetNote>
          <SheetFooter>
            <Button variant="text" color="default" onClick={close}>{outcome ? t('op.close') : t('common.cancel')}</Button>
            {!outcome && (
              <Button variant="contained" loading={busy} loadingText={t('op.dash.branches.sheet.subscribing')} onClick={doSubscribe} data-testid="subscribe-confirm">
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
