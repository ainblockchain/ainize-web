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
import { useAgentExecutionsQuery, useAgentCommitsQuery, useAgentDiffQuery, useAgentPullsQuery, useOpenAgentPullMutation, useCreateAgentPreviewMutation, useAgentPreviewQuery, useDeleteAgentPreviewMutation, useChatAgentPreviewMutation, useMyAgentForksQuery, useCreateAgentForkMutation, useDeleteAgentForkMutation, useAddAgentReviewCommentMutation, useEditAgentReviewCommentMutation, useDeleteAgentReviewCommentMutation, useAgentRefsQuery, useMergeAgentPullMutation, useSyncAgentMirrorMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import type { AgentPull } from '@/api/types';
import type { AgentGitInfo } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Alert, Input, Select, Field, FieldLabel } from '@/components/ui/Form';
import { Description } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { AgentPreviewHistory } from './AgentPreviewHistory';
import { A2UISurface, readSurface } from '@/components/a2ui/A2UISurface';

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

function PreviewPanel({ agentId, refName }: { agentId: string; refName: string }) {
  const { t } = useT();
  const [create, creating] = useCreateAgentPreviewMutation();
  const [remove] = useDeleteAgentPreviewMutation();
  const [chat, chatting] = useChatAgentPreviewMutation();
  const [id, setId] = useState('');
  const [message, setMessage] = useState('');
  const [context, setContext] = useState<string | undefined>();
  const [reply, setReply] = useState<{ parts?: Parameters<typeof readSurface>[0]; contextId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<ReturnType<typeof chat> | null>(null);
  const query = useAgentPreviewQuery(id, { skip: !id, pollingInterval: 2000 });
  const preview = query.currentData?.preview;
  const surface = readSurface(reply?.parts ?? []);
  useEffect(() => () => { pending.current?.abort(); if (id) void remove(id); }, [id, remove]);
  const report = (e: unknown) => setError(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e));
  const start = async () => {
    setError(null);
    try {
      if (id) await remove(id).unwrap().catch(() => {});
      const created = await create({ id: agentId, ref: refName }).unwrap();
      setId(created.preview.id); setReply(null); setContext(undefined);
    } catch (e) { report(e); }
  };
  const send = async () => {
    setError(null);
    const request = chat({ id, body: { jsonrpc: '2.0', id: crypto.randomUUID(), method: 'message/send', params: { message: { kind: 'message', role: 'user', messageId: crypto.randomUUID(), ...(context ? { contextId: context } : {}), parts: [{ kind: 'text', text: message }] }, configuration: { blocking: true } } } });
    pending.current = request;
    try {
      const body = await request.unwrap() as { result?: { parts?: Parameters<typeof readSurface>[0]; contextId?: string }; error?: { message?: string } };
      if (body.error) throw new Error(body.error.message ?? 'RPC error');
      setReply(body.result ?? null); setContext(body.result?.contextId); setMessage('');
    } catch (e) { if ((e as { name?: string }).name === 'AbortError') setError(t('agentGit.preview_stopped')); else report(e); }
    finally { if (pending.current === request) pending.current = null; }
  };
  return <section style={{ marginTop: 16, minWidth: 0 }}>
    <Button loading={creating.isLoading} disabled={!!id && !query.isError && preview?.status !== 'error'} onClick={() => void start()}>{t('agentGit.preview_create')}</Button>
    <Description>{t('agentGit.preview_help')}</Description>
    {id && <>
      {query.isError ? <Alert $tone="error">{t('agentGit.preview_expired')}</Alert> : preview?.status === 'error' ? <Alert $tone="error">{preview.error}</Alert> : preview?.status !== 'ready' ? <Description>{t('agentGit.preview_building')}</Description> : <>
        <code>{preview.commit.slice(0, 12)} · {new Date(preview.expiresAt).toLocaleTimeString()}</code>
        <Field><FieldLabel htmlFor="preview-message">{t('agentGit.preview_message')}</FieldLabel><Input id="preview-message" as="textarea" value={message} maxLength={20000} disabled={chatting.isLoading} onChange={(e) => setMessage(e.target.value)} /></Field>
        <Button loading={chatting.isLoading} disabled={!message.trim()} onClick={() => void send()}>{t('agentGit.preview_send')}</Button>
        {chatting.isLoading && <Button onClick={() => pending.current?.abort()}>{t('agentGit.preview_cancel')}</Button>}
        {reply && <div aria-live="polite">{(reply.parts ?? []).map((part, index) => { const text = (part as { text?: string }).text; return text ? <Description key={index} style={{ whiteSpace: 'pre-wrap' }}>{text}</Description> : null; })}{surface && <A2UISurface surface={surface} />}</div>}
      </>}
      <Button onClick={() => { pending.current?.abort(); setId(''); }}>{t('agentGit.preview_stop')}</Button>
    </>}
    {error && <Alert $tone="error">{error}</Alert>}
  </section>;
}

