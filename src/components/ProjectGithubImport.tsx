/**
 * "Import from GitHub" on `/projects/new` (ainize-node docs/PROJECTS.md): a GitHub repository that has no AIN Drive
 * copy. The form's extra fields — which organization's drive, the AIN Drive repository to create, an optional
 * ainize.json — and the progress view the page keeps at `?import=<org>/<repo>` until the project exists.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import styled from 'styled-components';
import { useGithubImportQuery, useWithdrawGithubImportMutation } from '@/api/api';
import { apiErrorCodeOf, importNameLooksRight, projectApiErrorOf } from '@/api/projects';
import { useShareableOrgs } from '@/hooks/useShareableOrgs';
import { projectPath } from '@/lib/reservedRoutes';
import { Button } from '@/components/ui/Button';
import { Alert, FormRow, SelectField, TextArea, TextField } from '@/components/ui/Form';
import { CenterProgress, Description, ExternalLink, Mono, StyledLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';

const Actions = styled.div`margin-top: 16px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;
const Steps = styled.ol`margin: 4px 0 16px; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14px; max-width: 640px;`;
const Step = styled.li<{ $done: boolean }>`color: ${(p) => (p.$done ? p.theme.color.BLACK : p.theme.color.GREY)}; font-weight: ${(p) => (p.$done ? 600 : 400)};`;
const Advanced = styled.details`max-width: 640px; summary { cursor: pointer; font-size: 13px; font-weight: 700; } > div { margin-top: 10px; }`;

/** The words for a refusal of `POST /api/github-imports`: ours when we have them, else the node's own sentence. */
export function importErrorText(t: (k: string, v?: Record<string, string | number>) => string, err: unknown): string {
  const code = apiErrorCodeOf(err);
  const key = code ? `projects.import.err.${code}` : null;
  const ours = key ? t(key) : null;
  if (ours && ours !== key) return ours;
  const why = projectApiErrorOf(err);
  return why.message ?? t(`projects.api.${why.code}`);
}

export interface ImportDraft { org: string; name: string; manifest: string }

/** The fields a GitHub repository needs beyond its URL and branch. `nameDefault` is the GitHub repository's own name. */
export function GithubImportFields({ draft, onChange, nameDefault, askManifest }: { draft: ImportDraft; onChange: (d: ImportDraft) => void; nameDefault: string; askManifest: boolean }) {
  const { t } = useT();
  const { orgs } = useShareableOrgs();
  const slugs = [...new Set((orgs ?? []).map((o) => o.slug).filter(Boolean))];
  // One organization → that one, without asking.
  useEffect(() => { if (!draft.org && slugs.length) onChange({ ...draft, org: slugs[0] }); }, [draft, slugs.join(','), onChange]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = draft.name || nameDefault;
  return <>
    <Alert $tone="info">{t('projects.import.detected')}</Alert>
    <FormRow>
      {slugs.length > 1 || (draft.org && !slugs.includes(draft.org))
        ? <SelectField label={t('projects.import.org')} helper={t('projects.import.org_help')} value={draft.org} onChange={(e) => onChange({ ...draft, org: e.target.value })}>
            {[...new Set([...slugs, draft.org].filter(Boolean))].map((s) => <option key={s} value={s}>{s}</option>)}
          </SelectField>
        : slugs.length === 1
          ? <TextField label={t('projects.import.org')} helper={t('projects.import.org_help')} value={slugs[0]} readOnly />
          : <TextField label={t('projects.import.org')} helper={t('projects.import.org_none')} value={draft.org} onChange={(e) => onChange({ ...draft, org: e.target.value.trim() })} spellCheck={false} />}
      <TextField label={t('projects.import.name')} value={draft.name} placeholder={nameDefault} onChange={(e) => onChange({ ...draft, name: e.target.value.trim() })} spellCheck={false}
        error={!importNameLooksRight(name)} helper={importNameLooksRight(name) ? t('projects.import.name_help', { org: draft.org || '<org>', name }) : t('projects.import.name_bad')} />
    </FormRow>
    <Advanced open={askManifest || !!draft.manifest}>
      <summary>{t('projects.import.manifest')}</summary>
      <div>
        <TextArea aria-label={t('projects.import.manifest')} rows={7} value={draft.manifest} onChange={(e) => onChange({ ...draft, manifest: e.target.value })} spellCheck={false}
          placeholder={'{\n  "kind": "service",\n  "port": 8080,\n  "healthcheck": "/"\n}'} error={askManifest && !draft.manifest.trim()}
          helper={<>{t('projects.import.manifest_help')} <StyledLink to="/docs/how-to/deploy-with-ainize-json">{t('projects.import.manifest_docs')}</StyledLink></>} />
      </div>
    </Advanced>
  </>;
}

/** An import on its way: asked → AIN Drive repository created → project bound (then the project page). */
export function GithubImportProgress({ org, repo }: { org: string; repo: string }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [gone, setGone] = useState(false);
  const query = useGithubImportQuery({ org, repo }, { pollingInterval: gone ? 0 : 4000, skip: gone });
  const [withdraw, withdrawing] = useWithdrawGithubImportMutation();
  const view = query.currentData;
  const project = view?.project ?? null;
  useEffect(() => { if (project) navigate(projectPath({ org, repoName: repo }), { replace: true }); }, [project, org, repo, navigate]);

  if (gone) return <Alert $tone="info">{t('projects.import.withdrawn')} <StyledLink to="/projects/new">{t('projects.import.again')}</StyledLink></Alert>;
  if (query.error && !view) {
    const why = projectApiErrorOf(query.error);
    return <Alert $tone={why.code === 'not_found' ? 'warning' : 'error'}>{why.code === 'not_found' ? t('projects.import.not_found', { org, repo }) : importErrorText(t, query.error)} <StyledLink to="/projects/new">{t('projects.import.again')}</StyledLink></Alert>;
  }
  if (!view) return <CenterProgress />;
  const imp = view.import, status = view.status;
  const failed = status?.state === 'error';
  const pushed = status?.state === 'ok';
  return <>
    <Description>
      {imp && <><ExternalLink href={imp.githubUrl} target="_blank" rel="noreferrer">{imp.github}</ExternalLink> · <Mono>{imp.branch}</Mono> → </>}
      <Mono>{org}/{repo}</Mono>
    </Description>
    <Steps data-testid="github-import-steps">
      <Step $done>{t('projects.import.step_asked')}</Step>
      <Step $done={pushed || !!project}>{t('projects.import.step_repo')}</Step>
      <Step $done={!!project}>{t('projects.import.step_project')}</Step>
    </Steps>
    {failed
      ? <Alert $tone="error" role="alert">{t('projects.import.failed', { why: status!.message })}</Alert>
      : <Alert $tone="info" role="status">{project ? t('projects.import.opening') : pushed ? t('projects.import.waiting_project') : t('projects.import.waiting_repo')}</Alert>}
    {imp && <Actions>
      {failed && <Button variant="contained" onClick={() => navigate('/projects/new', { state: { importDraft: { repo: imp.githubUrl, branch: imp.branch, org: imp.org, name: imp.repo } } })}>{t('projects.import.retry')}</Button>}
      <Button color="secondary" loading={withdrawing.isLoading} onClick={() => { void withdraw({ org, repo }).unwrap().then(() => setGone(true)).catch(() => undefined); }}>{t('projects.import.withdraw')}</Button>
    </Actions>}
  </>;
}
