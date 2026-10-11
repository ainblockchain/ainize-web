import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useAgentArchivesQuery, useRestoreAgentArchiveMutation, useDeleteAgentArchiveMutation } from '@/api/agentArchives';
import type { AgentArchiveSummary } from '@/api/agentArchives';
import { hostedAgentApiErrorOf } from '@/api/hostedAgents';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
const Panel = styled.section`margin-top:24px; min-width:0; p { overflow-wrap:anywhere; }`;
const Record = styled.article`border:1px solid #ddd; border-radius:10px; padding:16px; margin:12px 0; min-width:0; h4 { margin:0; overflow-wrap:anywhere; }`;
const Actions = styled.div`display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; button,a { min-height:44px; }`;
export function AgentArchivePanel() {
  const { locale } = useT(), ko = locale === 'ko';
  const [offset, setOffset] = useState(0), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [restored, setRestored] = useState<{ agentId: string; secretsRequired: string[] } | null>(null);
  const query = useAgentArchivesQuery(offset, { pollingInterval: 30_000 });
  const [restore] = useRestoreAgentArchiveMutation(), [remove] = useDeleteAgentArchiveMutation();
  useEffect(() => { if (query.currentData && offset > 0 && offset >= query.currentData.total) setOffset(Math.max(0, offset - 10)); }, [query.currentData, offset]);
  const act = async (record: AgentArchiveSummary, action: 'export' | 'restore' | 'delete') => {
    if (action === 'delete' && !window.confirm(ko ? '내려받은 보관본을 서버에서 영구 삭제할까요?' : 'Permanently remove this downloaded archive from the server?')) return;
    setBusy(record.id); setError('');
    try {
      if (action === 'export') {
        const response = await fetch(`/api/agent-archives/${encodeURIComponent(record.id)}/export`, { method: 'POST', credentials: 'include' });
        if (!response.ok) { const data: unknown = await response.json().catch(() => null); throw { data, status: response.status }; }
        const blob = await response.blob(), url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `${record.agent}-${record.id}.tar.gz`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000); await query.refetch();
      } else if (action === 'restore') setRestored(await restore(record.id).unwrap());
      else await remove(record.id).unwrap();
    } catch (err) { const failure = hostedAgentApiErrorOf(err); setError(failure.message || (ko ? '작업을 완료하지 못했습니다. 다시 시도해 주세요.' : 'Could not complete this action. Please retry.')); }
    finally { setBusy(''); }
  };
  return <Panel aria-label={ko ? '삭제한 에이전트 복구' : 'Recover deleted agents'}>
    <h3>{ko ? '삭제한 에이전트' : 'Deleted agents'}</h3>
    <p>{ko ? '보관된 이력으로 같은 주소에 복구합니다. 비밀 값은 다시 설정해야 합니다. 영구 삭제 전에 보관본을 내려받아 주세요.' : 'Restore the same address from retained history. Set secret values again after recovery. Download an archive before permanently removing it.'}</p>
    {error && <Alert $tone="error" role="alert">{error}</Alert>}
    {restored && <p role="status">{ko ? '복구되었습니다.' : 'Restored.'} <StyledLink to={`/agent/${encodeURIComponent(restored.agentId)}/edit`}>{ko ? '에이전트 설정 열기' : 'Open agent settings'}</StyledLink>{restored.secretsRequired.length > 0 && <> · {ko ? '다시 설정할 비밀 값' : 'Secrets to set again'}: {restored.secretsRequired.join(', ')}</>}</p>}
    {query.isLoading && <p role="status">{ko ? '보관본을 불러오는 중…' : 'Loading archives…'}</p>}
    {query.isError && <Alert $tone="error">{ko ? '보관본을 불러오지 못했습니다.' : 'Could not load archives.'} <Button onClick={() => void query.refetch()}>{ko ? '다시 시도' : 'Retry'}</Button></Alert>}
    {query.currentData?.total === 0 && <p>{ko ? '보관된 에이전트가 없습니다.' : 'No retained agents.'}</p>}
    {query.currentData?.archives.map((record) => <Record key={record.id}>
      <h4>{record.name}</h4><p>{record.agent} · {new Date(record.createdAt).toLocaleString()} · {(record.bytes / 1024 / 1024).toFixed(1)} MB</p>
      {!record.repository && <p>{ko ? '이전 에이전트의 설정만 보관되어 있습니다.' : 'Only this legacy agent’s settings were retained.'}</p>}
      {record.restoredAt && <p>{ko ? '복구 이력' : 'Previously restored'}: {new Date(record.restoredAt).toLocaleString()}</p>}
      <Actions>
        <Button disabled={!!busy} onClick={() => void act(record, 'export')}>{ko ? '보관본 내려받기' : 'Download archive'}</Button>
        <Button disabled={!!busy} onClick={() => void act(record, 'restore')}>{ko ? '같은 주소로 복구' : 'Restore same address'}</Button>
        <Button disabled={!!busy || !record.exportedAt} onClick={() => void act(record, 'delete')}>{ko ? '내려받은 보관본 삭제' : 'Remove downloaded archive'}</Button>
      </Actions>{busy === record.id && <p role="status">{ko ? '처리 중…' : 'Working…'}</p>}
    </Record>)}
    {!!query.currentData?.total && <Actions><Button disabled={!!busy || offset === 0} onClick={() => setOffset(Math.max(0, offset - 10))}>{ko ? '최신 보관본' : 'Newer archives'}</Button><Button disabled={!!busy || offset + 10 >= query.currentData.total} onClick={() => setOffset(offset + 10)}>{ko ? '이전 보관본' : 'Older archives'}</Button></Actions>}
  </Panel>;
}
