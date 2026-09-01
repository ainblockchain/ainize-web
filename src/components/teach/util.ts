/**
 * Teach mode v2 — copy and honesty helpers shared by the wizard screens.
 *
 * The two rules this file exists to enforce:
 *  - a row's status is rendered from its machine-readable `status` (+ the numbers in the row), never from the server's
 *    English `detail` sentence, so both locales say the same thing;
 *  - a minute figure appears only under design §10: >= 3 samples measured on THIS node with `backend: 'gradient'`,
 *    fitted for THIS question count, and never on a node whose timing is simulated.
 */
import type { PreflightFact, TeachDatasetRow, TeachEffort, TeachJob, TeachPolicy } from '@/api/types';

type Tr = (key: string, vars?: Record<string, string | number>) => string;

export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'info';
export interface StatusView { text: string; tone: Tone; help?: string; /** tone of the help line (default: muted grey) */ helpTone?: Tone }

export const EFFORTS: TeachEffort[] = ['quick', 'balanced', 'thorough'];
export const effortLabelKey = (e: TeachEffort) => `teach.set.effort_${e}`;
export const effortBodyKey = (e: TeachEffort) => `teach.set.effort_${e}_body`;
export const nextEffort = (e: TeachEffort): TeachEffort => (e === 'quick' ? 'balanced' : 'thorough');

const DEFAULT_STEPS: Record<TeachEffort, number> = { quick: 8, balanced: 20, thorough: 40 };
/** Training steps for a preset, as the node reports them (never a number this bundle invented). */
export function presetOf(policy: TeachPolicy | undefined, effort: TeachEffort): { max_steps: number; eval_every: number } {
  const p = policy?.effort?.find((e) => e.id === effort);
  return { max_steps: p?.max_steps ?? DEFAULT_STEPS[effort], eval_every: p?.eval_every ?? 2 };
}

/** The per-lesson question cap this node reports (design §D1: derived on the node, never hard-coded here). */
export function rowsPerJob(policy: TeachPolicy | undefined): number {
  return policy?.limits?.rows_per_job ?? policy?.limits?.facts_per_job ?? 8;
}

/**
 * Design §10: `t = load_s_p50 + passes x questions x s_per_row_p50`, and only when this node measured at least three
 * lessons on the gradient backend. Returns null everywhere else — the caller then says so in words.
 */
export function minutesFor(policy: TeachPolicy | undefined, effort: TeachEffort, rows: number): number | null {
  const timing = policy?.timing;
  if (!timing || timing.simulated || timing.samples < 3) return null;
  const perRow = timing.s_per_row_p50 ?? null;
  if (perRow === null) return null;
  const seconds = (timing.load_s_p50 ?? 0) + presetOf(policy, effort).max_steps * Math.max(1, rows) * perRow;
  return Math.max(1, Math.round(seconds / 60));
}

/** The one sentence an effort card may carry about duration. */
export function effortTime(policy: TeachPolicy | undefined, effort: TeachEffort, rows: number, t: Tr): string {
  const min = minutesFor(policy, effort, rows);
  return min === null ? t('teach.set.effort_time_unknown') : t('teach.set.time_rows', { min, n: rows });
}

const firstNumber = (s: string | undefined): number | null => {
  const m = /(\d+)/.exec(s ?? '');
  return m ? Number(m[1]) : null;
};

/** File-side status (parser): what the node decided about this source row, in the visitor's language. */
export function fileStatus(row: TeachDatasetRow, t: Tr, limits?: { prompt_max: number; answer_max: number }): StatusView {
  const promptMax = limits?.prompt_max ?? 400;
  const answerMax = limits?.answer_max ?? 200;
  switch (row.status) {
    case 'ok': return { text: t('teach.rows.status.new'), tone: 'ok' };
    case 'fixed': return { text: t('teach.rows.status.fixed'), tone: 'ok' };
    case 'duplicate': return { text: t('teach.rows.status.dupe', { n: firstNumber(row.detail) ?? row.line }), tone: 'muted' };
    case 'conflict': {
      const other = firstNumber(row.detail) ?? row.line;
      return { text: t('teach.rows.status.conflict'), tone: 'bad', help: t('teach.rows.bad.conflict', { a: row.line, b: other }) };
    }
    case 'too_long': {
      const q = (row.prompt ?? '').length; const a = (row.answer ?? '').length;
      return q > promptMax
        ? { text: t('teach.rows.bad.question_long', { n: q, max: promptMax }), tone: 'bad' }
        : { text: t('teach.rows.bad.answer_long', { n: a, max: answerMax }), tone: 'bad' };
    }
    case 'empty': return { text: row.prompt ? t('teach.rows.bad.no_answer') : t('teach.rows.bad.no_question'), tone: 'bad' };
    case 'blocked': return { text: t('teach.rows.status.blocked'), tone: 'bad' };
    case 'not_parsed': return { text: t('teach.rows.bad.parse', { line: row.line }), tone: 'bad' };
    case 'over_cap': return { text: t('teach.rows.status.over_cap'), tone: 'muted' };
    default: return { text: t('teach.rows.status.unchecked'), tone: 'muted' };
  }
}

