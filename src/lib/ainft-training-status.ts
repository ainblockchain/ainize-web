export interface AinftTrainingStatus {
  status: string;
  applicationVerified?: boolean;
  progress?: { step: number; maxSteps: number; phase: string | null } | null;
}
export function ainftTrainingPending(job: AinftTrainingStatus | null, state: string): boolean {
  return job ? ['QUEUED', 'PREFLIGHT', 'LOADING', 'TRAINING', 'EXPORTED', 'CHECKING'].includes(job.status) : state === 'submitted';
}
export function ainftTrainingLabel(job: AinftTrainingStatus | null, state: string, locale: string): string {
  const text = (ko: string, en: string) => locale === 'ko' ? ko : en;
  if (!job) return state === 'submitted' ? text('학습 요청 접수됨', 'Training request received') : text('학습 제출 결과 확인 필요', 'Training submission needs review');
  if (job.status === 'TRAINING') {
    const progress = job.progress;
    if (progress?.phase === 'restore-serving') return text('대화 모델 다시 준비 중', 'Preparing the conversation model again');
    if (progress?.phase === 'load') return text('학습 모델 준비 중', 'Preparing the training model');
    if (progress?.phase === 'baseline') return text('학습 전 답변 확인 중', 'Checking answers before training');
    const valid = progress && Number.isInteger(progress.step) && Number.isInteger(progress.maxSteps)
      && progress.step >= 0 && progress.maxSteps > 0 && progress.step <= progress.maxSteps;
    return text('학습 중', 'Training') + (valid ? ` · ${progress.step}/${progress.maxSteps}` : '');
  }
  const labels: Record<string, [string, string]> = {
    QUEUED: ['학습 순서를 기다리는 중', 'Waiting for a training turn'],
    PREFLIGHT: ['학습 전 답변 확인 중', 'Checking answers before training'],
    LOADING: ['학습 모델 준비 중', 'Preparing the training model'],
    EXPORTED: ['학습 결과 평가 준비 중', 'Preparing to evaluate the lesson'],
    CHECKING: ['학습 결과 평가 중', 'Evaluating the lesson'],
    NEEDS_MORE: ['추가 학습이 필요함', 'More training needed'],
    FAILED: ['학습 실행 실패', 'Training failed'],
    CANCELLED: ['학습 취소됨', 'Training cancelled'],
    EXPIRED: ['학습 초안 만료됨', 'Lesson draft expired'],
    PENDING_REVIEW: ['공유 공개 검토 중', 'Shared publication under review'],
    ANNOUNCED: ['공유 공개 접수됨', 'Shared publication submitted'],
  };
  if (job.status === 'READY') return job.applicationVerified === true
    ? text('평가와 복원 검증 통과', 'Evaluation and restoration verified')
    : text('학습 완료 · 검증 확인 필요', 'Training finished; verification needs review');
  const label = labels[job.status]; return label ? text(...label) : text('학습 상태 확인 필요', 'Training status needs review');
}

export function ainftTrainingFailure(error: string, locale: string): string {
  const text = (ko: string, en: string) => locale === 'ko' ? ko : en;
  if (/out.?of.?memory|memory.*insufficient|not enough.*memory/i.test(error))
    return text('학습 모델을 실행할 메모리가 부족했습니다. 다음 요청 전에 실행 자원을 확인해야 합니다.', 'The training model ran out of memory. Its resources need checking before another request.');
  if (/timeout|timed out/i.test(error))
    return text('학습이 제한 시간 안에 끝나지 않았습니다. 작업 상태를 확인한 뒤 다시 요청하세요.', 'Training did not finish within its time limit. Check the job state before another request.');
  return text('학습을 완료하지 못했습니다. 운영자가 작업 기록을 확인해야 합니다.', 'Training could not be completed. The node operator needs to review its job record.');
}
