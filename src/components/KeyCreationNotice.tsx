import type { useApiKeyCreation } from '@/hooks/useApiKeyCreation';
import { useT } from '@/i18n';
import { Alert } from './ui/Form';
import { Button } from './ui/Button';
import { Description, Mono, StyledLink } from './ui/Misc';

export function KeyCreationNotice({ action }: { action: ReturnType<typeof useApiKeyCreation> }) {
  const { t } = useT();
  const intent = action.operation;
  const terminal = ['issued', 'disabled', 'revoked', 'cancelled'].includes(action.status);
  return <>
    {intent && <div data-testid="key-creation-notice" style={{ margin: '12px 0' }}>
      <strong>{intent.label} · {intent.orgId ?? t('me.keys.personal')}</strong>
      {intent.receipt?.key && <Mono style={{ display: 'block', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{intent.receipt.key.key_id}</Mono>}
      <Description role="status">{t(`me.keys.creation.${action.running ? 'working' : action.status}`)}</Description>
      {(action.status === 'issued' || action.status === 'disabled') && !action.secretHeld && <Description>{t('me.keys.creation.secret_missing')}</Description>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(!terminal || action.status === 'issued' || action.status === 'disabled') && <Button size="small" disabled={action.blocked} onClick={() => void action.inspect()}>{t('me.keys.recovery.inspect')}</Button>}
        {!terminal && <>
          {intent.action === 'create' && <Button size="small" disabled={action.blocked} onClick={() => void action.retry()}>{t('me.keys.creation.retry')}</Button>}
          <Button size="small" disabled={action.blocked} onClick={() => void action.cancel()}>{t('me.keys.creation.cancel')}</Button>
        </>}
        {terminal && <Button size="small" disabled={action.blocked} onClick={() => void action.acknowledge()}>{t('me.keys.recovery.done')}</Button>}
        {intent.receipt?.key && <StyledLink to="/me">{t('models.key.manage')}</StyledLink>}
      </div>
    </div>}
    {action.error && <Alert role="alert" $tone="error" data-testid="key-creation-error">
      {t(`me.keys.creation.error.${action.error}`)}{' '}
      {!intent && <Button size="small" disabled={action.blocked} onClick={action.reload}>{t('orgs.retry')}</Button>}
    </Alert>}
  </>;
}