function ReviewThread({ id, pull, canMerge }: { id: string; pull: AgentPull; canMerge: boolean }) {
  const { t } = useT();
  const { isSignedIn, principal } = useAuth();
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [add, adding] = useAddAgentReviewCommentMutation();
  const [edit, editingState] = useEditAgentReviewCommentMutation();
  const [remove, removing] = useDeleteAgentReviewCommentMutation();
  const report = (e: unknown) => setError(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e));
  const submit = async () => {
    setError(null);
    try {
      if (editing !== null) await edit({ id, number: pull.number, comment: editing, body }).unwrap();
      else await add({ id, number: pull.number, body }).unwrap();
      setBody(''); setEditing(null);
    } catch (e) { report(e); }
  };
  return <section style={{ flexBasis: '100%', minWidth: 0 }} aria-label={t('agentGit.comments')}>
    {pull.body && <Description style={{ whiteSpace: 'pre-wrap' }}>{pull.body}</Description>}
    {(pull.comments ?? []).map((comment) => <div key={comment.id} style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>
      <strong>{who(comment.author)}</strong>
      {comment.path && <code>{comment.commit?.slice(0, 7)} · {comment.path}:{comment.line}</code>}
      <Description>{comment.deletedAt ? t('agentGit.comment_deleted') : comment.body}</Description>
      {!comment.deletedAt && isSignedIn && <div>
        {principal === comment.author && <Button size="small" onClick={() => { setEditing(comment.id); setBody(comment.body); }}>{t('agentGit.comment_edit')}</Button>}
        {(principal === comment.author || canMerge) && <Button size="small" loading={removing.isLoading} onClick={() => { setError(null); void remove({ id, number: pull.number, comment: comment.id }).unwrap().catch(report); }}>{t('agentGit.comment_delete')}</Button>}
      </div>}
    </div>)}
    {isSignedIn && <Field style={{ marginTop: 12 }}><FieldLabel htmlFor={`review-${pull.number}`}>{t('agentGit.comments')}</FieldLabel><Input id={`review-${pull.number}`} as="textarea" value={body} maxLength={8000} onChange={(e) => setBody(e.target.value)} />
      <div><Button size="small" disabled={!body.trim()} loading={adding.isLoading || editingState.isLoading} onClick={() => void submit()}>{t(editing === null ? 'agentGit.comment_add' : 'agentGit.comment_save')}</Button>
      {editing !== null && <Button size="small" onClick={() => { setEditing(null); setBody(''); }}>{t('agentGit.comment_cancel')}</Button>}</div>
    </Field>}
    {error && <Alert $tone="error">{error}</Alert>}
  </section>;
}

