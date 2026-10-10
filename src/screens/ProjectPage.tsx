/**
 * `/<org>/<repo>` — the project console: the deployment and run page of a repository, modelled on Vercel's project
 * dashboard. aindrive's ▶ Run is the short form; this is the full one ("aindrive의 Run은 약식이고 ainize의 run/deploy가
 * 본 페이지"). Header: `org / repo`, the kind, the production branch, the repo, the status dot and the primary
 * actions — Run (script), Visit (service / agent / nextjs), Redeploy. Four tabs, deep-linked through `?tab=`:
 *
 *   Deployments  the Vercel-shaped rows (status dot, sha + subject, branch, who, when, how long); a row opens the
 *                full log (polled while it runs), exit code, output link, Redeploy — "roll back to this one" for a
 *                service, since a redeploy of an earlier commit re-points the container. Filters, pagination.
 *   Runs         script projects: the Run panel — entry file, the `inputs` form out of ainize.json (GitHub
 *                workflow_dispatch shape → INPUT_*), extra env, a model picker for a model input, timeout, example
 *                presets (`examples` in ainize.json) — and the history of runs, each re-runnable with its inputs.
 *   Logs         the newest deployment's or run's log, downloadable.
 *   Settings     branch, what ainize.json says (read-only; edit in aindrive), env preview, webhook, rotate, delete.
 *
 * Reading is public (ainize-node docs/PROJECTS.md "Who sees what"); the node says with `canManage` / `canOperate`
 * which buttons this caller gets. `/projects/:id` still resolves and forwards here.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import styled, { keyframes } from 'styled-components';
import {
  useDeleteProjectMutation, useDeploymentLogQuery, useModelsQuery, useProjectByNameQuery, useProjectDeploymentsQuery, useProjectQuery, useProjectRunsQuery,
  useRedeployMutation, useRotateProjectSecretMutation, useRunProjectMutation,
} from '@/api/api';
import { parseModelsResponse } from '@/api/models';
import {
  durationLabel, inputAnswers, isModelInput, missingInputs, parseEnvLines, projectApiErrorOf, relativeTime, shortSha, statusToneOf,
  type Deployment, type DeploymentStatus, type ManifestInput, type Project, type ProjectStatus, type RunInput,
} from '@/api/projects';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, Input, Select } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Empty, ExternalLink, KeyValue, Mono, PageWrapper, Pagination, StyledLink, SubTitle, Tabs } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { isReservedFirstSegment, orgPath, projectPath } from '@/lib/reservedRoutes';
import { useTitle } from '@/utils/useTitle';
import NotFoundPage from './NotFoundPage';
import PatchPage from './PatchPage';

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
function LogView({ deployment, onText }: { deployment: Deployment; onText?: (text: string) => void }) {
  const { t } = useT();
  const { data, isLoading } = useDeploymentLogQuery(deployment.id, { pollingInterval: isLive(deployment.status) ? 2000 : 0 });
  useEffect(() => { if (data !== undefined) onText?.(data); }, [data, onText]);
  if (isLoading && !data) return <Log>{t('projects.page.log_empty')}</Log>;
  return <Log aria-live="polite">{data?.length ? data : t('projects.page.log_empty')}</Log>;
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Who: the pusher's email, or the subject; a run names the person who pressed Run. */
const who = (d: Deployment) => d.pusher?.email ?? d.pusher?.subject ?? null;

