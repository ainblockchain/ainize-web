/**
 * `/projects/new` — bind a git repository in an aindrive drive as a project.
 *
 * Two ways in. A person types a repo URL. Or aindrive's git panel ("Connect to ainize") opens
 * `/projects/new?repo=<cloneUrl>&driveId=<id>&returnTo=<drive page>`: then the page creates the project for the
 * signed-in AIN SSO user, hands the ONE-TIME webhook secret back to aindrive (`POST /api/drives/<driveId>/git-connect`
 * with the person's aindrive session, so a push there calls the hook here) and returns to the drive. If aindrive
 * does not take the secret, it is shown — once — with the hook URL, because the node never shows it again.
 *
 * Sign-in is checked here rather than by `SignedInLayout`: that gate forwards to `/signing?next=<pathname>` and loses
 * the query string, which is the whole hand-off.
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import styled from 'styled-components';
import { useCreateProjectMutation } from '@/api/api';
import { connectParamsOf, connectRepoOnAindrive, projectApiErrorOf, repoLabelOf, repoUrlLooksRight, type ProjectCreated } from '@/api/projects';
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
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => connectParamsOf(search), [search]);
  const [repo, setRepo] = useState(params.repo ?? '');
  const [branch, setBranch] = useState('main');
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
  if (!isSignedIn) return <Navigate to={`/signing?next=${encodeURIComponent(`${pathname}${search}`)}`} replace />;

  const repoOk = repoUrlLooksRight(repo.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTaken(false);
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
      <TitleRow><Title>{t('projects.new.title')}</Title></TitleRow>
      <Description>{t('projects.new.lede')}</Description>
      {fromAindrive && <Alert $tone="info">{t('projects.new.from_aindrive')}</Alert>}
      <Form onSubmit={submit}>
        <TextField label={t('projects.new.repo')} value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://aindrive.ainetwork.ai/<org>/git/<repo>" helper={repo && !repoOk ? t('projects.new.repo_bad') : repo ? repoLabelOf(repo) : t('projects.new.repo_help')} error={!!repo && !repoOk} readOnly={fromAindrive && !!params.repo} spellCheck={false} />
        <FormRow>
          <TextField label={t('projects.new.branch')} value={branch} onChange={(e) => setBranch(e.target.value)} spellCheck={false} />
        </FormRow>
        <TextField label={t('projects.new.token')} type="password" value={token} onChange={(e) => setToken(e.target.value)} helper={t('projects.new.token_help')} autoComplete="off" />
        {error && <Alert $tone="error">{error}</Alert>}
        {taken && (
          <Alert $tone="warning">
            {t('projects.new.taken')}{' '}
            <StyledLink to={`/me/projects`}>{t('projects.new.taken_open')}</StyledLink>
          </Alert>
        )}
        <Actions>
          <Button type="submit" variant="contained" loading={creating} loadingText={t('projects.new.creating')} disabled={!repo.trim()}>{t('projects.new.create')}</Button>
        </Actions>
      </Form>
    </PageWrapper>
  );
}
