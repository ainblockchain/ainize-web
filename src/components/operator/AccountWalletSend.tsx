import { useEffect, useState } from 'react';
import type { InfoResponse } from '@/api/types';
import { useWalletSendStatusQuery, usePrepareWalletSendMutation, useSubmitWalletSendMutation, useCancelWalletSendMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { actOnWalletSend, readWalletSend, sendAddress, walletSendAmount, walletSendContext, walletSendContextKey, walletSendPending, WalletSendActionError, type WalletSendAction, type WalletSendContext, type WalletSendStatus } from '@/lib/accountWalletSend';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, Mono } from '@/components/ui/Misc';
import { Muted, QueryError, Row } from './common';

export function AccountWalletSend({ info, canPrepare }: { info: InfoResponse; canPrepare: boolean }) {
  const context = walletSendContext(info), auth = useAuth();
  if (!auth.isOwner || !context) return null;
  return <Send key={auth.cacheIdentity + walletSendContextKey(context)} context={context} canPrepare={canPrepare} />;
}
function Send({ context, canPrepare }: { context: WalletSendContext; canPrepare: boolean }) {
  const auth = useAuth(), active = useActiveView(), { t } = useT();
  const query = useWalletSendStatusQuery({ identity: auth.cacheIdentity, context });
  const value = !query.isError ? readWalletSend(query.currentData, context) : null;
  const [prepare] = usePrepareWalletSendMutation(), [submit] = useSubmitWalletSendMutation(), [cancel] = useCancelWalletSendMutation();
  const [to, setTo] = useState(''), [amount, setAmount] = useState(''), [error, setError] = useState<string | null>(null);
  const [task] = useState(createNodeActionTask), [busy, setBusy] = useState(false);
  const current = () => active() && auth.isOwner && auth.isCurrentAccount();
  useEffect(() => () => task.abandon(), [task]);
  const act = async (action: WalletSendAction) => {
    if (!value || task.pending() || query.isFetching || !current()) return;
    setBusy(true); setError(null);
    try {
      await task.run(current, current => actOnWalletSend(context, action, { current, read: () => query.refetch().unwrap(), write: (a, expected) => a.kind === 'prepare'
        ? prepare({ request_id: a.request_id, expected, to: a.to, amount: a.amount }).unwrap()
        : a.kind === 'submit' ? submit(a.operation.id).unwrap() : cancel(a.operation.id).unwrap() }));
    } catch (e) { if (current()) setError(t(`op.account.send.error.${e instanceof WalletSendActionError ? e.code : 'read'}`)); }
    finally { if (current()) setBusy(false); }
  };
  const refresh = async () => { try { const result = readWalletSend(await query.refetch().unwrap(), context); if (current() && result) setError(null); } catch { /* recovery shown by query */ } };
  if (!value) return query.isFetching ? <CenterProgress /> : <QueryError error={query.error} what={t('op.account.send.title')} onRetry={() => void refresh()} retrying={query.isFetching} />;
  const op = value.operation, canonical = walletSendAmount(amount), disabled = busy || query.isFetching;
  return <section style={{ marginTop: 16, minWidth: 0, overflowWrap: 'anywhere' }} data-testid="wallet-send">
    <strong>{t('op.account.send.title')}</strong>
    <WalletSendResult value={value} />
    {op && walletSendPending(op) && walletSendContextKey(op.context) !== walletSendContextKey(context) && <Muted>{t('op.account.send.context_changed')}</Muted>}
    {op?.state === 'prepared' && auth.subject?.toLowerCase() !== op.actor.toLowerCase() && <Muted>{t('op.account.send.other_operator')}</Muted>}
    {error && <Alert $tone="warning" role="alert">{error}</Alert>}
    {!walletSendPending(op) && canPrepare && <Row $wrap $gap={12} style={{ marginTop: 8, maxWidth: 680 }}>
      <TextField label={t('op.account.send.to')} value={to} disabled={disabled} onChange={e => setTo(e.target.value)} data-testid="send-to" />
      <TextField label={t('op.account.send.amount', { currency: 'AIN' })} value={amount} inputMode="decimal" disabled={disabled} onChange={e => setAmount(e.target.value)} data-testid="send-amount" style={{ maxWidth: 200 }} />
      <Button size="small" data-testid="send-review" disabled={disabled || !canonical || !sendAddress(to.trim()) || to.trim().toLowerCase() === context.node.toLowerCase()} onClick={() => void act({ kind: 'prepare', request_id: Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''), to: to.trim(), amount: canonical! })}>{t('op.account.send.review')}</Button>
      {!!amount && !canonical && <Muted role="status">{t('op.account.send.invalid_amount')}</Muted>}
    </Row>}
    <Row $wrap $gap={12} style={{ marginTop: 8 }}>
      {op?.state === 'prepared' && <>
        <Button size="small" color="secondary" data-testid="send-go" disabled={disabled || !canPrepare || auth.subject?.toLowerCase() !== op.actor.toLowerCase() || walletSendContextKey(context) !== walletSendContextKey(op.context)} onClick={() => void act({ kind: 'submit', operation: op })}>{t('op.account.send.confirm')}</Button>
        <Button size="small" variant="text" disabled={disabled} onClick={() => void act({ kind: 'cancel', operation: op })}>{t('op.account.send.cancel')}</Button>
      </>}
      <Button size="small" variant="text" disabled={disabled} onClick={() => void refresh()}>{t('op.account.send.refresh')}</Button>
    </Row>
  </section>;
}
export function WalletSendResult({ value }: { value: WalletSendStatus }) {
  const { t } = useT(), op = value.operation;
  if (!op) return null;
  return <div data-testid={`send-${op.state}`}>
    <Alert $tone={op.state === 'confirmed' ? 'success' : 'warning'} role="status">{t(`op.account.send.state.${op.state}`)}</Alert>
    <div style={{ marginTop: 6 }}>{t('op.account.send.amount', { currency: 'AIN' })}: <strong>{op.amount} AIN</strong></div>
    <div>{t('op.account.send.to')}: <Mono>{op.to}</Mono></div>
    {op.state === 'prepared' && <><div>{t('op.account.send.from')}: <Mono>{op.context.node}</Mono></div><div>Chain ID {op.context.chain_id} · <Mono>{op.context.rpc_url}</Mono></div><Muted>{t('op.account.send.desc')} {t('op.account.send.fees')}</Muted></>}
    <details style={{ marginTop: 6 }}><summary>{t('op.account.send.details')}</summary>
      <div>{t('op.account.send.from')}: <Mono>{op.context.node}</Mono></div>
      <div>Chain ID {op.context.chain_id} · <Mono>{op.context.rpc_url}</Mono></div>
      <div>{t('op.account.send.request')}: <Mono>{op.id}</Mono></div>
      <div>{t('op.account.send.hash')}: <Mono>{op.tx_hash}</Mono></div>
    </details>
    {value.read_error && <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.send.error.unconfirmed')}</Muted>}
  </div>;
}