function DeploymentRow({ d, project, open, onToggle, onRunAgain }: { d: Deployment; project: Project; open: boolean; onToggle: () => void; onRunAgain?: (d: Deployment) => void }) {
  const { t } = useT();
  const tone = statusToneOf(d.status);
  const [redeploy, { isLoading: redeploying }] = useRedeployMutation();
  const [err, setErr] = useState<string | null>(null);
  const isService = d.kind === 'service' || d.kind === 'nextjs';
  const again = async () => {
    setErr(null);
    try { await redeploy({ deploymentId: d.id, projectId: project.id }).unwrap(); }
    catch (e) { const x = projectApiErrorOf(e); setErr(x.message ?? t(`projects.api.${x.code}`)); }
  };
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
          {d.status === 'queued' && <Meta>{t('projects.page.pending_hint')}</Meta>}
          {d.error && <Alert $tone="error" style={{ padding: '8px 12px' }}>{d.error}</Alert>}
          {d.trigger === 'run' && d.inputs && Object.keys(d.inputs).length > 0 && (
            <Meta>{t('projects.runs.with_inputs')}: {Object.entries(d.inputs).map(([k, v]) => `${k}=${v}`).join(' · ')}{d.entry ? ` · ${t('projects.runs.entry')}: ${d.entry}` : ''}</Meta>
          )}
          <Actions>
            {d.status === 'ready' && d.outputUrl && <ExternalLink href={d.outputUrl} target="_blank" rel="noreferrer">{d.kind === 'script' ? t('projects.page.output') : t('projects.page.visit')} ↗</ExternalLink>}
            <ExternalLink href={d.logUrl} target="_blank" rel="noreferrer">{t('projects.logs.raw')} ↗</ExternalLink>
            <Spacer />
            {project.canOperate && d.trigger === 'run' && onRunAgain && <Button size="small" onClick={() => onRunAgain(d)}>{t('projects.runs.again')}</Button>}
            {project.canOperate && d.trigger !== 'run' && d.sha && (
              <Button size="small" loading={redeploying} onClick={again} title={isService ? t('projects.page.rollback_hint') : undefined}>
                {isService && project.lastDeploymentId !== d.id ? t('projects.page.rollback') : t('projects.page.redeploy')}
              </Button>
            )}
          </Actions>
          {err && <Alert $tone="error">{err}</Alert>}
          <LogView deployment={d} />
        </>
      )}
    </Row>
  );
}

// ------------------------------------------------------------------------------------------------ the Run panel

interface RunDraft { target: 'head' | 'commit' | 'deployed'; sha: string; entry: string; answers: Record<string, string>; env: string; timeoutMs: string }
const emptyDraft = (p: Project): RunDraft => ({ target: 'head', sha: '', entry: p.manifest?.entry ?? p.entry ?? p.runnable?.[0] ?? '', answers: {}, env: '', timeoutMs: '' });

