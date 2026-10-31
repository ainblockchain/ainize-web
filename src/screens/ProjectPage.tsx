/**
 * `/<org>/<repo>` — the project console: the deployment and run page of a repository, modelled on Vercel's project
 * dashboard. aindrive's ▶ Run is the short form; this is the full one ("aindrive의 Run은 약식이고 ainize의 run/deploy가
 * 본 페이지"). Header: `org / repo`, the kind, the production branch, the repo, the status dot and the primary
 * actions — Code (the repo in ainize.ai/code), Run (script), Visit (service / agent / nextjs), Redeploy. Four tabs, deep-linked through `?tab=`:
 *
 *   Deployments  the Vercel-shaped rows (status dot, sha + subject, branch, who, when, how long); a row opens the
 *                full log (polled while it runs), exit code, output link, and Redeploy of the displayed commit.
 *                Filters and pagination preserve an explicitly selected record.
 *   Runs         script projects: the Run panel — entry file, the `inputs` form out of ainize.json (GitHub
 *                workflow_dispatch shape → INPUT_*), extra env, a model picker for a model input, timeout, example
 *                presets (`examples` in ainize.json) — and the history of runs, each re-runnable with its inputs.
 *   Logs         a service/nextjs app's RUNTIME log — what the running container prints, on the node or the deployment
 *                peer it was placed on; owner/members only, followed live — and the newest deployment's or run's
 *                build log (`?log=build`), downloadable; `record` pins an explicit record.
 *   Settings     environment variables (write-only values, .env paste, redeploy after saving — ProjectEnvVars),
 *                branch, what ainize.json says (read-only; edit in aindrive), env preview, webhook, rotate, delete.
 *
 * A banner over the tabs names the environment variables ainize.json declares and nobody has set yet.
 *
 * Reading is public (ainize-node docs/PROJECTS.md "Who sees what"); the node says with `canManage` / `canOperate`
 * which buttons this caller gets. `/projects/:id` still resolves and forwards here.
 */
import { createProjectManagement, ProjectManagementError, projectSyncTarget, sameProjectManagementTarget, type ProjectManagementAction } from '@/lib/projectManagement';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import styled, { keyframes } from 'styled-components';
import {
  useDeleteProjectMutation, useDeploymentLogQuery, useModelsQuery, useOrgProjectsQuery, useProjectByNameQuery, useProjectDeploymentsQuery, useProjectQuery, useProjectRunsQuery, useProjectRuntimeLogsQuery, useProjectSourceQuery,
  useRedeployMutation, useSyncFromGithubMutation, useRotateProjectSecretMutation, useRunProjectMutation,
} from '@/api/api';
import { readModelsResponse } from '@/api/models';
import {
  aindriveLinksOf, codeWorkspaceUrlOf, durationLabel, invalidInputs, projectInputValue, projectRunEnvIssues, projectRunTimeout, isModelInput, missingInputs, projectApiErrorOf, relativeTime, repoLabelOf, shortSha, statusToneOf,
  type Deployment, type DeploymentStatus, type ManifestInput, type Project, type ProjectStatus, type RunInput,
} from '@/api/projects';
import { logTime, readRuntimeLogs, runtimeLogProblemOf, runtimeLogsMatchDeployment, runtimeLogsText, RUNTIME_LOG_DEFAULT_TAIL, RUNTIME_LOG_POLL_MS, RUNTIME_LOG_TAILS } from '@/api/runtimeLogs';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, Input, Select } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Empty, ExternalLink, KeyValue, Mono, PageWrapper, Pagination, StyledLink, SubTitle, Tabs } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { isReservedFirstSegment, orgPath, projectPath } from '@/lib/reservedRoutes';
import { activeProjectUrl, hasProjectRunTargets } from '@/lib/projectActions';
import { deploymentLogHref, deploymentPage, projectRedeployTarget, readProjectDeploymentHistory } from '@/lib/projectHistory';
import { createProjectRedeployment } from '@/lib/projectRedeploy';
import { createProjectRunSubmission, prepareProjectRun, projectRunSelection, readProjectRunSource, readProjectRunHistory, type ProjectRunDraft } from '@/lib/projectRun';
import { signInHref } from '@/lib/uiNavigation';
import { isKnowledgeAuthor } from '@/lib/detailRoutes';
import { repoProjectLabel, repoProjects, selectRepoProject } from '@/lib/repoProjects';
import { useTitle } from '@/utils/useTitle';
import NotFoundPage from './NotFoundPage';
import PatchPage from './PatchPage';
import ProjectDomains from '@/components/ProjectDomains';
import ProjectEnvVars, { ENV_SECTION_ID, MissingEnvBanner } from '@/components/ProjectEnvVars';

// ------------------------------------------------------------------------------------------------ pieces

type Tone = 'ok' | 'warn' | 'busy' | 'muted';
const pulse = keyframes`0%,100% { opacity: 1; } 50% { opacity: .35; }`;
const Dot = styled.span<{ $tone: Tone }>`
  display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none;
  background: ${(p) => (p.$tone === 'ok' ? '#2fa84f' : p.$tone === 'warn' ? '#d6453d' : p.$tone === 'busy' ? '#9aa0a6' : '#cfd3d8')};
`;
const BusyDot = styled(Dot)`animation: ${pulse} 1.2s ease-in-out infinite;`;
const Chip = styled.span<{ $tone: Tone }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  background: ${(p) => (p.$tone === 'ok' ? '#e8f6ec' : p.$tone === 'warn' ? '#fdeeee' : '#f1f2f5')};
  color: ${(p) => (p.$tone === 'ok' ? '#227a3c' : p.$tone === 'warn' ? '#a33030' : '#555')};
`;
const Crumbs = styled.nav`font-size: 22px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: ${(p) => p.theme.color.BLACK};
  a, span { min-width: 0; max-width: 100%; overflow-wrap: anywhere; }
  a { color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; &:hover { text-decoration: underline; } }
  span.sep { color: ${(p) => p.theme.color.GREY}; font-weight: 400; }
`;
const HeaderRow = styled.div`display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 6px 0 14px;`;
const Meta = styled.span`min-width: 0; overflow-wrap: anywhere; color: #666; font-size: 13px;`;
const Spacer = styled.span`flex: 1;`;
const Actions = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap;`;
const Rows = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px;`;
const Row = styled.li<{ $open?: boolean }>`
  border: 1px solid ${(p) => (p.$open ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)}; border-radius: 10px; background: #fff; padding: 12px 16px;
  display: flex; flex-direction: column; gap: 10px;
`;
const Head = styled.div`overflow-wrap: anywhere; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 14px; cursor: pointer; min-height: 44px;`;
const Subject = styled.span`font-weight: 600; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`;
const Log = styled.pre`
  margin: 0; padding: 12px 14px; border-radius: 8px; background: #0f1419; color: #d7dde3; font-size: 12.5px; line-height: 1.5;
  max-height: 520px; overflow: auto; white-space: pre-wrap; word-break: break-word; font-family: ${(p) => p.theme.font.mono};
`;
const Panel = styled.section`min-width: 0;
  @media (max-width: 640px) { input, select, textarea { font-size: 16px; min-height: 44px; } button { min-height: 44px; } }
border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 16px; display: flex; flex-direction: column; gap: 12px; margin: 12px 0 20px;`;
const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 12px;`;
const Presets = styled.div`display: flex; gap: 8px; flex-wrap: wrap;`;
const FilterRow = styled.div`display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin: 12px 0;`;
const TabBody = styled.div`margin-top: 12px;`;
const Help = styled.p`margin: 0; font-size: 13px; color: #666;`;

