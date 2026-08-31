import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import styled, { keyframes } from 'styled-components';
import { usePatchEventsQuery, usePatchRecordsQuery } from '@/api/api';
import type { EventRow, LedgerRecord } from '@/api/types';
import { CenterProgress, Description, PageWrapper, SelectBox, StyledLink, SubTitle, Title, TitleRow } from '@/components/ui/Misc';
import { Pre } from '@/components/operator/common';
import { dateTime, shortHash, timeOnly } from '@/utils/format';

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
const Kind = styled.span`display: inline-block; min-width: 72px; font-weight: 700; color: #5b1ca8; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em;`;

const LEVEL_COLOR: Record<EventRow['level'], string> = { debug: '#828282', info: '#333333', warn: '#f6981d', error: '#e7711b' };
const LEVELS = [{ value: 'all', label: 'All levels' }, { value: 'info', label: 'Info' }, { value: 'warn', label: 'Warning' }, { value: 'error', label: 'Error' }];

function describe(r: LedgerRecord): string {
  const b = r.body as Record<string, unknown>;
  switch (r.kind) {
    case 'anchor': return `announced by ${String(b.author ?? r.author)} · sha256 ${shortHash(String(b.patch_sha256 ?? ''), 12)} · price ${String(b.price ?? '?')} ${String(b.currency ?? '')}`;
    case 'attest': return `${b.passed === false ? 'FAIL' : 'PASS'} by ${String(b.verifier_name ?? b.verifier ?? r.author)} (${String(b.verified_on ?? 'prototype')}) ${JSON.stringify(b.score ?? {})}`;
    case 'settle': return `sold to ${String(b.buyer ?? '?')} for ${String(b.amount ?? '?')} ${String(b.currency ?? '')} via ${String(b.scheme ?? '')} · royalty ${JSON.stringify(b.royalty ?? {})}`;
    case 'challenge': return `challenged by ${String(b.challenger ?? r.author)}: ${String(b.reason ?? '')}`;
    case 'supersede': return `${String(b.new_patch_id)} supersedes ${String(b.old_patch_id)} (${String(b.overlap_rows)} shared rows)`;
    default: return JSON.stringify(b).slice(0, 160);
  }
}

export default function LogsPage() {
  const { author = '', patchId = '' } = useParams();
  const [limit, setLimit] = useState(100);
  const [level, setLevel] = useState('all');
  const [open, setOpen] = useState<number | null>(null);
  const events = usePatchEventsQuery({ id: patchId, limit }, { pollingInterval: 5000 });
  const records = usePatchRecordsQuery(patchId);

  const rows = useMemo(() => {
    const all = events.data?.events ?? [];
    const filtered = level === 'all' ? all : all.filter((e) => (level === 'warn' ? e.level === 'warn' : level === 'error' ? e.level === 'error' : e.level === 'info' || e.level === 'debug'));
    return filtered;
  }, [events.data, level]);

  return (
    <PageWrapper $wide>
      <TitleRow>
        <Title>{patchId} logs</Title>
        <SelectBox options={LEVELS} value={level} onChange={setLevel} />
      </TitleRow>
      <Description>Node-local events for this patch (drafting, publish, verification, trades, runtime), refreshed every 5 seconds. Click a row to expand its data. <StyledLink to={`/project/${author}/${patchId}`}>Back to manage</StyledLink></Description>

      <Viewer>
        <ViewerHeader>
          <HeaderLabel>{rows.length} row(s){events.isFetching ? ' · refreshing…' : ''}</HeaderLabel>
          <Filler />
          <LoadOlder onClick={() => setLimit((l) => l + 200)}>Load older</LoadOlder>
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
          {!events.isLoading && rows.length === 0 && <LogRow $even={false}><Cell $align="center">No events for this patch yet.</Cell></LogRow>}
        </Body>
        <Footer>showing up to {limit} events · times in local timezone</Footer>
      </Viewer>

      <SubTitle $mt={48}>Ledger timeline</SubTitle>
      <Description>Every shared record about this patch — anchor, attestations, settlements, challenges, supersedes — as replicated on this node&apos;s ledger.</Description>
      {records.isLoading ? <CenterProgress /> : (
        <Timeline>
          {(records.data?.records ?? []).map((r) => (
            <TItem key={r.hash}>
              <div><Kind>{r.kind}</Kind> <span style={{ color: '#8d8d8f' }}>{dateTime(r.ts)}</span></div>
              <div style={{ marginTop: 4 }}>{describe(r)}</div>
              <div style={{ marginTop: 2, fontFamily: 'Inconsolata, monospace', fontSize: 11, color: '#8d8d8f' }} title={r.hash}>record {shortHash(r.hash, 16)}{r.sig && r.sig.startsWith('0x') ? ` · tx ${shortHash(r.sig, 14)}` : ''}</div>
            </TItem>
          ))}
          {(records.data?.records ?? []).length === 0 && <TItem>No ledger records yet — the patch is still a local draft.</TItem>}
        </Timeline>
      )}
    </PageWrapper>
  );
}
