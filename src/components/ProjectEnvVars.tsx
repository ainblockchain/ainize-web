/**
 * Settings → Environment Variables: the project's secrets (src/api/projectSecrets.ts), the way Vercel shows a
 * sensitive variable — the name, when it was set, `••••••` for the value, and Edit / Remove. A value is write-only:
 * nobody reads it back, not the owner either. Add one, or paste a `.env` and save it in one go; a redeploy can ride on
 * the last write so the running app picks the values up, and the deployment it starts is followed here until it is
 * ready or failed.
 *
 * A member without the write role sees the names ainize.json declares (the node refuses them the list); anyone else
 * sees nothing — the node answers them 404.
 */
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useDeleteProjectSecretMutation, useDeploymentQuery, useProjectSecretsQuery, useRedeployMutation, useSetProjectSecretMutation } from '@/api/api';
import {
  declaredSecretNames, envAccessOf, envRowsOf, parseDotEnv, planBulk, readProjectSecretsResponse, saveSecretsSequentially, secretApiErrorOf, secretNameProblem, secretValueProblem, SECRET_VALUE_MAX,
  type BulkPlanRow, type EnvRow,
} from '@/api/projectSecrets';
import { relativeTime, statusToneOf, type Project, type Queued } from '@/api/projects';
import { useAuth } from '@/auth/AuthContext';
import { useActiveView } from '@/hooks/useActiveView';
import { createProjectEnvWork, type ProjectEnvWork } from '@/lib/projectEnvWork';
import { deploymentLogHref, readProjectDeployment } from '@/lib/projectHistory';
import { projectRunReceipt } from '@/lib/projectRun';
import { projectRedeployReceipt } from '@/lib/projectRedeploy';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Textarea } from '@/components/ui/Form';
import { ExternalLink, Mono } from '@/components/ui/Misc';
import { useT } from '@/i18n';

export const ENV_SECTION_ID = 'env';

const Section = styled.section`
  min-width: 0; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 16px; margin: 12px 0 20px;
  display: flex; flex-direction: column; gap: 14px; scroll-margin-top: 80px;
  h2 { margin: 0; font-size: 18px; }
  @media (max-width: 640px) { input, textarea { font-size: 16px; } button { min-height: 44px; } }
`;
const Help = styled.p`margin: 0; font-size: 13px; color: #666; overflow-wrap: anywhere;`;
const List = styled.ul`list-style: none; margin: 0; padding: 0; border-top: 1px solid #eee;`;
const Item = styled.li`border-bottom: 1px solid #eee; padding: 10px 0; display: flex; flex-direction: column; gap: 8px;`;
const ItemHead = styled.div`display: flex; align-items: center; gap: 8px 12px; flex-wrap: wrap; min-height: 36px; font-size: 14px;`;
const Name = styled(Mono)`font-weight: 600; overflow-wrap: anywhere; word-break: break-all; min-width: 0;`;
const Masked = styled.span`font-family: ${(p) => p.theme.font.mono}; color: #999; letter-spacing: 2px;`;
const Meta = styled.span`font-size: 13px; color: #666;`;
const Spacer = styled.span`flex: 1;`;
const Actions = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap;`;
const Badge = styled.span<{ $tone: 'warn' | 'ok' | 'muted' | 'busy' }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px; white-space: nowrap;
  background: ${(p) => (p.$tone === 'ok' ? '#e8f6ec' : p.$tone === 'warn' ? '#fdeeee' : '#f1f2f5')};
  color: ${(p) => (p.$tone === 'ok' ? '#227a3c' : p.$tone === 'warn' ? '#a33030' : '#555')};
`;
const Form = styled.form`display: flex; flex-direction: column; gap: 10px; min-width: 0;`;
const Grid = styled.div`display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 12px; @media (max-width: 640px) { grid-template-columns: minmax(0, 1fr); }`;
const MonoArea = styled(Textarea)`font-family: ${(p) => p.theme.font.mono}; font-size: 13px; min-height: 64px;`;
const Details = styled.details`border-top: 1px solid #eee; padding-top: 12px; summary { cursor: pointer; font-weight: 600; font-size: 14px; min-height: 32px; }`;
const PlanList = styled.ul`list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; font-size: 13px;
  li { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; overflow-wrap: anywhere; }`;

