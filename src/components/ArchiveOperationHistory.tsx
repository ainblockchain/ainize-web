import { useState } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';
import { Button } from './ui/Button';
import { Alert } from './ui/Form';
import { StyledLink } from './ui/Misc';
import { readAgentArchiveRestore } from '@/api/agentArchiveEvidence';
import { archiveOperationUnresolved, readArchiveOperationHistory, type ArchiveContext, type ArchiveOperationJob } from '@/lib/agentArchiveOperation';

const History = styled.details`margin:16px 0; min-width:0; overflow-wrap:anywhere;
  summary { cursor:pointer; min-height:44px; display:flex; align-items:center; gap:8px; }
  summary::before { content:'▸'; flex-shrink:0; } summary::-webkit-details-marker { display:none; }
  &[open] > summary::before, details[open] > summary::before { transform:rotate(90deg); }
  button,a { min-height:44px; max-width:100%; white-space:normal; }
  a { display:inline-flex; align-items:center; }
  article { border-top:1px solid #e2e4ea; padding:8px 0; }
  dl { display:grid; grid-template-columns:auto minmax(0,1fr); gap:4px 12px; }
  dd { margin:0; } nav { display:flex; gap:8px; flex-wrap:wrap; }
`;
const stateLabel = (record: ArchiveOperationJob, ko: boolean) => ({
  running: ko ? '처리 중' : 'Processing',
  interrupted: ko ? '중단됨 · 결과 확인 필요' : 'Interrupted · confirmation needed',
  unknown: ko ? '결과 확인 필요' : 'Outcome unconfirmed',
  done: record.action === 'restore' ? (ko ? '복원 완료 기록' : 'Recorded restore completion') : (ko ? '삭제 완료 기록' : 'Recorded deletion completion'),
  refused: record.error?.code === 'archive_operation_cancelled' ? (ko ? '접수 전 취소' : 'Cancelled before admission') : (ko ? '거절됨' : 'Refused'),
})[record.state];

/** Historical receipts are evidence of this request, not the agent's current runtime. No mutation controls. */
export function ArchiveOperationHistoryDetail({ record }: { record: ArchiveOperationJob }) {
  const { locale } = useT(), ko = locale === 'ko';
  const restored = record.state === 'done' && record.action === 'restore'
    ? readAgentArchiveRestore(record.result, { record: { id: record.archiveId, agent: record.agentId }, version: record.version }) : null;
  return <div>
    <dl>
      <dt>{ko ? '요청' : 'Request'}</dt><dd>{record.id}</dd>
      <dt>{ko ? '보관본' : 'Archive'}</dt><dd>{record.archiveId}</dd>
      <dt>{ko ? '기록 시각' : 'Recorded at'}</dt><dd>{new Date(record.updatedAt).toLocaleString()}</dd>
    </dl>
    <p role="status">{stateLabel(record, ko)}</p>
    {restored && <p>v{restored.version} · {restored.commit}
      {restored.secretsRequired.length > 0 && <> · {ko ? '복원 당시 재설정이 필요했던 비밀 값' : 'Secrets requiring setup at restoration'}: {restored.secretsRequired.join(', ')}</>}
    </p>}
    {record.state === 'refused' && <p>{record.error?.code === 'archive_operation_cancelled'
      ? (ko ? '이 요청은 나중에 도착해도 실행되지 않습니다.' : 'A delayed submission of this request will not execute.')
      : record.error?.code === 'project_environment_required'
        ? (ko ? '배포 당시 환경변수 원본을 복구하거나 프로젝트에서 다시 배포하세요.' : 'Recover the original deployed environment or deploy again from the project.')
        : record.error?.message}</p>}
    {['unknown', 'interrupted'].includes(record.state) && <p>{ko ? '같은 작업을 다시 실행하지 마세요. 서버 운영자가 이 요청의 실제 처리 상태를 확인해야 합니다.' : 'Do not repeat this action. The server operator needs to reconcile the effects of this request.'}</p>}
    <StyledLink to={`/agent/${encodeURIComponent(record.agentId)}`}>{ko ? '현재 에이전트 상태 보기' : 'Inspect current agent state'}</StyledLink>
  </div>;
}

export function ArchiveOperationHistory({ context, data, loading, failed, refresh }: {
  context: ArchiveContext; data: unknown; loading: boolean; failed: boolean; refresh: () => void;
}) {
  const { locale } = useT(), ko = locale === 'ko';
  const [page, setPage] = useState(0);
  const history = !failed ? readArchiveOperationHistory(data, context) : null;
  const error = failed || data !== undefined && !history;
  const count = history?.operations.length ?? 0, pages = Math.max(1, Math.ceil(count / 10));
  const unresolved = history?.operations.filter(archiveOperationUnresolved).length ?? 0;
  // A refreshed list shrinking below the selected page does not choose another page silently.
  const rows = history?.operations.slice(page * 10, (page + 1) * 10) ?? [];
  return <History>
    <summary>{ko ? '복원·삭제 요청 기록' : 'Restore and deletion requests'}
      {error ? (ko ? ' · 확인 실패' : ' · unavailable') : loading ? (ko ? ' · 확인 중' : ' · checking') : unresolved > 0 ? (ko ? ` · ${unresolved}건 확인 필요` : ` · ${unresolved} need confirmation`) : ''}</summary>
    {loading && <p role="status">{ko ? '요청 기록 확인 중…' : 'Checking request history…'}</p>}
    {error && <Alert role="alert" $tone="error">{ko ? '요청 기록을 확인하지 못했습니다.' : 'Could not verify request history.'}</Alert>}
    <Button disabled={loading} onClick={refresh}>{ko ? '요청 기록 새로고침' : 'Refresh request history'}</Button>
    {history && !loading && count === 0 && <p>{ko ? '서버에 기록된 복원·삭제 요청이 없습니다.' : 'No restore or deletion requests recorded on this server.'}</p>}
    {history && count > 0 && <>
      {rows.map(record => <article key={record.id}><details>
        <summary>{record.agentId} · {record.action === 'restore' ? (ko ? '복원' : 'Restore') : (ko ? '보관본 삭제' : 'Delete archive')} · {new Date(record.createdAt).toLocaleString()} · {record.id.slice(0, 8)} · {stateLabel(record, ko)}</summary>
        <ArchiveOperationHistoryDetail record={record} />
      </details></article>)}
      {rows.length === 0 && <p role="status">{ko ? '이 페이지의 요청 기록을 찾지 못했습니다. 이전 페이지로 이동해 주세요.' : 'Requests on this page are no longer available. Go to an earlier page.'}</p>}
      {(count > 10 || page > 0) && <nav aria-label={ko ? '요청 기록 페이지' : 'Request history pages'}>
        <Button disabled={loading || page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>{ko ? '이전 페이지' : 'Previous page'}</Button>
        <span>{page + 1} / {pages}</span>
        <Button disabled={loading || page + 1 >= pages} onClick={() => setPage(p => p + 1)}>{ko ? '다음 페이지' : 'Next page'}</Button>
      </nav>}
    </>}
  </History>;
}
