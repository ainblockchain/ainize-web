import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { errorMessage, useAddOwnerMutation, useBindingsQuery, useOwnersQuery, useRemoveBindingMutation, useRemoveOwnerMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { AccessActionError, accountBindings, accountOwners, changeAccountOwner, endAccountBinding, ownerRemovalReason, sameAccountAddress, validAccountAddress } from '@/lib/accountAccess';
import { createNodeActionTask } from '@/lib/accountNodeActions';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, KeyValue, Mono, SubTitle } from '@/components/ui/Misc';
import { dateTime, shortAddr } from '@/utils/format';
import { Muted, QueryError, Row } from './common';

export function AccountOwners() {
  const { t } = useT(), auth = useAuth(), active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const query = useOwnersQuery({ identity: auth.cacheIdentity });
  const rows = !query.isError ? accountOwners(query.currentData) : null;
  const [grant] = useAddOwnerMutation(), [revoke] = useRemoveOwnerMutation();
  const [task] = useState(createNodeActionTask), [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(''), [notice, setNotice] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => () => task.abandon(), [task]);
  const ready = !!rows && !query.isFetching;
  const change = async (kind: 'add' | 'remove', target: string) => {
    if (!ready || task.pending() || !isCurrent()) return;
    setBusy(true); setNotice(null); setError(null);
    try {
      const result = await task.run(isCurrent, current => changeAccountOwner(kind, target, auth.subject, {
        current, read: () => query.refetch().unwrap(), write: address => (kind === 'add' ? grant({ address }) : revoke(address)).unwrap(),
      }));
      if (!result || !isCurrent()) return;
      if (kind === 'add') setDraft('');
      setNotice(t(kind === 'remove' ? 'op.account.operators.removed' : result.already ? 'op.account.operators.already' : 'op.account.operators.added', { addr: result.address, n: result.ended }));
    } catch (err) { if (isCurrent()) setError(err instanceof AccessActionError ? t(`op.account.access_error.${err.code}`) : errorMessage(err)); }
    finally { if (isCurrent()) setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void change('add', draft); };
  return <>
    <SubTitle $mt={56}>{t('op.account.operators.title')}</SubTitle><Description>{t('op.account.operators.desc')}</Description>
    {query.isFetching && !query.currentData ? <CenterProgress /> : !rows ? <QueryError error={query.error} what={t('op.account.operators.title')} onRetry={() => void query.refetch()} retrying={query.isFetching} /> :
      <KeyValue data-testid="operators">{rows.map(row => {
        const reason = ownerRemovalReason(row, auth.subject);
        return <Fragment key={row.address.toLowerCase()}>
          <dt>{t(row.source === 'node' ? 'op.account.operators.own' : row.source === 'config' ? 'op.account.operators.src_config' : 'op.account.operators.src_granted', { by: shortAddr(row.added_by, 6) || '—' })}</dt>
          <dd><Mono>{row.address}</Mono>{' '}<CopyButton text={row.address} label={t('common.copy')} />
            {reason === null ? <Button type="button" variant="text" size="small" disabled={!ready || busy} aria-label={`${t('op.account.operators.remove')} ${row.address}`} onClick={() => void change('remove', row.address)} style={{ marginLeft: 10 }}>{t('op.account.operators.remove')}</Button>
              : row.source === 'granted' && <Muted style={{ display: 'block' }}>{t(`op.account.access_error.${reason}`)}</Muted>}
          </dd>
        </Fragment>;
      })}</KeyValue>}
    <Row as="form" onSubmit={submit} $wrap $gap={10} $align="flex-end" style={{ marginTop: 14 }} aria-busy={busy}>
      <TextField label={t('op.account.operators.add')} value={draft} disabled={busy} onChange={e => { if (!task.pending()) { setDraft(e.target.value); setError(null); setNotice(null); } }} placeholder={t('op.account.operators.add_ph')} style={{ maxWidth: 420 }} />
      <Button type="submit" disabled={!ready || busy || !validAccountAddress(draft.trim())} loading={busy}>{t('op.account.operators.add')}</Button>
    </Row>
    {notice && <Muted role="status" style={{ display: 'block', marginTop: 10 }}>{notice}</Muted>}
    {error && <Alert role="alert" $tone="error" style={{ marginTop: 10 }}>{error}</Alert>}
    <Muted style={{ display: 'block', marginTop: 10 }}>{t('op.account.operators.how')}</Muted>
  </>;
}

export function AccountBindings() {
  const { t } = useT(), auth = useAuth(), active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const query = useBindingsQuery({ identity: auth.cacheIdentity });
  const data = !query.isError ? accountBindings(query.currentData, auth.subject) : null;
  const [remove] = useRemoveBindingMutation(), [task] = useState(createNodeActionTask);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => () => task.abandon(), [task]);
  const ready = !!data && !query.isFetching;
  const end = async (target: string) => {
    if (!ready || task.pending() || !isCurrent()) return;
    setBusy(true); setNotice(null); setError(null);
    try {
      const result = await task.run(isCurrent, current => endAccountBinding(target, auth.subject, { current, read: () => query.refetch().unwrap(), write: delegate => remove(delegate).unwrap() }));
      if (!result || !isCurrent()) return;
      setNotice(t('op.account.bindings.ended', { addr: result.delegate, n: result.ended }));
      if (result.self) void auth.refresh();
    } catch (err) { if (isCurrent()) setError(err instanceof AccessActionError ? t(`op.account.access_error.${err.code}`) : errorMessage(err)); }
    finally { if (isCurrent()) setBusy(false); }
  };
  return <>
    <SubTitle $mt={56}>{t('op.account.bindings.title')}</SubTitle><Description>{t('op.account.bindings.desc')}</Description>
    {query.isFetching && !query.currentData ? <CenterProgress /> : !data ? <QueryError error={query.error} what={t('op.account.bindings.title')} onRetry={() => void query.refetch()} retrying={query.isFetching} /> : <>
      {data.bindings.length === 0 && <Muted style={{ display: 'block' }}>{t('op.account.bindings.none')}</Muted>}
      <KeyValue data-testid="bindings">{data.bindings.map(binding => {
        const self = sameAccountAddress(data.via, binding.delegate);
        return <Fragment key={binding.delegate.toLowerCase()}>
          <dt>{binding.label || shortAddr(binding.delegate, 6)}</dt><dd>
            <Mono>{binding.delegate}</Mono>{self && <Muted style={{ marginLeft: 8 }}>({t('op.account.bindings.this')})</Muted>}
            <Muted style={{ display: 'block' }}>{t('op.account.bindings.since', { when: dateTime(binding.created_at) })}{' · '}{binding.last_seen_at ? t('op.account.bindings.seen', { when: dateTime(binding.last_seen_at) }) : t('op.account.bindings.never')}</Muted>
            {self && <Muted style={{ display: 'block' }}>{t('op.account.bindings.self_note')}</Muted>}
            <Button type="button" variant="text" size="small" disabled={!ready || busy} aria-label={`${t(self ? 'op.account.bindings.end_self' : 'op.account.bindings.end')} ${binding.delegate}`} onClick={() => void end(binding.delegate)}>{t(self ? 'op.account.bindings.end_self' : 'op.account.bindings.end')}</Button>
          </dd>
        </Fragment>;
      })}</KeyValue>
    </>}
    {notice && <Muted role="status" style={{ display: 'block', marginTop: 10 }}>{notice}</Muted>}
    {error && <Alert role="alert" $tone="error" style={{ marginTop: 10 }}>{error}</Alert>}
  </>;
}
