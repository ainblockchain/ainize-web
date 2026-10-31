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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router';
import styled from 'styled-components';
import {
  useAddOrgMemberMutation, useApproveOrgRequestMutation, useCreateOrgGroupMutation, useCreateOrgInviteMutation, useDeleteOrgGroupMutation, useDeleteOrgMutation,
  useOrgAuditQuery, useOrgBillingQuery, useOrgInvitesQuery, useOrgQuery, useOrgRequestsQuery, useOrgSecurityQuery, useRejectOrgRequestMutation, useRemoveOrgMemberMutation,
  useRevokeOrgInviteMutation, useSetOrgMemberRoleMutation, useUpdateOrgGroupMutation, useUpdateOrgMutation, useOrgGroupsQuery,
} from '@/api/api';
import {
  ORG_ROLES, emailDomain, orgApiErrorOf, orgSpendCap, parseOrgAudit, parseOrgBilling, parseOrgInvites, parseOrgProfile, parseOrgRequests, parseOrgSecurity, roleAtLeast,
  type OrgGroupView, type OrgProfile, type OrgRole, type OrgInviteView,
} from '@/api/organizations';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert, Checkbox, Field, FieldLabel, HelperText, Input, Select, SelectField, Textarea } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, KeyValue, Mono, PageWrapper, StyledLink, SubTitle, Tabs, Title, TitleRow } from '@/components/ui/Misc';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { OrgReadStatus } from './OrgReadStatus';
import { useActiveView } from '@/hooks/useActiveView';
import { orgGroups, sameOrgGroup, missingGroupSelections, saveSelectedOrgGroup, confirmGroupDeletion, OrgGroupError } from '@/lib/orgGroups';
import { createdOrgInvite, listedOrgInvite, confirmedInviteRevocation, openOrgInvite } from '@/lib/orgInvites';

const Panel = styled.section`
  display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; background: #fff; margin-top: 16px;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h3 { margin: 0; font-size: 15px; font-weight: 700; }
`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 13px;
  th { text-align: left; color: ${(p) => p.theme.color.GREY}; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; }
  td { padding: 8px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; vertical-align: middle; overflow-wrap: anywhere; }
  @media (max-width: 640px) {
    display: block;
    thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    tbody { display: grid; gap: 12px; }
    tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; padding: 12px 0; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; }
    td { display: flex; flex-direction: column; gap: 4px; padding: 0; min-width: 0; border: 0; align-items: flex-start; }
    td:first-child { grid-column: 1 / -1; }
    td[data-label]::before { content: attr(data-label); font-size: 11px; font-weight: 600; color: ${(p) => p.theme.color.GREY}; }
    td > * { max-width: 100%; min-width: 0; box-sizing: border-box; }
  }
`;
const Chip = styled.span<{ $tone?: 'warn' | 'ok' }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px;
  background: ${(p) => (p.$tone === 'warn' ? '#fdeeee' : p.$tone === 'ok' ? '#e8f6ec' : '#f1f2f5')}; color: ${(p) => (p.$tone === 'warn' ? '#a33030' : p.$tone === 'ok' ? '#227a3c' : '#555')};
`;
const Danger = styled(Panel)`border-color: #e8b4b4;`;
const Controls = styled.fieldset`border: 0; padding: 0; margin: 0; min-width: 0;`;

type Tab = 'general' | 'members' | 'groups' | 'billing' | 'security';
const TABS: Tab[] = ['general', 'members', 'groups', 'billing', 'security'];
const when = (ts: number | null | undefined) => (ts ? new Date(ts).toLocaleString() : '—');
const completeList = (raw: unknown, field: string, parsed: unknown[]) => {
  const rows = (raw as Record<string, unknown> | null | undefined)?.[field];
  return Array.isArray(rows) && rows.length === parsed.length;
};

export default function OrgSettingsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const auth = useAuth();
  return <OrgSettingsContent key={`${auth.cacheIdentity}:${id}`} />;
}