type T = ReturnType<typeof useT>['t'];
const errorText = (t: T, err: unknown): string => {
  const e = secretApiErrorOf(err);
  return e.code !== 'unknown' ? t(`projects.env.err.${e.code}`) : (e.message ?? t('projects.env.err.unknown'));
};
const problemText = (t: T, problem: string) => t(`projects.env.problem.${problem}`, { max: SECRET_VALUE_MAX / 1024 });

/** The value box: a password field while hidden (values are one line), a textarea when revealed. */
function ValueInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const { t } = useT();
  const [reveal, setReveal] = useState(false);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{t('projects.env.value')}</FieldLabel>
      {reveal
        ? <MonoArea id={id} rows={2} value={value} autoFocus={autoFocus} spellCheck={false} autoComplete="off" onChange={(e) => onChange(e.target.value)} />
        : <Input id={id} type="password" value={value} autoFocus={autoFocus} autoComplete="new-password" spellCheck={false} onChange={(e) => onChange(e.target.value)} />}
      <Checkbox label={t('projects.env.reveal')} checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
    </Field>
  );
}

/** A deployment a save started, followed until it is ready or failed. */
export function DeployWatch({ projectId, queued, onOpen }: { projectId: string; queued: Queued; onOpen?: (deploymentId: string) => void }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  const accepted = projectRunReceipt(queued);
  const q = useDeploymentQuery({ id: queued.deploymentId, identity: useAuth().cacheIdentity }, { skip: !accepted, pollingInterval: done ? 0 : 2000 });
  const read = q.error ? null : readProjectDeployment(q.currentData, projectId, queued.deploymentId);
  const d = read?.trigger === 'redeploy' ? read : null;
  const status = d?.status ?? queued.status;
  useEffect(() => { if (d?.status === 'ready' || d?.status === 'error') setDone(true); }, [d?.status]);
  if (!accepted) return <Alert role="alert" $tone="warning">{t('projects.env.deploy.unconfirmed')}</Alert>;
  if (q.error || !q.isFetching && !d || q.currentData !== undefined && !d) return <Alert role="alert" $tone="error">{t('projects.page.history_failed')} <Button loading={q.isFetching} onClick={() => void q.refetch()}>{t('projects.page.retry')}</Button></Alert>;
  return (
    <Alert $tone={status === 'error' ? 'error' : status === 'ready' ? 'success' : 'info'} aria-live="polite">
      <Actions>
        <Badge $tone={statusToneOf(status)}>{t(`projects.status.${status}`)}</Badge>
        <Mono>{queued.deploymentId}</Mono>
        <span>{t(`projects.env.deploy.${status}`)}</span>
        <Spacer />
        {d && <ExternalLink href={deploymentLogHref(d.id)} target="_blank" rel="noreferrer">{t('projects.logs.raw')} ↗</ExternalLink>}
        {onOpen && <Button size="small" variant="text" onClick={() => onOpen(queued.deploymentId)}>{t('projects.env.deploy.open')}</Button>}
      </Actions>
      {d?.error && <Help>{d.error}</Help>}
    </Alert>
  );
}

