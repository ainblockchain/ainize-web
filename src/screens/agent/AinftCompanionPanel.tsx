import { ainftTrainingLabel, ainftTrainingPending } from '@/lib/ainft-training-status';
import { AinftRewardsPanel } from './AinftRewardsPanel';
import { AinftBenefitsPanel } from './AinftBenefitsPanel';
import { publishCompanionLesson, type CompanionPublicationInput } from '@/lib/ainftPublication';
import { AinftTaskSubmission } from '@/lib/ainftTaskSubmission';
import { AinftCreditClient } from '@/lib/ainftCredits';
import type { AinftWallet } from '@/lib/ainftRegistration';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
interface Task { id: string; input: string; state: string; result: string | null; error: string | null; allowance?: { state: string; canRestore: boolean; canSettle: boolean } }
interface Memory { id: string; text: string; state: string; sourceTask: string }
interface LearningExample { id: string; prompt: string; answer: string; state: string }
interface Companion { tasks: Task[]; memories: Memory[]; learningExamples: LearningExample[]; experience: number; growthEvidence?: { id: string; kind: string; sourceId: string; experience: number; active: boolean }[]; growthPolicy?: { version: string } }
interface Training { publications?: { id: string; runId: string; state: string; result: { status?: string } | null }[]; selectedRunId: string | null; capability: { available: boolean; model: string | null; reason: string | null }; runs: { id: string; model: string; eligible: boolean; state: string; jobId: string | null; job: { status: string; error: string | null; draftId: string | null; applicationVerified?: boolean; progress?: { step: number; maxSteps: number; phase: string | null } | null } | null }[] }
export function AinftCompanionPanel({ agentId }: { agentId: string }) {
  const auth = useAuth(), { locale } = useT();
  const text = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const [snapshot, setSnapshot] = useState<{ identity: string; data: Companion } | null>(null);
  const [input, setInput] = useState(''), [memory, setMemory] = useState('');
  const [creditUser, setCreditUser] = useState('');
  const [creditSnapshot, setCreditSnapshot] = useState<{ identity: string; userId: string; balance: number; symbol: string; appId: string } | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [learning, setLearning] = useState<{ identity: string; key: string; memoryId: string; prompt: string; answer: string; consent: boolean } | null>(null);
  const [trainingSnapshot, setTrainingSnapshot] = useState<{ identity: string; data: Training } | null>(null);
  const [trainingSelection, setTrainingSelection] = useState<string[]>([]), [trainingConsent, setTrainingConsent] = useState(false);
  const trainingKey = useRef<string | null>(null);
  const taskSubmission = useRef(new AinftTaskSubmission(undefined, (() => { try { return typeof window === 'undefined' ? undefined : window.localStorage; } catch { return undefined; } })()));
  const [selectedBenefit, setSelectedBenefit] = useState<{ identity: string; purchaseId: string; policyVersion: number } | null>(null);
  const [selectionIntent, setSelectionIntent] = useState<{ identity: string; key: string; runId: string | null; model: string; consent: boolean } | null>(null);
  const [publicationIntent, setPublicationIntent] = useState<(CompanionPublicationInput & { identity: string }) | null>(null);
  const draft = learning?.identity === `${agentId}:${auth.subject ?? ''}` ? learning : null;
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const identity = `${agentId}:${auth.subject ?? ''}`;
  const state = snapshot?.identity === identity ? snapshot.data : null;
  const training = trainingSnapshot?.identity === identity ? trainingSnapshot.data : null;
  const setState = (data: Companion | null) => setSnapshot(data ? { identity, data } : null);
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const isCurrent = () => currentIdentity.current === identity;
  const base = `/api/hosted-agents/${encodeURIComponent(agentId)}/companion`;
  const request = async (path = '', body?: unknown) => {
    const response = await fetch(base + path, { credentials: 'include', cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) {
      if (isCurrent() && (response.status === 401 || response.status === 403)) setState(null);
      throw new Error(result.error === 'ainft_release_mismatch' ? text('에이전트 릴리스가 변경되었습니다. 제작자가 AINFT metadata와 연결을 갱신해야 합니다.', 'The agent release changed. Its creator must refresh the AINFT metadata and binding.') : response.status === 403 ? text('현재 NFT 보유자 권한을 확인할 수 없습니다.', 'Current NFT holder access could not be verified.') : String(result.error ?? 'Request failed'));
    }
    return result;
  };
  const load = async () => { const result = await request(); if (isCurrent()) setState(result); };
  const loadTraining = async () => { const result = await request('/learning'); if (isCurrent()) setTrainingSnapshot({ identity, data: result }); };
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await load(); if (training) await loadTraining(); }
    catch (failure) { if (isCurrent()) setError(failure instanceof Error ? failure.message : String(failure)); }
    finally { if (isCurrent()) setBusy(false); }
  };
  useEffect(() => { setState(null); setSource(null); setMemory(''); setInput(''); setCreditUser(''); setCreditSnapshot(null); setSelectedBenefit(null); setLearning(null); setTrainingSnapshot(null); setTrainingSelection([]); setTrainingConsent(false); setSelectionIntent(null); setPublicationIntent(null); trainingKey.current = null; setError(null); setBusy(false); }, [agentId, auth.subject]);
  const trainingRunning = training?.runs.some(run => ainftTrainingPending(run.job, run.state)) ?? false;
  useEffect(() => {
    if (!trainingRunning) return;
    let cancelled = false, pending = false;
    const timer = setInterval(async () => {
      if (pending) return;
      pending = true;
      try {
        const data = await request('/learning') as Training;
        if (!cancelled && isCurrent()) setTrainingSnapshot({ identity, data });
      } catch (failure) {
        if (!cancelled && isCurrent()) setError(failure instanceof Error ? failure.message : String(failure));
      } finally { pending = false; }
    }, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [agentId, auth.subject, trainingRunning]);
  const running = state?.tasks.some((t) => t.state === 'queued' || t.state === 'running') ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { void load().catch((failure) => { if (isCurrent()) setError(String(failure)); }); }, 2000);
    return () => clearInterval(timer);
  }, [running, agentId, auth.subject]);
  return <section style={{ marginTop: 24 }} data-testid="ainft-companion">
    <h3>{text('보유자 전용 대화·작업', 'Holder conversations and work')}</h3>
    {!auth.subject ? <Link to={`/signing?next=${encodeURIComponent(`/agent/${agentId}`)}`}>{text('NFT 보유 지갑으로 로그인', 'Sign in with the holder wallet')}</Link>
      : !state ? <Button size="small" loading={busy} onClick={() => void action(async () => {})}>{text('내 공간 열기', 'Open my workspace')}</Button> : <>
        <p>{text('활동 경험치', 'Activity experience')}: {state.experience}</p>
        <details>
          <summary>{text('커뮤니티 크레딧', 'Community credits')}</summary>
          <p>{text('커뮤니티에 연결된 내 Factory 사용자 ID를 입력하세요. AIN Wallet 서명으로 내 계정의 잔액을 조회합니다. 서버가 보유자 조회를 지원해야 합니다. 크레딧은 AIN이나 경험치와 별개입니다. 혜택 구매·환불은 해당 Factory 서버가 지원하는 경우 사용할 수 있습니다.', 'Enter your linked Factory user ID. AIN Wallet signs a read of your account balance. The server must support holder balance reads. Credits are separate from AIN and experience. Benefit purchases and refunds require support from the connected Factory server.')}</p>
          <input aria-label={text('Factory 사용자 ID', 'Factory user ID')} maxLength={128} value={creditUser} disabled={busy} onChange={(event) => { setCreditUser(event.target.value); setCreditSnapshot(null); setSelectedBenefit(null); }} />
          <Button size="small" disabled={busy || !creditUser.trim()} onClick={() => void action(async () => {
            setCreditSnapshot(null);
            const policy = await request('/credits');
            if (!policy.community) throw new Error(text('제작자가 커뮤니티 크레딧을 연결하지 않았습니다.', 'The creator has not connected community credits.'));
            const wallet = (window as unknown as { ainetwork?: AinftWallet }).ainetwork;
            if (!wallet) throw new Error(text('AIN Wallet을 설치하고 잠금을 해제하세요.', 'Install and unlock AIN Wallet.'));
            if (!isCurrent()) throw new Error('Holder workspace changed');
            const balance = await new AinftCreditClient(policy.chainId, wallet).balance(auth.subject!, policy.community.appId, policy.community.symbol, creditUser.trim());
            const latest = await request('/credits');
            if (latest.version !== policy.version || latest.chainId !== policy.chainId || latest.community?.appId !== policy.community.appId || latest.community?.symbol !== policy.community.symbol) throw new Error(text('크레딧 연결이 변경되었습니다. 다시 조회하세요.', 'The credit connection changed. Check again.'));
            if (isCurrent()) setCreditSnapshot({ identity, ...balance });
          })}>{text('지갑으로 잔액 확인', 'Check balance with wallet')}</Button>
          {creditSnapshot?.identity === identity && creditSnapshot.userId === creditUser.trim() && <p>{creditSnapshot.appId}: {creditSnapshot.balance} {creditSnapshot.symbol} · {text('마지막 조회 잔액', 'Balance at last check')}</p>}
          <AinftRewardsPanel agentId={agentId} address={auth.subject!} userId={creditUser.trim()} text={text} />
          <AinftBenefitsPanel selectedPurchase={selectedBenefit?.identity === identity ? selectedBenefit.purchaseId : undefined} onSelect={(purchaseId, policyVersion) => { if (isCurrent()) setSelectedBenefit({ identity, purchaseId, policyVersion }); }} agentId={agentId} address={auth.subject!} userId={creditUser.trim()} text={text} />
        </details>
        {state.growthEvidence && <details>
          <summary>{text('성장 활동 기록', 'Growth activity records')}</summary>
          <p>{text('완료한 대화·작업과 처음 승인한 기억에 각각 1점을 기록합니다. 기억 승인을 철회해도 활동 기록은 유지됩니다. 경험치는 답변 품질이나 크레딧 잔액을 뜻하지 않습니다.', 'Completed conversations and work, and first memory approvals, each record one point. Revoking memory approval keeps the activity record. Experience does not measure answer quality or a credit balance.')}</p>
          {state.growthPolicy && <small>{text('활동 규칙', 'Activity policy')}: {state.growthPolicy.version}</small>}
          {state.growthEvidence.length === 0 ? <p>{text('아직 기록된 활동이 없습니다.', 'No recorded activity yet.')}</p> : <ul>{state.growthEvidence.slice(-20).reverse().map((event) => <li key={event.id}>
            {event.kind === 'completed_work' && !state.tasks.slice(-20).some((task) => task.id === event.sourceId)
              ? text('이전 대화·작업 완료', 'Earlier conversation or work completed')
              : <a href={`#companion-${event.kind === 'completed_work' ? 'task' : 'memory'}-${encodeURIComponent(event.sourceId)}`}>{event.kind === 'completed_work' ? text('대화·작업 완료', 'Conversation or work completed') : text('기억 승인', 'Memory approved')}</a>}: +{event.experience}
            {!event.active && ` · ${text('기억 사용 철회됨', 'Memory use revoked')}`}
          </li>)}</ul>}
        </details>}
        {selectedBenefit?.identity === identity && <p>{text('선택한 이용권', 'Selected allowance')}: {selectedBenefit.purchaseId.slice(0,12)} <Button size="small" variant="text" onClick={() => setSelectedBenefit(null)}>{text('선택 해제', 'Clear selection')}</Button></p>}
        <textarea aria-label={text('대화 또는 작업 요청', 'Conversation or work request')} value={input} maxLength={12000} onChange={(event) => setInput(event.target.value)} style={{ width: '100%', minHeight: 80 }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {(['chat', 'task'] as const).map((kind) => <Button key={kind} size="small" disabled={!input.trim() || busy} onClick={() => void action(async () => {
            await taskSubmission.current.submit(identity, kind, input, (body) => request('/tasks', body), isCurrent, selectedBenefit?.identity === identity ? selectedBenefit.purchaseId : undefined, selectedBenefit?.identity === identity ? selectedBenefit.policyVersion : undefined); if (isCurrent()) { setInput((current) => current === input ? '' : current); setSelectedBenefit(null); }
          })}>{kind === 'chat' ? text('대화 보내기', 'Send message') : text('일 맡기기', 'Assign work')}</Button>)}
        </div>
        {state.tasks.slice(-20).map((task) => <article key={task.id} id={`companion-task-${task.id}`} style={{ padding: 12, marginTop: 12, border: '1px solid #ddd' }}>
          <p style={{ whiteSpace: 'pre-wrap' }}>{task.input}</p><small>{task.state}</small>
          {task.state === 'queued' && <Button size="small" variant="text" disabled={busy} onClick={() => void action(() => request(`/tasks/${task.id}/cancel`, {}))}>{text('대기 작업 취소', 'Cancel queued work')}</Button>}
          {task.result && <p style={{ whiteSpace: 'pre-wrap' }}>{task.result}</p>}
          {task.error && <Alert $tone="error">{task.error}</Alert>}
          {task.allowance?.canRestore && <div>
            <p>{text('작업이 실행되기 전에 멈췄습니다. 예약된 이용권 사용량을 복구할 수 있습니다.', 'The task stopped before execution. You can restore its reserved allowance.')}</p>
            <Button size="small" disabled={busy} onClick={() => void action(() => request(`/tasks/${encodeURIComponent(task.id)}/allowance/restore`, {}))}>{text('예약 사용량 복구', 'Restore reserved allowance')}</Button>
          </div>}
          {task.allowance?.canSettle && <div>
            <p>{text('작업은 완료됐지만 이용권 정산 확인이 남아 있습니다. 재시도해도 작업을 다시 실행하지 않습니다.', 'The work completed; allowance settlement is pending. Retrying does not run the work again.')}</p>
            <Button size="small" disabled={busy} onClick={() => void action(() => request(`/tasks/${encodeURIComponent(task.id)}/settlement`, {}))}>{text('정산 확인 재시도', 'Retry settlement confirmation')}</Button>
          </div>}
          {task.allowance?.state === 'restored' && <p>{text('예약 사용량 복구됨', 'Reserved allowance restored')}</p>}
          {task.allowance?.state === 'unknown' && <Alert $tone="error">{text('작업 실행 결과를 확인할 수 없습니다. 중복 실행이나 잘못된 환불을 막기 위해 운영자 확인이 필요합니다.', 'The execution outcome is unknown. Operator reconciliation is needed to prevent duplicate execution or an incorrect refund.')}</Alert>}

          {task.state === 'completed' && <Button size="small" variant="text" onClick={() => { setSource(task.id); setMemory(task.result ?? ''); }}>{text('개인 기억 후보 만들기', 'Propose private memory')}</Button>}
        </article>)}
        {source && <div style={{ marginTop: 16 }}>
          <textarea aria-label={text('기억할 내용 검토', 'Review memory content')} value={memory} maxLength={2000} onChange={(event) => setMemory(event.target.value)} style={{ width: '100%', minHeight: 80 }} />
          <Button size="small" disabled={!memory.trim() || busy} onClick={() => void action(async () => { await request('/memories', { sourceTask: source, text: memory }); if (isCurrent()) { setSource(null); setMemory(''); } })}>{text('기억 후보 저장', 'Save memory proposal')}</Button>
        </div>}
        {state.memories.length > 0 && <p>{text('요청과 관련된 승인 기억을 최대 8개 사용합니다. 승인 철회는 이후 기억 목록에서 제외하며, 과거 대화 기록은 유지됩니다.', 'Up to eight approved memories are selected for each request. Revoking approval excludes a memory from future memory context. Existing conversation records remain.')}</p>}
        {state.memories.map((item) => <div key={item.id} id={`companion-memory-${item.id}`} style={{ marginTop: 12 }}>
          <p>{item.text}</p><small>{item.state}</small>
          {item.state === 'approved' && <Button size="small" variant="text" disabled={busy} onClick={() => setLearning({ identity, key: crypto.randomUUID(), memoryId: item.id, prompt: state.tasks.find((task) => task.id === item.sourceTask)?.input ?? '', answer: item.text, consent: false })}>{text('학습 예제 검토', 'Review learning example')}</Button>}
          {item.state === 'approved' && <Button size="small" variant="text" disabled={busy} onClick={() => void action(() => request(`/memories/${item.id}/revoke`, {}))}>{text('기억 승인 철회', 'Revoke memory approval')}</Button>}
          {item.state === 'proposed'  && <div style={{ display: 'flex', gap: 12 }}>
            <Button size="small" disabled={busy} onClick={() => void action(() => request(`/memories/${item.id}/decision`, { approve: true }))}>{text('개인 기억 승인', 'Approve private memory')}</Button>
            <Button size="small" disabled={busy} onClick={() => void action(() => request(`/memories/${item.id}/decision`, { approve: false }))}>{text('거절', 'Reject')}</Button>
          </div>}
        </div>)}
        {draft && <div style={{ marginTop: 16 }}>
          <h4>{text('학습 질문·답변 검토', 'Review learning question and answer')}</h4>
          <p>{text('검토한 예제를 내 공간에 저장합니다. 모델 학습이나 공개 공유는 실행되지 않습니다.', 'Save a reviewed example in your private workspace. This does not start model training or publish the example.')}</p>
          <textarea aria-label={text('학습 질문', 'Learning question')} value={draft.prompt} maxLength={12000} onChange={(event) => setLearning({ ...draft, prompt: event.target.value, consent: false, key: crypto.randomUUID() })} style={{ width: '100%', minHeight: 80 }} />
          <textarea aria-label={text('학습 답변', 'Learning answer')} value={draft.answer} maxLength={12000} onChange={(event) => setLearning({ ...draft, answer: event.target.value, consent: false, key: crypto.randomUUID() })} style={{ width: '100%', minHeight: 80 }} />
          <label><input type="checkbox" checked={draft.consent} onChange={(event) => setLearning({ ...draft, consent: event.target.checked })} />{text('질문·답변을 확인했고 개인 학습 예제로 저장하는 데 동의합니다.', 'I reviewed the question and answer and agree to save this private learning example.')}</label>
          <div><Button size="small" disabled={busy || !draft.consent || !draft.prompt.trim() || !draft.answer.trim()} onClick={() => void action(async () => { await request('/learning/examples', { key: draft.key, memoryId: draft.memoryId, prompt: draft.prompt, answer: draft.answer, consent: true }); if (isCurrent()) setLearning(null); })}>{text('검토한 예제 저장', 'Save reviewed example')}</Button>
          <Button size="small" variant="text" disabled={busy} onClick={() => setLearning(null)}>{text('취소', 'Cancel')}</Button></div>
        </div>}
        {(state.learningExamples ?? []).map((example) => <article key={example.id} style={{ padding: 12, marginTop: 12, border: '1px solid #ddd' }}>
          <p style={{ whiteSpace: 'pre-wrap' }}>{example.prompt}</p><p style={{ whiteSpace: 'pre-wrap' }}>{example.answer}</p>
          <small>{example.state === 'reviewed' ? text('검토한 예제 · 저장됨', 'Reviewed example · saved') : text('사용 철회', 'Withdrawn')}</small>
          {example.state === 'reviewed' && <Button size="small" variant="text" disabled={busy} onClick={() => void action(() => request(`/learning/examples/${example.id}/withdraw`, {}))}>{text('예제 사용 철회', 'Withdraw example')}</Button>}
        </article>)}
        <div style={{ marginTop: 16 }}>
          <Button size="small" disabled={busy} onClick={() => void action(loadTraining)}>{text('모델 학습 상태 확인', 'Check model training')}</Button>
          {training && <>
            <p>{text('학습 모델', 'Training model')}: {training.capability.model ?? '—'}</p>
            {!training.capability.available && <Alert $tone="error">{training.capability.reason}</Alert>}
            {training.capability.available && <>
              <p>{text('학습할 예제를 선택하세요. 작업은 노드의 학습 자원을 사용하며, 평가된 초안을 만들지만 자동으로 에이전트에 적용하거나 자료를 공개하지 않습니다. 연결된 블록체인에는 지갑 주소·작업 상태·자료 해시가 기록될 수 있습니다.', 'Select examples to train. The job uses node training resources and creates an evaluated draft; it does not automatically apply it to the agent or publish its contents. A connected blockchain may record your wallet address, job status and dataset hash.')}</p>
              {(state.learningExamples ?? []).filter((example) => example.state === 'reviewed').map((example) => <label key={example.id} style={{ display: 'block' }}><input type="checkbox" disabled={busy} checked={trainingSelection.includes(example.id)} onChange={(event) => { setTrainingSelection(event.target.checked ? [...trainingSelection, example.id] : trainingSelection.filter((id) => id !== example.id)); setTrainingConsent(false); trainingKey.current = null; }} />{example.prompt}</label>)}
              <label style={{ display: 'block' }}><input type="checkbox" disabled={busy} checked={trainingConsent} onChange={(event) => setTrainingConsent(event.target.checked)} />{text('선택한 예제와 모델을 확인했고 학습 실행에 동의합니다.', 'I reviewed the selected examples and model and agree to run training.')}</label>
              <Button size="small" disabled={busy || !trainingConsent || !trainingSelection.length} onClick={() => void action(async () => {
                trainingKey.current ??= crypto.randomUUID();
                try { await request('/learning/train', { key: trainingKey.current, exampleIds: trainingSelection, model: training.capability.model, consent: true }); }
                finally { await loadTraining(); }
              })}>{text('선택한 예제 학습', 'Train selected examples')}</Button>
            </>}
            {training.runs.map((run) => <div key={run.id} style={{ marginTop: 12 }}><small aria-live="polite">{ainftTrainingLabel(run.job, run.state, locale)}</small>
              {run.state === 'unknown' && <Alert $tone="error">{text('제출 결과를 확인할 수 없습니다. 중복 실행을 막기 위해 같은 요청을 다시 제출하지 않습니다. 노드 운영자의 확인이 필요합니다.', 'The submission outcome is unknown. This request will not be submitted again. Ask the node operator to reconcile the job.')}</Alert>}
              {run.job?.error && <Alert $tone="error">{run.job.error}</Alert>}
              {run.job?.draftId && run.job.applicationVerified !== true && <p>{text('실제 모델 평가와 원상복구 검증이 필요합니다. 검증을 통과한 후 선택할 수 있습니다.', 'Live model evaluation and restoration must be verified before this lesson can be selected.')}</p>}
              {run.job?.draftId && run.job.applicationVerified === true && <p>{run.job.status === 'READY' ? (training.selectedRunId === run.id ? (training.capability.available ? text('다음 보유자 대화에 사용할 학습', 'Selected for subsequent holder conversations') : text('선택은 저장됐지만 현재 적용이 중지됨', 'Selection saved; application is currently paused')) : run.eligible ? (training.capability.available ? text('평가 통과 · 선택 가능', 'Evaluation passed · available to select') : text('평가 통과 · 현재 학습 실행 환경을 사용할 수 없음', 'Evaluation passed; the learning runtime is currently unavailable')) : text('평가 통과 · 현재 예제 또는 릴리스로 사용할 수 없음', 'Evaluation passed · examples or release no longer eligible')) : text('학습 초안 생성됨 · 평가 상태 확인 필요', 'Training draft created · check evaluation status')}</p>}
              {run.job?.status === 'READY' && run.eligible && !(training.publications ?? []).some((item) => item.runId === run.id) && <Button size="small" disabled={busy} onClick={() => setPublicationIntent({ identity, key: crypto.randomUUID(), runId: run.id, name: '', description: '', permanent: false, rights: false })}>{text('공유 공개 검토', 'Review shared publication')}</Button>}
              {run.job?.status === 'READY' && run.job.applicationVerified === true && run.eligible && training.capability.available && training.selectedRunId !== run.id && <Button size="small" disabled={busy} onClick={() => setSelectionIntent({ identity, key: crypto.randomUUID(), runId: run.id, model: run.model, consent: false })}>{text('이 학습 선택', 'Choose this lesson')}</Button>}
            </div>)}
            {(training.publications ?? []).map((item) => <div key={item.id} style={{ marginTop: 12 }}>
              {item.state === 'unknown' || item.state === 'submitting' ? <Alert $tone="error">{text('공개 제출 결과 확인이 필요합니다. 중복 공개를 막기 위해 새 요청을 제출할 수 없습니다. 노드 운영자가 상태를 확인해야 합니다.', 'Publication outcome needs reconciliation. A new submission is blocked to prevent duplicates. Ask the node operator to check the outcome.')}</Alert> : <p>{training.runs.find((run) => run.id === item.runId)?.job?.status === 'ANNOUNCED' || item.result?.status === 'ANNOUNCED' ? text('공유 지식 공개됨', 'Shared knowledge announced') : text('공개 요청 제출됨 · 운영자 검토 상태 확인', 'Publication submitted · check operator review status')}</p>}
            </div>)}
            {publicationIntent?.identity === identity && <div style={{ marginTop: 16 }}>
              <h4>{text('공유 지식 공개 검토', 'Review shared knowledge publication')}</h4>
              <p>{text('학습된 지식 파일을 CC-BY-4.0으로 무료 공개합니다. 원본 예제는 비공개로 유지합니다. 공개 파일에는 학습한 내용이 포함되며 공개 후 회수를 보장할 수 없습니다. 이 경로는 수익 배분이나 크레딧을 지급하지 않습니다.', 'Publish the learned knowledge file for free under CC-BY-4.0. Original examples remain private. The public file contains learned content and cannot be guaranteed recoverable after publication. This flow provides no payout share or credit reward.')}</p>
              <input aria-label={text('공유 지식 이름', 'Shared knowledge name')} disabled={busy} value={publicationIntent.name} maxLength={80} onChange={(event) => setPublicationIntent({ ...publicationIntent, name: event.target.value, permanent: false, rights: false, key: crypto.randomUUID() })} />
              <textarea aria-label={text('공유 지식 설명', 'Shared knowledge description')} disabled={busy} value={publicationIntent.description} maxLength={2000} onChange={(event) => setPublicationIntent({ ...publicationIntent, description: event.target.value, permanent: false, rights: false, key: crypto.randomUUID() })} style={{ width: '100%', minHeight: 80 }} />
              <label style={{ display: 'block' }}><input type="checkbox" disabled={busy} checked={publicationIntent.permanent} onChange={(event) => setPublicationIntent({ ...publicationIntent, permanent: event.target.checked })} />{text('공개 범위와 회수 제한을 확인했고 영구 공개에 동의합니다.', 'I reviewed the public scope and withdrawal limits and agree to permanent publication.')}</label>
              <label style={{ display: 'block' }}><input type="checkbox" disabled={busy} checked={publicationIntent.rights} onChange={(event) => setPublicationIntent({ ...publicationIntent, rights: event.target.checked })} />{text('학습한 내용을 이 라이선스로 공개할 권리가 있습니다.', 'I have the rights to publish the learned content under this license.')}</label>
              <div><Button size="small" disabled={busy || publicationIntent.name.trim().length < 2 || !publicationIntent.permanent || !publicationIntent.rights} onClick={() => void action(async () => {
                const wallet = (window as unknown as { ainetwork?: AinftWallet }).ainetwork;
                if (!wallet?.getAddress || !wallet.signMessage) throw new Error(text('AIN Wallet을 설치하고 보유 지갑을 여세요.', 'Install AIN Wallet and unlock the holder wallet.'));
                try { await publishCompanionLesson(wallet, auth.subject ?? '', publicationIntent, request, isCurrent); if (isCurrent()) setPublicationIntent(null); }
                finally { if (isCurrent()) await loadTraining(); }
              })}>{text('지갑 서명 후 공개 요청', 'Sign in wallet and submit publication')}</Button><Button size="small" variant="text" disabled={busy} onClick={() => setPublicationIntent(null)}>{text('취소', 'Cancel')}</Button></div>
            </div>}
            {training.selectedRunId && <Button size="small" disabled={busy} onClick={() => setSelectionIntent({ identity, key: crypto.randomUUID(), runId: null, model: training.runs.find((run) => run.id === training.selectedRunId)?.model ?? '', consent: false })}>{text('기본 상태로 되돌리기', 'Return to base behavior')}</Button>}
            {selectionIntent?.identity === identity && <div style={{ marginTop: 12 }}>
              <p>{selectionIntent.runId === null ? text('이후 대화에서 선택한 학습을 사용하지 않습니다. 학습 기록과 승인한 기억은 유지됩니다.', 'Subsequent conversations will stop using the selected lesson. Training records and approved memories remain.') : text('선택한 학습을 이후 보유자 전용 대화에 사용합니다. 공개 대화와 다른 지갑의 대화에는 적용하지 않습니다.', 'Use this lesson in subsequent holder conversations. Public conversations and other wallets do not use it.')}</p>
              <label><input type="checkbox" disabled={busy} checked={selectionIntent.consent} onChange={(event) => setSelectionIntent({ ...selectionIntent, consent: event.target.checked })} />{text('변경할 대화 상태를 확인했고 적용에 동의합니다.', 'I reviewed the conversation change and agree to apply it.')}</label>
              <div><Button size="small" disabled={busy || !selectionIntent.consent} onClick={() => void action(async () => {
                await request('/learning/select', { key: selectionIntent.key, runId: selectionIntent.runId, model: selectionIntent.model, consent: true });
                if (isCurrent()) setSelectionIntent(null);
              })}>{text('변경 적용', 'Apply change')}</Button><Button size="small" variant="text" disabled={busy} onClick={() => setSelectionIntent(null)}>{text('취소', 'Cancel')}</Button></div>
            </div>}
          </>}
        </div>
      </>}
    {error && <Alert $tone="error" style={{ marginTop: 12 }}>{error}</Alert>}
  </section>;
}