const isLive = (s: DeploymentStatus | ProjectStatus) => s === 'queued' || s === 'building';
const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString() : '');
const PAGE = 10;

function StatusDot({ status }: { status: DeploymentStatus | ProjectStatus }) {
  const tone = statusToneOf(status);
  return tone === 'busy' ? <BusyDot $tone={tone} /> : <Dot $tone={tone} />;
}

/** The log: text, re-read every two seconds while the deployment is queued or building. */
function LogView({ deployment, downloadName }: { deployment: Deployment; downloadName?: string }) {
  const { t } = useT();
  const { currentData: data, isLoading, isFetching, error, refetch } = useDeploymentLogQuery({ id: deployment.id, identity: useAuth().cacheIdentity }, { pollingInterval: isLive(deployment.status) ? 2000 : 0 });
  if (error || data !== undefined && typeof data !== 'string' || !isFetching && !isLoading && data === undefined) return <Alert role="alert" $tone="error">{t('projects.logs.failed')} <Button onClick={() => void refetch()} loading={isFetching}>{t('projects.page.retry')}</Button></Alert>;
  if (isLoading || (isFetching && data === undefined)) return <Log>{t('projects.logs.loading')}</Log>;
  return <>
    {downloadName && <Actions><Button size="small" onClick={() => { if (typeof data === 'string') download(downloadName, data); }} disabled={!data?.length}>{t('projects.logs.download')}</Button></Actions>}
    <Log aria-live="polite">{data?.length ? data : t('projects.page.log_empty')}</Log>
  </>;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const RunLine = styled.div<{ $err: boolean }>`
  color: ${(p) => (p.$err ? '#ff9e9e' : 'inherit')};
  .ts { color: #7d8a96; margin-right: 10px; user-select: none; }
`;

/**
 * The RUNNING service's own output (src/api/runtimeLogs.ts) — on this node or on the deployment peer it was placed on.
 * Owner and organization members only; "Follow" asks again every few seconds and keeps the view at the bottom unless
 * the reader scrolled up.
 */
export function RuntimeLogView({ project, onRefreshProject }: { project: Project; onRefreshProject?: () => void }) {
  const { t } = useT();
  const { isSignedIn, cacheIdentity } = useAuth();
  const [tail, setTail] = useState<number>(RUNTIME_LOG_DEFAULT_TAIL);
  const [follow, setFollow] = useState(true);
  const allowed = isSignedIn && !!project.canOperate;
  const q = useProjectRuntimeLogsQuery({ id: project.id, tail, identity: cacheIdentity }, { skip: !allowed, pollingInterval: follow ? RUNTIME_LOG_POLL_MS : 0, skipPollingIfUnfocused: true, refetchOnMountOrArgChange: true });
  const box = useRef<HTMLPreElement>(null);
  const stick = useRef(true);
  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [q.currentData]);
  if (!isSignedIn) {
    return <Panel><Help>{t('projects.logs.sign_in')}</Help><Actions><Button variant="contained" onClick={() => { window.location.assign(signInHref(window.location)); }}>{t('projects.runs.sign_in_button')}</Button></Actions></Panel>;
  }
  if (!project.canOperate) return <Panel><Help>{t('projects.logs.not_member', { org: project.org })}</Help></Panel>;
  const read = q.error ? null : readRuntimeLogs(q.currentData, { id: project.id, tail });
  const changed = !!read && !runtimeLogsMatchDeployment(read, project);
  const data = changed ? null : read;
  const problem = q.error ? runtimeLogProblemOf(q.error) : !q.isFetching && !read ? 'unavailable' : null;
  const refresh = () => { stick.current = true; onRefreshProject?.(); void q.refetch(); };
  return (
    <>
      <FilterRow>
        {data && <Meta>{t(data.placement === 'peer' ? 'projects.logs.placement_peer' : 'projects.logs.placement_local')} · <Mono title={data.deploymentId}>{data.deploymentId}</Mono> · <Mono title={data.sha}>{shortSha(data.sha)}</Mono> · {t('projects.logs.updated', { time: new Date(data.fetchedAt).toLocaleTimeString(undefined, { hour12: false }) })}</Meta>}
        <Spacer />
        <Checkbox label={t('projects.logs.follow')} checked={follow} onChange={(e) => { setFollow(e.target.checked); stick.current = true; }} />
        <Select aria-label={t('projects.logs.tail')} value={String(tail)} onChange={(e) => setTail(Number(e.target.value))}>
          {RUNTIME_LOG_TAILS.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <Button size="small" loading={q.isFetching} onClick={refresh}>{t('projects.logs.refresh')}</Button>
        <Button size="small" onClick={() => download(`${project.org}-${project.repoName}-runtime.log`, runtimeLogsText(data?.lines ?? []))} disabled={!data?.lines.length}>{t('projects.logs.download')}</Button>
      </FilterRow>
      <Help>{t('projects.logs.runtime_hint')}</Help>
      {changed && <Alert role="alert" $tone="info">{t('projects.logs.deployment_changed')}</Alert>}
      {problem && <Alert $tone={problem === 'not_running' ? 'info' : 'error'}>{t(`projects.logs.${problem}`, { org: project.org })}</Alert>}
      {q.isFetching && !data ? <CenterProgress /> : data && (
        <Log ref={box} aria-live="polite" onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}>
          {data.truncated && <RunLine $err={false}><span className="ts">…</span>{t('projects.logs.truncated')}</RunLine>}
          {data.lines.length === 0 ? t('projects.logs.runtime_empty') : data.lines.map((l, i) => (
            <RunLine key={`${l.ts ?? ''}-${i}`} $err={l.stream === 'stderr'}><span className="ts" title={l.ts ?? undefined}>{logTime(l.ts)}</span>{l.text}</RunLine>
          ))}
        </Log>
      )}
    </>
  );
}

/** Who: the pusher's subject; a run names the person who pressed Run. */
const who = (d: Deployment) => d.pusher?.subject ?? null;
/** The names a run was started with: the node sends names only (values may be secrets). */
const runInputNames = (d: Deployment) => d.inputKeys ?? Object.keys(d.inputs ?? {});

