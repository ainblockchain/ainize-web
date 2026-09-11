/**
 * Token tree to React elements, in Ainize's own type scale and colours.
 *
 * Nothing here builds an HTML string, so there is no `dangerouslySetInnerHTML` and no sanitizer: a `description`
 * interpolated into a generated reference page cannot become markup.
 *
 * Two conventions worth naming, both taken from how huggingface.co/docs behaves rather than how it looks:
 * every heading carries a stable id and a hover `#` link (`<h2 class="relative group"><a id="set-up" href="#set-up">`
 * on huggingface.co/docs/transformers/en/quicktour), and a task with two routes is one page with an option switcher
 * rather than two pages (their `hfoptions` pill row on huggingface.co/docs/transformers/en/installation).
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import styled from 'styled-components';
import { useDocsT } from './i18n';
import { CodeBlock } from './CodeBlock';
import type { AlertKind, Block, Inline, ListItem } from './markdown';
import { resolveDocHref, type LinkCtx } from './docsTree';
export type { LinkCtx } from './docsTree';
export { resolveDocHref } from './docsTree';

/* ------------------------------------------------------------------ prose styles
   `65ch` keeps a line of body text near sixty-five characters whatever the viewport does; code blocks and tables
   stay full column width because they scroll rather than wrap.

   `overflow-wrap: break-word` is load-bearing on a phone, and the generated reference is what proves it: an option
   description like `comma list: DRAFT,ANNOUNCED,VERIFYING,VERIFIED,REJECTED,CHALLENGED,SUPERSEDED` is one unbreakable
   60-character token, and `max-width` cannot hold a word that has nowhere to break. Without this, that one list item
   pushed `/docs/reference/cli` to 575px inside a 360px viewport and the whole page — sidebar, header and all —
   scrolled sideways. It breaks only words that would otherwise overflow, so ordinary prose is unaffected, and code
   in a table still refuses to break because the table scrolls instead. */
export const Prose = styled.article`
  min-width: 0;
  overflow-wrap: break-word;
  color: ${(p) => p.theme.color.DARK_GREY};
  font-size: 15px;
  line-height: 1.75;

  p, ul, ol, blockquote { max-width: 65ch; }
  p { margin: 16px 0; }
  strong { color: ${(p) => p.theme.color.BLACK}; font-weight: 600; }
  ul, ol { margin: 16px 0; padding-left: 24px; }
  li { margin: 6px 0; }
  li > ul, li > ol { margin: 6px 0; }
  code { font-family: ${(p) => p.theme.font.mono}; font-size: 0.88em; padding: 1px 5px; border-radius: 4px;
    background: ${(p) => p.theme.color.PALE_GREY}; color: ${(p) => p.theme.color.HOVER}; word-break: break-word; }
  pre code { padding: 0; background: none; color: inherit; }
  hr { border: 0; border-top: 1px solid rgba(0, 0, 0, 0.1); margin: 32px 0; }
  a { color: ${(p) => p.theme.color.PRIMARY}; text-decoration: none; }
  a:hover { text-decoration: underline; }
`;

const H = styled.h2<{ $depth: number }>`
  position: relative;
  margin: ${(p) => (p.$depth === 1 ? '0 0 12px' : p.$depth === 2 ? '40px 0 12px' : '28px 0 8px')};
  font-size: ${(p) => (p.$depth === 1 ? 32 : p.$depth === 2 ? 22 : p.$depth === 3 ? 17 : 15)}px;
  font-weight: 700; line-height: 1.3; color: ${(p) => p.theme.color.BLACK};
  scroll-margin-top: 84px;
  /* the glyph is CSS content and the link is aria-hidden, so "# Ainize" is never the heading's text or its
     accessible name; every H2/H3 is still reachable by keyboard from the on-this-page rail */
  a.anchor { position: absolute; left: -0.85em; width: 0.85em; opacity: 0; text-decoration: none;
    color: ${(p) => p.theme.color.GREY}; font-weight: 400; }
  a.anchor::before { content: '#'; }
  &:hover a.anchor { opacity: 1; }
  @media (max-width: 960px) { a.anchor { display: none; } }
`;

const Quote = styled.blockquote<{ $tone: string }>`
  margin: 20px 0; padding: 12px 16px; border-left: 3px solid ${(p) => p.$tone};
  background: ${(p) => p.$tone}0f; border-radius: 0 6px 6px 0;
  p:first-child { margin-top: 0; } p:last-child { margin-bottom: 0; }
`;
const QuoteLabel = styled.p`
  margin: 0 0 4px !important; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase;
`;

const TableWrap = styled.div`overflow-x: auto; margin: 20px 0;`;
const Table = styled.table`
  border-collapse: collapse; width: 100%; font-size: 14px;
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #ececec; vertical-align: top; }
  th { font-weight: 600; color: ${(p) => p.theme.color.BLACK}; border-bottom: 1px solid rgba(0, 0, 0, 0.16); white-space: nowrap; }
  td { color: ${(p) => p.theme.color.DARK_GREY}; }
  /* a command, a flag or a path is one token: it breaks the reading, not the line. The table scrolls instead. */
  th > code, td > code { white-space: nowrap; }
`;

const TabRow = styled.div`display: flex; flex-wrap: wrap; gap: 6px; margin: 20px 0 0;`;
const TabBtn = styled.button<{ $on: boolean }>`
  padding: 5px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
  border: 1px solid ${(p) => (p.$on ? p.theme.color.PRIMARY : p.theme.color.LIGHT_GREY)};
  background: ${(p) => (p.$on ? p.theme.color.PRIMARY : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : p.theme.color.GREY)};
  &:hover { color: ${(p) => (p.$on ? '#fff' : p.theme.color.BLACK)}; border-color: ${(p) => p.theme.color.PRIMARY}; }
`;
const TabPanel = styled.div`
  padding: 4px 0 0;
  > *:first-child { margin-top: 12px; }
`;