function OrgSettingsContent() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useT();
  const auth = useAuth();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const requestedTab = search.get('tab');
  const tab: Tab = TABS.includes(search.get('tab') as Tab) ? (search.get('tab') as Tab) : 'general';
  const query = useOrgQuery({ id, identity: auth.cacheIdentity }, { skip: !auth.isSignedIn || auth.loading });
  const { currentData: data, isFetching, error } = query;
  const org = useMemo(() => parseOrgProfile(data, id), [data, id]);
  useTitle(org ? t('orgSettings.title', { name: org.name }) : t('org.settings'));

  if (auth.loading || (!data && isFetching)) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (!auth.isSignedIn) return <PageWrapper><Empty>{t('orgs.signin')} <StyledLink to={`/signing?next=${encodeURIComponent(location.pathname + location.search + location.hash)}`}>{t('orgs.signin.cta')}</StyledLink></Empty></PageWrapper>;
  if (error || !org) {
    const e = error ? orgApiErrorOf(error) : null;
    return <PageWrapper><TitleRow><Title>{t('org.settings')}</Title></TitleRow><Empty>{e?.status === 404 ? t('org.not_found') : <OrgReadStatus query={query} valid={!!org} />} <StyledLink to="/org">{t('orgs.title')}</StyledLink></Empty></PageWrapper>;
  }
  const admin = roleAtLeast(org.my_role, 'admin');
  const write = roleAtLeast(org.my_role, 'write');
  if (!write) return <PageWrapper><TitleRow><Title>{org.name}</Title></TitleRow><Empty data-testid="org-settings-denied">{t('orgSettings.admin_only')} <StyledLink to={`/org/${encodeURIComponent(org.id)}`}>{org.name}</StyledLink></Empty></PageWrapper>;
  const visible = admin ? TABS : (['groups'] as Tab[]);
  if (requestedTab !== null && !visible.includes(requestedTab as Tab)) return (
    <PageWrapper>
      <TitleRow><Title>{t('orgSettings.title', { name: org.name })}</Title></TitleRow>
      <Row><StyledLink to={`/org/${encodeURIComponent(org.id)}`}>← {org.name}</StyledLink></Row>
      <Tabs value={requestedTab} onChange={(v) => setSearch({ tab: v })} tabs={visible.map((k) => ({ id: k, label: t(`orgSettings.tab.${k}`) }))} />
      <Empty data-testid="org-settings-tab-denied">{t(TABS.includes(requestedTab as Tab) ? 'orgSettings.admin_only' : 'orgSettings.unknown_tab')}</Empty>
    </PageWrapper>
  );
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

function useOrgAction() {
  const { t } = useT();
  const auth = useAuth();
  const active = useActiveView();
  const isCurrent = () => active() && auth.isCurrentAccount();
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const reset = () => { setError(null); setSuccess(false); };
  const run = async <T,>(fn: () => Promise<T>, done?: (result: T) => void) => {
    if (running.current || !isCurrent()) return;
    running.current = true;
    reset(); setPending(true);
    try {
      const result = await fn();
      if (isCurrent()) { done?.(result); setSuccess(true); }
    } catch (err) {
      if (isCurrent()) { const e = orgApiErrorOf(err); setError(err instanceof OrgGroupError ? t(`orgSettings.groups.${err.code}`) : err instanceof Error ? err.message : e.message ? `${t(`org.api.${e.code}`)} — ${e.message}` : t(`org.api.${e.code}`)); }
    } finally {
      running.current = false;
      if (isCurrent()) setPending(false);
    }
  };
  const feedback = pending ? <div role="status">{t('orgSettings.working')}</div>
    : error ? <Alert role="alert" $tone="error">{error}</Alert>
      : success ? <Alert role="status" $tone="success">{t('orgSettings.applied')}</Alert> : null;
  return { pending, run, feedback, reset, setError, isCurrent };
}

