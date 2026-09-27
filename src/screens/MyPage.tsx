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
import { useState } from 'react';
import styled from 'styled-components';
import { errorMessage, useApiKeysQuery, useCreateApiKeyMutation, useMeQuery, useMyNodesQuery, useRevokeApiKeyMutation } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, Description, Mono, PageWrapper, StyledLink, SubTitle, Title } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { shortAddr } from '@/utils/format';

const Panel = styled.div`border: 1px solid #e2e4ea; border-radius: 10px; padding: 18px; margin-bottom: 28px;`;
const Row = styled.div`display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px;`;
const Links = styled.div`display: flex; gap: 18px; flex-wrap: wrap; margin-top: 10px;`;

export default function MyPage() {
  const { t } = useT();
  useTitle(t('me.title'));
  const { isOwner, sso } = useAuth();
  const { data: me, isLoading } = useMeQuery();
  /**
   * An AIN account makes keys for one of its organizations, or personal ones (ainize-node src/sso.ts). The default
   * is the organization it signed in for — the company's key is the company's to switch off — and the choice is
   * shown, because a personal key is the one that outlives leaving.
   */
  const orgs = sso?.orgs ?? [];
  const [keyFor, setKeyFor] = useState<string | null | undefined>(undefined);
  const scope = keyFor !== undefined ? keyFor : sso ? (sso.activeOrg ?? orgs[0]?.id ?? null) : undefined;
  const orgName = (id: string | null | undefined) => (id ? orgs.find((o) => o.id === id)?.name ?? id : t('me.keys.personal'));
  const { data: keys } = useApiKeysQuery();
  const { data: myNodes } = useMyNodesQuery(undefined, { skip: !me?.subject });
  const [createKey, createState] = useCreateApiKeyMutation();
  const [revokeKey] = useRevokeApiKeyMutation();
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;

  return (
    <PageWrapper>
      <Title>{t('me.title')}</Title>
      <Description>{t('me.lede')}</Description>

      <SubTitle>{t('me.identity')}</SubTitle>
      <Panel>
        {me?.subject
          ? <Mono title={me.subject} data-testid="me-address">{shortAddr(me.subject, 10)}</Mono>
          : <Description>{t('me.identity.none')}</Description>}
        {sso && (
          <Description data-testid="me-sso">
            {t('me.identity.sso')}: {sso.email ?? sso.name ?? sso.sub}
            {orgs.length > 0 && <> · {t('me.identity.orgs', { orgs: orgs.map((o) => o.name).join(', ') })}</>}
          </Description>
        )}
      </Panel>

      <SubTitle>{t('me.keys.title')}</SubTitle>
      <Description>{t('me.keys.lede')}</Description>
      <Panel>
        {issued && (
          <>
            <Mono data-testid="me-issued-key">{issued}</Mono>
            {/* Said where it cannot be missed: there is no second chance to read this. */}
            <Description>{t('me.keys.once')}</Description>
          </>
        )}
        {(keys?.keys.length ?? 0) === 0 && !issued && <Description>{t('me.keys.none')}</Description>}
        {(keys?.keys.length ?? 0) > 0 && (
          <TableWrapper style={{ marginTop: 8 }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead $align="left" $padding="0 8px">{t('me.keys.label')}</TableHead>
                  {sso && <TableHead>{t('me.keys.scope')}</TableHead>}
                  <TableHead>{t('me.keys.created')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(keys?.keys ?? []).map((k) => (
                  <TableRow key={k.prefix}>
                    <TableData $align="left" $padding="0 8px">{k.label ?? k.prefix}</TableData>
                    {sso && <TableData>{orgName(k.org_id)}{k.disabled ? ` (${t('me.keys.disabled')})` : ''}</TableData>}
                    <TableData>{new Date(k.issuedAt).toLocaleDateString()}</TableData>
                    <TableData>
                      <Button
                        size="small" variant="text" color="secondary" type="button"
                        onClick={() => { void revokeKey(k.prefix); }}
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
        {sso && orgs.length > 0 && (
          <Row>
            <label htmlFor="me-key-for">{t('me.keys.for')}</label>
            <select id="me-key-for" data-testid="me-key-for" value={scope ?? ''} onChange={(e) => setKeyFor(e.target.value || null)}>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              <option value="">{t('me.keys.personal')}</option>
            </select>
            <Description style={{ margin: 0 }}>{t('me.keys.org_hint')}</Description>
          </Row>
        )}
        <Row>
          <Button
            type="button"
            data-testid="me-create-key"
            disabled={createState.isLoading}
            onClick={() => {
              setError(null);
              void createKey(scope !== undefined ? { org_id: scope } : {}).unwrap()
                .then((r) => setIssued(r.api_key))
                .catch((e: unknown) => setError(errorMessage(e)));
            }}
          >
            {createState.isLoading ? t('me.keys.creating') : t('me.keys.create')}
          </Button>
          <StyledLink to="/models">{t('me.keys.models')}</StyledLink>
        </Row>
        {error && <Alert>{t('me.keys.failed', { why: error })}</Alert>}
      </Panel>

      <SubTitle>{t('me.nodes.title')}</SubTitle>
      <Description>{t('me.nodes.lede')}</Description>
      <Panel>
        {(myNodes?.nodes?.length ?? 0) === 0
          ? <Description>{t('me.nodes.none')}</Description>
          : <Mono>{(myNodes?.nodes ?? []).map((n) => n.name ?? shortAddr(n.address)).join(' · ')}</Mono>}
        <Links><StyledLink to="/my-nodes">{t('me.nodes.link')}</StyledLink></Links>
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
