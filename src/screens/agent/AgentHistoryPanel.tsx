/**
 * An agent's history, the way a repository reads it.
 *
 * An agent used to be a number that went up: `v7`, with no way to ask what the seventh change was, who made
 * it, or what the prompt said before it. It is a git repository now — the node hosts it, `git push` to it is
 * the deploy — so this panel shows what that buys: the commits, the branches, and the diff of a proposal.
 *
 * Three things are deliberate. The clone address is at the top and copyable, because it is the one piece of
 * this page a person takes away. A branch is labelled by what it is — the one the node serves from, or a
 * proposal — rather than by its name, since "main" means nothing to somebody who has not been told. And the
 * prompt's diff is shown as a diff rather than as two versions side by side: a prompt is prose, and what a
 * reviewer needs to see is the sentence that changed.
 */
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { useAgentExecutionsQuery, useAgentCommitsQuery, useAgentDiffQuery, useAgentPullsQuery, useOpenAgentPullMutation, useMyAgentForksQuery, useCreateAgentForkMutation, useDeleteAgentForkMutation, useAddAgentReviewCommentMutation, useEditAgentReviewCommentMutation, useDeleteAgentReviewCommentMutation, useAgentRefsQuery, useMergeAgentPullMutation, useSyncAgentMirrorMutation } from '@/api/api';
import { agentHistorySelection } from '@/lib/agentHistorySelection';
import { useActiveView } from '@/hooks/useActiveView';
import { useClipboardCopy } from '@/hooks/useClipboardCopy';
import { useAuth } from '@/auth/AuthContext';
import type { AgentPull } from '@/api/types';
import type { AgentGitInfo } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Alert, Input, Select, Field, FieldLabel } from '@/components/ui/Form';
import { Description } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { PreviewPanel } from './PreviewPanel';
import { AgentPreviewHistory } from './AgentPreviewHistory';

const Box = styled.div`
  min-width: 0; overflow-wrap: anywhere;
  margin-top: 24px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; }
  @media (max-width: 640px) { padding: 16px; input, textarea, select { font-size: 16px; min-height: 44px; } button { min-height: 44px; } }
`;
const Clone = styled.div`
  display: flex; gap: 8px; align-items: center; margin-top: 12px; flex-wrap: wrap;
  code {
    flex: 1 1 320px; min-width: 0; padding: 8px 10px; border-radius: 4px; overflow-x: auto; white-space: nowrap;
    background: ${(p) => p.theme.color.PALE_GREY}; font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px;
  }
`;
const Commits = styled.ol`
  margin: 16px 0 0; padding: 0; list-style: none; border-top: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const Commit = styled.li`
  padding: 10px 0; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap;
  strong { font-weight: 600; font-size: 14px; }
  span { font-size: 12.5px; color: ${(p) => p.theme.color.GREY}; }
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
`;
const Branches = styled.div`display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px;`;
const Branch = styled.button<{ $on: boolean }>`
  padding: 6px 12px; border-radius: 999px; font: inherit; font-size: 12.5px; cursor: pointer;
  border: 1px solid ${(p) => (p.$on ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$on ? p.theme.color.PRIMARY : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : 'inherit')};
  small { opacity: 0.75; margin-left: 6px; }
`;
const Mirror = styled.div<{ $bad: boolean }>`
  margin-top: 12px; padding: 12px 14px; border-radius: 6px; font-size: 13px; line-height: 1.7;
  display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;
  border: 1px solid ${(p) => (p.$bad ? '#e0b088' : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$bad ? '#fff6ec' : p.theme.color.PALE_GREY)};
  color: ${(p) => (p.$bad ? '#8a4b00' : 'inherit')};
`;
const Why = styled.div`margin-top: 6px; font-size: 12.5px; white-space: pre-wrap; opacity: 0.9;`;
const Pulls = styled.div`margin-top: 16px; display: flex; flex-direction: column; gap: 8px;`;
const Pull = styled.div`
  display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap;
  padding: 12px 14px; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px;
  strong { display: block; font-size: 14px; font-weight: 600; }
  span { display: block; margin-top: 4px; font-size: 12.5px; color: ${(p) => p.theme.color.GREY}; }
  > div:last-child { display: flex; gap: 8px; }
