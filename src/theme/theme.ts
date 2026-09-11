/**
 * Design tokens ported from ainize-web (src/theme/AppColors.js, StyledComponentsTheme.js).
 * Purple primary, Roboto body, Muli/Mulish display on the landing page, Inconsolata for hashes/logs.
 */
export const AppColors = {
  PRIMARY: '#8b3eeb',
  SECONDARY: '#fe6161',
  TERTIARY: '#78d9e9',
  HOVER: '#5b1ca8',
  BLACK: '#303133',
  GREY: '#8d8d8f',
  PALE_GREY: '#f5eefc',
  LIGHT_GREY: '#dadada',
  DARK_GREY: '#333333',
  WHITE: '#ffffff',
  PRESSED: '#c597ff',
  SUCCESS: '#44a45f',
  WARNING: '#f6981d',
  ERROR: '#e6173e',
  // landing / brand
  LANDING_DARK: '#333333',
  LANDING_ACCENT: '#8c6cff',
  LANDING_ACCENT_HOVER: '#7754f6',
  LANDING_ACCENT_ACTIVE: '#6b42ff',
  LANDING_BORDER: '#cdbfff',
  LANDING_BG: '#eeeeee',
  FOOTER: '#452a67',
  BANNER: '#6b3eeb',
  // logs
  LOG_DEBUG: '#828282',
  LOG_INFO: '#333333',
  LOG_WARNING: '#f6981d',
  LOG_ERROR: '#e7711b',
  LOG_CRITICAL: '#d14737',
} as const;

export const theme = {
  color: AppColors,
  layout: {
    maxWidth: '944px',
    maxWidthWide: '1024px',
    maxWidthLanding: '1440px',
  },
  breakpoint: { xs: 0, sm: 600, md: 960, lg: 1280, xl: 1920 },
  // Every stack ends in the Hangul fallbacks index.html already downloads (Noto Sans KR). Mulish and Inconsolata
  // carry no Hangul, so on a host without a system Korean face the landing headings and both hero CTA labels
  // rendered blank while /explore (font.body) was perfect — the stacks, not the webfont, were the gap.
  font: {
    body: "'Roboto', -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    display: "'Mulish', 'Muli', 'Roboto', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    mono: "'Inconsolata', ui-monospace, SFMono-Regular, Menlo, 'Noto Sans KR', monospace",
  },
} as const;

export type AppTheme = typeof theme;

/** Status → colour/label mapping shared by chips, tables and detail pages. */
export const STATUS_META: Record<string, { label: string; color: string; bg: string; hint: string }> = {
  DRAFT: { label: 'Draft', color: '#8d8d8f', bg: '#f2f2f2', hint: 'Local draft — not yet announced to the network' },
  ANNOUNCED: { label: 'Announced', color: '#1b73e8', bg: '#e8f0fe', hint: 'Anchor recorded on the ledger, waiting for verifiers' },
  VERIFYING: { label: 'Verifying', color: '#f6981d', bg: '#fff3e0', hint: 'Attestations arriving — quorum not yet reached' },
  VERIFIED: { label: 'For sale', color: '#44a45f', bg: '#e6f4ea', hint: 'Verification quorum reached — the current version, on sale' },
  REJECTED: { label: 'Rejected', color: '#e6173e', bg: '#fde8ec', hint: 'Failed verification quorum' },
  CHALLENGED: { label: 'Challenged', color: '#d14737', bg: '#fdecea', hint: 'A re-verification challenge is open' },
  // Warning palette (the one KindChip already uses for a supersede record): #8a4b00 on #fff3e0 is 6.4:1, where the
  // old grey-on-grey was 2.96:1 — under AA for 11 px text, and quieter than the green Verified label beside it,
  // so a retired item read as endorsed.
  SUPERSEDED: { label: 'Superseded', color: '#8a4b00', bg: '#fff3e0', hint: 'A newer patch on the same benchmark replaced this one' },
  // The author's own takedown (item 148): not a failure and not a dispute, so it gets the neutral grey rather than
  // the red REJECTED palette — but it is terminal, so it never wears the green VERIFIED one either.
  RETIRED: { label: 'Retired', color: '#5a5a5c', bg: '#f2f2f2', hint: 'The publisher took this knowledge off sale — the record stays, and buyers keep the copy they paid for' },
};
