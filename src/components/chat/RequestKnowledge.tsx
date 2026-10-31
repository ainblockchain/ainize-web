import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { api } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { KnowledgeDemandError, requestKnowledge, type KnowledgeDemandStatus, type KnowledgeDemandTarget } from '@/lib/knowledgeDemand';
import { Button } from '@/components/ui/Button';

const Note = styled.span`display: block; width: 100%; font-size: 11px; line-height: 1.4; color: ${(p) => p.theme.color.GREY}; overflow-wrap: anywhere;`;
export function RequestKnowledge({ id, author, requests }: { id: string; author: string; requests: number }) {
  const auth = useAuth();
  return <RequestView key={JSON.stringify([auth.cacheIdentity, auth.address, id, author])} id={id} author={author} requests={requests} />;
}
export function RequestKnowledgeFeedback({ status, requests }: { status: KnowledgeDemandStatus | null; requests: number }) {
  const { t } = useT(), count = status?.requests ?? requests;
  return <>
    {Number.isSafeInteger(count) && count > 0 && <Note data-testid="picker-requests">{t('chat.picker.asked', { n: count }, count)}</Note>}
    {status && <Note role="status" data-testid="knowledge-request-state">{t(status.requested
      ? status.scope === 'network' ? 'chat.picker.request.networkDone' : 'chat.picker.asked_done'
      : status.available ? 'chat.picker.request.available' : 'chat.picker.request.absent')}</Note>}
  </>;
}
function RequestView({ id, author, requests }: { id: string; author: string; requests: number }) {
  const auth = useAuth(), active = useActiveView(), { t } = useT();
  const [task] = useState(createNodeActionTask);
  useEffect(() => () => task.abandon(), [task]);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<KnowledgeDemandStatus | null>(null), [intent, setIntent] = useState<KnowledgeDemandTarget | null>(null);
  const [read] = api.useLazyKnowledgeDemandQuery(), [write] = api.useRequestPatchMutation();
  const inspect = !!intent || !!status && !status.can_request;
  const run = async () => {
    const current = () => active() && auth.isCurrentAccount();
    if (auth.loading || !auth.address || !current() || task.pending()) return;
    setBusy(true); setError(null); setStatus(null); let stillCurrent = current;
    try {
      const result = await task.run(current, async check => {
        stillCurrent = check;
        return requestKnowledge({ id, author }, { current: check, node: auth.address, actor: auth.principal, inspectOnly: inspect,
          expected: intent ?? undefined, intent: target => setIntent(target),
          read: () => read({ id, identity: auth.cacheIdentity }, false).unwrap(), write: expected => write({ id, expected }).unwrap() });
      });
      if (result && stillCurrent()) { setStatus(result); setIntent(null); }
    } catch (e) {
      if (stillCurrent()) {
        // The versioned endpoint explicitly refused before logging. A later user click can read a new target.
        if (e instanceof KnowledgeDemandError && e.code === 'changed') setIntent(null);
        setError(t(`chat.picker.request.error.${e instanceof KnowledgeDemandError ? e.code : 'read'}`));
      }
    } finally { if (stillCurrent()) setBusy(false); }
  };
  return <>
    <RequestKnowledgeFeedback status={status} requests={requests} />
    <Button type="button" size="small" disabled={auth.loading || !auth.address || busy}
      style={{ whiteSpace: 'normal', maxWidth: '100%', textAlign: 'left' }} title={t(inspect ? 'chat.picker.request.inspectEffect' : 'chat.picker.request.effect')} onClick={() => void run()} data-testid="knowledge-request">
      {t(busy ? 'chat.picker.request.checking' : inspect ? 'chat.picker.request.inspect'
        : status?.available ? 'chat.picker.request.available' : 'chat.picker.ask')}
    </Button>
    {error && <Note role="alert">{error}</Note>}
  </>;
}
