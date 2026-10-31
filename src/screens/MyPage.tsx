/**
 * What belongs to the person, as distinct from what belongs to the node they happen to be looking at.
 *
 * This page exists because of a hole the shorter menu left. `/network` and `/ledger` came out of the navigation
 * on the promise that the account page leads to them — and `/account` is the node runner's screen, gated on
 * owning this node, which answers "this node is not yours" to everybody else. The promise held for operators
 * and for nobody else.
 *
 * So the rule for what belongs here is: whose is it? Your keys, your record, the nodes you run somewhere else.
 * Anything that runs THIS node stays on `/account`, and this page links there when you are entitled to it —
 * which is a better way to find out than a page that refuses you.
 */
import { useRef, useState } from 'react';
import styled from 'styled-components';
import { errorMessage, useApiKeysQuery, useCreateApiKeyMutation, useMeQuery, useMyOrgsQuery, useMyNodesQuery } from '@/api/api';
import { parseOrgList } from '@/api/organizations';
import { defaultKeyScope, keyScopeOptions } from '@/api/sharedAgents';
import { useAuth } from '@/auth/AuthContext';
import { useShareableOrgs } from '@/hooks/useShareableOrgs';
import { useClipboardCopy } from '@/hooks/useClipboardCopy';
import { Button } from '@/components/ui/Button';
import { Alert, TextField } from '@/components/ui/Form';
import { CenterProgress, Description, Mono, PageWrapper, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { useApiKeyRevocation } from '@/hooks/useApiKeyRevocation';
import { KeyRevocationNotice } from '@/components/KeyRevocationNotice';
import { useActiveView } from '@/hooks/useActiveView';
import { apiKeyContext, apiKeyExpected, apiKeyId, apiKeySnapshot, createdApiKey } from '@/api/apiKeyEvidence';
import { issuedKeyScope } from './models/issuedKeyMemory';
import { useIssuedKey } from './models/useIssuedKey';
import { signInHref } from '@/lib/uiNavigation';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { shortAddr } from '@/utils/format';

const Panel = styled.div`border: 1px solid #e2e4ea; border-radius: 10px; padding: 18px; margin-bottom: 28px;`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;`;
/** The key just made — where the eye already is (under the form), loud, and with its own copy button. */
const IssuedBox = styled.div`
  margin-top: 14px; padding: 14px 16px; border: 2px solid ${(p) => p.theme.color.PRIMARY}; border-radius: 10px;
  background: ${(p) => p.theme.color.PALE_GREY};
  strong { display: block; margin-bottom: 6px; font-size: 14px; }
  ${Mono} { display: block; font-size: 1em; user-select: all; white-space: normal; overflow-wrap: anywhere; }
`;
const Links = styled.div`display: flex; gap: 18px; flex-wrap: wrap; margin-top: 10px;`;

export default function MyPage() {
  const { cacheIdentity, address } = useAuth();
  return <MyAccount key={JSON.stringify([cacheIdentity, address])} />;
}

function MyAccount() {
  const { t } = useT();
  useTitle(t('me.title'));
  const auth = useAuth(), active = useActiveView();
  const { isOwner, sso, google, isSignedIn, cacheIdentity, loading, address } = auth;
  const current = () => active() && !auth.loading && !auth.signingOut && auth.isCurrentAccount();
  const keyBusy = useRef(false);
  const organizationQuery = useMyOrgsQuery(cacheIdentity, { skip: !isSignedIn, refetchOnMountOrArgChange: true });
  const memberships = isSignedIn ? parseOrgList(organizationQuery.currentData).orgs : [];
  const { data: me, isLoading } = useMeQuery();
  /**
   * An AIN account makes keys for one of its organizations, or personal ones (ainize-node src/sso.ts). The default
   * is the organization it signed in for — the company's key is the company's to switch off — and the choice is
   * shown, because a personal key is the one that outlives leaving.
   *
   * The organizations offered are the ones the node counts the person a member of (`useShareableOrgs`: provisioned
   * AIN memberships and ainize organizations), not only those the ID token named. A token that names none while the
   * node knows two used to hide the choice AND send no `org_id` — and the node then refused the key asking for one.
   */
  const shareable = useShareableOrgs();
  const keyOrgs = keyScopeOptions(shareable.orgs ?? sso?.orgs);
  const [keyFor, setKeyFor] = useState<string | null | undefined>(undefined);
  // `undefined` (omitted) only when there is nothing to choose: the node then makes a personal key without asking.
  const scope = keyFor !== undefined ? keyFor : keyOrgs.length ? defaultKeyScope(keyOrgs, shareable.activeOrg ?? sso?.activeOrg) : undefined;
  const orgName = (id: string | null | undefined) =>
    (id ? keyOrgs.find((o) => o.org_id === id)?.name ?? sso?.orgs.find((o) => o.id === id)?.name ?? id : t('me.keys.personal'));
  const keyActor = apiKeyContext(address, auth.principal);
  const keyContext = issuedKeyScope(cacheIdentity, address);
  const keysQuery = useApiKeysQuery(keyContext, { skip: !isSignedIn || !keyContext, refetchOnMountOrArgChange: true, pollingInterval: 60_000 });
  const keys = apiKeySnapshot(keysQuery.currentData, keyActor);
  const invalidKeys = keysQuery.currentData !== undefined && !keys;
  const keysReady = !!keys && !keysQuery.isFetching && !keysQuery.isError && !!keyContext;
  const nodesQuery = useMyNodesQuery(cacheIdentity, { skip: !isSignedIn || !(me?.subject || sso) });
  const myNodes = nodesQuery.currentData;
  const [createKey, createState] = useCreateApiKeyMutation();
  const [keyName, setKeyName] = useState('');
  const label = keyName.trim();
  const duplicateName = !!label && !!keys?.keys.some((key) => key.label?.trim().toLocaleLowerCase() === label.toLocaleLowerCase());
  // Kept for this tab (sessionStorage, screens/models/issuedKeyMemory.ts): a refresh or a remount of this page must not be
  // the moment the only copy of a secret vanishes. 2026-10-16: a person made a key and never saw its value.
  const { key: issued, state: heldState, remember, forget, forgetById } = useIssuedKey(cacheIdentity, address, keyActor, keysReady ? keysQuery.currentData : undefined, keysQuery.startedTimeStamp);
  const copy = useClipboardCopy(issued ?? '');
  const [error, setError] = useState<string | null>(null);

  const revocation = useApiKeyRevocation({ context: keyActor, current, busy: keyBusy, otherBusy: createState.isLoading, load: () => keysQuery.refetch().unwrap(), confirmed: forgetById });

  const refreshKeys = async () => { await auth.refresh(); if (current()) await keysQuery.refetch(); };

  if (loading || isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;

  return (
    <PageWrapper>
      <Title>{t('me.title')}</Title>
      <Description>{t('me.lede')}</Description>

      <SubTitle>{t('me.identity')}</SubTitle>
      <Panel>
        {me?.subject
          ? <Mono title={me.subject} data-testid="me-address">{shortAddr(me.subject, 10)}</Mono>
          : !sso && !google ? <Description>{t('me.identity.none')}</Description> : null}
        {google && !sso && <Description>{t('me.identity.google')}: {google.email}</Description>}
        {sso && (
          <Description data-testid="me-sso">
            {t('me.identity.sso')}: {sso.email ?? sso.name ?? sso.sub}
            {keyOrgs.length > 0 && <> · {t('me.identity.orgs', { orgs: keyOrgs.map((o) => o.name).join(', ') })}</>}
          </Description>
        )}
      </Panel>

      <SubTitle>{t('orgs.mine')}</SubTitle>
      <Panel data-testid="me-organizations">
        {organizationQuery.isLoading && <CenterProgress />}
        {organizationQuery.error && <Alert role="alert" $tone="error">{t('common.error', { message: errorMessage(organizationQuery.error) })} <Button size="small" onClick={() => void organizationQuery.refetch()}>{t('orgs.retry')}</Button></Alert>}
        {!organizationQuery.isLoading && !organizationQuery.error && memberships.length === 0 && <Description>{t('orgs.empty')}</Description>}
        {memberships.map((org) => <Row key={org.id}>
          <StyledLink to={`/org/${encodeURIComponent(org.id)}`}>{org.name}</StyledLink>
          {org.my_role && <span>{t(`org.role.${org.my_role}`)}</span>}
          <span>{t('orgs.agents', { n: org.agent_count })}</span>
        </Row>)}
        <Links><StyledLink to="/org">{t('orgs.mine')} →</StyledLink></Links>
      </Panel>

      <SubTitle>{t('myAgents.title')}</SubTitle>
      <Description>{t('me.agents.lede')}</Description>
      <Panel>
        <Links><StyledLink to="/me/agents" data-testid="me-agents-link">{t('me.agents.link')}</StyledLink></Links>
      </Panel>

      <SubTitle>{t('me.keys.title')}</SubTitle>
      <Description>{t('me.keys.lede')}</Description>
      <Panel data-testid="me-keys">
        {keysQuery.isLoading && <CenterProgress />}
        {keysQuery.error && <Alert role="alert" $tone="error" data-testid="me-keys-error">{t('common.error', { message: errorMessage(keysQuery.error) })} <Button size="small" disabled={keysQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Alert>}
        {invalidKeys && <Alert role="alert" $tone="error">{t('me.keys.invalid')} <Button size="small" disabled={keysQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Alert>}
        <KeyRevocationNotice action={revocation} />
        {keysReady && keys.keys.length === 0 && !issued && <Description>{t('me.keys.none')}</Description>}
        {(keys?.keys.length ?? 0) > 0 && (
          <TableWrapper style={{ marginTop: 8 }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead $align="left" $padding="0 8px">{t('me.keys.label')}</TableHead>
                  {(sso || keyOrgs.length > 0) && <TableHead>{t('me.keys.scope')}</TableHead>}
                  <TableHead>{t('me.keys.created')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(keys?.keys ?? []).map((k) => (
                  <TableRow key={apiKeyId(k)}>
                    <TableData $align="left" $padding="0 8px">{k.label ?? k.prefix}{k.disabled ? ` (${t('me.keys.disabled')})` : ''}<Mono title={apiKeyId(k)} style={{ display: 'block', fontSize: 11, overflowWrap: 'anywhere', whiteSpace: 'normal', maxWidth: 320 }}>{keys!.keys.filter((key) => key.prefix === k.prefix).length > 1 ? apiKeyId(k) : k.prefix}</Mono></TableData>
                    {(sso || keyOrgs.length > 0) && <TableData>{orgName(k.org_id)}</TableData>}
                    <TableData>{new Date(k.issuedAt).toLocaleDateString()}</TableData>
                    <TableData>
                      <Button
                        size="small" variant="text" color="secondary" type="button"
                        disabled={!keysReady || !revocation.ready || !!revocation.operation || createState.isLoading || revocation.running}
                        onClick={() => { if (keysReady && !createState.isLoading) void revocation.start(k); }}
                      >
                        {t('me.keys.revoke')}
                      </Button>
                    </TableData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
        {keyOrgs.length > 0 && (
          <Row>
            <label htmlFor="me-key-for">{t('me.keys.for')}</label>
            <select id="me-key-for" data-testid="me-key-for" value={scope ?? ''} disabled={createState.isLoading || revocation.running} onChange={(e) => setKeyFor(e.target.value || null)}>
              {keyOrgs.map((o) => <option key={o.org_id} value={o.org_id}>{o.name}</option>)}
              <option value="">{t('me.keys.personal')}</option>
            </select>
            <Description style={{ margin: 0 }}>{t('me.keys.org_hint')}</Description>
          </Row>
        )}
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!current() || keyBusy.current || !keysReady || !keyActor || !label || duplicateName) return;
          keyBusy.current = true;
          setError(null);
          void createKey({ label, org_id: scope ?? null, ...apiKeyExpected(keyActor) }).unwrap()
            .then((r) => {
              if (!auth.isCurrentAccount()) return;
              const secret = createdApiKey(r, label, scope ?? null, keyActor);
              if (!secret) throw new Error(t('me.keys.receipt'));
              if (remember(secret) && current()) setKeyName('');
            })
            .catch((e: unknown) => { if (current()) setError(t('me.keys.create_unknown', { why: errorMessage(e) })); })
            .finally(() => { keyBusy.current = false; });
        }}>
          <TextField label={t('me.keys.name')} placeholder={t('me.keys.name_placeholder')}
            helper={duplicateName ? t('me.keys.name_duplicate') : t('me.keys.name_hint')} error={duplicateName}
            data-testid="me-key-name" value={keyName} onChange={(event) => setKeyName(event.target.value)}
            maxLength={60} required disabled={createState.isLoading || revocation.running} />
          <Row>
            <Button type="submit" data-testid="me-create-key" disabled={!keysReady || createState.isLoading || revocation.running || !label || duplicateName}>
              {createState.isLoading ? t('me.keys.creating') : t('me.keys.create')}
            </Button>
            <StyledLink to="/models">{t('me.keys.models')}</StyledLink>
          </Row>
        </form>
        {heldState === 'revoked' && <Description role="status">{t('me.keys.held.revoked')}</Description>}
        {issued && (
          <IssuedBox data-testid="me-issued-box">
            <strong>{t('me.keys.issued')}</strong>
            {heldState && heldState !== 'ready' && <Description role="status">{t(`me.keys.held.${heldState}`)} <Button size="small" disabled={keysQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Description>}
            <Mono data-testid="me-issued-key">{issued}</Mono>
            {/* Said where it cannot be missed: there is no second chance to read this. */}
            <Description>{t('me.keys.once')}</Description>
            <Row>
              <Button size="small" type="button" data-testid="me-issued-copy" disabled={copy.disabled} aria-busy={copy.phase === 'copying'} onClick={() => void copy.copy()}>
                {t(copy.phase === 'copied' ? 'me.keys.copied' : copy.phase === 'copying' ? 'common.copying' : 'me.keys.copy')}
              </Button>
              <Button size="small" variant="text" color="secondary" type="button" data-testid="me-issued-forget"
                onClick={forget}>{t('me.keys.forget')}</Button>
            </Row>
            {copy.phase === 'failed' && <Alert role="alert">{t('me.keys.copy_failed')}</Alert>}
          </IssuedBox>
        )}
        {error && <Alert role="alert" $tone="error">{error} <Button size="small" disabled={keysQuery.isFetching} onClick={() => void refreshKeys()}>{t('orgs.retry')}</Button></Alert>}
      </Panel>

      <SubTitle>{t('me.nodes.title')}</SubTitle>
      <Description>{t('me.nodes.lede')}</Description>
      <Panel data-testid="me-nodes">
        {!me?.subject && !sso ? <>
          <Description>{t('me.nodes.wallet_needed')}</Description>
          <StyledLink to={`${signInHref({ pathname: '/me' })}&wallet=1`}>{t('op.sign.wallet.connect_option')}</StyledLink>
        </> : <>
          {nodesQuery.isLoading && <CenterProgress />}
          {nodesQuery.error && <Alert role="alert" $tone="error" data-testid="me-nodes-error">{t('common.error', { message: errorMessage(nodesQuery.error) })} <Button size="small" disabled={nodesQuery.isFetching} onClick={() => void nodesQuery.refetch()}>{t('orgs.retry')}</Button></Alert>}
          {nodesQuery.isSuccess && !nodesQuery.error && myNodes?.nodes.length === 0 && <Description>{t('me.nodes.none')}</Description>}
          {!!myNodes?.nodes.length && <Mono>{myNodes.nodes.map((n) => n.name ?? shortAddr(n.address)).join(' · ')}</Mono>}
          <Links><StyledLink to="/my-nodes">{t('me.nodes.link')}</StyledLink></Links>
        </>}
      </Panel>

      {/* Where the two entries that left the top menu went. They are still public; this is a way back to them. */}
      <SubTitle>{t('me.record.title')}</SubTitle>
      <Description>{t('me.record.lede')}</Description>
      <Panel>
        <Links>
          <StyledLink to="/ledger">{t('me.record.ledger')}</StyledLink>
          <StyledLink to="/network">{t('me.record.network')}</StyledLink>
        </Links>
      </Panel>

      {isOwner && (
        <>
          <SubTitle>{t('me.operator.title')}</SubTitle>
          <Description>{t('me.operator.lede')}</Description>
          <Panel>
            <Links><StyledLink to="/account">{t('me.operator.account')}</StyledLink></Links>
          </Panel>
        </>
      )}
    </PageWrapper>
  );
}