function EnvItem({ row, project, redeploy, work, onSaved }: { row: EnvRow; project: Project; redeploy: boolean; work: ProjectEnvWork; onSaved: (q: Queued | null) => void }) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [put, putting] = useSetProjectSecretMutation();
  const [del, deleting] = useDeleteProjectSecretMutation();
  const problem = secretValueProblem(value);
  const save = async () => {
    if (work.blocked()) return;
    setErr(null);
    if (problem) return;
    try { const r = await work.run(() => put({ id: project.id, name: row.name, value, redeploy }).unwrap()); if (!r) return; setEditing(false); setValue(''); onSaved(r.redeploy); }
    catch (e) { setErr(errorText(t, e)); }
  };
  const remove = async () => {
    if (work.blocked()) return;
    if (!window.confirm(t('projects.env.remove_confirm', { name: row.name }))) return;
    setErr(null);
    try { const r = await work.run(() => del({ id: project.id, name: row.name, redeploy }).unwrap()); if (!r) return; onSaved(r.redeploy); }
    catch (e) { setErr(errorText(t, e)); }
  };
  return (
    <Item>
      <ItemHead>
        <Name>{row.name}</Name>
        {row.set ? <Masked aria-label={t('projects.env.hidden_value')}>••••••</Masked> : <Badge $tone="warn">{t('projects.env.missing')}</Badge>}
        {row.set && <Meta title={row.updatedAt ? new Date(row.updatedAt).toLocaleString() : undefined}>{t('projects.env.set_updated', { when: relativeTime(row.updatedAt) || '—' })}</Meta>}
        {row.declared && <Meta>{t('projects.env.declared')}</Meta>}
        <Spacer />
        <Actions>
          <Button size="small" onClick={() => { setEditing(!editing); setErr(null); setValue(''); }} aria-expanded={editing}>{row.set ? t('projects.env.edit') : t('projects.env.set_value')}</Button>
          {row.set && <Button size="small" color="secondary" loading={deleting.isLoading} onClick={remove}>{t('projects.env.remove')}</Button>}
        </Actions>
      </ItemHead>
      {editing && (
        <Form onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <ValueInput id={`env-edit-${row.name}`} value={value} onChange={setValue} autoFocus />
          {problem && <HelperText $error>{problemText(t, problem)}</HelperText>}
          {row.set && <Help>{t('projects.env.replace_help')}</Help>}
          <Actions>
            <Button type="submit" size="small" variant="contained" loading={putting.isLoading} disabled={!!problem}>{t('projects.env.save')}</Button>
            <Button type="button" size="small" variant="text" onClick={() => { setEditing(false); setValue(''); setErr(null); }}>{t('projects.env.cancel')}</Button>
          </Actions>
        </Form>
      )}
      {err && <Alert $tone="error">{err}</Alert>}
    </Item>
  );
}

function AddForm({ project, existing, redeploy, work, onSaved }: { project: Project; existing: string[]; redeploy: boolean; work: ProjectEnvWork; onSaved: (q: Queued | null) => void }) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [put, putting] = useSetProjectSecretMutation();
  const trimmed = name.trim();
  const nameProblem = secretNameProblem(trimmed);
  const valueProblem = secretValueProblem(value);
  const replaces = !nameProblem && existing.includes(trimmed);
  const submit = async () => {
    if (work.blocked()) return;
    setTouched(true); setErr(null);
    if (nameProblem || valueProblem) return;
    try { const r = await work.run(() => put({ id: project.id, name: trimmed, value, redeploy }).unwrap()); if (!r) return; setName(''); setValue(''); setTouched(false); onSaved(r.redeploy); }
    catch (e) { setErr(errorText(t, e)); }
  };
  return (
    <Form onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-label={t('projects.env.add')}>
      <Grid>
        <Field>
          <FieldLabel htmlFor="env-new-name">{t('projects.env.name')}</FieldLabel>
          <Input id="env-new-name" value={name} placeholder="API_KEY" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false}
            onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(!!name)} aria-invalid={touched && !!nameProblem} />
          {touched && nameProblem && <HelperText $error>{problemText(t, nameProblem)}</HelperText>}
          {replaces && <HelperText>{t('projects.env.will_replace')}</HelperText>}
        </Field>
        <div>
          <ValueInput id="env-new-value" value={value} onChange={setValue} />
          {valueProblem && <HelperText $error>{problemText(t, valueProblem)}</HelperText>}
        </div>
      </Grid>
      {err && <Alert $tone="error">{err}</Alert>}
      <Actions>
        <Button type="submit" variant="contained" size="small" loading={putting.isLoading} disabled={!trimmed || (touched && !!nameProblem) || !!valueProblem}>{replaces ? t('projects.env.replace') : t('projects.env.add')}</Button>
      </Actions>
    </Form>
  );
}

