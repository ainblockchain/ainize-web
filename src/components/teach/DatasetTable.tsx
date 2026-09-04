import styled from 'styled-components';
import type { PreflightFact, TeachDatasetRow } from '@/api/types';
import { useT } from '@/i18n';
import { fileStatus, modelStatus, sharedEnding, type Tone } from './util';

/**
 * The preview table (design §5.4). Two clearly separated families of status live in one column: what the FILE says
 * (computed by the node's parser at upload, present immediately) and what the MODEL says (filled only after the live
 * pre-flight ran, with the model's current answer quoted underneath — that quote is what makes "already known"
 * believable). Editing a question clears its model-side status; the page owns that rule and passes `preflight`
 * without the edited index.
 *
 * Below 720 px the same markup stacks into cards with per-cell labels — no horizontal scroll at 360 px (§5.13).
 */
const Wrap = styled.div`width: 100%;`;
const Table = styled.table`
  width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed;
  th { text-align: left; font-size: 12px; font-weight: 600; color: ${(p) => p.theme.color.GREY}; padding: 6px 10px 6px 0; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; }
  td { padding: 10px 10px 10px 0; vertical-align: top; border-bottom: 1px solid #f0f0f0; word-break: break-word; overflow-wrap: anywhere; }
  th.n, td.n { width: 44px; color: ${(p) => p.theme.color.GREY}; font-variant-numeric: tabular-nums; }
  th.pick, td.pick { width: 34px; }
  th.act, td.act { width: 96px; text-align: right; }
  td.q { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; }
  td.a { color: ${(p) => p.theme.color.DARK_GREY}; }
  td.alt { color: ${(p) => p.theme.color.GREY}; }
  tr[data-bad='1'] td { background: #fff8f8; }
  @media (max-width: 720px) {
    table-layout: auto;
    thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    tr { display: block; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; background: #fff; }
    td { display: block; border: 0; padding: 3px 0; }
    td.act { text-align: left; width: auto; }
    td::before { content: attr(data-label) ': '; font-size: 11px; color: ${(p) => p.theme.color.GREY}; }
    td.q::before { content: none; }
    /* the number IS the line in the visitor's file — on a phone the column heading is gone, so it must carry its label */
    td.n { display: inline-block; margin-right: 8px; }
    td:empty { display: none; }
  }
`;
const Pill = styled.span<{ $tone: Tone }>`
  display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 700; line-height: 1.6; white-space: normal;
  color: ${(p) => (p.$tone === 'ok' ? '#1e6b36' : p.$tone === 'bad' ? '#a0102c' : p.$tone === 'warn' ? '#8a4b00' : '#555')};
  background: ${(p) => (p.$tone === 'ok' ? '#e6f4ea' : p.$tone === 'bad' ? '#fde8ec' : p.$tone === 'warn' ? '#fff3e0' : '#f2f2f2')};
`;
const Chip = styled.span<{ $warn?: boolean }>`
  display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 600; white-space: nowrap;
  color: ${(p) => (p.$warn ? '#8a4b00' : '#555')}; background: ${(p) => (p.$warn ? '#fff3e0' : '#f2f2f2')};
`;
const Help = styled.span<{ $warn?: boolean }>`
  display: block; margin-top: 4px; font-size: 11.5px; line-height: 1.5;
  color: ${(p) => (p.$warn ? '#8a4b00' : p.theme.color.GREY)};
`;
const RowActions = styled.div`
  display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;
  button { background: none; border: 0; padding: 4px 2px; font: inherit; font-size: 12px; color: ${(p) => p.theme.color.PRIMARY}; cursor: pointer; min-height: 32px; &:hover { text-decoration: underline; } }
  button.bad { color: ${(p) => p.theme.color.ERROR}; }
  @media (max-width: 720px) { justify-content: flex-start; }
`;

export interface DatasetTableProps {
  rows: TeachDatasetRow[];
  limits?: { prompt_max: number; answer_max: number };
  /** live pre-flight result by dataset index (only for accepted questions) */
  preflight?: Record<number, PreflightFact>;
  /** the cap picker: `#` becomes a checkbox column */
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (index: number) => void;
  onEdit?: (row: TeachDatasetRow) => void;
  onRemove?: (row: TeachDatasetRow) => void;
  /** a contradictory question: put THIS answer back as the one to learn */
  onKeep?: (row: TeachDatasetRow) => void;
  /** after an edit the numbers are positions in the dataset, not lines of the file the visitor uploaded */
  positions?: boolean;
  /** this node's checks are simulated (policy.simulated_checks): the quoted answer is not a model's */
  simulated?: boolean;
  /** the knowledge this set was copied from — its NAME on the inherited-row chips (SC-5) */
  baseName?: string;
  busy?: boolean;
}

