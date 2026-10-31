import type { ReactNode } from 'react';
import { Link } from 'react-router';
import styled, { keyframes } from 'styled-components';
import { STATUS_META } from '@/theme/theme';
import { useT } from '@/i18n';
import { ArrowLeftIcon, ArrowRightIcon, CertifiedIcon } from './Icons';
import { useClipboardCopy } from '@/hooks/useClipboardCopy';

// ------------------------------------------------------------------ page scaffolding
/** huggingface.co's `container`: full width, capped, with a 16 px gutter at every width — the header and footer share it. */
export const PageWrapper = styled.div<{ $wide?: boolean }>`
  width: 100%; box-sizing: border-box;
  max-width: ${(p) => (p.$wide ? p.theme.layout.maxWidthWide : p.theme.layout.maxWidth)};
  padding: 32px ${(p) => p.theme.layout.gutter};
`;

/**
 * The card grid every listing uses — huggingface.co's `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`.
 * `minmax(0, 1fr)` so a long model id or repository name shrinks the cell instead of widening the row.
 */
export const CardGrid = styled.div`
  display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr);
  @media (min-width: ${(p) => p.theme.breakpoint.sm}px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (min-width: ${(p) => p.theme.breakpoint.lg}px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (min-width: ${(p) => p.theme.breakpoint.xl}px) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
`;

export const TitleRow = styled.div`
  display: flex; flex-direction: row; align-items: center; gap: 16px; flex-wrap: wrap;
  padding: 0 0 24px;
`;

export const Title = styled.h1`
  flex: 1; margin: 0; font-size: 32px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
`;

/** Section tabs provide the visible title; retain a heading for assistive navigation without taking space. */
export const SectionTitle = styled.h1`
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0;
`;

export const SubTitle = styled.h2<{ $mt?: number }>`
  margin: ${(p) => p.$mt ?? 56}px 0 0; font-size: 20px; font-weight: 700; color: ${(p) => p.theme.color.BLACK};
`;

export const Description = styled.p`
  margin: 12px 0 0; font-size: 14px; line-height: 1.6; color: ${(p) => p.theme.color.GREY}; max-width: 72ch;
`;

export const Card = styled.div`
  background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; padding: 24px 32px;
`;

export const Divider = styled.hr`
  border: 0; border-top: 1px solid rgba(0, 0, 0, 0.12); margin: 0; width: 100%;
`;

export const Mono = styled.span`
  font-family: ${(p) => p.theme.font.mono}; font-size: 0.95em; word-break: break-all;
`;

export const StyledLink = styled(Link)`
  color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; font-weight: inherit;
  &:hover { border-bottom: 1px solid ${(p) => p.theme.color.PRIMARY}; }
`;

export const ExternalLink = styled.a`
  color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none;
  &:hover { text-decoration: underline; }
`;

/**
 * Item 295 — `word-break: break-all` against a max-content label column left the value column ~130 px wide at
 * 360 px, so the money line of the knowledge page read "pay o / nce per download" and "developm / ent play money":
 * every word broken mid-word, on the device most visitors use. `overflow-wrap: anywhere` breaks a token only when
 * it cannot fit on a line of its own — a hash or a gateway URL still wraps, an English sentence no longer does —
 * and below the phone breakpoint the pairs stack, which gives the value the full width instead of a third of it.
 */
export const KeyValue = styled.dl`
  display: grid; grid-template-columns: max-content 1fr; gap: 8px 24px; margin: 16px 0 0; font-size: 14px;
  dt { color: ${(p) => p.theme.color.GREY}; }
  dd { margin: 0; color: ${(p) => p.theme.color.BLACK}; word-break: normal; overflow-wrap: anywhere; }
  @media (max-width: 479px) {
    grid-template-columns: 1fr; gap: 2px 0;
    dt { margin-top: 10px; font-size: 12px; }
    dt:first-of-type { margin-top: 0; }
  }
`;

// ------------------------------------------------------------------ status chip
const Chip = styled.span<{ $color: string; $bg: string }>`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap;
  color: ${(p) => p.$color}; background: ${(p) => p.$bg};
`;

const Dot = styled.span<{ $color: string; $pulse?: boolean }>`
  width: 6px; height: 6px; border-radius: 50%; background: ${(p) => p.$color};
  ${(p) => p.$pulse && 'animation: kmPulse 1.2s ease-in-out infinite;'}
  @keyframes kmPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
`;

