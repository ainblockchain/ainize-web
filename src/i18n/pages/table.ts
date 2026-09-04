import type { Dict } from '../index';

/**
 * Shared table primitive (components/ui/Table.tsx) — its own file so the console, the network page and the
 * public record can share one dictionary without any workstream editing another's.
 *
 * Finding 96: a wrapper with `overflow-x: auto` and no scrollbar hides its last column with nothing on screen
 * to say so. These strings label the affordance that now says it.
 */
export const tableUi: Dict = {
  'table.scroll.region': { ko: '가로로 넘치는 표 — 좌우로 스크롤할 수 있습니다', en: 'Table wider than the screen — scroll it sideways' },
  'table.scroll.more': { ko: '오른쪽에 열이 더 있습니다', en: 'More columns to the right' },
  'table.scroll.back': { ko: '왼쪽에 열이 더 있습니다', en: 'More columns to the left' },
};
