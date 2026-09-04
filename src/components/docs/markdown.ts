/**
 * The markdown subset these docs are written in — source text to a token tree.
 *
 * Why a parser in the repo instead of `marked` / `markdown-it` / `react-markdown`: all three emit an HTML *string*,
 * which forces `dangerouslySetInnerHTML`, which forces a sanitizer as a second dependency — and the generated
 * reference pages interpolate description strings straight out of `openapi.ts`. A token tree rendered as React
 * elements (see `Markdown.tsx`) has no HTML-injection path at all, so the sanitizer question never arises. It also
 * keeps `package.json` untouched, which matters while three other workflows share this tree.
 *
 * The trade a subset renderer normally makes — the prose quietly using something the renderer does not support —
 * is closed by `errors`: every construct outside the subset is reported with its line number, `scripts/docs-check.mjs`
 * fails on it, and the renderer never silently drops or mangles a line.
 *
 * Supported, and chosen because it all renders identically on GitHub:
 *   ATX headings `#`–`####` · paragraphs · fenced code with an info string · inline code · **bold** · _italic_ ·
 *   links · unordered and ordered lists with one level of nesting · GFM pipe tables · `> [!NOTE|TIP|IMPORTANT|
 *   WARNING|CAUTION]` alerts · plain blockquotes · `---` rules · flat `key: value` frontmatter · and one directive
 *   of our own, `:::tabs` / `::tab <label>` / `:::`, for a task that has both a CLI route and a browser route.
 *
 * This module is pure — no React, no Vite, no DOM — so `packages/web/test/docs-shell.test.ts` runs it under plain node.
 */

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'code'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'link'; href: string; c: Inline[] };

export interface ListItem { c: Inline[]; sub?: { ordered: boolean; items: ListItem[] } }

export type AlertKind = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';
export type Align = 'left' | 'center' | 'right';

export type Block =
  | { t: 'heading'; depth: number; id: string; text: string; c: Inline[] }
  | { t: 'para'; c: Inline[] }
  | { t: 'code'; lang: string; code: string }
  | { t: 'list'; ordered: boolean; items: ListItem[] }
  | { t: 'table'; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { t: 'quote'; alert?: AlertKind; c: Block[] }
  | { t: 'tabs'; panels: { label: string; c: Block[] }[] }
  | { t: 'hr' };

export interface Heading { depth: number; id: string; text: string }
export interface DocError { line: number; message: string }

export interface ParsedDoc {
  /** flat `key: value` frontmatter, values unquoted */
  front: Record<string, string>;
  blocks: Block[];
  /** every heading in document order, for the on-this-page rail and for anchor checking */
  headings: Heading[];
  /** the whole page as plain text — what search matches a term inside a page *body* against */
  text: string;
  /** constructs outside the subset; `scripts/docs-check.mjs` turns these into a failed build */
  errors: DocError[];
}

const ALERTS: AlertKind[] = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];

/**
 * GitHub's heading slug: lowercase, drop everything that is not a letter, a number, a space or a hyphen, spaces to
 * hyphens. `\p{L}` keeps Hangul, so a Korean heading gets a Korean anchor rather than an empty one. Repeats get the
 * `-1`, `-2` suffix GitHub uses, so `#configuration-1` means the same section here and on GitHub.
 */
export function slugify(text: string, used?: Map<string, number>): string {
  const base = text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
  const slug = base || 'section';
  if (!used) return slug;
  const n = used.get(slug) ?? 0;
  used.set(slug, n + 1);
  return n === 0 ? slug : `${slug}-${n}`;
}

/** The visible text of an inline run — used for slugs, for the TOC rail and for the search index. */
export function inlineText(c: Inline[]): string {
  return c.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : inlineText(n.c))).join('');
}

// ------------------------------------------------------------------ inline

