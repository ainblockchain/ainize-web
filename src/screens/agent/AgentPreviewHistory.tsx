import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAgentPreviewRunsQuery, useExportAgentPreviewRunMutation, useDeleteAgentPreviewRunMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { selectedPreviewRun } from '@/lib/agentHistorySelection';
import type { AgentPreviewRun } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Alert, Select } from '@/components/ui/Form';
import { useT } from '@/i18n';

const Grid = styled.div`display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 12px 0; @media(max-width:640px) { grid-template-columns: minmax(0, 1fr); }`;
const Record = styled.article`min-width: 0; border: 1px solid #ddd; padding: 12px; p { overflow-wrap:anywhere; } pre { white-space:pre-wrap; overflow-wrap:anywhere; font:inherit; max-height:320px; overflow:auto; }`;

function textParts(value: unknown, depth = 0): string {
  if (depth > 8 || !value || typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map((part) => textParts(part, depth + 1)).filter(Boolean).join('\n');
  const data = value as Record<string, unknown>;
  if (typeof data.text === 'string') return data.text;
  return ['result', 'params', 'message', 'parts', 'artifacts', 'status'].map((key) => textParts(data[key], depth + 1)).filter(Boolean).join('\n');
}
function replyText(output: string): string {
  try { return textParts(JSON.parse(output)); } catch {
    return output.split('\n').filter((line) => line.startsWith('data: ')).map((line) => { try { return textParts(JSON.parse(line.slice(6))); } catch { return ''; } }).filter(Boolean).join('\n');
  }
}

export function AgentPreviewHistory({ agentId }: { agentId: string }) {
  const { cacheIdentity } = useAuth();
  return <PreviewHistoryContent key={`${cacheIdentity}:${agentId}`} agentId={agentId} />;
}

function PreviewHistoryContent({ agentId }: { agentId: string }) {
  const { locale } = useT(); const ko = locale === 'ko';
  const { cacheIdentity } = useAuth();
  const active = useActiveView(); const pending = useRef(false);
  const [offset, setOffset] = useState(0), [left, setLeft] = useState<string | null>(null), [right, setRight] = useState<string | null>(null), [error, setError] = useState('');
  const query = useAgentPreviewRunsQuery({ id: agentId, identity: cacheIdentity, offset }, { pollingInterval: 10_000 });
  const [exportRun, exporting] = useExportAgentPreviewRunMutation(), [removeRun, removing] = useDeleteAgentPreviewRunMutation();
  const valid = !!query.currentData && Array.isArray(query.currentData.runs) && typeof query.currentData.total === 'number';
  const runs = !query.error && valid ? query.currentData!.runs : [];
  // Freeze initial choices. A poll or deletion must never substitute a different result for a chosen record.
  useEffect(() => {
    if (!query.error && valid && query.currentData!.runs.length) {
      setLeft((current) => current ?? query.currentData!.runs[0].id);
      setRight((current) => current ?? query.currentData!.runs[1]?.id ?? '');
    }
  }, [query.currentData, query.error, valid]);
  const chosen = [selectedPreviewRun(runs, left, 0), selectedPreviewRun(runs, right, 1)];
  const working = exporting.isLoading || removing.isLoading;
  const download = async (run: AgentPreviewRun) => {
    if (pending.current || !active()) return;
    pending.current = true; setError('');
    try {
      const saved = await exportRun({ id: agentId, run: run.id }).unwrap();
      if (!active()) return;
      if (saved.run.id !== run.id || saved.run.agent !== agentId) throw new Error('Unexpected record');
      const url = URL.createObjectURL(new Blob([JSON.stringify(saved.run, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${run.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (active()) setError(ko ? '기록을 내보내지 못했습니다.' : 'Could not export this record.'); }
    finally { pending.current = false; }
  };
  const remove = async (run: AgentPreviewRun) => {
    if (pending.current || !active() || !run.exportedAt || run.status === 'running') return;
    pending.current = true; setError('');
    try { await removeRun({ id: agentId, run: run.id }).unwrap(); }
    catch { if (active()) setError(ko ? '기록을 삭제하지 못했습니다.' : 'Could not delete this record.'); }
    finally { pending.current = false; }
  };
  const changePage = (next: number) => { setOffset(next); setLeft(null); setRight(null); setError(''); };
  return <section aria-label={ko ? '미리보기 비교' : 'Compare previews'} data-testid="agent-preview-history">
    <h3>{ko ? '미리보기 비교' : 'Compare previews'}</h3>
    {error && <Alert $tone="error">{error}</Alert>}
    {query.error || (!query.isFetching && !valid) ? <Alert role="alert" $tone="error">
      {ko ? '기록을 불러오지 못했습니다.' : 'Could not load preview records.'}{' '}
      <Button disabled={query.isFetching} onClick={() => void query.refetch()}>{ko ? '다시 불러오기' : 'Try again'}</Button>
    </Alert> : !valid ? <p role="status">{ko ? '기록을 불러오는 중…' : 'Loading records…'}</p> : <>
      {!runs.length && <p>{ko ? '이 페이지에 기록이 없습니다.' : 'No records on this page.'}</p>}
      <Grid>{chosen.map(({ id, run }, index) => <Record key={index}>
        <label>{ko ? `기록 ${index + 1}` : `Record ${index + 1}`}<Select value={id} disabled={working} onChange={(event) => (index ? setRight : setLeft)(event.target.value)}>
          <option value="">{ko ? '기록 선택' : 'Select a record'}</option>
          {id && !run && <option value={id}>{ko ? '선택한 기록을 사용할 수 없음' : 'Selected record unavailable'}</option>}
          {runs.map((option) => <option key={option.id} value={option.id}>{option.commit.slice(0, 8)} · {option.model} · {new Date(option.createdAt).toLocaleString()}</option>)}
        </Select></label>
        {!run ? <p>{id ? (ko ? '선택한 기록이 이 페이지에 없습니다. 다른 기록을 선택해 주세요.' : 'The selected record is not on this page. Select another record.') : (ko ? '비교할 기록을 선택해 주세요.' : 'Select a record to compare.')}</p> : <>
          <p>{run.model} · <span title={run.commit}>{run.commit.slice(0, 8)}</span> · {({ running: ko ? '실행 중' : 'Running', ready: ko ? '성공' : 'Succeeded', error: ko ? '실패' : 'Failed', cancelled: ko ? '중단' : 'Cancelled' })[run.status]}</p>
          <h4>{ko ? '입력' : 'Input'}</h4><pre>{textParts(run.request)}</pre>
          <h4>{ko ? '응답' : 'Response'}</h4><pre>{replyText(run.output) || (ko ? '구조화된 응답은 내보낸 기록에서 확인할 수 있습니다.' : 'The structured response is available in the exported record.')}</pre>
          {run.outputTruncated && <p>{ko ? '응답이 보관 한도를 넘어 일부만 저장되었습니다.' : 'Only part of this response was retained because it exceeded the storage limit.'}</p>}
          {run.error && <Alert $tone="error">{run.error}</Alert>}
          <Button disabled={working} onClick={() => void download(run)}>{ko ? '기록 내보내기' : 'Export record'}</Button>{' '}
          <Button disabled={working || !run.exportedAt || run.status === 'running'} onClick={() => void remove(run)}>{ko ? '내보낸 기록 삭제' : 'Delete exported record'}</Button>
        </>}
      </Record>)}</Grid>
    </>}
    <Button disabled={offset === 0 || query.isFetching || working} onClick={() => changePage(Math.max(0, offset - 10))}>{ko ? '최신 기록' : 'Newer records'}</Button>{' '}
    <Button disabled={!valid || !!query.error || offset + 10 >= (query.currentData?.total ?? 0) || query.isFetching || working} onClick={() => changePage(offset + 10)}>{ko ? '이전 기록' : 'Older records'}</Button>
  </section>;
}
