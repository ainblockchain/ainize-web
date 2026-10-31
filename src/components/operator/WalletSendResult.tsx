import { useT } from '@/i18n';
import type { WalletSendStatus } from '@/lib/accountWalletSend';
import { Alert } from '@/components/ui/Form';
import { Mono } from '@/components/ui/Misc';
import { Muted } from './common';

export function WalletSendResult({ value }: { value: WalletSendStatus }) {
  const { t } = useT(), op = value.operation;
  if (!op) return null;
  return <div data-testid={`send-${op.state}`}>
    <Alert $tone={op.state === 'confirmed' ? 'success' : 'warning'} role="status">{t(`op.account.send.state.${op.state}`)}</Alert>
    <div style={{ marginTop: 6 }}>{t('op.account.send.amount', { currency: 'AIN' })}: <strong>{op.amount} AIN</strong></div>
    <div>{t('op.account.send.to')}: <Mono>{op.to}</Mono></div>
    {op.memo != null && <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{t('op.account.send.memo')}: {op.memo}</div>}
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