function InputField({ name, spec, value, onChange, models }: { name: string; spec: ManifestInput; value: string; onChange: (v: string) => void; models: string[] }) {
  const type = spec.type ?? 'string';
  const id = `in-${name}`;
  const label = <>{name}{spec.required && ' *'}{spec.description && <Help>{spec.description}</Help>}</>;
  if (type === 'boolean') return <Field><Checkbox id={id} label={label} checked={value === 'true' || (value === '' && spec.default === true)} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} /></Field>;
  if (type === 'choice' || (isModelInput(name, spec) && models.length)) {
    const options = spec.options?.length ? spec.options : models;
    return (
      <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Select id={id} value={value || String(spec.default ?? '')} onChange={(e) => onChange(e.target.value)}>
          {!spec.required && <option value="">—</option>}
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Field>
    );
  }
  return (
    <Field><FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type={type === 'number' ? 'number' : 'text'} value={value} placeholder={spec.default !== undefined ? String(spec.default) : ''} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function RunPanel({ project, draft, setDraft, onStarted }: { project: Project; draft: RunDraft; setDraft: (d: RunDraft) => void; onStarted: (runId: string) => void }) {
  const { t } = useT();
  const { isSignedIn } = useAuth();
  const location = useLocation();
  const [run, { isLoading }] = useRunProjectMutation();
  const [err, setErr] = useState<string | null>(null);
  const modelsQuery = useModelsQuery();
  const models = useMemo(() => parseModelsResponse(modelsQuery.data).filter((m) => m.available !== false).map((m) => m.id), [modelsQuery.data]);
  const manifest = project.manifest;
  const inputs = manifest?.inputs ?? {};
  const runnable = project.runnable?.length ? project.runnable : draft.entry ? [draft.entry] : [];
  const missing = missingInputs(inputs, draft.answers);
  const setAnswer = (name: string, v: string) => setDraft({ ...draft, answers: { ...draft.answers, [name]: v } });
  const preset = (ex: { inputs: Record<string, string | number | boolean> }) => {
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(ex.inputs)) answers[k] = String(v);
    setDraft({ ...draft, answers });
  };
  const start = async () => {
    setErr(null);
    if (draft.target === 'commit' && !/^[a-f0-9]{40,64}$/.test(draft.sha)) { setErr(t('projects.runs.sha_required')); return; }
    const body: RunInput = {
      target: draft.target, ...(draft.target === 'commit' ? { sha: draft.sha } : {}),
      ...(draft.entry && draft.entry !== manifest?.entry ? { entry: draft.entry } : {}),
      inputs: inputAnswers(inputs, draft.answers),
      env: parseEnvLines(draft.env),
      ...(draft.timeoutMs ? { timeoutMs: Number(draft.timeoutMs) * 1000 } : {}),
    };
    try { const r = await run({ id: project.id, body }).unwrap(); onStarted(r.runId ?? r.deploymentId); }
    catch (e) { const x = projectApiErrorOf(e); setErr(x.message ?? t(`projects.api.${x.code}`)); }
  };
  if (!isSignedIn) {
    return <Panel><Help>{t('projects.runs.sign_in')}</Help><Actions><Button variant="contained" onClick={() => { window.location.assign(`/signing?next=${encodeURIComponent(location.pathname + location.search)}`); }}>{t('projects.runs.sign_in_button')}</Button></Actions></Panel>;
  }
  if (!project.canOperate) return <Panel><Help>{t('projects.runs.not_member', { org: project.org })}</Help></Panel>;
  return (
    <Panel aria-label={t('projects.runs.panel')}>
      {manifest?.examples?.length ? (
        <div>
          <FieldLabel as="div">{t('projects.runs.examples')}</FieldLabel>
          <Presets>{manifest.examples.map((ex) => <Button key={ex.name} size="small" title={ex.description} onClick={() => preset(ex)}>{ex.name}</Button>)}</Presets>
        </div>
      ) : null}
      <Grid>
        <Field><FieldLabel htmlFor="run-target">{t('projects.runs.target')}</FieldLabel>
          <Select id="run-target" value={draft.target} onChange={(e) => setDraft({ ...draft, target: e.target.value as RunDraft['target'] })}>
            <option value="head">{t('projects.runs.head')}</option>
            <option value="commit">{t('projects.runs.commit')}</option>
            <option value="deployed" disabled={!project.activeCommit}>{t('projects.runs.deployed')}{project.activeCommit ? ` · ${shortSha(project.activeCommit)}` : ''}</option>
          </Select>
        </Field>
        {draft.target === 'commit' && <Field><FieldLabel htmlFor="run-sha">{t('projects.runs.sha')}</FieldLabel><Input id="run-sha" value={draft.sha} onChange={(e) => setDraft({ ...draft, sha: e.target.value.trim() })} placeholder={project.sourceCommit ?? ''} /></Field>}
        <Field><FieldLabel htmlFor="run-entry">{t('projects.runs.entry')}</FieldLabel>
          {runnable.length > 1
            ? <Select id="run-entry" value={draft.entry} onChange={(e) => setDraft({ ...draft, entry: e.target.value })}>{runnable.map((f) => <option key={f} value={f}>{f}</option>)}</Select>
            : <Input id="run-entry" value={draft.entry} onChange={(e) => setDraft({ ...draft, entry: e.target.value })} placeholder="main.py" />}
        </Field>
        {Object.entries(inputs).map(([name, spec]) => <InputField key={name} name={name} spec={spec} value={draft.answers[name] ?? ''} onChange={(v) => setAnswer(name, v)} models={models} />)}
        <Field><FieldLabel htmlFor="run-timeout">{t('projects.runs.timeout')}</FieldLabel>
          <Input id="run-timeout" type="number" min={1} max={300} value={draft.timeoutMs} placeholder={String((manifest?.timeoutMs ?? 120_000) / 1000)} onChange={(e) => setDraft({ ...draft, timeoutMs: e.target.value })} />
        </Field>
      </Grid>
      <Field><FieldLabel htmlFor="run-env">{t('projects.runs.env')}</FieldLabel>
        <Input as="textarea" id="run-env" rows={2} value={draft.env} placeholder={'NAME=value\nOTHER=value'} onChange={(e) => setDraft({ ...draft, env: e.target.value })} style={{ fontFamily: 'monospace', minHeight: 56 }} />
        <Help>{t('projects.runs.env_help')}</Help>
      </Field>
      {missing.length > 0 && <Help>{t('projects.runs.missing', { names: missing.join(', ') })}</Help>}
      {err && <Alert $tone="error">{err}</Alert>}
      <Actions>
        <Button variant="contained" loading={isLoading} disabled={missing.length > 0 || !draft.entry} onClick={start}>▶ {t('projects.runs.run')}</Button>
        <Help>{t('projects.runs.key_hint')}</Help>
      </Actions>
    </Panel>
  );
}