function BulkPaste({ project, existing, redeploy, work, onSaved }: { project: Project; existing: string[]; redeploy: boolean; work: ProjectEnvWork; onSaved: (q: Queued | null) => void }) {
  const { t } = useT();
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<{ rows: BulkPlanRow[]; skipped: ReturnType<typeof parseDotEnv>['skipped'] } | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ ok: number; failed: string | null } | null>(null);
  const [put] = useSetProjectSecretMutation();
  const valid = plan?.rows.filter((r) => r.action !== 'invalid') ?? [];
  const preview = () => { const p = parseDotEnv(text); setPlan({ rows: planBulk(p.entries, existing), skipped: p.skipped }); setResult(null); };
  const saveAll = async () => {
    if (!valid.length || work.blocked()) return;
    setResult(null); setProgress({ done: 0, total: valid.length });
    const r = await work.run(async () => {
      const result = await saveSecretsSequentially(valid, (name, value, rd) => put({ id: project.id, name, value, redeploy: rd }).unwrap(), {
        redeployLast: redeploy, onProgress: (done, total) => setProgress({ done, total }), isActive: work.active,
      });
      if (result.failed) work.report(result.failed.error);
      return result;
    });
    setProgress(null);
    if (!r) return;
    setResult({ ok: r.saved.length, failed: r.failed ? `${r.failed.name}: ${errorText(t, r.failed.error)}` : null });
    if (!r.failed) { setText(''); setPlan(null); }
    else setPlan((p) => p && { ...p, rows: p.rows.filter((row) => !r.saved.some((s) => s.name === row.name)) });
    if (r.saved.length) onSaved(r.redeploy);
  };
  return (
    <Details>
      <summary>{t('projects.env.bulk')}</summary>
      <Form onSubmit={(e) => { e.preventDefault(); preview(); }}>
        <Help>{t('projects.env.bulk_help')}</Help>
        <MonoArea aria-label={t('projects.env.bulk')} rows={6} value={text} spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="none"
          placeholder={'# .env\nDATABASE_URL=postgres://…\nexport OPENAI_API_KEY="sk-…"'} onChange={(e) => { setText(e.target.value); setPlan(null); }} />
        <Actions><Button type="submit" size="small" disabled={!text.trim() || !!progress}>{t('projects.env.bulk_preview')}</Button></Actions>
      </Form>
      {plan && (
        <>
          {plan.rows.length === 0 && plan.skipped.length === 0 && <Help>{t('projects.env.bulk_empty')}</Help>}
          <PlanList aria-label={t('projects.env.bulk_preview')}>
            {plan.rows.map((r) => (
              <li key={r.name}>
                <Badge $tone={r.action === 'invalid' ? 'warn' : r.action === 'create' ? 'ok' : 'muted'}>{t(`projects.env.action.${r.action}`)}</Badge>
                <Name>{r.name}</Name>
                {r.problem && <Meta>{problemText(t, r.problem)}</Meta>}
              </li>
            ))}
            {plan.skipped.map((s) => (
              <li key={`skip-${s.line}`}><Badge $tone="warn">{t('projects.env.action.skipped')}</Badge><Meta>{t(`projects.env.skip.${s.reason}`, { line: s.line })}</Meta></li>
            ))}
          </PlanList>
          {valid.length > 0 && (
            <Actions>
              <Button variant="contained" size="small" loading={!!progress} loadingText={progress ? t('projects.env.bulk_saving', { done: progress.done, total: progress.total }) : undefined} onClick={saveAll}>
                {t('projects.env.bulk_save', { n: valid.length })}
              </Button>
            </Actions>
          )}
        </>
      )}
      {result && result.failed && <Alert $tone="error">{t('projects.env.bulk_partial', { n: result.ok })} {result.failed}</Alert>}
      {result && !result.failed && <Alert $tone="success">{t('projects.env.bulk_done', { n: result.ok })}</Alert>}
    </Details>
  );
}

