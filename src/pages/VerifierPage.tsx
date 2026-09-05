import { Link, useParams } from 'react-router';
import styled from 'styled-components';
import { errorMessage, useVerifierQuery } from '@/api/api';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { Alert } from '@/components/ui/Form';
import { CenterProgress, CopyButton, Description, Empty, Mono, PageWrapper, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Table, TableBody, TableData, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/Table';
import { isAddress } from '@/lib/teacherKey';
import { num, shortAddr } from '@/utils/format';
import { useDateTime, useElapsed } from '@/utils/useFormat';

const Stats = styled.div`margin-top: 16px; display: flex; flex-wrap: wrap; gap: 16px 32px; padding: 20px 24px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY};`;
const Stat = styled.div<{ $tone?: string }>`
  display: flex; flex-direction: column; min-width: 96px;
  b { font-size: 22px; font-weight: 500; font-variant-numeric: tabular-nums; color: ${(p) => (p.$tone === 'bad' ? p.theme.color.ERROR : p.$tone === 'warn' ? p.theme.color.WARNING : p.theme.color.BLACK)}; }
  span { margin-top: 4px; font-size: 12px; color: ${(p) => p.theme.color.GREY}; }
`;
const AddrLine = styled.div`margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-size: 13px; color: ${(p) => p.theme.color.GREY};`;
const Tag = styled.span<{ $tone?: string }>`
  margin-left: 6px; padding: 1px 6px; font-size: 11px; border-radius: 2px; white-space: nowrap;
  color: ${(p) => (p.$tone === 'bad' ? p.theme.color.ERROR : p.theme.color.GREY)};
  background: ${(p) => (p.$tone === 'bad' ? '#fdeaee' : p.theme.color.PALE_GREY)};
`;

/**
 * /verifier/:address — what one verifier has actually done (item 337).
 *
 * A buyer used to weigh "node-b · Passed" exactly as heavily as a key created five minutes ago: the verification tab
 * printed a name and a short address with no link, and nothing anywhere added up a verifier's attestations, its
 * FAILs, the challenges it raised, or the attestations of its own that were challenged afterwards. Every number here
 * is counted from signed records — none of it is anything the verifier says about itself.
 */
export default function VerifierPage() {
  const { address = '' } = useParams<{ address: string }>();
  const { t } = useT();
  const elapsed = useElapsed();
  const dateTime = useDateTime();
  const valid = isAddress(address);
  const { data, error, isLoading } = useVerifierQuery(address, { skip: !valid, pollingInterval: 30_000 });
  useTitle(data?.name ? `${t('verifier.title')} · ${data.name}` : t('verifier.title'));

  if (!valid) return <PageWrapper><Alert $tone="error">{t('verifier.not_found')}</Alert></PageWrapper>;
  if (isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (error || !data) return <PageWrapper><Alert $tone="error">{t('common.error', { message: errorMessage(error) })}</Alert></PageWrapper>;

  const minutes = Math.round(data.model_seconds / 6) / 10;
  return (
    <PageWrapper>
      <TitleRow>
        <Title>{t('verifier.title')}{data.name ? ` · ${data.name}` : ''}</Title>
      </TitleRow>
      <AddrLine>
        <Mono>{shortAddr(data.address, 10)}</Mono>
        <CopyButton text={data.address} label={t('common.copy')} />
        {data.endpoint ? <Mono>{data.endpoint}</Mono> : null}
        {data.roles.length ? <Mono>{data.roles.join(" · ")}</Mono> : null}
        <span>{data.first_at ? t('verifier.since', { date: dateTime(data.first_at) }) : t('verifier.never')}</span>
        {data.last_at ? <span>{t('verifier.last', { ago: elapsed(data.last_at) })}</span> : null}
      </AddrLine>
      <Description>{t('verifier.intro')}</Description>

      {data.attested === 0 ? <Empty>{t('verifier.none')}</Empty> : (
        <>
          <Stats>
            <Stat><b>{num(data.attested)}</b><span>{t('verifier.s.attested')}</span></Stat>
            <Stat><b>{num(data.passed)}</b><span>{t('verifier.s.passed')}</span></Stat>
            <Stat $tone={data.failed ? 'warn' : undefined}><b>{num(data.failed)}</b><span>{t('verifier.s.failed')}</span></Stat>
            <Stat title={t('verifier.s.hash_only_help')}><b>{num(data.hash_only)}</b><span>{t('verifier.s.hash_only')}</span></Stat>
            <Stat><b>{num(data.knowledges)}</b><span>{t('verifier.s.knowledges')}</span></Stat>
            <Stat title={t('verifier.s.counted_help')}><b>{num(data.counted)}</b><span>{t('verifier.s.counted')}</span></Stat>
            <Stat title={t('verifier.s.rechecks_help')}><b>{num(data.rechecks)}</b><span>{t('verifier.s.rechecks')}</span></Stat>
            <Stat title={t('verifier.s.challenged_after_help')} $tone={data.attestations_later_challenged ? 'bad' : undefined}>
              <b>{num(data.attestations_later_challenged)}</b><span>{t('verifier.s.challenged_after')}</span>
            </Stat>
            <Stat title={t('verifier.s.disagreed_help')}><b>{num(data.disagreed_with_peers)}</b><span>{t('verifier.s.disagreed')}</span></Stat>
            <Stat>
              <b>{num(data.challenges_raised)}</b>
              <span>{t('verifier.s.raised')}{data.challenges_raised
                ? ` (${data.challenges_upheld} ${t('verifier.s.upheld')} · ${data.challenges_dismissed} ${t('verifier.s.dismissed')} · ${data.challenges_open} ${t('verifier.s.open')})`
                : ''}</span>
            </Stat>
            <Stat title={t('verifier.s.engines_help')}><b>{num(data.executors.length)}</b><span>{t('verifier.s.engines')}</span></Stat>
            {data.no_baseline ? <Stat title={t('verifier.s.no_baseline_help')} $tone="warn"><b>{num(data.no_baseline)}</b><span>{t('verifier.s.no_baseline')}</span></Stat> : null}
            {data.measured_runs ? (
              <Stat title={t('verifier.s.work_help')}>
                <b>{t('verifier.s.work_val', { samples: num(data.samples_run), minutes })}</b>
                <span>{t('verifier.s.work')}</span>
              </Stat>
            ) : null}
          </Stats>

          <SubTitle>{t('verifier.s.attested')}</SubTitle>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead $align="left" $padding="0 0 0 32px">{t('verifier.h.knowledge')}</TableHead>
                  <TableHead>{t('verifier.h.result')}</TableHead>
                  <TableHead $align="left">{t('verifier.h.method')}</TableHead>
                  <TableHead title={t('verifier.work_help')}>{t('verifier.h.work')}</TableHead>
                  <TableHead $align="right" $padding="0 32px 0 8px">{t('verifier.h.when')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((it) => (
                  <TableRow key={`${it.patch_id}-${it.created_at}`}>
                    <TableData $align="left" $padding="0 0 0 32px">
                      <StyledLink as={Link} to={`/${it.patch_id}`}>{it.name || it.patch_id}</StyledLink>
                      {it.recheck ? <Tag>{t('verifier.recheck_tag')}</Tag> : null}
                      {it.challenged_after ? <Tag $tone="bad">{t('verifier.challenged_tag')}</Tag> : null}
                    </TableData>
                    <TableData $color={it.passed ? '#44a45f' : '#e6173e'} $weight={600}>{it.passed ? t('detail.pass') : t('detail.fail')}</TableData>
                    <TableData $align="left" title={`verified_on: ${it.verified_on}`}>{it.verified_on}</TableData>
                    <TableData $mono title={t('verifier.work_help')}>
                      {it.samples_run !== null && it.duration_ms !== null
                        ? t('verifier.work_cell', { run: it.samples_run, available: it.samples_available ?? it.samples_run, seconds: Math.round(it.duration_ms / 1000) })
                        : t('verifier.work_none')}
                    </TableData>
                    <TableData $align="right" $padding="0 32px 0 8px" title={dateTime(it.created_at)}>{elapsed(it.created_at)}</TableData>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </>
      )}
    </PageWrapper>
  );
}