/** `**bold**`, `_em_`/`*em*`, `` `code` ``, `[text](href)`, `\` escapes. Anything unmatched stays literal text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < src.length) { buf += src[i + 1]; i += 2; continue; }
    if (ch === '`') {
      let ticks = 0;
      while (src[i + ticks] === '`') ticks++;
      const fence = '`'.repeat(ticks);
      const end = src.indexOf(fence, i + ticks);
      if (end > -1) { flush(); out.push({ t: 'code', v: src.slice(i + ticks, end).trim() }); i = end + ticks; continue; }
    }
    if (ch === '[') {
      const close = matchBracket(src, i, '[', ']');
      if (close > -1 && src[close + 1] === '(') {
        const paren = matchBracket(src, close + 1, '(', ')');
        if (paren > -1) {
          flush();
          out.push({ t: 'link', href: src.slice(close + 2, paren).trim(), c: parseInline(src.slice(i + 1, close)) });
          i = paren + 1; continue;
        }
      }
    }
    if (ch === '*' && src[i + 1] === '*') {
      const end = src.indexOf('**', i + 2);
      if (end > -1) { flush(); out.push({ t: 'strong', c: parseInline(src.slice(i + 2, end)) }); i = end + 2; continue; }
    }
    if (ch === '_' || ch === '*') {
      const end = src.indexOf(ch, i + 1);
      // `_` inside a word (snake_case, a file name) is not emphasis
      if (end > i + 1 && !(ch === '_' && /[\p{L}\p{N}]/u.test(src[i - 1] ?? ''))) {
        flush(); out.push({ t: 'em', c: parseInline(src.slice(i + 1, end)) }); i = end + 1; continue;
      }
    }
    buf += ch; i++;
  }
  flush();
  return out;
}

/** index of the closing delimiter, honouring nesting; -1 when it never closes */
function matchBracket(src: string, from: number, open: string, close: string): number {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === open) depth++;
    else if (src[i] === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ------------------------------------------------------------------ blocks

interface Ctx { used: Map<string, number>; headings: Heading[]; errors: DocError[]; offset: number }

function isFence(line: string): boolean { return /^```/.test(line.trim()); }
function isHr(line: string): boolean { return /^(-{3,}|\*{3,})\s*$/.test(line.trim()); }
function isHeading(line: string): boolean { return /^#{1,6}\s/.test(line); }
function isList(line: string): boolean { return /^\s*([-*]\s|\d+[.)]\s)/.test(line); }
function isQuote(line: string): boolean { return /^>\s?/.test(line); }
function isTableRow(line: string): boolean { return line.trim().startsWith('|'); }
function isTableDelim(line: string): boolean { return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/.test(line) && line.includes('-'); }

function startsBlock(line: string): boolean {
  return line.trim() === '' || isFence(line) || isHeading(line) || isHr(line) || isList(line) || isQuote(line)
    || isTableRow(line) || line.trim().startsWith(':::') || line.trim().startsWith('::tab ');
}

function parseBlocks(lines: string[], ctx: Ctx): Block[] {
  const out: Block[] = [];
  let i = 0;
  const lineNo = (idx: number) => ctx.offset + idx + 1;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }

    // fenced code
    if (isFence(line)) {
      const lang = line.trim().slice(3).trim().split(/\s+/)[0] ?? '';
      const body: string[] = [];
      i++;
      while (i < lines.length && !isFence(lines[i])) { body.push(lines[i]); i++; }
      if (i >= lines.length) ctx.errors.push({ line: lineNo(i - 1), message: 'code fence is never closed' });
      i++;
      out.push({ t: 'code', lang: lang.toLowerCase(), code: body.join('\n') });
      continue;
    }

    // :::tabs … ::tab <label> … :::
    if (line.trim() === ':::tabs') {
      const start = i;
      i++;
      const inner: string[] = [];
      let fenced = false;
      while (i < lines.length) {
        if (isFence(lines[i])) fenced = !fenced;
        if (!fenced && lines[i].trim() === ':::') break;
        inner.push(lines[i]); i++;
      }
      if (i >= lines.length) ctx.errors.push({ line: lineNo(start), message: ':::tabs is never closed with :::' });
      i++;
      out.push(parseTabs(inner, ctx, ctx.offset + start + 1));
      continue;
    }
    if (line.trim().startsWith(':::') || line.trim().startsWith('::tab ')) {
      ctx.errors.push({ line: lineNo(i), message: `stray directive ${JSON.stringify(line.trim())} — only :::tabs / ::tab <label> / ::: exist` });
      i++;
      continue;
    }

    // heading
    if (isHeading(line)) {
      const m = /^(#{1,6})\s+(.*)$/.exec(line)!;
      const depth = m[1].length;
      if (depth > 4) ctx.errors.push({ line: lineNo(i), message: 'headings deeper than #### are outside the subset' });
      const c = parseInline(m[2].trim());
      const text = inlineText(c);
      const id = slugify(text, ctx.used);
      out.push({ t: 'heading', depth: Math.min(depth, 4), id, text, c });
      ctx.headings.push({ depth: Math.min(depth, 4), id, text });
      i++;
      continue;
    }

    if (isHr(line)) { out.push({ t: 'hr' }); i++; continue; }

    // table
    if (isTableRow(line) && i + 1 < lines.length && isTableDelim(lines[i + 1])) {
      const head = splitRow(lines[i]).map(parseInline);
      const align = splitRow(lines[i + 1]).map<Align>((cell) => {
        const s = cell.trim();
        if (s.startsWith(':') && s.endsWith(':')) return 'center';
        if (s.endsWith(':')) return 'right';
        return 'left';
      });
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && isTableRow(lines[i])) { rows.push(splitRow(lines[i]).map(parseInline)); i++; }
      out.push({ t: 'table', align, head, rows });
      continue;
    }

    // blockquote / alert
    if (isQuote(line)) {
      const body: string[] = [];
      while (i < lines.length && (isQuote(lines[i]) || (body.length > 0 && lines[i].trim() !== '' && !startsBlock(lines[i])))) {
        body.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      let alert: AlertKind | undefined;
      const first = /^\[!([A-Z]+)\]\s*$/.exec(body[0]?.trim() ?? '');
      if (first) {
        if ((ALERTS as string[]).includes(first[1])) { alert = first[1] as AlertKind; body.shift(); }
        else ctx.errors.push({ line: lineNo(i - body.length), message: `unknown alert [!${first[1]}] — use NOTE, TIP, IMPORTANT, WARNING or CAUTION` });
      }
      out.push({ t: 'quote', alert, c: parseBlocks(body, ctx) });
      continue;
    }

    // list
    if (isList(line)) {
      const start = i;
      const body: string[] = [];
      while (i < lines.length && (isList(lines[i]) || (lines[i].trim() !== '' && /^\s{2,}/.test(lines[i])))) { body.push(lines[i]); i++; }
      out.push(parseList(body, ctx, ctx.offset + start));
      continue;
    }

    // unsupported: raw HTML, indented code, setext headings, reference definitions
    if (/^\s*<[a-zA-Z!/]/.test(line)) { ctx.errors.push({ line: lineNo(i), message: 'raw HTML is outside the subset' }); }
    else if (/^\s{4,}\S/.test(line) && out.length > 0) { ctx.errors.push({ line: lineNo(i), message: 'indented code is outside the subset — use a ``` fence' }); }
    else if (/^\[[^\]]+\]:\s/.test(line)) { ctx.errors.push({ line: lineNo(i), message: 'reference-style link definitions are outside the subset' }); }

    // paragraph
    const para: string[] = [line];
    i++;
    while (i < lines.length && !startsBlock(lines[i])) {
      if (/^={3,}\s*$/.test(lines[i])) { ctx.errors.push({ line: lineNo(i), message: 'setext headings are outside the subset — use #' }); }
      para.push(lines[i]); i++;
    }
    out.push({ t: 'para', c: parseInline(para.join(' ').trim()) });
  }
  return out;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let buf = '';
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '\\') { buf += trimmed[i + 1] ?? ''; i++; continue; }
    if (ch === '|') { cells.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  cells.push(buf.trim());
  return cells;
}