function DeploymentRow({ d, project, open, onToggle, onRunAgain, onRedeploy, redeployBlocked }: { d: Deployment; project: Project; open: boolean; onToggle: () => void; onRunAgain?: (d: Deployment) => void; onRedeploy?: (d: Deployment) => void; redeployBlocked?: boolean }) {
  const { t } = useT();
  const tone = statusToneOf(d.status);
  const output = d.trigger === 'run' || d.kind === 'script' ? d.outputUrl : activeProjectUrl(project, [d]);
  return (
    <Row $open={open}>
      <Head onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }} tabIndex={0} role="button" aria-expanded={open}>
        <StatusDot status={d.status} />
        <Chip $tone={tone}>{t(`projects.status.${d.status}`)}</Chip>
        <Mono title={d.sha}>{d.sha ? shortSha(d.sha) : '…'}</Mono>
        {d.subject && <Subject title={d.subject}>{d.subject}</Subject>}
        <Meta><Mono>{d.ref.replace(/^refs\/heads\//, '')}</Mono></Meta>
        {d.kind && <Chip $tone="muted">{t(`projects.kind.${d.kind}`)}</Chip>}
        {d.trigger !== 'push' && <Chip $tone="muted">{t(`projects.trigger.${d.trigger}`)}</Chip>}
        {who(d) && <Meta>{t('projects.page.by', { who: who(d)! })}</Meta>}
        <Spacer />
        <Meta title={when(d.createdAt)}>{relativeTime(d.createdAt)}</Meta>
        {d.ms !== null && <Meta>{durationLabel(d.ms)}</Meta>}
        {d.exitCode !== undefined && d.exitCode !== 0 && <Meta>{t('projects.page.exit', { code: d.exitCode })}</Meta>}
      </Head>
      {open && (
        <>
          {d.placement && <Meta>{t('projects.page.execution_node')}: {d.placement.local ? t('projects.page.this_node') : <Mono>{shortSha(d.placement.address)}</Mono>}</Meta>}
          {d.status === 'queued' && <Meta>{t('projects.page.pending_hint')}</Meta>}
          {d.error && <Alert $tone="error" style={{ padding: '8px 12px' }}>{d.error}</Alert>}
          {d.trigger === 'run' && d.entry && <Meta>{t('projects.runs.entry')}: <Mono>{d.entry}</Mono></Meta>}
          {d.trigger === 'run' && runInputNames(d).length > 0 && <Meta>{t('projects.runs.with_inputs')}: {runInputNames(d).join(' · ')}</Meta>}
          <Actions>
            {d.status === 'ready' && output && <ExternalLink href={output} target="_blank" rel="noreferrer">{d.trigger === 'run' || d.kind === 'script' ? t('projects.page.output') : t('projects.page.visit')} ↗</ExternalLink>}
            <ExternalLink href={deploymentLogHref(d.id)} target="_blank" rel="noreferrer">{t('projects.logs.raw')} ↗</ExternalLink>
            <Spacer />
            {project.canOperate && d.trigger === 'run' && onRunAgain && <Button size="small" disabled={!/^[a-f0-9]{40,64}$/.test(d.sha)} onClick={() => onRunAgain(d)}>{t('projects.runs.again')}</Button>}
            {project.canOperate && d.trigger !== 'run' && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(d.sha) && onRedeploy && (
              <Button size="small" disabled={redeployBlocked} onClick={() => onRedeploy(d)} title={t('projects.page.redeploy_hint')}>
                {t('projects.page.redeploy_commit', { sha: shortSha(d.sha) })}
              </Button>
            )}
          </Actions>
          <LogView deployment={d} />
        </>
      )}
    </Row>
  );
}

// ------------------------------------------------------------------------------------------------ the Run panel

type RunDraft = ProjectRunDraft;
const emptyDraft = (p: Project): RunDraft => ({ target: 'head', sha: '', entry: '', answers: {}, env: '', timeoutMs: '' });

export function ProjectRunInput({ name, spec, value, onChange, models }: { name: string; spec: ManifestInput; value?: string; onChange: (v: string) => void; models: string[] }) {
  const { t } = useT();
  const type = spec.type ?? 'string';
  const id = `in-${name}`, shown = projectInputValue(spec, value);
  const label = <>{name}{spec.required && ' *'}{spec.description && <Help>{spec.description}</Help>}</>;
  const options = type === 'boolean' ? ['true', 'false'] : spec.options ?? [];
  if (options.length) return (
    <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select id={id} value={shown} onChange={e => onChange(e.target.value)}>
        <option value="">{spec.required ? t('projects.runs.choose') : '—'}</option>
        {shown && !options.includes(shown) && <option value={shown} disabled>{shown} · {t('projects.runs.invalid_choice')}</option>}
        {[...new Set(options)].map(o => <option key={o} value={o}>{type === 'boolean' ? t(`projects.runs.boolean_${o}`) : o}</option>)}
      </Select>
    </Field>
  );
  const suggestions = isModelInput(name, spec) ? [...new Set(models)] : [];
  return (
    <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type={type === 'number' ? 'number' : 'text'} value={shown} list={suggestions.length ? `${id}-models` : undefined} onChange={e => onChange(e.target.value)} />
      {suggestions.length > 0 && <datalist id={`${id}-models`}>{suggestions.map(model => <option key={model} value={model} />)}</datalist>}
    </Field>
  );
}

