import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styled from 'styled-components';

/**
 * Finding 80 — the plain-language glossary reached the reader almost entirely through hover-only `title` attributes:
 * 20 of them on the landing page, 28 on /explore, 26 on the knowledge page, carrying the ONLY definitions of
 * "verified knowledge", "facts covered", "accuracy" and the rest. Their carriers were `<abbr>` elements with
 * `cursor: help` and no tabindex, so on a phone and at the keyboard the explanations did not exist at all and what
 * was left on screen was bare jargon.
 *
 * This is the same word with the same sentence, delivered through a real control: a focusable button that opens the
 * definition on click, on focus and on hover, closes on Escape, on blur and on an outside click, and is announced
 * through `aria-describedby` while it is open. `title` is deliberately NOT set — a native tooltip on top of the
 * popover would say the same thing twice.
 */
const Wrap = styled.span`
  position: relative; display: inline-block;
  /* The browse card is a stretched link (finding 81): everything interactive inside it has to sit above the overlay. */
  z-index: 1;
`;
const Trigger = styled.button`
  padding: 0; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: help;
  border-bottom: 1px dotted ${(p) => p.theme.color.LIGHT_GREY};
  &:focus-visible { outline: 2px solid ${(p) => p.theme.color.PRIMARY}; outline-offset: 2px; border-radius: 2px; }
`;
const Bubble = styled.span<{ $dx: number }>`
  position: absolute; left: 0; top: calc(100% + 6px); z-index: 30;
  transform: translateX(${(p) => p.$dx}px);
  display: block; width: max-content; max-width: min(280px, calc(100vw - 32px));
  padding: 8px 10px; border-radius: 6px;
  background: ${(p) => p.theme.color.BLACK}; color: #ffffff;
  font-size: 12px; font-weight: 400; line-height: 1.5; text-align: left; word-break: keep-all;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
  b { display: block; margin-bottom: 2px; font-weight: 700; }
  code { display: block; margin-top: 4px; font-size: 11px; color: #c1acff; }
`;

/**
 * @param text  the plain-language sentence (glossary `help`)
 * @param label optional heading for the bubble (glossary `term`) — the word being defined
 * @param tech  optional technical name for developers (glossary `tech`), the second line of the old tooltip
 */
export function Explain({ text, label, tech, children, ...rest }: {
  text: string; label?: string; tech?: string; children: ReactNode;
} & { 'data-testid'?: string }) {
  const [open, setOpen] = useState(false);
  /**
   * Whether this was opened deliberately (tap, click, keyboard) rather than by the pointer passing over it. A tap on
   * a touch screen synthesises `mouseenter` BEFORE `click`, so a plain toggle opened the bubble and closed it again
   * in the same tap — which is exactly the audience (phones) the finding is about.
   */
  const [pinned, setPinned] = useState(false);
  const [dx, setDx] = useState(0);
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);

  /* Keep the bubble inside the viewport: at 360 px a definition anchored to a word near the right edge would
     otherwise widen the page. `dx` is 0 whenever it is closed, so this always measures an unshifted bubble. */
  useLayoutEffect(() => {
    if (!open || !bubbleRef.current) return;
    const r = bubbleRef.current.getBoundingClientRect();
    const pad = 8;
    if (r.right > window.innerWidth - pad) setDx(Math.round(window.innerWidth - pad - r.right));
    else if (r.left < pad) setDx(Math.round(pad - r.left));
  }, [open]);

  const close = () => { setOpen(false); setDx(0); setPinned(false); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <Wrap ref={wrapRef} onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!pinned) close(); }} {...rest}>
      <Trigger
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); setPinned(true); }}
        onFocus={() => setOpen(true)}
        onBlur={close}
      >
        {children}
      </Trigger>
      {open && (
        <Bubble ref={bubbleRef} id={id} role="tooltip" $dx={dx}>
          {label && <b>{label}</b>}
          {text}
          {tech && <code>{tech}</code>}
        </Bubble>
      )}
    </Wrap>
  );
}
