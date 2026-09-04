/**
 * The on-this-page rail: the page title, then its H2s and H3s, sticky beside the prose.
 *
 * H2 + H3 only, deliberately: huggingface.co/docs/transformers/en/quicktour ships the same rail (`SubSideMenu`,
 * whose entries carry a `depth` and a `#local` anchor) and a rail that lists every heading stops being a map.
 *
 * The active entry is the last heading whose top has passed the reading line, recomputed on scroll behind a
 * `requestAnimationFrame` gate; below 1280px the rail becomes a collapsed summary above the prose instead of
 * stealing width from it (see DocsPage).
 */
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useDocsT } from './i18n';
import type { Heading } from './markdown';

const Wrap = styled.nav`
  font-size: 13px; line-height: 1.5;
  h2 { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: ${(p) => p.theme.color.GREY}; }
  ul { list-style: none; margin: 0; padding: 0; border-left: 1px solid #ececec; }
`;

const Item = styled.li<{ $depth: number; $on: boolean }>`
  a {
    display: block; padding: 5px 0 5px ${(p) => (p.$depth === 3 ? 24 : 12)}px; margin-left: -1px;
    border-left: 2px solid ${(p) => (p.$on ? p.theme.color.PRIMARY : 'transparent')};
    color: ${(p) => (p.$on ? p.theme.color.PRIMARY : p.theme.color.GREY)};
    font-weight: ${(p) => (p.$on ? 600 : 400)};
    text-decoration: none;
    &:hover { color: ${(p) => p.theme.color.BLACK}; }
  }
`;

/** the reading line: a heading counts as current once its top is within this many px of the viewport top */
const LINE = 96;

export function Toc({ headings, title, slug }: { headings: Heading[]; title: string; slug: string }) {
  const { t } = useDocsT();
  const shown = headings.filter((h) => h.depth === 2 || h.depth === 3);
  const [active, setActive] = useState<string>('');

  useEffect(() => {
    setActive('');
    if (shown.length === 0) return undefined;
    let frame = 0;
    const measure = () => {
      frame = 0;
      let current = '';
      for (const h of shown) {
        const el = document.getElementById(h.id);
        if (el && el.getBoundingClientRect().top <= LINE) current = h.id;
      }
      // at the very bottom the last heading is current even if its top never reached the line
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 8) current = shown[shown.length - 1].id;
      setActive(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
    // the rail is rebuilt per page; `slug` is what changes when the reader moves
  }, [slug, shown.length]);

  if (shown.length === 0) return null;
  return (
    <Wrap aria-label={t('docs.toc.label')}>
      <h2>{t('docs.toc.label')}</h2>
      <ul>
        <Item $depth={2} $on={active === ''}>
          <a href="#top" aria-current={active === '' ? 'location' : undefined} onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0 }); history.replaceState(null, '', window.location.pathname); }}>{title}</a>
        </Item>
        {shown.map((h) => (
          <Item key={h.id} $depth={h.depth} $on={active === h.id}>
            <a href={`#${h.id}`} aria-current={active === h.id ? 'location' : undefined}>{h.text}</a>
          </Item>
        ))}
      </ul>
    </Wrap>
  );
}