export function ProjectRunPanel({ project, draft, setDraft, onStarted }: { project: Project; draft: RunDraft; setDraft: (d: RunDraft) => void; onStarted: (runId: string) => void }) {
  const { t } = useT();
  const auth = useAuth();
  const { isSignedIn, cacheIdentity } = auth;
  const location = useLocation();
  const active = useActiveView();
  const [run, { isLoading }] = useRunProjectMutation();
  const [err, setErr] = useState<string | null>(null);
  const [submission] = useState(createProjectRunSubmission);
  const [uncertain, setUncertain] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const modelsQuery = useModelsQuery(undefined, { refetchOnMountOrArgChange: true });
  const modelRead = useMemo(() => modelsQuery.isError ? null : readModelsResponse(modelsQuery.currentData), [modelsQuery.currentData, modelsQuery.isError]);
  const models = modelRead?.models.map(m => m.id) ?? [];
  const sourceQuery = useProjectSourceQuery({ id: project.id, identity: cacheIdentity, target: draft.target, ...(draft.target === 'commit' ? { sha: draft.sha } : {}) }, {
    skip: !isSignedIn || !project.canOperate || (draft.target === 'commit' && !/^[a-f0-9]{40,64}$/.test(draft.sha)),
    refetchOnMountOrArgChange: true,
  });
  const source = sourceQuery.isError ? null : readProjectRunSource(sourceQuery.currentData, project, draft.target, draft.sha);
  const sourceInvalid = !source && !sourceQuery.isFetching && !sourceQuery.isUninitialized;
  const manifest = source?.manifest;
  const { targets: runnable, selected } = projectRunSelection(source, draft.entry);
  const entry = draft.entry || selected?.entry || '';
  const inputs = selected?.inputs ?? {};
  const examples = selected?.examples ?? [];
  const selectionIdentity = JSON.stringify([project.id, project.repoId, project.sourcePath, auth.address, cacheIdentity, source?.sha, draft]);
  const latestSelection = useRef(selectionIdentity); latestSelection.current = selectionIdentity;
  const current = () => active() && auth.isCurrentAccount() && latestSelection.current === selectionIdentity;
  const missing = missingInputs(inputs, draft.answers);
  const invalid = invalidInputs(inputs, draft.answers);
  const invalidEnv = projectRunEnvIssues(draft.env), timeoutMs = projectRunTimeout(draft.timeoutMs);
  const setAnswer = (name: string, v: string) => setDraft({ ...draft, answers: { ...draft.answers, [name]: v } });
  const preset = (ex: { inputs: Record<string, string | number | boolean> }) => {
    if (Object.keys(ex.inputs).some(name => !Object.hasOwn(inputs, name))) { setErr(t('projects.runs.preset_invalid')); return; }
    setErr(null);
    const answers = Object.fromEntries(Object.entries(ex.inputs).map(([k, v]) => [k, String(v)]));
    setDraft({ ...draft, answers });
  };
  let body: RunInput | null = null, sizeError = false;
  try { if (source) body = prepareProjectRun(source, draft); } catch (error) { sizeError = error instanceof Error && error.message === 'run_size'; }
  const start = async () => {
    if (!current() || submission.blocked() || !body || sourceQuery.isFetching || !project.canOperate) return;
    setErr(null); setAccepted(null);
    try {
      const id = await submission.submit(() => run({ id: project.id, body: body! }).unwrap());
      if (id && active() && auth.isCurrentAccount()) { setAccepted(id); onStarted(id); }
    } catch (e) {
      if (!active() || !auth.isCurrentAccount()) return;
      if (submission.blocked()) { setUncertain(true); setErr(t('projects.runs.unconfirmed')); }
      else { const x = projectApiErrorOf(e); setErr(x.message ?? t(`projects.api.${x.code}`)); }
    }
  };
  if (!isSignedIn) {
    return <Panel><Help>{t('projects.runs.sign_in')}</Help><Actions><Button variant="contained" onClick={() => { window.location.assign(signInHref(location)); }}>{t('projects.runs.sign_in_button')}</Button></Actions></Panel>;
  }
  if (!project.canOperate) return <Panel><Help>{t('projects.runs.not_member', { org: project.org })}</Help></Panel>;
  return (
    <Panel aria-label={t('projects.runs.panel')}>
      <fieldset disabled={isLoading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      {examples.length ? (
        <div>
          <FieldLabel as="div">{t('projects.runs.examples')}</FieldLabel>
          <Presets>{examples.map((ex, index) => <Button key={`${ex.name}:${index}`} size="small" title={ex.description} onClick={() => preset(ex)}>{ex.name}</Button>)}</Presets>
        </div>
      ) : null}
      <Grid>
        <Field><FieldLabel htmlFor="run-target">{t('projects.runs.target')}</FieldLabel>
          <Select id="run-target" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value as RunDraft['target'], entry: '', answers: {} })}>
            <option value="head">{t('projects.runs.head')}</option>
            <option value="commit">{t('projects.runs.commit')}</option>
            <option value="deployed" disabled={!project.activeCommit}>{t('projects.runs.deployed')}{project.activeCommit ? ` · ${shortSha(project.activeCommit)}` : ''}</option>
          </Select>
        </Field>
        {draft.target === 'commit' && <Field><FieldLabel htmlFor="run-sha">{t('projects.runs.sha')}</FieldLabel><Input id="run-sha" value={draft.sha} onChange={(e) => setDraft({ ...draft, sha: e.target.value.trim(), entry: '', answers: {} })} placeholder={project.sourceCommit ?? ''} /></Field>}
        <Field><FieldLabel htmlFor="run-entry">{t('projects.runs.entry')}</FieldLabel>
          <Select id="run-entry" value={entry} onChange={e => setDraft({ ...draft, entry: e.target.value, answers: {} })} disabled={!source || !runnable.length}>
            {!entry && <option value="">{t('projects.runs.choose')}</option>}
            {draft.entry && !selected && <option value={draft.entry} disabled>{draft.entry} · {t('projects.runs.invalid_choice')}</option>}
            {runnable.map(row => <option key={row.entry} value={row.entry}>{row.name ? `${row.name} · ${row.entry}` : row.entry}</option>)}
          </Select>
          {selected?.description && <Help>{selected.description}</Help>}
        </Field>
        {Object.entries(inputs).map(([name, spec]) => <ProjectRunInput key={name} name={name} spec={spec} value={Object.hasOwn(draft.answers, name) ? draft.answers[name] : undefined} onChange={(v) => setAnswer(name, v)} models={models} />)}
        <Field><FieldLabel htmlFor="run-timeout">{t('projects.runs.timeout')}</FieldLabel>
          <Input id="run-timeout" type="number" min={1} max={300} step="any" value={draft.timeoutMs} placeholder={String((manifest?.timeoutMs ?? 120_000) / 1000)} onChange={(e) => setDraft({ ...draft, timeoutMs: e.target.value })} />
        </Field>
      </Grid>
      <Field><FieldLabel htmlFor="run-env">{t('projects.runs.env')}</FieldLabel>
        <Input as="textarea" id="run-env" rows={2} value={draft.env} placeholder={'NAME=value\nOTHER=value'} onChange={(e) => setDraft({ ...draft, env: e.target.value })} style={{ fontFamily: 'monospace', minHeight: 56 }} />
        <Help>{t('projects.runs.env_help')}</Help>
      </Field>
      {Object.entries(inputs).some(([name, spec]) => isModelInput(name, spec)) && !modelRead && !modelsQuery.isFetching && <Help role="status">{t('projects.runs.models_unavailable')} <Button size="small" onClick={() => void modelsQuery.refetch()}>{t('projects.page.retry')}</Button></Help>}
      {invalidEnv.length > 0 && <Alert role="alert">{t('projects.runs.invalid_env', { lines: invalidEnv.join(', ') })}</Alert>}
      {timeoutMs === null && <Alert role="alert">{t('projects.runs.invalid_timeout')}</Alert>}
      {invalid.length > 0 && <Alert role="alert">{t('projects.runs.invalid_inputs', { names: invalid.join(', ') })}</Alert>}
      {missing.length > 0 && <Help>{t('projects.runs.missing', { names: missing.join(', ') })}</Help>}
      {sizeError && <Alert role="alert">{t('projects.runs.input_limits')}</Alert>}
      {sourceQuery.isFetching && !source && <CenterProgress />}
      {draft.target === 'commit' && !/^[a-f0-9]{40,64}$/.test(draft.sha) && <Help>{t('projects.runs.sha_required')}</Help>}
      {source && <Meta><Mono>{shortSha(source.sha)}</Mono></Meta>}
      {source && !runnable.length && <Help>{t('projects.runs.no_targets')}</Help>}
      {source && draft.entry && !selected && <Alert role="alert">{t('projects.runs.entry_missing')}</Alert>}
      {sourceInvalid && <Alert role="alert" $tone="error">{t('projects.runs.source_unconfirmed')} <Button size="small" disabled={sourceQuery.isFetching} onClick={() => void sourceQuery.refetch()}>{t('projects.page.retry')}</Button></Alert>}
      {err && <Alert role="alert" $tone="error">{err}</Alert>}
      {accepted && <Help role="status">{t('projects.runs.accepted', { id: accepted })}</Help>}
      <Actions>
        <Button data-testid="project-run-submit" variant="contained" loading={isLoading} disabled={!body || uncertain || sourceQuery.isFetching} onClick={start}>▶ {t('projects.runs.run')}</Button>
        <Help>{t('projects.runs.key_hint')}</Help>
      </Actions>
      </fieldset>
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------ the console

type Tab = 'deployments' | 'runs' | 'logs' | 'settings';
const TABS: Tab[] = ['deployments', 'runs', 'logs', 'settings'];

/**
 * One project's console. `switcher`: on a repository's page with several deployments (the root and its monorepo
 * folder projects), the row that picks which one this console shows — drawn under the breadcrumb.
 */
export function ProjectConsole({ project: initial, switcher }: { project: Project; switcher?: ReactNode }) {
  const { cacheIdentity } = useAuth();
  return <ProjectConsoleContent key={`${cacheIdentity}:${initial.id}`} project={initial} switcher={switcher} />;
}

