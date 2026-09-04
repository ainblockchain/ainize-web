import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';

/** Table primitives ported from ainize-web components/ui/table/Table.js */

/**
 * Finding 96 — a table that is wider than its column scrolls, and until now said nothing about it. On /dashboard the
 * wrapper is 1024 px wide over 1191 px of table, so `Manage` (the per-item console link) sits 167 px past the right
 * edge with no scrollbar, no gradient and no hint; /network hides `Last seen` the same way as soon as a node has a
 * long name. The wrapper now measures itself and, only while something really is out of view, fades the edge, offers
 * a button that scrolls a screenful, and names the direction for a screen reader. Nothing changes for a table that fits.
 */
const Shell = styled.div`
  position: relative; width: 100%;
`;
const Scroller = styled.div`
  width: 100%; overflow-x: auto; scroll-behavior: smooth;
  &:focus-visible { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 2px; }
`;
const Fade = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute; top: 0; bottom: 0; ${(p) => p.$side}: 0; width: 44px; pointer-events: none; z-index: 2;
  background: linear-gradient(to ${(p) => p.$side}, #ffffff 10%, rgba(255, 255, 255, 0));
`;
const Nudge = styled.button<{ $side: 'left' | 'right' }>`
  position: absolute; top: 12px; ${(p) => p.$side}: 4px; z-index: 3;
  display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0;
  border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 50%; background: #ffffff; cursor: pointer;
  color: ${(p) => p.theme.color.PRIMARY}; font-size: 13px; line-height: 1;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; }
`;

export function TableWrapper({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const right = el.scrollWidth - el.clientWidth - el.scrollLeft > 2;
    const left = el.scrollLeft > 2;
    setEdge((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // the table grows when rows arrive and shrinks when the window narrows — both change what is out of view
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => { el.removeEventListener('scroll', measure); ro.disconnect(); };
  }, [measure, children]);

  const nudge = (dir: -1 | 1) => { const el = ref.current; if (el) el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.7), behavior: 'smooth' }); };
  const scrollable = edge.left || edge.right;

  return (
    <Shell style={style} className={className}>
      <Scroller
        ref={ref}
        tabIndex={scrollable ? 0 : -1}
        role={scrollable ? 'region' : undefined}
        aria-label={scrollable ? t('table.scroll.region') : undefined}
        data-scroll-right={edge.right ? 'true' : 'false'}
      >
        {children}
      </Scroller>
      {edge.left && <><Fade $side="left" aria-hidden /><Nudge $side="left" type="button" onClick={() => nudge(-1)} aria-label={t('table.scroll.back')} title={t('table.scroll.back')}>‹</Nudge></>}
      {edge.right && <><Fade $side="right" aria-hidden /><Nudge $side="right" type="button" onClick={() => nudge(1)} aria-label={t('table.scroll.more')} title={t('table.scroll.more')}>›</Nudge></>}
    </Shell>
  );
}

export const Table = styled.table`
  width: 100%; border-collapse: collapse;
`;

export const TableHeader = styled.thead``;
export const TableBody = styled.tbody`
  background-color: #ffffff;
`;

export const TableRow = styled.tr`
  height: 50px; background-color: #ffffff;
`;

export const TableRowEmpty = styled.tr<{ $height?: number }>`
  height: ${(p) => p.$height ?? 160}px; background-color: #ffffff;
  td { text-align: center; color: ${(p) => p.theme.color.GREY}; font-size: 14px; }
`;

export const TableHead = styled.th<{ $align?: 'left' | 'center' | 'right'; $padding?: string }>`
  position: sticky; top: 0; z-index: 1;
  padding: ${(p) => p.$padding ?? '0 8px'};
  font-size: 14px; font-weight: 400;
  text-align: ${(p) => p.$align ?? 'center'};
  user-select: none; white-space: nowrap;
  background-color: #ffffff;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  color: ${(p) => p.theme.color.GREY};
`;

export const TableData = styled.td<{ $align?: 'left' | 'center' | 'right'; $padding?: string; $maxWidth?: string; $weight?: number; $color?: string; $mono?: boolean }>`
  max-width: ${(p) => p.$maxWidth ?? '240px'};
  padding: ${(p) => p.$padding ?? '0 8px'};
  font-size: 14px;
  text-align: ${(p) => p.$align ?? 'center'};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-weight: ${(p) => p.$weight ?? 400};
  font-family: ${(p) => (p.$mono ? p.theme.font.mono : 'inherit')};
  color: ${(p) => p.$color ?? p.theme.color.BLACK};
  border-bottom: 1px solid #f4f4f4;
`;

export const SubText = styled.div`
  margin-top: 4px; font-size: 12px; font-weight: 500; color: ${(p) => p.theme.color.GREY};
  overflow: hidden; text-overflow: ellipsis;
`;
