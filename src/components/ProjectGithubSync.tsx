import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { usePauseProjectGithubSyncMutation, useProjectGithubSyncQuery, useSetProjectGithubSyncMutation, useSyncFromGithubMutation } from '@/api/api';
import { projectApiErrorOf, shortSha, type GithubSyncStatus, type Project } from '@/api/projects';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { ExternalLink, Mono } from '@/components/ui/Misc';
import { useT } from '@/i18n';

const Card = styled.section`border:1px solid #ddd;border-radius:10px;padding:20px;margin:20px 0;min-width:0;h2{margin-top:0;}`;
const Row = styled.div`display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0;input{min-width:140px;}@media(max-width:640px){input{font-size:16px;flex:1;}button{min-height:44px;}}`;
const Help = styled.p`margin:0;font-size:13px;color:#666;overflow-wrap:anywhere;`;
const Facts = styled.dl`display:grid;grid-template-columns:max-content 1fr;gap:6px 16px;margin:12px 0;font-size:14px;dt{color:#666;}dd{margin:0;overflow-wrap:anywhere;}@media(max-width:640px){grid-template-columns:1fr;dt{margin-top:6px;}}`;
const Tone = styled.strong<{ $tone: 'ok' | 'error' | 'pending' }>`color:${(p) => (p.$tone === 'ok' ? '#1a7f37' : p.$tone === 'error' ? '#cf222e' : '#9a6700')};`;

const at = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

/** One line for the project header: where the sync stands. */
export function GithubSyncBadge({ status }: { status: GithubSyncStatus | null | undefined }) {
  const { t } = useT();
  if (!status) return null;
  return <Help title={status.message}><Tone $tone={status.state}>{t(`projects.github.state.${status.state}`)}</Tone>{status.checkedAt && <> · {t('projects.github.checked', { when: at(status.checkedAt) })}</>}</Help>;
}

/**
 * Settings → "Sync from GitHub": the owner or an org member names the GitHub repository and branch this project's AIN
 * Drive repository follows (ainize-node `PUT /api/projects/:id/github-sync`). The node checks GitHub; the sync job
 * checks its own access and the merge within a minute and reports here.
 */
export default function ProjectGithubSync({ project }: { project: Project }) {
  const { t } = useT();
  const query = useProjectGithubSyncQuery(project.id, { pollingInterval: 15000 });
  const [save, saving] = useSetProjectGithubSyncMutation();
  const [pause, pausing] = usePauseProjectGithubSyncMutation();
  const [syncNow, syncing] = useSyncFromGithubMutation();
  const configured = query.data?.configured ?? null;
  const status = query.data?.status ?? null;
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (configured?.repo) { setRepo(configured.repo); setBranch(configured.branch ?? 'main'); } }, [configured?.repo, configured?.branch]);
  const run = async (action: () => Promise<unknown>) => { setError(null); try { await action(); } catch (e) { const x = projectApiErrorOf(e); setError(x.message ?? t(`projects.api.${x.code}`)); } };
  const enabled = !!configured?.enabled;
  const unchanged = enabled && configured?.repo === repo.trim() && (configured?.branch ?? 'main') === (branch.trim() || 'main');

  return <Card aria-label={t('projects.github.title')}>
    <h2>{t('projects.github.title')}</h2>
    <Help>{t('projects.github.help')}</Help>
    {project.canOperate && <form onSubmit={(e) => { e.preventDefault(); void run(() => save({ id: project.id, repo: repo.trim(), branch: branch.trim() || 'main' }).unwrap()); }}>
      <Row>
        <Input aria-label={t('projects.github.repo')} placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ flex: 2 }} />
        <Input aria-label={t('projects.github.branch')} placeholder="main" value={branch} onChange={(e) => setBranch(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} style={{ flex: 1, maxWidth: 200 }} />
        <Button type="submit" variant="contained" size="small" loading={saving.isLoading} disabled={!repo.trim() || unchanged}>{enabled ? t('projects.github.update') : t('projects.github.save')}</Button>
      </Row>
    </form>}
    {query.error && <Alert $tone="error">{projectApiErrorOf(query.error).message ?? t('projects.github.failed')}</Alert>}
    {error && <Alert $tone="error">{error}</Alert>}
    <Facts>
      <dt>{t('projects.github.upstream')}</dt>
      <dd>{enabled && configured?.repo
        ? <><ExternalLink href={`https://github.com/${configured.repo}`} target="_blank" rel="noreferrer">{configured.repo}</ExternalLink> · <Mono>{configured.branch}</Mono> · {t(`projects.github.visibility.${configured.visibility}`)}</>
        : configured && !configured.enabled ? t('projects.github.paused') : t('projects.github.none')}</dd>
      {status && <>
        <dt>{t('projects.github.status')}</dt><dd><Tone $tone={status.state}>{t(`projects.github.state.${status.state}`)}</Tone>{status.message && <> — {status.message}</>}</dd>
        <dt>{t('projects.github.last_check')}</dt><dd>{at(status.checkedAt)}</dd>
        <dt>{t('projects.github.last_sync')}</dt><dd>{at(status.syncedAt)}</dd>
        {status.commit && <><dt>{t('projects.github.commit')}</dt><dd><Mono title={status.commit}>{shortSha(status.commit)}</Mono>{status.githubCommit && <> ← GitHub <Mono title={status.githubCommit}>{shortSha(status.githubCommit)}</Mono></>}{status.mode && <> · {t(`projects.github.mode.${status.mode}`)}</>}</dd></>}
        <dt>{t('projects.github.next_check')}</dt><dd>{query.data?.requested ? t('projects.github.requested') : at(status.nextCheckAt)}</dd>
      </>}
    </Facts>
    {project.canOperate && <Row>
      <Button size="small" loading={syncing.isLoading} title={t('projects.page.github_sync_hint')} onClick={() => void run(() => syncNow(project.id).unwrap())}>{t('projects.page.github_sync')}</Button>
      {enabled && <Button size="small" color="secondary" loading={pausing.isLoading} onClick={() => { if (window.confirm(t('projects.github.pause_confirm'))) void run(() => pause(project.id).unwrap()); }}>{t('projects.github.pause')}</Button>}
    </Row>}
  </Card>;
}
