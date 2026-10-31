import { Button } from './ui/Button';
import styled from 'styled-components';
import { Alert } from './ui/Form';
import { StyledLink } from './ui/Misc';
import { useT } from '@/i18n';
import { readArchiveOperationJob, type ArchiveOperation } from '@/lib/agentArchiveOperation';
import { readAgentArchiveRestore } from '@/api/agentArchiveEvidence';
const Recovery = styled.div`min-width: 0; overflow-wrap: anywhere; button { min-height: 44px; max-width: 100%; white-space: normal; } a { min-height: 44px; display: inline-flex; align-items: center; }`;
export function ArchiveOperationNotice({ operation, ready, running, error, inspect, cancel, acknowledge, reload }: {
  operation: ArchiveOperation | null; ready: boolean; running: boolean; error: string | null;
  inspect: () => void; cancel: () => void; acknowledge: () => void; reload: () => void;
}) {
  const { locale } = useT(), ko = locale === 'ko';
  const job = operation?.job ? readArchiveOperationJob({ operation: operation.job }, operation) : null;
  const restored = operation && job?.state === 'done' && operation.action === 'restore' ? readAgentArchiveRestore(job.result, operation.review) : null;
  const complete = job?.state === 'done' || job?.state === 'refused';
  return <Recovery>
    {!ready && !error && <p role="status">{ko ? '복구 기록을 준비하는 중…' : 'Preparing recovery records…'}</p>}
    {error && <Alert role="alert" $tone="error">{error === 'storage'
      ? (ko ? '복구 기록을 저장하거나 읽을 수 없어 새 복원·삭제를 시작할 수 없습니다.' : 'Recovery records cannot be stored or read; new restore/delete actions are unavailable.')
      : error === 'locked' ? (ko ? '다른 탭에서 이 계정의 보관본 작업을 처리하고 있습니다.' : 'Another tab is processing an archive action for this account.')
      : error === 'changed' ? (ko ? '선택한 보관본이 바뀌었습니다. 목록을 새로 불러와 검토해 주세요.' : 'The selected archive changed. Refresh the list and review it again.')
      : (ko ? '요청 결과를 아직 확인하지 못했습니다. 저장된 요청으로 상태만 다시 확인하세요.' : 'The result is not confirmed. Check the saved request status without resubmitting.')} <Button disabled={running} onClick={operation ? inspect : reload}>{ko ? '다시 확인' : 'Check again'}</Button></Alert>}
    {operation && <section aria-label={ko ? '보관본 요청 복구' : 'Archive request recovery'}>
      <p>{operation.review.record.name} · {operation.review.record.agent} · {operation.action === 'restore' ? (ko ? '복원' : 'Restore') : (ko ? '보관본 삭제' : 'Delete archive')} · {operation.id.slice(0, 8)}</p>
      {job?.state === 'done' && <p role="status">{operation.action === 'restore' ? (ko ? '복원 처리 확인' : 'Restore confirmed') : (ko ? '보관본 삭제 확인' : 'Archive deletion confirmed')}{restored && <> · v{restored.version} · {restored.commit.slice(0, 7)} <StyledLink to={`/agent/${encodeURIComponent(restored.agentId)}/edit`}>{ko ? '에이전트 설정 열기' : 'Open agent settings'}</StyledLink>{restored.secretsRequired.length > 0 && <> · {ko ? '다시 설정할 비밀 값' : 'Secrets to set again'}: {restored.secretsRequired.join(', ')}</>}</>}</p>}
      {job?.state === 'refused' && <p role="status">{job.error?.code === 'archive_operation_cancelled' ? (ko ? '접수 전에 취소됐습니다. 이 요청은 나중에 도착해도 실행되지 않습니다.' : 'Cancelled before admission. A delayed submission of this request will not execute.') : job.error?.code === 'project_environment_required' ? (ko ? '배포 당시 환경변수 원본을 복구하거나 프로젝트에서 다시 배포하세요.' : 'Recover the original deployed environment or deploy again from the project.') : job.error?.message}</p>}
      {!complete && <p role="status">{job?.state === 'running' ? (ko ? '서버에서 처리 중입니다. 같은 요청의 상태를 확인합니다.' : 'The server is processing this request. Checking its status.') : job?.state === 'interrupted' ? (ko ? '서버 재시작으로 결과 확인이 필요합니다. 자동으로 다시 실행하지 않습니다.' : 'A server restart interrupted confirmation. This request will not be replayed.') : (ko ? '결과 확인이 필요합니다. 새 요청을 보내지 않고 이 요청을 확인합니다.' : 'Confirmation is needed. Check this request without starting another.')}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button disabled={running} onClick={inspect}>{ko ? '요청 상태 확인' : 'Check request status'}</Button>
        {!job && <Button disabled={running} onClick={cancel}>{ko ? '미접수 요청만 취소' : 'Cancel if not admitted'}</Button>}
        {complete && <Button disabled={running} onClick={acknowledge}>{ko ? '확인하고 닫기' : 'Acknowledge and close'}</Button>}
        <StyledLink to={`/agent/${encodeURIComponent(operation.review.record.agent)}`}>{ko ? '에이전트 상태 보기' : 'Inspect agent state'}</StyledLink>
      </div>
    </section>}
  </Recovery>;
}
