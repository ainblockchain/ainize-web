import { useT } from '@/i18n';
import { Alert } from './Form';
import { Button } from './Button';

export function SignOutNotice({ failed, pending, retry }: { failed: boolean; pending: boolean; retry: () => void }) {
  const { t } = useT();
  if (!failed && !pending) return null;
  return <Alert $tone={failed ? 'error' : 'info'} role={failed ? 'alert' : 'status'} data-testid="signout-notice" style={{ margin: '0 16px 12px', boxSizing: 'border-box', maxWidth: 'calc(100% - 32px)' }}>
    {t(failed ? 'nav.logout_failed' : 'nav.logging_out')}
    {failed && <Button size="small" disabled={pending} onClick={retry}>{t('offline.retry')}</Button>}
  </Alert>;
}
