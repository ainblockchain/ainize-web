import { useState } from 'react';
import styled from 'styled-components';
import { useRenameAppDomainMutation, useProjectDomainsQuery, useAddProjectDomainMutation, useCheckProjectDomainMutation, useRemoveProjectDomainMutation } from '@/api/api';
import { projectApiErrorOf } from '@/api/projects';
import { Button } from '@/components/ui/Button';
import { Alert, Input } from '@/components/ui/Form';
import { CopyButton, ExternalLink } from '@/components/ui/Misc';
import { useT } from '@/i18n';
const Card = styled.section`border:1px solid #ddd;border-radius:10px;padding:20px;margin:20px 0;min-width:0;`;
const Row = styled.div`display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0;input{flex:1;min-width:160px;}@media(max-width:640px){input{font-size:16px;}button{min-height:44px;}}`;
const Domain = styled.article`border-top:1px solid #eee;padding:16px 0;overflow-wrap:anywhere;h3{margin:0;}p{font-size:13px;color:#666;}details{margin:12px 0;}summary{cursor:pointer;}`;
const Records = styled.div`overflow:auto;table{width:100%;border-collapse:collapse;font-size:13px;}th,td{text-align:left;padding:8px;border-bottom:1px solid #eee;}code{overflow-wrap:anywhere;}@media(max-width:640px){table,tbody,tr,td{display:block;}thead{display:none;}td{padding:4px 0;border:0;}tr{padding:10px 0;border-bottom:1px solid #eee;}}`;
export default function ProjectDomains({ projectId }: { projectId: string }) {
  const { t } = useT();
  const query = useProjectDomainsQuery(projectId, { pollingInterval: 10000 });
  const [rename, renaming] = useRenameAppDomainMutation();
  const [label, setLabel] = useState('');
  const [add, adding] = useAddProjectDomainMutation();
  const [check, checking] = useCheckProjectDomainMutation();
  const [remove, removing] = useRemoveProjectDomainMutation();
  const [hostname, setHostname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const operation = async (action: () => Promise<unknown>) => { setError(null); try { await action(); } catch (e) { setError(projectApiErrorOf(e).message ?? t('domains.failed')); } };
  return <Card aria-label={t('domains.title')}>
    <h2>{t('domains.title')}</h2><p>{t('domains.help')}</p>
    <form onSubmit={e => { e.preventDefault(); void operation(async () => { await add({ id: projectId, hostname }).unwrap(); setHostname(''); }); }}>
      <Row><Input aria-label={t('domains.hostname')} placeholder="app.example.com" value={hostname} onChange={e => setHostname(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false}/><Button type="submit" disabled={!hostname.trim() || adding.isLoading || !query.data}>{t('domains.add')}</Button></Row>
    </form>
    {query.error && <Alert $tone="error">{projectApiErrorOf(query.error).message ?? t('domains.failed')}</Alert>}
    {error && <Alert $tone="error">{error}</Alert>}
    {query.data?.domains.length === 0 && <p>{t('domains.empty')}</p>}
    {query.data?.domains.map(domain => <Domain key={domain.hostname}>
      <Row><h3>{domain.hostname}</h3><strong>{t(`domains.status.${domain.status}`)}</strong>{domain.managed && <span>{t('domains.default')}</span>}</Row>
      {domain.status === 'ready' ? <ExternalLink href={`https://${domain.hostname}`} target="_blank" rel="noreferrer">{t('domains.visit')} ↗</ExternalLink> : <p>{t(`domains.hint.${domain.status}`)}</p>}
      {domain.managed && <><p>{t('domains.automatic')}</p><form onSubmit={e => { e.preventDefault(); void operation(async () => { await rename({ id: projectId, label }).unwrap(); setLabel(''); }); }}><Row><Input aria-label={t('domains.app_address')} placeholder={domain.hostname.split('.')[0]} value={label} onChange={e => setLabel(e.target.value)} autoCapitalize="none" spellCheck={false}/><span>.{query.data?.managedBase}</span><Button type="submit" disabled={!label || renaming.isLoading}>{t('domains.change')}</Button></Row></form></>}
      {!domain.managed && <details open={domain.status !== 'ready'}><summary>{t('domains.records')}</summary>
        <p>{t('domains.records_help')}</p>
        <Records><table><thead><tr><th>{t('domains.type')}</th><th>{t('domains.name')}</th><th>{t('domains.value')}</th></tr></thead><tbody>
          <tr><td>TXT</td><td><code>_ainize.{domain.hostname}</code> <CopyButton text={`_ainize.${domain.hostname}`} /></td><td><code>{domain.token}</code> <CopyButton text={domain.token}/></td></tr>
          {(query.data?.addresses ?? []).map(ip => <tr key={ip}><td>{ip.includes(':') ? 'AAAA' : 'A'}</td><td><code>{domain.hostname}</code></td><td><code>{ip}</code> <CopyButton text={ip}/></td></tr>)}
        </tbody></table></Records>
        <p>{t('domains.cname_help')} <code>{query.data?.cname}</code> <CopyButton text={query.data?.cname ?? ''}/></p>
      </details>}
      <Row><Button size="small" disabled={checking.isLoading} onClick={() => void operation(() => check({ id: projectId, hostname: domain.hostname }).unwrap())}>{t('domains.check')}</Button>{!domain.managed && <Button size="small" color="secondary" disabled={removing.isLoading} onClick={() => { if (window.confirm(t('domains.remove_confirm', { hostname: domain.hostname }))) void operation(() => remove({ id: projectId, hostname: domain.hostname }).unwrap()); }}>{t('domains.remove')}</Button>}</Row>
    </Domain>)}
  </Card>;
}