`;
const Diff = styled.pre`
  margin: 14px 0 0; padding: 14px; border-radius: 4px; background: #303133; color: #f2f2f2;
  max-height: 420px; overflow: auto; font-size: 12px; line-height: 1.55; white-space: pre;
`;

const when = (at: number, locale: string) => new Date(at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
/** An author is an address or an email; neither is readable at full length in a list. */
const who = (name: string) => (/^0x[0-9a-fA-F]{40}$/.test(name) ? `${name.slice(0, 6)}…${name.slice(-4)}` : name);


function ReviewThread({ id, pull, canMerge }: { id: string; pull: AgentPull; canMerge: boolean }) {
  const { t } = useT();
  const active = useActiveView();
  const pending = useRef(false);
  const { isSignedIn, principal } = useAuth();
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [add, adding] = useAddAgentReviewCommentMutation();
  const [edit, editingState] = useEditAgentReviewCommentMutation();
  const [remove, removing] = useDeleteAgentReviewCommentMutation();
  const report = (e: unknown) => { if (active()) setError(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e)); };
  const busy = adding.isLoading || editingState.isLoading || removing.isLoading;
  const submit = async () => {
    if (pending.current || !active() || !body.trim()) return;
    pending.current = true;
    setError(null);
    try {
      if (editing !== null) await edit({ id, number: pull.number, comment: editing, body }).unwrap();
      else await add({ id, number: pull.number, body }).unwrap();
      if (active()) { setBody(''); setEditing(null); }
    } catch (e) { report(e); } finally { pending.current = false; }
  };
  const removeComment = async (comment: number) => {
    if (pending.current || !active()) return;
    pending.current = true; setError(null);
    try {
      await remove({ id, number: pull.number, comment }).unwrap();
      if (active() && editing === comment) { setEditing(null); setBody(''); }
    } catch (e) { report(e); } finally { pending.current = false; }
  };
  return <section style={{ flexBasis: '100%', minWidth: 0 }} aria-label={t('agentGit.comments')}>
    {pull.body && <Description style={{ whiteSpace: 'pre-wrap' }}>{pull.body}</Description>}
    {(pull.comments ?? []).map((comment) => <div key={comment.id} style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
      <strong>{who(comment.author)}</strong>
      {comment.path && <code>{comment.commit?.slice(0, 7)} · {comment.path}:{comment.line}</code>}
      <Description>{comment.deletedAt ? t('agentGit.comment_deleted') : comment.body}</Description>
      {!comment.deletedAt && isSignedIn && <div>
        {principal === comment.author && <Button size="small" disabled={busy} onClick={() => { setEditing(comment.id); setBody(comment.body); }}>{t('agentGit.comment_edit')}</Button>}
        {(principal === comment.author || canMerge) && <Button size="small" loading={removing.isLoading} disabled={busy} onClick={() => void removeComment(comment.id)}>{t('agentGit.comment_delete')}</Button>}
      </div>}
    </div>)}
    {isSignedIn && <Field style={{ marginTop: 12 }}><FieldLabel htmlFor={`review-${pull.number}`}>{t('agentGit.comments')}</FieldLabel><Input disabled={busy} id={`review-${pull.number}`} as="textarea" value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
      <div><Button size="small" disabled={!body.trim() || busy} loading={adding.isLoading || editingState.isLoading} onClick={() => void submit()}>{t(editing === null ? 'agentGit.comment_add' : 'agentGit.comment_save')}</Button>
      {editing !== null && <Button size="small" disabled={busy} onClick={() => { setEditing(null); setBody(''); }}>{t('agentGit.comment_cancel')}</Button>}</div>
    </Field>}
    {error && <Alert $tone="error">{error}</Alert>}
  </section>;
}

interface HistoryProps { agentId: string; git?: AgentGitInfo | null; canMerge?: boolean }
export function AgentHistoryPanel(props: HistoryProps) {
  const { cacheIdentity } = useAuth();
  return <AgentHistoryContent key={`${cacheIdentity}:${props.agentId}`} {...props} />;
}

function AgentHistoryContent({ agentId, git, canMerge = false }: HistoryProps) {
  const { t, locale } = useT();
  const { isSignedIn, cacheIdentity } = useAuth();
  const active = useActiveView();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [openPull, opening] = useOpenAgentPullMutation();
  const forks = useMyAgentForksQuery(cacheIdentity, { skip: !isSignedIn });
  const [createFork, creatingFork] = useCreateAgentForkMutation();
  const [deleteFork, deletingFork] = useDeleteAgentForkMutation();
  const [forkId, setForkId] = useState('');
  const [forkBranch, setForkBranch] = useState('main');
  const forkRefs = useAgentRefsQuery({ id: forkId, identity: cacheIdentity }, { skip: !forkId });

  const [executionOffset, setExecutionOffset] = useState(0);
  useEffect(() => setExecutionOffset(0), [agentId]);
  const executions = useAgentExecutionsQuery({ id: agentId, identity: cacheIdentity, offset: executionOffset, limit: 10 }, { pollingInterval: 10_000 });
  const [branch, setBranch] = useState<string | null>(null);
  const [review, setReview] = useState<AgentPull | null>(null);
  const refs = useAgentRefsQuery({ id: agentId, identity: cacheIdentity });
  const selection = agentHistorySelection(refs.error ? undefined : refs.currentData, branch, review);
  const { head, ref, base, commit, baseCommit, valid: validSelection, comparing } = selection;
  const commits = useAgentCommitsQuery({ id: agentId, identity: cacheIdentity, ref: commit, limit: 20 }, { skip: !validSelection });
  const diff = useAgentDiffQuery({ id: agentId, identity: cacheIdentity, base: baseCommit, head: commit }, { skip: !comparing });
  const pulls = useAgentPullsQuery({ id: agentId, identity: cacheIdentity });
  const [merge, mergeState] = useMergeAgentPullMutation();
  const [sync, syncState] = useSyncAgentMirrorMutation();
  const [failed, setFailed] = useState<string | null>(null);
  const mirror = git?.mirror ?? null;

  const readFailure = (retry: () => unknown) => <Alert role="alert" $tone="error">
    {t('agentGit.read_failed')} <Button size="small" onClick={() => void retry()}>{t('aincode.retry')}</Button>
  </Alert>;
  const refData = refs.error ? undefined : refs.currentData;
  const commitData = commits.error || !validSelection ? undefined : commits.currentData;
  const forkData = forks.error ? undefined : forks.currentData;
  const forkRefData = forkRefs.error ? undefined : forkRefs.currentData;
  const pullData = pulls.error ? undefined : pulls.currentData;
  const executionData = executions.error ? undefined : executions.currentData;
  const diffData = diff.error || !comparing ? undefined : diff.currentData;
  const cloneUrl = refData?.clone_url ?? commitData?.clone_url ?? '';
  const copy = useClipboardCopy(cloneUrl ? `git clone ${cloneUrl}` : '');
  const sourceValid = !forkId || (!!forkData?.forks.some((fork) => fork.id === forkId && fork.parent === agentId) && !!forkRefData?.branches.some((entry) => entry.name === forkBranch));
  const actionPending = useRef(false);
  const actionBusy = opening.isLoading || creatingFork.isLoading || deletingFork.isLoading || mergeState.isLoading || syncState.isLoading;
  const perform = async <T,>(work: () => Promise<T>, after?: (value: T) => void) => {
    if (actionPending.current || !active()) return;
    actionPending.current = true; setFailed(null);
    try { const value = await work(); if (active()) after?.(value); }
    catch (error) { if (active()) setFailed(String((error as { data?: { error?: { message?: string } } })?.data?.error?.message ?? error)); }
    finally { actionPending.current = false; }
  };

  return (
    <Box data-testid="agent-history">
      <h3>{t('agentGit.title')}</h3>
      <Description>{t('agentGit.lede')}</Description>

      {/* A mirrored agent is read-only here, and saying so beside the clone box is the difference between a
          person pushing to the right place and a person discovering it from a rejected push. */}
      {mirror && (
        <Mirror data-testid="agent-mirror" $bad={!!mirror.error}>
          <div>
            {mirror.error
              ? t('agentGit.mirror_failed', { url: mirror.url })
              : t('agentGit.mirror_ok', { url: mirror.url, branch: mirror.branch })}
            {mirror.error && <Why>{mirror.error}</Why>}
          </div>
          {canMerge && (
            <Button size="small" variant="outlined" loading={syncState.isLoading}
              disabled={actionBusy} onClick={() => void perform(() => sync(agentId).unwrap())}>
              {t('agentGit.sync_now')}
            </Button>
          )}
        </Mirror>
      )}

      {cloneUrl && !mirror && (
        <Clone>
          <code data-testid="agent-clone-url">git clone {cloneUrl}</code>
          <Button type="button" size="small" variant="outlined" disabled={copy.disabled} aria-busy={copy.phase === 'copying'} aria-live="polite" onClick={() => void copy.copy()}>{copy.phase === 'copied' ? t('agentGit.copied') : copy.phase === 'copying' ? t('common.copying') : t('agentGit.copy')}</Button>
          {copy.phase === 'failed' && <Alert role="alert" $tone="error">{t('agentPage.copy_failed')}</Alert>}
        </Clone>
      )}

      {refs.error && readFailure(() => refs.refetch())}
      {!refs.error && !refData && <Description role="status">{t('agentGit.loading')}</Description>}
      {refData && !validSelection && <Alert $tone="warning">{t('agentGit.selection_missing')}</Alert>}
      {review && <Description role="status">#{review.number} {review.title} · {base} ← {ref}</Description>}
      {(refData?.branches.length ?? 0) > 0 && (
        <Branches data-testid="agent-branches">
          {refData!.branches.map((b) => (
            <Branch key={b.name} $on={b.name === ref} disabled={actionBusy} onClick={() => { setReview(null); setBranch(b.name); setTitle(''); setBody(''); }} type="button">
              {b.name}
              {b.name === head
                ? <small>{t('agentGit.live')}</small>
                : <small>{t('agentGit.ahead', { n: b.ahead ?? 0 })}</small>}
            </Branch>
          ))}
        </Branches>
      )}

      {comparing && (
        <Alert $tone="info" style={{ marginTop: 14 }} data-testid="agent-branch-note">
          {t('agentGit.proposal', { branch: ref, head: base })}
        </Alert>
      )}

      {isSignedIn && validSelection && <PreviewPanel key={`${agentId}:${commit}`} agentId={agentId} refName={commit} />}
      {isSignedIn && !mirror && <section style={{ marginTop: 16 }}>
        <Button loading={creatingFork.isLoading} disabled={actionBusy || !validSelection} onClick={() => void perform(() => createFork({ id: agentId, ref: commit }).unwrap(), ({ fork }) => { setForkId(fork.id); setForkBranch('main'); })}>{t('agentGit.fork_create')}</Button>
        {forks.error && readFailure(() => forks.refetch())}
        <Field><FieldLabel htmlFor="proposal-source">{t('agentGit.fork_source')}</FieldLabel><Select id="proposal-source" disabled={actionBusy || !!forks.error || !forkData} value={forkId} onChange={(e) => { setForkId(e.target.value); setForkBranch('main'); }}>
          <option value="">{t('agentGit.fork_current')}</option>
          {forkId && !forkData?.forks.some((fork) => fork.id === forkId && fork.parent === agentId) && <option value={forkId}>{t('agentGit.selection_missing')}</option>}
          {(forkData?.forks ?? []).filter((fork) => fork.parent === agentId).map((fork) => <option key={fork.id} value={fork.id}>{fork.id}</option>)}
        </Select></Field>
        {forkId && <>
          <Description>{t('agentGit.fork_help')}</Description>
          {forkRefData?.clone_url && <Clone><code>git clone {forkRefData.clone_url}</code></Clone>}
          <Field><FieldLabel htmlFor="fork-branch">{t('agentGit.fork_branch')}</FieldLabel><Input id="fork-branch" disabled={actionBusy} value={forkBranch} onChange={(e) => setForkBranch(e.target.value)} /></Field>
          {forkRefs.error && readFailure(() => forkRefs.refetch())}
          {!sourceValid && <Alert $tone="warning">{t('agentGit.selection_missing')}</Alert>}
          <Button loading={deletingFork.isLoading} disabled={actionBusy || !forkData?.forks.some((fork) => fork.id === forkId && fork.parent === agentId)} onClick={() => void perform(() => deleteFork(forkId).unwrap(), () => setForkId(''))}>{t('agentGit.fork_delete')}</Button>
        </>}
      </section>}
      {isSignedIn && !review && (comparing || forkId) && !mirror && <section style={{ marginTop: 16 }}>
        <Field><FieldLabel htmlFor="proposal-title">{t('agentGit.pull_title')}</FieldLabel><Input id="proposal-title" disabled={actionBusy} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor="proposal-body">{t('agentGit.pull_body')}</FieldLabel><Input id="proposal-body" disabled={actionBusy} as="textarea" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} /></Field>
        <Button disabled={actionBusy || !title.trim() || !validSelection || !sourceValid} loading={opening.isLoading} onClick={() => void perform(() => openPull({ id: agentId, title, body, head: forkId ? forkBranch : ref, base: head, ...(forkId ? { headAgent: forkId } : {}) }).unwrap(), () => { setTitle(''); setBody(''); })}>{t('agentGit.pull_create')}</Button>
      </section>}
      {pulls.error && readFailure(() => pulls.refetch())}
      {(pullData?.pulls.length ?? 0) > 0 && (
        <Pulls data-testid="agent-pulls">
          {pullData!.pulls.map((p) => (
            <Pull key={p.number}>
              <div>
                <strong>#{p.number} {p.title}</strong><span>{t(`agentGit.state_${p.state}`)}</span>
                <span>{t('agentGit.pull_from', { head: p.headAgent ? `${p.headAgent}/${p.head}` : p.head, base: p.base, who: who(p.author) })}</span>
              </div>
              <div>
                <Button size="small" variant="text" disabled={actionBusy} onClick={() => { setReview(p); setTitle(''); setBody(''); }}>{t('agentGit.pull_review')}</Button>
                {/* Merging is the deploy, so it is offered only to the people who could have pushed it. */}
                {canMerge && !mirror && p.state === 'open' && (
                  <Button size="small" loading={mergeState.isLoading}
                    disabled={actionBusy} onClick={() => void perform(() => merge({ id: agentId, number: p.number }).unwrap())}>
                    {t('agentGit.pull_merge')}
                  </Button>
                )}
              </div>
              <ReviewThread id={agentId} pull={p} canMerge={canMerge} />
            </Pull>
          ))}
        </Pulls>
      )}
      {failed && <Alert $tone="error" style={{ marginTop: 12 }} data-testid="agent-git-error">{failed}</Alert>}

      {executions.error && readFailure(() => executions.refetch())}
      {executionData && <section aria-label={t('agentGit.executions')} style={{ marginTop: 20 }}>
        <h3>{t('agentGit.executions')}</h3>
        <Commits data-testid="agent-executions">
          {executionData.executions.map((execution) => <Commit key={execution.id}>
            <strong>{t(`agentGit.execution.${execution.status}`)}</strong>
            <code title={execution.sourceCommit ?? undefined}>{execution.sourceCommit?.slice(0, 8) ?? '—'}</code>
            <span>{execution.actor ? who(execution.actor) : '—'}</span>
            <span>{when(execution.createdAt, locale)}</span>
            {execution.error && <Why role="status">{execution.error}</Why>}
          </Commit>)}
        </Commits>
        {executionData.total === 0 && <Description>{t('agentGit.executions_empty')}</Description>}
        <Branches>
          <Button variant="outlined" disabled={executionOffset === 0 || executions.isFetching} onClick={() => setExecutionOffset((offset) => Math.max(0, offset - 10))}>{t('agentGit.newer')}</Button>
          <Button variant="outlined" disabled={executionOffset + 10 >= executionData.total || executions.isFetching} onClick={() => setExecutionOffset((offset) => offset + 10)}>{t('agentGit.older')}</Button>
        </Branches>
      </section>}

      {isSignedIn && <AgentPreviewHistory agentId={agentId} />}
      {commits.error && validSelection && readFailure(() => commits.refetch())}
      {commits.isFetching && !commitData && <Description role="status">{t('agentGit.loading')}</Description>}
      <Commits data-testid="agent-commits">
        {(commitData?.commits ?? []).map((c) => (
          <Commit key={c.sha}>
            <strong>{c.subject}</strong>
            <span>{who(c.author)}</span>
            <span>{when(c.at, locale)}</span>
            <code>{c.short}</code>
          </Commit>
        ))}
      </Commits>
      {commitData && commitData.commits.length === 0 && <Description>{t('agentGit.empty')}</Description>}

      {comparing && diff.error && readFailure(() => diff.refetch())}
      {comparing && diffData && (
        <>
          <Diff data-testid="agent-diff">{diffData.diff || t('agentGit.no_changes')}</Diff>
          {diffData.truncated && <Description>{t('agentGit.diff_truncated')}</Description>}
        </>
      )}
    </Box>
  );
}

export default AgentHistoryPanel;
