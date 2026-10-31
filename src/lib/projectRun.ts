import { inputAnswers, invalidInputs, missingInputs, parseEnvLines, projectRunEnvIssues, projectRunTimeout,
  type Deployment, type ManifestExample, type ManifestInput, type Project, type ProjectManifest, type ProjectSource, type RunInput } from '../api/projects';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const optionalText = (v: unknown) => v === undefined || typeof v === 'string';
const scalar = (v: unknown) => typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v);
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{40,64}$/.test(v);
const entryPath = (v: unknown): v is string => text(v) && v.length <= 200 && !/[\\\0\n\r]/.test(v) && !v.split('/').some(s => !s || s === '.' || s === '..');

function inputsValid(v: unknown): v is Record<string, ManifestInput> {
  return object(v) && Object.keys(v).length <= 16 && Object.entries(v).every(([name, spec]) =>
    /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && object(spec) && optionalText(spec.description)
    && (spec.type === undefined || typeof spec.type === 'string' && ['string', 'choice', 'boolean', 'number'].includes(spec.type))
    && (spec.required === undefined || typeof spec.required === 'boolean')
    && (spec.default === undefined || scalar(spec.default))
    && (spec.options === undefined || Array.isArray(spec.options) && spec.options.length <= 64 && spec.options.every(x => typeof x === 'string')));
}
function examplesValid(v: unknown): v is ManifestExample[] {
  return Array.isArray(v) && v.length <= 16 && v.every(ex => object(ex) && text(ex.name) && optionalText(ex.description)
    && object(ex.inputs) && Object.keys(ex.inputs).length <= 16 && Object.entries(ex.inputs).every(([name, value]) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && scalar(value)));
}
export function readRunManifest(raw: unknown): ProjectManifest | null {
  if (!object(raw) || typeof raw.kind !== 'string' || !['script', 'nextjs', 'service', 'agent'].includes(raw.kind)
    || !inputsValid(raw.inputs) || !examplesValid(raw.examples)
    || (raw.entry !== undefined && !entryPath(raw.entry))
    || (raw.kind === 'script' && !entryPath(raw.entry))
    || (raw.timeoutMs !== undefined && (!Number.isSafeInteger(raw.timeoutMs) || Number(raw.timeoutMs) < 1000 || Number(raw.timeoutMs) > 300_000))) return null;
  if (raw.run !== undefined) {
    if (!Array.isArray(raw.run) || raw.run.length > 16) return null;
    const seen = new Set<string>();
    for (const row of raw.run) {
      if (!object(row) || !entryPath(row.entry) || seen.has(row.entry) || !optionalText(row.name) || !optionalText(row.description)
        || (row.inputs !== undefined && !inputsValid(row.inputs)) || (row.examples !== undefined && !examplesValid(row.examples))) return null;
      seen.add(row.entry);
    }
  }
  return raw as unknown as ProjectManifest;
}

/** The selected source must belong to the requested repository/folder and version, not just contain a manifest. */
export function readProjectRunSource(raw: unknown, project: Pick<Project, 'repoId' | 'sourcePath' | 'activeCommit'>, target: 'head' | 'commit' | 'deployed', wantedSha?: string): ProjectSource | null {
  if (!object(raw) || !text(raw.repoId) || project.repoId && raw.repoId !== project.repoId
    || raw.sourcePath !== (project.sourcePath ?? '') || raw.target !== target || !sha(raw.sha)
    || target === 'commit' && raw.sha !== wantedSha || target === 'deployed' && raw.sha !== project.activeCommit
    || !readRunManifest(raw.manifest)) return null;
  return raw as unknown as ProjectSource;
}

/** Match node runTargets/runTargetOf: a primary script entry plus declarations, each with its own overrides. */
export function projectRunTargets(manifest: ProjectManifest | null | undefined) {
  const entries = manifest?.kind === 'script' && manifest.entry ? [manifest.entry] : [];
  for (const row of manifest?.run ?? []) if (!entries.includes(row.entry)) entries.push(row.entry);
  return entries.map(entry => {
    const declared = manifest!.run?.find(row => row.entry === entry);
    return { entry, name: declared?.name, description: declared?.description,
      inputs: declared?.inputs ?? manifest!.inputs, examples: declared?.examples ?? manifest!.examples };
  });
}

export interface ProjectRunDraft { target: 'head' | 'commit' | 'deployed'; sha: string; entry: string; answers: Record<string, string>; env: string; timeoutMs: string }
export function projectRunSelection(source: ProjectSource | null, entry: string) {
  const targets = projectRunTargets(source?.manifest);
  return { targets, selected: entry ? targets.find(row => row.entry === entry) ?? null : targets[0] ?? null };
}
export function prepareProjectRun(source: ProjectSource, draft: ProjectRunDraft): RunInput {
  const { selected } = projectRunSelection(source, draft.entry);
  const timeoutMs = projectRunTimeout(draft.timeoutMs);
  if (!selected || missingInputs(selected.inputs, draft.answers).length || invalidInputs(selected.inputs, draft.answers).length
    || projectRunEnvIssues(draft.env).length || timeoutMs === null) throw new Error('run_input');
  const inputs = inputAnswers(selected.inputs, draft.answers), env = parseEnvLines(draft.env);
  if (Object.values(inputs).some(value => value.length > 2048) || Object.keys(env).length > 32 || Object.values(env).some(value => value.length > 4096)) throw new Error('run_size');
  return { target: 'commit', sha: source.sha, entry: selected.entry, inputs, env, ...(timeoutMs === undefined ? {} : { timeoutMs }) };
}

/** Acceptance is not completion. Both response aliases must identify the same newly queued record. */
export function projectRunReceipt(raw: unknown): string | null {
  if (!object(raw) || !text(raw.deploymentId) || raw.deploymentId !== raw.deploymentId.trim() || typeof raw.status !== 'string' || !['queued', 'building'].includes(raw.status)
    || raw.runId !== undefined && raw.runId !== raw.deploymentId) return null;
  return raw.deploymentId;
}

export { readProjectRunHistory } from './projectHistory';

/** Exclude duplicate clicks synchronously; an unconfirmed submission cannot be repeated in this view. */
export function createProjectRunSubmission() {
  let pending = false, unknown = false;
  return {
    blocked: () => pending || unknown,
    async submit(send: () => Promise<unknown>): Promise<string | null> {
      if (pending || unknown) return null;
      pending = true;
      try {
        const id = projectRunReceipt(await send());
        if (!id) { unknown = true; throw new Error('run_unconfirmed'); }
        return id;
      } catch (error) {
        // Only an explicit client refusal establishes that this request was not admitted.
        const status = object(error) && typeof error.status === 'number' ? error.status : null;
        const code = object(error) && object(error.data) && object(error.data.error) ? error.data.error.code : null;
        if (status === null || status < 400 || status >= 500 || typeof code !== 'string'
          || !['not_signed_in', 'not_found', 'not_member', 'not_writer', 'invalid_request', 'not_a_script', 'no_deployment'].includes(code)) unknown = true;
        throw error;
      } finally { pending = false; }
    },
  };
}