/** `supersededBy` names the successor in the chip itself ("Newer version: krx-all-2761") instead of the bare "Newer version available". */
export function StatusChip({ status, title, supersededBy, bodyAvailable }: { status: string; title?: string; supersededBy?: string; bodyAvailable?: boolean | null }) {
  const { t, help } = useT();
  if (bodyAvailable === false) return <Chip $color="#8a4b00" $bg="#fff4e5" title={t('status.UNAVAILABLE_help')}>{t('status.UNAVAILABLE')}</Chip>;
  const m = STATUS_META[status] ?? { label: status, color: '#8d8d8f', bg: '#f2f2f2', hint: '' };
  const label = status === 'SUPERSEDED' && supersededBy
    ? t('status.SUPERSEDED_by', { id: supersededBy })
    : t(`status.${status}`) === `status.${status}` ? m.label : t(`status.${status}`);
  // VERIFIED is a LISTING state ("the current version, on sale"), not the verification badge beside it — the tooltip
  // says both so the two words on one row cannot be read as a duplicate (finding 29).
  const hint = status === 'VERIFIED' ? t('status.VERIFIED_help') : status === 'VERIFYING' || status === 'ANNOUNCED' ? help('verifying')
    : status === 'SUPERSEDED' ? help('superseded') : status === 'RETIRED' ? t('status.RETIRED_help') : m.hint;
  return (<Chip $color={m.color} $bg={m.bg} title={title ?? hint}><Dot $color={m.color} $pulse={status === 'VERIFYING' || status === 'ANNOUNCED'} />{label}</Chip>);
}

export function Certified({ label = 'Verified' }: { label?: string }) {
  return (<CertifiedLabel>{label}<CertifiedIcon /></CertifiedLabel>);
}
const CertifiedLabel = styled.span`
  display: inline-flex; align-items: center; gap: 3px; margin-left: 8px; font-size: 12px; font-weight: 500; color: ${(p) => p.theme.color.PRIMARY};
`;

// ------------------------------------------------------------------ loading
const shimmer = keyframes`from { background-position: -472px 0; } to { background-position: 472px 0; }`;
export const Shimmer = styled.div<{ $w?: string; $h?: string }>`
  display: inline-block; width: ${(p) => p.$w ?? '100%'}; height: ${(p) => p.$h ?? '16px'}; border-radius: 4px;
  background: #ebebeb linear-gradient(90deg, #ebebeb 0%, #dbdbdb 50%, #ebebeb 100%); background-size: 944px 100%;
  animation: ${shimmer} 1s linear infinite;
`;

const fade = keyframes`0%, 39%, 100% { opacity: 0.2; } 40% { opacity: 1; }`;
const FadeWrap = styled.div`
  display: inline-block; position: relative; width: 44px; height: 44px;
  span { position: absolute; left: 20px; top: 0; width: 4px; height: 12px; border-radius: 2px; background: #8b3eeb; transform-origin: 2px 22px; animation: ${fade} 1.2s linear infinite; }
`;
/** FadeLoader look-alike (ainize CircularProgress used react-spinners FadeLoader). */
export function Spinner({ label }: { label?: string }) {
  return (
    <SpinnerRow role="status" aria-label={label ?? 'loading'}>
      <FadeWrap>{Array.from({ length: 8 }).map((_, i) => <span key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${i * 0.15 - 1.2}s` }} />)}</FadeWrap>
      {label && <span>{label}</span>}
    </SpinnerRow>
  );
}
const SpinnerRow = styled.div`
  display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 120px; color: ${(p) => p.theme.color.GREY}; font-size: 14px;
`;

export function CenterProgress() {
  return (<Center><Spinner /></Center>);
}
const Center = styled.div`display: flex; align-items: center; justify-content: center; min-height: 160px; width: 100%;`;

// ------------------------------------------------------------------ select box (ainize SelectBox)
export interface SelectOption { value: string; label: string; disabled?: boolean }
const SelWrap = styled.label`
  display: inline-flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%;
  & > span { min-width: 0; overflow-wrap: anywhere; font-size: 14px; color: ${(p) => p.theme.color.GREY}; }
`;
const SelControl = styled.select`
  min-width: 0; max-width: 100%; min-height: 40px; padding: 6px 8px; border: 1px solid transparent;
  border-radius: 4px; background-color: #fff; color: ${(p) => p.theme.color.GREY}; font: inherit; font-size: 14px;
  cursor: pointer; text-overflow: ellipsis;
  &:hover:not(:disabled) { border-color: ${(p) => p.theme.color.LIGHT_GREY}; }
  &:focus-visible { outline: 2px solid #5b3df5; outline-offset: 2px; }
  &:disabled { cursor: default; opacity: .65; }
`;

/** Native selection provides keyboard/typeahead and the platform's touch picker without hidden focus targets. */
export function SelectBox({ options, value, onChange, prefix, label }: { options: SelectOption[]; value: string; onChange: (v: string) => void; prefix?: string; label?: string }) {
  const { t } = useT();
  const current = options.find((o) => o.value === value);
  const unavailable = !options.some((o) => !o.disabled);
  return (
    <SelWrap>
      {prefix && <span>{prefix}</span>}
      <SelControl value={value} disabled={unavailable} aria-label={label ?? prefix ?? t('common.select_option')}
        onChange={(event) => {
          const next = options.find((o) => o.value === event.target.value);
          if (next && !next.disabled && next.value !== value) onChange(next.value);
        }}>
        {!current && <option value={value} disabled>{value ? t('common.selection_unavailable') : t('common.select_option')}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </SelControl>
    </SelWrap>
  );
}

// ------------------------------------------------------------------ pagination (ainize Pagination)
const PagWrap = styled.div`display: flex; align-items: center; justify-content: center; width: 100%; padding: 16px 0; border-top: 1px solid #f4f4f4;`;
const PagBtn = styled.button<{ $active?: boolean }>`
  height: 32px; margin: 0 4px; padding: 2px 6px 0; border-radius: 6px; border: 1px solid #dadada; background: #fff; font-size: 12px; cursor: pointer;
  color: ${(p) => (p.$active ? p.theme.color.BLACK : p.theme.color.LIGHT_GREY)}; transition: border-color 0.3s ease;
  &:hover { border-color: #5b1ca8; } &:active { border-color: #8b3eeb; } &:disabled { cursor: default; }
`;
const PagText = styled.div`width: 96px; margin: 0 20px; font-size: 14px; text-align: center; color: ${(p) => p.theme.color.GREY};`;

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (p: number) => void }) {
  const { t } = useT();
  const total = Math.max(1, pageCount);
  return (
    <PagWrap>
      <PagBtn $active={page > 1} disabled={page <= 1} onClick={() => onChange(1)} style={{ padding: '0 10px' }}>{t('common.first')}</PagBtn>
      <PagBtn $active={page > 1} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="previous"><ArrowLeftIcon fill={page > 1 ? '#303133' : '#dadada'} /></PagBtn>
      <PagText>{page} / {total}</PagText>
      <PagBtn $active={page < total} disabled={page >= total} onClick={() => onChange(page + 1)} aria-label="next"><ArrowRightIcon fill={page < total ? '#303133' : '#dadada'} /></PagBtn>
      <PagBtn $active={page < total} disabled={page >= total} onClick={() => onChange(total)} style={{ padding: '0 10px' }}>{t('common.last')}</PagBtn>
    </PagWrap>
  );
}

// ------------------------------------------------------------------ tabs (MUI-like)
const TabsRow = styled.div`display: flex; gap: 16px; border-bottom: 1px solid rgba(0, 0, 0, 0.12); overflow-x: auto;`;
const TabBtn = styled.button<{ $active: boolean }>`
  padding: 12px 4px; border: 0; background: transparent; cursor: pointer; font-size: 16px; font-weight: 700; white-space: nowrap;
  color: ${(p) => (p.$active ? '#000' : p.theme.color.GREY)}; border-bottom: 2px solid ${(p) => (p.$active ? p.theme.color.PRIMARY : 'transparent')}; margin-bottom: -1px;
  &:hover { color: #000; }
`;
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: ReactNode }[]; value: string; onChange: (id: string) => void }) {
  return (<TabsRow role="tablist">{tabs.map((t) => <TabBtn key={t.id} role="tab" aria-selected={t.id === value} $active={t.id === value} onClick={() => onChange(t.id)}>{t.label}</TabBtn>)}</TabsRow>);
}