export function AgentHistoryPanel({ agentId, git, canMerge = false }: { agentId: string; git?: AgentGitInfo | null; canMerge?: boolean }) {
  const { t, locale } = useT();
  const { isSignedIn } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [openPull, opening] = useOpenAgentPullMutation();
  const forks = useMyAgentForksQuery(undefined, { skip: !isSignedIn });
  const [createFork, creatingFork] = useCreateAgentForkMutation();
  const [deleteFork, deletingFork] = useDeleteAgentForkMutation();
  const [forkId, setForkId] = useState('');
  const [forkBranch, setForkBranch] = useState('main');
  const forkRefs = useAgentRefsQuery(forkId, { skip: !forkId });

  const [executionOffset, setExecutionOffset] = useState(0);
  useEffect(() => setExecutionOffset(0), [agentId]);
  const executions = useAgentExecutionsQuery({ id: agentId, offset: executionOffset, limit: 10 }, { pollingInterval: 10_000 });
  const [branch, setBranch] = useState<string | null>(null);
  const refs = useAgentRefsQuery(agentId);
  const head = refs.data?.head ?? 'main';
  const ref = branch ?? head;
  const commits = useAgentCommitsQuery({ id: agentId, ref, limit: 20 });
  // A proposal is worth a diff; the deployed branch compared against itself is not.
  const comparing = ref !== head;
  const diff = useAgentDiffQuery({ id: agentId, base: head, head: ref }, { skip: !comparing });
  const [copied, setCopied] = useState(false);
  const pulls = useAgentPullsQuery({ id: agentId });
  const [merge, mergeState] = useMergeAgentPullMutation();
  const [sync, syncState] = useSyncAgentMirrorMutation();
  const [failed, setFailed] = useState<string | null>(null);
  const mirror = git?.mirror ?? null;

  // A node too old to host repositories, or an agent whose repository could not be made: say nothing rather
  // than show an empty history, which reads as "this agent has never changed".
  if (refs.isError || commits.isError) return null;
  const cloneUrl = refs.data?.clone_url ?? commits.data?.clone_url ?? '';

  const copy = async () => {
    try { await navigator.clipboard.writeText(`git clone ${cloneUrl}`); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { /* a browser that refuses the clipboard still shows the address */ }
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
              onClick={() => { setFailed(null); sync(agentId).unwrap().catch((e: unknown) => setFailed(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e))); }}>
              {t('agentGit.sync_now')}
            </Button>
          )}
        </Mirror>
      )}

      {cloneUrl && !mirror && (
        <Clone>
          <code data-testid="agent-clone-url">git clone {cloneUrl}</code>
          <Button size="small" variant="outlined" onClick={() => void copy()}>{copied ? t('agentGit.copied') : t('agentGit.copy')}</Button>
        </Clone>
      )}

      {(refs.data?.branches.length ?? 0) > 1 && (
        <Branches data-testid="agent-branches">
          {refs.data!.branches.map((b) => (
            <Branch key={b.name} $on={b.name === ref} onClick={() => setBranch(b.name)} type="button">
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
          {t('agentGit.proposal', { branch: ref, head })}
        </Alert>
      )}

      {isSignedIn && <PreviewPanel key={`${agentId}:${ref}`} agentId={agentId} refName={ref} />}
      {isSignedIn && !mirror && <section style={{ marginTop: 16 }}>
        <Button loading={creatingFork.isLoading} onClick={() => { setFailed(null); void createFork({ id: agentId, ref }).unwrap().then(({ fork }) => { setForkId(fork.id); setForkBranch('main'); }).catch((e: unknown) => setFailed(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e))); }}>{t('agentGit.fork_create')}</Button>
        <Field><FieldLabel htmlFor="proposal-source">{t('agentGit.fork_source')}</FieldLabel><Select id="proposal-source" value={forkId} onChange={(e) => { setForkId(e.target.value); setForkBranch('main'); }}>
          <option value="">{t('agentGit.fork_current')}</option>
          {(forks.data?.forks ?? []).filter((fork) => fork.parent === agentId).map((fork) => <option key={fork.id} value={fork.id}>{fork.id}</option>)}
        </Select></Field>
        {forkId && <>
          <Description>{t('agentGit.fork_help')}</Description>
          {forkRefs.data?.clone_url && <Clone><code>git clone {forkRefs.data.clone_url}</code></Clone>}
          <Field><FieldLabel htmlFor="fork-branch">{t('agentGit.fork_branch')}</FieldLabel><Input id="fork-branch" value={forkBranch} onChange={(e) => setForkBranch(e.target.value)} /></Field>
          <Button loading={deletingFork.isLoading} onClick={() => { setFailed(null); void deleteFork(forkId).unwrap().then(() => setForkId('')).catch((e: unknown) => setFailed(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e))); }}>{t('agentGit.fork_delete')}</Button>
        </>}
      </section>}
      {isSignedIn && (comparing || forkId) && !mirror && <section style={{ marginTop: 16 }}>
        <Field><FieldLabel htmlFor="proposal-title">{t('agentGit.pull_title')}</FieldLabel><Input id="proposal-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor="proposal-body">{t('agentGit.pull_body')}</FieldLabel><Input id="proposal-body" as="textarea" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} /></Field>
        <Button disabled={!title.trim() || (!!forkId && !forkBranch.trim())} loading={opening.isLoading} onClick={() => { setFailed(null); void openPull({ id: agentId, title, body, head: forkId ? forkBranch : ref, base: head, ...(forkId ? { headAgent: forkId } : {}) }).unwrap().then(() => { setTitle(''); setBody(''); }).catch((e: unknown) => setFailed(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e))); }}>{t('agentGit.pull_create')}</Button>
      </section>}
      {(pulls.data?.pulls.length ?? 0) > 0 && (
        <Pulls data-testid="agent-pulls">
          {pulls.data!.pulls.map((p) => (
            <Pull key={p.number}>
              <div>
                <strong>#{p.number} {p.title}</strong><span>{t(`agentGit.state_${p.state}`)}</span>
                <span>{t('agentGit.pull_from', { head: p.headAgent ? `${p.headAgent}/${p.head}` : p.head, base: p.base, who: who(p.author) })}</span>
              </div>
              <div>
                <Button size="small" variant="text" onClick={() => setBranch(p.headCommit ?? p.head)}>{t('agentGit.pull_review')}</Button>
                {/* Merging is the deploy, so it is offered only to the people who could have pushed it. */}
                {canMerge && p.state === 'open' && (
                  <Button size="small" loading={mergeState.isLoading}
                    onClick={() => { setFailed(null); merge({ id: agentId, number: p.number }).unwrap().catch((e: unknown) => setFailed(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e))); }}>
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

      {executions.data && <section aria-label={t('agentGit.executions')} style={{ marginTop: 20 }}>
        <h3>{t('agentGit.executions')}</h3>
        <Commits data-testid="agent-executions">
          {executions.data.executions.map((execution) => <Commit key={execution.id}>
            <strong>{t(`agentGit.execution.${execution.status}`)}</strong>
            <code title={execution.sourceCommit ?? undefined}>{execution.sourceCommit?.slice(0, 8) ?? '—'}</code>
            <span>{execution.actor ? who(execution.actor) : '—'}</span>
            <span>{when(execution.createdAt, locale)}</span>
            {execution.error && <Why role="status">{execution.error}</Why>}
          </Commit>)}
        </Commits>
        {executions.data.total === 0 && <Description>{t('agentGit.executions_empty')}</Description>}
        <Branches>
          <Button variant="outlined" disabled={executionOffset === 0} onClick={() => setExecutionOffset((offset) => Math.max(0, offset - 10))}>{t('agentGit.newer')}</Button>
          <Button variant="outlined" disabled={executionOffset + 10 >= executions.data.total} onClick={() => setExecutionOffset((offset) => offset + 10)}>{t('agentGit.older')}</Button>
        </Branches>
      </section>}

      {isSignedIn && <AgentPreviewHistory agentId={agentId} />}
      <Commits data-testid="agent-commits">
        {(commits.data?.commits ?? []).map((c) => (
          <Commit key={c.sha}>
            <strong>{c.subject}</strong>
            <span>{who(c.author)}</span>
            <span>{when(c.at, locale)}</span>
            <code>{c.short}</code>
          </Commit>
        ))}
      </Commits>
      {commits.data && commits.data.commits.length === 0 && <Description>{t('agentGit.empty')}</Description>}

      {comparing && diff.data && (
        <>
          <Diff data-testid="agent-diff">{diff.data.diff || t('agentGit.no_changes')}</Diff>
          {diff.data.truncated && <Description>{t('agentGit.diff_truncated')}</Description>}
        </>
      )}
    </Box>
  );
}

export default AgentHistoryPanel;
