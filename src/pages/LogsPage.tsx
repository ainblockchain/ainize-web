import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import styled, { keyframes } from 'styled-components';
import { usePatchEventsQuery, usePatchRecordsQuery } from '@/api/api';
import type { EventRow, LedgerRecord } from '@/api/types';
import { useT } from '@/i18n';
import { CenterProgress, Description, PageWrapper, SelectBox, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Pre, useMoney } from '@/components/operator/common';
import { dateTime, shortAddr, shortHash, timeOnly } from '@/utils/format';

/** ainize LogViewer port: bordered panel, PALE_GREY header, alternating rows, Inconsolata 12px. */
const Viewer = styled.div`position: relative; display: flex; flex-direction: column; border: 1px solid rgba(0, 0, 0, 0.25); margin-top: 16px;`;
const ViewerHeader = styled.div`
  display: flex; flex-direction: row; align-items: center; gap: 12px; padding: 4px 8px; background: ${(p) => p.theme.color.PALE_GREY};
`;
const HeaderLabel = styled.div`font-size: 10px; color: ${(p) => p.theme.color.DARK_GREY};`;
const Filler = styled.div`flex: 1;`;
const LoadOlder = styled.button`
  border: 0; background: transparent; padding: 0; font-size: 10px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; }
`;
const Body = styled.div`max-height: 520px; overflow: auto;`;
const showLog = keyframes`from { opacity: 0.2; } to { opacity: 1; }`;
const LogRow = styled.div<{ $even: boolean; $clickable?: boolean }>`
  display: flex; flex-direction: row; align-items: flex-start; gap: 8px; padding: 8px; background: ${(p) => (p.$even ? '#f2f2f2' : '#ffffff')};
  border-bottom: 1px solid #e0e0e0; animation: ${showLog} 0.4s ease-in; cursor: ${(p) => (p.$clickable ? 'pointer' : 'default')};
  &:first-child { border-top: 1px solid #e0e0e0; }
`;
const Cell = styled.div<{ $flex?: number; $align?: string; $color?: string; $weight?: number }>`
  flex: ${(p) => p.$flex ?? 1}; min-width: 0; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; text-align: ${(p) => p.$align ?? 'left'};
  font-weight: ${(p) => p.$weight ?? 400}; color: ${(p) => p.$color ?? p.theme.color.DARK_GREY}; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; word-break: break-word;
`;
const Footer = styled.div`padding: 4px 8px; font-size: 10px; color: ${(p) => p.theme.color.GREY}; background: ${(p) => p.theme.color.PALE_GREY};`;
const Timeline = styled.ol`list-style: none; margin: 16px 0 0; padding: 0; border-left: 2px solid #e0e0e0;`;
const TItem = styled.li`position: relative; padding: 0 0 20px 20px; font-size: 13px;
  &::before { content: ''; position: absolute; left: -7px; top: 4px; width: 12px; height: 12px; border-radius: 50%; background: #8b3eeb; border: 2px solid #fff; box-shadow: 0 0 0 1px #8b3eeb; }
`;
const Kind = styled.span`display: inline-block; min-width: 72px; font-weight: 700; color: #5b1ca8; font-size: 11px; letter-spacing: 0.04em; cursor: help;`;

const LEVEL_COLOR: Record<EventRow['level'], string> = { debug: '#828282', info: '#333333', warn: '#f6981d', error: '#e7711b' };

export default function LogsPage() {
  const { t } = useT();
  const money = useMoney();
  const { author = '', patchId = '' } = useParams();
  const [limit, setLimit] = useState(100);
  const [level, setLevel] = useState('all');
  const [open, setOpen] = useState<number | null>(null);
  const events = usePatchEventsQuery({ id: patchId, limit }, { pollingInterval: 5000 });
  const records = usePatchRecordsQuery(patchId);

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

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{t('op.logs.title', { id: patchId })}</Title>
        <SelectBox options={LEVELS} value={level} onChange={setLevel} label={t('common.level_aria')} />
      </TitleRow>
      <Description>{t('op.logs.desc')} <StyledLink to={`/project/${author}/${patchId}`}>{t('op.logs.back')}</StyledLink></Description>

      <Viewer>
        <ViewerHeader>
          <HeaderLabel>{t('op.logs.rows', { n: rows.length })}{events.isFetching ? t('op.logs.refreshing') : ''}</HeaderLabel>
          <Filler />
          <LoadOlder onClick={() => setLimit((l) => l + 200)}>{t('op.logs.older')}</LoadOlder>
        </ViewerHeader>
        <Body>
          {events.isLoading && <CenterProgress />}
          {rows.map((e, i) => (
            <div key={e.seq}>
              <LogRow $even={i % 2 === 1} $clickable={e.data !== null && e.data !== undefined} onClick={() => setOpen(open === e.seq ? null : e.seq)}>
                <Cell $flex={0} style={{ minWidth: 70 }} title={dateTime(e.ts)}>{timeOnly(e.ts)}</Cell>
                <Cell $flex={0} style={{ minWidth: 52 }} $color={LEVEL_COLOR[e.level]} $weight={700}>{e.level.toUpperCase()}</Cell>
                <Cell $flex={0} style={{ minWidth: 72 }} $color="#5b1ca8">{e.kind}</Cell>
                <Cell $flex={1}>{e.message}{e.data !== null && e.data !== undefined ? '  ⋯' : ''}</Cell>
              </LogRow>
              {open === e.seq && e.data !== null && e.data !== undefined && <Pre style={{ borderRadius: 0 }}>{JSON.stringify(e.data, null, 2)}</Pre>}
            </div>
          ))}
          {!events.isLoading && rows.length === 0 && <LogRow $even={false}><Cell $align="center">{t('op.logs.empty')}</Cell></LogRow>}
        </Body>
        <Footer>{t('op.logs.footer', { n: limit })}</Footer>
      </Viewer>

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
