export interface Task { id: string; input: string; state: string; result: string | null; error: string | null; allowance?: { state: string; canRestore: boolean; canSettle: boolean } }
export interface Memory { id: string; text: string; state: string; sourceTask: string }
export interface LearningExample { id: string; prompt: string; answer: string; altPrompt?: string; state: string }
export interface Companion { tasks: Task[]; memories: Memory[]; learningExamples: LearningExample[]; experience: number; growthEvidence?: { id: string; kind: string; sourceId: string; experience: number; active: boolean }[]; growthPolicy?: { version: string } }
export interface Training { publications?: { id: string; runId: string; state: string; result: { status?: string } | null }[]; selectedRunId: string | null; capability: { available: boolean; model: string | null; reason: string | null; maxExamples?: number }; runs: { id: string; model: string; eligible: boolean; state: string; jobId: string | null; job: { status: string; error: string | null; draftId: string | null; applicationVerified?: boolean; verificationIssues?: string[]; progress?: { step: number; maxSteps: number; phase: string | null } | null } | null }[] }

const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): value is string => typeof value === 'string';
const nullableString = (value: unknown) => value === null || str(value);
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const rows = (value: unknown, valid: (row: Record<string, any>) => boolean): boolean => Array.isArray(value)
  && value.every(row => object(row) && str(row.id) && !!row.id && valid(row)) && new Set(value.map(row => row.id)).size === value.length;
const allowance = (value: unknown) => value === undefined || (object(value) && str(value.state) && typeof value.canRestore === 'boolean' && typeof value.canSettle === 'boolean');
const task = (row: Record<string, any>) => str(row.input) && str(row.state) && nullableString(row.result) && nullableString(row.error) && allowance(row.allowance);
const example = (row: Record<string, any>) => str(row.prompt) && str(row.answer) && ['reviewed', 'withdrawn'].includes(row.state) && (row.altPrompt === undefined || str(row.altPrompt));

export function companionView(value: unknown): Companion {
  if (!object(value) || !number(value.experience) || !rows(value.tasks, task)
    || !rows(value.memories, memory => str(memory.text) && str(memory.state) && str(memory.sourceTask))
    || (value.learningExamples !== undefined && !rows(value.learningExamples, example))
    || (value.growthEvidence !== undefined && !rows(value.growthEvidence, event => ['completed_work', 'approved_memory'].includes(event.kind) && str(event.sourceId) && number(event.experience) && typeof event.active === 'boolean'))
    || (value.growthPolicy !== undefined && (!object(value.growthPolicy) || !str(value.growthPolicy.version)))) throw new Error('Could not read the holder workspace. Try again.');
  return { ...value, learningExamples: value.learningExamples ?? [] } as Companion;
}
const progress = (value: unknown) => value == null || (object(value) && number(value.step) && number(value.maxSteps) && nullableString(value.phase));
const job = (value: unknown) => value === null || (object(value) && str(value.status) && nullableString(value.error) && nullableString(value.draftId)
  && (value.applicationVerified === undefined || typeof value.applicationVerified === 'boolean')
  && (value.verificationIssues === undefined || (Array.isArray(value.verificationIssues) && value.verificationIssues.every(str))) && progress(value.progress));
const publication = (row: Record<string, any>) => str(row.runId) && ['submitting', 'submitted', 'unknown'].includes(row.state)
  && (row.result === null || (object(row.result) && (row.result.status === undefined || str(row.result.status))));
export function trainingView(value: unknown): Training {
  if (!object(value) || !nullableString(value.selectedRunId) || !object(value.capability)
    || typeof value.capability.available !== 'boolean' || (value.capability.available && (!str(value.capability.model) || !value.capability.model.trim())) || !nullableString(value.capability.model) || !nullableString(value.capability.reason)
    || (value.capability.maxExamples !== undefined && (!Number.isSafeInteger(value.capability.maxExamples) || value.capability.maxExamples < 0))
    || !rows(value.runs, run => str(run.model) && str(run.state) && typeof run.eligible === 'boolean' && nullableString(run.jobId) && job(run.job))
    || (value.publications !== undefined && !rows(value.publications, publication))) throw new Error('Could not read model training status. Try again.');
  return value as unknown as Training;
}

export interface CompanionRewards { available: boolean; enrollment: { userId: string; appId: string; symbol: string; policyVersion: number } | null; rewards: { eventId: string; kind: string; state: string; appId: string; symbol: string }[] }
export function rewardsView(value: unknown): CompanionRewards {
  if (!object(value) || typeof value.available !== 'boolean'
    || (value.enrollment !== null && (!object(value.enrollment) || !str(value.enrollment.userId) || !str(value.enrollment.appId) || !str(value.enrollment.symbol) || !Number.isSafeInteger(value.enrollment.policyVersion) || value.enrollment.policyVersion < 1))
    || !Array.isArray(value.rewards) || !value.rewards.every(reward => object(reward) && str(reward.eventId) && ['completed_work', 'approved_memory'].includes(reward.kind) && ['pending', 'confirmed'].includes(reward.state) && str(reward.appId) && str(reward.symbol))) throw new Error('Could not read reward status. Try again.');
  return value as unknown as CompanionRewards;
}

/** Training consent belongs to the displayed model and exact example selection. */
export const trainingConsentKey = (model: string | null | undefined, examples: string[]) => JSON.stringify([model, examples]);
export const missingTrainingExamples = (examples: Companion['learningExamples'], selected: string[]) => selected.some(id => !examples.some(example => example.id === id && example.state === 'reviewed' && !!example.altPrompt?.trim()));

/** Paid work uses the holder's enrolled Factory account, not merely the user id typed into the balance box. */
export const rewardAccountMatches = (rewards: CompanionRewards, userId: string, community: { appId: string; symbol: string }) =>
  rewards.enrollment?.userId === userId && rewards.enrollment.appId === community.appId && rewards.enrollment.symbol === community.symbol;
