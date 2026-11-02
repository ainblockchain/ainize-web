/**
 * Organization settings → Project permissions (admins). "Script project X may read projects A, B while it runs":
 * every run of X then carries AINIZE_RUN_TOKEN, which opens exactly the view, deployments and runs of A and B
 * (ainize-node run-grant-token.ts, docs/PROJECTS.md "Project read grants"). A monitor in Runs that watches the
 * organization's own deployments needs this; a personal run key sees nothing org-private.
 *
 * Only script projects can be granted (only runs carry the token); targets are any of the organization's projects
 * but the grantee itself, picked by searching name or id (an organization has too many projects for a checkbox list). Saving replaces the list; an empty list removes the grant. Every change is in the audit log.
 */
import { useEffect, useMemo, useState } from 'react';
import { useOrgProjectGrantsQuery, useSetOrgProjectGrantMutation } from '@/api/api';
import { orgApiErrorOf, type OrgProfile } from '@/api/organizations';
import { Button } from '@/components/ui/Button';
import { Alert, FieldLabel, HelperText, Input } from '@/components/ui/Form';
import { CenterProgress, Description, Mono } from '@/components/ui/Misc';
import { Chip, Panel, Row } from '@/components/storage/common';
import { useT } from '@/i18n';

type ProjectRow = { id: string; name: string; kind: string; source_path: string };

const MAX_MATCHES = 8;

const label = (p: ProjectRow) => (p.source_path ? `${p.name}/${p.source_path}` : p.name);

export default function ProjectGrantsTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { data, isLoading, error: loadError } = useOrgProjectGrantsQuery(org.id);
  const [setGrant, setState] = useSetOrgProjectGrantMutation();
  const [editing, setEditing] = useState<string | null>(null);
  const [reads, setReads] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const projects = useMemo(() => [...(data?.projects ?? [])].sort((a, b) => label(a).localeCompare(label(b))), [data]);
  const grants = useMemo(() => new Map((data?.grants ?? []).map((g) => [g.project, g.reads])), [data]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const scripts = projects.filter((p) => p.kind === 'script');
  useEffect(() => { setReads(editing ? grants.get(editing) ?? [] : []); setError(null); setQuery(''); }, [editing, grants]);
  // An organization has many projects: pick by name or id, never a wall of checkboxes. At most MAX_MATCHES at a time.
  const q = query.trim().toLowerCase();
  const found = q ? projects.filter((x) => x.id !== editing && !reads.includes(x.id) && (label(x).toLowerCase().includes(q) || x.id.includes(q))) : [];
  const matches = found.slice(0, MAX_MATCHES);
  const more = found.length - matches.length;

  const capture = (err: unknown) => { const e = orgApiErrorOf(err); setError(e.message ? `${t(`org.api.${e.code}`)} — ${e.message}` : t(`org.api.${e.code}`)); };
  const save = async (project: string, next: string[]) => {
    setError(null);
    try { await setGrant({ id: org.id, project, reads: next }).unwrap(); setEditing(null); } catch (e) { capture(e); }
  };

  if (isLoading) return <CenterProgress />;
  if (loadError) return <Alert $tone="error">{t('orgSettings.grants.load_failed')}</Alert>;
  return (
    <Panel data-testid="org-settings-project-grants">
      <Description style={{ margin: 0 }}>{t('orgSettings.grants.lede')}</Description>
      {scripts.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.grants.no_scripts')}</Description>}
      {scripts.map((p) => {
        const granted = grants.get(p.id) ?? [];
        return (
          <div key={p.id} data-testid={`org-grant-${p.id}`}>
            <Row>
              <strong>{label(p)}</strong>
              <Mono>{p.id}</Mono>
              {granted.length === 0
                ? <Chip>{t('orgSettings.grants.none')}</Chip>
                : granted.map((id) => <Chip key={id}>{byId.get(id) ? label(byId.get(id)!) : id}</Chip>)}
              <Button size="small" variant="text" onClick={() => setEditing(editing === p.id ? null : p.id)} data-testid={`org-grant-edit-${p.id}`}>
                {editing === p.id ? t('orgSettings.grants.close') : t('orgSettings.grants.edit')}
              </Button>
            </Row>
            {editing === p.id && (
              <div>
                <FieldLabel htmlFor="org-grant-search">{t('orgSettings.grants.reads', { name: label(p) })}</FieldLabel>
                <Row>
                  {reads.length === 0 && <Chip>{t('orgSettings.grants.none')}</Chip>}
                  {reads.map((id) => (
                    <Chip key={id}>
                      {byId.get(id) ? label(byId.get(id)!) : id}
                      <Button size="small" variant="text" color="secondary" aria-label={t('orgSettings.grants.remove_one')} onClick={() => setReads(reads.filter((r) => r !== id))}>×</Button>
                    </Chip>
                  ))}
                </Row>
                <Input id="org-grant-search" value={query} placeholder={t('orgSettings.grants.search')} onChange={(e) => setQuery(e.target.value)} data-testid="org-grant-search" />
                {query.trim() && (
                  <Row data-testid="org-grant-results">
                    {matches.length === 0 && <HelperText>{t('orgSettings.grants.no_match')}</HelperText>}
                    {matches.map((x) => (
                      <Button key={x.id} size="small" variant="outlined" onClick={() => { setReads([...reads, x.id]); setQuery(''); }}>+ {label(x)}</Button>
                    ))}
                    {more > 0 && <HelperText>{t('orgSettings.grants.more', { count: more })}</HelperText>}
                  </Row>
                )}
                <HelperText>{t('orgSettings.grants.scope')}</HelperText>
                {error && <Alert $tone="error">{error}</Alert>}
                <Row>
                  <Button variant="contained" loading={setState.isLoading} onClick={() => void save(p.id, reads)} data-testid="org-grant-save">{t('orgSettings.grants.save')}</Button>
                  {granted.length > 0 && <Button variant="text" color="secondary" onClick={() => void save(p.id, [])}>{t('orgSettings.grants.revoke')}</Button>}
                </Row>
              </div>
            )}
          </div>
        );
      })}
    </Panel>
  );
}