function ProjectConsoleContent({ project: initial, switcher }: { project: Project; switcher?: ReactNode }) {
  const { t } = useT();
  const { cacheIdentity, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const active = useActiveView();
  const [sp, setSp] = useSearchParams();
  const tab: Tab = (TABS as string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as Tab) : 'deployments';
  const setTab = (id: string) => setSp((prev) => { const n = new URLSearchParams(prev); if (id === 'deployments') n.delete('tab'); else n.set('tab', id); n.delete('open'); return n; });
  const open = sp.get('open');
  const setOpen = (id: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (id) n.set('open', id); else n.delete('open'); return n; });

  const live = isLive(initial.status);
  const projectQ = useProjectQuery({ id: initial.id, identity: cacheIdentity }, { pollingInterval: live ? 2000 : 15_000 });
  const p = projectQ.currentData?.id === initial.id ? projectQ.currentData : initial;
  const deployments = useProjectDeploymentsQuery({ id: p.id, identity: cacheIdentity }, { pollingInterval: live ? 2000 : 15_000 });
  const kind = p.kind ?? p.manifest?.kind ?? null;
  const canRun = hasProjectRunTargets(p);
  const readRuns = canRun || tab === 'runs' || tab === 'logs';
  const runs = useProjectRunsQuery({ id: p.id, identity: cacheIdentity }, { skip: !readRuns, pollingInterval: tab === 'runs' ? 2000 : 0 });
  useTitle(`${p.org}/${p.repoName}`);
  const deploymentRead = deployments.isError ? null : readProjectDeploymentHistory(deployments.currentData, p.id);
  const rows = deploymentRead ?? [];
  const deploymentsFailed = deployments.isError || !deployments.isFetching && deploymentRead === null;
  const runRead = runs.isError ? null : readProjectRunHistory(runs.currentData, p.id);
  const runRows = runRead ?? [];
  const runsFailed = readRuns && (runs.isError || !runs.isFetching && runRead === null);
  const visitUrl = deploymentRead ? activeProjectUrl(p, rows) : null;
  const latest = projectRedeployTarget(p, rows);
  const newest = latest?.status;
  useEffect(() => { if (newest && newest !== p.status) void projectQ.refetch(); }, [newest, p.status, projectQ]);

  // Deployments: filters + pages
  const [status, setStatus] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [page, setPage] = useState(1);
  const branches = useMemo(() => [...new Set(rows.map((d) => d.ref.replace(/^refs\/heads\//, '')))], [rows]);
  const filtered = rows.filter((d) => (!status || d.status === status) && (!branch || d.ref.replace(/^refs\/heads\//, '') === branch));
  const pageView = deploymentPage(filtered, page, open, PAGE);
  const shown = pageView.rows;

  // Runs
  const [draft, setDraft] = useState<RunDraft>(() => emptyDraft(p));
  // The values a run was started with are not read back (they may be secrets): Run again keeps the commit and entry,
  // and leaves the answers to be given again.
  const runAgain = (d: Deployment) => { setDraft({ ...emptyDraft(p), target: 'commit', sha: d.sha, entry: d.entry ?? '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const [redeploy, { isLoading: redeploying }] = useRedeployMutation();
  const [redeployment] = useState(createProjectRedeployment);
  const [redeployUnknown, setRedeployUnknown] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [syncFromGithub, { isLoading: syncing }] = useSyncFromGithubMutation();
  const [headErr, setHeadErr] = useState<string | null>(null);
  const [synced, setSynced] = useState<{ target: Project; requestedAt: string } | null>(null);
  const syncConfirmed = !!synced && sameProjectManagementTarget(p, synced.target, 'sync');
  // GitHub → AIN Drive runs on a backoff; this asks for it now. The push to AIN Drive then deploys as usual.
  const syncNow = () => manage('sync', () => syncFromGithub(p.id).unwrap());
  const redeployRecord = async (selected: Deployment) => {
    if (!p.canOperate || !rows.some(row => row.id === selected.id && row.sha === selected.sha) || redeployment.blocked()) return;
    setHeadErr(null);
    setAccepted(null);
    try {
      const id = await redeployment.submit(selected, deploymentId => redeploy({ deploymentId, projectId: p.id }).unwrap(), [...rows, ...runRows].map(d => d.id));
      if (active() && id) { setAccepted(id); openDeployment(id); }
    } catch (e) {
      if (!active()) return;
      if (redeployment.uncertain()) setRedeployUnknown(true);
      else { const x = projectApiErrorOf(e); setHeadErr(x.message ?? t(`projects.api.${x.code}`)); }
    }
  };

  // Logs
  const logRecords = [...rows, ...runRows].sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const logId = sp.get('record') ?? '';
  const selectedLog = logId ? logRecords.find(d => d.id === logId) : logRecords[0];
  const setLogRecord = (id: string) => setSp(prev => { const n = new URLSearchParams(prev); if (id) n.set('record', id); else n.delete('record'); return n; });
  // A service or Next.js app has a runtime log beside its build log; `?log=build` deep-links the build one.
  const hasRuntime = kind === 'service' || kind === 'nextjs';
  const logView: 'runtime' | 'build' = sp.get('log') === 'build' || logId && sp.get('log') !== 'runtime' ? 'build' : 'runtime';
  const setLogView = (v: 'runtime' | 'build') => setSp((prev) => { const n = new URLSearchParams(prev); n.set('log', v); return n; });

  // Settings
  const [remove, { isLoading: removing }] = useDeleteProjectMutation();
  const [rotate, { isLoading: rotating }] = useRotateProjectSecretMutation();
  const [rotated, setRotated] = useState<{ target: Project; secret: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [management] = useState(createProjectManagement);
  const [managementBusy, setManagementBusy] = useState(false);
  const [managementUnknown, setManagementUnknown] = useState(false);
  const managementReady = isSignedIn && !projectQ.isError && projectQ.currentData?.id === initial.id;
  const managementDisabled = !managementReady || managementBusy || managementUnknown;
  const manage = async (action: ProjectManagementAction, send: () => Promise<unknown>) => {
    if (managementDisabled || management.blocked() || (action === 'sync' ? !p.canOperate : !p.canManage)) return;
    setManagementBusy(true); setError(null); setHeadErr(null);
    if (action === 'rotate') setRotated(null);
    try {
      const result = await management.run(p, action, { read: () => projectQ.refetch().unwrap(), send, active });
      if (!active() || !result) return;
      if (result.kind === 'delete') navigate('/me/projects', { replace: true });
      if (result.kind === 'rotate') setRotated({ target: p, secret: result.receipt.webhookSecret });
      if (result.kind === 'sync') setSynced({ target: p, requestedAt: result.requestedAt });
    } catch (err) {
      if (!active()) return;
      const failure = projectApiErrorOf(err);
      setError(management.uncertain() ? t('projects.settings.unconfirmed') : err instanceof ProjectManagementError
        ? t('projects.settings.changed') : failure.message ?? t(`projects.api.${failure.code}`));
    } finally { if (active()) { setManagementBusy(false); setManagementUnknown(management.uncertain()); } }
  };
  const del = () => {
    if (managementDisabled || management.blocked() || !p.canManage) return;
    if (window.confirm(t('projects.page.delete_confirm', { name: p.name }))) void manage('delete', () => remove(p.id).unwrap());
  };
  const doRotate = () => {
    if (managementDisabled || management.blocked() || !p.canManage) return;
    if (window.confirm(t('projects.settings.rotate_confirm'))) void manage('rotate', () => rotate(p.id).unwrap());
  };
  useEffect(() => { if (!isSignedIn || !p.canManage || projectQ.isError) setRotated(null); }, [isSignedIn, p.canManage, projectQ.isError]);

  const goToEnv = () => {
    setTab('settings');
    // after the Settings tab has rendered
    setTimeout(() => document.getElementById(ENV_SECTION_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const openDeployment = (id: string) => {
    setStatus(''); setBranch(''); setPage(1);
    setSp(prev => { const n = new URLSearchParams(prev); n.delete('tab'); n.set('open', id); return n; });
  };

  const tabs = [
    { id: 'deployments', label: `${t('projects.tabs.deployments')}${rows.length ? ` (${rows.length})` : ''}` },
    { id: 'runs', label: `${t('projects.tabs.runs')}${runRows.length ? ` (${runRows.length})` : ''}` },
    { id: 'logs', label: t('projects.tabs.logs') },
    { id: 'settings', label: t('projects.tabs.settings') },
  ];

  if (projectQ.isError || projectQ.currentData && projectQ.currentData.id !== initial.id) return <PageWrapper><Alert role="alert" $tone="error">{error ?? t('projects.page.load_failed')} <Button loading={projectQ.isFetching} onClick={() => void projectQ.refetch()}>{t('projects.page.retry')}</Button></Alert></PageWrapper>;

  if (p.deletionRequestedAt !== undefined) return <PageWrapper>
    <h1>{p.name}</h1>
    <Alert role="status" $tone="warning">{t('projects.settings.deleting')}</Alert>
    {error && <Alert role="alert" $tone="error">{error}</Alert>}
    <Actions>
      <Button disabled={projectQ.isFetching} onClick={() => void projectQ.refetch()}>{t('projects.page.retry')}</Button>
      {isSignedIn && p.canManage && <Button color="secondary" disabled={managementDisabled} loading={removing} onClick={del}>{t('projects.settings.resume_delete')}</Button>}
    </Actions>
  </PageWrapper>;

  return (
    <PageWrapper $wide>
      <Crumbs aria-label="breadcrumb">
        <Link to={orgPath(p.org)}>{p.org}</Link><span className="sep">/</span><span>{p.repoName}</span>
        {p.sourcePath && <><span className="sep">/</span><span>{p.sourcePath}</span></>}
        <StatusDot status={p.status} />
      </Crumbs>
      {switcher}
      <HeaderRow>
        {p.sourceCommit && <Meta>{t('projects.page.source')}: <Mono title={p.sourceCommit}>{shortSha(p.sourceCommit)}</Mono></Meta>}
        {p.activeCommit && <Meta>{t('projects.page.active')}: <Mono title={p.activeCommit}>{shortSha(p.activeCommit)}</Mono></Meta>}
        {kind ? <Chip $tone="muted">{t(`projects.kind.${kind}`)}</Chip> : <Meta>{t('projects.page.kind_pending')}</Meta>}
        <Meta>{t('projects.page.branch')}: <Mono>{p.branch}</Mono></Meta>
        <ExternalLink href={p.repo} target="_blank" rel="noreferrer">{t('projects.page.repo')} ↗</ExternalLink>
        {p.upstreamRepo && <ExternalLink href={p.upstreamRepo} target="_blank" rel="noreferrer">GitHub ↗</ExternalLink>}
        {p.aindrive?.logStore && <ExternalLink href={p.aindrive.logStore.urls.logs} target="_blank" rel="noreferrer">{t('projects.aindrive.open_logs')} ↗</ExternalLink>}
        <Chip $tone={statusToneOf(p.status)}>{t(`projects.status.${p.status}`)}</Chip>
        {p.name !== p.repoName && <Meta>{p.name}</Meta>}
        <Spacer />
        <Actions>
          <Button size="small" title={t('projects.page.code_hint')} onClick={() => window.open(codeWorkspaceUrlOf(p), '_blank', 'noreferrer')}><Mono>{'</>'}</Mono> {t('projects.page.code')}</Button>
          {canRun && <Button variant="contained" size="small" onClick={() => setTab('runs')}>▶ {t('projects.runs.run')}</Button>}
          {visitUrl && <Button variant="contained" size="small" onClick={() => window.open(visitUrl, '_blank', 'noreferrer')}>{t('projects.page.visit')} ↗</Button>}
          {p.canOperate && latest && <Button size="small" loading={redeploying} disabled={redeployUnknown} title={t('projects.page.redeploy_hint')} onClick={() => void redeployRecord(latest)}>{t('projects.page.redeploy_commit', { sha: shortSha(latest.sha) })}</Button>}
          {isSignedIn && p.canOperate && projectSyncTarget(p) && <Button size="small" loading={syncing} disabled={syncConfirmed || managementDisabled} title={t('projects.page.github_sync_hint')} onClick={syncNow}>{syncConfirmed ? t('projects.page.github_sync_requested') : t('projects.page.github_sync')}</Button>}
        </Actions>
      </HeaderRow>
      {headErr && <Alert $tone="error">{headErr}</Alert>}
      {accepted && <Alert role="status" $tone="info">{t('projects.page.redeploy_accepted')} <Mono>{accepted}</Mono> <Button size="small" onClick={() => openDeployment(accepted)}>{t('projects.env.deploy.open')}</Button></Alert>}
      {redeployUnknown && <Alert role="alert" $tone="warning">{t('projects.page.redeploy_unconfirmed')} <Button size="small" loading={deployments.isFetching} onClick={() => { setTab('deployments'); void deployments.refetch(); }}>{t('projects.page.retry')}</Button></Alert>}
      {error && <Alert role="alert" $tone="error">{error} <Button loading={projectQ.isFetching} onClick={() => void projectQ.refetch()}>{t('projects.page.retry')}</Button></Alert>}
      <MissingEnvBanner project={p} onGo={goToEnv} />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'deployments' && (
        <TabBody>
          <FilterRow>
            <Select aria-label={t('projects.filters.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{t('projects.filters.all_statuses')}</option>
              {(['queued', 'building', 'ready', 'error'] as const).map((s) => <option key={s} value={s}>{t(`projects.status.${s}`)}</option>)}
            </Select>
            {(branches.length > 1 || branch) && (
              <Select aria-label={t('projects.filters.branch')} value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1); }}>
                <option value="">{t('projects.filters.all_branches')}</option>
                {branch && !branches.includes(branch) && <option value={branch}>{branch}</option>}
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            )}
            <Spacer />
            {deploymentRead && <Meta>{t('projects.filters.count', { n: filtered.length })}</Meta>}
          </FilterRow>
          {open && deploymentRead && !rows.some(d => d.id === open) && <Alert role="alert" $tone="info">{t('projects.page.record_unavailable')} <Mono>{open}</Mono> <Button onClick={() => void deployments.refetch()} loading={deployments.isFetching}>{t('projects.page.retry')}</Button></Alert>}
          {deploymentsFailed ? <Alert role="alert" $tone="error">{t('projects.page.history_failed')} <Button onClick={() => void deployments.refetch()} loading={deployments.isFetching}>{t('projects.page.retry')}</Button></Alert> : (deploymentRead === null && deployments.isFetching) ? <CenterProgress /> : shown.length === 0
            ? <Empty>{rows.length === 0 ? t('projects.page.no_deployments', { branch: p.branch }) : t('projects.filters.none')}</Empty>
            : <Rows>{shown.map((d) => <DeploymentRow key={d.id} d={d} project={p} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} onRedeploy={d => void redeployRecord(d)} redeployBlocked={redeploying || redeployUnknown} />)}</Rows>}
          {pageView.count > 1 && <Pagination page={pageView.page} pageCount={pageView.count} onChange={n => { setPage(n); setOpen(null); }} />}
        </TabBody>
      )}

      {tab === 'runs' && (
        <TabBody>
          <ProjectRunPanel project={p} draft={draft} setDraft={setDraft} onStarted={(id) => { setOpen(id); void runs.refetch(); }} />
          <SubTitle>{t('projects.runs.history')}</SubTitle>
          {open && runRead && !runRows.some(d => d.id === open) && <Alert role="alert" $tone="info">{t('projects.page.record_unavailable')} <Mono>{open}</Mono> <Button onClick={() => void runs.refetch()} loading={runs.isFetching}>{t('projects.page.retry')}</Button></Alert>}
          {runsFailed ? <Alert $tone="error">{t('projects.page.history_failed')} <Button onClick={() => void runs.refetch()} loading={runs.isFetching}>{t('projects.page.retry')}</Button></Alert> : (runRead === null && runs.isFetching) ? <CenterProgress /> : runRows.length === 0 ? <Empty>{t('projects.runs.none')}</Empty>
            : <Rows>{runRows.map((d) => <DeploymentRow key={d.id} d={d} project={p} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} onRunAgain={runAgain} />)}</Rows>}
        </TabBody>
      )}

      {tab === 'logs' && (
        <TabBody>
          {hasRuntime && (
            <FilterRow role="group" aria-label={t('projects.tabs.logs')}>
              <Button size="small" variant={logView === 'runtime' ? 'contained' : undefined} aria-pressed={logView === 'runtime'} onClick={() => setLogView('runtime')}>{t('projects.logs.runtime')}</Button>
              <Button size="small" variant={logView === 'build' ? 'contained' : undefined} aria-pressed={logView === 'build'} onClick={() => setLogView('build')}>{t('projects.logs.build')}</Button>
            </FilterRow>
          )}
          {hasRuntime && logView === 'runtime' ? <RuntimeLogView project={p} onRefreshProject={() => void projectQ.refetch()} /> : deploymentsFailed || runsFailed ? <Alert $tone="error">{t('projects.page.history_failed')} <Button onClick={() => { void deployments.refetch(); if (readRuns) void runs.refetch(); }}>{t('projects.page.retry')}</Button></Alert> : (deploymentRead === null && deployments.isFetching) || (runRead === null && runs.isFetching) ? <CenterProgress /> : (
            <>
              <FilterRow>
                <Select aria-label={t('projects.logs.record')} value={logId} onChange={e => setLogRecord(e.target.value)}>
                  <option value="">{t('projects.logs.latest')}</option>
                  {logId && !selectedLog && <option value={logId}>{logId} · {t('projects.logs.record_unavailable')}</option>}
                  {logRecords.map(d => <option key={d.id} value={d.id}>{t(`projects.trigger.${d.trigger}`)} · {shortSha(d.sha) || '…'} · {when(d.createdAt)} · {d.id}</option>)}
                </Select>
                {selectedLog && <><StatusDot status={selectedLog.status} /><Meta>{t(`projects.trigger.${selectedLog.trigger}`)} · <Mono>{selectedLog.sha ? shortSha(selectedLog.sha) : '…'}</Mono> · {when(selectedLog.createdAt)}</Meta></>}
                <Spacer />
                {selectedLog && <ExternalLink href={deploymentLogHref(selectedLog.id)} target="_blank" rel="noreferrer">{t('projects.logs.raw')} ↗</ExternalLink>}
              </FilterRow>
              {selectedLog ? <LogView key={selectedLog.id} deployment={selectedLog} downloadName={`${p.org}-${p.repoName}-${selectedLog.id}.log`} />
                : logId ? <Alert role="alert" $tone="info">{t('projects.page.record_unavailable')}</Alert> : <Empty>{t('projects.logs.none')}</Empty>}
            </>
          )}
        </TabBody>
      )}

      {tab === 'settings' && (
        <TabBody>
          <ProjectEnvVars project={p} onOpenDeployment={openDeployment} />
          {p.canManage && (kind === 'nextjs' || kind === 'service') && <ProjectDomains projectId={p.id} />}
          <KeyValue>
            {p.upstreamRepo && <><dt>GitHub</dt><dd><ExternalLink href={p.upstreamRepo} target="_blank" rel="noreferrer">{p.upstreamRepo}</ExternalLink></dd></>}
            <dt>{t('projects.page.repo')}</dt><dd><ExternalLink href={p.repo} target="_blank" rel="noreferrer">{p.repo}</ExternalLink></dd>
            <dt>{t('projects.page.branch')}</dt><dd><Mono>{p.branch}</Mono></dd>
            <dt>{t('projects.page.kind')}</dt><dd>{kind ? t(`projects.kind.${kind}`) : <Meta>{t('projects.page.kind_pending')}</Meta>}{p.manifest && <Meta> · {p.manifest.detected}</Meta>}</dd>
            {p.manifest?.entry && <><dt>{t('projects.runs.entry')}</dt><dd><Mono>{p.manifest.entry}</Mono>{p.manifest.runtime && <Meta> · {p.manifest.runtime}</Meta>}</dd></>}
            {p.manifest && Object.keys(p.manifest.inputs).length > 0 && (
              <><dt>{t('projects.settings.inputs')}</dt><dd>{Object.entries(p.manifest.inputs).map(([n, s]) => <div key={n}><Mono>{n}</Mono> <Meta>{s.type ?? 'string'}{s.required ? ' · required' : ''}{s.default !== undefined ? ` · default ${String(s.default)}` : ''}{s.description ? ` — ${s.description}` : ''}</Meta></div>)}</dd></>
            )}
            {p.manifest && (p.manifest.envKeys ?? Object.keys(p.manifest.env ?? {})).length > 0 && (
              <><dt>{t('projects.settings.env')}</dt><dd>{(p.manifest.envKeys ?? Object.keys(p.manifest.env ?? {})).map((k) => <div key={k}><Mono>{k}</Mono></div>)}</dd></>
            )}
            <dt>{t('projects.aindrive.title')}</dt>
            <dd>
              <div><Meta>{t('projects.aindrive.repo')}: </Meta><ExternalLink href={p.aindrive?.repo?.url || p.repo} target="_blank" rel="noreferrer">{repoLabelOf(p.aindrive?.repo?.url || p.repo)} ↗</ExternalLink> <ExternalLink href={codeWorkspaceUrlOf(p)} target="_blank" rel="noreferrer" title={t('projects.page.code_hint')}>{t('projects.page.code')} ↗</ExternalLink></div>
              {p.aindrive?.logStore && (
                <div style={{ marginTop: 6 }}>
                  <Meta>{t('projects.aindrive.log_store')}: </Meta><ExternalLink href={p.aindrive.logStore.urls.base || p.aindrive.logStore.urls.logs} target="_blank" rel="noreferrer"><Mono>{p.aindrive.logStore.basePath}</Mono> ↗</ExternalLink> <CopyButton text={p.aindrive.logStore.basePath} />
                  {aindriveLinksOf(p.aindrive).map((l) => <div key={l.key}><ExternalLink href={l.url} target="_blank" rel="noreferrer">{t(`projects.aindrive.${l.key}`)} ↗</ExternalLink> <Mono>{l.path}</Mono></div>)}
                  <Help>{t('projects.aindrive.log_store_help')}</Help>
                </div>
              )}
            </dd>
            <dt>URL</dt><dd><Mono>{p.url}</Mono> <CopyButton text={p.url} /></dd>
            {p.canManage && p.hookUrl && <><dt>{t('projects.settings.webhook')}</dt><dd><Mono>{p.hookUrl}</Mono> <CopyButton text={p.hookUrl} /><Help>{t('projects.settings.webhook_help')}</Help></dd></>}
          </KeyValue>
          <Help>{t('projects.settings.readonly')} <ExternalLink href={p.repo} target="_blank" rel="noreferrer">{t('projects.settings.edit_in_aindrive')} ↗</ExternalLink></Help>
          {isSignedIn && rotated && sameProjectManagementTarget(p, rotated.target, 'rotate') && <Alert $tone="warning"><strong>{t('projects.settings.rotated')}</strong> <Mono>{rotated.secret}</Mono> <CopyButton text={rotated.secret} /></Alert>}
          {isSignedIn && p.canManage && (
            <Actions style={{ marginTop: 16 }}>
              <Button size="small" loading={rotating} disabled={managementDisabled || !sameProjectManagementTarget(p, p, 'rotate')} onClick={doRotate}>{t('projects.settings.rotate')}</Button>
              <Spacer />
              <Button size="small" color="secondary" loading={removing} disabled={managementDisabled} onClick={del}>{t('projects.page.delete')}</Button>
            </Actions>
          )}
          <Actions style={{ marginTop: 16 }}><StyledLink to="/me/projects">← {t('projects.mine.title')}</StyledLink></Actions>
        </TabBody>
      )}
    </PageWrapper>
  );
}

/** Every deployment of the repository — its root and folder projects — each a tab with its status. */
function RepoDeployments({ projects, selected, onPick }: { projects: Project[]; selected: string; onPick: (id: string) => void }) {
  const { t } = useT();
  return (
    <section aria-label={t('projects.page.repo_deployments')} data-testid="repo-deployments">
      <Meta>{t('projects.page.repo_deployments')}</Meta>
      <Tabs tabs={projects.map((p) => ({ id: p.id, label: `${repoProjectLabel(p)} · ${t(`projects.status.${p.status}`)}` }))} value={selected} onChange={onPick} />
    </section>
  );
}

/** `path` (which may carry its own query) with `search` (`?a=b`) merged in; the path's own parameters win. */
const withSearch = (path: string, search: string) => {
  const [base, own = ''] = path.split('?');
  const merged = new URLSearchParams(search);
  for (const [k, v] of new URLSearchParams(own)) merged.set(k, v);
  const q = merged.toString();
  return q ? `${base}?${q}` : base!;
};

// ------------------------------------------------------------------------------------------------ routes

/** `/:org/:repo` — a project by name; when none is bound here, the knowledge page that used to own this shape. */
export function ProjectByNamePage() {
  const { org = '', repo = '' } = useParams();
  const { t } = useT();
  const { isSignedIn, cacheIdentity } = useAuth();
  const location = useLocation();
  useTitle(`${org}/${repo}`);
  const reserved = isReservedFirstSegment(org);
  const knowledge = isKnowledgeAuthor(org);
  const q = useProjectByNameQuery({ org, repo, identity: cacheIdentity }, { skip: reserved || knowledge });
  // A monorepo's folder projects share this address: the organization's list names them (the ones this viewer may see).
  const orgQ = useOrgProjectsQuery({ org, identity: cacheIdentity }, { skip: reserved || knowledge || !q.currentData });
  const [sp, setSp] = useSearchParams();
  if (reserved) return <NotFoundPage />;
  if (knowledge) return <PatchPage author={org} patchId={repo} />;
  if (q.isLoading || (q.isFetching && !q.currentData)) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (q.currentData && !q.error) {
    const folder = sp.get('project');
    if (folder && !orgQ.currentData && orgQ.isFetching) return <PageWrapper><CenterProgress /></PageWrapper>;
    const validProjects = Array.isArray(orgQ.currentData?.projects);
    if (folder && (orgQ.isError || !validProjects)) return <PageWrapper><Alert role="alert" $tone="error">{t('projects.page.load_failed')} <Button loading={orgQ.isFetching} onClick={() => void orgQ.refetch()}>{t('projects.page.retry')}</Button></Alert></PageWrapper>;
    const all = repoProjects(q.currentData, !orgQ.error && validProjects ? orgQ.currentData!.projects : []);
    const selected = selectRepoProject(all, folder);
    if (!selected) return <PageWrapper>
      <Crumbs><Link to={orgPath(org)}>{org}</Link><span className="sep">/</span><span>{repo}</span><span className="sep">/</span><span>{folder}</span></Crumbs>
      <Empty data-testid="project-selection-unavailable">{t('projects.page.folder_unavailable', { folder: folder ?? '' })}</Empty>
      <Actions><Button loading={orgQ.isFetching} onClick={() => void orgQ.refetch()}>{t('projects.page.retry')}</Button><StyledLink to={projectPath(q.currentData)}>{t('projects.page.repository')}</StyledLink></Actions>
    </PageWrapper>;
    const pick = (id: string) => setSp(() => { const n = new URLSearchParams(); const folder = all.find((p) => p.id === id)?.sourcePath; if (folder) n.set('project', folder); return n; });
    const switcher = all.length > 1 ? <RepoDeployments projects={all} selected={selected.id} onPick={pick} /> : undefined;
    return <ProjectConsole key={`${cacheIdentity}:${selected.id}`} project={selected} switcher={switcher} />;
  }
  const why = projectApiErrorOf(q.error);
  const unavailable = why.status === 404 || why.status === 401 || why.status === 403;
  return <PageWrapper>
    <Crumbs aria-label={t('projects.page.title')}><Link to={orgPath(org)}>{org}</Link><span className="sep">/</span><span>{repo}</span></Crumbs>
    <SubTitle>{t(unavailable ? 'projects.page.unavailable' : 'projects.page.load_failed')}</SubTitle>
    <Empty>{t(unavailable ? (isSignedIn ? 'projects.page.check_access' : 'projects.page.signin_check') : 'projects.page.retry_help')}</Empty>
    <Actions>
      {!isSignedIn && unavailable && <StyledLink to={signInHref(location)}>{t('projects.runs.sign_in_button')}</StyledLink>}
      <Button onClick={() => void q.refetch()} loading={q.isFetching}>{t('projects.page.retry')}</Button>
      <StyledLink to="/apps">{t('projects.page.apps')}</StyledLink>
    </Actions>
  </PageWrapper>;
}

/**
 * `/projects/:id` — the old address; forwards to `/<org>/<repo>` once the project is known. A monorepo folder's project
 * has no name of its own (it shares the repository's), so this is its page: it renders here.
 */
export default function ProjectPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const location = useLocation();
  const q = useProjectQuery({ id, identity: useAuth().cacheIdentity });
  if (!q.currentData && q.isFetching) return <PageWrapper><CenterProgress /></PageWrapper>;
  // A folder project's page is its repository's, with it selected (`?project=<folder>`); other parameters ride along.
  if (q.currentData && !q.error) return <Navigate to={withSearch(projectPath(q.currentData), location.search)} replace />;
  const why = projectApiErrorOf(q.error);
  return <PageWrapper><SubTitle>{t('projects.page.title')}</SubTitle><Empty>{why.code === 'not_found' || why.status === 404 ? t('projects.page.not_found') : (why.message ?? t(`projects.api.${why.code}`))}</Empty><Button loading={q.isFetching} onClick={() => void q.refetch()}>{t('projects.page.retry')}</Button></PageWrapper>;
}