const ALERT_TONE: Record<AlertKind, string> = {
  NOTE: '#1b73e8', TIP: '#44a45f', IMPORTANT: '#8b3eeb', WARNING: '#f6981d', CAUTION: '#e6173e',
};

/* ------------------------------------------------------------------ links */

function Inlines({ nodes, ctx }: { nodes: Inline[]; ctx: LinkCtx }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.t === 'text') return <span key={i}>{n.v}</span>;
        if (n.t === 'code') return <code key={i}>{n.v}</code>;
        if (n.t === 'strong') return <strong key={i}><Inlines nodes={n.c} ctx={ctx} /></strong>;
        if (n.t === 'em') return <em key={i}><Inlines nodes={n.c} ctx={ctx} /></em>;
        const r = resolveDocHref(n.href, ctx);
        if (r.kind === 'external') return <a key={i} href={r.to} target="_blank" rel="noopener noreferrer"><Inlines nodes={n.c} ctx={ctx} /></a>;
        if (r.kind === 'anchor' || r.kind === 'file') return <a key={i} href={r.to}><Inlines nodes={n.c} ctx={ctx} /></a>;
        return <Link key={i} to={r.to}><Inlines nodes={n.c} ctx={ctx} /></Link>;
      })}
    </>
  );
}

function Items({ items, ctx }: { items: ListItem[]; ctx: LinkCtx }) {
  return (
    <>
      {items.map((it, i) => (
        <li key={i}>
          <Inlines nodes={it.c} ctx={ctx} />
          {it.sub && (it.sub.ordered
            ? <ol><Items items={it.sub.items} ctx={ctx} /></ol>
            : <ul><Items items={it.sub.items} ctx={ctx} /></ul>)}
        </li>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ the CLI-or-browser switcher */

const TAB_KEY = 'ainize.docs.tab';

function OptionTabs({ panels, ctx }: { panels: { label: string; c: Block[] }[]; ctx: LinkCtx }) {
  const id = useId();
  const [active, setActive] = useState(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY);
      const i = panels.findIndex((p) => p.label === saved);
      return i > -1 ? i : 0;
    } catch { return 0; }
  });
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const choose = useCallback((i: number) => {
    setActive(i);
    try { localStorage.setItem(TAB_KEY, panels[i].label); } catch { /* private mode */ }
  }, [panels]);
  const onKey = (e: KeyboardEvent) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? panels.length - 1 : (active + step + panels.length) % panels.length;
    choose(next);
    refs.current[next]?.focus();
  };
  return (
    <div>
      <TabRow role="tablist" onKeyDown={onKey}>
        {panels.map((p, i) => (
          <TabBtn key={p.label} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" id={`${id}-t${i}`}
            aria-selected={i === active} aria-controls={`${id}-p${i}`} tabIndex={i === active ? 0 : -1}
            $on={i === active} onClick={() => choose(i)}>{p.label}</TabBtn>
        ))}
      </TabRow>
      {panels.map((p, i) => (
        <TabPanel key={p.label} role="tabpanel" id={`${id}-p${i}`} aria-labelledby={`${id}-t${i}`} hidden={i !== active}>
          <Blocks blocks={p.c} ctx={ctx} />
        </TabPanel>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ blocks */

export function Blocks({ blocks, ctx }: { blocks: Block[]; ctx: LinkCtx }) {
  const { t } = useDocsT();
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'heading':
            return (
              <H key={i} as={`h${b.depth}` as 'h2'} $depth={b.depth} id={b.id}>
                <a className="anchor" href={`#${b.id}`} aria-hidden="true" tabIndex={-1} title={t('docs.anchor', { title: b.text })} />
                <Inlines nodes={b.c} ctx={ctx} />
              </H>
            );
          case 'para': return <p key={i}><Inlines nodes={b.c} ctx={ctx} /></p>;
          case 'code': return <CodeBlock key={i} code={b.code} lang={b.lang} />;
          case 'hr': return <hr key={i} />;
          case 'list': return b.ordered
            ? <ol key={i}><Items items={b.items} ctx={ctx} /></ol>
            : <ul key={i}><Items items={b.items} ctx={ctx} /></ul>;
          case 'table': return (
            <TableWrap key={i}>
              <Table>
                <thead><tr>{b.head.map((cell, j) => <th key={j} style={{ textAlign: b.align[j] }}><Inlines nodes={cell} ctx={ctx} /></th>)}</tr></thead>
                <tbody>{b.rows.map((row, r) => <tr key={r}>{row.map((cell, j) => <td key={j} style={{ textAlign: b.align[j] }}><Inlines nodes={cell} ctx={ctx} /></td>)}</tr>)}</tbody>
              </Table>
            </TableWrap>
          );
          case 'quote': {
            const tone = b.alert ? ALERT_TONE[b.alert] : '#dadada';
            return (
              <Quote key={i} $tone={tone}>
                {b.alert && <QuoteLabel style={{ color: tone }}>{t(`docs.alert.${b.alert}`)}</QuoteLabel>}
                <Blocks blocks={b.c} ctx={ctx} />
              </Quote>
            );
          }
          case 'tabs': return <OptionTabs key={i} panels={b.panels} ctx={ctx} />;
        }
      })}
    </>
  );
}

/** Scroll a deep link into view once the page it points into has rendered. */
export function useHashScroll(dep: unknown) {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const el = document.getElementById(id);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [dep]);
}
