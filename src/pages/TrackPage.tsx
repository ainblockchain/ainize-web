/**
 * `/tracks/<name>` — the page a knowledge track never had (finding 268).
 *
 * A track is the thing this marketplace actually sells to a returning consumer: not one file, but "give me the
 * current version of this, every day". Until now it had no page. The knowledge page printed its track as plain
 * text, `App.tsx` had no route to send that text to, and the only list of tracks in the product was a 35-row table
 * at the bottom of `/network` — measured on a phone, its heading sat at y = 8,009 of a 10,669 px page. A consumer
 * who found today's bake could not get from it to "subscribe to this every day".
 *
 * The page is public and read-only. Subscribing is an operator action that costs money and writes a public record,
 * so what a visitor gets here is the honest description of what it would do plus the one command that does it —
 * never a button that spends. The console (My knowledge → tracks) keeps the buying flow.
 *
 * Track names contain slashes (`finance/KRX-latest`), so the route is a splat and each segment is encoded on its
 * own: `/tracks/finance/KRX-latest`, which is also what an operator would type.
 */
import { useMemo } from 'react';
import { useParams } from 'react-router';
import styled from 'styled-components';
import { useBranchesQuery, useCatalogQuery, useNodesQuery } from '@/api/api';
import type { CatalogEntry } from '@/api/types';
import { CenterProgress, Description, Empty, KeyValue, Mono, PageWrapper, StatusChip, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Offline } from '@/components/ui/Offline';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { num, shortAddr } from '@/utils/format';
import { useDetailFormat } from './detail/recordText';

/** `finance/KRX-latest` → `/tracks/finance/KRX-latest`, each segment encoded so a `#` or `?` in a name cannot break the URL. */
export function trackHref(name: string): string {
  return `/tracks/${name.split('/').map(encodeURIComponent).join('/')}`;
}

const CtxChip = styled.span`
  display: inline-block; margin: 0 6px 6px 0; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
  font-family: ${(p) => p.theme.font.mono}; background: #e1eef3; color: #0b5468;
`;
const CurrentChip = styled.span`
  display: inline-block; margin-left: 8px; padding: 1px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;
  background: #e6f4ea; color: #1e6b36;
`;
const Card = styled.div`
  margin-top: 16px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
`;
const Cmd = styled.pre`
  margin: 12px 0 0; padding: 12px 16px; border-radius: 4px; background: #303133; color: #f2f2f2; font-size: 12px;
  line-height: 1.6; overflow-x: auto;
`;
const Note = styled.p`
  margin: 12px 0 0; font-size: 13px; line-height: 1.7; color: ${(p) => p.theme.color.GREY}; word-break: keep-all;
`;

