/**
 * `/billing` — "now N tok/s → deposit X → M tok/s", and the button that makes the deposit.
 *
 * WHAT IT SELLS. A node that takes deposits runs a weighted fair queue: when a model is contended, a caller gets
 * `w / Σ w_active` of it, where `w` is the sAIN they deposited. The free tier is one shared caller at the weight
 * floor — the whole model when nobody else is asking, next to nothing when a depositor is. The page says both of
 * those as they are, instead of one averaged number that is true at no moment. Design: ainize-node
 * `docs/superpowers/specs/2026-09-26-throughput-billing-design.md`; the numbers come from `GET /api/throughput`
 * (ainize-node `src/throughput-routes.ts`), read by `billingThroughput.ts`.
 *
 * THE TWO CARDS. Left, **Now**: a wallet session sees "Your API calls" and its deposit; anybody else sees the
 * free tier. Right, **Deposit**: token, amount, and the quote — re-asked of the node 300 ms after the typing stops,
 * because the node holds the contention numbers and the page must not guess them.
 *
 * WHO A DEPOSIT IS FOR. The node credits a transfer to the address that SENT it. So the wallet button needs a
 * wallet sign-in (`subject`), and `billingSendDeposit` refuses when the wallet's connected account is a different
 * address — see `billingWalletDeposit.ts`. A visitor with no wallet in the browser gets the address, chain and
 * token contract to send to by hand, and the same rule in words.
 *
 * AFTER SENDING. The transaction hash links to the chain's explorer, and the page asks the node every 10 s whether
 * it has been credited (the node waits for its confirmations first — about a minute on Base). When it has, the
 * throughput numbers are re-read so "Now" shows the new speed.
 *
 * Where the node cannot answer, the page says which way: an older node without the route, a model it does not
 * serve, or a node that is not answering (`billingThroughputFetchState`).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useModelsQuery, useThroughputDepositStatusQuery, useThroughputQuoteQuery } from '@/api/api';
import { parseModelsResponse } from '@/api/models';
import {
  BILLING_AMOUNT_PRESETS, billingAmountToUnits, billingChainLabel, billingConfirmationSeconds, billingExplorerTxUrl,
  billingFormatTokS, billingFormatWaitSeconds, billingPickDepositChain, billingThroughputFetchState,
  parseBillingDepositStatus, parseBillingThroughputResponse,
  type BillingDepositChain, type BillingDepositToken,
} from '@/api/billingThroughput';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Input, Select } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, ExternalLink, Mono, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { discoverWallets, type DiscoveredWallet } from '@/lib/ethWallet';
import { BillingDepositError, billingSendDeposit } from '@/lib/billingWalletDeposit';
import { useTitle } from '@/utils/useTitle';

const BillingModelRow = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 4px 0 24px;
  label { font-size: 13px; color: ${(p) => p.theme.color.GREY}; }
  select { max-width: 360px; }
`;
const BillingCards = styled.div`
  display: grid; grid-template-columns: 1fr; gap: 20px;
  @media (min-width: ${(p) => p.theme.breakpoint.md}px) { grid-template-columns: 1fr 1fr; }
`;
const BillingCard = styled.section`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; padding: 20px 22px; min-width: 0;
  h2 { margin: 0 0 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: ${(p) => p.theme.color.GREY}; }
`;
const BillingLabel = styled.div`font-size: 14px; color: ${(p) => p.theme.color.BLACK}; font-weight: 600;`;
const BillingBig = styled.div`font-size: 36px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; margin: 4px 0 6px;
  small { font-size: 16px; font-weight: 500; color: ${(p) => p.theme.color.GREY}; margin-left: 6px; }
`;
const BillingQuoteBig = styled(BillingBig)`color: ${(p) => p.theme.color.PRIMARY};`;
const BillingLine = styled.p`margin: 6px 0 0; font-size: 13px; line-height: 1.55; color: ${(p) => p.theme.color.GREY}; overflow-wrap: anywhere;`;
const BillingBusyDot = styled.span<{ $idle: boolean }>`
  display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px;
  background: ${(p) => (p.$idle ? '#1ea672' : '#f6981d')};
`;
const BillingToggle = styled.div`display: inline-flex; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 999px; padding: 2px; margin-bottom: 12px;`;
const BillingToggleButton = styled.button<{ $on: boolean }>`
  cursor: pointer; font: inherit; font-size: 13px; padding: 5px 16px; border-radius: 999px; border: 0;
  background: ${(p) => (p.$on ? p.theme.color.PALE_GREY : 'transparent')};
  color: ${(p) => (p.$on ? p.theme.color.HOVER : p.theme.color.GREY)}; font-weight: ${(p) => (p.$on ? 600 : 400)};
`;
const BillingAmountRow = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
  input { max-width: 180px; }
`;
const BillingPreset = styled.button`
  cursor: pointer; font: inherit; font-size: 13px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; background: #fff; color: ${(p) => p.theme.color.BLACK};
  &:hover { border-color: ${(p) => p.theme.color.PRIMARY}; }
`;
const BillingActions = styled.div`display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px;`;
const BillingManual = styled.dl`
  margin: 10px 0 0; font-size: 13px; display: grid; grid-template-columns: 1fr; gap: 4px;
  dt { color: ${(p) => p.theme.color.GREY}; margin-top: 8px; }
  dd { margin: 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; overflow-wrap: anywhere; }
`;
const BillingDetails = styled.details`margin-top: 18px; font-size: 13px; summary { cursor: pointer; color: ${(p) => p.theme.color.GREY}; }`;
const BillingStack = styled.div`display: grid; gap: 10px; margin-top: 14px;`;

/** What the wallet button has done. `sent` carries the chain because the explorer link and the wait depend on it. */
type BillingSendState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; txHash: string; chain: BillingDepositChain }
  | { kind: 'failed'; code: string; wallet?: string };

