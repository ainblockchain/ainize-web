import { useEffect, useState, type FormEvent } from 'react';
import { errorMessage, useAddPeerMutation, useNodesQuery, useRemovePeerMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { useT } from '@/i18n';
import { accountPeers, changeAccountPeer, createNodeActionTask, NodeActionError, peerEndpoint } from '@/lib/accountNodeActions';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, Description, StyledLink, SubTitle } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableRowEmpty, TableWrapper } from '@/components/ui/Table';
import { shortAddr } from '@/utils/format';
import { QueryError, Row, Tip, useElapsed } from './common';

export function AccountPeers() {
  const { t, tech } = useT(), elapsed = useElapsed();
  const auth = useAuth(), active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const query = useNodesQuery({ identity: auth.cacheIdentity }, { pollingInterval: 15_000 });
  const data = !query.isError ? accountPeers(query.currentData) : null;
  const [add] = useAddPeerMutation(), [remove] = useRemovePeerMutation();
  const [endpoint, setEndpoint] = useState('');
  const [task] = useState(createNodeActionTask);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  useEffect(() => () => task.abandon(), [task]);
  const ready = !!data && !query.isFetching;
  const change = async (kind: 'add' | 'remove', endpoint: string) => {
    if (!ready || task.pending() || !isCurrent()) return;
    setBusy(kind === 'add' ? 'add' : endpoint); setError(null); setNotice(null);
    try {
      const result = await task.run(isCurrent, current => changeAccountPeer(kind, endpoint, {
        current, read: () => query.refetch().unwrap(), write: endpoint => (kind === 'add' ? add({ endpoint }) : remove({ endpoint })).unwrap(),
      }));
      if (!result || !isCurrent()) return;
      if (kind === 'add') setEndpoint('');
      setNotice(t(result.already ? 'op.account.peer.already' : kind === 'add' ? 'op.account.peer.added' : 'op.account.peer.blocked', { endpoint: result.endpoint }));
    } catch (err) { if (isCurrent()) setError(err instanceof NodeActionError ? t(`op.account.node_error.${err.code}`) : errorMessage(err)); }
    finally { if (isCurrent()) setBusy(null); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); void change('add', endpoint); };
  const [before, after] = t('op.account.peers.desc', { link: '|' }).split('|');
  return <>
    <SubTitle $mt={56}><Tip tech={tech('node')}>{t('op.account.peers')}</Tip></SubTitle>
    <Description>{before}<StyledLink to="/network">{t('op.account.peers.network')}</StyledLink>{after}</Description>
    {query.isFetching && !query.currentData ? <CenterProgress /> : !data ? <QueryError error={query.error} what={t('op.account.peers')} onRetry={() => void query.refetch()} retrying={query.isFetching} /> :
      <TableWrapper style={{ marginTop: 12 }}><Table>
        <TableHeader><TableRow><TableHead $align="left">{t('op.account.peers.endpoint')}</TableHead><TableHead>{t('op.name')}</TableHead><TableHead>{t('op.address')}</TableHead><TableHead>{t('op.roles')}</TableHead><TableHead>{t('op.account.peers.lastseen')}</TableHead><TableHead>{t('op.account.peers.failures')}</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {data.peers.map((p, index) => <TableRow key={p.endpoint ?? `${p.address ?? 'hidden'}-${index}`}>
            <TableData $align="left" $mono>{p.endpoint ?? '—'}</TableData><TableData>{p.info?.name ?? '—'}</TableData>
            <TableData title={p.address ?? ''}>{shortAddr(p.address)}</TableData>
            <TableData>{p.info?.roles.map(role => { const key = `op.role.${role}`; return t(key) === key ? role : t(key); }).join(', ') ?? '—'}</TableData>
            <TableData>{p.last_seen ? elapsed(p.last_seen) : t('op.never')}</TableData><TableData $color={p.failures > 0 ? '#e6173e' : undefined}>{p.failures}</TableData>
            <TableData><Button type="button" size="small" variant="text" color="secondary" disabled={!p.endpoint || !ready || !!busy} loading={!!p.endpoint && busy === p.endpoint} onClick={() => p.endpoint && void change('remove', p.endpoint)}>{t('op.account.peer.block')}</Button></TableData>
          </TableRow>)}
          {data.peers.length === 0 && <TableRowEmpty $height={72}><td colSpan={7}>{t('op.account.peers.empty')}</td></TableRowEmpty>}
        </TableBody>
      </Table></TableWrapper>}
    <form onSubmit={submit} style={{ marginTop: 16, maxWidth: 560 }} aria-busy={!!busy}>
      <Row $wrap $gap={12} $align="flex-end">
        <TextField label={t('op.account.peers.add')} placeholder="http://127.0.0.1:3403" value={endpoint} helper={endpoint && !peerEndpoint(endpoint) ? t('op.account.node_error.endpoint') : undefined} disabled={!!busy} onChange={e => { if (!task.pending()) { setEndpoint(e.target.value); setError(null); setNotice(null); } }} />
        <Button type="submit" disabled={!ready || !peerEndpoint(endpoint) || !!busy} loading={busy === 'add'}>{t('op.add')}</Button>
      </Row>
    </form>
    {error && <Alert role="alert" $tone="error" style={{ marginTop: 12 }}>{error}</Alert>}
    {notice && <Alert role="status" $tone="info" style={{ marginTop: 12 }}>{notice}</Alert>}
  </>;
}