export default function TrackPage() {
  const { t } = useT();
  const f = useDetailFormat();
  const params = useParams();
  // react-router hands the splat back already decoded per segment
  const name = (params['*'] ?? '').split('/').filter(Boolean).join('/');
  useTitle(name || t('track.title'));

  const branchesQ = useBranchesQuery(undefined, { pollingInterval: 20_000 });
  const nodesQ = useNodesQuery(undefined, { pollingInterval: 30_000 });
  // Members that are RETIRED or unknown to this node are not in the catalogue; the table says so rather than hiding them.
  const catalogQ = useCatalogQuery({ branch: name, limit: 200 }, { skip: !name });

  const branch = branchesQ.data?.branches.find((b) => b.name === name);
  const subscribed = !!branchesQ.data?.mine.includes(name);
  const byId = useMemo(() => {
    const m = new Map<string, CatalogEntry>();
    for (const e of catalogQ.data?.items ?? []) m.set(e.anchor.id, e);
    return m;
  }, [catalogQ.data]);

  const ownerName = nodesQ.data?.nodes.find((n) => n.address === branch?.owner)?.name;
  const current = new Set(branch?.current ?? []);
  const members = branch?.patch_ids ?? [];
  // "How fresh is what I would get" — the newest registration among the members a subscriber actually loads.
  const newest = members
    .filter((id) => current.has(id))
    .map((id) => byId.get(id)?.anchor.created_at ?? 0)
    .reduce((a, b) => Math.max(a, b), 0);

  if (branchesQ.isLoading) return <PageWrapper $wide><CenterProgress /></PageWrapper>;
  if (!branchesQ.data) {
    return (
      <PageWrapper $wide>
        <TitleRow><Title>{t('track.title')}</Title></TitleRow>
        <Offline error={branchesQ.error} what={t('offline.what.network')} retrying={branchesQ.isFetching} onRetry={() => { void branchesQ.refetch(); }} />
      </PageWrapper>
    );
  }
  if (!branch) {
    return (
      <PageWrapper $wide>
        <TitleRow><Title>{t('track.notfound.title')}</Title></TitleRow>
        <Description>{t('track.notfound.body', { name })}</Description>
        <Description><StyledLink to="/network">{t('track.back')} →</StyledLink></Description>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{branch.name}{subscribed && <CurrentChip>{t('track.subscribed')}</CurrentChip>}</Title>
      </TitleRow>
      <Description>{branch.description || t('track.no_description')}</Description>
      <Description>{t('detail.net.tracks_note')}</Description>

      <KeyValue>
        <dt>{t('track.owner')}</dt>
        <dd>{ownerName ? <>{ownerName} <Mono style={{ color: '#8d8d8f' }}>{shortAddr(branch.owner, 6)}</Mono></> : <Mono title={branch.owner}>{shortAddr(branch.owner, 8)}</Mono>}</dd>
        <dt>{t('track.situation')}</dt>
        <dd>{Object.entries(branch.context).map(([k, v]) => <CtxChip key={k}>{k}={v}</CtxChip>)}{Object.keys(branch.context).length === 0 && t('track.situation_none')}</dd>
        <dt>{t('track.members')}</dt>
        <dd>{t('track.members_value', { total: num(members.length), current: num(current.size) })}</dd>
        <dt>{t('track.updated')}</dt>
        <dd>{newest ? t('track.updated_value', { ago: f.ago(newest) }) : '—'}</dd>
        <dt>{t('track.subscribers')}</dt>
        <dd>{branch.subscribers.length === 0 ? t('track.subscribers_none') : branch.subscribers.map((s) => s.name ?? shortAddr(s.address, 6)).join(', ')}</dd>
        <dt>{t('track.created')}</dt>
        <dd>{f.ago(branch.created_at)}</dd>
      </KeyValue>

      <SubTitle $mt={40}>{t('track.members_title')}</SubTitle>
      <Description>{t('track.members_note')}</Description>
      {members.length === 0 && <Empty style={{ marginTop: 12 }}>{t('track.members_empty')}</Empty>}
      {members.length > 0 && (
        <TableWrapper style={{ marginTop: 12, background: '#fff', border: '1px solid #dadada' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead $align="left" $padding="0 0 0 24px">{t('track.h.knowledge')}</TableHead>
                <TableHead $align="left">{t('track.h.status')}</TableHead>
                <TableHead $align="left">{t('common.model')}</TableHead>
                <TableHead>{t('common.price')}</TableHead>
                <TableHead $align="right" $padding="0 24px 0 8px">{t('track.h.registered')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((id) => {
                const e = byId.get(id);
                return (
                  <TableRow key={id}>
                    <TableData $align="left" $padding="0 0 0 24px" $maxWidth="420px">
                      {e
                        ? <StyledLink to={`/${encodeURIComponent(e.anchor.author)}/${encodeURIComponent(id)}`} title={e.anchor.name}>{e.anchor.name || id}</StyledLink>
                        : <Mono title={id}>{id}</Mono>}
                      {current.has(id) && <CurrentChip>{t('track.current')}</CurrentChip>}
                    </TableData>
                    <TableData $align="left">{e ? <StatusChip status={e.status} /> : <span style={{ color: '#8d8d8f' }}>{t('track.unknown_member')}</span>}</TableData>
                    <TableData $align="left" title={e?.anchor.model.id_M ?? ''}>{e?.anchor.model.id_M ?? '—'}</TableData>
                    <TableData>{e ? f.priceLabel(e.anchor.price, e.anchor.currency) : '—'}</TableData>
                    <TableData $align="right" $padding="0 24px 0 8px">{e ? f.ago(e.anchor.created_at) : '—'}</TableData>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <SubTitle $mt={40}>{t('track.follow_title')}</SubTitle>
      <Card>
        <Description style={{ marginTop: 0 }}>{t('track.follow_body')}</Description>
        <Cmd>{`ainize branch subscribe ${branch.name}`}</Cmd>
        {/* Item 237: subscribing appends a permanent public record naming this node and this track. Nobody should
            learn that from the ledger after the fact. */}
        <Note>{t('track.follow_record')}</Note>
        <Note>{t('track.follow_cost')}</Note>
      </Card>

      <Description style={{ marginTop: 32 }}><StyledLink to="/network">{t('track.back')} →</StyledLink></Description>
    </PageWrapper>
  );
}