const shortHex = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-6)}` : s);

export default function BillingPage() {
  const { t } = useT();
  const auth = useAuth();
  useTitle(t('billing.title'));
  const [params, setParams] = useSearchParams();

  // ── which model: `?model=`, else the first chat model the node serves
  const modelsQuery = useModelsQuery();
  const chatModels = useMemo(() => parseModelsResponse(modelsQuery.data).filter((m) => m.modality === 'chat'), [modelsQuery.data]);
  const model = params.get('model') || chatModels[0]?.id || '';
  const chooseModel = (id: string) => setParams((p) => { const next = new URLSearchParams(p); next.set('model', id); return next; }, { replace: true });

  // ── the amount, and the quote asked for 300 ms after the typing stops
  // `?token=` / `?amount=` preselect what the link quoted (a model page's "100 sAIN → …"), so the reader lands on
  // the number they were just shown rather than a default that happens to differ.
  const [token, setToken] = useState<BillingDepositToken>(() => (params.get('token') === 'AIN' ? 'AIN' : 'sAIN'));
  const initialAmount = billingAmountToUnits(params.get('amount') ?? '') !== null ? params.get('amount')! : '100';
  const [amount, setAmount] = useState(initialAmount);
  const [quotedAmount, setQuotedAmount] = useState(initialAmount);
  useEffect(() => {
    const timer = setTimeout(() => setQuotedAmount(amount.trim()), 300);
    return () => clearTimeout(timer);
  }, [amount]);
  const units = billingAmountToUnits(amount);
  const quotedUnits = billingAmountToUnits(quotedAmount);

  const throughputQuery = useThroughputQuoteQuery(
    { model, token, amount: quotedUnits !== null && quotedUnits > 0n ? quotedAmount : undefined },
    { skip: !model, pollingInterval: 30_000 },
  );
  const view = parseBillingThroughputResponse(throughputQuery.data);
  const fetchState = billingThroughputFetchState(throughputQuery.error as never);

  // ── wallets, found the same way sign-in finds them
  const [wallets, setWallets] = useState<DiscoveredWallet[] | null>(null);
  useEffect(() => { let live = true; void discoverWallets().then((w) => { if (live) setWallets(w); }); return () => { live = false; }; }, []);

  // ── sending, then waiting for the credit
  const [send, setSend] = useState<BillingSendState>({ kind: 'idle' });
  const sentHash = send.kind === 'sent' ? send.txHash : '';
  // Held in state once seen, so the poll can be switched off (a skipped query drops its data) without the page
  // forgetting that the deposit landed.
  const [credit, setCredit] = useState<{ txHash: string; sain: number | null } | null>(null);
  const credited = !!sentHash && credit?.txHash === sentHash;
  const statusQuery = useThroughputDepositStatusQuery(sentHash, { skip: !sentHash || credited, pollingInterval: 10_000 });
  const status = parseBillingDepositStatus(statusQuery.data);
  const { refetch: refetchThroughput } = throughputQuery;
  useEffect(() => {
    if (!sentHash || !status.credited || credit?.txHash === sentHash) return;
    setCredit({ txHash: sentHash, sain: status.sain });
    void refetchThroughput();
  }, [sentHash, status.credited, status.sain, credit, refetchThroughput]);

  const deposits = view?.deposits;
  const chain = deposits?.enabled ? billingPickDepositChain(deposits.chains, token) : null;
  const signInHref = `/signing?next=${encodeURIComponent(`/billing${model ? `?model=${encodeURIComponent(model)}` : ''}`)}`;

  async function depositWith(wallet: DiscoveredWallet) {
    if (!deposits?.enabled || !chain || !auth.subject || units === null) return;
    setSend({ kind: 'sending' });
    try {
      const { txHash } = await billingSendDeposit({
        provider: wallet.provider, signedInAddress: auth.subject, chain, receivingAddress: deposits.address, units,
      });
      setSend({ kind: 'sent', txHash, chain });
    } catch (e) {
      const code = e instanceof BillingDepositError ? e.message : 'send_failed';
      let connected: string | undefined;
      if (code === 'account_mismatch') {
        const accounts = await wallet.provider.request({ method: 'eth_accounts' }).catch(() => null) as unknown;
        connected = Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : undefined;
      }
      setSend({ kind: 'failed', code, wallet: connected });
    }
  }

  const header = (
    <>
      <TitleRow><Title>{t('billing.title')}</Title></TitleRow>
      <Description style={{ marginTop: -12, marginBottom: 20 }}>{t('billing.lede')}</Description>
      {chatModels.length > 0 && (
        <BillingModelRow>
          <label htmlFor="billing-model">{t('billing.model')}</label>
          <Select id="billing-model" data-testid="billing-model" value={model} onChange={(e) => chooseModel(e.target.value)}>
            {!chatModels.some((m) => m.id === model) && model && <option value={model}>{model}</option>}
            {chatModels.map((m) => <option key={m.id} value={m.id}>{m.id}</option>)}
          </Select>
        </BillingModelRow>
      )}
    </>
  );

  if (modelsQuery.isLoading && !model) return <PageWrapper>{header}<CenterProgress /></PageWrapper>;
  if (!model) return <PageWrapper>{header}<Empty data-testid="billing-no-models">{t('billing.no_models')}</Empty></PageWrapper>;
  if (!view) {
    if (throughputQuery.isLoading || fetchState === 'ok') return <PageWrapper>{header}<CenterProgress /></PageWrapper>;
    return (
      <PageWrapper>
        {header}
        <Empty data-testid={`billing-${fetchState}`}>{t(`billing.state.${fetchState}`, { model })}</Empty>
      </PageWrapper>
    );
  }

  // ── left: now
  const you = view.you;
  const nowTok = you ? you.expectedTokS : view.freeTier.expectedTokS;
  const idle = you ? you.idle : view.freeTier.idle;
  const nowCard = (
    <BillingCard data-testid="billing-now">
      <h2>{t('billing.now.title')}</h2>
      <BillingLabel>{you ? t('billing.now.you') : t('billing.now.free')}</BillingLabel>
      <BillingBig data-testid="billing-now-toks">{billingFormatTokS(nowTok)}<small>tok/s</small></BillingBig>
      {you && <BillingLine>{t('billing.now.deposited', { n: String(you.depositedSain) })}</BillingLine>}
      <BillingLine><BillingBusyDot $idle={idle} />{idle ? t('billing.now.idle') : t('billing.now.busy')}</BillingLine>
      <BillingLine>
        {view.rate.measured
          ? t('billing.now.rate_measured', { r: billingFormatTokS(view.rate.tokS), n: String(view.rate.samples) })
          : t('billing.now.rate_estimated', { r: billingFormatTokS(view.rate.tokS) })}
      </BillingLine>
      {!you && view.freeTier.busyExpectedTokS !== null && (
        <BillingLine data-testid="billing-free-busy">{t('billing.now.free_busy', { n: billingFormatTokS(view.freeTier.busyExpectedTokS) })}</BillingLine>
      )}
      <BillingStack>
        <Alert $tone="info">{t('billing.now.scope')}</Alert>
        {!auth.subject && (
          <BillingLine>{t('billing.now.signin')} <StyledLink to={signInHref}>{t('billing.now.signin_link')} →</StyledLink></BillingLine>
        )}
      </BillingStack>
    </BillingCard>
  );

  // ── right: deposit
  const quote = view.quote && view.quote.token === token ? view.quote : null;
  const quoteIsCurrent = !!quote && quote.amount === amount.trim();
  const manual = deposits?.enabled && chain ? (
    <BillingManual data-testid="billing-manual">
      <dt>{t('billing.manual.to')}</dt>
      <dd><Mono>{deposits.address}</Mono><CopyButton text={deposits.address} /></dd>
      <dt>{t('billing.manual.chain')}</dt>
      <dd>{billingChainLabel(chain)}{chain.chainId !== null && <> (chain id {chain.chainId})</>}</dd>
      <dt>{t('billing.manual.token')} ({chain.symbol})</dt>
      <dd><Mono>{chain.token}</Mono><CopyButton text={chain.token} /></dd>
      <dd style={{ marginTop: 8, color: 'inherit' }}>
        <BillingLine style={{ margin: 0 }}>
          {auth.subject ? t('billing.deposit.from_rule', { address: auth.subject }) : t('billing.deposit.from_rule_anon')}
        </BillingLine>
      </dd>
    </BillingManual>
  ) : null;

  const depositCard = (
    <BillingCard data-testid="billing-deposit">
      <h2>{t('billing.deposit.title')}</h2>
      {!deposits?.enabled ? (
        <Alert data-testid="billing-deposits-off">{t('billing.deposit.disabled')}</Alert>
      ) : (
        <>
          <BillingToggle role="group" aria-label="token">
            {(['sAIN', 'AIN'] as const).map((s) => (
              <BillingToggleButton key={s} type="button" $on={token === s} aria-pressed={token === s} data-testid={`billing-token-${s}`} onClick={() => setToken(s)}>
                {s}
              </BillingToggleButton>
            ))}
          </BillingToggle>
          <BillingAmountRow>
            <Input
              aria-label={t('billing.deposit.amount')} inputMode="decimal" value={amount} data-testid="billing-amount"
              onChange={(e) => setAmount(e.target.value)}
            />
            <span>{token}</span>
            {BILLING_AMOUNT_PRESETS.map((p) => <BillingPreset key={p} type="button" onClick={() => setAmount(p)}>{p}</BillingPreset>)}
          </BillingAmountRow>
          {units === null && <BillingLine style={{ color: '#a0102c' }}>{t('billing.deposit.bad_amount')}</BillingLine>}

          {quote && !quote.error && quote.expectedTokS !== null && (
            <div data-testid="billing-quote" style={{ opacity: quoteIsCurrent ? 1 : 0.5, transition: 'opacity .15s' }}>
              {/*
                * The headline is the BUSY case, because that is what a deposit buys: on an idle node everyone gets
                * the whole model, so "now → after" would read ×1 and say nothing. Busy before → busy after, and the
                * idle truth underneath in one line.
                */}
              {quote.busyExpectedTokS !== null && (
                <BillingQuoteBig>
                  {t('billing.deposit.busy_compare', {
                    before: billingFormatTokS(view.you?.busyExpectedTokS ?? view.freeTier.busyExpectedTokS ?? 0),
                    after: billingFormatTokS(quote.busyExpectedTokS),
                  })}
                  {quote.multiplier !== null && <small>{t('billing.deposit.multiplier', { k: String(quote.multiplier) })}</small>}
                </BillingQuoteBig>
              )}
              {quote.busyExpectedTokS !== null && quote.multiplier === null && <BillingLine>{t('billing.deposit.from_nothing')}</BillingLine>}
              <BillingLine>
                {(view.you ? view.you.idle : view.freeTier.idle)
                  ? t('billing.deposit.now_idle', { m: billingFormatTokS(quote.expectedTokS) })
                  : t('billing.deposit.now_busy', { m: billingFormatTokS(quote.expectedTokS) })}
              </BillingLine>
              {token === 'AIN' && quote.sain !== null && <BillingLine>{t('billing.deposit.sain_equiv', { n: String(quote.sain) })}</BillingLine>}
            </div>
          )}
          {quote?.error && <Alert $tone="warning">{t('billing.deposit.quote_error', { why: quote.error })}</Alert>}
          {token === 'AIN' && deposits.ainPerSain !== null && (
            <BillingLine data-testid="billing-ain-rate">{t('billing.deposit.ain_rate', { r: String(deposits.ainPerSain) })}</BillingLine>
          )}

          {!chain ? (
            <BillingStack><Alert>{t('billing.deposit.no_chain', { token })}</Alert></BillingStack>
          ) : wallets !== null && wallets.length === 0 ? (
            <BillingStack>
              <Alert $tone="info">{t('billing.manual.no_wallet')}</Alert>
              {manual}
            </BillingStack>
          ) : (
            <>
              {!auth.subject ? (
                <BillingStack>
                  <Alert $tone="warning">{t('billing.deposit.need_signin')}</Alert>
                  <div><StyledLink to={signInHref}>{t('billing.now.signin_link')} →</StyledLink></div>
                </BillingStack>
              ) : (
                <BillingActions>
                  {(wallets ?? []).map((w) => (
                    <Button
                      key={w.info.uuid} variant="contained" data-testid="billing-deposit-wallet"
                      disabled={send.kind === 'sending' || units === null || units <= 0n || chain.chainId === null}
                      loading={send.kind === 'sending'} loadingText={t('billing.deposit.sending')}
                      onClick={() => { void depositWith(w); }}
                    >
                      {wallets && wallets.length > 1 ? t('billing.deposit.button_named', { name: w.info.name }) : t('billing.deposit.button')}
                    </Button>
                  ))}
                </BillingActions>
              )}
              {send.kind === 'failed' && (
                <BillingStack>
                  <Alert $tone="error" data-testid="billing-send-error">
                    {t(`billing.err.${send.code}`, { wallet: send.wallet ?? '?', subject: auth.subject ?? '?' })}
                  </Alert>
                </BillingStack>
              )}
              <BillingDetails>
                <summary>{t('billing.manual.title')}</summary>
                {manual}
              </BillingDetails>
            </>
          )}

          {send.kind === 'sent' && <BillingSentStatus send={send} credited={credited} sain={credit?.sain ?? null} error={statusQuery.error} />}
        </>
      )}
    </BillingCard>
  );

  return (
    <PageWrapper>
      {header}
      {fetchState === 'offline' && <Alert $tone="warning" style={{ marginBottom: 16 }}>{t('billing.state.offline')}</Alert>}
      <BillingCards>
        {nowCard}
        {depositCard}
      </BillingCards>
    </PageWrapper>
  );
}

/** The transaction, where to watch it, and whether the node has credited it yet. */
function BillingSentStatus({ send, credited, sain, error }: {
  send: { txHash: string; chain: BillingDepositChain }; credited: boolean; sain: number | null; error: unknown;
}) {
  const { t } = useT();
  const url = billingExplorerTxUrl(send.chain.chainId, send.txHash);
  const wait = billingConfirmationSeconds(send.chain);
  return (
    <BillingStack data-testid="billing-sent">
      <BillingLine>
        {t('billing.deposit.sent')}{' '}
        {url ? <ExternalLink href={url} target="_blank" rel="noreferrer"><Mono>{shortHex(send.txHash)}</Mono></ExternalLink> : <Mono>{send.txHash}</Mono>}
      </BillingLine>
      {credited ? (
        <Alert $tone="success" data-testid="billing-credited">
          {sain !== null ? t('billing.deposit.credited', { n: String(sain) }) : t('billing.deposit.credited_plain')}
        </Alert>
      ) : (
        <Alert $tone="info">
          {wait !== null
            ? t('billing.deposit.waiting', { n: String(send.chain.confirmations), wait: billingFormatWaitSeconds(wait) })
            : t('billing.deposit.waiting_unknown', { n: String(send.chain.confirmations) })}
        </Alert>
      )}
      {!credited && !!error && <Alert $tone="warning">{t('billing.err.status_failed', { why: errorMessage(error) })}</Alert>}
    </BillingStack>
  );
}