export function DatasetTable({ rows, limits, preflight, selectable, selected, onToggle, onEdit, onRemove, onKeep, positions, simulated, baseName, busy }: DatasetTableProps) {
  const { t } = useT();
  const nHead = t(positions ? 'teach.rows.h.pos' : 'teach.rows.h.n');
  return (
    <Wrap>
      <Table data-testid="dataset-table">
        <thead>
          <tr>
            {/* the selection column has no heading of its own; every checkbox carries its own label */}
            {selectable && <th className="pick" scope="col" />}
            <th className="n" scope="col">{nHead}</th>
            <th scope="col">{t('teach.rows.h.q')}</th>
            <th scope="col">{t('teach.rows.h.a')}</th>
            <th scope="col">{t('teach.rows.h.alt')}</th>
            <th scope="col">{t('teach.rows.h.status')}</th>
            <th className="act" scope="col">{' '}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const file = fileStatus(row, t, limits);
            const model = row.index !== null ? modelStatus(preflight?.[row.index], t, simulated) : null;
            const advisory = sharedEnding(row, t);
            const trains = row.status === 'ok' || row.status === 'fixed' || row.status === 'pii';
            const view = trains && model ? model : file;
            const picked = row.index !== null && selected?.has(row.index);
            return (
              <tr key={`${row.line}-${row.index ?? 'x'}`} data-bad={file.tone === 'bad' ? '1' : '0'} data-testid="dataset-row" data-status={row.status}>
                {selectable && (
                  <td className="pick" data-label={nHead}>
                    {row.index !== null && (
                      <input
                        type="checkbox" checked={!!picked} disabled={busy}
                        onChange={() => onToggle?.(row.index as number)}
                        aria-label={`${t('teach.rows.h.q')} ${row.line}: ${row.prompt ?? ''}`}
                      />
                    )}
                  </td>
                )}
                <td className="n" data-label={nHead}>{row.line}</td>
                <td className="q" data-label={t('teach.rows.h.q')}>
                  {row.prompt ?? (row.raw ? row.raw.slice(0, 120) : '—')}
                  {/* SC-5: where this question came from — the pointer is in the published bytes, so it is a fact, not a label */}
                  {row.from && <Chip data-testid="row-from">{t('teach.rows.from', { name: baseName ?? row.from.split('#')[0] })}</Chip>}
                  {row.replaces && <Chip $warn data-testid="row-changed">{t('teach.rows.changed_badge', { name: baseName ?? row.replaces.split('#')[0] })}</Chip>}
                </td>
                <td className="a" data-label={t('teach.rows.h.a')}>{row.answer ?? '—'}</td>
                <td className="alt" data-label={t('teach.rows.h.alt')}>{row.alt_prompt ?? ''}</td>
                <td data-label={t('teach.rows.h.status')}>
                  <Pill $tone={view.tone}>{view.text}</Pill>
                  {view.help && <Help $warn={view.helpTone === 'warn'} data-testid={view.helpTone === 'warn' ? 'row-simulated' : undefined}>{view.help}</Help>}
                  {trains && !model && <Help>{t('teach.rows.status.unchecked')}</Help>}
                  {advisory && <Help data-testid="advisory">{advisory}</Help>}
                </td>
                <td className="act" data-label="">
                  <RowActions>
                    {onEdit && (row.index !== null || row.status !== 'not_parsed') && (
                      <button type="button" onClick={() => onEdit(row)} disabled={busy} data-testid="row-edit">{t('teach.rows.edit')}</button>
                    )}
                    {onKeep && row.status === 'conflict' && (
                      <button type="button" onClick={() => onKeep(row)} disabled={busy} data-testid="row-keep">{t('teach.rows.conflict_keep')}</button>
                    )}
                    {onRemove && row.index !== null && (
                      <button type="button" className="bad" onClick={() => onRemove(row)} disabled={busy} data-testid="row-remove">{t('teach.rows.remove')}</button>
                    )}
                  </RowActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Wrap>
  );
}
