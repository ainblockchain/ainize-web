import { useEffect, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';
import { useT } from '@/i18n';

/**
 * Minimal modal sheet / side drawer (no dependency): backdrop, Escape to close, aria-modal. Used by the teach drawer,
 * the credit / preflight / publish / keep-private sheets and the Your-knowledge panel.
 */
const Backdrop = styled.div`
  position: fixed; inset: 0; z-index: 40; background: rgba(48, 49, 51, 0.45); display: flex; justify-content: center; align-items: flex-start; padding: 48px 16px; overflow-y: auto;
  @media (max-width: ${(p) => p.theme.breakpoint.sm}px) { padding: 16px 8px; }
`;
const Panel = styled.section<{ $side?: boolean; $width: number }>`
  width: 100%; max-width: ${(p) => p.$width}px; background: #fff; border: 1px solid ${(p) => p.theme.color.LIGHT_GREY}; border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18); display: flex; flex-direction: column; max-height: calc(100vh - 64px);
  ${(p) => p.$side && `margin-left: auto; margin-right: 0; margin-top: -32px; min-height: calc(100vh - 32px); border-radius: 6px 0 0 6px;`}
`;
const Head = styled.header`
  display: flex; align-items: flex-start; gap: 12px; padding: 20px 24px 12px; border-bottom: 1px solid ${(p) => p.theme.color.LIGHT_GREY};
  h2 { margin: 0; font-size: 18px; font-weight: 700; color: ${(p) => p.theme.color.BLACK}; }
  p { margin: 6px 0 0; font-size: 13px; line-height: 1.5; color: ${(p) => p.theme.color.GREY}; }
`;
const CloseBtn = styled.button`
  margin-left: auto; flex: none; width: 32px; height: 32px; border: 0; border-radius: 16px; background: transparent; font-size: 20px; line-height: 1; color: ${(p) => p.theme.color.GREY}; cursor: pointer;
  &:hover { background: ${(p) => p.theme.color.PALE_GREY}; color: ${(p) => p.theme.color.BLACK}; }
`;
/**
 * Finding 16 — the action bar was an ordinary block at the end of the scrolling body, so on the publish sheet the
 * Publish button and the two consent checkboxes above it sat below the fold (submit bottom 919 in a 900 px viewport,
 * 1135 at 360x740) with nothing on screen to say they were there. The bar is still the last child of the body, so it
 * flows after the content it belongs to, but `position: sticky` pins it to the body's bottom edge at every scroll
 * position. The negative margins let it span the body's padding, so it reaches both edges and the content scrolls
 * under an opaque bar instead of past a floating button.
 */
export const SheetFooter = styled.div`
  /* The three negative margins cancel the body's 24px of side and bottom padding so the bar spans the panel edge to
     edge, and the negative sticky offset moves the sticky line down by the same 24px so the pinned bar sits on the bottom of
     the scrollport rather than 24px above it. Measured: pinned at 883 in a 900 px viewport, and still 883 — flush
     with the body — once the body is scrolled to its end. */
  position: sticky; bottom: -24px; z-index: 1; flex: none;
  margin: 4px -24px -24px; padding: 14px 24px;
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end;
  background: ${(p) => p.theme.color.WHITE};
`;
/** `$more` = the body still has content below the fold; it is what draws the bar's edge and the "keep scrolling" shadow. */
const Body = styled.div<{ $more: boolean }>`
  padding: 16px 24px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; font-size: 14px; line-height: 1.55; color: ${(p) => p.theme.color.BLACK};
  & > ${SheetFooter} {
    border-top: 1px solid ${(p) => (p.$more ? p.theme.color.LIGHT_GREY : 'transparent')};
    box-shadow: ${(p) => (p.$more ? '0 -10px 16px -12px rgba(0, 0, 0, 0.4)' : 'none')};
  }
`;
export const SheetNote = styled.p`margin: 0; font-size: 12px; line-height: 1.5; color: ${(p) => p.theme.color.GREY};`;

export interface SheetProps {
  title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; side?: boolean; width?: number; testId?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

export function Sheet({ title, sub, onClose, children, side, width = 560, testId }: SheetProps) {
  const { t } = useT();
  const panel = useRef<HTMLElement | null>(null);
  const body = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  /**
   * Whether anything is still below the fold. Recomputed on scroll, on a resize of the body, and on any change to
   * what is inside it — a validation message, an unfolded option or a freshly rendered list all change the answer.
   */
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const update = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update); ro.observe(el);
    const mo = new MutationObserver(update); mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { el.removeEventListener('scroll', update); ro.disconnect(); mo.disconnect(); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  /**
   * `aria-modal` promises the rest of the page is out of reach, and this dialog was not keeping that promise: focus
   * stayed on the button behind it, Tab walked back out into the page, and closing left focus nowhere. Move focus in,
   * keep Tab inside, and give it back to whatever opened the sheet.
   */
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) return;
      const edge = e.shiftKey ? items[0] : items[items.length - 1];
      if (document.activeElement === edge || !panel.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
      }
    };
    document.addEventListener('keydown', onTab);
    return () => { document.removeEventListener('keydown', onTab); if (opener?.isConnected) opener.focus(); };
  }, []);
  return (
    <Backdrop onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} $side={side} $width={width} data-testid={testId}>
        <Head>
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <CloseBtn type="button" onClick={onClose} aria-label={t('teach.drawer.close')}>×</CloseBtn>
        </Head>
        <Body ref={body} $more={more}>{children}</Body>
      </Panel>
    </Backdrop>
  );
}
