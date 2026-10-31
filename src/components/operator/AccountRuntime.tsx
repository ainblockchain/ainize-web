import { useEffect, useState } from 'react';
import { errorMessage, useCompleteMutation, useRuntimeQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { accountRuntime, askAccountRuntime, createNodeActionTask, NodeActionError } from '@/lib/accountNodeActions';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, Description, KeyValue, Mono, StyledLink, SubTitle } from '@/components/ui/Misc';
import { MonoBox, Muted, QueryError, Row, Stack, Tip, useElapsed } from './common';

export function AccountRuntime() {
  const { t, tech } = useT(), elapsed = useElapsed(), auth = useAuth();
  const query = useRuntimeQuery({ identity: auth.cacheIdentity });
  const data = !query.isError ? accountRuntime(query.currentData) : null;
  const [prompt, setPrompt] = useState(() => t('op.account.try.default_prompt'));
  return <>
    <SubTitle $mt={56}><Tip tech={tech('apply')}>{t('op.account.runtime')}</Tip></SubTitle>
    <Description>{t('op.account.runtime.desc')}</Description>
    {query.isFetching && !query.currentData ? <CenterProgress /> : !data ? <QueryError error={query.error} what={t('op.account.runtime')} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : <div style={{ marginTop: 16 }}>
      <KeyValue>
        <dt>{t('op.status')}</dt><dd>{data.available ? t('op.account.runtime.available') : `${t('op.account.runtime.unavailable')}${data.error ? ` — ${data.error}` : ''}`}</dd>
        <dt>{t('op.account.runtime.api')}</dt><dd><Mono>{data.api ?? '—'}</Mono></dd>
        <dt>{t('op.account.runtime.model')}</dt><dd>{data.model ?? '—'}</dd>
        <dt><Tip tech="patch hook">{t('op.account.runtime.hook')}</Tip></dt><dd>{t(data.hook ? 'op.account.runtime.connected' : 'op.account.runtime.disconnected')}</dd>
        <dt>{t('op.account.runtime.loaded')}</dt><dd>{data.applied.length ? data.applied.map((id, index) => {
          const layer = data.stack?.[index];
          return <span key={id} style={{ marginRight: 12 }}>{id} {layer ? <Muted>({layer.reason}, {elapsed(layer.applied_at)})</Muted> : <Muted>({t('op.account.runtime.layer_unknown')})</Muted>}</span>;
        }) : <Muted>{t('op.none')}</Muted>}</dd>
      </KeyValue>
      <RuntimeTest key={JSON.stringify([auth.cacheIdentity, data.available, data.api, data.model, data.applied, data.stack?.map(a => [a.patch_id, a.sha256, a.applied_at])])}
        enabled={data.available && !!data.model?.trim() && !query.isFetching} prompt={prompt} setPrompt={setPrompt} />
    </div>}
  </>;
}

function RuntimeTest({ enabled, prompt, setPrompt }: { enabled: boolean; prompt: string; setPrompt: (value: string) => void }) {
  const { t, term, help } = useT();
  const auth = useAuth(), active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const [task] = useState(createNodeActionTask), [complete] = useCompleteMutation();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{ prompt: string; text: string } | null>(null);
  useEffect(() => () => task.abandon(), [task]);
  const ask = async () => {
    if (!enabled || task.pending() || !isCurrent()) return;
    setBusy(true); setError(null); setAnswer(null);
    try {
      const result = await task.run(isCurrent, current => askAccountRuntime(prompt, { current, send: body => complete(body).unwrap() }));
      if (result && isCurrent()) setAnswer(result);
    } catch (err) { if (isCurrent()) setError(err instanceof NodeActionError ? t(`op.account.node_error.${err.code}`) : errorMessage(err)); }
    finally { if (isCurrent()) setBusy(false); }
  };
  const [before, after] = t('op.account.runtime.try.desc', { link: '|' }).split('|');
  return <Stack $gap={12} style={{ marginTop: 20, maxWidth: 640 }}>
    <strong style={{ fontSize: 14 }}>{t('op.account.runtime.try')}</strong>
    <Muted>{before}<StyledLink to="/chat" title={help('liveTest')}>{term('liveTest')}</StyledLink>{after}</Muted>
    <Row $wrap $gap={12} $align="flex-end">
      <TextField label={t('op.account.runtime.prompt')} value={prompt} maxLength={2000} onChange={e => setPrompt(e.target.value)} />
      <Button type="button" disabled={!enabled || !prompt.trim() || prompt.length > 2000} loading={busy} loadingText={t('op.account.runtime.asking')} onClick={() => void ask()}>{t('op.account.runtime.ask')}</Button>
    </Row>
    <Muted>{t('op.account.runtime.limit')}</Muted>
    {error && <Alert role="alert" $tone="error">{error}</Alert>}
    {answer && <MonoBox data-testid="runtime-answer"><span style={{ color: '#8d8d8f' }}>{answer.prompt}</span><strong>{answer.text || t('op.account.runtime.empty_answer')}</strong></MonoBox>}
  </Stack>;
}