// ------------------------------------------------------------------------------------------------ General

function GeneralTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { sso } = useAuth();
  const navigate = useNavigate();
  const [update, updateState] = useUpdateOrgMutation();
  const [remove, removeState] = useDeleteOrgMutation();
  const action = useOrgAction();
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description);
  const [readme, setReadme] = useState(org.readme);
  const [domains, setDomains] = useState<string[]>(org.domains);
  const [domainRole, setDomainRole] = useState<OrgRole>(org.domain_role);
  const [ssoOrgIds, setSsoOrgIds] = useState(org.sso_org_ids.join(', '));
  const myDomain = emailDomain(sso?.email);
  // Resource/account changes remount this view. Background refetches must not overwrite unsaved inputs.

  const save = () => action.run(() => update({ id: org.id, patch: { name: name.trim(), description: description.trim(), readme, domains, domainRole, ssoOrgIds: ssoOrgIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) } }).unwrap());
  const destroy = async () => {
    if (action.pending) return;
    if (!window.confirm(t('orgSettings.general.delete_confirm', { name: org.name }))) return;
    await action.run(() => remove(org.id).unwrap(), () => navigate('/org'));
  };

  return (
    <Controls disabled={action.pending} onChange={action.reset}>
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
            <Chip key={d}>@{d} <Button size="small" variant="text" color="secondary" onClick={() => { action.reset(); setDomains(domains.filter((x) => x !== d)); }}>{t('orgSettings.general.remove')}</Button></Chip>
          ))}
          {myDomain && !domains.includes(myDomain) && <Button size="small" onClick={() => { action.reset(); setDomains([...domains, myDomain]); }} data-testid="org-add-domain">{t('orgSettings.general.add_domain', { domain: myDomain })}</Button>}
        </Row>
        <SelectField label={t('orgNew.field.domain_role')} value={domainRole} onChange={(e) => setDomainRole(e.target.value as OrgRole)}>
          {ORG_ROLES.map((r) => <option key={r} value={r}>{t(`org.role.${r}`)} — {t(`org.role.${r}_help`)}</option>)}
        </SelectField>
        <Field>
          <FieldLabel htmlFor="org-sso-orgs">{t('orgSettings.general.sso_orgs')}</FieldLabel>
          <Input id="org-sso-orgs" value={ssoOrgIds} placeholder="org_…" onChange={(e) => setSsoOrgIds(e.target.value)} />
          <HelperText>{t('orgSettings.general.sso_orgs_help')}</HelperText>
        </Field>
        {action.feedback}
        <Row><Button variant="contained" loading={updateState.isLoading} onClick={() => void save()} data-testid="org-settings-save">{t('orgSettings.save')}</Button></Row>
      </Panel>
      <Danger>
        <h3>{t('orgSettings.general.danger')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.general.delete_help')}</Description>
        <Row><Button color="secondary" loading={removeState.isLoading} onClick={() => void destroy()} data-testid="org-delete">{t('orgSettings.general.danger')}</Button></Row>
      </Danger>
    </Controls>
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
  const { cacheIdentity } = useAuth();
  const action = useOrgAction();
  const { run } = action;
  const [setRole] = useSetOrgMemberRoleMutation();
  const [removeMember] = useRemoveOrgMemberMutation();
  const [addMember, addState] = useAddOrgMemberMutation();
  const [approve] = useApproveOrgRequestMutation();
  const [reject] = useRejectOrgRequestMutation();
  const [makeInvite, inviteState] = useCreateOrgInviteMutation();
  const [revoke] = useRevokeOrgInviteMutation();
  const requestsQuery = useOrgRequestsQuery({ id: org.id, identity: cacheIdentity });
  const invitesQuery = useOrgInvitesQuery({ id: org.id, identity: cacheIdentity }, { refetchOnMountOrArgChange: true, pollingInterval: 30_000 });
  const parsedRequests = parseOrgRequests(requestsQuery.currentData);
  const parsedInvites = parseOrgInvites(invitesQuery.currentData);
  const requestsValid = completeList(requestsQuery.currentData, 'requests', parsedRequests);
  const invitesValid = completeList(invitesQuery.currentData, 'invites', parsedInvites)
    && parsedInvites.every(i => i.created_at !== null && i.expires_at !== null && i.expires_at > i.created_at)
    && new Set(parsedInvites.map(i => i.id ?? i.token_prefix)).size === parsedInvites.length;
  const requests = requestsQuery.isError || !requestsValid ? [] : parsedRequests;
  const [now, setNow] = useState(Date.now);
  const invites = invitesQuery.isError || !invitesValid ? [] : parsedInvites.filter(i => openOrgInvite(i, now));
  const [q, setQ] = useState('');
  const [newPrincipal, setNewPrincipal] = useState('');
  const [newRole, setNewRole] = useState<OrgRole>('read');
  const [inviteRole, setInviteRole] = useState<OrgRole>('read');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDays, setInviteDays] = useState(7);
  const [freshInvite, setFreshInvite] = useState<OrgInviteView | null>(null);
  const [approveRole, setApproveRole] = useState<Record<string, OrgRole>>({});
  const needle = q.trim().toLowerCase();
  const members = org.members.filter((m) => !needle || [m.name, m.email, m.principal].some((s) => (s ?? '').toLowerCase().includes(needle)));
  const copyableInvite = !invitesQuery.isError && !invitesQuery.isFetching && invitesValid && listedOrgInvite(freshInvite, parsedInvites, now);
  useEffect(() => {
    const next = Math.min(...[...parsedInvites, ...(freshInvite ? [freshInvite] : [])].map(i => i.expires_at ?? 0).filter(expiry => expiry > now));
    if (!Number.isFinite(next)) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, next - Date.now() + 1)));
    return () => clearTimeout(timer);
  }, [invitesQuery.currentData, freshInvite, now]);
  const createInvitation = () => run(async () => {
    setFreshInvite(null);
    const expected = { role: inviteRole, email: inviteEmail.trim() || null, ttlHours: inviteDays * 24 };
    const result = await makeInvite({ id: org.id, ...expected }).unwrap();
    const made = createdOrgInvite(result, expected, Date.now());
    if (!made) throw new Error(t('orgSettings.invites.missing_url'));
    return made;
  }, setFreshInvite);

  return (
    <Controls disabled={action.pending} onChange={action.reset}>
      <Panel data-testid="org-settings-members">
        <Description style={{ margin: 0 }}>{t('orgSettings.members.lede')}</Description>
        <Input value={q} placeholder={t('orgSettings.members.search')} onChange={(e) => setQ(e.target.value)} data-testid="org-members-search" />
        <Table>
          <thead><tr><th>{t('org.tab.members')}</th><th>{t('orgSettings.invites.role')}</th><th /><th /></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.principal} data-testid={`org-settings-member-${m.principal}`}>
                <td data-label={t('org.tab.members')}><div>{m.name ?? '—'}</div><div style={{ color: '#777' }}>{m.email ?? ''}</div><Mono style={{ fontSize: 12 }}>{m.principal}</Mono></td>
                <td data-label={t('orgSettings.invites.role')}><RoleSelect value={m.role} onChange={(role) => void run(() => setRole({ id: org.id, principal: m.principal, role }).unwrap())} testId={`org-role-${m.principal}`} /></td>
                <td><Chip>{t(`org.via.${m.via}`)}</Chip></td>
                <td><Button size="small" variant="text" color="secondary" onClick={() => { if (window.confirm(t('orgSettings.members.remove_confirm', { who: m.name ?? m.email ?? m.principal }))) void run(() => removeMember({ id: org.id, principal: m.principal }).unwrap()); }}>{t('orgSettings.members.remove')}</Button></td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Row>
          <Input value={newPrincipal} placeholder="0x… / sso:…" onChange={(e) => setNewPrincipal(e.target.value)} style={{ maxWidth: 360 }} data-testid="org-add-principal" />
          <RoleSelect value={newRole} onChange={setNewRole} />
          <Button size="small" loading={addState.isLoading} disabled={!newPrincipal.trim()} onClick={() => void run(() => addMember({ id: org.id, principal: newPrincipal.trim(), role: newRole }).unwrap(), () => setNewPrincipal(''))} data-testid="org-add-member">{t('orgSettings.members.add_cta')}</Button>
        </Row>
        <HelperText>{t('orgSettings.members.add')} — {t('orgSettings.members.add_help')}</HelperText>
      </Panel>

      <Panel data-testid="org-settings-requests">
        <h3>{t('orgSettings.requests.title')}</h3>
        <OrgReadStatus query={requestsQuery} valid={requestsValid} />
        {requestsValid && !requestsQuery.isError && requests.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.requests.empty')}</Description>}
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
          <Button size="small" variant="contained" loading={inviteState.isLoading} data-testid="org-invite-make" onClick={() => void createInvitation()}>{t('orgSettings.invites.make')}</Button>
        </Row>
        {freshInvite?.url && copyableInvite ? (
          <Alert $tone="success" data-testid="org-invite-url">
            <Row><Chip>{t(`org.role.${freshInvite.role}`)}</Chip>{freshInvite.email && <span>{freshInvite.email}</span>}<span>{t('orgSettings.invites.expires', { date: when(freshInvite.expires_at) })}</span></Row>
            {t('orgSettings.invites.new')} <Mono>{freshInvite.url}</Mono> <CopyButton text={freshInvite.url} label={t('orgSettings.invites.copy')} />
          </Alert>
        ) : freshInvite && <Alert $tone="info" role="status">{t(invitesQuery.isFetching ? 'orgSettings.invites.checking' : 'orgSettings.invites.unavailable')}</Alert>}
        <SubTitle $mt={4} style={{ fontSize: 14 }}>{t('orgSettings.invites.open')}</SubTitle>
        <Row><Button type="button" size="small" variant="text" disabled={invitesQuery.isFetching} onClick={() => void invitesQuery.refetch()}>{t('orgSettings.invites.refresh')}</Button></Row>
        <OrgReadStatus query={invitesQuery} valid={invitesValid} />
        {invitesValid && !invitesQuery.isError && invites.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.invites.empty')}</Description>}
        {invites.map((i) => (
          <Row key={i.id ?? i.token_prefix}>
            <Mono>{i.token_prefix}…</Mono><Chip>{t(`org.role.${i.role}`)}</Chip>{i.email && <span>{i.email}</span>}
            <span style={{ color: '#777', fontSize: 12 }}>{i.used_by ? t('orgSettings.invites.used') : t('orgSettings.invites.expires', { date: when(i.expires_at) })}</span>
            <Button size="small" variant="text" color="secondary" disabled={!i.id || invitesQuery.isFetching} onClick={() => { if (i.id) void run(async () => {
              const result = await revoke({ id: org.id, token: i.id! }).unwrap();
              if (!confirmedInviteRevocation(result, i.id!)) throw new Error(t('org.entry.unconfirmed'));
            }, () => { if (freshInvite?.id === i.id) setFreshInvite(null); }); }}>{t('orgSettings.invites.revoke')}</Button>
            {!i.id && <HelperText>{t('orgSettings.invites.no_revoke_id')}</HelperText>}
          </Row>
        ))}
      </Panel>
      {action.feedback}
    </Controls>
  );
}

