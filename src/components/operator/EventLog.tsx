import { type ReactNode } from 'react';
import styled, { keyframes } from 'styled-components';
import type { EventRow } from '@/api/types';
import { useT } from '@/i18n';
import { CenterProgress } from '@/components/ui/Misc';
import { Pre } from '@/components/operator/common';
import { dateTime, timeOnly } from '@/utils/format';

/**
 * The ainize LogViewer port, lifted out of LogsPage so the node-wide log (finding 133) renders the same rows as the
 * per-knowledge one instead of a second implementation: bordered panel, PALE_GREY header, alternating rows,
 * Inconsolata 12 px, click a line to expand its `data`.
 */
const Viewer = styled.div`position: relative; display: flex; flex-direction: column; border: 1px solid rgba(0, 0, 0, 0.25); margin-top: 16px;`;
const ViewerHeader = styled.div`
  display: flex; flex-direction: row; align-items: center; gap: 12px; flex-wrap: wrap; padding: 4px 8px; background: ${(p) => p.theme.color.PALE_GREY};
`;
const HeaderLabel = styled.div`font-size: 10px; color: ${(p) => p.theme.color.DARK_GREY};`;
const Filler = styled.div`flex: 1;`;
const LoadOlder = styled.button`
  border: 0; background: transparent; padding: 0; font-size: 10px; font-weight: 700; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; &:hover { text-decoration: underline; }
`;
const Body = styled.div`max-height: min(520px, 65dvh); overflow: auto; min-width: 0;`;
const Details = styled.details`
  min-width: 0;
  & > summary { list-style: none; cursor: pointer; }
  & > summary::-webkit-details-marker { display: none; }
  & > summary:focus-visible { outline: 2px solid #5b1ca8; outline-offset: -2px; }
  & > summary .expand-mark::after { content: '＋'; }
  &[open] > summary .expand-mark::after { content: '−'; }
`;
const showLog = keyframes`from { opacity: 0.2; } to { opacity: 1; }`;
const Line = styled.div<{ $even: boolean; $subject?: boolean; $fresh?: boolean }>`
  display: grid; grid-template-columns: 70px 52px minmax(60px, 100px) ${(p) => p.$subject ? 'minmax(80px, 150px) ' : ''}minmax(0, 1fr); align-items: start; gap: 8px; padding: 8px; background: ${(p) => (p.$even ? '#f2f2f2' : '#ffffff')};
  border-bottom: 1px solid #e0e0e0; animation: ${showLog} 0.4s ease-in;
  border-left: 3px solid ${(p) => (p.$fresh ? p.theme.color.PRIMARY : 'transparent')};
  &:first-child { border-top: 1px solid #e0e0e0; }
  @media (max-width: 640px) {
    grid-template-columns: 70px 52px minmax(0, 1fr);
    .log-subject, .log-message { grid-column: 1 / -1; }
  }
`;
const Cell = styled.span<{ $flex?: number; $align?: string; $color?: string; $weight?: number }>`
  flex: ${(p) => p.$flex ?? 1}; min-width: 0; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; text-align: ${(p) => p.$align ?? 'left'};
  font-weight: ${(p) => p.$weight ?? 400}; color: ${(p) => p.$color ?? p.theme.color.DARK_GREY}; overflow: hidden; text-overflow: ellipsis; white-space: pre-wrap; word-break: break-word;
`;
const Footer = styled.div`padding: 4px 8px; font-size: 10px; color: ${(p) => p.theme.color.GREY}; background: ${(p) => p.theme.color.PALE_GREY};`;

export const LEVEL_COLOR: Record<EventRow['level'], string> = { debug: '#828282', info: '#333333', warn: '#f6981d', error: '#e7711b' };

export function EventLog({ rows, loading, fetching, onOlder, empty, footer, controls, subject, freshAfter }: {
  rows: EventRow[];
  loading: boolean;
  fetching: boolean;
  onOlder: () => void;
  empty: ReactNode;
  footer: string;
  /** extra filters rendered in the panel header (kind picker, follow switch) */
  controls?: ReactNode;
  /** per-row prefix — the node-wide log names which knowledge a line is about */
  subject?: (e: EventRow) => ReactNode;
  /** rows with ts greater than this are marked as arrived since the operator last looked */
  freshAfter?: number;
}) {
  const { t } = useT();
  return (
    <Viewer data-testid="event-log">
      <ViewerHeader>
        <HeaderLabel>{t('op.logs.rows', { n: rows.length })}{fetching ? t('op.logs.refreshing') : ''}</HeaderLabel>
        {controls}
        <Filler />
        <LoadOlder type="button" disabled={loading || fetching} onClick={onOlder}>{t('op.logs.older')}</LoadOlder>
      </ViewerHeader>
      <Body>
        {loading && <CenterProgress />}
        {rows.map((e, i) => {
          const expandable = e.data !== null && e.data !== undefined;
          const fresh = freshAfter !== undefined && e.ts > freshAfter;
          const line = (
            <Line as={expandable ? 'span' : 'div'} $even={i % 2 === 1} $subject={!!subject} $fresh={fresh} title={fresh ? t('op.nodelog.new') : undefined}>
              <Cell title={dateTime(e.ts)}>{timeOnly(e.ts)}</Cell>
              <Cell $color={LEVEL_COLOR[e.level]} $weight={700}>{e.level.toUpperCase()}</Cell>
              <Cell $color="#5b1ca8">{e.kind}</Cell>
              {subject && <Cell className="log-subject">{subject(e)}</Cell>}
              <Cell className="log-message">{e.message}{expandable && <span className="expand-mark" aria-hidden="true" />}</Cell>
            </Line>
          );
          return expandable ? (
            <Details key={`${e.seq}:${e.ts}`}>
              <summary>{line}</summary>
              <Pre style={{ borderRadius: 0, maxWidth: '100%', overflow: 'auto' }}>{JSON.stringify(e.data, null, 2)}</Pre>
            </Details>
          ) : <div key={`${e.seq}:${e.ts}`}>{line}</div>;
        })}
        {!loading && rows.length === 0 && <Line $even={false}><Cell $align="center" style={{ gridColumn: '1 / -1' }}>{empty}</Cell></Line>}
      </Body>
      <Footer>{footer}</Footer>
    </Viewer>
  );
}