function parseList(lines: string[], ctx: Ctx, offset: number): Block {
  const ordered = /^\s*\d+[.)]\s/.test(lines[0]);
  const items: ListItem[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = /^(\s*)([-*]|\d+[.)])\s+(.*)$/.exec(lines[i]);
    if (!m) { i++; continue; }
    const text = [m[3]];
    const sub: string[] = [];
    i++;
    while (i < lines.length) {
      const next = /^(\s*)([-*]|\d+[.)])\s+/.exec(lines[i]);
      if (next && next[1].length > m[1].length) { sub.push(lines[i].slice(m[1].length + 2)); i++; continue; }
      if (next) break;
      if (lines[i].trim() === '') break;
      if (sub.length > 0) { sub.push(lines[i].slice(m[1].length + 2)); i++; continue; }
      text.push(lines[i].trim()); i++;
    }
    const item: ListItem = { c: parseInline(text.join(' ')) };
    if (sub.length > 0) {
      const nested = parseList(sub, ctx, offset);
      if (nested.t === 'list') {
        if (nested.items.some((it) => it.sub)) ctx.errors.push({ line: offset + 1, message: 'lists nest one level only' });
        item.sub = { ordered: nested.ordered, items: nested.items };
      }
    }
    items.push(item);
  }
  return { t: 'list', ordered, items };
}

