import { useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useInfoQuery, useTeacherQuery } from '@/api/api';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, Mono, PageWrapper, StatusChip, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { currentTeacherKey, isAddress, shortKey } from '@/lib/teacherKey';
import { num, shortAddr, shortHash } from '@/utils/format';
import { useDateTime, useElapsed } from '@/utils/useFormat';

const Stats = styled.div`margin-top: 16px; display: flex; flex-wrap: wrap; gap: 16px 32px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};`;
const Stat = styled.div<{ $tone?: string }>`
  display: flex; flex-direction: column; min-width: 96px;
  b { font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums; color: ${(p) => (p.$tone === 'bad' ? p.theme.color.ERROR : p.$tone === 'warn' ? p.theme.color.WARNING : p.theme.color.BLACK)}; }
  span { margin-top: 4px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
`;
const AddrLine = styled.div`margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-size: 13px; color: ${(p) => p.theme.color.GREY};`;
const Pay = styled.span<{ $s: string }>`font-weight: 600; color: ${(p) => (p.$s === 'paid' ? p.theme.color.SUCCESS : p.$s === 'failed' ? p.theme.color.ERROR : p.theme.color.WARNING)};`;

/** /teacher/:address — public data-provider page: taught knowledge + earnings reconciled from the public record (spec §4.1 step 9, §9.3). */
export default function TeacherPage() {
  const { address = '' } = useParams<{ address: string }>();
  const { t } = useT();
  const elapsed = useElapsed();
  const dateTime = useDateTime();
  const valid = isAddress(address);
  const { data, error, isLoading } = useTeacherQuery(address, { skip: !valid, pollingInterval: 15_000 });
  const { data: info } = useInfoQuery();
  const mine = currentTeacherKey()?.address.toLowerCase() === address.toLowerCase();
  useTitle(data?.name ? `${t('teacher.title')} · ${data.name}` : t('teacher.title'));

  if (!valid) return <PageWrapper><Alert $tone="error">{t('teacher.not_found')}</Alert></PageWrapper>;
  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (error || !data) return <PageWrapper><Alert $tone="error">{t('common.error', { message: errorMessage(error) })}</Alert></PageWrapper>;
  const e = data.earnings;
  const cur = e.currency;
  const nodeName = info?.node.name ?? 'this node';
  /** item 298 — a lesson can only be sold where enough independent verifiers can look at it. */
  const v = data.verification;
  const cannotSell = !!v && v.verifiers < v.quorum;
  /** item 299 — on a local ledger "Paid" is a line in one node's book, not money that moved. */
  const playMoney = (data.ledger?.kind ?? (cur === 'CREDIT' ? 'local' : undefined)) === 'local';
  /** How long a lesson has been waiting, and how many verifiers actually looked (never "0 of 2" with no age). */
  const waiting = (l: { status: string; verified: boolean; created_at?: number; attestations?: number; quorum?: number }) =>
    !l.verified && ['ANNOUNCED', 'VERIFYING', 'PENDING_REVIEW'].includes(l.status) && l.created_at !== undefined
      ? t('teacher.awaiting', { age: elapsed(l.created_at), n: l.attestations ?? 0, quorum: l.quorum ?? v?.quorum ?? 2 })
      : null;

  return (
    <PageWrapper>
      <TitleRow>
        <Title>{t('teacher.title')}{data.name ? ` · ${data.name}` : ''}</Title>
      </TitleRow>
      <Description>{t('teacher.subtitle')}</Description>
      <AddrLine>
        <Mono title={data.address} data-testid="teacher-address">{data.address}</Mono>
        <CopyButton text={data.address} label={t('common.copy')} />
        {data.hidden && <span>{t('teacher.hidden')}</span>}
      </AddrLine>
      {mine && <Alert $tone="info" style={{ marginTop: 16 }}>{t('teacher.your_page')} <StyledLink to="/chat?mine=1">{t('teach.mine.title')} →</StyledLink></Alert>}
      {cannotSell && (
        <Alert $tone="warning" style={{ marginTop: 16 }} data-testid="teacher-no-verifiers">{t('teacher.no_verifiers', { n: v!.verifiers, quorum: v!.quorum })}</Alert>
      )}
      {playMoney && <Description style={{ marginTop: 12 }} data-testid="teacher-credit-note">{t('teacher.credit_ledger')}</Description>}

      <Stats data-testid="teacher-earnings">
        <Stat><b>{e.owed} {cur}</b><span>{t('teacher.owed')}</span></Stat>
        <Stat><b>{e.paid} {cur}</b><span>{playMoney ? t('teacher.paid_credit', { node: nodeName }) : t('teacher.paid')}</span></Stat>
        <Stat $tone={Number(e.pending) > 0 ? 'warn' : undefined}><b>{e.pending} {cur}</b><span>{t('teacher.pending')}</span></Stat>
        {Number(e.failed) > 0 && <Stat $tone="bad"><b>{e.failed} {cur}</b><span>{t('teacher.failed')}</span></Stat>}
        <Stat><b>{num(e.sales)}</b><span>{t('teacher.sales')}</span></Stat>
      </Stats>
      <Description style={{ marginTop: 8 }}>{t('teach.mine.pending_hint')}</Description>

      <SubTitle $mt={32}>{t('teacher.lessons')}</SubTitle>
      {data.lessons.length === 0 ? <Empty style={{ marginTop: 12 }}>{t('teacher.lessons_empty')}</Empty> : (
        <TableWrapper style={{ marginTop: 12 }}>
          <Table>
            <TableHeader><TableRow><TableHead $align="left" $padding="0 0 0 16px">{t('teacher.h.name')}</TableHead><TableHead>{t('teacher.h.status')}</TableHead><TableHead>{t('teacher.h.downloads')}</TableHead><TableHead $align="right" $padding="0 16px 0 8px">{t('teacher.h.revenue')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.lessons.map((l) => (
                <TableRow key={l.id} data-testid="teacher-lesson">
                  <TableData $align="left" $padding="0 0 0 16px" $weight={600}>{l.status === 'PENDING_REVIEW' ? l.name : <StyledLink to={`/explore?q=${encodeURIComponent(l.id)}`}>{l.name}</StyledLink>}<div style={{ fontSize: 11, color: '#8d8d8f', fontWeight: 400 }}>{l.id}</div></TableData>
                  <TableData>
                    {l.status === 'PENDING_REVIEW' ? t('teach.mine.status.review') : <StatusChip status={l.status} />}
                    {waiting(l) && <div style={{ fontSize: 11, color: '#8d8d8f', fontWeight: 400, marginTop: 4 }} data-testid="teacher-awaiting">{waiting(l)}</div>}
                  </TableData>
                  <TableData>{num(l.downloads)}</TableData>
                  <TableData $align="right" $padding="0 16px 0 8px">{l.revenue} {cur}</TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <SubTitle $mt={32}>{t('teacher.earnings')}</SubTitle>
      {e.items.length === 0 ? <Empty style={{ marginTop: 12 }}>{t('teacher.items_empty')}</Empty> : (
        <TableWrapper style={{ marginTop: 12 }}>
          <Table>
            <TableHeader><TableRow><TableHead $align="left" $padding="0 0 0 16px">{t('teacher.h.patch')}</TableHead><TableHead $align="left">{t('teacher.h.seller')}</TableHead><TableHead>{t('teacher.h.amount')}</TableHead><TableHead $align="left">{t('teacher.h.state')}</TableHead><TableHead $align="right" $padding="0 16px 0 8px">{t('teacher.h.when')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {e.items.map((it) => (
                <TableRow key={it.settle_hash + it.patch_id}>
                  <TableData $align="left" $padding="0 0 0 16px" $weight={600}>{it.patch_id}</TableData>
                  <TableData $align="left" $mono title={it.seller}>{shortAddr(it.seller, 6)}</TableData>
                  <TableData>{it.amount} {it.currency}</TableData>
                  <TableData $align="left">
                    <Pay $s={it.status}>{it.status === 'paid' ? t('teacher.item.paid') : it.status === 'failed' ? t('teacher.item.failed', { seller: shortAddr(it.seller, 6) }) : t('teacher.item.pending')}</Pay>
                    <div style={{ fontSize: 11, color: '#8d8d8f' }}>
                      {it.tx_hash ? t('teacher.item.tx', { tx: shortHash(it.tx_hash, 14) }) : it.attempts !== undefined ? t('teacher.item.attempts', { n: it.attempts }) : it.status === 'pending' && it.scheme !== 'local-credit' ? t('teacher.item.other_node', { seller: shortAddr(it.seller, 6), hash: shortHash(it.settle_hash, 12) }) : it.scheme === 'local-credit' ? t('teacher.item.scheme_local') : it.scheme === 'ain-transfer' ? t('teacher.item.scheme_ain') : ''}
                    </div>
                  </TableData>
                  <TableData $align="right" $padding="0 16px 0 8px" title={dateTime(it.created_at)}>{elapsed(it.created_at)}</TableData>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
      <Description style={{ marginTop: 16, fontSize: 12 }}>{shortKey(data.address)} · {t('teach.key.address')}</Description>
    </PageWrapper>
  );
}
