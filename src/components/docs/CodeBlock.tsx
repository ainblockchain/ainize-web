/**
 * A fenced code block: highlighted, horizontally scrollable inside its own column (so a long command never widens
 * the page), and carrying a copy button that works off localhost too.
 *
 * `navigator.clipboard` exists only in a secure context, and a node is routinely browsed at `http://<lan-ip>:3402`
 * from another machine — where the promise rejects and a button with no fallback silently does nothing. The
 * `execCommand` path is the fallback for exactly that case.
 */
import styled from 'styled-components';
import { useClipboardCopy } from '@/hooks/useClipboardCopy';
import { useDocsT } from './i18n';
import { highlight, type TokenKind } from './highlight';
import { practiceHref } from './practice';
import type { LinkCtx } from './docsTree';

/** Light-on-dark, on the same code surface the rest of the app already uses (#1f1f23). */
const TOKEN: Record<TokenKind, string> = {
  plain: '#e9e6f5',
  comment: '#9f9ab5',
  string: '#a8e0a8',
  number: '#ffc37d',
  keyword: '#c597ff',
  command: '#ffffff',
  flag: '#78d9e9',
  punct: '#b9b4c9',
  key: '#78d9e9',
};

const Wrap = styled.div`
  position: relative; margin: 16px 0;
  &:hover button, &:focus-within button { opacity: 1; }
`;

const Pre = styled.pre`
  margin: 0; padding: 14px 16px; border-radius: 8px; background: #1f1f23; color: ${TOKEN.plain};
  font-family: ${(p) => p.theme.font.mono}; font-size: 13.5px; line-height: 1.6; overflow-x: auto;
  code { font-family: inherit; }
  b { font-weight: 600; }
`;

const Copy = styled.button`
  position: absolute; top: 8px; right: 8px; z-index: 1; opacity: 0; transition: opacity 0.15s ease, background 0.15s ease;
  padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.28); background: rgba(31, 31, 35, 0.9);
  color: #e9e6f5; font-size: 12px; cursor: pointer;
  &:hover { background: rgba(139, 62, 235, 0.5); border-color: ${(p) => p.theme.color.PRESSED}; }
  &:focus-visible { opacity: 1; }
  @media (hover: none) { opacity: 1; }
`;

const Lang = styled.span`
  position: absolute; top: 12px; right: 74px; font-family: ${(p) => p.theme.font.mono}; font-size: 11px;
  letter-spacing: 0.04em; color: #6f6a80; text-transform: uppercase; pointer-events: none;
`;

export function CodeBlock({ code, lang, ctx, stepId, runnable = false }: { code: string; lang: string; ctx?: LinkCtx; stepId?: string; runnable?: boolean }) {
  const { t } = useDocsT();
  const copy = useClipboardCopy(code);
  const tokens = highlight(code, lang);
  const label = copy.phase === 'copied' ? t('docs.copied') : copy.phase === 'failed' ? t('docs.copy_failed') : copy.phase === 'copying' ? t('docs.copying') : t('docs.copy');
  return (
    <Wrap>
      {lang && lang !== 'text' && <Lang aria-hidden="true">{lang}</Lang>}
      <Copy
        type="button"
        disabled={copy.disabled} aria-busy={copy.phase === 'copying'} aria-live="polite"
        onClick={() => void copy.copy()}
      >{label}</Copy>
      <Pre><code>{tokens.map((tok, i) => (
        tok.k === 'plain' ? <span key={i}>{tok.v}</span> : <span key={i} style={{ color: TOKEN[tok.k], fontWeight: tok.k === 'command' ? 600 : undefined }}>{tok.v}</span>
      ))}</code></Pre>
      {/* Only where AinCode opens the block ready to run: a node of your own, a value to fill in, a file or an
          output sample has nothing to press Enter on. */}
      {ctx && runnable && <a href={practiceHref(ctx, stepId)}>{t('docs.practice.block')}</a>}
    </Wrap>
  );
}
