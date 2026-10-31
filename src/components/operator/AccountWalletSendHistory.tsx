import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { syncWalletSendReceipt } from '@/lib/walletSendCache';
import { useSearchParams } from 'react-router';
import { useWalletSendHistoryQuery, useWalletSendRequestQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { readWalletSend, readWalletSendHistory, walletSendHistoryCursor, walletSendRequestId, type WalletSendContext } from '@/lib/accountWalletSend';
import { Button } from '@/components/ui/Button';
import { CenterProgress, Mono, StyledLink } from '@/components/ui/Misc';
import { dateTime, shortAddr } from '@/utils/format';
import { Muted, QueryError, Row } from './common';
import { WalletSendResult } from './WalletSendResult';

/** The URL retains both the selected receipt and list cursor across reload/back; detail never offers Send. */
export function AccountWalletSendHistory({ context }: { context: WalletSendContext }) {
  const { t } = useT(), [params, setParams] = useSearchParams(), section = useRef<HTMLElement>(null);
  const ids = params.getAll('sendRequest'), cursors = params.getAll('sendCursor');
  const open = params.has('sendHistory') || ids.length > 0 || cursors.length > 0;
  const selected = ids[0] ?? null, cursor = cursors[0] ?? null;
  useEffect(() => { if (open) section.current?.scrollIntoView({ block: 'start' }); }, [open, selected, cursor]);
  const invalid = ids.length > 1 || ids.length === 1 && !walletSendRequestId(ids[0]) || cursors.length > 1 || cursors.length === 1 && !walletSendHistoryCursor(cursors[0]);
  const hide = () => { const next = new URLSearchParams(params); next.delete('sendRequest'); next.delete('sendCursor'); next.delete('sendHistory'); setParams(next); };
  const clear = () => { const next = new URLSearchParams(params); next.delete('sendRequest'); next.delete('sendCursor'); next.set('sendHistory', '1'); setParams(next); };
  return <section ref={section} style={{ marginTop: 12, minWidth: 0, overflowWrap: 'anywhere' }} id="wallet-send-history">
    <Button size="small" variant="text" aria-expanded={open} onClick={() => open ? hide() : clear()}>{t(open ? 'op.account.send.history.hide' : 'op.account.send.history.show')}</Button>
    {open && (invalid ? <div role="alert"><Muted>{t('op.account.send.history.invalid_link')}</Muted> <Button size="small" variant="text" onClick={clear}>{t('op.account.send.history.latest')}</Button></div>
      : ids[0] ? <WalletSendHistoryDetail key={ids[0]} context={context} id={ids[0]} />
      : <WalletSendHistoryList context={context} cursor={cursors[0] ?? null} />)}
  </section>;
}
function link(params: URLSearchParams, values: { sendRequest?: string | null; sendCursor?: string | null }) {
  const next = new URLSearchParams(params); next.set('sendHistory', '1');
  for (const [key, value] of Object.entries(values)) { if (value === null) next.delete(key); else if (value !== undefined) next.set(key, value); }
  return { pathname: '/account', search: next.size ? `?${next}` : '', hash: '#wallet-send-history' };
}
export function WalletSendHistoryList({ context, cursor }: { context: WalletSendContext; cursor: string | null }) {
  const auth = useAuth(), { t } = useT(), [params] = useSearchParams();
  const query = useWalletSendHistoryQuery({ identity: auth.cacheIdentity, context, cursor }, { skip: !auth.isOwner });
  const value = !query.isError ? readWalletSendHistory(query.currentData, context, cursor) : null;
  if (!auth.isOwner) return null;
  if (!value) return query.isFetching ? <CenterProgress /> : <QueryError error={query.error} what={t('op.account.send.history.title')} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  return <div data-testid="send-history-list">
    <Muted>{t('op.account.send.history.saved')}</Muted>
    {value.items.length === 0 && <p data-testid="send-history-empty">{t(cursor ? 'op.account.send.history.end' : 'op.account.send.history.empty')}</p>}
    <ul style={{ listStyle: 'none', margin: '8px 0', padding: 0 }}>
      {value.items.map(op => <li key={op.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0', minWidth: 0 }}>
        <Row $wrap $gap={10}><strong>{op.amount} AIN</strong><Mono title={op.to}>{shortAddr(op.to)}</Mono><span>{t(`op.account.send.history.state.${op.state}`)}</span></Row>
        <Muted style={{ display: 'block', margin: '4px 0' }}>{dateTime(op.created_at)} · Chain ID {op.context.chain_id}</Muted>
        <StyledLink to={link(params, { sendRequest: op.id })} aria-label={t('op.account.send.history.open_label', { id: op.id })}>{t('op.account.send.history.open')}</StyledLink>
      </li>)}
    </ul>
    <Row $wrap $gap={12}>
      {cursor && <StyledLink to={link(params, { sendCursor: null, sendRequest: null })}>{t('op.account.send.history.latest')}</StyledLink>}
      {value.next_cursor && <StyledLink to={link(params, { sendCursor: value.next_cursor, sendRequest: null })}>{t('op.account.send.history.older')}</StyledLink>}
      <Button size="small" variant="text" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('op.account.send.history.refresh')}</Button>
    </Row>
  </div>;
}
export function WalletSendHistoryDetail({ context, id }: { context: WalletSendContext; id: string }) {
  const auth = useAuth(), { t } = useT(), [params] = useSearchParams(), dispatch = useDispatch<AppDispatch>();
  const query = useWalletSendRequestQuery({ identity: auth.cacheIdentity, context, id }, { skip: !auth.isOwner || !walletSendRequestId(id) });
  const parsed = !query.isError ? readWalletSend(query.currentData, context) : null;
  const value = parsed?.operation?.id === id ? parsed : null;
  useEffect(() => {
    if (value && auth.isOwner && auth.isCurrentAccount()) syncWalletSendReceipt(dispatch, { identity: auth.cacheIdentity, context }, value);
  }, [value, auth.cacheIdentity, auth.isOwner, context, dispatch]);
  const notFound = query.isError && query.error && 'status' in query.error && query.error.status === 404;
  if (!auth.isOwner) return null;
  return <div data-testid="send-history-detail" style={{ marginTop: 8 }}>
    <StyledLink to={link(params, { sendRequest: null })}>{t('op.account.send.history.back')}</StyledLink>
    {!walletSendRequestId(id) ? <p role="alert">{t('op.account.send.history.invalid_link')}</p>
      : !value && query.isFetching ? <CenterProgress />
      : notFound ? <p role="alert">{t('op.account.send.history.not_found')}</p>
      : !value ? <QueryError error={query.error} what={t('op.account.send.history.receipt')} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      : <>
        <p><Mono>{id}</Mono></p>
        <WalletSendResult value={value} />
        <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.send.history.read_only')}</Muted>
      </>}
    {walletSendRequestId(id) && <Button size="small" variant="text" disabled={query.isFetching} onClick={() => void query.refetch()}>{t('op.account.send.refresh')}</Button>}
  </div>;
}
