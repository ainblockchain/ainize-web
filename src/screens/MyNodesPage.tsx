import { Link } from 'react-router';
import styled from 'styled-components';
import { useMyNodesQuery } from '@/api/api';
import { useAuth } from '@/auth/AuthContext';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Description, PageWrapper, StyledLink, Title } from '@/components/ui/Misc';
import { QueryError } from '@/components/operator/common';

/**
 * Your nodes.
 *
 * There was no such page and no such question: a node's owners live in that node's own database, so nothing
 * anywhere knew that two machines in two rooms were run by one person. A node now asks this hub for an
 * authorisation code when it starts and prints the link; the wallet that approves it is written into
 * `bindings`, and this page is that table read back — plus the node serving this page, when you operate it.
 *
 * No addresses of machines are shown, only identities. A node of yours is normally on your own network: this
 * browser could not reach it, and printing where it lives would describe your LAN to whoever else reads over
 * your shoulder. What belongs here is that it exists, that it is still being heard from, and what it runs.
 */
const List = styled.div`display: flex; flex-direction: column; gap: 12px; margin-top: 24px;`;
const Card = styled.div`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px; padding: 18px 20px; background: #fff;
`;
const Head = styled.div`display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;`;
const Name = styled.strong`font-size: 16px; font-weight: 700;`;
const Mono = styled.span`font-family: ${(p) => p.theme.font.mono}; font-size: 12px; color: ${(p) => p.theme.color.GREY};`;
const Dot = styled.span<{ $on: boolean | null }>`
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px;
  color: ${(p) => (p.$on === true ? '#1a7f37' : p.$on === false ? '#8a4b00' : p.theme.color.GREY)};
  &::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
`;
const Meta = styled.div`margin-top: 8px; font-size: 13px; color: ${(p) => p.theme.color.GREY}; line-height: 1.7;`;
const Actions = styled.div`margin-top: 12px; display: flex; gap: 14px; font-size: 13px;`;
const Empty = styled.div`
  margin-top: 28px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 8px; padding: 24px;
  font-size: 14px; line-height: 1.9; color: #555;
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 12.5px; background: ${(p) => p.theme.color.PALE_GREY}; padding: 2px 6px; border-radius: 4px; }
`;

export default function MyNodesPage() {
  const { t } = useT();
  const { address } = useAuth();
  useTitle(t('op.mynodes.title'));
  const { data, error, isLoading, refetch, isFetching } = useMyNodesQuery();
  const rows = data?.nodes ?? [];

  return (
    <PageWrapper>
      <Title>{t('op.mynodes.title')}</Title>
      <Description>{t('op.mynodes.desc', { addr: address ? `${address.slice(0, 10)}…${address.slice(-4)}` : '' })}</Description>
      {error && <QueryError error={error} what={t('op.mynodes.title')} onRetry={() => void refetch()} retrying={isFetching} />}

      {!isLoading && rows.length === 0 && (
        <Empty data-testid="mynodes-empty">
          {/* The empty state is the instructions: this page is most often first seen by somebody who has one
              node running somewhere and no idea how it is supposed to find them. */}
          {t('op.mynodes.empty')}
          <br /><br />
          <code>ainize config set hub {data?.hub ?? 'https://ainize.ai'}</code>
          <br />
          <code>ainize start</code>
        </Empty>
      )}

      <List data-testid="mynodes">
        {rows.map((n) => (
          <Card key={n.address}>
            <Head>
              <Name>{n.name ?? t('op.mynodes.unnamed')}</Name>
              <Mono>{n.address.slice(0, 10)}…{n.address.slice(-4)}</Mono>
              <Dot $on={n.seen}>
                {n.seen === true ? t('op.mynodes.seen') : n.seen === false ? t('op.mynodes.unseen') : t('op.mynodes.never')}
              </Dot>
              {n.is_this_hub && <Mono>{t('op.mynodes.this_one')}</Mono>}
            </Head>
            <Meta>
              {n.roles.length > 0 && <>{n.roles.join(' · ')}{n.version ? ` · ${n.version}` : ''}<br /></>}
              {n.agents.length > 0
                ? <>{t('op.mynodes.agents', { n: n.agents.length })}: {n.agents.map((a) => a.name || a.id).join(', ')}</>
                : t('op.mynodes.no_agents')}
            </Meta>
            {/* Only the node serving this page has screens here. Another node of yours is administered in its
                own browser tab, at its own address — which this page deliberately does not know. */}
            {n.operable && (
              <Actions>
                <StyledLink as={Link} to="/logs">{t('op.mynodes.logs')}</StyledLink>
                <StyledLink as={Link} to="/dashboard">{t('op.mynodes.dashboard')}</StyledLink>
              </Actions>
            )}
          </Card>
        ))}
      </List>
    </PageWrapper>
  );
}
