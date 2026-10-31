import type { useApiKeyRevocation } from '@/hooks/useApiKeyRevocation';
import { useT } from '@/i18n';
import { Alert } from './ui/Form';
import { Button } from './ui/Button';
import { Description, Mono } from './ui/Misc';

export function KeyRevocationNotice({ action }: { action: ReturnType<typeof useApiKeyRevocation> }) {
  const { t } = useT();
  const operation = action.operation;
  return <>
    {operation && <div data-testid="key-revocation-notice" style={{ margin: '12px 0' }}>
      <strong>{t('me.keys.recovery.title')}</strong>
      <Description>{operation.key.label ?? operation.key.prefix}</Description>
      <Mono style={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{operation.key.key_id}</Mono>
      <Description role="status">{t(`me.keys.recovery.${action.running ? 'working' : action.status}`)}</Description>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {action.status !== 'confirmed' && <Button size="small" disabled={action.blocked} onClick={() => void action.inspect()}>{t('me.keys.recovery.inspect')}</Button>}
        {action.status === 'present' && <Button size="small" disabled={action.blocked} onClick={() => void action.retry()}>{t('me.keys.recovery.retry')}</Button>}
        {action.status === 'confirmed' && <Button size="small" disabled={action.blocked} onClick={() => void action.acknowledge()}>{t('me.keys.recovery.done')}</Button>}
      </div>
    </div>}
    {action.error && <Alert role="alert" $tone="error" data-testid="key-revocation-error">
      {t(`me.keys.recovery.error.${action.error}`)}{' '}
      {!operation && <Button size="small" disabled={action.blocked} onClick={action.reload}>{t('orgs.retry')}</Button>}
    </Alert>}
  </>;
}
