/**
 * `/projects/new` — bind a git repository in an aindrive drive as a project.
 *
 * Two ways in. A person types a repo URL, or a Drive connection link opens
 * `/projects/new?repo=<cloneUrl>&driveId=<id>&returnTo=<drive page>`: then the page creates the project for the
 * signed-in AIN SSO user, hands the ONE-TIME webhook secret back to aindrive (`POST /api/drives/<driveId>/git-connect`
 * with the person's aindrive session, so a push there calls the hook here) and offers an explicit return link. If aindrive
 * storage cannot be confirmed, keep the secret visible with the hook URL; this does not imply the write failed.
 *
 * Sign-in is checked here so the hand-off form keeps its own loading state. The shared signInHref helper
 * preserves the repository query string and anchor through authentication.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useCreateProjectMutation } from '@/api/api';
import { connectParamsOf, connectRepoOnAindrive, projectApiErrorOf, repoLabelOf, repoUrlLooksRight, type ProjectCreated } from '@/api/projects';
import { createProjectCreation, projectBranchValid } from '@/lib/projectCreation';
import { signInHref } from '@/lib/uiNavigation';
import { projectPath } from '@/lib/reservedRoutes';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
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
  const { cacheIdentity } = useAuth();
  const { search } = useLocation();
  return <ProjectNewContent key={`${cacheIdentity}:${search}`} />;
}

function ProjectNewContent() {
  const { t } = useT();
  useTitle(t('projects.new.title'));
  const { isSignedIn, loading, principal, isCurrentAccount } = useAuth();
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const active = useActiveView();
  const params = useMemo(() => connectParamsOf(search), [search]);
  const [repo, setRepo] = useState(params.repo ?? '');
  const [branch, setBranch] = useState(params.branch);
  const [token, setToken] = useState('');
  const [create, { isLoading: creating }] = useCreateProjectMutation();
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(false);
  const [created, setCreated] = useState<ProjectCreated | null>(null);
  const [connect, setConnect] = useState<'idle' | 'working' | 'done' | { failed: string }>('idle');
  const fromAindrive = !!params.driveId;
  const [admission] = useState(createProjectCreation);
  const [uncertain, setUncertain] = useState(false);
  const handoff = useRef<AbortController | null>(null);
  const isActive = () => active() && isCurrentAccount();

  useEffect(() => () => { handoff.current?.abort(); }, []);

  if (loading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!isSignedIn) return <Navigate to={signInHref(location)} replace />;

  const repoOk = repoUrlLooksRight(repo.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTaken(false);
    if (admission.blocked() || !isActive()) return;
    if (params.invalid) { setError(t('projects.new.invalid_link')); return; }
    if (!principal) { setError(t('projects.new.sign_in')); return; }
    if (!projectBranchValid(branch.trim())) { setError(t('projects.new.branch_bad')); return; }
    if (!repoOk) { setError(t('projects.new.repo_bad')); return; }
    let project: ProjectCreated | null;
    const input = { repo: repo.trim(), branch: branch.trim(), ...(token.trim() ? { deployToken: token.trim() } : {}) };
    try {
      project = await admission.run(input, principal, { active: isActive, send: () => create(input).unwrap() });
    } catch (err) {
      if (!isActive()) return;
      if (admission.uncertain()) { setUncertain(true); return; }
      const why = projectApiErrorOf(err);
      if (why.code === 'repo_taken') { setTaken(true); return; }
      setError(t('projects.new.failed', { why: why.message ?? t(`projects.api.${why.code}`) }));
      return;
    }
    if (!project || !isActive()) return;
    setToken('');
    setCreated(project);
    if (params.driveId) {
      setConnect('working');
      const ctrl = new AbortController(); handoff.current = ctrl;
      const r = await connectRepoOnAindrive({ driveId: params.driveId, repo: input.repo, projectId: project.id, webhookSecret: project.webhookSecret }, { signal: ctrl.signal });
      if (!isActive()) return;
      setConnect(r.ok ? 'done' : { failed: r.message });
    }
  };

  if (created) return <ProjectCreationResult created={created} connect={connect} returnTo={params.returnTo}
    onOpen={() => navigate(projectPath(created))} onBack={() => { if (params.returnTo) window.location.assign(params.returnTo); }} />;

  return (
    <PageWrapper>
      <TitleRow><Title>{t('projects.new.title')}</Title></TitleRow>
      <Description>{t('projects.new.lede')}</Description>
      {params.invalid && <Alert $tone="error">{t('projects.new.invalid_link')}</Alert>}
      {fromAindrive && !params.invalid && <Alert $tone="info">{t('projects.new.from_aindrive')}</Alert>}
      <Form onSubmit={submit}>
        <TextField label={t('projects.new.repo')} disabled={creating || uncertain || params.invalid} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://aindrive.ainetwork.ai/<org>/git/<repo>" helper={repo && !repoOk ? t('projects.new.repo_bad') : repo ? repoLabelOf(repo) : t('projects.new.repo_help')} error={!!repo && !repoOk} readOnly={fromAindrive && !!params.repo} spellCheck={false} />
        <FormRow>
          <TextField label={t('projects.new.branch')} disabled={creating || uncertain || params.invalid} error={!projectBranchValid(branch.trim())} helper={!projectBranchValid(branch.trim()) ? t('projects.new.branch_bad') : undefined} value={branch} onChange={(e) => setBranch(e.target.value)} spellCheck={false} />
        </FormRow>
        <TextField label={t('projects.new.token')} type="password" disabled={creating || uncertain || params.invalid} value={token} onChange={(e) => setToken(e.target.value)} helper={t('projects.new.token_help')} autoComplete="off" />
        {uncertain && <ProjectCreationUnknown />}
        {error && <Alert $tone="error">{error}</Alert>}
        {taken && (
          <Alert $tone="warning">
            {t('projects.new.taken')}{' '}
            <StyledLink to={`/me/projects`}>{t('projects.new.taken_open')}</StyledLink>
          </Alert>
        )}
        <Actions>
          <Button type="submit" variant="contained" loading={creating} loadingText={t('projects.new.creating')} disabled={!repoOk || !projectBranchValid(branch.trim()) || !principal || params.invalid || uncertain}>{t('projects.new.create')}</Button>
        </Actions>
      </Form>
    </PageWrapper>
  );
}

export function ProjectCreationResult({ created, connect, returnTo, onOpen, onBack }: {
  created: ProjectCreated; connect: 'idle' | 'working' | 'done' | { failed: string };
  returnTo: string | null; onOpen: () => void; onBack: () => void;
}) {
  const { t } = useT();
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
        <Button variant="contained" onClick={onOpen}>{t('projects.new.open_project')}</Button>
        {returnTo && <Button onClick={onBack}>{t('projects.new.back_to_drive')}</Button>}
      </Actions>
    </PageWrapper>
  );
}

export function ProjectCreationUnknown() {
  const { t } = useT();
  return <Alert $tone="warning">{t('projects.new.unconfirmed')} <StyledLink to="/me/projects">{t('projects.new.taken_open')}</StyledLink></Alert>;
}