/** The list query, shared by the section and the page's "missing" banner (RTK Query dedupes the request). */
export function useProjectEnv(project: Project) {
  const { isSignedIn, cacheIdentity } = useAuth();
  const skip = !isSignedIn || !project.canOperate;
  const q = useProjectSecretsQuery({ id: project.id, identity: cacheIdentity }, { skip });
  const data = useMemo(() => q.error ? null : readProjectSecretsResponse(q.currentData), [q.error, q.currentData]);
  return { q, data, access: envAccessOf({ skip, isLoading: !q.currentData && q.isFetching, data: q.currentData, error: q.error }) };
}

export default function ProjectEnvVars(props: { project: Project; onOpenDeployment?: (deploymentId: string) => void }) {
  const { cacheIdentity } = useAuth();
  return <ProjectEnvVarsContent key={`${cacheIdentity}:${props.project.id}`} {...props} />;
}

function ProjectEnvVarsContent({ project, onOpenDeployment }: { project: Project; onOpenDeployment?: (deploymentId: string) => void }) {
  const { t } = useT();
  const { q, data, access } = useProjectEnv(project);
  const active = useActiveView();
  const [controller] = useState(createProjectEnvWork);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  async function runWork<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (!active() || access !== 'writer' || controller.blocked()) return undefined;
    setBusy(true);
    try {
      const result = await controller.run(task);
      return active() ? result : undefined;
    } finally {
      if (active()) { setBusy(false); setUncertain(controller.uncertain()); }
    }
  }
  const work: ProjectEnvWork = { run: runWork, report: controller.report, active, blocked: controller.blocked };

  const kind = project.kind ?? project.manifest?.kind ?? null;
  // A script reads its env when it runs; a deployed app only when it is deployed again.
  const deploys = kind !== 'script' && !!project.lastDeploymentId;
  const [redeployAfter, setRedeployAfter] = useState(true);
  const redeploy = deploys && redeployAfter;
  const [pending, setPending] = useState(false);
  const [queued, setQueued] = useState<Queued | null>(null);
  const [redeployNow, redeploying] = useRedeployMutation();
  const [redeployErr, setRedeployErr] = useState<string | null>(null);
  const redeployTargetQuery = useDeploymentQuery({ id: project.lastDeploymentId ?? '', identity: useAuth().cacheIdentity }, { skip: !pending || !project.lastDeploymentId || access !== 'writer', refetchOnMountOrArgChange: true });
  const redeployTarget = redeployTargetQuery.isError || !project.lastDeploymentId ? null : readProjectDeployment(redeployTargetQuery.currentData, project.id, project.lastDeploymentId);
  const targetReady = redeployTarget && /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(redeployTarget.sha);
  const rows = useMemo(() => (data ? envRowsOf(data) : []), [data]);
  const existing = useMemo(() => data?.secrets.map((s) => s.name) ?? [], [data]);

  if (access === 'hidden') return null;

  const onSaved = (r: Queued | null) => {
    if (!active()) return;
    setRedeployErr(null);
    if (r) { setQueued(r); setPending(false); } else if (deploys) { setQueued(null); setPending(true); }
  };
  const doRedeploy = async () => {
    if (!targetReady || !redeployTarget || redeployTargetQuery.isFetching) return;
    setRedeployErr(null);
    try {
      const r = await work.run(async () => {
        const response = await redeployNow({ deploymentId: redeployTarget.id, projectId: project.id, sha: redeployTarget.sha }).unwrap();
        if (!projectRedeployReceipt(response, redeployTarget)) throw new Error('unconfirmed_secret_mutation');
        return response;
      });
      if (r) { setQueued(r); setPending(false); }
    }
    catch (e) { if (active()) setRedeployErr(errorText(t, e)); }
  };

  const declared = project.manifest ? declaredSecretNames(project.manifest.secrets ?? []) : null;
  return (
    <Section id={ENV_SECTION_ID} aria-labelledby="env-title">
      <h2 id="env-title">{t('projects.env.title')}</h2>
      <Help>{t('projects.env.help')}</Help>

      {access === 'loading' && <Help>{t('projects.env.loading')}</Help>}
      {access === 'off' && <Alert $tone="info">{t('projects.env.err.secrets_off')}</Alert>}
      {access === 'error' && <Alert role="alert" $tone="error">{t('projects.env.load_failed')} <Button loading={q.isFetching} onClick={() => void q.refetch()}>{t('projects.page.retry')}</Button></Alert>}

      {access === 'reader' && (
        <>
          <Alert $tone="info">{t('projects.env.reader')}</Alert>
          {declared === null ? <Help>{t('projects.env.declarations_unknown')}</Help> : declared.length === 0 ? <Help>{t('projects.env.reader_none')}</Help> : (
            <List aria-label={t('projects.env.title')}>
              {declared.map((n) => <Item key={n}><ItemHead><Name>{n}</Name><Meta>{t('projects.env.declared')}</Meta><Meta>{t('projects.env.set_unknown')}</Meta></ItemHead></Item>)}
            </List>
          )}
        </>
      )}

      {uncertain && <Alert role="alert" $tone="warning">{t('projects.env.unconfirmed')} <Button loading={q.isFetching} onClick={() => void q.refetch()}>{t('projects.page.retry')}</Button></Alert>}
      {access === 'writer' && data && (
        <>
          <fieldset disabled={busy || uncertain} aria-busy={busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.length === 0 ? <Help>{t('projects.env.empty')}</Help> : (
            <List aria-label={t('projects.env.title')}>
              {rows.map((r) => <EnvItem key={r.name} row={r} project={project} redeploy={redeploy} work={work} onSaved={onSaved} />)}
            </List>
          )}
          <AddForm project={project} existing={existing} redeploy={redeploy} work={work} onSaved={onSaved} />
          <BulkPaste project={project} existing={existing} redeploy={redeploy} work={work} onSaved={onSaved} />
          {deploys
            ? <Checkbox label={t('projects.env.redeploy_after')} checked={redeployAfter} onChange={(e) => setRedeployAfter(e.target.checked)} />
            : <Help>{kind === 'script' ? t('projects.env.script_note') : t('projects.env.no_deployment_note')}</Help>}
          {pending && !queued && !uncertain && (
            <Alert $tone="warning">
              <Actions>
                <span>{t('projects.env.pending')}</span>
                <Spacer />
                <Button size="small" variant="contained" disabled={!targetReady || redeployTargetQuery.isFetching} loading={redeploying.isLoading} onClick={doRedeploy}>{targetReady ? t('projects.page.redeploy_commit', { sha: redeployTarget!.sha.slice(0, 7) }) : t('projects.env.redeploy_now')}</Button>
                {!targetReady && !redeployTargetQuery.isFetching && <span>{t('projects.page.load_failed')} <Button size="small" onClick={() => void redeployTargetQuery.refetch()}>{t('projects.page.retry')}</Button></span>}
              </Actions>
            </Alert>
          )}
          </fieldset>
          {redeployErr && <Alert $tone="error">{redeployErr}</Alert>}
          {queued && !uncertain && <DeployWatch key={queued.deploymentId} projectId={project.id} queued={queued} onOpen={onOpenDeployment} />}
        </>
      )}
    </Section>
  );
}

/** The page's banner: declared variables nobody has set. Shown only to whoever can set them. */
export function MissingEnvBanner({ project, onGo }: { project: Project; onGo: () => void }) {
  const { t } = useT();
  const { data, access } = useProjectEnv(project);
  const missing = access === 'writer' ? data?.missing ?? [] : [];
  if (!missing.length) return null;
  return (
    <Alert $tone="warning" role="status" style={{ margin: '8px 0' }}>
      <Actions>
        <span>{t('projects.env.banner', { n: missing.length }, missing.length)} <Mono>{missing.join(', ')}</Mono></span>
        <Spacer />
        <Button size="small" variant="contained" onClick={onGo}>{t('projects.env.banner_go')}</Button>
      </Actions>
    </Alert>
  );
}
