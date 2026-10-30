import type { AgentPreviewRun, AgentPull, AgentRefsResponse } from '../api/types';

/** Only an untouched initial slot may choose a default. Missing explicit choices stay missing. */
export function selectedPreviewRun(runs: readonly AgentPreviewRun[], selected: string | null, initialIndex: number) {
  const id = selected === null ? runs[initialIndex]?.id ?? '' : selected;
  return { id, run: runs.find((run) => run.id === id) ?? null };
}

/** Reviewing a proposal compares against its actual base, including imported fork commit ids. */
export function agentHistorySelection(refs: AgentRefsResponse | undefined, branch: string | null, pull: AgentPull | null) {
  const head = typeof refs?.head === 'string' ? refs.head : '';
  const branches = Array.isArray(refs?.branches) ? refs.branches : [];
  const ref = pull ? pull.headCommit ?? pull.head : branch ?? head;
  const base = pull?.base ?? head;
  const commit = pull?.headCommit ?? branches.find((row) => row?.name === ref)?.sha ?? '';
  const baseCommit = branches.find((row) => row?.name === base)?.sha ?? '';
  const valid = !!refs && !!head && !!ref && !!base && !!commit && !!baseCommit
    && (!pull?.headAgent || !!pull.headCommit);
  return { head, ref, base, commit, baseCommit, valid, comparing: valid && ref !== base };
}
