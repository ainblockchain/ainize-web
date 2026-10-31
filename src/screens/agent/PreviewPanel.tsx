import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateAgentPreviewMutation, useDeleteAgentPreviewMutation, useChatAgentPreviewMutation, useAgentPreviewQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { readSurfaces } from '@/components/a2ui/surface';
import { a2uiActionParts } from '@/lib/a2uiAction';
import { readA2aReply, a2aReplyText } from '@/lib/a2aReply';
import { a2aImagesOf } from '@/lib/a2aFileParts';
import { previewLifecycle } from '@/lib/previewLifecycle';
import { Button } from '@/components/ui/Button';
import { Alert, Field, FieldLabel, Input } from '@/components/ui/Form';
import { Description } from '@/components/ui/Misc';
import { A2UISurface, readSurface } from '@/components/a2ui/A2UISurface';
import { useT } from '@/i18n';

export function PreviewPanel({ agentId, refName }: { agentId: string; refName: string }) {
  const { t } = useT();
  const auth = useAuth();
  const active = useActiveView();
  const [create, creating] = useCreateAgentPreviewMutation();
  const [remove, removing] = useDeleteAgentPreviewMutation();
  const [chat, chatting] = useChatAgentPreviewMutation();
  const [id, setId] = useState('');
  const [message, setMessage] = useState('');
  const [context, setContext] = useState<string | undefined>();
  const [taskId, setTaskId] = useState<string | undefined>();
  const [reply, setReply] = useState<{ parts?: Parameters<typeof readSurface>[0]; contextId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<ReturnType<typeof chat> | null>(null);
  const lifecycle = useRef<ReturnType<typeof previewLifecycle> | null>(null);
  useEffect(() => {
    const owned = previewLifecycle({
    create: async () => {
      const response = await create({ id: agentId, ref: refName }).unwrap();
      if (!response.preview?.id || response.preview.agent !== agentId) throw new Error('Unexpected preview');
      return response.preview;
    },
    remove: async (previewId) => {
      try { await remove(previewId).unwrap(); }
      catch (error) { if ((error as { status?: unknown })?.status !== 404) throw error; }
    },
    currentAccount: auth.isCurrentAccount,
    onCreated: (preview) => { setId(preview.id); setReply(null); setContext(undefined); setTaskId(undefined); },
    onStopped: () => { setId(''); setReply(null); setContext(undefined); setTaskId(undefined); },
    });
    lifecycle.current = owned;
    return () => { pending.current?.abort(); owned.dispose(); };
  }, []);
  const query = useAgentPreviewQuery({ id, identity: auth.cacheIdentity }, { skip: !id, pollingInterval: 2000 });
  const candidate = query.error ? null : query.currentData?.preview;
  const preview = candidate?.id === id && candidate.agent === agentId ? candidate : null;
  const surfaces = useMemo(() => readSurfaces(reply?.parts ?? []), [reply]);
  const expired = !!query.error && 'status' in query.error && query.error.status === 404;
  useEffect(() => {
    if (expired) { lifecycle.current?.expired(); setError(t('agentGit.preview_expired')); }
  }, [expired]);
  const busy = creating.isLoading || removing.isLoading || chatting.isLoading;
  const report = (error: unknown) => {
    if (active()) setError(error instanceof Error ? error.message : String((error as { data?: { error?: { message?: string } } })?.data?.error?.message ?? error));
  };
  const start = async () => { setError(null); try { await lifecycle.current?.start(); } catch (error) { report(error); } };
  const stop = async () => {
    pending.current?.abort(); pending.current = null; setError(null);
    try { await lifecycle.current?.stop(); } catch (error) { report(error); }
  };
  const send = async (actionParts?: unknown[]) => {
    if (pending.current || busy || (!actionParts && !message.trim()) || preview?.status !== 'ready' || !auth.isCurrentAccount()) return;
    setError(null);
    const request = chat({ id, body: { jsonrpc: '2.0', id: crypto.randomUUID(), method: 'message/send', params: { message: { kind: 'message', role: 'user', messageId: crypto.randomUUID(), ...(context ? { contextId: context } : {}), ...(taskId ? { taskId } : {}), parts: actionParts ?? [{ kind: 'text', text: message }] }, configuration: { blocking: true } } } });
    pending.current = request;
    try {
      const body = await request.unwrap() as { result?: { parts?: Parameters<typeof readSurface>[0]; contextId?: string }; error?: { message?: string } };
      if (!active() || pending.current !== request || !auth.isCurrentAccount()) return;
      if (body.error) throw new Error(body.error.message ?? 'RPC error');
      if (!body.result) throw new Error(t('agentPage.live.invalid_response'));
      const parsed = readA2aReply(body.result);
      if (!parsed) throw new Error(t('agentPage.live.invalid_response'));
      setContext(parsed.contextId ?? context); setTaskId(parsed.taskId);
      if (parsed.error) throw new Error(parsed.error);
      setReply({ parts: (parsed.pending && !parsed.parts.length ? [{ kind: 'text', text: t('agentPage.live.pending') }] : parsed.parts) as never, contextId: parsed.contextId }); setMessage('');
    } catch (error) {
      if (active() && pending.current === request) {
        if ((error as { name?: string }).name === 'AbortError') setError(t('agentGit.preview_stopped'));
        else report(error);
      }
    } finally { if (pending.current === request) pending.current = null; }
  };
  return <section style={{ marginTop: 16, minWidth: 0 }}>
    <Button loading={creating.isLoading} disabled={busy || !!id} onClick={() => void start()}>{t('agentGit.preview_create')}</Button>
    <Description>{t('agentGit.preview_help')}</Description>
    {id && <>
      {query.error ? <Alert role="alert" $tone="error">
        {t(expired ? 'agentGit.preview_expired' : 'agentGit.read_failed')}{' '}
        {!expired && <Button disabled={query.isFetching} onClick={() => void query.refetch()}>{t('aincode.retry')}</Button>}
      </Alert> : !preview && !query.isFetching ? <Alert role="alert" $tone="error">{t('agentGit.read_failed')} <Button onClick={() => void query.refetch()}>{t('aincode.retry')}</Button></Alert>
        : preview?.status === 'error' ? <Alert $tone="error">{preview.error}</Alert>
          : preview?.status !== 'ready' ? <Description role="status">{t('agentGit.preview_building')}</Description> : <>
            <code>{preview.commit.slice(0, 12)} · {new Date(preview.expiresAt).toLocaleTimeString()}</code>
            <Field><FieldLabel htmlFor="preview-message">{t('agentGit.preview_message')}</FieldLabel><Input id="preview-message" as="textarea" value={message} maxLength={20000} disabled={busy} onChange={(event) => setMessage(event.target.value)} /></Field>
            <Button loading={chatting.isLoading} disabled={busy || !message.trim()} onClick={() => void send()}>{t('agentGit.preview_send')}</Button>
            {chatting.isLoading && <Button onClick={() => pending.current?.abort()}>{t('agentGit.preview_cancel')}</Button>}
            {reply && <div aria-live="polite"><Description style={{ whiteSpace: 'pre-wrap' }}>{a2aReplyText(reply.parts ?? [])}</Description>{a2aImagesOf(reply.parts).map((image, index) => <img key={index} src={image.src} alt={image.name} style={{ maxWidth: '100%' }} />)}{surfaces.map((surface) => <A2UISurface key={surface.surfaceId} surface={surface} busy={busy} onAction={(name, context, source) => void send(a2uiActionParts(name, context, source))} />)}</div>}
          </>}
      <Button loading={removing.isLoading} disabled={creating.isLoading || removing.isLoading} onClick={() => void stop()}>{t('agentGit.preview_stop')}</Button>
    </>}
    {error && <Alert $tone="error">{error}</Alert>}
  </section>;
}
