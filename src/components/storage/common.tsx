/**
 * The pieces every storage view shares: the panel, the status dot and chips (the project console's colours — green
 * ready, grey pulsing while the node works, red stopped/error), the row and action layouts, the inline dialog, and
 * how a node refusal becomes a sentence (`storage.err.<code>`, with the node's own text appended where it says more
 * than the code — a SQL error, a list of connected projects).
 */
import styled, { css, keyframes } from 'styled-components';
import { storageApiErrorOf, storeStatusTone, type StatusTone, type StoreKind, type StoreStatus } from '@/api/projectStorage';
import { Mono } from '@/components/ui/Misc';
import { useT } from '@/i18n';

export const Panel = styled.section`
  min-width: 0; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 16px; margin: 12px 0 20px;
  display: flex; flex-direction: column; gap: 14px;
  h2 { margin: 0; font-size: 18px; }
  h3 { margin: 0; font-size: 15px; font-weight: 700; }
  @media (max-width: 640px) { input, textarea, select { font-size: 16px; } button { min-height: 44px; } }
`;
export const DangerPanel = styled(Panel)`border-color: #e8b4b4;`;
/** A form that opens in place of a popup — the console has no modal layer, and a dialog that scrolls with the page is easier on a phone. */
export const Dialog = styled(Panel).attrs({ role: 'dialog' })`border-color: ${(p) => p.theme.color.PRIMARY}; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);`;
export const Help = styled.p`margin: 0; font-size: 13px; color: #666; overflow-wrap: anywhere;`;
export const Meta = styled.span`font-size: 13px; color: #666; overflow-wrap: anywhere;`;
export const Spacer = styled.span`flex: 1;`;
export const Actions = styled.div`display: flex; gap: 8px; align-items: center; flex-wrap: wrap;`;
export const Row = styled.div`display: flex; gap: 8px 12px; align-items: center; flex-wrap: wrap; min-width: 0;`;
export const Grid = styled.div`display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px 24px;`;
export const Name = styled(Mono)`font-weight: 600; overflow-wrap: anywhere; word-break: break-all; min-width: 0;`;
export const Masked = styled.span`font-family: ${(p) => p.theme.font.mono}; color: #999; letter-spacing: 2px;`;
export const List = styled.ul`list-style: none; margin: 0; padding: 0; border-top: 1px solid #eee;`;
export const Item = styled.li`border-bottom: 1px solid #eee; padding: 10px 0; display: flex; flex-direction: column; gap: 8px;`;
export const Card = styled.div`
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 10px; background: #fff; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px; min-width: 0;
`;
export const Cards = styled.div`display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr);
  @media (min-width: ${(p) => p.theme.breakpoint.lg}px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }`;
export const SimpleTable = styled.table`
  width: 100%; border-collapse: collapse; font-size: 13px;
  th { text-align: left; color: ${(p) => p.theme.color.GREY}; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; white-space: nowrap; }
  td { padding: 8px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; overflow-wrap: anywhere; }
`;
export const EnvChips = styled.div`display: flex; gap: 6px; flex-wrap: wrap;`;
export const EnvChip = styled(Mono)`font-size: 12px; padding: 2px 8px; border-radius: 6px; background: #f1f2f5; color: #333; white-space: nowrap;`;
export const Pre = styled.pre`
  margin: 0; padding: 12px 14px; border-radius: 8px; background: #0f1419; color: #d7dde3; font-size: 12.5px; line-height: 1.5;
  overflow: auto; max-height: 360px; font-family: ${(p) => p.theme.font.mono}; white-space: pre-wrap; overflow-wrap: anywhere;
`;

const pulse = keyframes`0%,100% { opacity: 1; } 50% { opacity: .35; }`;
const dotColor = (tone: StatusTone) => (tone === 'ok' ? '#2fa84f' : tone === 'warn' ? '#d6453d' : tone === 'busy' ? '#9aa0a6' : '#cfd3d8');
export const Dot = styled.span<{ $tone: StatusTone; $pulse?: boolean }>`
  display: inline-block; width: 10px; height: 10px; border-radius: 50%; flex: none; background: ${(p) => dotColor(p.$tone)};
  ${(p) => p.$pulse && css`animation: ${pulse} 1.2s ease-in-out infinite;`}
`;
export const Chip = styled.span<{ $tone?: StatusTone }>`
  font-size: 12px; padding: 2px 8px; border-radius: 999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px;
  background: ${(p) => (p.$tone === 'ok' ? '#e8f6ec' : p.$tone === 'warn' ? '#fdeeee' : '#f1f2f5')};
  color: ${(p) => (p.$tone === 'ok' ? '#227a3c' : p.$tone === 'warn' ? '#a33030' : '#555')};
`;

export function StatusDot({ status }: { status: StoreStatus }) {
  const tone = storeStatusTone(status);
  return <Dot $tone={tone} $pulse={tone === 'busy'} aria-hidden />;
}
export function StatusChip({ status }: { status: StoreStatus }) {
  const { t } = useT();
  return <Chip $tone={storeStatusTone(status)}><StatusDot status={status} />{t(`storage.status.${status}`)}</Chip>;
}
export function KindChip({ kind }: { kind: StoreKind }) {
  const { t } = useT();
  return <Chip $tone="muted">{t(`storage.kind.${kind}`)}</Chip>;
}

export type T = ReturnType<typeof useT>['t'];
/** Codes whose node message says more than the sentence for the code does. */
const DETAILED = new Set(['sql_error', 'invalid_request', 'storage_error', 'aindrive_error', 'drive_unauthorized', 'store_attached', 'kind_mismatch', 'binding_taken', 'prefix_taken', 'unknown', 'store_owned_elsewhere', 'checksum_mismatch', 'result_too_large', 'object_too_large']);
/** A refusal as one sentence in the reader's language. */
export function storageErrorText(t: T, err: unknown): string {
  const e = storageApiErrorOf(err);
  const base = t(`storage.err.${e.code}`);
  return e.message && DETAILED.has(e.code) ? `${base} — ${e.message}` : base;
}

export const when = (ms: number | null | undefined) => (ms ? new Date(ms).toLocaleString() : '—');
export const shortSha = (s: string | null | undefined) => (s ? s.slice(0, 12) : '—');
