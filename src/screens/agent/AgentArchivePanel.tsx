import { useAuth } from '@/auth/AuthContext';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAgentArchivesQuery, useRestoreAgentArchiveMutation, useDeleteAgentArchiveMutation } from '@/api/agentArchives';
import { readAgentArchivePage, readAgentArchiveDownload, type AgentArchiveSummary, type AgentArchiveRestored } from '@/api/agentArchiveEvidence';
import { createAgentArchiveActions, type AgentArchiveAction } from '@/lib/agentArchiveAction';
import { hostedAgentApiErrorOf } from '@/api/hostedAgents';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
const Panel = styled.section`margin-top:24px; min-width:0; p { overflow-wrap:anywhere; }`;
const Record = styled.article`border:1px solid #ddd; border-radius:10px; padding:16px; margin:12px 0; min-width:0; h4 { margin:0; overflow-wrap:anywhere; }`;
const Actions = styled.div`display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; button,a { min-height:44px; }`;
export const agentArchiveScope = (identity: string, node: string | null) => JSON.stringify([identity, node]);
export function AgentArchivePanel() {
  const auth = useAuth();
  const scope = agentArchiveScope(auth.cacheIdentity, auth.address);
  return auth.isSignedIn && !auth.loading ? <ArchiveContent key={scope} principal={scope} /> : null;
}
function ArchiveContent({ principal }: { principal: string }) {
  const auth = useAuth();
  const active = useRef(true), pending = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [controller] = useState(createAgentArchiveActions);
  const { locale } = useT(), ko = locale === 'ko';
  const [offset, setOffset] = useState(0), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [restored, setRestored] = useState<AgentArchiveRestored | null>(null);
  const query = useAgentArchivesQuery({ offset, principal }, { pollingInterval: 30_000 });
  const parsed = readAgentArchivePage(query.currentData, offset);
  const data = !query.isError ? parsed : null;
  const failed = query.isError || query.currentData !== undefined && !parsed;
  const disabled = !!busy || query.isFetching || !data || !auth.principal;
  const [restore] = useRestoreAgentArchiveMutation(), [remove] = useDeleteAgentArchiveMutation();
  useEffect(() => {
    if (data && !query.isFetching && offset > 0 && offset >= data.total) setOffset(Math.max(0, Math.floor((data.total - 1) / 10) * 10));
  }, [data?.total, query.isFetching, offset]);
  const act = async (record: AgentArchiveSummary, action: AgentArchiveAction) => {
    const current = () => active.current && auth.isCurrentAccount();
    if (pending.current || disabled || !current() || !data?.archives.some(row => row.id === record.id)) return;
    if (action === 'delete' && !window.confirm(ko ? '이 보관본을 파일로 저장했는지 확인해 주세요. 서버의 보관본을 영구 삭제할까요?' : 'Check that you saved this archive to a file. Permanently delete the server copy?')) return;
    if (!current()) return;
    pending.current = true; setBusy(record.id); setError(''); setNotice(''); setRestored(null);
    try {
      const result = await controller.run(record, action, {
        owner: auth.principal!, current,
        read: async () => {
          const response = await fetch(`/api/agent-archives/${encodeURIComponent(record.id)}`, { credentials: 'include', cache: 'no-store', redirect: 'error' });
          if (!response.ok) throw { status: response.status, data: await response.json().catch(() => null) };
          return response.json();
        },
        perform: async ({ record: reviewed }) => {
          if (action === 'restore') return restore(reviewed.id).unwrap();
          if (action === 'delete') return remove(reviewed.id).unwrap();
          const response = await fetch(`/api/agent-archives/${encodeURIComponent(reviewed.id)}/export`, { method: 'POST', credentials: 'include', redirect: 'error' });
          return readAgentArchiveDownload(response, reviewed);
        },
      });
      if (!current()) return;
      if (result.kind === 'exported') {
        const url = URL.createObjectURL(result.blob), link = document.createElement('a');
        link.href = url; link.download = `${record.agent}-${record.id}.tar.gz`;
        document.body.appendChild(link);
        try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000); }
        setNotice(ko ? '브라우저에 내려받기를 요청했습니다. 파일이 저장됐는지 확인해 주세요.' : 'Download requested in your browser. Check that the file was saved.');
      } else if (result.kind === 'restored') setRestored(result.receipt);
      else if (result.kind === 'deleted') setNotice(ko ? `${record.name} 보관본을 서버에서 삭제했습니다.` : `Removed the server archive for ${record.name}.`);
      else if (result.kind === 'changed') setError(ko ? '선택한 보관본의 상태를 확인하지 못했습니다. 목록을 새로 불러온 뒤 다시 검토해 주세요.' : 'The selected archive could not be confirmed. Refresh the list and review it again.');
      else if (result.kind === 'unknown') setError(ko ? '요청 결과를 확인하지 못했습니다. 서버에서는 처리됐을 수 있으므로 같은 보관본의 복원·삭제를 반복하지 않습니다. 목록과 에이전트 상태를 확인해 주세요.' : 'The result is unconfirmed; the server may have applied it. Restore and delete remain blocked for this archive. Check the list and agent state.');
      else if (result.kind === 'failed') {
        const failure = hostedAgentApiErrorOf(result.error);
        setError(failure.code === 'project_environment_required'
          ? (ko ? '배포 당시 환경변수 원본을 복구하거나 프로젝트에서 다시 배포하세요.' : 'Recover the original deployed environment or deploy again from the project.')
          : failure.message || (ko ? '작업을 확인하지 못했습니다. 보관본 상태를 다시 불러와 주세요.' : 'Could not confirm this action. Reload the archive state.'));
      }
      if (current()) await query.refetch().unwrap().catch(() => undefined);
    } catch {
      if (current()) setError(ko ? '내려받기 또는 결과 표시를 완료하지 못했습니다. 보관본 상태와 브라우저 다운로드를 확인해 주세요.' : 'Could not finish the download or display its result. Check the archive state and browser downloads.');
    } finally { pending.current = false; if (current()) setBusy(''); }
  };
  return <Panel aria-label={ko ? '삭제한 에이전트 복구' : 'Recover deleted agents'}>
    <h3>{ko ? '삭제한 에이전트' : 'Deleted agents'}</h3>
    <p>{ko ? '보관본에는 비밀 값이 없습니다. 프로젝트 에이전트는 배포 당시 환경변수 원본을 복구하거나 프로젝트에서 다시 배포해야 합니다.' : 'Archives exclude secret values. Project agents need their original deployed environment recovered, or a new deployment from the project.'}</p>
    {error && <Alert $tone="error" role="alert">{error}</Alert>}
    {notice && <p role="status">{notice}</p>}
    {restored && <p role="status">{ko ? '복원 확인' : 'Restore confirmed'}: {restored.agentId} · v{restored.version} <StyledLink to={`/agent/${encodeURIComponent(restored.agentId)}/edit`}>{ko ? '에이전트 설정 열기' : 'Open agent settings'}</StyledLink>{restored.secretsRequired.length > 0 && <> · {ko ? '다시 설정할 비밀 값' : 'Secrets to set again'}: {restored.secretsRequired.join(', ')}</>}</p>}
    {query.isFetching && <p role="status">{data ? (ko ? '보관본 상태 확인 중…' : 'Refreshing archives…') : (ko ? '보관본을 불러오는 중…' : 'Loading archives…')}</p>}
    {failed && <Alert $tone="error" role="alert">{ko ? '보관본을 불러오지 못했습니다.' : 'Could not load archives.'}</Alert>}
    <Button disabled={!!busy || query.isFetching} onClick={() => void query.refetch()}>{ko ? '보관본 새로고침' : 'Refresh archives'}</Button>
    {data?.total === 0 && !query.isFetching && <p>{ko ? '보관된 에이전트가 없습니다.' : 'No retained agents.'}</p>}
    {data?.archives.map(record => <Record key={record.id}>
      <h4>{record.name}</h4><p>{record.agent} · {new Date(record.createdAt).toLocaleString()} · {(record.bytes / 1024 / 1024).toFixed(1)} MB</p>
      {!record.repository && <p>{ko ? '이전 에이전트의 설정만 보관되어 있습니다.' : 'Only this legacy agent’s settings were retained.'}</p>}
      {record.restoredAt !== null && <p>{ko ? '복구 이력' : 'Previously restored'}: {new Date(record.restoredAt).toLocaleString()}</p>}
      {controller.unresolved(record.id) && <p role="alert">{ko ? '결과 확인 필요' : 'Result needs confirmation'} · <StyledLink to={`/agent/${encodeURIComponent(record.agent)}`}>{ko ? '에이전트 상태 확인' : 'Inspect agent state'}</StyledLink></p>}
      <Actions>
        <Button disabled={disabled} onClick={() => void act(record, 'export')}>{ko ? '보관본 내려받기' : 'Download archive'}</Button>
        <Button disabled={disabled || controller.unresolved(record.id)} onClick={() => void act(record, 'restore')}>{ko ? '같은 주소로 복구' : 'Restore same address'}</Button>
        <Button disabled={disabled || controller.unresolved(record.id) || record.exportedAt === null} onClick={() => void act(record, 'delete')}>{ko ? '보관본 영구 삭제' : 'Permanently delete archive'}</Button>
      </Actions>{busy === record.id && <p role="status">{ko ? '처리 중…' : 'Working…'}</p>}
    </Record>)}
    {!!data?.total && <Actions><Button disabled={disabled || offset === 0} onClick={() => setOffset(Math.max(0, offset - 10))}>{ko ? '최신 보관본' : 'Newer archives'}</Button><Button disabled={disabled || offset + 10 >= data.total} onClick={() => setOffset(offset + 10)}>{ko ? '이전 보관본' : 'Older archives'}</Button></Actions>}
  </Panel>;
}
