/**
 * `/projects/new` — bind a git repository in an aindrive drive as a project.
 *
 * Two ways in. A person types a repo URL. Or aindrive's git panel ("Connect to ainize") opens
 * `/projects/new?repo=<cloneUrl>&driveId=<id>&returnTo=<drive page>`: then the page creates the project for the
 * signed-in AIN SSO user, hands the ONE-TIME webhook secret back to aindrive (`POST /api/drives/<driveId>/git-connect`
 * with the person's aindrive session, so a push there calls the hook here) and returns to the drive. If aindrive
 * does not take the secret, it is shown — once — with the hook URL, because the node never shows it again.
 *
 * A third: the person types a GITHUB repository. There is no AIN Drive repository to bind yet, so the form asks which
 * organization's drive gets it and the node's import does the rest (components/ProjectGithubImport.tsx): the sync job
 * creates the AIN Drive repository, aindrive binds the project, and the page — at `?import=<org>/<repo>` meanwhile —
 * moves on to the project when it exists.
 *
 * Sign-in is checked here so the hand-off form keeps its own loading state. The shared signInHref helper
 * preserves the repository query string and anchor through authentication.
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useCreateProjectMutation, useImportFromGithubMutation } from '@/api/api';
import { apiErrorCodeOf, connectParamsOf, connectRepoOnAindrive, githubRepoOf, importNameLooksRight, importParamOf, projectApiErrorOf, repoLabelOf, repoUrlLooksRight, type ProjectCreated } from '@/api/projects';
import { GithubImportFields, GithubImportProgress, importErrorText, type ImportDraft } from '@/components/ProjectGithubImport';
import { signInHref } from '@/lib/uiNavigation';
import { projectPath } from '@/lib/reservedRoutes';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, TextField } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Mono, PageWrapper, StyledLink, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const Form = styled.form`display: flex; flex-direction: column; gap: 16px; max-width: 640px;`;
const Actions = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;
const SecretBox = styled.div`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; padding: 16px 18px; background: #fff;
  display: flex; flex-direction: column; gap: 10px; max-width: 640px;
`;
const SecretRow = styled.div`display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; word-break: break-all;`;
const Label = styled.span`font-weight: 700; font-size: 13px; min-width: 110px;`;

export default function ProjectNewPage() {
  const { t } = useT();
  useTitle(t('projects.new.title'));
  const { isSignedIn, loading } = useAuth();
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const params = useMemo(() => connectParamsOf(search), [search]);
  const importing = useMemo(() => importParamOf(search), [search]);
  // A failed import comes back here with what was asked, to be sent again with an ainize.json.
  const again = (location.state as { importDraft?: { repo: string; branch: string; org: string; name: string } } | null)?.importDraft ?? null;
  const [repo, setRepo] = useState(params.repo ?? again?.repo ?? '');
  const [branch, setBranch] = useState(again?.branch ?? 'main');
  const [draft, setDraft] = useState<ImportDraft>({ org: again?.org ?? '', name: again?.name ?? '', manifest: '' });
  const [askManifest, setAskManifest] = useState(!!again);
  const [importRepo, { isLoading: importingNow }] = useImportFromGithubMutation();
  const [token, setToken] = useState('');
  const [create, { isLoading: creating }] = useCreateProjectMutation();
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [created, setCreated] = useState<ProjectCreated | null>(null);
  const [connect, setConnect] = useState<'idle' | 'working' | 'done' | { failed: string }>('idle');
  const fromAindrive = !!params.driveId;

  // Once created and (when it came from aindrive) handed over, go back where the person came from.
  useEffect(() => {
    if (!created || connect !== 'done' || !params.returnTo) return;
    const timer = setTimeout(() => { window.location.assign(params.returnTo!); }, 1500);
    return () => clearTimeout(timer);
  }, [created, connect, params.returnTo]);

  if (loading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!isSignedIn) return <Navigate to={signInHref(location)} replace />;

  if (importing) return (
    <PageWrapper>
      <TitleRow><Title>{t('projects.import.title')}</Title></TitleRow>
      <GithubImportProgress org={importing.org} repo={importing.repo} />
    </PageWrapper>
  );

  const repoOk = repoUrlLooksRight(repo.trim());
  // A GitHub repository (never when aindrive opened this page for one of its own).
  const github = !fromAindrive && !repoOk ? githubRepoOf(repo) : null;
  const importName = draft.name || github?.split('/')[1] || '';
  const importReady = !!github && !!draft.org && importNameLooksRight(importName);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTaken(false);
    if (github) {
      if (!importReady) return;
      try {
        await importRepo({ repo: github, branch: branch.trim() || 'main', org: draft.org, name: importName, ...(draft.manifest.trim() ? { manifest: draft.manifest } : {}) }).unwrap();
      } catch (err) {
        const code = apiErrorCodeOf(err);
        if (code === 'manifest_required' || code === 'invalid_manifest') setAskManifest(true);
        setError(importErrorText(t, err));
        return;
      }
      navigate(`/projects/new?import=${encodeURIComponent(draft.org)}/${encodeURIComponent(importName)}`, { replace: true });
      return;
    }
    if (!repoOk) { setError(t('projects.new.repo_bad')); return; }
    let project: ProjectCreated;
    try {
      project = await create({ repo: repo.trim(), branch: branch.trim() || 'main', ...(token.trim() ? { deployToken: token.trim() } : {}) }).unwrap();
    } catch (err) {
      const why = projectApiErrorOf(err);
      if (why.code === 'repo_taken') { setTaken(true); return; }
      setError(t('projects.new.failed', { why: why.message ?? t(`projects.api.${why.code}`) }));
      return;
    }
    setCreated(project);
    if (params.driveId) {
      setConnect('working');
      const r = await connectRepoOnAindrive({ driveId: params.driveId, repo: project.repo, projectId: project.id, webhookSecret: project.webhookSecret });
      setConnect(r.ok ? 'done' : { failed: r.message });
    }
  };

  if (created) {
    const handedOver = connect === 'done';
    return (
      <PageWrapper>
        <TitleRow><Title>{t('projects.new.title')}</Title></TitleRow>
        <Description><Mono>{created.org}/{created.repoName}</Mono> · {created.branch}</Description>
        {connect === 'working' && <Alert $tone="info">{t('projects.new.connecting')}</Alert>}
        {handedOver && <Alert $tone="success">{t('projects.new.connected', { branch: created.branch })}</Alert>}
        {typeof connect === 'object' && <Alert $tone="warning">{t('projects.new.connect_failed', { why: connect.failed })}</Alert>}
        {!handedOver && connect !== 'working' && (
          <SecretBox>
            <strong>{t('projects.new.secret_once')}</strong>
            <SecretRow><Label>{t('projects.new.hook_url')}</Label><Mono>{created.hookUrl}</Mono><CopyButton text={created.hookUrl} /></SecretRow>
            <SecretRow><Label>webhookSecret</Label><Mono>{created.webhookSecret}</Mono><CopyButton text={created.webhookSecret} /></SecretRow>
            <Description style={{ margin: 0 }}>{t('projects.new.manual_help')}</Description>
          </SecretBox>
        )}
        <Actions style={{ marginTop: 16 }}>
          <Button variant="contained" onClick={() => navigate(projectPath(created))}>{t('projects.new.open_project')}</Button>
          {params.returnTo && <Button onClick={() => window.location.assign(params.returnTo!)}>{t('projects.new.back_to_drive')}</Button>}
        </Actions>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <TitleRow><Title>{t(github ? 'projects.import.title' : 'projects.new.title')}</Title></TitleRow>
      <Description>{t('projects.new.lede')}</Description>
      {fromAindrive && <Alert $tone="info">{t('projects.new.from_aindrive')}</Alert>}
      <Form onSubmit={submit}>
        <TextField label={t('projects.new.repo')} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/<owner>/<repo>" helper={github ? `github.com/${github}` : repo && !repoOk ? t('projects.new.repo_bad') : repo ? repoLabelOf(repo) : t('projects.new.repo_help')} error={!!repo && !repoOk && !github} readOnly={fromAindrive && !!params.repo} spellCheck={false} />
        <FormRow>
          <TextField label={t('projects.new.branch')} value={branch} onChange={(e) => setBranch(e.target.value)} spellCheck={false} />
        </FormRow>
        {github
          ? <GithubImportFields draft={draft} onChange={setDraft} nameDefault={github.split('/')[1]} askManifest={askManifest} />
          : <TextField label={t('projects.new.token')} type="password" value={token} onChange={(e) => setToken(e.target.value)} helper={t('projects.new.token_help')} autoComplete="off" />}
        {error && <Alert $tone="error">{error}</Alert>}
        {taken && (
          <Alert $tone="warning">
            {t('projects.new.taken')}{' '}
            <StyledLink to={`/me/projects`}>{t('projects.new.taken_open')}</StyledLink>
          </Alert>
        )}
        <Actions>
          {github
            ? <Button type="submit" variant="contained" loading={importingNow} loadingText={t('projects.import.submitting')} disabled={!importReady}>{t('projects.import.submit')}</Button>
            : <Button type="submit" variant="contained" loading={creating} loadingText={t('projects.new.creating')} disabled={!repo.trim()}>{t('projects.new.create')}</Button>}
        </Actions>
      </Form>
    </PageWrapper>
  );
}
