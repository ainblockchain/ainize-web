import { useEffect, useState } from 'react';
import type { InfoResponse } from '@/api/types';
import { useChainSetupStatusQuery, useReviewedChainSetupMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { chainSetupContext, chainSetupKey, prepareAccountChain, readChainSetup, ChainSetupActionError, type ChainSetupContext, type ChainSetupStatus } from '@/lib/accountChainSetup';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Mono } from '@/components/ui/Misc';
import { Muted, QueryError, Row } from './common';

export function AccountChainSetup({ info }: { info: InfoResponse }) {
  const context = chainSetupContext(info), auth = useAuth(), { t } = useT();
  if (!auth.isOwner) return null;
  if (!context) return <Muted>{t('op.account.chain.context_missing')}</Muted>;
  return <Setup key={auth.cacheIdentity + chainSetupKey(context)} context={context} />;
}
function Setup({ context }: { context: ChainSetupContext }) {
  const auth = useAuth(), { t } = useT(), active = useActiveView();
  const query = useChainSetupStatusQuery({ identity: auth.cacheIdentity, context });
  const value = !query.isError ? readChainSetup(query.currentData, context) : null;
  const [write] = useReviewedChainSetupMutation();
  const [task] = useState(createNodeActionTask), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const current = () => active() && auth.isOwner && auth.isCurrentAccount();
  useEffect(() => () => task.abandon(), [task]);
  const refresh = async () => {
    try { const result = readChainSetup(await query.refetch().unwrap(), context); if (current() && result) setError(null); } catch { /* query recovery remains visible */ }
  };
  const start = async () => {
    if (!value || query.isFetching || task.pending() || !current()) return;
    setBusy(true); setError(null);
    try {
      await task.run(current, current => prepareAccountChain(context, value.operation?.state === 'unconfirmed' ? value.operation.id : null, {
        current, requestId: () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''),
        read: () => query.refetch().unwrap(), write: body => write(body).unwrap(),
      }));
    } catch (e) { if (current()) setError(t(`op.account.chain.error.${e instanceof ChainSetupActionError ? e.code : 'read'}`)); }
    finally { if (current()) setBusy(false); }
  };
  if (!value) return query.isFetching ? <CenterProgress /> : <QueryError error={query.error} what={t('op.account.chain.setup')} onRetry={() => void query.refetch()} retrying={query.isFetching} />;
  return <div style={{ marginTop: 12, minWidth: 0, overflowWrap: 'anywhere' }} data-testid="chain-setup-panel">
    <ChainSetupResult value={value} />
    {error && <Alert $tone="warning" role="alert">{error}</Alert>}
    <Row $wrap $gap={12} style={{ marginTop: 8 }}>
      {value.verification && !value.verification.valid && value.operation?.state !== 'running' && <Button size="small" onClick={() => void start()} disabled={busy || query.isFetching} loading={busy} loadingText={t('op.account.chain.setting')}>
        {t(value.operation?.state === 'unconfirmed' ? 'op.account.chain.retry' : 'op.account.chain.setup')}
      </Button>}
      <Button size="small" variant="text" disabled={busy || query.isFetching} onClick={() => void refresh()}>{t('op.account.chain.refresh')}</Button>
    </Row>
    <Muted style={{ display: 'block', marginTop: 6 }}>{t('op.account.chain.note')}</Muted>
  </div>;
}
export function ChainSetupResult({ value }: { value: ChainSetupStatus }) {
  const { t } = useT(), op = value.operation;
  return <div data-testid="chain-setup-result">
    {value.verification?.valid ? <Alert $tone="success" role="status">{t('op.account.chain.verified')}</Alert>
      : value.read_error ? <Alert $tone="warning" role="alert">{t('op.account.chain.error.read')}</Alert>
      : <Muted>{t('op.account.chain.required')}</Muted>}
    {op && op.state !== 'verified' && <Alert $tone="warning" role="status">{t(op.state === 'running' ? 'op.account.chain.running' : 'op.account.chain.unconfirmed')}</Alert>}
    {(op || !!value.verification?.errors.length) && <details style={{ marginTop: 6 }}><summary>{t('op.account.chain.details')}</summary>
    {op && <div style={{ marginTop: 6 }}>
      <Muted>{t('op.account.chain.request')} <Mono>{op.id}</Mono></Muted>
      {op.created === true && <div>{t('op.account.chain.created')}</div>}
      {op.created === false && <div>{t('op.account.chain.existed')}</div>}
      {op.admin && <div>{t('op.account.chain.admin')} <Mono>{op.admin}</Mono></div>}
      {op.tx && <div>{t('op.account.chain.tx')} <Mono>{op.tx}</Mono></div>}
      {op.error && <Muted>{t('op.account.chain.previous_error')} {op.error}</Muted>}
    </div>}
    {value.verification?.errors.map((e, i) => <Muted key={i} style={{ display: 'block', overflowWrap: 'anywhere' }}>{e}</Muted>)}
    </details>}
  </div>;
}
