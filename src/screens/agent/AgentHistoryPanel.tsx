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
import { useState } from 'react';
import styled from 'styled-components';
import { useAgentCommitsQuery, useAgentDiffQuery, useAgentPullsQuery, useAgentRefsQuery, useMergeAgentPullMutation, useSyncAgentMirrorMutation } from '@/api/api';
import type { AgentGitInfo } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { Description } from '@/components/ui/Misc';
import { useT } from '@/i18n';

const Box = styled.div`
  margin-top: 24px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; }
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

export function AgentHistoryPanel({ agentId, git, canMerge = false }: { agentId: string; git?: AgentGitInfo | null; canMerge?: boolean }) {
  const { t, locale } = useT();
  const [branch, setBranch] = useState<string | null>(null);
  const refs = useAgentRefsQuery(agentId);
  const head = refs.data?.head ?? 'main';
  const ref = branch ?? head;
  const commits = useAgentCommitsQuery({ id: agentId, ref, limit: 20 });
  // A proposal is worth a diff; the deployed branch compared against itself is not.
  const comparing = ref !== head;
  const diff = useAgentDiffQuery({ id: agentId, base: head, head: ref }, { skip: !comparing });
  const [copied, setCopied] = useState(false);
  const pulls = useAgentPullsQuery({ id: agentId, state: 'open' });
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

      {(pulls.data?.pulls.length ?? 0) > 0 && (
        <Pulls data-testid="agent-pulls">
          {pulls.data!.pulls.map((p) => (
            <Pull key={p.number}>
              <div>
                <strong>#{p.number} {p.title}</strong>
                <span>{t('agentGit.pull_from', { head: p.head, base: p.base, who: who(p.author) })}</span>
              </div>
              <div>
                <Button size="small" variant="text" onClick={() => setBranch(p.head)}>{t('agentGit.pull_review')}</Button>
                {/* Merging is the deploy, so it is offered only to the people who could have pushed it. */}
                {canMerge && (
                  <Button size="small" loading={mergeState.isLoading}
                    onClick={() => { setFailed(null); merge({ id: agentId, number: p.number }).unwrap().catch((e: unknown) => setFailed(String((e as { data?: { error?: { message?: string } } })?.data?.error?.message ?? e))); }}>
                    {t('agentGit.pull_merge')}
                  </Button>
                )}
              </div>
            </Pull>
          ))}
        </Pulls>
      )}
      {failed && <Alert $tone="error" style={{ marginTop: 12 }} data-testid="agent-git-error">{failed}</Alert>}

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
