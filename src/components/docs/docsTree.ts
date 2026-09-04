/**
 * The docs tree: two `_toctree.json` files and a bag of markdown sources in, a navigable site per language out.
 *
 * Navigation lives in `docs/{en,ko}/_toctree.json` and not in the pages, which is what lets the tree be translated,
 * reordered and validated without touching a word of content — and it is where "listed in the toctree" is made to
 * mean "finished". A toctree entry whose file is missing is dropped from the navigation here (a reader never gets a
 * sidebar link to a 404) and reported in `missing`, which `scripts/docs-check.mjs` turns into a failed build.
 *
 * Pure — no React, no Vite — so `packages/web/test/docs-shell.test.ts` runs it under plain node with hand-made input.
 */
import { parseDoc, type Heading, type ParsedDoc } from './markdown';

export type Lang = 'en' | 'ko';
export const LANGS: Lang[] = ['en', 'ko'];

/** one page in `_toctree.json`; `untranslated` keeps a Korean entry that renders the English body under a banner */
export interface TocPage { page: string; title: string; untranslated?: boolean }
export interface TocGroup { group: string; pages: TocPage[] }
export type Toctree = TocGroup[];

export interface DocEntry {
  lang: Lang;
  /** path under `docs/<lang>/` without the extension: `index`, `get-started/install` */
  slug: string;
  /** the title the navigation shows — from the toctree, so it is translated and reorderable */
  title: string;
  group: string;
  /** true when this language's page does not exist and the English body is being shown instead */
  untranslated: boolean;
  href: string;
  doc: ParsedDoc;
  /** one line for search results: frontmatter `summary`, else the first paragraph */
  summary: string;
}

export interface DocGroup { group: string; pages: DocEntry[] }

export interface DocSite {
  lang: Lang;
  groups: DocGroup[];
  /** the toctree flattened across group boundaries — the order previous/next walks */
  flat: DocEntry[];
  bySlug: Map<string, DocEntry>;
  /** toctree entries with no file behind them (dropped from the navigation) */
  missing: string[];
  /** files under `docs/<lang>/` that no toctree lists */
  orphans: string[];
  /** entries whose `untranslated` flag disagrees with what is on disk — the flag is documentation, the file is the fact */
  mislabelled: string[];
}

/** `/docs/<slug>` in English, `/docs/ko/<slug>` in Korean — English is the default so a bare URL is pasteable. */
export function docHref(lang: Lang, slug: string): string {
  return lang === 'en' ? `/docs/${slug}` : `/docs/ko/${slug}`;
}

/**
 * Split a `/docs/...` pathname into the language and the page.
 * `defaultLang` is the reader's current app locale, so a Korean reader following a bare `/docs/index` link still
 * lands on the Korean page; the explicit `/docs/ko/...` form pins the language into the URL.
 */
export function parseDocsPath(pathname: string, defaultLang: Lang): { lang: Lang; slug: string; explicit: boolean } {
  const rest = pathname.replace(/^\/docs\/?/, '').replace(/\/+$/, '');
  const [head, ...tail] = rest.split('/');
  if (head === 'ko' || head === 'en') return { lang: head, slug: tail.join('/'), explicit: true };
  return { lang: defaultLang, slug: rest, explicit: false };
}

function firstParagraph(doc: ParsedDoc): string {
  for (const b of doc.blocks) {
    if (b.t === 'para') return b.c.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : '')).join('').trim();
  }
  return '';
}

/**
 * `raw` is keyed by the path under `docs/`: `en/index.md`, `ko/get-started/install.md`.
 * `toctrees` is keyed by language.
 */
export function buildSite(lang: Lang, raw: Record<string, string>, toctree: Toctree): DocSite {
  const groups: DocGroup[] = [];
  const flat: DocEntry[] = [];
  const bySlug = new Map<string, DocEntry>();
  const missing: string[] = [];
  const mislabelled: string[] = [];
  const listed = new Set<string>();

  for (const g of toctree) {
    const pages: DocEntry[] = [];
    for (const p of g.pages) {
      const own = `${lang}/${p.page}.md`;
      const fallback = `en/${p.page}.md`;
      const untranslated = !raw[own];
      const source = raw[own] ?? (untranslated ? raw[fallback] : undefined);
      if (source === undefined) { missing.push(own); continue; }
      if (lang !== 'en' && Boolean(p.untranslated) !== untranslated) mislabelled.push(own);
      listed.add(own);
      if (untranslated) listed.add(fallback);
      const doc = parseDoc(source);
      const entry: DocEntry = {
        lang, slug: p.page, title: p.title, group: g.group,
        untranslated: untranslated && lang !== 'en',
        href: docHref(lang, p.page),
        doc,
        summary: doc.front.summary ?? firstParagraph(doc),
      };
      pages.push(entry); flat.push(entry); bySlug.set(p.page, entry);
    }
    if (pages.length > 0) groups.push({ group: g.group, pages });
  }

  const orphans = Object.keys(raw)
    .filter((k) => k.startsWith(`${lang}/`) && !listed.has(k))
    .sort();

  return { lang, groups, flat, bySlug, missing, orphans, mislabelled };
}