// ------------------------------------------------------------------------------------------------ Resource groups

function GroupsTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const auth = useAuth();
  const query = useOrgGroupsQuery({ id: org.id, identity: auth.cacheIdentity }, { refetchOnMountOrArgChange: true });
  const groups = orgGroups(query.currentData);
  const action = useOrgAction();
  const [createGroup, createState] = useCreateOrgGroupMutation();
  const [updateGroup, updateState] = useUpdateOrgGroupMutation();
  const [deleteGroup] = useDeleteOrgGroupMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OrgGroupView | null>(null);
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const currentGroup = groups?.find(g => g.id === editing?.id);
  const changed = !!editing && !!groups && !sameOrgGroup(currentGroup, editing);
  const missingMembers = missingGroupSelections(members, org.members.map(m => m.principal));
  const missingAgents = missingGroupSelections(agents, org.agents.map(a => a.id));
  const unavailable = missingMembers.length > 0 || missingAgents.length > 0;
  const start = (g: OrgGroupView | null) => { action.reset(); setFormOpen(true); setEditing(g); setName(g?.name ?? ''); setMembers(g?.members ?? []); setAgents(g?.agents ?? []); };
  const close = () => { setFormOpen(false); setEditing(null); setName(''); setMembers([]); setAgents([]); };
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const save = () => {
    if (changed || unavailable || !groups || query.isError || query.isFetching || !name.trim()) return;
    const draft = { name: name.trim(), members, agents };
    return action.run(() => saveSelectedOrgGroup(editing, draft, {
      read: () => query.refetch().unwrap(), isCurrent: action.isCurrent,
      save: () => editing ? updateGroup({ id: org.id, groupId: editing.id, ...draft }).unwrap() : createGroup({ id: org.id, ...draft }).unwrap(),
    }), close);
  };

  if (!groups || query.isError) return <Panel><OrgReadStatus query={query} valid={!!groups} /></Panel>;

  return (
    <Controls disabled={action.pending}>
      <Panel data-testid="org-settings-groups">
        <Description style={{ margin: 0 }}>{t('orgSettings.groups.lede')}</Description>
        {groups.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.groups.empty')}</Description>}
        {groups.map((g) => (
          <Row key={g.id} data-testid={`org-group-${g.id}`}>
            <strong>{g.name}</strong>
            <Chip>{t('orgSettings.groups.members')} {g.members.length}</Chip>
            <Chip>{t('orgSettings.groups.agents')} {g.agents.length}</Chip>
            <Button size="small" variant="text" onClick={() => start(g)}>{t('orgSettings.groups.edit')}</Button>
            <Button size="small" variant="text" color="secondary" onClick={() => void action.run(async () => confirmGroupDeletion(await deleteGroup({ id: org.id, groupId: g.id }).unwrap(), g.id), () => { if (editing?.id === g.id) close(); })}>{t('orgSettings.groups.delete')}</Button>
          </Row>
        ))}
        <Row><Button size="small" onClick={() => start(null)} data-testid="org-group-new">{t('orgSettings.groups.new')}</Button></Row>
      </Panel>
      {formOpen && (
        <Panel data-testid="org-group-form">
          <h3>{editing ? editing.name : t('orgSettings.groups.new')}</h3>
          {changed && <Alert role="alert" $tone="warning">{t('orgSettings.groups.changed')} {currentGroup && <Button type="button" size="small" onClick={() => start(currentGroup)}>{t('orgSettings.groups.reload')}</Button>}</Alert>}
          {unavailable && <Alert role="alert" $tone="warning">{t('orgSettings.groups.unavailable')}</Alert>}
          <Field><FieldLabel htmlFor="org-group-name">{t('orgSettings.groups.name')}</FieldLabel><Input id="org-group-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} data-testid="org-group-name" /></Field>
          <div>
            <FieldLabel>{t('orgSettings.groups.members')}</FieldLabel>
            <Row>{org.members.map((m) => <Checkbox key={m.principal} label={m.name ?? m.email ?? m.principal} checked={members.includes(m.principal)} onChange={() => toggle(members, setMembers, m.principal)} />)}</Row>
            <Row>{missingMembers.map(principal => <Checkbox key={principal} label={t('orgSettings.groups.missing', { id: principal })} checked onChange={() => setMembers(members.filter(v => v !== principal))} />)}</Row>
          </div>
          <div>
            <FieldLabel>{t('orgSettings.groups.agents')}</FieldLabel>
            <Row>{org.agents.map((a) => <Checkbox key={a.id} label={a.name} checked={agents.includes(a.id)} onChange={() => toggle(agents, setAgents, a.id)} />)}</Row>
            <Row>{missingAgents.map(id => <Checkbox key={id} label={t('orgSettings.groups.missing', { id })} checked onChange={() => setAgents(agents.filter(v => v !== id))} />)}</Row>
            <HelperText>{t('orgSettings.groups.agents_hint')}</HelperText>
          </div>
          <Row>
            <Button variant="contained" loading={createState.isLoading || updateState.isLoading} disabled={!name.trim() || changed || unavailable || query.isFetching} onClick={() => void save()} data-testid="org-group-save">{t('orgSettings.groups.save')}</Button>
            <Button variant="text" onClick={close}>{t('orgSettings.cancel')}</Button>
          </Row>
        </Panel>
      )}
      {action.feedback}
    </Controls>
  );
}

