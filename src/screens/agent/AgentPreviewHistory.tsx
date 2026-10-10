import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useAgentPreviewRunsQuery, useExportAgentPreviewRunMutation, useDeleteAgentPreviewRunMutation } from '@/api/api';
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
  const { locale } = useT(); const ko = locale === 'ko';
  const [offset, setOffset] = useState(0), [left, setLeft] = useState(''), [right, setRight] = useState(''), [error, setError] = useState('');
  useEffect(() => { setOffset(0); setLeft(''); setRight(''); setError(''); }, [agentId]);
  const query = useAgentPreviewRunsQuery({ id: agentId, offset }, { pollingInterval: 10_000 });
  const [exportRun, exporting] = useExportAgentPreviewRunMutation(), [removeRun, removing] = useDeleteAgentPreviewRunMutation();
  if (!query.currentData || (!query.currentData.total && offset === 0)) return null;
  const runs = query.currentData.runs;
  const chosen = [runs.find((run) => run.id === left) ?? runs[0], runs.find((run) => run.id === right) ?? runs[1]].filter((run): run is AgentPreviewRun => !!run);
  const download = async (run: AgentPreviewRun) => {
    try {
      const saved = await exportRun({ id: agentId, run: run.id }).unwrap();
      const url = URL.createObjectURL(new Blob([JSON.stringify(saved.run, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `${run.id}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setError('');
    } catch { setError(ko ? '기록을 내보내지 못했습니다.' : 'Could not export this record.'); }
  };
  return <section aria-label={ko ? '미리보기 비교' : 'Compare previews'}>
    <h3>{ko ? '미리보기 비교' : 'Compare previews'}</h3>
    {error && <Alert $tone="error">{error}</Alert>}
    <Grid>{chosen.map((run, index) => <Record key={index}>
      <label>{ko ? `기록 ${index + 1}` : `Record ${index + 1}`}<Select value={run.id} onChange={(event) => (index ? setRight : setLeft)(event.target.value)}>{runs.map((option) => <option key={option.id} value={option.id}>{option.commit.slice(0, 8)} · {option.model} · {new Date(option.createdAt).toLocaleString()}</option>)}</Select></label>
      <p>{run.model} · <span title={run.commit}>{run.commit.slice(0, 8)}</span> · {({ running: ko ? '실행 중' : 'Running', ready: ko ? '성공' : 'Succeeded', error: ko ? '실패' : 'Failed', cancelled: ko ? '중단' : 'Cancelled' })[run.status]}</p>
      <h4>{ko ? '입력' : 'Input'}</h4><pre>{textParts(run.request)}</pre>
      <h4>{ko ? '응답' : 'Response'}</h4><pre>{replyText(run.output) || (ko ? '구조화된 응답은 내보낸 기록에서 확인할 수 있습니다.' : 'The structured response is available in the exported record.')}</pre>
      {run.outputTruncated && <p>{ko ? '응답이 보관 한도를 넘어 일부만 저장되었습니다.' : 'Only part of this response was retained because it exceeded the storage limit.'}</p>}
      {run.error && <Alert $tone="error">{run.error}</Alert>}
      <Button disabled={exporting.isLoading} onClick={() => void download(run)}>{ko ? '기록 내보내기' : 'Export record'}</Button>{' '}
      <Button disabled={!run.exportedAt || run.status === 'running' || removing.isLoading} onClick={() => { void removeRun({ id: agentId, run: run.id }).unwrap().catch(() => setError(ko ? '기록을 삭제하지 못했습니다.' : 'Could not delete this record.')); }}>{ko ? '내보낸 기록 삭제' : 'Delete exported record'}</Button>
    </Record>)}</Grid>
    <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 10))}>{ko ? '최신 기록' : 'Newer records'}</Button>{' '}
    <Button disabled={offset + 10 >= query.currentData.total} onClick={() => setOffset(offset + 10)}>{ko ? '이전 기록' : 'Older records'}</Button>
  </section>;
}