/**
 * The advisory line (never blocks): questions that end the same way are very likely to be learned as one (§8.5).
 * The node's detail sentence counts the GROUP ('3 questions in this dataset end the same way'); this row is one of
 * them, so the line it prints must name the OTHERS — a group of three is "the same as 2 others", never 3.
 */
export function sharedEnding(row: TeachDatasetRow, t: Tr): string | null {
  if (!row.advisory?.includes('shared_ending')) return null;
  const group = firstNumber(row.detail) ?? 3;
  return t('teach.rows.status.shared_end', { n: Math.max(1, group - 1) });
}

/**
 * Model-side status: filled only after the pre-flight ran, and cleared the moment the visitor edits the row.
 *
 * `simulated` is the node's own `policy.simulated_checks`: on a stub node without a model server nothing was asked of
 * any model, so the quoted answer is a made-up one. It is still shown — it is what the node will act on — but it says
 * so and is drawn in the warning tone, because the visitor keeps or drops questions on the strength of it.
 */
export function modelStatus(f: PreflightFact | undefined, t: Tr, simulated = false): StatusView | null {
  if (!f) return null;
  const said = (answer: string) => ({ help: t(simulated ? 'teach.rows.model_said_sim' : 'teach.rows.model_said', { answer }), ...(simulated ? { helpTone: 'warn' as Tone } : {}) });
  switch (f.status) {
    case 'will_train': return { text: t('teach.rows.status.new'), tone: 'ok', ...(f.base_answer ? said(f.base_answer) : {}) };
    case 'already_known': return { text: t('teach.rows.status.known'), tone: 'muted', ...(f.base_answer ? said(f.base_answer) : {}) };
    case 'overlaps_listing': return { text: t('teach.rows.status.overlap', { name: f.detail ?? '' }), tone: 'muted' };
    default: return { text: t('teach.rows.status.unchecked'), tone: 'muted' };
  }
}

export const STAGES = ['queued', 'prep', 'warm', 'train', 'check', 'done'] as const;
export type Stage = (typeof STAGES)[number];

/** The v1 state machine, rendered as a stage rail (design §5.6). */
export function stageOf(status: string): Stage {
  switch (status) {
    case 'QUEUED': return 'queued';
    case 'PREFLIGHT': return 'prep';
    case 'LOADING': return 'warm';
    case 'TRAINING': return 'train';
    case 'EXPORTED': case 'CHECKING': return 'check';
    default: return 'done';
  }
}

export function elapsedText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const two = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m % 60)}:${two(s % 60)}` : `${two(m)}:${two(s % 60)}`;
}

/**
 * The only place a "time left" sentence is produced. It requires the node to have SENT an eta AND to have the three
 * gradient samples behind it; otherwise the visitor is told, in words, that this node cannot know yet.
 */
export function etaLine(job: TeachJob, policy: TeachPolicy | undefined, t: Tr): string {
  const timing = policy?.timing;
  const measured = !!timing && !timing.simulated && timing.samples >= 3;
  const eta = job.eta_s;
  if (!measured || !eta) return t('teach.run.eta_none');
  return eta < 90 ? t('teach.run.eta_soon') : t('teach.run.eta', { min: Math.max(1, Math.round(eta / 60)) });
}

/**
 * Where a dataset came from, as the OBJECT of a sentence ("3 questions from az-facts.jsonl."). A frozen chat basket
 * is a file too (§5.9), so it names its file when the caller knows it; every fallback is sentence-shaped.
 */
export function sourceLabel(source: string | undefined, name: string | undefined, t: Tr): string {
  switch (source) {
    case 'upload': return name ? t('teach.rows.source_file', { name }) : t('teach.rows.source_upload');
    case 'chat': return name ? t('teach.rows.source_file', { name }) : t('teach.rows.source_chat');
    case 'sample': return t('teach.rows.source_sample');
    default: return name ? t('teach.rows.source_file', { name }) : t('teach.rows.source_derived');
  }
}

/**
 * The same fact as a LABEL, for the "Where it came from" cell of a dataset card: the category, never the filename —
 * the card is already headed by the file's name, so repeating it there says nothing (design §5.8).
 */
export function sourceKind(source: string | undefined, t: Tr): string {
  switch (source) {
    case 'upload': return t('teach.data.source.upload');
    case 'chat': return t('teach.data.source.chat');
    case 'sample': return t('teach.data.source.sample');
    default: return t('teach.data.source.derived');
  }
}
