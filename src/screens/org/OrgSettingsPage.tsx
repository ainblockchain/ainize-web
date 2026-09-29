/**
 * `/org/:id/settings` — what the people who run an organization control, in five tabs:
 *
 *   General          name · description · README · admitting domains · linked AIN SSO organizations · delete
 *   Members          roles changed in the list · remove · add by principal · pending join requests · invite links
 *   Resource groups  "these agents are for these members"
 *   Billing          the organization's API keys · calls to its agents · the recorded spend cap
 *   Security & SSO   how sign-in applies here · who got in how · the audit log
 *
 * Admins see everything; write members see Resource groups (the node gates the rest). Each tab talks to the node
 * through `src/api/api.ts` and reads the answer through `src/api/organizations.ts`; nothing here decides anything
 * the node would not — the last-admin rule, the domain rule, the roles are the node's, and refusals are shown as
 * they come back.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  useAddOrgMemberMutation, useApproveOrgRequestMutation, useCreateOrgGroupMutation, useCreateOrgInviteMutation, useDeleteOrgGroupMutation, useDeleteOrgMutation,
  useOrgAuditQuery, useOrgBillingQuery, useOrgInvitesQuery, useOrgQuery, useOrgRequestsQuery, useOrgSecurityQuery, useRejectOrgRequestMutation, useRemoveOrgMemberMutation,
  useRevokeOrgInviteMutation, useSetOrgMemberRoleMutation, useUpdateOrgGroupMutation, useUpdateOrgMutation,
} from '@/api/api';
import {
  ORG_ROLES, emailDomain, orgApiErrorOf, parseOrgAudit, parseOrgBilling, parseOrgInvite, parseOrgInvites, parseOrgProfile, parseOrgRequests, parseOrgSecurity, roleAtLeast,
  type OrgGroupView, type OrgProfile, type OrgRole,
} from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select, SelectField, Textarea } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Tabs, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';

const Panel = styled.section`
  display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; background: #fff; margin-top: 16px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; font-weight: 700; }
`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 13px;
  th { text-align: left; color: ${(p) => p.theme.color.GREY}; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; }
  td { padding: 8px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; vertical-align: middle; word-break: break-all; }
`;
const Chip = styled.span<{ $tone?: 'warn' | 'ok' }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px;
  background: ${(p) => (p.$tone === 'warn' ? '#fdeeee' : p.$tone === 'ok' ? '#e8f6ec' : '#f1f2f5')}; color: ${(p) => (p.$tone === 'warn' ? '#a33030' : p.$tone === 'ok' ? '#227a3c' : '#555')};
`;
const Danger = styled(Panel)`border-color: #e8b4b4;`;

type Tab = 'general' | 'members' | 'groups' | 'billing' | 'security';
const TABS: Tab[] = ['general', 'members', 'groups', 'billing', 'security'];
const when = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleString() : '—');

export default function OrgSettingsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useT();
  const auth = useAuth();
  const [search, setSearch] = useSearchParams();
  const tab: Tab = TABS.includes(search.get('tab') as Tab) ? (search.get('tab') as Tab) : 'general';
  const { data, isLoading, error } = useOrgQuery(id, { skip: !auth.isSignedIn });
  const org = useMemo(() => parseOrgProfile(data), [data]);
  useTitle(org ? t('orgSettings.title', { name: org.name }) : t('org.settings'));

  if (auth.loading || isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (error || !org) {
    const e = error ? orgApiErrorOf(error) : null;
    return <PageWrapper><TitleRow><Title>{t('org.settings')}</Title></TitleRow><Empty>{e ? t(`org.api.${e.code}`) : t('org.not_found')} <StyledLink to="/org">{t('orgs.title')}</StyledLink></Empty></PageWrapper>;
  }
  const admin = roleAtLeast(org.my_role, 'admin');
  const write = roleAtLeast(org.my_role, 'write');
  if (!write) return <PageWrapper><TitleRow><Title>{org.name}</Title></TitleRow><Empty data-testid="org-settings-denied">{t('orgSettings.admin_only')} <StyledLink to={`/org/${encodeURIComponent(org.id)}`}>{org.name}</StyledLink></Empty></PageWrapper>;
  const visible = admin ? TABS : (['groups'] as Tab[]);
  const current: Tab = visible.includes(tab) ? tab : visible[0];

  return (
    <PageWrapper>
      <TitleRow><Title>{t('orgSettings.title', { name: org.name })}</Title></TitleRow>
      <Row><StyledLink to={`/org/${encodeURIComponent(org.id)}`}>← {org.name}</StyledLink></Row>
      <Tabs value={current} onChange={(v) => setSearch({ tab: v })} tabs={visible.map((k) => ({ id: k, label: t(`orgSettings.tab.${k}`) }))} />
      {current === 'general' && <GeneralTab org={org} />}
      {current === 'members' && <MembersTab org={org} />}
      {current === 'groups' && <GroupsTab org={org} />}
      {current === 'billing' && <BillingTab org={org} />}
      {current === 'security' && <SecurityTab org={org} />}
    </PageWrapper>
  );
}

function useApiError() {
  const { t } = useT();
  const [error, setError] = useState<string | null>(null);
  const capture = (err: unknown) => { const e = orgApiErrorOf(err); setError(e.message ? `${t(`org.api.${e.code}`)} — ${e.message}` : t(`org.api.${e.code}`)); };
  return { error, setError, capture };
}

// ------------------------------------------------------------------------------------------------ General

function GeneralTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { sso } = useAuth();
  const navigate = useNavigate();
  const [update, updateState] = useUpdateOrgMutation();
  const [remove] = useDeleteOrgMutation();
  const { error, setError, capture } = useApiError();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description);
  const [readme, setReadme] = useState(org.readme);
  const [domains, setDomains] = useState<string[]>(org.domains);
  const [domainRole, setDomainRole] = useState<OrgRole>(org.domain_role);
  const [ssoOrgIds, setSsoOrgIds] = useState(org.sso_org_ids.join(', '));
  const myDomain = emailDomain(sso?.email);
  useEffect(() => { setName(org.name); setDescription(org.description); setReadme(org.readme); setDomains(org.domains); setDomainRole(org.domain_role); setSsoOrgIds(org.sso_org_ids.join(', ')); }, [org]);

  const save = async () => {
    setError(null); setSaved(false);
    try {
      await update({ id: org.id, patch: { name: name.trim(), description: description.trim(), readme, domains, domainRole, ssoOrgIds: ssoOrgIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) } }).unwrap();
      setSaved(true);
    } catch (e) { capture(e); }
  };
  const destroy = async () => {
    if (!window.confirm(t('orgSettings.general.delete_confirm', { name: org.name }))) return;
    setError(null);
    try { await remove(org.id).unwrap(); navigate('/org'); } catch (e) { capture(e); }
  };

  return (
    <>
      <Panel data-testid="org-settings-general">
        <Field><FieldLabel htmlFor="org-name">{t('orgNew.field.name')}</FieldLabel><Input id="org-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
        <Field><FieldLabel htmlFor="org-description">{t('orgNew.field.description')}</FieldLabel><Input id="org-description" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field>
          <FieldLabel htmlFor="org-readme">{t('orgNew.field.readme')}</FieldLabel>
          <Textarea id="org-readme" value={readme} maxLength={20_000} style={{ minHeight: 200, fontFamily: 'ui-monospace, monospace' }} onChange={(e) => setReadme(e.target.value)} data-testid="org-readme-input" />
          <HelperText>{t('orgNew.field.readme_help')}</HelperText>
        </Field>
      </Panel>
      <Panel>
        <h3>{t('orgSettings.general.domains')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.general.domains_help')}</Description>
        <Row>
          {domains.map((d) => (
            <Chip key={d}>@{d} <Button size="small" variant="text" color="secondary" onClick={() => setDomains(domains.filter((x) => x !== d))}>{t('orgSettings.general.remove')}</Button></Chip>
          ))}
          {myDomain && !domains.includes(myDomain) && <Button size="small" onClick={() => setDomains([...domains, myDomain])} data-testid="org-add-domain">{t('orgSettings.general.add_domain', { domain: myDomain })}</Button>}
        </Row>
        <SelectField label={t('orgNew.field.domain_role')} value={domainRole} onChange={(e) => setDomainRole(e.target.value as OrgRole)}>
          {ORG_ROLES.map((r) => <option key={r} value={r}>{t(`org.role.${r}`)} — {t(`org.role.${r}_help`)}</option>)}
        </SelectField>
        <Field>
          <FieldLabel htmlFor="org-sso-orgs">{t('orgSettings.general.sso_orgs')}</FieldLabel>
          <Input id="org-sso-orgs" value={ssoOrgIds} placeholder="org_…" onChange={(e) => setSsoOrgIds(e.target.value)} />
          <HelperText>{t('orgSettings.general.sso_orgs_help')}</HelperText>
        </Field>
        {error && <Alert $tone="error">{error}</Alert>}
        {saved && <Alert $tone="success">{t('orgSettings.saved')}</Alert>}
        <Row><Button variant="contained" loading={updateState.isLoading} onClick={() => void save()} data-testid="org-settings-save">{t('orgSettings.save')}</Button></Row>
      </Panel>
      <Danger>
        <h3>{t('orgSettings.general.danger')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.general.delete_help')}</Description>
        <Row><Button color="secondary" onClick={() => void destroy()} data-testid="org-delete">{t('orgSettings.general.danger')}</Button></Row>
      </Danger>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ Members

function RoleSelect({ value, onChange, disabled, testId }: { value: OrgRole; onChange: (r: OrgRole) => void; disabled?: boolean; testId?: string }) {
  const { t } = useT();
  return (
    <Select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as OrgRole)} style={{ width: 'auto', padding: '4px 8px' }} data-testid={testId}>
      {ORG_ROLES.map((r) => <option key={r} value={r}>{t(`org.role.${r}`)}</option>)}
    </Select>
  );
}

function MembersTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { error, setError, capture } = useApiError();
  const [setRole] = useSetOrgMemberRoleMutation();
  const [removeMember] = useRemoveOrgMemberMutation();
  const [addMember, addState] = useAddOrgMemberMutation();
  const [approve] = useApproveOrgRequestMutation();
  const [reject] = useRejectOrgRequestMutation();
  const [makeInvite, inviteState] = useCreateOrgInviteMutation();
  const [revoke] = useRevokeOrgInviteMutation();
  const requests = parseOrgRequests(useOrgRequestsQuery(org.id).data);
  const invites = parseOrgInvites(useOrgInvitesQuery(org.id).data);
  const [q, setQ] = useState('');
  const [newPrincipal, setNewPrincipal] = useState('');
  const [newRole, setNewRole] = useState<OrgRole>('read');
  const [inviteRole, setInviteRole] = useState<OrgRole>('read');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDays, setInviteDays] = useState(7);
  const [freshInvite, setFreshInvite] = useState<string | null>(null);
  const [approveRole, setApproveRole] = useState<Record<string, OrgRole>>({});
  const needle = q.trim().toLowerCase();
  const members = org.members.filter((m) => !needle || [m.name, m.email, m.principal].some((s) => (s ?? '').toLowerCase().includes(needle)));

  const run = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); } catch (e) { capture(e); } };

  return (
    <>
      <Panel data-testid="org-settings-members">
        <Description style={{ margin: 0 }}>{t('orgSettings.members.lede')}</Description>
        <Input value={q} placeholder={t('orgSettings.members.search')} onChange={(e) => setQ(e.target.value)} data-testid="org-members-search" />
        <Table>
          <thead><tr><th>{t('org.tab.members')}</th><th>{t('orgSettings.invites.role')}</th><th /><th /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.principal} data-testid={`org-settings-member-${m.principal}`}>
                <td><div>{m.name ?? '—'}</div><div style={{ color: '#777' }}>{m.email ?? ''}</div><Mono style={{ fontSize: 12 }}>{m.principal}</Mono></td>
                <td><RoleSelect value={m.role} onChange={(role) => void run(() => setRole({ id: org.id, principal: m.principal, role }).unwrap())} testId={`org-role-${m.principal}`} /></td>
                <td><Chip>{t(`org.via.${m.via}`)}</Chip></td>
                <td><Button size="small" variant="text" color="secondary" onClick={() => { if (window.confirm(t('orgSettings.members.remove_confirm', { who: m.name ?? m.email ?? m.principal }))) void run(() => removeMember({ id: org.id, principal: m.principal }).unwrap()); }}>{t('orgSettings.members.remove')}</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Row>
          <Input value={newPrincipal} placeholder="0x… / sso:…" onChange={(e) => setNewPrincipal(e.target.value)} style={{ maxWidth: 360 }} data-testid="org-add-principal" />
          <RoleSelect value={newRole} onChange={setNewRole} />
          <Button size="small" loading={addState.isLoading} disabled={!newPrincipal.trim()} onClick={() => void run(async () => { await addMember({ id: org.id, principal: newPrincipal.trim(), role: newRole }).unwrap(); setNewPrincipal(''); })} data-testid="org-add-member">{t('orgSettings.members.add_cta')}</Button>
        </Row>
        <HelperText>{t('orgSettings.members.add')} — {t('orgSettings.members.add_help')}</HelperText>
        {error && <Alert $tone="error">{error}</Alert>}
      </Panel>

      <Panel data-testid="org-settings-requests">
        <h3>{t('orgSettings.requests.title')}</h3>
        {requests.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.requests.empty')}</Description>}
        {requests.map((r) => (
          <Row key={r.principal} data-testid={`org-request-${r.principal}`}>
            <span>{r.name ?? r.email ?? r.principal}{r.message && <em style={{ color: '#777' }}> — {r.message}</em>}</span>
            <RoleSelect value={approveRole[r.principal] ?? 'read'} onChange={(role) => setApproveRole((s) => ({ ...s, [r.principal]: role }))} />
            <Button size="small" variant="contained" onClick={() => void run(() => approve({ id: org.id, principal: r.principal, role: approveRole[r.principal] ?? 'read' }).unwrap())}>{t('orgSettings.requests.approve')}</Button>
            <Button size="small" variant="text" color="secondary" onClick={() => void run(() => reject({ id: org.id, principal: r.principal }).unwrap())}>{t('orgSettings.requests.reject')}</Button>
          </Row>
        ))}
      </Panel>

      <Panel data-testid="org-settings-invites">
        <h3>{t('orgSettings.invites.title')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.invites.lede')}</Description>
        <Row>
          <RoleSelect value={inviteRole} onChange={setInviteRole} testId="org-invite-role" />
          <Input value={inviteEmail} placeholder={t('orgSettings.invites.email')} inputMode="email" onChange={(e) => setInviteEmail(e.target.value)} style={{ maxWidth: 280 }} />
          <Select value={String(inviteDays)} onChange={(e) => setInviteDays(Number(e.target.value))} style={{ width: 'auto', padding: '4px 8px' }}>
            {[1, 7, 30].map((d) => <option key={d} value={d}>{t('orgSettings.invites.ttl_days', { n: d })}</option>)}
          </Select>
          <Button size="small" variant="contained" loading={inviteState.isLoading} data-testid="org-invite-make" onClick={() => void run(async () => {
            const made = parseOrgInvite(await makeInvite({ id: org.id, role: inviteRole, email: inviteEmail.trim() || null, ttlHours: inviteDays * 24 }).unwrap());
            setFreshInvite(made?.url ?? null);
          })}>{t('orgSettings.invites.make')}</Button>
        </Row>
        {freshInvite && (
          <Alert $tone="success" data-testid="org-invite-url">
            {t('orgSettings.invites.new')} <Mono>{freshInvite}</Mono> <CopyButton text={freshInvite} label={t('orgSettings.invites.copy')} />
          </Alert>
        )}
        <SubTitle $mt={4} style={{ fontSize: 14 }}>{t('orgSettings.invites.open')}</SubTitle>
        {invites.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.invites.empty')}</Description>}
        {invites.map((i) => (
          <Row key={i.token_prefix}>
            <Mono>{i.token_prefix}…</Mono><Chip>{t(`org.role.${i.role}`)}</Chip>{i.email && <span>{i.email}</span>}
            <span style={{ color: '#777', fontSize: 12 }}>{i.used_by ? t('orgSettings.invites.used') : t('orgSettings.invites.expires', { date: when(i.expires_at) })}</span>
            {!i.used_by && <Button size="small" variant="text" color="secondary" onClick={() => void run(() => revoke({ id: org.id, token: i.token_prefix }).unwrap())}>{t('orgSettings.invites.revoke')}</Button>}
          </Row>
        ))}
      </Panel>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ Resource groups

function GroupsTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { error, setError, capture } = useApiError();
  const [createGroup, createState] = useCreateOrgGroupMutation();
  const [updateGroup, updateState] = useUpdateOrgGroupMutation();
  const [deleteGroup] = useDeleteOrgGroupMutation();
  const [editing, setEditing] = useState<OrgGroupView | null>(null);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const start = (g: OrgGroupView | null) => { setEditing(g); setName(g?.name ?? ''); setMembers(g?.members ?? []); setAgents(g?.agents ?? []); };
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const save = async () => {
    setError(null);
    try {
      if (editing) await updateGroup({ id: org.id, groupId: editing.id, name: name.trim(), members, agents }).unwrap();
      else await createGroup({ id: org.id, name: name.trim(), members, agents }).unwrap();
      start(null);
    } catch (e) { capture(e); }
  };

  return (
    <>
      <Panel data-testid="org-settings-groups">
        <Description style={{ margin: 0 }}>{t('orgSettings.groups.lede')}</Description>
        {org.groups.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.groups.empty')}</Description>}
        {org.groups.map((g) => (
          <Row key={g.id} data-testid={`org-group-${g.id}`}>
            <strong>{g.name}</strong>
            <Chip>{t('orgSettings.groups.members')} {g.members.length}</Chip>
            <Chip>{t('orgSettings.groups.agents')} {g.agents.length}</Chip>
            <Button size="small" variant="text" onClick={() => start(g)}>{t('orgSettings.groups.edit')}</Button>
            <Button size="small" variant="text" color="secondary" onClick={() => void (async () => { setError(null); try { await deleteGroup({ id: org.id, groupId: g.id }).unwrap(); } catch (e) { capture(e); } })()}>{t('orgSettings.groups.delete')}</Button>
          </Row>
        ))}
        <Row><Button size="small" onClick={() => start(null)} data-testid="org-group-new">{t('orgSettings.groups.new')}</Button></Row>
      </Panel>
      {(editing !== null || name !== '' || members.length > 0 || agents.length > 0) && (
        <Panel data-testid="org-group-form">
          <h3>{editing ? editing.name : t('orgSettings.groups.new')}</h3>
          <Field><FieldLabel htmlFor="org-group-name">{t('orgSettings.groups.name')}</FieldLabel><Input id="org-group-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} data-testid="org-group-name" /></Field>
          <div>
            <FieldLabel>{t('orgSettings.groups.members')}</FieldLabel>
            <Row>{org.members.map((m) => <Checkbox key={m.principal} label={m.name ?? m.email ?? m.principal} checked={members.includes(m.principal)} onChange={() => toggle(members, setMembers, m.principal)} />)}</Row>
          </div>
          <div>
            <FieldLabel>{t('orgSettings.groups.agents')}</FieldLabel>
            <Row>{org.agents.map((a) => <Checkbox key={a.id} label={`${a.name}${a.visibility === 'private' ? ' 🔒' : ''}`} checked={agents.includes(a.id)} onChange={() => toggle(agents, setAgents, a.id)} />)}</Row>
            <HelperText>{t('orgSettings.groups.agents_hint')}</HelperText>
          </div>
          {error && <Alert $tone="error">{error}</Alert>}
          <Row>
            <Button variant="contained" loading={createState.isLoading || updateState.isLoading} disabled={!name.trim()} onClick={() => void save()} data-testid="org-group-save">{t('orgSettings.groups.save')}</Button>
            <Button variant="text" onClick={() => start(null)}>{t('orgSettings.general.remove')}</Button>
          </Row>
        </Panel>
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ Billing

function BillingTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { data, isLoading } = useOrgBillingQuery(org.id, { pollingInterval: 30_000 });
  const billing = useMemo(() => parseOrgBilling(data), [data]);
  const [update, updateState] = useUpdateOrgMutation();
  const { error, setError, capture } = useApiError();
  const [cap, setCap] = useState(org.spend_cap_credits === null ? '' : String(org.spend_cap_credits));
  useEffect(() => { setCap(org.spend_cap_credits === null ? '' : String(org.spend_cap_credits)); }, [org.spend_cap_credits]);
  const saveCap = async () => {
    setError(null);
    try { await update({ id: org.id, patch: { spendCapCredits: cap.trim() === '' ? null : Math.max(0, Math.floor(Number(cap))) } }).unwrap(); } catch (e) { capture(e); }
  };
  if (isLoading || !billing) return <CenterProgress />;
  const max = Math.max(1, ...billing.agents.map((a) => a.total));
  return (
    <>
      <Panel data-testid="org-settings-billing">
        <Description style={{ margin: 0 }}>{t('orgSettings.billing.lede')}</Description>
        {!billing.spend_metered && <Alert $tone="info" data-testid="org-billing-not-metered">{t('orgSettings.billing.not_metered')}</Alert>}
        <Field>
          <FieldLabel htmlFor="org-cap">{t('orgSettings.billing.cap')}</FieldLabel>
          <Row><Input id="org-cap" value={cap} inputMode="numeric" onChange={(e) => setCap(e.target.value)} style={{ maxWidth: 200 }} data-testid="org-cap" /><Button size="small" loading={updateState.isLoading} onClick={() => void saveCap()}>{t('orgSettings.save')}</Button></Row>
          <HelperText>{t('orgSettings.billing.cap_help')}</HelperText>
        </Field>
        {error && <Alert $tone="error">{error}</Alert>}
      </Panel>
      <Panel>
        <h3>{t('orgSettings.billing.keys')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.billing.keys_help', { orgs: billing.sso_org_ids.join(', ') || t('orgSettings.security.none') })}</Description>
        {billing.keys.length === 0 ? <Description style={{ margin: 0 }}>{t('orgSettings.billing.keys_empty')}</Description> : (
          <Table>
            <thead><tr><th>{t('orgSettings.billing.key_owner')}</th><th>{t('orgSettings.billing.key_label')}</th><th>{t('orgSettings.billing.key_issued')}</th><th /></tr></thead>
            <tbody>{billing.keys.map((k) => (
              <tr key={`${k.owner}:${k.prefix}`}><td><Mono>{k.owner}</Mono></td><td>{k.label ?? <Mono>{k.prefix}…</Mono>}</td><td>{when(k.issuedAt)}</td><td>{k.disabled && <Chip $tone="warn">{t('orgSettings.billing.key_disabled')}</Chip>}</td></tr>
            ))}</tbody>
          </Table>
        )}
      </Panel>
      <Panel>
        <h3>{t('orgSettings.billing.agents')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.billing.agents_total', { n: billing.agent_calls_total })}</Description>
        <Table>
          <thead><tr><th>{t('org.tab.agents')}</th><th>{t('orgSettings.billing.agents')}</th><th>{t('orgSettings.billing.last_call')}</th></tr></thead>
          <tbody>{billing.agents.map((a) => (
            <tr key={a.id} data-testid={`org-billing-agent-${a.id}`}>
              <td>{a.name}{a.visibility === 'private' && ' 🔒'}</td>
              <td><Bar pct={(a.total / max) * 100} label={String(a.total)} /></td>
              <td>{a.last_at ? when(a.last_at) : t('orgSettings.billing.never')}</td>
            </tr>
          ))}</tbody>
        </Table>
      </Panel>
    </>
  );
}

const BarTrack = styled.div`display: flex; align-items: center; gap: 8px; min-width: 160px;`;
const BarFill = styled.div<{ $pct: number }>`height: 8px; border-radius: 4px; background: #8b3eeb; width: ${(p) => Math.max(2, p.$pct)}%; max-width: 100%; flex: 0 0 auto;`;
function Bar({ pct, label }: { pct: number; label: ReactNode }) {
  return <BarTrack><div style={{ flex: 1 }}><BarFill $pct={pct} /></div><span style={{ fontSize: 12 }}>{label}</span></BarTrack>;
}

// ------------------------------------------------------------------------------------------------ Security & SSO

function SecurityTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { data, isLoading } = useOrgSecurityQuery(org.id);
  const security = useMemo(() => parseOrgSecurity(data), [data]);
  const [limit, setLimit] = useState(50);
  const audit = parseOrgAudit(useOrgAuditQuery({ id: org.id, limit }).data);
  if (isLoading || !security) return <CenterProgress />;
  return (
    <>
      <Panel data-testid="org-settings-security">
        <Description style={{ margin: 0 }}>{t('orgSettings.security.lede')}</Description>
        <KeyValue>
          <dt>{t('orgSettings.security.sso')}</dt>
          <dd>{security.sso.configured ? t('orgSettings.security.sso_on', { issuer: security.sso.issuer ?? '' }) : t('orgSettings.security.sso_off')}<br />{t('orgSettings.security.sso_orgs', { ids: security.sso.org_ids.join(', ') || t('orgSettings.security.none') })}</dd>
          <dt>{t('orgSettings.security.domains')}</dt>
          <dd>{security.domains.length ? security.domains.map((d) => `@${d}`).join(', ') : t('orgSettings.security.none')} → {t(`org.role.${security.domain_role}`)}</dd>
          <dt>{t('orgSettings.security.members_by_via')}</dt>
          <dd>{Object.entries(security.members_by_via).map(([via, n]) => <Chip key={via} style={{ marginRight: 6 }}>{t(`org.via.${via}`)} {n}</Chip>)}</dd>
          <dt>{t('orgSettings.security.admins')}</dt>
          <dd>{security.admins.map((a) => <Mono key={a} style={{ marginRight: 8 }}>{a}</Mono>)}</dd>
          <dt>{t('org.tab.agents')}</dt>
          <dd>{t('orgSettings.security.private_agents', { n: security.private_agents })}</dd>
        </KeyValue>
      </Panel>
      <Panel data-testid="org-settings-audit">
        <h3>{t('orgSettings.security.audit')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.security.audit_lede')}</Description>
        {audit.length === 0 ? <Description style={{ margin: 0 }}>{t('orgSettings.security.audit_empty')}</Description> : (
          <Table>
            <thead><tr><th>{t('orgSettings.security.when')}</th><th>{t('orgSettings.security.actor')}</th><th>{t('orgSettings.security.action')}</th><th>{t('orgSettings.security.target')}</th></tr></thead>
            <tbody>{audit.map((e) => (
              <tr key={e.seq}><td>{when(e.ts)}</td><td><Mono>{e.actor}</Mono></td><td>{e.action}{e.detail && <span style={{ color: '#777' }}> {JSON.stringify(e.detail)}</span>}</td><td>{e.target ? <Mono>{e.target}</Mono> : '—'}</td></tr>
            ))}</tbody>
          </Table>
        )}
        {audit.length >= limit && <Row><Button size="small" variant="text" onClick={() => setLimit(Math.min(1000, limit * 2))}>{t('orgSettings.security.audit_more')}</Button></Row>}
      </Panel>
    </>
  );
}