function parseTabs(lines: string[], ctx: Ctx, offset: number): Block {
  const panels: { label: string; c: Block[] }[] = [];
  let label: string | null = null;
  let body: string[] = [];
  let fenced = false;
  const close = () => { if (label !== null) panels.push({ label, c: parseBlocks(body, { ...ctx, offset }) }); };
  for (const line of lines) {
    if (isFence(line)) fenced = !fenced;
    const m = !fenced && /^::tab\s+(.+)$/.exec(line.trim());
    if (m) { close(); label = m[1].trim(); body = []; continue; }
    if (label === null) { if (line.trim() !== '') ctx.errors.push({ line: offset, message: 'content inside :::tabs before the first ::tab' }); continue; }
    body.push(line);
  }
  close();
  if (panels.length < 2) ctx.errors.push({ line: offset, message: ':::tabs needs at least two ::tab panels' });
  return { t: 'tabs', panels };
}

// ------------------------------------------------------------------ document

/** Plain text of a block tree — the body text search matches against. */
export function blocksText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.t === 'heading' || b.t === 'para') parts.push(inlineText(b.c));
    else if (b.t === 'code') parts.push(b.code);
    else if (b.t === 'list') for (const it of b.items) { parts.push(inlineText(it.c)); if (it.sub) for (const s of it.sub.items) parts.push(inlineText(s.c)); }
    else if (b.t === 'table') { parts.push(b.head.map(inlineText).join(' ')); for (const r of b.rows) parts.push(r.map(inlineText).join(' ')); }
    else if (b.t === 'quote') parts.push(blocksText(b.c));
    else if (b.t === 'tabs') for (const p of b.panels) { parts.push(p.label); parts.push(blocksText(p.c)); }
  }
  return parts.join('\n');
}

export function parseDoc(src: string): ParsedDoc {
  const normalised = src.replace(/\r\n?/g, '\n');
  let lines = normalised.split('\n');
  const front: Record<string, string> = {};
  const errors: DocError[] = [];
  let offset = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end === -1) errors.push({ line: 1, message: 'frontmatter is never closed with ---' });
    else {
      for (let i = 1; i < end; i++) {
        const m = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(lines[i]);
        if (!m) { errors.push({ line: i + 1, message: 'frontmatter takes flat `key: value` lines only' }); continue; }
        front[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
      }
      offset = end + 1;
      lines = lines.slice(end + 1);
    }
  }
  const ctx: Ctx = { used: new Map(), headings: [], errors, offset };
  const blocks = parseBlocks(lines, ctx);
  return { front, blocks, headings: ctx.headings, text: blocksText(blocks), errors };
}
