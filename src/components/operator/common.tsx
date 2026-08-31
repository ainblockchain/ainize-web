import styled, { keyframes } from 'styled-components';
import type { CSSProperties, ReactNode } from 'react';
import { useT } from '@/i18n';

/** Small inline spinner (ainize used MUI CircularProgress size=16 next to "Deploying…"). */
const spin = keyframes`to { transform: rotate(360deg); }`;
export const SmallSpinner = styled.span`
  display: inline-block; width: 14px; height: 14px; border-radius: 50%; flex: none;
  border: 2px solid #8b3eeb; border-right-color: transparent; animation: ${spin} 0.8s linear infinite;
`;

export const Row = styled.div<{ $gap?: number; $wrap?: boolean; $align?: string; $justify?: string }>`
  display: flex; flex-direction: row; align-items: ${(p) => p.$align ?? 'center'}; justify-content: ${(p) => p.$justify ?? 'flex-start'};
  gap: ${(p) => p.$gap ?? 12}px; flex-wrap: ${(p) => (p.$wrap === false ? 'nowrap' : 'wrap')};
`;

export const Stack = styled.div<{ $gap?: number }>`
  display: flex; flex-direction: column; gap: ${(p) => p.$gap ?? 12}px;
`;

export const SectionBody = styled.div`
  margin-top: 16px;
`;

export const ExternalRow = styled.div`
  display: flex; flex-direction: row; align-items: baseline; gap: 12px; margin-top: 8px; font-size: 14px; flex-wrap: wrap;
`;

export const ExternalTitle = styled.span`
  min-width: 96px; color: ${(p) => p.theme.color.GREY};
`;

export const ExternalAnchor = styled.a<{ $disabled?: boolean; $color?: string }>`
  color: ${(p) => (p.$disabled ? p.theme.color.LIGHT_GREY : p.$color ?? p.theme.color.PRIMARY)}; text-decoration: none; word-break: break-all;
  pointer-events: ${(p) => (p.$disabled ? 'none' : 'auto')};
  &:hover { text-decoration: underline; }
`;

export const StatusText = styled.span`
  display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${(p) => p.theme.color.GREY};
`;

export const IconButton = styled.button`
  display: inline-flex; align-items: center; justify-content: center; padding: 6px; border: 0; background: transparent; cursor: pointer; border-radius: 4px;
  &:hover { background: #f5eefc; }
  &:disabled { cursor: not-allowed; opacity: 0.4; }
`;

export const Pre = styled.pre`
  margin: 0; padding: 12px 16px; background: #f7f7f7; border: 1px solid #eee; border-radius: 4px; font-size: 12px; line-height: 1.5;
  overflow-x: auto; white-space: pre-wrap; word-break: break-all; max-height: 420px; overflow-y: auto;
`;

export const MonoBox = styled.div`
  padding: 12px 16px; background: #f7f7f7; border: 1px solid #eee; border-radius: 4px; font-family: ${(p) => p.theme.font.mono}; font-size: 12px; line-height: 1.5; word-break: break-all;
`;

export const Muted = styled.span`
  color: ${(p) => p.theme.color.GREY}; font-size: 13px;
`;

export const Checklist = styled.ul`
  margin: 12px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; font-size: 14px;
  li { display: flex; align-items: center; gap: 8px; }
`;

export const Check = styled.span<{ $ok: boolean }>`
  display: inline-flex; width: 16px; height: 16px; border-radius: 50%; align-items: center; justify-content: center; font-size: 10px; color: #fff;
  background: ${(p) => (p.$ok ? p.theme.color.SUCCESS : p.theme.color.LIGHT_GREY)};
`;

export function CheckItem({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (<li><Check $ok={ok} aria-hidden>{ok ? '✓' : ''}</Check><span>{children}</span></li>);
}

export const RadioGroup = styled.div`
  display: flex; flex-direction: column; gap: 8px; margin-top: 12px;
  label { display: inline-flex; align-items: flex-start; gap: 10px; font-size: 14px; cursor: pointer; line-height: 1.4; }
  input { width: 18px; height: 18px; flex: none; margin-top: 1px; accent-color: #8b3eeb; }
`;

export const TERMINAL_STATUSES = new Set(['LISTED', 'REJECTED', 'SUPERSEDED', 'DRAFT']);
export const isInFlight = (status: string) => !TERMINAL_STATUSES.has(status);

// ------------------------------------------------------------------ plain-language helpers (operator pages)

/** A plain label with the technical name in a tooltip (dotted underline signals "hover for the developer term"). */
const TipSpan = styled.span`
  text-decoration: underline dotted; text-underline-offset: 3px; text-decoration-color: #c4a6ee; cursor: help;
`;
export function Tip({ tech, children }: { tech: string; children: ReactNode }) {
  return <TipSpan title={tech}>{children}</TipSpan>;
}

/** Clearly labelled box for node-operator / developer material (CLI commands, raw JSON, protocol names). */
const DevBoxWrap = styled.section`
  margin-top: 24px; padding: 14px 16px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY}; background: #fcfcfd; border-radius: 4px;
`;
const DevBoxTitle = styled.div`
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${(p) => p.theme.color.GREY};
  &::before { content: '</>'; font-family: ${(p) => p.theme.font.mono}; font-size: 11px; padding: 1px 6px; border-radius: 3px; background: #ececef; color: #5b1ca8; }
`;
export function DevBox({ title, children, style }: { title?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  const { audience } = useT();
  return (
    <DevBoxWrap style={style}>
      <DevBoxTitle title={audience('operator').help}>{title ?? audience('operator').title}</DevBoxTitle>
      {children}
    </DevBoxWrap>
  );
}

/** Speech-bubble icon for the "라이브 테스트" (live test) link — Icons.tsx is shared, so it lives here. */
export function LiveTestIcon({ width = 16, height = 16, fill = '#8b3eeb' }: { width?: number; height?: number; fill?: string }) {
  return (
    <svg width={width} height={height} viewBox="0 0 24 24" fill={fill} aria-hidden>
      <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 5v2h10V9H7zm0 3v2h7v-2H7z" />
    </svg>
  );
}

/**
 * Money formatting that never prints a bare "2.5 CREDIT": "2.5 AIN" / "2.5 노드 크레딧", plus a one-line note explaining the unit.
 */
export function useMoney() {
  const { t, term } = useT();
  const unit = (currency?: string | null): string => (currency === 'AIN' ? 'AIN' : currency === 'CREDIT' ? term('credit') : currency ?? '');
  const fmt = (amount?: string | number | null, currency?: string | null): string => {
    if (amount === undefined || amount === null || amount === '') return '—';
    const n = Number(amount);
    if (Number.isNaN(n)) return String(amount);
    if (n === 0) return t('common.free');
    return `${n.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${unit(currency)}`.trim();
  };
  /** Earned amounts: a zero reads "0 AIN", never "Free" (that word belongs to prices). */
  const revenue = (amount?: string | number | null, currency?: string | null): string => {
    const n = Number(amount ?? 0);
    return !Number.isFinite(n) || n <= 0 ? `0 ${unit(currency)}`.trim() : fmt(n, currency);
  };
  const note = (currency?: string | null): string => (currency === 'AIN' ? t('price.ain_note') : currency === 'CREDIT' ? t('price.credit_note') : '');
  return { unit, fmt, revenue, note };
}

/** Locale-aware "n minutes ago" — shared implementation lives in utils/useFormat (also used by the visitor teach UI). */
export { useElapsed } from '@/utils/useFormat';
