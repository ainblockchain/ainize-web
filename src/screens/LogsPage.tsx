import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import styled from 'styled-components';
import { usePatchEventsQuery, usePatchQuery, usePatchRecordsQuery } from '@/api/api';
import type { LedgerRecord } from '@/api/types';
import { useT } from '@/i18n';
import { useTitle } from '@/utils/useTitle';
import { CenterProgress, Description, PageWrapper, SelectBox, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { EventLog } from '@/components/operator/EventLog';
import { useMoney } from '@/components/operator/common';
import { dateTime, shortAddr, shortHash } from '@/utils/format';

const Timeline = styled.ol`list-style: none; margin: 16px 0 0; padding: 0; border-left: 2px solid #e0e0e0;`;
const TItem = styled.li`position: relative; padding: 0 0 20px 20px; font-size: 13px;
  &::before { content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #8b3eeb; border: 2px solid #fff; box-shadow: 0 0 0 1px #8b3eeb; }
`;
const Kind = styled.span`display: inline-block; min-width: 72px; font-weight: 700; color: #5b1ca8; font-size: 11px; letter-spacing: 0.04em; cursor: help;`;

export default function LogsPage() {
  const { t } = useT();
  const money = useMoney();
  const { author = '', patchId = '' } = useParams();
  const [limit, setLimit] = useState(100);
  const [level, setLevel] = useState('all');
  // Finding 79: the log page never asked whether the knowledge exists, so a mistyped or removed id rendered as a
  // healthy, quiet, empty log — while the manage page for the same id correctly said "Knowledge not found".
  const patch = usePatchQuery(patchId);
  const missing = patch.isError || (!patch.isLoading && !patch.data);
  const events = usePatchEventsQuery({ id: patchId, limit }, { pollingInterval: missing ? 0 : 5000, skip: missing });
  const records = usePatchRecordsQuery(patchId, { skip: missing });
  useTitle(t('op.logs.title', { id: patchId }));

  const LEVELS = [
    { value: 'all', label: t('op.logs.level.all') }, { value: 'info', label: t('op.logs.level.info') },
    { value: 'warn', label: t('op.logs.level.warn') }, { value: 'error', label: t('op.logs.level.error') },
  ];

  const rows = useMemo(() => {
    const all = events.data?.events ?? [];
    return level === 'all' ? all : all.filter((e) => (level === 'warn' ? e.level === 'warn' : level === 'error' ? e.level === 'error' : e.level === 'info' || e.level === 'debug'));
  }, [events.data, level]);

  const kindLabel = (kind: string) => { const k = `op.logs.kind.${kind}`; const v = t(k); return v === k ? kind : v; };
  const who = (v: unknown) => { const s = String(v ?? '?'); return s.startsWith('0x') && s.length > 20 ? shortAddr(s) : s; };
  const describe = (r: LedgerRecord): string => {
    const b = r.body as Record<string, unknown>;
    switch (r.kind) {
      case 'anchor': return t('op.logs.d.anchor', { author: who(b.author_name ?? b.author ?? r.author), sha: shortHash(String(b.patch_sha256 ?? ''), 12), price: money.fmt(String(b.price ?? ''), String(b.currency ?? '')) });
      case 'attest': {
        const how = b.verified_on === 'hash-only' ? t('op.manage.attest.how.hash') : t('op.manage.attest.how.run', { engine: String(b.verified_on ?? 'prototype') });
        // accuracy is only meaningful for verifications that executed the benchmark; integrity-only checks carry no score
        const sc = b.score && typeof b.score === 'object' ? (b.score as Record<string, unknown>) : null;
        // "26/26, 1/8" = accuracy with the knowledge loaded, then the same questions before loading (pre_apply)
        const main = sc ? sc.free_generation ?? sc.free_generation_vllm ?? sc.chat_60 ?? Object.entries(sc).find(([k]) => k !== 'pre_apply')?.[1] : undefined;
        const score = b.verified_on !== 'hash-only' && sc ? [main, sc.pre_apply].filter((v) => v !== undefined && v !== null && v !== '').map(String).join(', ') || '—' : '—';
        return t('op.logs.d.attest', { verifier: who(b.verifier_name ?? b.verifier ?? r.author), result: b.passed === false ? t('op.manage.attest.fail') : t('op.manage.attest.pass'), how, score });
      }
      case 'settle': {
        const royalty = b.royalty && typeof b.royalty === 'object' && Object.keys(b.royalty as object).length
          ? Object.entries(b.royalty as Record<string, string>).map(([addr, amt]) => `${shortAddr(addr)} ${money.fmt(amt, String(b.currency ?? ''))}`).join(', ')
          : t('op.logs.royalty.none');
        const scheme = b.scheme === 'ain-transfer' ? t('op.dash.purchases.scheme.ain') : b.scheme === 'local-credit' ? t('op.dash.purchases.scheme.credit') : String(b.scheme ?? '');
        return t('op.logs.d.settle', { buyer: who(b.buyer), amount: money.fmt(String(b.amount ?? ''), String(b.currency ?? '')), scheme, royalty });
      }
      case 'challenge': return t('op.logs.d.challenge', { who: who(b.challenger ?? r.author), reason: String(b.reason ?? '') });
      case 'supersede': return t('op.logs.d.supersede', { newer: String(b.new_patch_id), older: String(b.old_patch_id), n: String(b.overlap_rows ?? '?') });
      default: return JSON.stringify(b).slice(0, 160);
    }
  };

  if (patch.isLoading) return <PageWrapper><CenterProgress /></PageWrapper>;
  if (missing) {
    return (
      <PageWrapper>
        <Title>{t('op.manage.notfound')}</Title>
        <Description data-testid="logs-notfound">
          {t('op.logs.notfound.desc', { id: patchId })}{' '}
          <StyledLink to="/dashboard">{t('op.manage.back')}</StyledLink>{' · '}
          <StyledLink to="/logs">{t('op.logs.notfound.node')}</StyledLink>
        </Description>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{t('op.logs.title', { id: patchId })}</Title>
        <SelectBox options={LEVELS} value={level} onChange={setLevel} label={t('common.level_aria')} />
      </TitleRow>
      <Description>
        {t('op.logs.desc')} <StyledLink to={`/project/${author}/${patchId}`}>{t('op.logs.back')}</StyledLink>
        {' · '}<StyledLink to="/logs">{t('op.logs.notfound.node')}</StyledLink>
      </Description>

      <EventLog
        rows={rows}
        loading={events.isLoading}
        fetching={events.isFetching}
        onOlder={() => setLimit((l) => l + 200)}
        empty={t('op.logs.empty')}
        footer={t('op.logs.footer', { n: limit })}
      />

      <SubTitle $mt={48}>{t('op.logs.ledger.title')}</SubTitle>
      <Description>{t('op.logs.ledger.desc')}</Description>
      {records.isLoading ? <CenterProgress /> : (
        <Timeline>
          {(records.data?.records ?? []).map((r) => (
            <TItem key={r.hash}>
              <div><Kind title={r.kind}>{kindLabel(r.kind)}</Kind> <span style={{ color: '#8d8d8f' }}>{dateTime(r.ts)}</span></div>
              <div style={{ marginTop: 4 }}>{describe(r)}</div>
              <div style={{ marginTop: 2, fontFamily: 'Inconsolata, monospace', fontSize: 11, color: '#8d8d8f' }} title={r.hash}>{t('op.logs.record')} {shortHash(r.hash, 16)}{r.sig && r.sig.startsWith('0x') ? ` · tx ${shortHash(r.sig, 14)}` : ''}</div>
            </TItem>
          ))}
          {(records.data?.records ?? []).length === 0 && <TItem>{t('op.logs.ledger.empty')}</TItem>}
        </Timeline>
      )}
    </PageWrapper>
  );
}