// ------------------------------------------------------------------ copy button
export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useT();
  const copy = useClipboardCopy(text);
  return (
    <CopyWrap>
      <CopyBtn type="button" disabled={copy.disabled} aria-busy={copy.phase === 'copying'} aria-live="polite" onClick={() => void copy.copy()}>
        {copy.phase === 'copied' ? t('common.copied') : copy.phase === 'copying' ? t('common.copying') : (label ?? t('common.copy_clipboard'))}
      </CopyBtn>
      {copy.phase === 'failed' && <span role="alert">{t('common.copy_failed')}</span>}
    </CopyWrap>
  );
}
const CopyWrap = styled.span`display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px; max-width: 100%; min-width: 0; & > [role="alert"] { font-size: 12px; color: #b42318; overflow-wrap: anywhere; }`;
const CopyBtn = styled.button`
  padding: 5px 14px; border: 1px solid #8b3eeb80; border-radius: 4px; background: #fff; color: #8b3eeb; font-size: 13px; font-weight: 500; cursor: pointer;
  &:hover { border-color: #8b3eeb; background: #8b3eeb0f; }
  &:disabled { cursor: not-allowed; opacity: 0.5; }
`;

// ------------------------------------------------------------------ progress bar (score)
const BarWrap = styled.div`width: 100%; height: 6px; border-radius: 3px; background: #eee; overflow: hidden;`;
const BarFill = styled.div<{ $pct: number; $color: string }>`height: 100%; width: ${(p) => p.$pct}%; background: ${(p) => p.$color}; transition: width 0.4s ease;`;
export function ScoreBar({ pct, color = '#44a45f' }: { pct: number; color?: string }) {
  return (<BarWrap><BarFill $pct={Math.max(0, Math.min(100, pct))} $color={color} /></BarWrap>);
}

// ------------------------------------------------------------------ empty state
export const Empty = styled.div`
  padding: 48px 16px; text-align: center; color: ${(p) => p.theme.color.GREY}; font-size: 14px; border: 1px dashed ${(p) => p.theme.color.LIGHT_GREY};
`;
