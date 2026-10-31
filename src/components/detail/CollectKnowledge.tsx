import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { collectKnowledge, collectionTarget, CollectionError } from '@/lib/collectKnowledge';
import { LoadKnowledgeError, type RuntimeTarget } from '@/lib/loadKnowledge';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';

export function CollectKnowledge({ target, hasBody }: { target: RuntimeTarget; hasBody: boolean }) {
  const auth = useAuth();
  return <CollectView key={JSON.stringify([auth.cacheIdentity, collectionTarget(target)])} target={target} hasBody={hasBody} />;
}
function CollectView({ target, hasBody }: { target: RuntimeTarget; hasBody: boolean }) {
  const auth = useAuth(), active = useActiveView(), { t } = useT();
  const [task] = useState(createNodeActionTask);
  useEffect(() => () => task.abandon(), [task]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [done, setDone] = useState<null | 'already' | 'collected'>(null);
  const [access] = api.useLazyMeQuery(), [read] = api.useLazyManagedPatchQuery(), [write] = api.useCollectReviewedMutation();
  const run = async (inspectOnly = false) => {
    const current = () => active() && auth.isCurrentAccount();
    if (!current() || task.pending() || !auth.isOwner || done) return;
    setBusy(true); setError(null); let stillCurrent = current;
    try {
      const result = await task.run(current, async check => {
        stillCurrent = check;
        return collectKnowledge(target, { current: check, node: auth.address, subject: auth.subject, inspectOnly,
          readAccess: () => access(undefined, false).unwrap(), read: () => read({ id: target.id, identity: auth.cacheIdentity }, false).unwrap(),
          write: expected => write({ id: target.id, expected }).unwrap() });
      });
      if (result && stillCurrent()) setDone(result.already ? 'already' : 'collected');
    } catch (e) {
      if (stillCurrent()) setError(e instanceof CollectionError ? t(`detail.collect.error.${e.code}`)
        : e instanceof LoadKnowledgeError ? t(`detail.apply.error.${e.code}`) : errorMessage(e));
    } finally { if (stillCurrent()) setBusy(false); }
  };
  if (hasBody && !busy && !error && !done) return null;
  return <div data-testid="collect-knowledge">
    {!hasBody && !done && <Alert $tone="warning" style={{ marginTop: 12 }}>
      <p>{t('detail.buy.paid_gone')}</p>
      <Button disabled={!auth.isOwner || busy} loading={busy} loadingText={t('detail.buy.collecting')} onClick={() => void run()} data-testid="buy-collect">{t('detail.buy.collect')}</Button>
    </Alert>}
    {error && <Alert role="alert" $tone="error">{error} <Button variant="text" disabled={busy} onClick={() => void run(true)}>{t('detail.collect.check')}</Button></Alert>}
    {done && <Alert role="status" $tone="success" data-testid="buy-collected">{t(`detail.collect.${done}`)}</Alert>}
  </div>;
}