/** The neighbours previous/next point at — the flattened tree, so the walk crosses group boundaries. */
export function neighbours(site: DocSite, slug: string): { prev?: DocEntry; next?: DocEntry } {
  const i = site.flat.findIndex((e) => e.slug === slug);
  if (i === -1) return {};
  return { prev: site.flat[i - 1], next: site.flat[i + 1] };
}

// ------------------------------------------------------------------ search

export interface SearchHit {
  entry: DocEntry;
  where: 'title' | 'heading' | 'body';
  heading?: Heading;
  /** the matched term in context; `before`/`after` are plain text around it */
  snippet?: { before: string; match: string; after: string };
  score: number;
}

const WS = /\s+/g;

function context(text: string, at: number, len: number): { before: string; match: string; after: string } {
  const before = text.slice(Math.max(0, at - 48), at).replace(WS, ' ');
  const after = text.slice(at + len, at + len + 96).replace(WS, ' ');
  return {
    before: (at > 48 ? '…' : '') + before,
    match: text.slice(at, at + len),
    after: after + (at + len + 96 < text.length ? '…' : ''),
  };
}

/**
 * Client-side search over the built tree. It matches inside a page **body**, not only its title: `doc.text` is the
 * whole page as plain text, so a term that appears once in a paragraph or in a command is findable, and the hit
 * carries the sentence it was found in.
 */
export function searchDocs(site: DocSite, query: string, limit = 8): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const entry of site.flat) {
    const title = entry.title.toLowerCase();
    if (title.includes(q)) {
      hits.push({ entry, where: 'title', score: title.startsWith(q) ? 100 : 80 });
      continue;
    }
    const heading = entry.doc.headings.find((h) => h.text.toLowerCase().includes(q));
    if (heading) {
      hits.push({ entry, where: 'heading', heading, score: 60 });
      continue;
    }
    const text = entry.doc.text;
    const at = text.toLowerCase().indexOf(q);
    if (at > -1) hits.push({ entry, where: 'body', snippet: context(text, at, q.length), score: 40 });
  }
  return hits.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title)).slice(0, limit);
}

// ------------------------------------------------------------------ links inside a page

export interface LinkCtx { lang: Lang; slug: string }

/**
 * Resolve a link written inside a page. `./install.md`, `../reference/cli.md#options` and `install` all resolve to a
 * page in the same language; `/api/openapi.json` is served by the node rather than routed by the app, so anything
 * with a file extension stays a plain anchor instead of becoming a react-router link into the SPA's 404 page.
 */
export function resolveDocHref(href: string, ctx: LinkCtx): { kind: 'external' | 'route' | 'anchor' | 'file'; to: string } {
  if (/^(https?:|mailto:|tel:)/i.test(href)) return { kind: 'external', to: href };
  if (href.startsWith('#')) return { kind: 'anchor', to: href };
  // `/api/openapi.json` is served by the node, not routed by the app: a react-router Link there would be swallowed
  // by the SPA and land on its 404 page, so anything with a file extension stays a plain anchor.
  if (href.startsWith('/')) return { kind: /\.[a-zA-Z0-9]+(\?|#|$)/.test(href.split('/').pop() ?? '') ? 'file' : 'route', to: href };
  const [path, hash] = href.split('#');
  const dir = ctx.slug.includes('/') ? ctx.slug.slice(0, ctx.slug.lastIndexOf('/')) : '';
  const parts = (dir ? `${dir}/${path}` : path).split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (part === '.' || part === '') continue;
    if (part === '..') { stack.pop(); continue; }
    stack.push(part);
  }
  const slug = stack.join('/').replace(/\.md$/, '');
  return { kind: 'route', to: docHref(ctx.lang, slug) + (hash ? `#${hash}` : '') };
}