// ------------------------------------------------------------------------------------------------ the console

type Tab = 'deployments' | 'runs' | 'logs' | 'settings';
const TABS: Tab[] = ['deployments', 'runs', 'logs', 'settings'];

export function ProjectConsole({ project: initial }: { project: Project }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab: Tab = (TABS as string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as Tab) : 'deployments';
  const setTab = (id: string) => setSp((prev) => { const n = new URLSearchParams(prev); if (id === 'deployments') n.delete('tab'); else n.set('tab', id); n.delete('open'); return n; }, { replace: true });
  const open = sp.get('open');
  const setOpen = (id: string | null) => setSp((prev) => { const n = new URLSearchParams(prev); if (id) n.set('open', id); else n.delete('open'); return n; }, { replace: true });

  const live = isLive(initial.status);
  const projectQ = useProjectQuery(initial.id, { pollingInterval: live ? 2000 : 15_000 });
  const p = projectQ.data ?? initial;
  const deployments = useProjectDeploymentsQuery(p.id, { pollingInterval: live ? 2000 : 15_000 });
  const runs = useProjectRunsQuery(p.id, { pollingInterval: tab === 'runs' ? 2000 : 0 });
  useTitle(`${p.org}/${p.repoName}`);
  const newest = deployments.data?.deployments[0]?.status;
  useEffect(() => { if (newest && newest !== p.status) void projectQ.refetch(); }, [newest, p.status, projectQ]);

  const rows = deployments.data?.deployments ?? [];
  const runRows = runs.data?.runs ?? [];
  const kind = p.kind ?? p.manifest?.kind ?? null;
  const isScript = kind === 'script' || kind === null;
  const lastReady = rows.find((d) => d.status === 'ready' && d.outputUrl);
  const latest = rows[0];

  // Deployments: filters + pages
  const [status, setStatus] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [page, setPage] = useState(1);
  const branches = useMemo(() => [...new Set(rows.map((d) => d.ref.replace(/^refs\/heads\//, '')))], [rows]);
  const filtered = rows.filter((d) => (!status || d.status === status) && (!branch || d.ref.replace(/^refs\/heads\//, '') === branch));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const shown = filtered.slice((page - 1) * PAGE, page * PAGE);

  // Runs
  const [draft, setDraft] = useState<RunDraft>(() => emptyDraft(p));
  useEffect(() => { if (!draft.entry && (p.manifest?.entry || p.runnable?.length)) setDraft(emptyDraft(p)); }, [p, draft.entry]);
  const runAgain = (d: Deployment) => { setDraft({ target: 'commit', sha: d.sha, entry: d.entry ?? draft.entry, answers: { ...(d.inputs ?? {}) }, env: Object.entries(d.env ?? {}).map(([k, v]) => `${k}=${v}`).join('\n'), timeoutMs: '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const [redeploy, { isLoading: redeploying }] = useRedeployMutation();
  const [headErr, setHeadErr] = useState<string | null>(null);
  const redeployLatest = async () => {
    if (!latest) return;
    setHeadErr(null);
    try { const r = await redeploy({ deploymentId: latest.id, projectId: p.id }).unwrap(); setTab('deployments'); setOpen(r.deploymentId); }
    catch (e) { const x = projectApiErrorOf(e); setHeadErr(x.message ?? t(`projects.api.${x.code}`)); }
  };

  // Logs
  const latestAny = [latest, runRows[0]].filter((x): x is Deployment => !!x).sort((a, b) => b.createdAt - a.createdAt)[0];
  const [logText, setLogText] = useState('');

  // Settings
  const [remove, { isLoading: removing }] = useDeleteProjectMutation();
  const [rotate, { isLoading: rotating }] = useRotateProjectSecretMutation();
  const [rotated, setRotated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const del = async () => {
    if (!window.confirm(t('projects.page.delete_confirm', { name: p.name }))) return;
    setError(null);
    try { await remove(p.id).unwrap(); navigate('/me/projects', { replace: true }); }
    catch (err) { const e = projectApiErrorOf(err); setError(e.message ?? t(`projects.api.${e.code}`)); }
  };
  const doRotate = async () => {
    if (!window.confirm(t('projects.settings.rotate_confirm'))) return;
    setError(null);
    try { const r = await rotate(p.id).unwrap(); setRotated(r.webhookSecret); }
    catch (err) { const e = projectApiErrorOf(err); setError(e.message ?? t(`projects.api.${e.code}`)); }
  };

  const tabs = [
    { id: 'deployments', label: `${t('projects.tabs.deployments')}${rows.length ? ` (${rows.length})` : ''}` },
    ...(isScript ? [{ id: 'runs', label: `${t('projects.tabs.runs')}${runRows.length ? ` (${runRows.length})` : ''}` }] : []),
    { id: 'logs', label: t('projects.tabs.logs') },
    { id: 'settings', label: t('projects.tabs.settings') },
  ];

  return (
    <PageWrapper $wide>
      <Crumbs aria-label="breadcrumb">
        <Link to={orgPath(p.org)}>{p.org}</Link><span className="sep">/</span><span>{p.repoName}</span>
        <StatusDot status={p.status} />
      </Crumbs>
      <HeaderRow>
        {p.sourceCommit && <Meta>{t('projects.page.source')}: <Mono title={p.sourceCommit}>{shortSha(p.sourceCommit)}</Mono></Meta>}
        {p.activeCommit && <Meta>{t('projects.page.active')}: <Mono title={p.activeCommit}>{shortSha(p.activeCommit)}</Mono></Meta>}
        {kind ? <Chip $tone="muted">{t(`projects.kind.${kind}`)}</Chip> : <Meta>{t('projects.page.kind_pending')}</Meta>}
        <Meta>{t('projects.page.branch')}: <Mono>{p.branch}</Mono></Meta>
        <ExternalLink href={p.repo} target="_blank" rel="noreferrer">{t('projects.page.repo')} ↗</ExternalLink>
        <Chip $tone={statusToneOf(p.status)}>{t(`projects.status.${p.status}`)}</Chip>
        {p.name !== p.repoName && <Meta>{p.name}</Meta>}
        <Spacer />
        <Actions>
          {isScript && <Button variant="contained" size="small" onClick={() => setTab('runs')}>▶ {t('projects.runs.run')}</Button>}
          {!isScript && lastReady?.outputUrl && <Button variant="contained" size="small" onClick={() => window.open(lastReady.outputUrl, '_blank', 'noreferrer')}>{t('projects.page.visit')} ↗</Button>}
          {p.canOperate && latest?.sha && <Button size="small" loading={redeploying} onClick={redeployLatest}>{t('projects.page.redeploy')}</Button>}
        </Actions>
      </HeaderRow>
      {headErr && <Alert $tone="error">{headErr}</Alert>}
      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'deployments' && (
        <TabBody>
          <FilterRow>
            <Select aria-label={t('projects.filters.status')} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">{t('projects.filters.all_statuses')}</option>
              {(['queued', 'building', 'ready', 'error'] as const).map((s) => <option key={s} value={s}>{t(`projects.status.${s}`)}</option>)}
            </Select>
            {branches.length > 1 && (
              <Select aria-label={t('projects.filters.branch')} value={branch} onChange={(e) => { setBranch(e.target.value); setPage(1); }}>
                <option value="">{t('projects.filters.all_branches')}</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            )}
            <Spacer />
            <Meta>{t('projects.filters.count', { n: filtered.length })}</Meta>
          </FilterRow>
          {deployments.isLoading && !deployments.data ? <CenterProgress /> : shown.length === 0
            ? <Empty>{rows.length === 0 ? t('projects.page.no_deployments', { branch: p.branch }) : t('projects.filters.none')}</Empty>
            : <Rows>{shown.map((d) => <DeploymentRow key={d.id} d={d} project={p} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} />)}</Rows>}
          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onChange={setPage} />}
        </TabBody>
      )}

      {tab === 'runs' && isScript && (
        <TabBody>
          <RunPanel project={p} draft={draft} setDraft={setDraft} onStarted={(id) => { setOpen(id); void runs.refetch(); }} />
          <SubTitle>{t('projects.runs.history')}</SubTitle>
          {runRows.length === 0 ? <Empty>{t('projects.runs.none')}</Empty>
            : <Rows>{runRows.map((d) => <DeploymentRow key={d.id} d={d} project={p} open={open === d.id} onToggle={() => setOpen(open === d.id ? null : d.id)} onRunAgain={runAgain} />)}</Rows>}
        </TabBody>
      )}

      {tab === 'logs' && (
        <TabBody>
          {!latestAny ? <Empty>{t('projects.logs.none')}</Empty> : (
            <>
              <FilterRow>
                <StatusDot status={latestAny.status} />
                <Meta>{t(`projects.trigger.${latestAny.trigger}`)} · <Mono>{latestAny.sha ? shortSha(latestAny.sha) : '…'}</Mono> · {when(latestAny.createdAt)}</Meta>
                <Spacer />
                <Button size="small" onClick={() => download(`${p.org}-${p.repoName}-${latestAny.id}.log`, logText)} disabled={!logText}>{t('projects.logs.download')}</Button>
                <ExternalLink href={latestAny.logUrl} target="_blank" rel="noreferrer">{t('projects.logs.raw')} ↗</ExternalLink>
              </FilterRow>
              <LogView deployment={latestAny} onText={setLogText} />
            </>
          )}
        </TabBody>
      )}

      {tab === 'settings' && (
        <TabBody>
          <KeyValue>
            <dt>{t('projects.page.repo')}</dt><dd><ExternalLink href={p.repo} target="_blank" rel="noreferrer">{p.repo}</ExternalLink></dd>
            <dt>{t('projects.page.branch')}</dt><dd><Mono>{p.branch}</Mono></dd>
            <dt>{t('projects.page.kind')}</dt><dd>{kind ? t(`projects.kind.${kind}`) : <Meta>{t('projects.page.kind_pending')}</Meta>}{p.manifest && <Meta> · {p.manifest.detected}</Meta>}</dd>
            {p.manifest?.entry && <><dt>{t('projects.runs.entry')}</dt><dd><Mono>{p.manifest.entry}</Mono>{p.manifest.runtime && <Meta> · {p.manifest.runtime}</Meta>}</dd></>}
            {p.manifest && Object.keys(p.manifest.inputs).length > 0 && (
              <><dt>{t('projects.settings.inputs')}</dt><dd>{Object.entries(p.manifest.inputs).map(([n, s]) => <div key={n}><Mono>{n}</Mono> <Meta>{s.type ?? 'string'}{s.required ? ' · required' : ''}{s.default !== undefined ? ` · default ${String(s.default)}` : ''}{s.description ? ` — ${s.description}` : ''}</Meta></div>)}</dd></>
            )}
            {p.manifest && Object.keys(p.manifest.env).length > 0 && (
              <><dt>{t('projects.settings.env')}</dt><dd>{Object.entries(p.manifest.env).map(([k, v]) => <div key={k}><Mono>{k}={v}</Mono></div>)}</dd></>
            )}
            <dt>URL</dt><dd><Mono>{p.url}</Mono> <CopyButton text={p.url} /></dd>
            {p.canManage && p.hookUrl && <><dt>{t('projects.settings.webhook')}</dt><dd><Mono>{p.hookUrl}</Mono> <CopyButton text={p.hookUrl} /><Help>{t('projects.settings.webhook_help')}</Help></dd></>}
          </KeyValue>
          <Help>{t('projects.settings.readonly')} <ExternalLink href={p.repo} target="_blank" rel="noreferrer">{t('projects.settings.edit_in_aindrive')} ↗</ExternalLink></Help>
          {rotated && <Alert $tone="warning"><strong>{t('projects.settings.rotated')}</strong> <Mono>{rotated}</Mono> <CopyButton text={rotated} /></Alert>}
          {error && <Alert $tone="error">{error}</Alert>}
          {p.canManage && (
            <Actions style={{ marginTop: 16 }}>
              <Button size="small" loading={rotating} onClick={doRotate}>{t('projects.settings.rotate')}</Button>
              <Spacer />
              <Button size="small" color="secondary" loading={removing} onClick={del}>{t('projects.page.delete')}</Button>
            </Actions>
          )}
          <Actions style={{ marginTop: 16 }}><StyledLink to="/me/projects">← {t('projects.mine.title')}</StyledLink></Actions>
        </TabBody>
      )}
    </PageWrapper>
  );
}

// ------------------------------------------------------------------------------------------------ routes

/** `/:org/:repo` — a project by name; when none is bound here, the knowledge page that used to own this shape. */
export function ProjectByNamePage() {
  const { org = '', repo = '' } = useParams();
  const reserved = isReservedFirstSegment(org);
  const q = useProjectByNameQuery({ org, repo }, { skip: reserved });
  if (reserved) return <NotFoundPage />;
  if (q.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (q.data) return <ProjectConsole project={q.data} />;
  // Not a project here (404), or the node is unreachable: `/<author>/<patchId>` has its own answer either way.
  return <PatchPage />;
}

/** `/projects/:id` — the old address; forwards to `/<org>/<repo>` once the project is known. */
export default function ProjectPage() {
  const { t } = useT();
  const { id = '' } = useParams();
  const location = useLocation();
  const q = useProjectQuery(id);
  if (q.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (q.data) return <Navigate to={`${projectPath(q.data)}${location.search}`} replace />;
  const why = projectApiErrorOf(q.error);
  return <PageWrapper><SubTitle>{t('projects.page.title')}</SubTitle><Empty>{why.code === 'not_found' || why.status === 404 ? t('projects.page.not_found') : (why.message ?? t(`projects.api.${why.code}`))}</Empty></PageWrapper>;
}