// ------------------------------------------------------------------------------------------------ Billing

function BillingTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { cacheIdentity } = useAuth();
  const query = useOrgBillingQuery({ id: org.id, identity: cacheIdentity }, { pollingInterval: 30_000 });
  const { currentData: data } = query;
  const billing = useMemo(() => parseOrgBilling(data), [data]);
  const [update, updateState] = useUpdateOrgMutation();
  const action = useOrgAction();
  const [cap, setCap] = useState(org.spend_cap_credits === null ? '' : String(org.spend_cap_credits));
  const saveCap = async () => {
    action.reset();
    const value = orgSpendCap(cap);
    if (value === undefined) { action.setError(t('orgSettings.billing.cap_invalid')); return; }
    await action.run(() => update({ id: org.id, patch: { spendCapCredits: value } }).unwrap());
  };
  if (query.isError || !billing) return <OrgReadStatus query={query} valid={!!billing} />;
  const max = Math.max(1, ...billing.agents.map((a) => a.total));
  return (
    <>
      <Panel data-testid="org-settings-billing">
        <Description style={{ margin: 0 }}>{t('orgSettings.billing.lede')}</Description>
        {!billing.spend_metered && <Alert $tone="info" data-testid="org-billing-not-metered">{t('orgSettings.billing.not_metered')}</Alert>}
        <Field>
          <FieldLabel htmlFor="org-cap">{t('orgSettings.billing.cap')}</FieldLabel>
          <Row><Input id="org-cap" value={cap} disabled={action.pending} inputMode="numeric" onChange={(e) => setCap(e.target.value)} style={{ maxWidth: 200 }} data-testid="org-cap" /><Button size="small" loading={updateState.isLoading || action.pending} onClick={() => void saveCap()}>{t('orgSettings.save')}</Button></Row>
          <HelperText>{t('orgSettings.billing.cap_help')}</HelperText>
        </Field>
        {action.feedback}
      </Panel>
      <Panel>
        <h3>{t('orgSettings.billing.keys')}</h3>
        <Description style={{ margin: 0 }}>{t('orgSettings.billing.keys_help', { orgs: billing.sso_org_ids.join(', ') || t('orgSettings.security.none') })}</Description>
        {!billing.keys_available ? <Alert $tone="info">{t('orgSettings.billing.keys_unavailable')}</Alert> : billing.keys.length === 0 ? <Description style={{ margin: 0 }}>{t('orgSettings.billing.keys_empty')}</Description> : (
          <Table>
            <thead><tr><th>{t('orgSettings.billing.key_owner')}</th><th>{t('orgSettings.billing.key_label')}</th><th>{t('orgSettings.billing.key_issued')}</th><th /></tr></thead>
            <tbody>{billing.keys.map((k) => (
              <tr key={`${k.owner}:${k.prefix}`}><td data-label={t('orgSettings.billing.key_owner')}><Mono>{k.owner}</Mono></td><td data-label={t('orgSettings.billing.key_label')}>{k.label ?? <Mono>{k.prefix}…</Mono>}</td><td data-label={t('orgSettings.billing.key_issued')}>{when(k.issuedAt)}</td><td>{k.disabled && <Chip $tone="warn">{t('orgSettings.billing.key_disabled')}</Chip>}</td></tr>
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
              <td data-label={t('org.tab.agents')}>{a.name}</td>
              <td data-label={t('orgSettings.billing.agents')}><Bar pct={(a.total / max) * 100} label={String(a.total)} /></td>
              <td data-label={t('orgSettings.billing.last_call')}>{a.last_at ? when(a.last_at) : t('orgSettings.billing.never')}</td>
            </tr>
          ))}</tbody>
        </Table>
      </Panel>
    </>
  );
}

const BarTrack = styled.div`display: flex; align-items: center; gap: 8px; width: 160px; max-width: 100%; min-width: 0;`;
const BarFill = styled.div<{ $pct: number }>`height: 8px; border-radius: 4px; background: #8b3eeb; width: ${(p) => Math.max(2, p.$pct)}%; max-width: 100%; flex: 0 0 auto;`;
function Bar({ pct, label }: { pct: number; label: ReactNode }) {
  return <BarTrack><div style={{ flex: 1 }}><BarFill $pct={pct} /></div><span style={{ fontSize: 12 }}>{label}</span></BarTrack>;
}

// ------------------------------------------------------------------------------------------------ Security & SSO

function SecurityTab({ org }: { org: OrgProfile }) {
  const { t } = useT();
  const { cacheIdentity } = useAuth();
  const query = useOrgSecurityQuery({ id: org.id, identity: cacheIdentity });
  const { currentData: data } = query;
  const security = useMemo(() => parseOrgSecurity(data), [data]);
  const [limit, setLimit] = useState(50);
  const auditQuery = useOrgAuditQuery({ id: org.id, identity: cacheIdentity, limit });
  const parsedAudit = parseOrgAudit(auditQuery.currentData);
  const auditValid = completeList(auditQuery.currentData, 'audit', parsedAudit);
  const audit = auditQuery.isError || !auditValid ? [] : parsedAudit;
  if (query.isError || !security) return <OrgReadStatus query={query} valid={!!security} />;
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
        <OrgReadStatus query={auditQuery} valid={auditValid} />
        {auditValid && !auditQuery.isError && audit.length === 0 && <Description style={{ margin: 0 }}>{t('orgSettings.security.audit_empty')}</Description>}
        {audit.length > 0 && (
          <Table>
            <thead><tr><th>{t('orgSettings.security.when')}</th><th>{t('orgSettings.security.actor')}</th><th>{t('orgSettings.security.action')}</th><th>{t('orgSettings.security.target')}</th></tr></thead>
            <tbody>{audit.map((e) => (
              <tr key={e.seq}><td data-label={t('orgSettings.security.when')}>{when(e.ts)}</td><td data-label={t('orgSettings.security.actor')}><Mono>{e.actor}</Mono></td><td data-label={t('orgSettings.security.action')}>{e.action}{e.detail && <span style={{ color: '#777' }}> {JSON.stringify(e.detail)}</span>}</td><td data-label={t('orgSettings.security.target')}>{e.target ? <Mono>{e.target}</Mono> : '—'}</td></tr>
            ))}</tbody>
          </Table>
        )}
        {audit.length >= limit && limit < 1000 && <Row><Button size="small" variant="text" disabled={auditQuery.isFetching} onClick={() => setLimit(Math.min(1000, limit * 2))}>{t('orgSettings.security.audit_more')}</Button></Row>}
      </Panel>
    </>
  );
}
