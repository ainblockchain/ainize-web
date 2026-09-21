'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { m1Group, parseM1Status, type M1Status } from '@/lib/m1-status';
import styles from './page.module.css';

const groups: Record<string, string> = { waiting: '대기 / 제출 전', active: '학습·검증 중', done: '학습 완료', attention: '실패·취소 / 확인 필요', unknown: '상태 미확인' };
const labels: Record<string, string> = { NOT_SUBMITTED: '제출 전', SUBMITTING: '접수 확인 중', UNCONFIRMED: '접수 미확인', UNKNOWN: '조회 실패', QUEUED: '대기', PREFLIGHT: '사전 검사', LOADING: '모델 준비', TRAINING: '학습 중', EXPORTED: '검증 대기', CHECKING: '결과 검증', READY: '학습 완료', NEEDS_MORE: '추가 학습 필요', FAILED: '실패', CANCELLED: '취소', ANNOUNCED: '공개됨', PUBLISHED: '공개됨', REJECTED: '거절됨', PENDING_REVIEW: '공개 승인 대기', EXPIRED: '만료됨' };
export default function M1Page() {
  const [data, setData] = useState<M1Status | null>(null);
  const [error, setError] = useState('');
  const [node, setNode] = useState('');
  const [group, setGroup] = useState('');
  const [now, setNow] = useState(0);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch('/api/kpi/m1', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('상태를 갱신하지 못했습니다. 마지막 수신 내용을 표시합니다.');
        const next = parseM1Status(await response.json());
        if (!stopped) { setData(next); setError(''); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : '조회 실패'); }
      if (!stopped) { setNow(Date.now()); timer = setTimeout(poll, 5000); }
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, []);
  const stale = data && now - data.generatedAt > 20000;
  const nodes = [...new Set(data?.jobs.map(j => j.node) ?? [])].sort();
  const counts = Object.fromEntries(Object.keys(groups).map(g => [g, data?.jobs.filter(j => m1Group(j.status) === g).length ?? 0]));
  return <main className={styles.page}>
    <Link href="/network">← 네트워크</Link>
    <h1>M1 · 70개 학습 작업</h1>
    <p>Ainize 노드 5개 · 노드당 14개 작업 · 5초마다 자동 갱신</p>
    <p className={styles.note}>학습 상태를 표시합니다. 온체인 최종화 및 M1 합격 여부는 별도로 검증합니다.</p>
    <div className={styles.health} role="status">{error || (stale ? '갱신 지연 — 아래 상태는 최신이 아닙니다.' : data ? (data.startedAt ? '상태 수신 중' : '시험 시작 대기') : '상태 불러오는 중…')}</div>
    {data && <>
      <p className={styles.note}>실행: {data.runId} · 마지막 수집: {new Date(data.generatedAt).toLocaleString('ko-KR')}</p>
      <section className={styles.cards} aria-label="작업 상태 요약">{Object.entries(groups).map(([g, label]) => <div key={g}><span>{label}</span><strong>{counts[g]}</strong></div>)}</section>
      <section className={styles.nodes} aria-label="노드별 작업">{nodes.map(n => <button key={n} onClick={() => setNode(node === n ? '' : n)} aria-pressed={node === n}><b>{n}</b><span>{data.jobs.filter(j => j.node === n && m1Group(j.status) === 'done').length} / 14 완료 · {data.jobs.filter(j => j.node === n && m1Group(j.status) === 'active').length}개 진행</span></button>)}</section>
      <div className={styles.filters}><label>노드 <select value={node} onChange={e => setNode(e.target.value)}><option value="">전체 노드</option>{nodes.map(n => <option key={n}>{n}</option>)}</select></label><label>상태 <select value={group} onChange={e => setGroup(e.target.value)}><option value="">전체 상태</option>{Object.entries(groups).map(([g, label]) => <option key={g} value={g}>{label}</option>)}</select></label></div>
      <div className={styles.table}><table><thead><tr><th>작업</th><th>노드</th><th>상태</th><th>진행률</th><th>학습 단계</th><th>작업 ID</th></tr></thead><tbody>{data.jobs.filter(j => (!node || j.node === node) && (!group || m1Group(j.status) === group)).map(j => <tr key={j.index}><td>{j.index}</td><td>{j.node}</td><td><span data-group={m1Group(j.status)} className={styles.badge}>{labels[j.status] ?? j.status}</span></td><td>{j.percent === null ? '—' : <><progress max={100} value={j.percent} /> {Math.round(j.percent)}%</>}</td><td>{j.step !== null && j.maxSteps !== null ? `${j.step} / ${j.maxSteps}` : '—'}</td><td className={styles.id}>{j.jobId ?? '—'}</td></tr>)}</tbody></table></div>
    </>}
  </main>;
}
