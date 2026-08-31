import styled, { keyframes } from 'styled-components';
import type { ReactNode } from 'react';

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
  label { display: inline-flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
  input { width: 18px; height: 18px; accent-color: #8b3eeb; }
`;

export const TERMINAL_STATUSES = new Set(['LISTED', 'REJECTED', 'SUPERSEDED', 'DRAFT']);
export const isInFlight = (status: string) => !TERMINAL_STATUSES.has(status);
