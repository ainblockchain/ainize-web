import { useAuth } from '@/auth/AuthContext';
import { useState } from 'react';
import styled from 'styled-components';
import { useRenameAppDomainMutation, useProjectDomainsQuery, useAddProjectDomainMutation, useCheckProjectDomainMutation, useRemoveProjectDomainMutation } from '@/api/api';
import { projectApiErrorOf } from '@/api/projects';
import { appDomainHostname, appDomainLabel, createDomainOperation, DomainOperationError, readAppDomains, type DomainAction } from '@/lib/projectDomains';
import { useActiveView } from '@/hooks/useActiveView';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { CenterProgress, CopyButton, ExternalLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
const Card = styled.section`border:1px solid #ddd;border-radius:10px;padding:20px;margin:20px 0;min-width:0;`;
const Row = styled.div`display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0;input{flex:1 1 180px;min-width:0;max-width:100%;}@media(max-width:640px){input{font-size:16px;}button{min-height:44px;}}`;
const Domain = styled.article`border-top:1px solid #eee;padding:16px 0;overflow-wrap:anywhere;h3{margin:0;}p{font-size:13px;color:#666;}details{margin:12px 0;}summary{cursor:pointer;}`;
const Records = styled.div`overflow:auto;table{width:100%;border-collapse:collapse;font-size:13px;}th,td{text-align:left;padding:8px;border-bottom:1px solid #eee;}code{overflow-wrap:anywhere;}@media(max-width:640px){table,tbody,tr,td{display:block;}thead{display:none;}td{padding:4px 0;border:0;}td::before{content:attr(data-label);display:block;font-weight:600;}tr{padding:10px 0;border-bottom:1px solid #eee;}}`;
export default function ProjectDomains({ projectId }: { projectId: string }) {
  const { cacheIdentity } = useAuth();
  return <ProjectDomainsContent key={`${cacheIdentity}:${projectId}`} projectId={projectId} />;
}

function ProjectDomainsContent({ projectId }: { projectId: string }) {
  const { t } = useT();
  const { cacheIdentity, isSignedIn } = useAuth();
  const active = useActiveView();
  const query = useProjectDomainsQuery({ id: projectId, identity: cacheIdentity }, { skip: !isSignedIn, pollingInterval: 10000 });
  const [rename] = useRenameAppDomainMutation();
  const [add] = useAddProjectDomainMutation();
  const [check] = useCheckProjectDomainMutation();
  const [remove] = useRemoveProjectDomainMutation();
  const [label, setLabel] = useState('');
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; hostname: string; token: string | null } | null>(null);
  const [controller] = useState(createDomainOperation);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const data = query.error ? null : readAppDomains(query.currentData, projectId);
  const ready = data !== null;
  const normalizedHost = appDomainHostname(hostname), normalizedLabel = appDomainLabel(label);
  const existing = !!normalizedHost && !!data?.domains.some(d => d.hostname === normalizedHost);
  const routing = !!data && (data.addresses.length > 0 || !!data.cname);
  const operation = async (action: DomainAction, send: () => Promise<unknown>, clear?: () => void) => {
    if (!ready || controller.blocked()) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await controller.run(projectId, action, { read: () => query.refetch().unwrap(), send, active });
      if (!active() || !result) return;
      clear?.();
      setNotice({ text: t(result === 'removed' ? 'domains.removed' : 'domains.confirmed', { hostname: action.hostname }), hostname: action.hostname, token: result === 'removed' ? null : result.token });
    } catch (e) {
      if (!active()) return;
      setError(controller.uncertain() ? t('domains.unconfirmed') : e instanceof DomainOperationError ? t('domains.changed') : projectApiErrorOf(e).message ?? t('domains.failed'));
    } finally { if (active()) { setBusy(false); setUncertain(controller.uncertain()); } }
  };
  if (!isSignedIn) return <Card aria-label={t('domains.title')}><h2>{t('domains.title')}</h2><p>{t('domains.signin')}</p></Card>;
  return <Card aria-label={t('domains.title')}>
    <h2>{t('domains.title')}</h2><p>{t('domains.help')}</p>
    <form onSubmit={e => { e.preventDefault(); if (normalizedHost && !existing && routing) void operation({ kind: 'add', hostname: normalizedHost }, () => add({ id: projectId, hostname: normalizedHost }).unwrap(), () => setHostname('')); }}>
      <Row><Input aria-label={t('domains.hostname')} placeholder="app.example.com" value={hostname} disabled={busy || uncertain || !ready} onChange={e => setHostname(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false}/><Button type="submit" disabled={!normalizedHost || existing || !routing || busy || uncertain || !ready}>{t('domains.add')}</Button></Row>
      {hostname.trim() && !normalizedHost && <p role="alert">{t('domains.invalid_hostname')}</p>}
      {existing && <p role="status">{t('domains.already_added')}</p>}
      {normalizedHost && normalizedHost !== hostname.trim() && <p>{t('domains.target', { hostname: normalizedHost })}</p>}
    </form>
    {!data && query.isFetching && <CenterProgress />}
    {(query.error || (!query.isFetching && !ready)) && <Alert role="alert" $tone="error">{t('domains.load_failed')} <Button loading={query.isFetching} onClick={() => void query.refetch()}>{t('projects.page.retry')}</Button></Alert>}
    {error && <Alert role="alert" $tone="error">{error} <Button loading={query.isFetching} onClick={() => void query.refetch()}>{t('projects.page.retry')}</Button></Alert>}
    {notice && data && (notice.token ? data.domains.some(d => d.hostname === notice.hostname && d.token === notice.token) : !data.domains.some(d => d.hostname === notice.hostname)) && <Alert role="status" $tone="info">{notice.text}</Alert>}
    {data && !routing && <Alert $tone="warning">{t('domains.routing_unavailable')}</Alert>}
    {data && data.domains.length === 0 && <p>{t('domains.empty')}</p>}
    {data && data.domains.map(domain => {
      const nextHostname = normalizedLabel && data.managedBase ? `${normalizedLabel}.${data.managedBase}` : null;
      const conflict = !!nextHostname && data.domains.some(d => d.hostname === nextHostname);
      return <Domain key={domain.hostname}>
        <Row><h3>{domain.hostname}</h3><strong>{t(`domains.status.${domain.status}`)}</strong>{domain.managed && <span>{t('domains.default')}</span>}</Row>
        {domain.status === 'ready' ? <ExternalLink href={`https://${domain.hostname}`} target="_blank" rel="noreferrer">{t('domains.visit')} ↗</ExternalLink>
          : <p>{t(domain.managed && domain.status === 'verified' ? 'domains.managed_provisioning' : domain.managed && domain.status === 'invalid' ? 'domains.managed_invalid' : `domains.hint.${domain.status}`)}</p>}
        {(domain.status === 'invalid' || domain.status === 'error') && domain.message && <p>{domain.message}</p>}
        {domain.managed && <><p>{t('domains.automatic')}</p><form onSubmit={e => {
          e.preventDefault();
          if (!nextHostname || conflict || !data.managedBase || controller.blocked()) return;
          if (!window.confirm(t('domains.rename_confirm', { previous: domain.hostname, hostname: nextHostname }))) return;
          void operation({ kind: 'rename', hostname: nextHostname, previous: domain, base: data.managedBase }, () => rename({ id: projectId, label: normalizedLabel! }).unwrap(), () => setLabel(''));
        }}><Row><Input aria-label={t('domains.app_address')} placeholder={domain.hostname.split('.')[0]} value={label} disabled={busy || uncertain} onChange={e => setLabel(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false}/><span>.{data.managedBase}</span><Button type="submit" disabled={!nextHostname || conflict || busy || uncertain}>{t('domains.change')}</Button></Row>
          {label.trim() && !normalizedLabel && <p role="alert">{t('domains.invalid_label')}</p>}
          {nextHostname && <p>{t('domains.target', { hostname: nextHostname })}</p>}
        </form></>}
        {!domain.managed && <details open={domain.status !== 'ready'}><summary>{t('domains.records')}</summary>
          <p>{t('domains.records_help')}</p>
          <Records><table><thead><tr><th>{t('domains.type')}</th><th>{t('domains.name')}</th><th>{t('domains.value')}</th></tr></thead><tbody>
            <tr><td data-label={t('domains.type')}>TXT</td><td data-label={t('domains.name')}><code>_ainize.{domain.hostname}</code> <CopyButton text={`_ainize.${domain.hostname}`} /></td><td data-label={t('domains.value')}><code>{domain.token}</code> <CopyButton text={domain.token}/></td></tr>
            {data.addresses.map(ip => <tr key={ip}><td data-label={t('domains.type')}>{ip.includes(':') ? 'AAAA' : 'A'}</td><td data-label={t('domains.name')}><code>{domain.hostname}</code></td><td data-label={t('domains.value')}><code>{ip}</code> <CopyButton text={ip}/></td></tr>)}
          </tbody></table></Records>
          {data.cname && <p>{t('domains.cname_help')} <code>{data.cname}</code> <CopyButton text={data.cname}/></p>}
        </details>}
        <Row><Button size="small" disabled={busy || uncertain} onClick={() => void operation({ kind: 'check', hostname: domain.hostname, previous: domain }, () => check({ id: projectId, hostname: domain.hostname }).unwrap())}>{t('domains.check')}</Button>
          {!domain.managed && <Button size="small" color="secondary" disabled={busy || uncertain} onClick={() => { if (!controller.blocked() && window.confirm(t('domains.remove_confirm', { hostname: domain.hostname }))) void operation({ kind: 'remove', hostname: domain.hostname, previous: domain }, () => remove({ id: projectId, hostname: domain.hostname }).unwrap()); }}>{t('domains.remove')}</Button>}
        </Row>
      </Domain>;
    })}
  </Card>;
}
